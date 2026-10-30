// 云函数 listContent —— 客户端统一拉取云端内容（覆盖记录 + 已批准新增）
//
// 替代「小程序端直连数据库」：把只读查询收口到云函数，端侧无需任何数据库权限，
// 只需「content_patch / extra_items 所有用户可读」即可（云函数本身有管理员读权限）。
//
// 入参：
//   since      content_patch 增量游标（updatedAt > since，0 表示全量）
//   extraSince extra_items 增量游标（approvedAt > extraSince，0 表示全量）
// 返回：
//   { patches:[...content_patch 文档...], extras:[...extra_items 文档...] }

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const PAGE = 100;

const COLL_PATCH = 'content_patch';
const COLL_EXTRA = 'extra_items';

async function pull(since, coll, timeField) {
  let q = db.collection(coll);
  if (since && since > 0) q = q.where({ [timeField]: _.gt(since) });
  const cnt = await q.count();
  const total = cnt.total || 0;
  const out = [];
  for (let skip = 0; skip < total; skip += PAGE) {
    const res = await q.orderBy(timeField, 'asc').skip(skip).limit(PAGE).get();
    out.push.apply(out, res.data || []);
    if ((res.data || []).length < PAGE) break;
  }
  return out;
}

exports.main = async (event) => {
  const since = Number(event.since) || 0;
  const extraSince = Number(event.extraSince) || 0;
  const patches = await pull(since, COLL_PATCH, 'updatedAt');
  const extras = await pull(extraSince, COLL_EXTRA, 'approvedAt');
  return { ok: true, patches, extras };
};
