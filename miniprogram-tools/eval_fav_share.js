/* 收藏 + 分享链路评测
 *
 * 这两块不像搜索那样靠「排得对不对」评判，而是靠**闭环能不能通**：
 * 收藏了能不能取回来、分享出去别人能不能落地看到同一条。
 *
 * 用法：node miniprogram-tools/eval_fav_share.js
 */

const path = require('path');
const Module = require('module');
const fs = require('fs');

const MP = path.join(__dirname, '..', 'miniprogram');

/* ---- mock 小程序全局（只用到 storage）---- */
const storage = {};
global.getApp = () => ({ globalData: {}, watch: () => {} });
global.Page = cfg => { cfg.setData = p => Object.assign(cfg.data || (cfg.data = {}), p); };
global.wx = {
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: k => { delete storage[k]; },
  showToast: () => {},
  setClipboardData: () => {},
  navigateTo: () => {}, switchTab: () => {},
};

/* require('/utils/x') → miniprogram/utils/x */
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

const store = require('/utils/store.js');
const cmdbook = require('/utils/cmdbook.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name + (extra ? '  → ' + extra : '')); }
}

(async function () {
  store.init();

  /* ---------- 收藏 ---------- */
  check('初始无收藏', store.getFavs().length === 0);

  await store.toggleFav({ kind: 'book', id: 'console-password', title: 'console 口密码', sub: '交换机' });
  check('收藏百科后有 1 条', store.getFavs().length === 1);
  check('isFav 命中', store.isFav('book', 'console-password'));
  check('isFav 不串类型', !store.isFav('tpl', 'console-password'));

  await store.toggleFav({ kind: 'tpl', id: 'tpl-nat', title: 'NAT 上网模板', sub: 'NAT 模板' });
  await store.toggleFav({ kind: 'mine', id: 'cmd-001', title: '我的命令', sub: '交换机' });
  check('三类收藏共存', store.getFavs().length === 3);

  const favs = store.getFavs();
  check('收藏带 kind/id/title', favs.every(f => f.kind && f.id && f.title));
  check('新的排最前', favs[0].id === 'cmd-001', favs[0].id);

  /* 取消收藏 */
  await store.toggleFav({ kind: 'book', id: 'console-password', title: 'console 口密码' });
  check('取消收藏生效', !store.isFav('book', 'console-password'));
  check('取消后剩 2 条', store.getFavs().length === 2);

  /* 上限保护 */
  for (let i = 0; i < 260; i++) {
    await store.toggleFav({ kind: 'book', id: 'bulk-' + i, title: '批量' + i });
  }
  check('收藏有上限保护', store.getFavs().length <= 200, '实际 ' + store.getFavs().length);

  /* ---------- 分享闭环 ---------- */
  const book = cmdbook.lookupById('book', 'console-password');
  check('落地能取回百科条目', !!book && book.name.length > 0);
  check('落地带命令内容', !!book && book.blocks.length > 0);
  check('落地带 tip', !!book && !!book.tip);

  const tpl = cmdbook.lookupById('tpl', 'tpl-nat');
  check('落地能取回模板', !!tpl && tpl.blocks.length === 1);

  check('落地找不到时返回 null', cmdbook.lookupById('book', 'no-such-id') === null);

  const card = cmdbook.shareCard({
    kind: 'book', id: 'console-password', title: book.name, blocks: book.blocks
  });
  check('分享标题是条目名', card.title === book.name);
  check('分享路径带 kind 和 id', card.path.indexOf('kind=book') >= 0 && card.path.indexOf('id=console-password') >= 0);
  check('分享正文不是空', card.content.length > 0);

  /* 分享路径里的参数能解析回来 */
  const qi = card.path.split('?')[1].split('&');
  const q = {};
  qi.forEach(kv => { const p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
  check('路径参数可解析', q.kind === 'book' && q.id === 'console-password');
  check('按路径参数能落地', !!cmdbook.lookupById(q.kind, q.id));

  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
})();
