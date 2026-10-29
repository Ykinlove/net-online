/** 批量看 Top1：node top1.js <文件或直接列词> */
const { search } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');
const qs = process.argv.slice(2);
qs.forEach(function (q) {
  const r = search(q);
  console.log(q.padEnd(16) + ' → ' + (r.length ? r[0].name : '（无结果）') + '   [' + r.length + ']');
});
