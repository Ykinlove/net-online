// 扫描 data-src 真源里重复的 id（命令百科 + 配置模板）
//
// 用法：
//   node scan_dup_ids.js         # 打印统计；有重复时退出码 1（可直接当 CI 守卫）
//
// 说明：
//   百科 id 与模板 id 是两套独立命名空间（模板 id 统一 tpl- 前缀），
//   因此分开统计：同名但一册一模板不算冲突。
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'data-src');
if (!fs.existsSync(dir)) {
  console.log('no data-src');
  process.exit(0);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const books = {};   // 百科 id → 首次出现的文件
const tpls = {};    // 模板 id → 首次出现的文件
const dupBooks = [];
const dupTpls = [];

files.forEach(f => {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const id = m[1];
    // tpl- 前缀一律归模板命名空间；其余归百科
    const isTpl = id.startsWith('tpl-');
    const map = isTpl ? tpls : books;
    const list = isTpl ? dupTpls : dupBooks;
    if (map[id]) list.push(id + '  <- ' + map[id] + ' & ' + f);
    else map[id] = f;
  }
});

const bookCount = Object.keys(books).length;
const tplCount = Object.keys(tpls).length;
const dupTotal = dupBooks.length + dupTpls.length;

console.log('data-src 文件数: ' + files.length +
  '  百科唯一 id: ' + bookCount +
  '  模板唯一 id: ' + tplCount +
  '  重复条数: ' + dupTotal);

dupBooks.forEach(d => console.log('  [百科] ' + d));
dupTpls.forEach(d => console.log('  [模板] ' + d));

if (dupTotal) {
  console.log('\n存在重复 id，请用 rename_dup_ids.js 改名为唯一新 id 后再提交。');
  process.exit(1);
}
