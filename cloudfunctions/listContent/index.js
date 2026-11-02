// 云函数 listContent —— 客户端统一拉取云端内容（覆盖记录 + 已批准新增）
//
// 替代「小程序端直连数据库」：把只读查询收口到云函数，端侧无需任何数据库权限，
// 只需「content_patch / extra_items 所有用户可读」即可（云函数本身有管理员读权限）。
//
// 入参：
//   since      content_patch 增量游标（updatedAt > since，0 表示全量）
//   extraSince extra_items 增量游标（approvedAt > extraSince，0 表示全量）
//   action     传 'whoami' 时只返回调用者的 openid（用于配置 ADMIN_OPENIDS 白名单）
//              传 'isadmin' 时返回调用者是否为作者/管理员
// 返回：
//   { patches:[...content_patch 文档...], extras:[...extra_items 文档...] }
//   action=whoami 时返回 { ok:true, openid:'oXXXX...' }
//   action=isadmin 时返回 { ok:true, isAdmin:true|false }
//
// 为什么要有 isadmin：客户端要判断「内容审核」入口该不该显示给当前用户。
// 白名单只配在云函数环境变量里，不写进小程序包体（包体人人可下载）。
// 真正的写权限也由云函数鉴权，这里只是「入口可见性」的体验判断。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const PAGE = 100;

const COLL_PATCH = 'content_patch';
const COLL_EXTRA = 'extra_items';

/* 与 publishContent / reviewContribution 同一份白名单（云函数环境变量）。 */
function isAdmin(openid) {
  const list = (process.env.ADMIN_OPENIDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return false;
  return list.indexOf(openid) >= 0;
}

/* 只读拉取：集合不存在时应当视为「暂无内容」而不是报错。
   客户端启动时必调本函数，若因集合缺失直接抛 -502005 会让首页内容加载失败。 */
async function pull(since, coll, timeField) {
  let q = db.collection(coll);
  if (since && since > 0) q = q.where({ [timeField]: _.gt(since) });
  let cnt;
  try {
    cnt = await q.count();
  } catch (e) {
    // 集合不存在（errCode -502005）→ 视为空集合
    return [];
  }
  const total = cnt.total || 0;
  const out = [];
  for (let skip = 0; skip < total; skip += PAGE) {
    let res;
    try {
      res = await q.orderBy(timeField, 'asc').skip(skip).limit(PAGE).get();
    } catch (e) {
      break;
    }
    out.push.apply(out, res.data || []);
    if ((res.data || []).length < PAGE) break;
  }
  return out;
}

exports.main = async (event) => {
  try {
    /* whoami：只回显调用者自己的 openid。
       配置 ADMIN_OPENIDS 白名单时，用这个拿到自己的 openid 最省事
       （开发者工具 → 云函数 → listContent → 云端测试，参数 {"action":"whoami"}）。
       只返回自己的 openid，不泄露他人数据。 */
    if (event.action === 'whoami') {
      const { OPENID } = cloud.getWXContext();
      return { ok: true, openid: OPENID || '' };
    }

    /* isadmin：当前用户是不是作者/管理员。
       客户端用它决定「内容审核」入口要不要显示——普通用户根本看不到这个入口，
       不会误以为自己能审核别人的投稿。 */
    if (event.action === 'isadmin') {
      const { OPENID } = cloud.getWXContext();
      return { ok: true, isAdmin: isAdmin(OPENID) };
    }

    const since = Number(event.since) || 0;
    const extraSince = Number(event.extraSince) || 0;
    const patches = await pull(since, COLL_PATCH, 'updatedAt');
    const extras = await pull(extraSince, COLL_EXTRA, 'approvedAt');
    return { ok: true, patches, extras };
  } catch (e) {
    return { ok: false, patches: [], extras: [], msg: '拉取云端内容失败：' + ((e && e.message) || e) };
  }
};
