// 分析 data-src 重复 id：判定是「完全一致（可删冗余）」还是「内容不同（需改名）」
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'data-src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

// 收集所有条目 id -> { file, entry(深拷贝可序列化部分) }
const map = {}; // id -> array of {file, obj}
files.forEach(f => {
  let mod;
  try { mod = require(path.join(dir, f)); } catch (e) { console.log('require 失败:', f, e.message); return; }
  Object.keys(mod).forEach(key => {
    const val = mod[key];
    if (!Array.isArray(val)) return;
    val.forEach(it => {
      if (!it || !it.id) return;
      if (!map[it.id]) map[it.id] = [];
      map[it.id].push({ file: f, obj: JSON.parse(JSON.stringify(it)) });
    });
  });
});

const dups = Object.keys(map).filter(id => map[id].length > 1);
console.log('重复 id 数:', dups.length);
dups.forEach(id => {
  const arr = map[id];
  const sigs = arr.map(a => JSON.stringify(a.obj));
  const identical = sigs.every(s => s === sigs[0]);
  console.log('\n★ ' + id + '  (' + arr.length + ' 处)  ' + (identical ? '【完全一致-可删冗余】' : '【内容不同-需改名】'));
  arr.forEach((a, i) => {
    const o = a.obj;
    console.log('   ' + (i + 1) + '. ' + a.file + '  name=' + (o.name || '?'));
  });
  if (!identical) {
    arr.forEach((a, i) => {
      const o = a.obj;
      console.log('      [' + i + '] name=' + (o.name || '') + ' kw=' + JSON.stringify(o.kw || []) + ' cmds/note=' + (o.note ? 'hasNote' : (o.cmds ? 'hasCmds' : '?')));
    });
  }
});
