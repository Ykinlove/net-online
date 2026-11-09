// utils/cmd-sync.js —— 离线缓存的「本地文件读写」与「云端拉取」编排
//
// 为什么用 FileSystemManager 写 USER_DATA_PATH，而不是 wx.setStorageSync：
//   - 整库 1.5MB+，setStorageSync 受 10MB 单键上限约束，且是同步阻塞、与主包存储争抢；
//   - USER_DATA_PATH 是小程序给「本地文件」留的目录，空间更宽裕，写大文件不占 storage 配额；
//   - 走临时文件 + renameSync 做原子写，写到一半被打断（来电/杀进程）也不会留下半截 JSON。
//
// 云端数据走「manifest 校验 + 云存储下载大文件」：
//   - callFunction 回包有 ~1MB 上限，整库 1.58MB 直接返回会被掐；
//   - 所以 getCmdLib 先回一个极小的 manifest（version/cloudPath），
//     真正的大文件由 wx.cloud.downloadFile 从云存储拉，和现有 practice.js 同一套路。

const CACHE_NAME = 'cmdlib.cache.json';

/* 内存缓存：整库 1.5MB 的 readFileSync + JSON.parse 是同步阻塞。
   离线层的 ensureReady() 会在**每一个 tool 页 onLoad** 调一次 readCache()，
   改版前每进一页都把 1.6MB 文本重新解析一遍（Node 实测几十毫秒，真机更慢）。
   本模块的缓存文件没有第二个写入方（写只走 writeCacheAtomic），
   所以在内存里留一份引用是安全的；同一引用还让 cmd-offline.js 能用
   「引用相等」做 setDataset 幂等判断，从根上消掉索引失效风暴。 */
let _memCache = null;
let _memLoaded = false;

function cachePath() {
  try {
    return (wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH : '') + '/' + CACHE_NAME;
  } catch (e) {
    return '';
  }
}

/* 读本地缓存。损坏 / 空 / 非数组都返回 null，调用方退回内置种子。
   结果（包括 null）在内存里记住，进程生命周期内只读一次磁盘。 */
function readCache() {
  if (_memLoaded) return _memCache;
  _memLoaded = true;
  _memCache = null;
  const p = cachePath();
  if (!p) return null;
  try {
    const fs = wx.getFileSystemManager();
    const txt = fs.readFileSync(p, 'utf8');
    const obj = JSON.parse(txt);
    if (obj && typeof obj.version === 'string' && Array.isArray(obj.entries) && obj.entries.length) {
      _memCache = obj;
      return obj;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/* 原子写：先写 .tmp，再 rename 覆盖。rename 不被支持时退回直接覆盖。 */
function writeCacheAtomic(obj) {
  const p = cachePath();
  if (!p) return false;
  const payload = JSON.stringify(obj);
  try {
    const fs = wx.getFileSystemManager();
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, payload, 'utf8');
    try {
      fs.renameSync(tmp, p);
    } catch (e) {
      // 个别基础库 rename 不支持，直接覆盖（仍可接受，只是少了原子性）
      fs.writeFileSync(p, payload, 'utf8');
    }
    _memCache = obj;
    _memLoaded = true;
    return true;
  } catch (e) {
    // 写失败时内存态不再可信，下次重新读磁盘
    _memLoaded = false;
    _memCache = null;
    return false;
  }
}

function clearCache() {
  const p = cachePath();
  _memCache = null;
  _memLoaded = true;
  if (!p) return;
  try { wx.getFileSystemManager().unlinkSync(p); } catch (e) {}
}

/* 拉云端清单（极小回包，不受 1MB 限制）。返回 {version, cloudPath, fileID, count} 或 null。 */
function pullManifest() {
  return new Promise(function (resolve) {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') { resolve(null); return; }
    wx.cloud.callFunction({
      name: 'getCmdLib',
      data: { mode: 'manifest' },
      success: function (res) {
        const r = res && res.result;
        if (r && r.ok && typeof r.version === 'string') {
          resolve({ version: r.version, cloudPath: r.cloudPath, fileID: r.fileID, count: r.count });
        } else {
          resolve(null);
        }
      },
      fail: function () { resolve(null); }
    });
  });
}

/* 从云存储下载整库（大文件走 downloadFile）。成功返回 entries 数组，失败返回 null。 */
function downloadBook(cloudPath, fileID) {
  return new Promise(function (resolve) {
    if (!wx.cloud || typeof wx.cloud.downloadFile !== 'function') { resolve(null); return; }
    const opt = cloudPath ? { cloudPath: cloudPath } : (fileID ? { fileID: fileID } : null);
    if (!opt) { resolve(null); return; }
    wx.cloud.downloadFile(Object.assign({}, opt, {
      success: function (res) {
        if (res && res.statusCode === 200 && res.tempFilePath) {
          try {
            const fs = wx.getFileSystemManager();
            const txt = fs.readFileSync(res.tempFilePath, 'utf8');
            const arr = JSON.parse(txt);
            if (Array.isArray(arr) && arr.length) { resolve(arr); return; }
            if (arr && Array.isArray(arr.entries)) { resolve(arr.entries); return; }
            resolve(null);
          } catch (e) { resolve(null); }
        } else {
          resolve(null);
        }
      },
      fail: function () { resolve(null); }
    }));
  });
}

/* 触发云端「整库」模式：云函数把内置 cmdlib.json 上传到云存储并返回 fileID/cloudPath。
   这一步回包很小（只有 fileID，不含 1.5MB 正文），不受 callFunction 1MB 上限影响。 */
function pullFull() {
  return new Promise(function (resolve) {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') { resolve(null); return; }
    wx.cloud.callFunction({
      name: 'getCmdLib',
      data: { mode: 'full' },
      success: function (res) {
        const r = res && res.result;
        if (r && r.ok && r.version) {
          resolve({ version: r.version, fileID: r.fileID, cloudPath: r.cloudPath, count: r.count });
        } else {
          resolve(null);
        }
      },
      fail: function () { resolve(null); }
    });
  });
}

module.exports = {
  CACHE_NAME: CACHE_NAME,
  cachePath: cachePath,
  readCache: readCache,
  writeCacheAtomic: writeCacheAtomic,
  clearCache: clearCache,
  pullManifest: pullManifest,
  pullFull: pullFull,
  downloadBook: downloadBook
};
