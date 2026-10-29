/** 生成紧凑审查表：每条一行，看四厂商首行命令，便于快速发现异常 */
const { BOOK } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const from = Number(process.argv[2] || 0);
const to = Number(process.argv[3] || BOOK.length);

BOOK.slice(from, to).forEach((it, i) => {
  const n = from + i;
  const parts = it.cmds.map(c => {
    const first = String(c[1]).split('\n')[0].trim();
    return c[0] + ':' + first;
  });
  console.log(String(n).padStart(3) + ' ' + it.devs.join('/').slice(0, 12).padEnd(12) + ' ' +
    it.name.padEnd(22) + ' | ' + parts.join('  |  '));
});
