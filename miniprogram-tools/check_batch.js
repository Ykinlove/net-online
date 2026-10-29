/* 批17 数据校验：字段完整性 + 无效转义扫描 */
const { PRACTICE } = require('../miniprogram/subpkg-tool/utils/cmdbook-practice.js');
const fs = require('fs');

console.log('PRACTICE 条数:', PRACTICE.length);
const ids = PRACTICE.map(p => p.id);
console.log('重复ID:', ids.filter((v, i) => ids.indexOf(v) !== i));

let bad = 0;
for (const p of PRACTICE) {
  if (!p.devs || !p.devs.length || !p.name || !p.kw || !p.kw.length || !p.cmds || !p.cmds.length || !p.tip) {
    console.log('字段缺失:', p.id); bad++; continue;
  }
  for (const [v, c] of p.cmds) { if (!v || !c) { console.log('空cmd:', p.id); bad++; } }
  // 命令块里出现「\i」「\d」这类无效转义拼接痕迹（英文单词粘连）
  const glue = p.cmds.map(c => c[1]).join('').match(/[a-z]-[a-z]{2,}/g);
  if (glue && /tableisplay|ledisplay|ngdisplay/.test(p.cmds.map(c => c[1]).join(''))) {
    console.log('疑似粘连:', p.id); bad++;
  }
}
console.log('字段校验:', bad === 0 ? '全部通过' : '失败 ' + bad);

/* 无效转义扫描：JS 源文件里 \x 不是 n/r/t/'/"/\\/0 的就是无效转义 */
const src = fs.readFileSync(__dirname + '/../miniprogram/subpkg-tool/utils/cmdbook-practice.js', 'utf8');
const badEsc = [];
const re = /(^|[^\\])\\([^nrt'"\\0])/g;
let m;
while ((m = re.exec(src))) badEsc.push(m[2]);
console.log('无效转义字符:', badEsc.length ? [...new Set(badEsc)].join(' ') : '无');
