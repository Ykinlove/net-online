// 校验 hotfix 的 extra_items 合并到 cmdbook（node 无 wx 环境）
global.wx = undefined;
const cmdbook = require('../miniprogram/subpkg-tool/utils/cmdbook.js');
const hotfix = require('../miniprogram/utils/hotfix.js');

let fails = 0;
function ok(name, cond) {
  if (cond) console.log('  PASS  ' + name);
  else { console.log('  FAIL  ' + name); fails++; }
}

// 注入一个已批准新增百科 + 一个已批准新增模板
const bookExtra = {
  id: 'ext-book-demo', devs: ['Switch', 'Router'],
  name: '演示新增百科', kw: ['演示新增', 'demo-add'],
  cmds: [['华为', 'demo-cmd']], tip: '来自投稿'
};
const tplExtra = {
  id: 'ext-tpl-demo', kw: ['演示模板新增'], cat: '开局模板',
  name: '演示新增模板', vendor: '华为 VRP8', code: 'demo tpl code', note: '来自投稿'
};
hotfix._dbg.setExtras({ book: { 'ext-book-demo': bookExtra }, tpl: { 'ext-tpl-demo': tplExtra } });

// ---- 索引包含 extras ----
const idx = cmdbook._dbg.buildIndex();
ok('百科索引包含本地条目', idx.some(r => r.it.id === 'vlan-create'));
ok('百科索引包含新增条目', idx.some(r => r.it.id === 'ext-book-demo'));
const tIdx = cmdbook._dbg.tplIndex();
ok('模板索引包含本地模板', tIdx.some(r => r.it.id === 'tpl-switch-base'));
ok('模板索引包含新增模板', tIdx.some(r => r.it.id === 'ext-tpl-demo'));

// ---- 详情可达 ----
ok('findById 命中新增百科', cmdbook.findById('ext-book-demo') && cmdbook.findById('ext-book-demo').name === '演示新增百科');
ok('findTplById 命中新增模板', cmdbook.findTplById('ext-tpl-demo') && cmdbook.findTplById('ext-tpl-demo').code === 'demo tpl code');
ok('findById 仍命中本地', !!cmdbook.findById('vlan-create'));

// ---- 搜索可命中新增 ----
const sb = cmdbook.search('演示新增', '全部');
ok('搜索命中新增百科', sb.some(r => r.id === 'ext-book-demo'));
const st = cmdbook.searchTemplates('演示模板新增', 5);
ok('搜索命中新增模板', st.some(r => r.id === 'ext-tpl-demo'));

// ---- 分类统计计入新增百科 ----
const stats = cmdbook.categoryStats();
ok('categoryStats 仍返回分类数组', Array.isArray(stats) && stats.length > 0);

// ---- 新增条目各出现一次（不被重复注入），本地条目未被破坏 ----
const countId = (arr, id) => arr.filter(r => r.it.id === id).length;
ok('新增百科注入且唯一', countId(idx, 'ext-book-demo') === 1);
ok('新增模板注入且唯一', countId(tIdx, 'ext-tpl-demo') === 1);
ok('本地条目仍唯一存在', countId(idx, 'vlan-create') === 1);
// 注意：BOOK 源数据本身存在少量重复 id（历史问题），此处不校验全局无重复。
const extraIds = idx.map(r => r.it.id).filter(id => id.indexOf('ext-') === 0);
ok('仅注入了预期的 1 条新增百科', extraIds.length === 1 && extraIds[0] === 'ext-book-demo');

console.log(fails === 0 ? '\nALL PASS' : '\n' + fails + ' FAILED');
process.exit(fails === 0 ? 0 : 1);
