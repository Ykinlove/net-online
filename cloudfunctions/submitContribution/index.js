// 云函数 submitContribution —— 普通用户提交内容投稿（新增 / 修改命令百科或模板）
//
// 投稿写 contributions 集合（status=pending），由作者在小程序管理页审核。
// 任何登录用户都可提交，无需鉴权；为避免刷屏，可按 openid 限频（此处留给部署方扩展）。
//
// 数据库权限建议：
//   contributions 集合 ——「所有用户可读，仅创建者可写」

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COLL = 'contributions';

/* 集合不存在时直接写会抛 errCode -502005。云函数是管理员身份，首次调用自动建好，
   免去部署后还要去控制台手动建表的步骤。已存在时报错会被吞掉。 */
const ensured = {};
async function ensureCollection(name) {
  if (ensured[name]) return;
  try {
    await db.createCollection(name);
  } catch (e) { /* 已存在 / 权限不足，后续操作会给出准确错误 */ }
  ensured[name] = true;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  const kind = event.kind === 'tpl' ? 'tpl' : 'book';
  const type = event.type === 'add' ? 'add' : 'edit';
  const targetId = type === 'edit' ? (event.targetId || '') : '';
  const fields = event.fields || {};
  if (typeof fields !== 'object') {
    return { ok: false, msg: '参数缺失' };
  }

  await ensureCollection(COLL);
  const res = await db.collection(COLL).add({
    data: {
      kind, type, targetId,
      fields,
      status: 'pending',
      openid: OPENID || '',
      createdAt: Date.now()
    }
  });
  return { ok: true, id: res._id };
};
