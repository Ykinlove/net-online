// utils/hotfix.js —— 云端内容热更新（仅字段修正，不增删条目）
//
// 数据真源仍是本地打包数据（cmdbook.js / tplbook.js）。
// 云端集合 content_patch 只存「覆盖记录」，运行时把覆盖记录叠加到
// 本地条目的副本上，不污染包内常量、断网也能用本地缓存。
//
// 云端集合 content_patch（权限：所有用户可读，仅创建者可写）：
//   { _id, kind: 'book' | 'tpl', targetId, patch: {name?, kw?, cmds?, tip?, note?, ...}, updatedAt, remark? }
//
// 注意 remark 是「作者发布备注」（记录的元数据），与条目自身的 note 业务字段同名冲突，
// 故记录侧用 remark，条目侧用 note；mergePatch 只跳过记录的元数据（含 remark），
// 不会误伤条目 note。
//
// 这个模块的纯函数（mergePatch / ingest / applyPatch / getPatch）不依赖 wx，
// 可以在 node 下直接单测；只有 pull / refresh / publishPatch 依赖云端环境。

const COLL = 'content_patch';

/* 这些字段是 patch 记录的元数据，不能覆盖到条目业务字段上 */
const META = ['_id', 'targetId', 'kind', 'updatedAt', 'createdAt', 'remark', '__u'];

const STORE_KEY = 'hotfix_patch_v1';
const PAGE = 100;

const KIND_BOOK = 'book';
const KIND_TPL = 'tpl';

let PATCH = { book: {}, tpl: {} }; // kind -> { targetId -> patchObj（含 __u 时间戳）}
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

// 把云端记录列表并入内存 PATCH。同 targetId 后者覆盖前者（云端已按 updatedAt 升序）。
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

// 取某条目的覆盖记录（含 __u），没有返回 null。
function getPatch(kind, id) {
  const map = PATCH[kind];
  if (!map) return null;
  return map[id] || null;
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
      VERSION = raw.version || 0;
      READY = true;
    }
  } catch (e) { /* 缓存读不出就用空 */ }
}

function saveCache() {
  try {
    if (typeof wx === 'undefined') return;
    wx.setStorageSync(STORE_KEY, { patch: PATCH, version: VERSION });
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

/* ---------------- 云端访问 ---------------- */

function db() {
  if (typeof wx === 'undefined' || !wx.cloud) return null;
  const app = (typeof getApp === 'function') ? getApp() : null;
  if (!app || !app.globalData || !app.globalData.cloudReady) return null;
  try { return wx.cloud.database(); } catch (e) { return null; }
}

// 拉取 updatedAt > since 的增量记录（首次 since=0 即全量）。返回记录数组。
async function pull(since) {
  const d = db();
  if (!d) return [];
  const _ = d.command;
  let q = d.collection(COLL);
  if (since && since > 0) q = q.where({ updatedAt: _.gt(since) });
  const cnt = await q.count();
  const total = (cnt && cnt.total) || 0;
  const out = [];
  for (let skip = 0; skip < total; skip += PAGE) {
    const res = await q.orderBy('updatedAt', 'asc').skip(skip).limit(PAGE).get();
    const rows = (res && res.data) || [];
    out.push.apply(out, rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// 启动拉取：先加载本地缓存（断网兜底），再拉云端增量合并。
// 不阻塞首屏——失败也不影响本地使用。
async function refresh() {
  if (PULLING) return;
  PULLING = true;
  try {
    if (!READY) loadCache();
    const since = lastUpdated();
    const recs = await pull(since);
    if (recs.length) {
      ingest(recs);
      saveCache();
    }
    READY = true;
  } catch (e) {
    // 云端不可用：保持本地缓存/内存状态，下次启动再试
  } finally {
    PULLING = false;
  }
}

// 作者发布一条覆盖记录：写云端 content_patch，并立即合并到本地（无需等下次启动）。
// fields 只传被改动的字段（增量），例如 { tip: '新的易错点', cmds: [[...]] }。
async function publishPatch(kind, targetId, fields, note) {
  const d = db();
  if (!d) throw new Error('云开发不可用');
  const _ = d.command;
  const patchObj = Object.assign({}, fields || {});
  const now = Date.now();

  const exist = await d.collection(COLL).where({ kind: kind, targetId: targetId }).limit(1).get();
  const rows = (exist && exist.data) || [];
  if (rows.length) {
    await d.collection(COLL).doc(rows[0]._id).update({
      data: { patch: patchObj, updatedAt: now, remark: note || '' }
    });
  } else {
    await d.collection(COLL).add({
      data: { kind: kind, targetId: targetId, patch: patchObj, updatedAt: now, remark: note || '' }
    });
  }

  // 立即合并到本地内存 + 缓存，作者立刻能在搜索/详情看到效果
  const k = kind === KIND_TPL ? KIND_TPL : KIND_BOOK;
  if (!PATCH[k]) PATCH[k] = {};
  PATCH[k][targetId] = Object.assign({ __u: now }, patchObj);
  VERSION++;
  saveCache();
}

module.exports = {
  KIND_BOOK, KIND_TPL,
  mergePatch, ingest, getPatch, applyPatch, version,
  refresh, pull, publishPatch,
  _dbg: { loadCache, saveCache, lastUpdated, ingest, setPatch: function (p, v) { PATCH = p; VERSION = v || 0; } }
};
