// 云函数 publishContent —— 作者发布内容覆盖记录（带 openid 鉴权）
//
// 替代「硬编码口令 + 直连数据库」的旧方案：只有白名单内的 openid 才能发布。
// 客户端（作者管理页）优先调用本云函数；未部署或鉴权失败时会降级为直连数据库。
//
// 数据库权限建议：
//   content_patch 集合 ——「所有用户可读，仅创建者可写」
//   （云函数运行在「微信管理端」环境，走的是管理员身份，不受端侧权限限制）
//
// 配置：在云函数控制台配置环境变量 ADMIN_OPENIDS（逗号分隔的 openid 白名单）。
//   部署前务必填好，否则任何人均无法发布。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const COLL = 'content_patch';

function isAdmin(openid) {
  const list = (process.env.ADMIN_OPENIDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return false; // 未配置白名单 → 拒绝（部署时必须配置）
  return list.indexOf(openid) >= 0;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!isAdmin(OPENID)) {
    return { ok: false, msg: '无发布权限（请配置 ADMIN_OPENIDS）' };
  }

  const kind = event.kind === 'tpl' ? 'tpl' : 'book';
  const targetId = event.targetId;
  const fields = event.fields || {};
  const remark = event.remark || '';
  if (!targetId || typeof fields !== 'object') {
    return { ok: false, msg: '参数缺失' };
  }

  const now = Date.now();
  const exist = await db.collection(COLL).where({ kind, targetId }).limit(1).get();
  const rows = exist.data || [];
  if (rows.length) {
    await db.collection(COLL).doc(rows[0]._id).update({
      data: { patch: fields, updatedAt: now, remark }
    });
  } else {
    await db.collection(COLL).add({
      data: { kind, targetId, patch: fields, updatedAt: now, remark }
    });
  }
  return { ok: true };
};
