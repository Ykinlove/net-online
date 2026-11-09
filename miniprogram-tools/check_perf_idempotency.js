/**
 * 性能不变量守卫 —— 锁住 2026-11-09 那轮 UI / 性能优化的关键约束
 *
 * 为什么要有这个守卫：
 *   性能优化最容易「静默退化」—— 代码全绿、功能全对、评测全过，
 *   但某次顺手把 ripples 改回整数组 setData，或给 ensureReady 加回一次
 *   readCache，真机掉帧就回来了，CI 完全看不出来。
 *   本守卫用最小运行时桩把这几条不变量变成可执行断言：
 *
 *     ① cmd-sync.readCache     整库 1.6MB 在进程内只解析一次
 *     ② cmd-offline            同一份缓存只注入分包数据集一次
 *     ③ cmdbook.setDataset     同一份数据集不重复重建 BOOK / 不推进 DATA_VER
 *     ④ cmdbook.search         同 key 复用、换数据自动失效、对外不共享对象引用
 *     ⑤ motion.ripple          路径式 setData（只更新一个槽位）
 *     ⑥ motion.drawerMove      数值状态不进 data + 高频 touchmove 节流
 *     ⑦ home.wxml / home.js    波纹槽位直读，不再 4 个 wx:for 扫全数组
 *
 * 跑法：node miniprogram-tools/check_perf_idempotency.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const MP = path.join(__dirname, '..', 'miniprogram');
const problems = [];

function check(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (e) {
    problems.push(name + '：' + e.message);
    console.log('  ✗ ' + name + '：' + e.message);
  }
}

/* ---- 最小运行时桩：内存文件系统 + 无云端 ---- */
const files = {};
let readCount = 0;
global.wx = {
  env: { USER_DATA_PATH: '/__ci_usr' },
  getFileSystemManager: function () {
    return {
      readFileSync: function (p) {
        readCount++;
        if (!(p in files)) throw new Error('ENOENT: ' + p);
        return files[p];
      },
      writeFileSync: function (p, v) { files[p] = v; },
      renameSync: function (a, b) { files[b] = files[a]; delete files[a]; },
      unlinkSync: function (p) { delete files[p]; }
    };
  },
  getStorageSync: function () { return ''; },
  setStorageSync: function () {},
  getNetworkType: function () {},
  onNetworkStatusChange: function () {}
  /* 故意不提供 cloud：practice / doSync 走「本地兜底」分支 */
};
global.getApp = function () { return { globalData: {} }; };

files['/__ci_usr/cmdlib.cache.json'] = JSON.stringify({
  version: 'ci-v1', entries: [{ id: 'ci-1' }], savedAt: 1
});

console.log('性能不变量检查：');

/* ① 整库缓存只读一次磁盘 */
check('cmd-sync.readCache 进程内只读一次磁盘', function () {
  const sync = require(path.join(MP, 'utils', 'cmd-sync.js'));
  const a = sync.readCache();
  const b = sync.readCache();
  assert.ok(a && a.entries.length === 1, '读不到本地缓存');
  assert.strictEqual(a, b, '两次 readCache 必须返回同一份引用（离线层靠引用判等）');
  assert.strictEqual(readCount, 1,
    '1.6MB 整库只应解析一次，实际读盘 ' + readCount + ' 次');
});

/* ② 离线层注入幂等 */
check('离线层 registerBookSetter + ensureReady 只注入一次', function () {
  const offline = require(path.join(MP, 'utils', 'cmd-offline.js'));
  let calls = 0;
  offline.registerBookSetter(function () { calls++; });
  offline.ensureReady();
  offline.ensureReady();
  /* 模拟再进一个 tool 页：会重新注册页面级 setter */
  offline.registerBookSetter(function () { calls++; });
  offline.ensureReady();
  assert.strictEqual(calls, 1,
    '同一份缓存被注入了 ' + calls + ' 次（应为 1 次，否则索引每页全量失效）');
  assert.strictEqual(readCount, 1, '页面反复 ensureReady 不应再碰磁盘');
});

/* ③ setDataset 幂等 */
check('cmdbook.setDataset 同一数据集不重建 BOOK', function () {
  const book = require(path.join(MP, 'subpkg-tool', 'utils', 'cmdbook.js'));
  const entries = book.BOOK.slice();       // 内容等同内置种子，但引用不同 = 一份「新数据集」
  const ok1 = book.setDataset(entries);
  const b1 = book.BOOK;
  const ok2 = book.setDataset(entries);
  assert.strictEqual(ok1, true, '首次注入应生效');
  assert.strictEqual(ok2, false, '同一数据集重复注入应被短路');
  assert.strictEqual(book.BOOK, b1, 'BOOK 被重建，索引/词表会跟着全量失效');
});

/* ④ 搜索缓存 */
check('cmdbook.search 缓存复用 / 换数据失效 / 不共享对象', function () {
  const book = require(path.join(MP, 'subpkg-tool', 'utils', 'cmdbook.js'));
  const r1 = book.search('ospf 邻居', '全部');
  const r2 = book.search('ospf 邻居', '全部');
  assert.ok(r1.length > 0, '用例应有结果，否则这条断言没有意义');
  assert.deepStrictEqual(r1, r2, '缓存命中后结果变了');
  assert.notStrictEqual(r1, r2, '两次调用不应返回同一个数组');
  assert.notStrictEqual(r1[0], r2[0], '必须每次 map 新对象，否则页面改结果会污染缓存');

  /* 换一份数据集 → DATA_VER 推进 → 同 kw 的缓存必须失效 */
  book.setDataset(book.BOOK.slice(0, 5));
  const r3 = book.search('ospf 邻居', '全部');
  assert.notDeepStrictEqual(r1, r3, '数据集换了但结果没变 —— 缓存没按 dataVer 失效');
});

/* ⑤ 波纹路径式 setData */
check('motion.ripple 只更新一个槽位，不覆盖整条数组', function () {
  const motion = require(path.join(MP, 'utils', 'motion.js'));
  const patches = [];
  const page = {
    data: { ripples: [{ id: 0, x: 0, y: 0, cls: 0 }] },
    _rects: [{ left: 0, top: 0, width: 100, height: 40 }],
    setData: function (p) { patches.push(p); }
  };
  motion.ripple(page, {
    currentTarget: { dataset: { r: '0' } },
    touches: [{ clientX: 10, clientY: 10 }]
  });
  assert.strictEqual(patches.length, 1, '一次触摸只应推一次 setData');
  assert.ok('ripples[0]' in patches[0],
    '应走 ripples[0] 路径式更新，实际 key：' + Object.keys(patches[0]).join(','));
  assert.ok(!('ripples' in patches[0]), '仍在整条 ripples 数组覆盖 setData');
});

/* ⑥ 抽屉跟手 */
check('motion.drawerMove 数值不进 data 且 16ms 节流', function () {
  const motion = require(path.join(MP, 'utils', 'motion.js'));
  const patches = [];
  const page = {
    data: { drawerDragging: false, drawerStyle: '' },
    setData: function (p) { patches.push(p); Object.assign(page.data, p); }
  };
  motion.drawerStart(page, { touches: [{ clientY: 100 }] });
  const n0 = patches.length;
  motion.drawerMove(page, { touches: [{ clientY: 130 }] });
  motion.drawerMove(page, { touches: [{ clientY: 160 }] });
  assert.ok(!('drawerY' in page.data), 'drawerY 是纯数值状态，不该进 data');
  const moved = patches.slice(n0);
  assert.ok(moved.length >= 1, '跟手位移没被渲染');
  assert.ok(moved.length <= 1,
    '16ms 内连续 touchmove 应被节流，实际 ' + moved.length + ' 次 setData');
  assert.ok(!('drawerY' in moved[0]), '每帧不应顺带传 drawerY');
  motion.drawerEnd(page, function () {});
  assert.strictEqual(page.data.drawerDragging, false, '抬手后应结束拖拽态');
});

/* ⑦ WXML / JS 槽位约定 */
check('home 波纹槽位直读（不再 4 个 wx:for 扫全数组）', function () {
  const wxml = fs.readFileSync(path.join(MP, 'pages', 'home', 'home.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(MP, 'pages', 'home', 'home.js'), 'utf8');
  assert.ok(!/wx:for="\{\{ripples\}\}"/.test(wxml), '仍在用 wx:for 遍历整条 ripples');
  for (let i = 0; i < 4; i++) {
    assert.ok(wxml.indexOf('ripples[' + i + '].id') >= 0, '缺少波纹槽位 ' + i);
  }
  const slots = js.match(/\{ id: 0, x: 0, y: 0, cls: 0 \}/g) || [];
  assert.ok(slots.length >= 4, 'home.js 必须预置 4 个槽位，实际 ' + slots.length);
});

console.log('');
if (problems.length) {
  console.log('性能不变量：' + problems.length + ' 项未通过');
  process.exit(1);
}
console.log('性能不变量：全部通过 ✓');
