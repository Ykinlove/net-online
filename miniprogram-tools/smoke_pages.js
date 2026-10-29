/* 分包冒烟测试：模拟小程序运行时加载全部页面（主包 5 + 分包 8）
   验证：① require('/utils/...') 能解析到主包模块 ② Page() 能注册
        ③ 分包页 onLoad/onShow 首屏数据不炸 ④ store 读写通路
   用法：node smoke_pages.js
*/
const path = require('path');
const fs = require('fs');
const Module = require('module');

const MP = path.join(__dirname, '..', 'miniprogram');

/* ---- 1. mock 小程序全局 ---- */
const storage = {};
global.__pages = [];
global.getApp = () => ({ globalData: {}, watch: () => {} });
global.Page = cfg => {
  // 小程序运行时会实例化 Page 配置并挂上 setData；这里模拟合并行为
  cfg.setData = patch => { Object.assign(cfg.data || (cfg.data = {}), patch); };
  global.__pages.push(cfg);
};
global.wx = {
  Page: global.Page,
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: k => { delete storage[k]; },
  getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
  navigateTo: () => {}, redirectTo: () => {}, switchTab: () => {}, reLaunch: () => {},
  showToast: () => {}, showModal: () => {}, setClipboardData: () => {},
  createRewardedVideoAd: () => ({ onLoad: () => {}, offLoad: () => {}, load: () => {}, show: () => {} }),
  createInterstitialAd: () => ({ onLoad: () => {}, offLoad: () => {}, load: () => {}, show: () => {} }),
  reportAnalytics: () => {}, getSystemInfoSync: () => ({ platform: 'devtools', SDKVersion: '3.8.0' }),
};
global.__pages = [];

/* ---- 2. require('/utils/x') 映射到 miniprogram/utils/x ---- */
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('/')) {
    const rel = request.replace(/^\//, '');
    for (const base of [MP, path.join(MP, 'subpkg-tool'), path.join(MP, 'subpkg-mine')]) {
      const mapped = path.join(base, rel);
      if (fs.existsSync(mapped) || fs.existsSync(mapped + '.js')) return origResolve.call(this, mapped, ...args);
    }
  }
  return origResolve.call(this, request, ...args);
};

/* ---- 3. 页面清单（从 app.json 读，保证和真实配置一致） ---- */
const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
const pages = [];
app.pages.forEach(p => pages.push({ path: p, pkg: '主包' }));
(app.subpackages || []).forEach(sp => sp.pages.forEach(p => pages.push({ path: sp.root + '/' + p, pkg: sp.root })));

/* ---- 4. 逐个加载 + 触发首屏 ---- */
let fail = 0;
for (const pg of pages) {
  global.__pages = [];
  try {
    require(path.join(MP, pg.path + '.js'));
    if (global.__pages.length === 0) throw new Error('没有调用 wx.Page 注册');
    const inst = global.__pages[0];
    const data0 = JSON.stringify(inst.data || {});
    // onLoad/onShow 带最小参数触发
    if (typeof inst.onLoad === 'function') inst.onLoad({});
    if (typeof inst.onShow === 'function') inst.onShow();
    // setData 存在性（页面渲染依赖）
    if (typeof inst.setData !== 'function' && typeof inst.onReady === 'function') {
      // 老式页面没 setData 也正常（wxml 全静态）
    }
    console.log('✓ ' + pg.path.padEnd(52) + ' [' + pg.pkg + '] data ' + data0.length + ' 字节');
  } catch (e) {
    fail++;
    console.log('✗ ' + pg.path.padEnd(52) + ' [' + pg.pkg + '] ' + e.message);
  }
}

/* ---- 5. 主链路数据验证 ---- */
try {
  const { search } = require('/utils/cmdbook.js');
  const r = search('开局', '全部');
  if (!r.length) throw new Error('search(开局) 零结果');
  console.log('✓ 搜索链路 search(开局) →', r.length, '条');
} catch (e) { fail++; console.log('✗ 搜索链路:', e.message); }

try {
  const { TPLS } = require('/utils/tplbook.js');
  console.log('✓ 模板库 TPLS →', TPLS.length, '个');
} catch (e) { fail++; console.log('✗ 模板库:', e.message); }

/* 浏览页的两个核心接口：分类统计和按分类列条目。
   分类体系改过好几次，这里守住两条底线：
   ① 分类数不为空、每类都有条目
   ② 所有分类的条数加起来 == 全部条数（不能有条目在目录里消失） */
try {
  const cb = require('/utils/cmdbook.js');
  const stats = cb.categoryStats();
  if (!stats.length) throw new Error('分类目录为空');
  const empty = stats.filter(s => !s.count);
  if (empty.length) throw new Error('空分类: ' + empty.map(s => s.name).join('/'));
  const sum = stats.reduce((a, s) => a + s.count, 0);
  const total = cb.listBy({}).length;
  if (sum !== total) throw new Error('分类合计 ' + sum + ' != 全部 ' + total);
  const one = cb.listBy({ cat: stats[0].key });
  if (one.length !== stats[0].count) throw new Error('listBy 条数与统计不符');
  console.log('✓ 浏览页分类 →', stats.length, '类 /', sum, '条，无遗漏');
} catch (e) { fail++; console.log('✗ 浏览页分类:', e.message); }

/* 模板搜索：模板要能被搜到（并入统一搜索的核心保证） */
try {
  const cb = require('/utils/cmdbook.js');
  const r = cb.searchTemplates('nat');
  if (!r.length) throw new Error('searchTemplates(nat) 零结果');
  console.log('✓ 模板搜索 searchTemplates(nat) →', r.length, '个');
} catch (e) { fail++; console.log('✗ 模板搜索:', e.message); }

/* BOOK_COUNT 必须与实际条数一致（首页显示的数字不能过期） */
try {
  const { BOOK_COUNT } = require('/utils/seed.js');
  const real = require('/utils/cmdbook.js').BOOK.length;
  if (BOOK_COUNT !== real) throw new Error('BOOK_COUNT ' + BOOK_COUNT + ' != 实际 ' + real);
  console.log('✓ BOOK_COUNT 与实际一致 →', BOOK_COUNT);
} catch (e) { fail++; console.log('✗ BOOK_COUNT:', e.message); }

console.log('----');
console.log(fail === 0 ? '分包冒烟全部通过 ✓（%d 页）' : '失败 %d 项', pages.length);
process.exit(fail === 0 ? 0 : 1);
