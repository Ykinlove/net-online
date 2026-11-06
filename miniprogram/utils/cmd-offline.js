// utils/cmd-offline.js —— Offline First 总调度（主包模块，禁止依赖分包）
//
// ⚠️ 微信分包隔离铁律：主包不能 require 分包模块。
// 所以本文件**绝不** require subpkg-tool 里的 cmdbook.js，否则真机/工具里直接
// "module 'subpkg-tool/utils/cmdbook.js' is not defined"。
// 数据集如何写进内存 BOOK，由分包页面通过 registerBookSetter 注入（分包→主包依赖是允许的）。
//
// 职责：
//   1) 启动时把本地缓存读进内存（离线优先于云端，断网也能查）；
//   2) 网络恢复 / 有网时后台增量同步云端；
//   3) 广播在线状态 + 数据来源（bundle/cache/cloud）给 UI（offline-bar）；
//   4) 首开断网且无缓存时，提供「重新加载」入口。
//
// 关键不变量：内置种子（cmdbook 包内数据）永远是兜底，云端同步只做「升级」，
// 任何一步失败都退回本地缓存 / 内置种子，搜索永不饿死。

const sync = require('./cmd-sync.js');

const BUNDLE_VERSION = 'bundle'; // 内置种子哨兵版本

const state = {
  online: true,
  source: 'bundle',   // 'bundle' | 'cache' | 'cloud'
  version: BUNDLE_VERSION,
  count: 0,
  hasCache: false,
  syncing: false,
  error: null,
  lastSyncAt: 0,
  _entries: null      // 最近一次的条目（缓存或云端），即便 setter 尚未注册也先存着
};

let _bookSetter = null; // 由分包页面注入：function(entries) -> boolean（写进 cmdbook.BOOK）
let _syncedOnce = false;
const listeners = [];

function snapshot() {
  state.count = (state._entries || []).length;
  return Object.assign({}, state);
}

function emit() {
  const s = snapshot();
  for (let i = 0; i < listeners.length; i++) {
    try { listeners[i](s); } catch (e) {}
  }
}

function onStatus(cb) {
  if (typeof cb === 'function') listeners.push(cb);
  return function off() {
    const k = listeners.indexOf(cb);
    if (k >= 0) listeners.splice(k, 1);
  };
}

function getStatus() { return snapshot(); }
function isOnline() { return state.online; }
function needReload() { return !state.online && !state.hasCache && state.source === 'bundle'; }

/* 分包页面调用：把「条目写进内存 BOOK」的实现注入进来。
   一旦注册，若已有 _entries 立即补应用（解决 app 启动先同步、页面后加载的时序差）。 */
function registerBookSetter(fn) {
  _bookSetter = fn;
  if (state._entries && typeof fn === 'function') {
    try { fn(state._entries); } catch (e) {}
    emit();
  }
}

/* 把 entries 应用到实际数据集（借由注入的 setter）并落地本地缓存。 */
function applyEntries(entries, version, source) {
  if (!Array.isArray(entries) || !entries.length || !version) return false;
  state._entries = entries;
  state.version = version;
  state.source = source || state.source;
  if (typeof _bookSetter === 'function') {
    try { _bookSetter(entries); } catch (e) { /* setter 出错不致命 */ }
  }
  sync.writeCacheAtomic({ version: version, entries: entries, savedAt: Date.now() });
  state.hasCache = true;
  state.lastSyncAt = Date.now();
  return true;
}

/* 把本地缓存读进来（离线优先）。无缓存 / 损坏则留内置种子。幂等。 */
function loadCacheIntoBook() {
  const cache = sync.readCache();
  if (cache && cache.version && Array.isArray(cache.entries) && cache.entries.length) {
    state._entries = cache.entries;
    state.version = cache.version;
    state.source = 'cache';
    state.hasCache = true;
    if (typeof _bookSetter === 'function') {
      try { _bookSetter(cache.entries); } catch (e) {}
    }
    return true;
  }
  state.source = 'bundle';
  state.version = BUNDLE_VERSION;
  state.hasCache = false;
  return false;
}

/* 后台同步：比较版本 → 需要时下载 → 写缓存 → 升级。失败静默，搜索不受影响。 */
function doSync() {
  if (state.syncing) return Promise.resolve(snapshot());
  if (!state.online) return Promise.resolve(snapshot());
  state.syncing = true;
  state.error = null;
  emit();
  return Promise.resolve()
    .then(function () { return sync.pullManifest(); })
    .then(function (man) {
      if (man && man.version && man.version !== state.version) {
        // 版本不同：先让云函数把整库上传到云存储并返回 fileID（回包很小），
        // 再用 downloadFile 拉大文件（避开 callFunction 1MB 回包上限）。
        return sync.pullFull().then(function (full) {
          if (!full || !full.version) return;
          return sync.downloadBook(full.cloudPath, full.fileID).then(function (entries) {
            if (entries && entries.length) applyEntries(entries, full.version, 'cloud');
          });
        });
      }
    })
    .catch(function (e) {
      state.error = (e && e.message) ? e.message : 'sync failed';
      // 失败不抛：保留本地缓存 / 内置种子
    })
    .then(function () {
      state.syncing = false;
      _syncedOnce = true;
      emit();
      return snapshot();
    });
}

/* 页面 onLoad 调用：保证缓存已载入（幂等），刷新一次状态。不重复触发同步。 */
function ensureReady() {
  loadCacheIntoBook();
  emit();
  return snapshot();
}

/* 异常兜底：首开断网且无缓存时，调用方据此给「重新加载」按钮。 */
function reload() { return doSync(); }

/* 网络感知：App.onLaunch 调一次。建立监听 + 初始读网 + 触发首次同步。 */
function initNetwork() {
  // 1) 先把本地缓存读进来，搜索立刻可用（离线优先）
  loadCacheIntoBook();

  function setOnline(now) {
    const changed = now !== state.online;
    state.online = now;
    if (changed && now) doSync(); // 恢复网络自动增量同步
    emit();
  }

  // 用 app.globalData 里的初始在线状态（若 app 已写过）做一次对齐
  try {
    const app = getApp();
    if (app && app.globalData && typeof app.globalData.online === 'boolean') {
      state.online = app.globalData.online;
    }
  } catch (e) {}

  try {
    if (wx.getNetworkType) {
      wx.getNetworkType({
        success: function (res) { setOnline(!!(res && res.networkType && res.networkType !== 'none')); },
        fail: function () { emit(); } // 拿不到就当在线，内置种子兜底
      });
    }
  } catch (e) { /* ignore */ }

  try {
    if (wx.onNetworkStatusChange) {
      wx.onNetworkStatusChange(function (res) {
        setOnline(!!(res && res.isConnected));
      });
    }
  } catch (e) { /* ignore */ }

  // 首开若有网，后台拉一次（不阻塞首屏）
  if (state.online && !_syncedOnce) {
    _syncedOnce = true;
    setTimeout(function () { doSync(); }, 400);
  }

  // 把在线状态同步给 app.globalData，供其他 UI 复用
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.online = state.online;
  } catch (e) {}
}

module.exports = {
  ensureReady: ensureReady,
  doSync: doSync,
  reload: reload,
  getStatus: getStatus,
  onStatus: onStatus,
  isOnline: isOnline,
  needReload: needReload,
  initNetwork: initNetwork,
  loadCacheIntoBook: loadCacheIntoBook,
  registerBookSetter: registerBookSetter
};
