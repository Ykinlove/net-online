// utils/contrib.js —— 社区投稿的客户端封装
//
// 普通用户投稿（新增 / 修改命令百科或模板）→ 写 contributions（status=pending）。
// 作者审核（列出 / 通过 / 驳回）→ 调 reviewContribution 云函数。
//
// 投稿提交优先走云函数 submitContribution，未部署时降级为直连数据库
// （contributions 集合「所有用户可读、仅创建者可写」，端侧可新增自己的投稿）。
// 审核类接口必须走云函数（带作者鉴权），无降级。

const COLL_CONTRIB = 'contributions';

function cloud() {
  if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) return null;
  return wx.cloud.callFunction.bind(wx.cloud);
}

function db() {
  if (typeof wx === 'undefined' || !wx.cloud) return null;
  const app = (typeof getApp === 'function') ? getApp() : null;
  if (!app || !app.globalData || !app.globalData.cloudReady) return null;
  try { return wx.cloud.database(); } catch (e) { return null; }
}

/**
 * 提交一条投稿。
 * @param {string} kind 'book' | 'tpl'
 * @param {string} type 'edit' | 'add'
 * @param {string} targetId 修改类目标的 id（新增类传 ''）
 * @param {object} fields 字段集合（新增类为完整条目，修改类为拟改动的字段）
 */
async function submit(kind, type, targetId, fields) {
  const k = kind === 'tpl' ? 'tpl' : 'book';
  const t = type === 'add' ? 'add' : 'edit';
  const data = { kind: k, type: t, targetId: targetId || '', fields: fields || {} };

  const call = cloud();
  if (call) {
    try {
      const r = await call({ name: 'submitContribution', data });
      if (r && r.result && r.result.ok) return { ok: true, id: r.result.id };
      if (r && r.result && r.result.msg) return { ok: false, msg: r.result.msg };
    } catch (e) { /* 降级直连 */ }
  }

  const d = db();
  if (!d) return { ok: false, msg: '云开发不可用' };
  const res = await d.collection(COLL_CONTRIB).add({
    data: Object.assign({}, data, { status: 'pending', createdAt: Date.now() })
  });
  return { ok: true, id: res._id };
}

/** 作者：拉取待审核列表（优先云函数，降级直连）。 */
async function listPending() {
  const call = cloud();
  if (call) {
    try {
      const r = await call({ name: 'reviewContribution', data: { action: 'list' } });
      if (r && r.result && r.result.ok) return { ok: true, list: r.result.list || [] };
    } catch (e) { /* 降级直连 */ }
  }
  const d = db();
  if (!d) return { ok: false, msg: '云开发不可用' };
  const res = await d.collection(COLL_CONTRIB).where({ status: 'pending' })
    .orderBy('createdAt', 'asc').limit(50).get();
  return { ok: true, list: res.data || [] };
}

/** 作者：通过投稿（必须走云函数）。fields 可传审核时修正后的字段。 */
async function approve(id, fields, note) {
  const call = cloud();
  if (!call) return { ok: false, msg: '请先部署 reviewContribution 云函数' };
  const r = await call({ name: 'reviewContribution', data: { action: 'approve', id, fields: fields || {}, reviewNote: note || '' } });
  if (r && r.result) return r.result;
  return { ok: false, msg: '调用失败' };
}

/** 作者：驳回投稿（必须走云函数）。 */
async function reject(id, note) {
  const call = cloud();
  if (!call) return { ok: false, msg: '请先部署 reviewContribution 云函数' };
  const r = await call({ name: 'reviewContribution', data: { action: 'reject', id, reviewNote: note || '' } });
  if (r && r.result) return r.result;
  return { ok: false, msg: '调用失败' };
}

module.exports = { submit, listPending, approve, reject };
