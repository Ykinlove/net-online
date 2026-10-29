/**
 * 找条：按名称/关键词包含关系在库里反查，用来区分
 *   「内容不存在」  还是  「内容存在但搜索排序被挤掉」
 *
 *   node find_item.js 交换机怎么选 mac地址表 arp 端口不亮
 */
const { BOOK } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const words = process.argv.slice(2);
if (!words.length) {
  console.log('用法: node find_item.js <词> [词2 ...]');
  process.exit(0);
}

words.forEach(function (w) {
  const lw = w.toLowerCase();
  const hits = BOOK.filter(function (it) {
    return (it.name || '').toLowerCase().indexOf(lw) >= 0 ||
      (it.kw || []).some(function (k) { return k.toLowerCase().indexOf(lw) >= 0; });
  });
  console.log('【' + w + '】 命中 ' + hits.length + ' 条');
  hits.slice(0, 8).forEach(function (it) {
    console.log('   ' + (it.id || '').padEnd(22) + it.name + '   (' + (it.cmds || []).length + ' 组)');
  });
  console.log('');
});
