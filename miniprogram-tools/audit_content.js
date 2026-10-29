/**
 * 内容体检：回答「还要不要继续加命令」
 * 只看结构指标，不做搜索评测（那交给 eval_search.js）
 *
 *   node audit_content.js
 */
const { BOOK } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');
const { TPLS } = require('../miniprogram/utils/tplbook.js');

let cmdGroups = 0, zero = 0, one = 0, bare = 0;
const vc = {};
const devc = {};
const kv = {};

BOOK.forEach(function (it) {
  const n = (it.cmds || []).length;
  cmdGroups += n;
  if (n === 0) zero++;
  if (n === 1) one++;
  if (!it.tip) bare++;
  const k = (it.kw || []).length;
  kv[k >= 8 ? '8+' : String(k)] = (kv[k >= 8 ? '8+' : String(k)] || 0) + 1;

  (it.devs || []).forEach(function (d) { devc[d] = (devc[d] || 0) + 1; });
  (it.cmds || []).forEach(function (c) {
    const t = c[0] || '';
    ['华为', '思科', 'H3C', '锐捷'].forEach(function (v) {
      if (t.indexOf(v) >= 0) vc[v] = (vc[v] || 0) + 1;
    });
  });
});

console.log('===== 规模 =====');
console.log('命令条目      ' + BOOK.length);
console.log('命令组        ' + cmdGroups + '   平均 ' + (cmdGroups / BOOK.length).toFixed(1) + ' 组/条');
console.log('配置模板      ' + (TPLS || []).length);
console.log('');
console.log('===== 结构 =====');
console.log('0 组命令      ' + zero + (zero ? '  ← 异常' : ''));
console.log('只有 1 组     ' + one + ' (' + Math.round(one * 100 / BOOK.length) + '%)');
console.log('缺 tip 提示   ' + bare);
console.log('');
console.log('===== 厂商覆盖（按命令组标题统计）=====');
Object.keys(vc).sort(function (a, b) { return vc[b] - vc[a]; }).forEach(function (k) {
  console.log('  ' + k.padEnd(6) + vc[k] + ' 条含该厂商命令');
});
console.log('');
console.log('===== 设备类型 TOP =====');
Object.keys(devc).sort(function (a, b) { return devc[b] - devc[a]; }).slice(0, 12).forEach(function (k) {
  console.log('  ' + k.padEnd(18) + devc[k]);
});
console.log('  ...共 ' + Object.keys(devc).length + ' 类');
console.log('');
console.log('===== 检索词数量分布 =====');
Object.keys(kv).sort().forEach(function (k) {
  console.log('  ' + k.padEnd(4) + kv[k] + ' 条');
});
