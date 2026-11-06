// utils/admin.js —— 判断当前用户是不是作者 / 管理员
//
// 「内容审核」入口只对作者和管理员显示，普通用户完全看不到这个入口，
// 不会误以为自己能审核别人提交的投稿。
//
// 判定完全交给服务端：listContent 云函数的 action=isadmin 会拿
// ADMIN_OPENIDS 白名单比对调用者的 openid。
// 白名单只配在云函数环境变量里，不写进包体——包体人人可下载，写进去等于公开。
//
// 云函数不可用时退回上次缓存的结果（拿不到就当不是管理员）：
// 入口少显示一次不影响使用，误显示才会让普通用户困惑。

const KEY = 'is_admin_v1';
const TTL = 6 * 60 * 60 * 1000;   // 缓存 6 小时

function readCache() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!raw || !raw.at) return false;
    if (Date.now() - raw.at > TTL) return false;
    return !!raw.admin;
  } catch (e) { return false; }
}

function writeCache(admin) {
  try { wx.setStorageSync(KEY, { admin: !!admin, at: Date.now() }); } catch (e) { /* ignore */ }
}

/* 同步读：拿缓存结果，用于首屏渲染（不阻塞） */
function isAdmin() {
  return readCache();
}

/* 异步确认：问服务端「我是不是管理员」，返回最终判定 */
async function refresh() {
  try {
    if (!wx.cloud || !wx.cloud.callFunction) return readCache();
    const r = await wx.cloud.callFunction({
      name: 'listContent',
      data: { action: 'isadmin' }
    });
    const res = r && r.result;
    if (!res || res.ok !== true) return readCache();
    writeCache(!!res.isAdmin);
    return !!res.isAdmin;
  } catch (e) {
    return readCache();
  }
}

module.exports = { isAdmin, refresh };
