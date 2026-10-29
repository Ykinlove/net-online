/* 跨设备同步验收：模拟「同一微信、换到电脑端首次打开」的场景。
   本地 wx.storage 全空，云端 profiles 里有带 charImage/bgImage 的档案。

   期望：闪屏点「进入」→ 直接进首页，
        不能被判成新用户（去 onboard）或强制重选形象（去 chargen）。
   同时覆盖：云端拉取慢于点击时，要等 pull 完成再判断。

   用法：node test_cross_device.js
*/
const path = require('path');
const fs = require('fs');
const Module = require('module');

const MP = path.join(__dirname, '..', 'miniprogram');

/* ---------- 云端假数据 ---------- */
const CLOUD = {
  profiles: [{
    _id: 'p1', nickname: '杨工', exp: 120, stage: '网络工程师',
    charImage: '/images/preset/char/character_09.png',
    bgImage: '/images/preset/bg/background_02.jpg'
  }],
  commands: [{ _id: 'c1', title: '配 VLAN', createdAt: 1, date: '2026-10-01' }],
  projects: [], skills: [], tasks: []
};
let cloudDelay = 0;          // 模拟云端延迟（毫秒）

/* ---------- mock 小程序运行时（本地存储为空 = 换设备） ---------- */
const storage = {};
global.__pages = [];
const nav = { switchTab: [], navigateTo: [], navigateBack: [] };

global.getApp = () => ({ globalData: { cloudReady: true } });
global.Page = cfg => {
  cfg.setData = (patch, cb) => {
    Object.assign(cfg.data || (cfg.data = {}), patch);
    if (typeof cb === 'function') cb();
  };
  global.__pages.push(cfg);
};

function collection(name) {
  const rows = CLOUD[name] || [];
  const q = {
    _skip: 0, _limit: 20,
    count: async () => ({ total: rows.length }),
    orderBy: () => q,
    skip(n) { q._skip = n; return q; },
    limit(n) { q._limit = n; return q; },
    get: async () => {
      if (cloudDelay) await new Promise(r => setTimeout(r, cloudDelay));
      return { data: rows.slice(q._skip, q._skip + q._limit) };
    },
    where: () => q
  };
  return q;
}

global.wx = {
  Page: global.Page,
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: k => { delete storage[k]; },
  getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
  cloud: { database: () => ({ collection }), init: () => {} },
  switchTab: o => { nav.switchTab.push(o.url); },
  navigateTo: o => { nav.navigateTo.push(o.url); },
  navigateBack: () => { nav.navigateBack.push(1); },
  showToast: () => {}, showModal: () => {}, showLoading: () => {}, hideLoading: () => {},
  createRewardedVideoAd: () => ({ onLoad(){}, offLoad(){}, load(){}, show(){} }),
  createInterstitialAd: () => ({ onLoad(){}, offLoad(){}, load(){}, show(){} }),
  reportAnalytics: () => {}, getSystemInfoSync: () => ({ platform: 'windows', SDKVersion: '3.8.0' })
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('/')) {
    const mapped = path.join(MP, request.replace(/^\//, ''));
    if (fs.existsSync(mapped) || fs.existsSync(mapped + '.js')) return origResolve.call(this, mapped, ...args);
  }
  return origResolve.call(this, request, ...args);
};

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}

function loadPage(rel) {
  global.__pages = [];
  delete require.cache[require.resolve(path.join(MP, rel))];
  require(path.join(MP, rel));
  return global.__pages[0];
}

(async () => {
  const store = require(path.join(MP, 'utils/store.js'));

  /* ================= 场景一：进入即点（云端还没拉完） ================= */
  console.log('\n[1] 电脑端首次打开：本地为空 + 云端有档案，点击早于拉取完成');
  cloudDelay = 260;
  nav.switchTab = []; nav.navigateTo = [];

  const splash = loadPage('pages/splash/splash.js');
  splash.onLoad();                 // 触发 bootstrap（内部 pullAll）
  await splash.enter();            // 用户立刻点进入

  check('进了首页（没被当成新用户）', nav.switchTab[0] === '/pages/home/home', '实际 ' + JSON.stringify(nav.switchTab));
  check('没有跳建档 onboard', nav.navigateTo.every(u => u.indexOf('onboard') < 0), JSON.stringify(nav.navigateTo));
  check('没有强制重选形象 chargen', nav.navigateTo.every(u => u.indexOf('chargen') < 0), JSON.stringify(nav.navigateTo));

  /* ================= 场景二：档案字段回读 ================= */
  console.log('\n[2] 形象 / 背景从云端档案回读');
  check('getCharImage 读到云端档案', store.getCharImage() === '/images/preset/char/character_09.png', store.getCharImage());
  check('getCharBg 读到云端档案', store.getCharBg() === '/images/preset/bg/background_02.jpg', store.getCharBg());
  check('本地缓存已被回写（下次不再查云）', storage['no_charImage'] === '/images/preset/char/character_09.png', storage['no_charImage']);

  /* ================= 场景三：真的新用户仍要建档 ================= */
  console.log('\n[3] 真·新用户（云端也没有档案）');
  CLOUD.profiles = [];
  delete require.cache[require.resolve(path.join(MP, 'utils/store.js'))];
  // 清掉本地与被缓存的 mem
  Object.keys(storage).forEach(k => delete storage[k]);
  const store2 = require(path.join(MP, 'utils/store.js'));
  store2.init();
  await store2.pullAll();
  nav.switchTab = []; nav.navigateTo = [];

  const splash2 = loadPage('pages/splash/splash.js');
  splash2.data.syncing = false;
  await splash2.enter();
  check('新用户走建档', nav.navigateTo.some(u => u.indexOf('onboard') >= 0), JSON.stringify(nav.navigateTo));

  /* ================= 场景四：云端不可用时退回本地 ================= */
  console.log('\n[4] 云端不可用（离线），本地已有档案');
  const store3Path = path.join(MP, 'utils/store.js');
  delete require.cache[require.resolve(store3Path)];
  global.getApp = () => ({ globalData: { cloudReady: false } });
  Object.keys(storage).forEach(k => delete storage[k]);
  storage['no_profile'] = { nickname: '杨工', charImage: '/images/preset/char/character_01.png' };
  storage['no_charImage'] = '/images/preset/char/character_01.png';
  const store3 = require(store3Path);
  store3.init();
  check('离线时 hasProfile 仍为真', store3.hasProfile());
  check('离线时形象取本地', store3.getCharImage() === '/images/preset/char/character_01.png');

  console.log('\n----');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail === 0 ? 0 : 1);
})();
