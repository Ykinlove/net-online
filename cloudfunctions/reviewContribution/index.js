// 云函数 reviewContribution —— 作者审核投稿（列出 / 通过 / 驳回）
//
// 带 openid 鉴权（同 publishContent 的白名单）。
//   action='list'   ：返回待审核列表（status=pending）
//   action='approve'：通过。
//        type=edit → 把 fields 写进 content_patch（覆盖记录），等同作者直接发布
//        type=add  → 把 fields（完整新条目）写进 extra_items（已批准新增）
//   action='reject' ：驳回（status=rejected）
//
// 数据库权限建议：
//   contributions 集合 ——「所有用户可读，仅创建者可写」
//   extra_items  集合 ——「所有用户可读，仅管理端可写」（客户端不直接写，只经此云函数）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COLL_CONTRIB = 'contributions';
const COLL_PATCH = 'content_patch';
const COLL_EXTRA = 'extra_items';

function isAdmin(openid) {
  const list = (process.env.ADMIN_OPENIDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return false;
  return list.indexOf(openid) >= 0;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!isAdmin(OPENID)) {
    return { ok: false, msg: '无审核权限（请配置 ADMIN_OPENIDS）' };
  }

  const action = event.action;
  const id = event.id;

  if (action === 'list') {
    const res = await db.collection(COLL_CONTRIB)
      .where({ status: 'pending' })
      .orderBy('createdAt', 'asc')
      .limit(50)
      .get();
    return { ok: true, list: res.data || [] };
  }

  if (!id) return { ok: false, msg: '缺少 id' };
  const got = await db.collection(COLL_CONTRIB).doc(id).get();
  const c = got.data;
  if (!c) return { ok: false, msg: '投稿不存在' };

  if (action === 'reject') {
    await db.collection(COLL_CONTRIB).doc(id).update({
      data: { status: 'rejected', reviewedAt: Date.now(), reviewNote: event.reviewNote || '' }
    });
    return { ok: true, status: 'rejected' };
  }

  if (action === 'approve') {
    const kind = c.kind === 'tpl' ? 'tpl' : 'book';
    const fields = event.fields || c.fields || {};
    const now = Date.now();

    if (c.type === 'add') {
      // 新增条目：整条写进 extra_items（fields 即完整条目，必须含 id）
      if (!fields.id) return { ok: false, msg: '新增条目缺少 id' };
      await db.collection(COLL_EXTRA).add({
        data: { kind, item: fields, approvedAt: now }
      });
    } else {
      // 修改条目：写进 content_patch（覆盖记录）
      const targetId = c.targetId;
      if (!targetId) return { ok: false, msg: '修改条目缺少 targetId' };
      const exist = await db.collection(COLL_PATCH).where({ kind, targetId }).limit(1).get();
      const rows = exist.data || [];
      if (rows.length) {
        await db.collection(COLL_PATCH).doc(rows[0]._id).update({
          data: { patch: fields, updatedAt: now, remark: '审核通过投稿#' + id }
        });
      } else {
        await db.collection(COLL_PATCH).add({
          data: { kind, targetId, patch: fields, updatedAt: now, remark: '审核通过投稿#' + id }
        });
      }
    }

    await db.collection(COLL_CONTRIB).doc(id).update({
      data: { status: 'approved', reviewedAt: now, reviewNote: event.reviewNote || '' }
    });
    return { ok: true, status: 'approved' };
  }

  return { ok: false, msg: '未知 action' };
};
