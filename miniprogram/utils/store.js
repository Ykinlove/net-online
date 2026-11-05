// utils/store.js —— 数据层：本地缓存（wx.storage）+ 微信云开发数据库双向同步
// 云端集合（需在云开发控制台手动创建）：profiles / commands / projects / skills / tasks
// 权限建议：每个集合设为「仅创建者可读写」，这样每个微信用户只能读写自己的数据。
// 说明：自动存档只存本机（wx.storage），不占云端集合。


const CLOUD_COLL = ['profiles', 'commands', 'projects', 'skills', 'tasks'];
const PAGE_SIZE = 20; // 小程序端单次查询上限就是 20 条
/* 单人云端存储上限：防止个别用户刷爆数据库容量。
   普通用户记命令几十~几百条足够；按 2GB 配额、单人 3KB/条估算，
   千人 × 500 条命令 ≈ 1.5GB，仍在安全范围。profiles 每人仅 1 条档案，不在此限。 */
const COLL_LIMIT = { commands: 500, projects: 50, skills: 200, tasks: 200 };
const MAX_RECORD_BYTES = 12 * 1024; // 单条内容上限 12KB（约 4000 汉字），防单条超大撑爆容量
/* 正在进行的云端拉取（共享同一个 Promise，用于并发去重） */
let PULLING = null;

const mem = {
  inited: false,
  profile: null,
  commands: [],
  projects: [],
  skills: [],
  tasks: [],
  lastError: '',
  lastPullAt: 0,
  cloudOk: false,
  pulledOnce: false
};

/* ---------------- 本地缓存 ---------------- */
function sGet(key, def) {
  try {
    const v = wx.getStorageSync('no_' + key);
    return v === '' || v === null || v === undefined ? def : v;
  } catch (e) {
    return def;
  }
}
function sSet(key, val) {
  /* 原来这里空 catch 吞掉所有异常 —— 微信单 key 上限 1MB，
     写不进去时抛错被吞掉，调用方以为存成功了。
     存档功能因此会「静默失效」：用户以为有备份，实际没有。
     改成返回成功标记，失败时留一条日志。 */
  try {
    wx.setStorageSync('no_' + key, val);
    return true;
  } catch (e) {
    console.warn('[store] setStorageSync 失败:', key, e && e.message);
    return false;
  }
}
function sDel(key) {
  try { wx.removeStorageSync('no_' + key); } catch (e) {}
}

function init() {
  if (mem.inited) return;
  mem.profile = sGet('profile', null);
  mem.commands = sGet('commands', []) || [];
  mem.projects = sGet('projects', []) || [];
  mem.skills = sGet('skills', []) || [];
  mem.tasks = sGet('tasks', []) || [];
  mem.inited = true;
}

/* ---------------- 云端基础 ---------------- */
function db() {
  if (!wx.cloud) return null;
  try { return wx.cloud.database(); } catch (e) { return null; }
}

function isReady() {
  const app = getApp();
  return !!(app && app.globalData && app.globalData.cloudReady && wx.cloud);
}

function errText(e) {
  if (!e) return '未知错误';
  const code = e.errCode || e.code || '';
  const msg = e.errMsg || e.message || '';
  if (String(msg).indexOf('collection not exists') >= 0 || code === -502005) {
    return '云数据库集合还没创建，请到「云开发 → 数据库」新建 profiles、commands、projects、skills、tasks 五个集合';
  }
  if (String(msg).indexOf('permission') >= 0 || code === -502003) return '没有数据库权限，请把集合权限设为「仅创建者可读写」';
  return msg || ('错误码 ' + code);
}

/* 估算一个对象序列化后的字节数（UTF-8），用于单条大小限制 */
function byteLengthOf(obj) {
  let s = '';
  try { s = JSON.stringify(obj); } catch (e) { s = ''; }
  if (typeof TextEncoder !== 'undefined') {
    try { return new TextEncoder().encode(s).length; } catch (e) {}
  }
  let len = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    len += c < 0x80 ? 1 : (c < 0x800 ? 2 : 3);
  }
  return len;
}

/* 拉取某集合的全部记录（自动分页，单页 20 条） */
async function fetchAll(name) {
  const d = db();
  if (!d) throw new Error('云开发不可用');
  const col = d.collection(name);
  /* 不用 count()：count 是一次额外的网络往返，而 get 返回不满 PAGE_SIZE
     本就说明到底了 —— 少 5 次查询（5 个集合各一次）。 */
  const out = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const res = await col.orderBy('createdAt', 'asc').skip(skip).limit(PAGE_SIZE).get();
    const rows = (res && res.data) || [];
    out.push.apply(out, rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

async function cloudAdd(name, data) {
  const d = db();
  if (!d) throw new Error('云开发不可用');
  const limit = COLL_LIMIT[name];
  if (limit) {
    const cnt = await d.collection(name).count();
    if (cnt && cnt.total >= limit) {
      const e = new Error('该分类已达单人上限（' + limit + ' 条），请先清理不再需要的内容');
      e.code = 'LIMIT_REACHED';
      throw e;
    }
  }
  const size = byteLengthOf(data);
  if (size > MAX_RECORD_BYTES) {
    const e = new Error('单条内容过大（上限 ' + Math.round(MAX_RECORD_BYTES / 1024) + 'KB），请精简后再存');
    e.code = 'TOO_LARGE';
    throw e;
  }
  const now = Date.now();
  const res = await d.collection(name).add({ data: Object.assign({}, data, { createdAt: now, updatedAt: now }) });
  return res._id;
}
async function cloudUpdate(name, id, data) {
  const d = db();
  await d.collection(name).doc(id).update({ data: Object.assign({}, data, { updatedAt: Date.now() }) });
}
async function cloudRemove(name, id) {
  const d = db();
  await d.collection(name).doc(id).remove();
}

/* ---------------- 读写接口 ---------------- */
function getProfile() {
  init();
  return mem.profile;
}
function hasProfile() {
  const p = getProfile();
  return !!(p && p.nickname);
}
function setProfileLocal(p) {
  init();
  mem.profile = p;
  sSet('profile', p);
  /* 形象/背景以云端档案为准，回写一份到本地缓存：
     否则换设备（电脑端打开）本地没有 charImage，会被判成「没选过形象」强制重选 */
  if (p && p.charImage) sSet('charImage', p.charImage);
  if (p && p.bgImage) sSet('charBg', p.bgImage);
}

async function saveProfile(p) {
  init();
  const data = Object.assign({}, p);
  delete data._id;
  delete data._openid;
  const cur = mem.profile || {};
  if (isReady()) {
    try {
      if (cur._id) {
        await cloudUpdate('profiles', cur._id, data);
      } else {
        const rows = await fetchAll('profiles');
        if (rows && rows.length) {
          await cloudUpdate('profiles', rows[0]._id, data);
          data._id = rows[0]._id;
        } else {
          data._id = await cloudAdd('profiles', data);
        }
      }
      mem.cloudOk = true;
      mem.lastError = '';
    } catch (e) {
      mem.lastError = errText(e);
    }
  }
  if (!data._id && cur._id) data._id = cur._id;
  setProfileLocal(data);
  return data;
}

async function clearProfile() {
  init();
  const cur = mem.profile || {};
  if (isReady() && cur._id) {
    try { await cloudRemove('profiles', cur._id); } catch (e) { mem.lastError = errText(e); }
  }
  mem.profile = null;
  sDel('profile');
  sDel('charImage');
  sDel('charBg');
  sDel('unlocks');
}

function getList(name) {
  init();
  return mem[name] || [];
}
function setListLocal(name, arr) {
  init();
  mem[name] = arr;
  sSet(name, arr);
}

/* 新增一条：先落本地（带临时 id），再写云端换正式 _id */
async function addRecord(name, data) {
  init();
  const now = Date.now();
  const rec = Object.assign({}, data, { _localId: 'L' + now + Math.floor(Math.random() * 1000), createdAt: now, updatedAt: now });
  const list = (mem[name] || []).concat([rec]);
  setListLocal(name, list);
  if (isReady()) {
    try {
      const id = await cloudAdd(name, data);
      const cur = (mem[name] || []).map(x => (x._localId === rec._localId ? Object.assign({}, x, { _id: id }) : x));
      setListLocal(name, cur);
      mem.cloudOk = true;
      mem.lastError = '';
      return cur[cur.length - 1];
    } catch (e) {
      mem.lastError = errText(e);
      /* 限额 / 单条过大：云端拒绝写入，本地这条临时记录也要回滚，
         否则本地比云端多一条、下次同步还会再撞限额 */
      if (e && (e.code === 'LIMIT_REACHED' || e.code === 'TOO_LARGE')) {
        setListLocal(name, (mem[name] || []).filter(x => x._localId !== rec._localId));
      }
      return rec;
    }
  }
  return rec;
}

async function updateRecord(name, rec, patch) {
  init();
  const key = rec._id || rec._localId;
  const list = (mem[name] || []).map(x => {
    const xk = x._id || x._localId;
    return xk === key ? Object.assign({}, x, patch, { updatedAt: Date.now() }) : x;
  });
  setListLocal(name, list);
  if (isReady() && rec._id) {
    try {
      await cloudUpdate(name, rec._id, patch);
      mem.cloudOk = true;
      mem.lastError = '';
    } catch (e) {
      mem.lastError = errText(e);
    }
  }
}

async function removeRecord(name, rec) {
  init();
  const key = rec._id || rec._localId;
  setListLocal(name, (mem[name] || []).filter(x => (x._id || x._localId) !== key));
  if (isReady() && rec._id) {
    try {
      await cloudRemove(name, rec._id);
      mem.cloudOk = true;
      mem.lastError = '';
    } catch (e) {
      mem.lastError = errText(e);
    }
  }
}

/* ---------------- 同步 ---------------- */
async function pullAll() {
  init();
  if (!isReady()) {
    mem.cloudOk = false;
    return { ok: false, reason: 'cloud-unavailable' };
  }
  /* 并发去重：splash 启动拉取还没完，用户又触发了下拉刷新时，
     原来会并行跑两轮完整的 5 集合拉取，云端白挨一倍请求。
     参照 hotfix.refresh() 的 PULLING 写法，共享同一个 Promise。 */
  if (PULLING) return PULLING;
  PULLING = pullAllInner();
  try {
    return await PULLING;
  } finally {
    PULLING = null;
  }
}

async function pullAllInner() {
  let okCount = 0;
  const errors = [];
  for (let i = 0; i < CLOUD_COLL.length; i++) {
    const name = CLOUD_COLL[i];
    try {
      const rows = await fetchAll(name);
      if (name === 'profiles') {
        if (rows && rows.length) {
          const best = rows.slice().sort((a, b) => (b.exp || 0) - (a.exp || 0))[0];
          setProfileLocal(best);
        }
      } else {
        setListLocal(name, rows || []);
      }
      okCount++;
    } catch (e) {
      errors.push(name + ':' + errText(e));
    }
  }
  mem.lastPullAt = Date.now();
  mem.pulledOnce = true;
  mem.cloudOk = okCount > 0;
  mem.lastError = errors.length ? errors[0] : '';
  return { ok: okCount > 0, okCount, errors, total: CLOUD_COLL.length };
}

/* 注意：命令库不内置任何预设命令，全部由用户自己添加 */

/* ---------------- 工具 ---------------- */
function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
function uid() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}
function formatShortDate(s) {
  if (!s) return '';
  const p = String(s).slice(0, 10).split('-');
  return p.length === 3 ? parseInt(p[1], 10) + '/' + parseInt(p[2], 10) : s;
}

/* ---------------- 收藏 ----------------
 * 收藏三类东西：百科条目（book）、配置模板（tpl）、自己记的命令（mine）。
 * 统一存进 profile.favs —— 跟着档案走，不用新建云端集合，
 * 换设备自动同步（档案本来就是云端同步的）。
 *
 * 每条收藏记：kind 类型、id 主键、title 名字、sub 副标题（设备/分类/厂商）、
 * ts 收藏时间。内容本体不存——百科和模板都在包里，存了会重复占空间。
 */
const FAV_MAX = 200;   /* 收藏上限，防止无限膨胀拖慢档案读写 */

function getFavs() {
  init();
  const p = mem.profile || {};
  const raw = (p.favs && Array.isArray(p.favs)) ? p.favs : (sGet('favs', []) || []);
  return raw.filter(f => f && f.id);
}

function isFav(kind, id) {
  return getFavs().some(f => f.kind === kind && f.id === id);
}

function favKey(kind, id) { return kind + ':' + id; }

/**
 * 收藏 / 取消收藏。
 * @param {object} item {kind, id, title, sub}
 * @returns {Promise<boolean>} 操作后是否处于「已收藏」
 */
async function toggleFav(item) {
  init();
  const list = getFavs();
  const key = favKey(item.kind, item.id);
  const idx = list.findIndex(f => favKey(f.kind, f.id) === key);
  let on;
  if (idx >= 0) {
    list.splice(idx, 1);
    on = false;
  } else {
    list.unshift({
      kind: item.kind,
      id: item.id,
      title: item.title || '',
      sub: item.sub || '',
      ts: Date.now()
    });
    on = true;
    /* 新的排前面，超过上限就丢最旧的 */
    while (list.length > FAV_MAX) list.pop();
  }
  sSet('favs', list);
  const p = mem.profile;
  if (p && p.nickname) {
    await saveProfile(Object.assign({}, p, { favs: list }));
  }
  return on;
}

/* ---------------- 搜索历史 / 零结果 ----------------
 * 搜索历史：用户搜过的词，最近的排前面，同一个词不重复。
 * 零结果记录：搜了但一条都没搜到的词——这是内容建设的输入源，
 * 说明库里缺这个说法。不上云，先存本地（云端集合要手动建，
 * 而且个人用法上报到云端没意义，开发者本地看更直接）。
 */
const HIST_MAX = 20;
const MISS_MAX = 100;

function getSearchHistory() {
  init();
  const arr = sGet('searchHistory', []) || [];
  return Array.isArray(arr) ? arr : [];
}

/**
 * 记一次搜索。
 * @param {string} kw 搜索词
 * @param {number} hitCount 命中的条目数
 */
function addSearchHistory(kw, hitCount) {
  init();
  const q = String(kw || '').trim();
  if (!q) return;
  const arr = getSearchHistory().filter(x => x.kw !== q);
  arr.unshift({ kw: q, hit: hitCount || 0, ts: Date.now() });
  while (arr.length > HIST_MAX) arr.pop();
  sSet('searchHistory', arr);
  /* 一次都没搜到的单独记一份 */
  if (!hitCount) {
    const miss = sGet('searchMiss', []) || [];
    const m = Array.isArray(miss) ? miss : [];
    const idx = m.findIndex(x => x.kw === q);
    if (idx >= 0) {
      m[idx].count = (m[idx].count || 1) + 1;
      m[idx].ts = Date.now();
    } else {
      m.unshift({ kw: q, count: 1, ts: Date.now() });
    }
    while (m.length > MISS_MAX) m.pop();
    sSet('searchMiss', m);
  }
}

function clearSearchHistory() {
  init();
  sSet('searchHistory', []);
  sSet('searchMiss', []);
}

function getSearchMiss() {
  init();
  const arr = sGet('searchMiss', []) || [];
  return Array.isArray(arr) ? arr : [];
}

/* ---------------- 形象 / 背景解锁 ---------------- */
function getUnlocks() {
  init();
  const p = mem.profile || {};
  const raw = (p.unlocks && typeof p.unlocks === 'object') ? p.unlocks : (sGet('unlocks', {}) || {});
  return { char: (raw.char || []).slice(), bg: (raw.bg || []).slice() };
}

function isUnlocked(kind, id) {
  return getUnlocks()[kind].indexOf(id) >= 0;
}

async function addUnlock(kind, id) {
  const u = getUnlocks();
  if (u[kind].indexOf(id) < 0) u[kind].push(id);
  sSet('unlocks', u);
  const p = mem.profile;
  if (p && p.nickname) await saveProfile(Object.assign({}, p, { unlocks: u }));
  return u;
}

/* ---------------- 自动存档（只存本机） ---------------- */
/* 存档份数：原来 5 份全量深拷贝，实测 798KB —— 占微信单 key 1MB 上限的 78%。
   数据再涨一点就写不进去（而 sSet 原来还把异常吞了，静默失效）。
   降到 3 份，并在写入前按体积淘汰最旧的，宁可少存也不要存不进去。 */
const ARCHIVE_KEEP = 3;
const ARCHIVE_GAP = 60 * 1000;
/* 存档总体积上限，留出余量给微信其它存储 */
const ARCHIVE_MAX_BYTES = 600 * 1024;

function getSnapshots() {
  init();
  return sGet('snapshots', []) || [];
}
function setSnapshots(arr) {
  /* 写入前按体积淘汰最旧的：宁可少存几份，也不要整份写失败 */
  let list = arr;
  while (list.length > 1 && JSON.stringify(list).length > ARCHIVE_MAX_BYTES) {
    list = list.slice(0, list.length - 1);
  }
  if (!sSet('snapshots', list)) {
    /* 写不进去就退一步：只留最新一份，再试一次 */
    sSet('snapshots', list.slice(0, 1));
  }
}

function cleanRec(r) {
  const c = Object.assign({}, r);
  delete c._openid;
  delete c._localId;
  return c;
}

/* 在破坏性操作前调用；返回快照对象 */
function snapshot(reason) {
  init();
  const list = getSnapshots();
  const last = list[0];
  // 间隔太近就不重复存了：上一份已经包含删除前的状态
  if (last && Date.now() - (last.at || 0) < ARCHIVE_GAP) return last;

  const p = mem.profile || {};
  const snap = {
    at: Date.now(),
    reason: reason || '自动存档',
    payload: {
      nickname: p.nickname || '', org: p.org || '', major: p.major || '', stage: p.stage || '',
      oneLineDesc: p.oneLineDesc || '', interests: p.interests || '', careers: p.careers || '',
      exp: Number(p.exp) || 0,
      charImage: getCharImage(), bgImage: getCharBg(),
      cmdCount: (mem.commands || []).length,
      projectCount: (mem.projects || []).length,
      skillCount: (mem.skills || []).length,
      data: {
        commands: (mem.commands || []).map(cleanRec),
        projects: (mem.projects || []).map(cleanRec),
        skills: (mem.skills || []).map(cleanRec),
        tasks: (mem.tasks || []).map(cleanRec)
      }
    }
  };
  setSnapshots([snap].concat(list).slice(0, ARCHIVE_KEEP));
  return snap;
}

function removeSnapshot(at) {
  setSnapshots(getSnapshots().filter(s => s.at !== at));
}

/* 把某份快照完整还原（本机 + 云端） */
async function applySnapshot(snap) {
  init();
  const pay = (snap && snap.payload) || {};
  if (!pay.nickname) return { ok: false, reason: 'empty' };

  await saveProfile({
    nickname: pay.nickname, org: pay.org || '', major: pay.major || '', stage: pay.stage || '',
    oneLineDesc: pay.oneLineDesc || '', interests: pay.interests || '', careers: pay.careers || '',
    exp: Number(pay.exp) || 0,
    charImage: pay.charImage || getCharImage(),
    bgImage: pay.bgImage || getCharBg(),
    unlocks: (mem.profile && mem.profile.unlocks) || {}
  });
  if (pay.charImage) setCharImage(pay.charImage);
  if (pay.bgImage) setCharBg(pay.bgImage);

  const names = ['commands', 'projects', 'skills', 'tasks'];
  const data = pay.data || {};
  const ready = isReady();

  // 没有 _id 也没有 _localId 的记录，列表里就没有稳定 key，补一个
  const withKey = r => (r._id || r._localId ? r : Object.assign({}, r, { _localId: 'L' + Date.now() + Math.floor(Math.random() * 1000) }));

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const target = (data[name] || []).map(cleanRec);
    if (!ready) { setListLocal(name, target.map(withKey)); continue; }

    const cur = (mem[name] || []).slice();
    const curById = {};
    cur.forEach(r => { if (r._id) curById[r._id] = r; });

    const out = [];
    for (let j = 0; j < target.length; j++) {
      const r = target[j];
      if (r._id && curById[r._id]) {
        // 云端还在，覆盖回快照内容
        try { await cloudUpdate(name, r._id, cleanRec(r)); } catch (e) {}
        delete curById[r._id];
        out.push(r);
      } else {
        // 云端已被删掉，重新插回去
        const body = Object.assign({}, r);
        delete body._id;
        try {
          const id = await cloudAdd(name, body);
          out.push(Object.assign({}, r, { _id: id }));
        } catch (e) {
          out.push(Object.assign({}, r, { _localId: 'L' + Date.now() + Math.floor(Math.random() * 1000) }));
        }
      }
    }
    // 快照之后新增的记录要清掉，才能完全回到快照时的状态
    for (const k in curById) {
      try { await cloudRemove(name, curById[k]._id); } catch (e) {}
    }
    setListLocal(name, out);
  }
  return { ok: true };
}

/* 角色形象（全部为内置预设图，存相对路径）
   读取顺序：本地缓存 → 云端档案字段。
   第二条是换设备的关键：同一微信在电脑端打开时本地缓存是空的，
   但云端 profiles 里有 charImage，必须能回读，否则会被当成「没选过形象」强制重选。 */
function getCharImage() {
  const local = sGet('charImage', '');
  if (local) return local;
  const p = getProfile();
  return (p && p.charImage) || '';
}
function setCharImage(v) { sSet('charImage', v || ''); }
function getCharBg() {
  const local = sGet('charBg', '');
  if (local) return local;
  const p = getProfile();
  return (p && (p.bgImage || p.charBg)) || '';
}
function setCharBg(v) { sSet('charBg', v || ''); }

/* 等云端拉取完（或超时）再做路由判断，避免刚打开就点「进入」时档案还没下来 */
function waitPull(timeout) {
  const LIMIT = timeout || 3500;
  if (mem.pulledOnce) return Promise.resolve(true);
  return new Promise(resolve => {
    const t0 = Date.now();
    const tick = () => {
      if (mem.pulledOnce) return resolve(true);
      if (Date.now() - t0 >= LIMIT) return resolve(false);
      setTimeout(tick, 120);
    };
    tick();
  });
}

module.exports = {
  init, getProfile, hasProfile, saveProfile, clearProfile, setProfileLocal,
  getList, setListLocal, addRecord, updateRecord, removeRecord,
  pullAll, waitPull,
  getFavs, isFav, toggleFav,
  getSearchHistory, addSearchHistory, clearSearchHistory, getSearchMiss,
  today, uid, formatShortDate,
  getUnlocks, isUnlocked, addUnlock,
  getSnapshots, snapshot, removeSnapshot, applySnapshot,
  getCharImage, setCharImage, getCharBg, setCharBg,
  isReady, errText,
  mem
};
