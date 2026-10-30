// utils/hotfix.js —— 云端内容热更新
//
// 两类云端数据：
//   1) 覆盖记录 content_patch：针对「包里已存在的条目」做字段修正（不增删条目）
//   2) 已批准新增 extra_items：社区投稿被作者审核通过后、且本地包还没有的新条目
//
// 数据真源仍是本地打包数据（cmdbook.js / tplbook.js）。云端只存覆盖记录 / 新增条目，
// 运行时叠加到本地条目的副本上，不污染包内常量、断网也能用本地缓存。
//
// 拉取 / 发布默认走云函数（listContent / publishContent），带作者鉴权；
// 没部署云函数时自动降级为直连数据库（旧行为），保证可用性。
//
// 云端集合：
//   content_patch { _id, kind:'book'|'tpl', targetId, patch:{...}, updatedAt, remark }
//   extra_items  { _id, kind:'book'|'tpl', item:{...完整条目...}, approvedAt }
//
// 注意 remark 是「作者发布备注」（记录的元数据），与条目自身的 note 业务字段同名冲突，
// 故记录侧用 remark，条目侧用 note；mergePatch 只跳过记录的元数据（含 remark），
// 不会误伤条目 note。
//
// 纯函数（mergePatch / ingest / ingestExtras / getPatch / applyPatch / version）
// 不依赖 wx，可在 node 下直接单测；pull / refresh / publish* 依赖云端环境。

const COLL = 'content_patch';
const EXTRA = 'extra_items';

/* 这些字段是 patch 记录的元数据，不能覆盖到条目业务字段上 */
const META = ['_id', 'targetId', 'kind', 'updatedAt', 'createdAt', 'remark', '__u'];

const STORE_KEY = 'hotfix_patch_v1';
const PAGE = 100;

const KIND_BOOK = 'book';
const KIND_TPL = 'tpl';

let PATCH = { book: {}, tpl: {} }; // kind -> { targetId -> patchObj（含 __u 时间戳）}
let EXTRAS = { book: {}, tpl: {} }; // kind -> { id -> 完整条目 }（已批准新增）
let VERSION = 0;                   // 每次数据变化 +1，供 cmdbook 失效索引缓存
let READY = false;                 // 本地缓存或云端是否已加载过
let PULLING = false;

/* ---------------- 纯函数（node 可单测） ---------------- */

// 把一个 patch 叠加到条目副本上，返回新对象；patch 为空则原样返回。
function mergePatch(item, patch) {
  if (!item) return item;
  if (!patch) return item;
  const out = Object.assign({}, item);
  Object.keys(patch).forEach(function (k) {
    if (META.indexOf(k) >= 0) return;
    out[k] = patch[k];
  });
  return out;
}

// 把云端覆盖记录列表并入内存 PATCH。同 targetId 后者覆盖前者（云端已按 updatedAt 升序）。
function ingest(records) {
  let changed = false;
  (records || []).forEach(function (r) {
    const kind = r.kind === KIND_TPL ? KIND_TPL : KIND_BOOK;
    const id = r.targetId;
    if (!id) return;
    const patch = r.patch || {};
    const u = r.updatedAt || 0;
    if (!PATCH[kind]) PATCH[kind] = {};
    PATCH[kind][id] = Object.assign({ __u: u }, patch);
    changed = true;
  });
  if (changed) VERSION++;
  return changed;
}

// 把已批准新增条目列表并入内存 EXTRAS。
function ingestExtras(records) {
  let changed = false;
  (records || []).forEach(function (r) {
    const kind = r.kind === KIND_TPL ? KIND_TPL : KIND_BOOK;
    const it = r.item;
    if (!it || !it.id) return;
    if (!EXTRAS[kind]) EXTRAS[kind] = {};
    EXTRAS[kind][it.id] = it;
    changed = true;
  });
  if (changed) VERSION++;
  return changed;
}

// 取某条目的覆盖记录（含 __u），没有返回 null。
function getPatch(kind, id) {
  const map = PATCH[kind];
  if (!map) return null;
  return map[id] || null;
}

// 取某条已批准新增条目（完整对象），没有返回 null。
function getExtra(kind, id) {
  const map = EXTRAS[kind];
  if (!map) return null;
  return map[id] || null;
}

// 取某类全部已批准新增条目。
function getAllExtras(kind) {
  return Object.keys(EXTRAS[kind] || {}).map(function (k) { return EXTRAS[kind][k]; });
}

// 叠加覆盖层后的条目副本；无覆盖则原样返回（不拷贝）。
function applyPatch(item, kind) {
  if (!item) return item;
  return mergePatch(item, getPatch(kind, item.id));
}

function version() { return VERSION; }

/* ---------------- 本地缓存 ---------------- */

function loadCache() {
  try {
    if (typeof wx === 'undefined') return;
    const raw = wx.getStorageSync(STORE_KEY);
    if (raw && raw.patch) {
      PATCH = raw.patch;
      EXTRAS = raw.extras || { book: {}, tpl: {} };
      VERSION = raw.version || 0;
      READY = true;
    }
  } catch (e) { /* 缓存读不出就用空 */ }
}

function saveCache() {
  try {
    if (typeof wx === 'undefined') return;
    wx.setStorageSync(STORE_KEY, { patch: PATCH, extras: EXTRAS, version: VERSION });
  } catch (e) { /* 存不下不影响内存 */ }
}

function lastUpdated() {
  let max = 0;
  [KIND_BOOK, KIND_TPL].forEach(function (kind) {
    const map = PATCH[kind] || {};
    Object.keys(map).forEach(function (id) {
      const u = map[id].__u || 0;
      if (u > max) max = u;
    });
  });
  return max;
}

function lastExtraUpdated() {
  let max = 0;
  [KIND_BOOK, KIND_TPL].forEach(function (kind) {
    const map = EXTRAS[kind] || {};
    Object.keys(map).forEach(function (id) {
      const it = map[id] || {};
      const u = it.approvedAt || 0;
      if (u > max) max = u;
    });
  });
  return max;
}

/* ---------------- 云端访问 ---------------- */

function db() {
  if (typeof wx === 'undefined' || !wx.cloud) return null;
  const app = (typeof getApp === 'function') ? getApp() : null;
  if (!app || !app.globalData || !app.globalData.cloudReady) return null;
  try { return wx.cloud.database(); } catch (e) { return null; }
}

// 调云函数；返回 result.result（云函数约定把数据放在 result 字段）。
function callFunction(name, data) {
  if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) return null;
  return wx.cloud.callFunction({ name: name, data: data || {} });
}

// 拉取 updatedAt > since 的增量覆盖记录（首次 since=0 即全量）。返回记录数组。
async function pull(since) {
  const d = db();
  if (!d) return [];
  const _ = d.command;
  let q = d.collection(COLL);
  if (since && since > 0) q = q.where({ updatedAt: _.gt(since) });
  let cnt;
  try {
    cnt = await q.count();
  } catch (e) {
    // 集合不存在（errCode -502005）→ 视为暂无云端内容，不阻断本地使用
    return [];
  }
  const total = (cnt && cnt.total) || 0;
  const out = [];
  for (let skip = 0; skip < total; skip += PAGE) {
    let res;
    try {
      res = await q.orderBy('updatedAt', 'asc').skip(skip).limit(PAGE).get();
    } catch (e) { break; }
    const rows = (res && res.data) || [];
    out.push.apply(out, rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// 拉取 approvedAt > since 的已批准新增条目（降级用直连）。
async function pullExtras(since) {
  const d = db();
  if (!d) return [];
  const _ = d.command;
  let q = d.collection(EXTRA);
  if (since && since > 0) q = q.where({ approvedAt: _.gt(since) });
  let cnt;
  try {
    cnt = await q.count();
  } catch (e) {
    return [];
  }
  const total = (cnt && cnt.total) || 0;
  const out = [];
  for (let skip = 0; skip < total; skip += PAGE) {
    let res;
    try {
      res = await q.orderBy('approvedAt', 'asc').skip(skip).limit(PAGE).get();
    } catch (e) { break; }
    const rows = (res && res.data) || [];
    out.push.apply(out, rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// 启动拉取：优先走云函数 listContent（含覆盖记录 + 已批准新增），失败降级直连。
// 不阻塞首屏——失败也不影响本地使用。
async function refresh() {
  if (PULLING) return;
  PULLING = true;
  try {
    if (!READY) loadCache();
    const since = lastUpdated();
    const extraSince = lastExtraUpdated();
    let patches = null, extras = null;

    try {
      const r = await callFunction('listContent', { since: since, extraSince: extraSince });
      if (r && r.result) {
        patches = r.result.patches || [];
        extras = r.result.extras || [];
      }
    } catch (e) {
      // 云函数未部署 / 不可用：走下面直连降级
    }

    if (!patches) {
      patches = await pull(since);
      extras = await pullExtras(extraSince);
    }

    let changed = false;
    if (patches.length) changed = ingest(patches) || changed;
    if (extras.length) changed = ingestExtras(extras) || changed;
    if (changed) saveCache();
    READY = true;
  } catch (e) {
    // 云端不可用：保持本地缓存/内存状态，下次启动再试
  } finally {
    PULLING = false;
  }
}

// 作者发布一条覆盖记录（云函数优先，降级直连数据库）。
// 写云端 content_patch，并立即合并到本地（无需等下次启动）。
// fields 只传被改动的字段（增量），例如 { tip: '新的易错点', cmds: [[...]] }。
async function publishPatch(kind, targetId, fields, note) {
  const k = kind === KIND_TPL ? KIND_TPL : KIND_BOOK;

  // 优先云函数（带作者鉴权）
  try {
    const r = await callFunction('publishContent', {
      kind: k, targetId: targetId, fields: fields || {}, remark: note || ''
    });
    if (r && r.result && r.result.ok) {
      mergeLocal(k, targetId, fields);
      return;
    }
    // 云函数返回 ok=false（如未授权）时，抛出来由上层提示
    if (r && r.result && r.result.ok === false) {
      throw new Error(r.result.msg || '发布被拒绝');
    }
  } catch (e) {
    // 云函数未部署 / 网络失败 → 降级直连数据库
  }

  // 降级：直连数据库（旧行为，要求 content_patch 权限「仅创建者可写」）
  const d = db();
  if (!d) throw new Error('云开发不可用');
  const _ = d.command;
  const patchObj = Object.assign({}, fields || {});
  const now = Date.now();

  const exist = await d.collection(COLL).where({ kind: k, targetId: targetId }).limit(1).get();
  const rows = (exist && exist.data) || [];
  if (rows.length) {
    await d.collection(COLL).doc(rows[0]._id).update({
      data: { patch: patchObj, updatedAt: now, remark: note || '' }
    });
  } else {
    await d.collection(COLL).add({
      data: { kind: k, targetId: targetId, patch: patchObj, updatedAt: now, remark: note || '' }
    });
  }
  mergeLocal(k, targetId, fields);
}

// 把覆盖字段合并进本地内存 + 缓存（作者/审核通过后立刻可见）。
function mergeLocal(kind, targetId, fields) {
  const k = kind === KIND_TPL ? KIND_TPL : KIND_BOOK;
  if (!PATCH[k]) PATCH[k] = {};
  // 保留已存在的 __u（若没有则用 now），再叠加字段
  const now = Date.now();
  const base = PATCH[k][targetId] || { __u: now };
  PATCH[k][targetId] = Object.assign({}, base, fields, { __u: base.__u || now });
  VERSION++;
  saveCache();
}

module.exports = {
  KIND_BOOK, KIND_TPL,
  mergePatch, ingest, ingestExtras, getPatch, getExtra, getAllExtras, applyPatch, version,
  refresh, pull, pullExtras, publishPatch,
  _dbg: {
    loadCache, saveCache, lastUpdated, lastExtraUpdated, ingest, ingestExtras,
    setPatch: function (p, v) { PATCH = p; VERSION = v || 0; },
    setExtras: function (e) { EXTRAS = e || { book: {}, tpl: {} }; VERSION++; },
    mergeLocal
  }
};
