/**
 * 数据源 vs 产物 逐条对比（按条目 id 深比，不比文本）
 *
 * 跑法：node compare_data.js cmdbook-batch50.js [更多文件...]
 * 目的：单一数据源改造前，确认「以哪一边为准」，避免重建时丢数据
 * 输出：仅源有 / 仅产物有 / 同 id 字段差异
 */
const path = require('path');
const fs = require('fs');

const HERE = __dirname;
const SRC = path.join(HERE, 'data-src');
const TARGET_DIRS = [
  path.join(HERE, '..', 'miniprogram', 'utils'),
  path.join(HERE, '..', 'miniprogram', 'subpkg-tool', 'utils')
];

function findProduct(name) {
  const hits = TARGET_DIRS
    .map(d => path.join(d, name))
    .filter(p => fs.existsSync(p));
  return hits;
}

function loadFile(p) {
  delete require.cache[require.resolve(p)];
  return require(p);
}

/** 把 { BATCH50_EXTRA: [...] } 这类模块摊平成条目数组 */
function flatten(mod) {
  const out = [];
  for (const k of Object.keys(mod)) {
    const v = mod[k];
    if (Array.isArray(v)) v.forEach(it => out.push(it));
    else if (v && typeof v === 'object') out.push(v);
  }
  return out;
}

function itemKey(it, idx) {
  if (it && it.id) return it.id;
  return '#' + idx + ':' + JSON.stringify(it).slice(0, 40);
}

function diffFields(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = [];
  for (const k of keys) {
    if (k === 'id') continue;
    const va = JSON.stringify(a ? a[k] : undefined);
    const vb = JSON.stringify(b ? b[k] : undefined);
    if (va !== vb) out.push({ field: k, src: va, prod: vb });
  }
  return out;
}

function compare(name) {
  const sp = path.join(SRC, name);
  if (!fs.existsSync(sp)) {
    console.log('源文件不存在: ' + name);
    return;
  }
  const targets = findProduct(name);
  if (!targets.length) {
    console.log('产物不存在: ' + name);
    return;
  }
  if (targets.length > 1) {
    console.log('!! ' + name + ' 在多处存放: ' +
      targets.map(t => path.relative(path.join(HERE, '..', 'miniprogram'), t)).join(' , '));
  }

  const srcItems = flatten(loadFile(sp));
  const prodItems = flatten(loadFile(targets[0]));

  const srcMap = new Map();
  srcItems.forEach((it, i) => srcMap.set(itemKey(it, i), it));
  const prodMap = new Map();
  prodItems.forEach((it, i) => prodMap.set(itemKey(it, i), it));

  let onlySrc = [], onlyProd = [], fieldDiff = [];
  for (const [k, v] of srcMap) if (!prodMap.has(k)) onlySrc.push(k);
  for (const [k, v] of prodMap) if (!srcMap.has(k)) onlyProd.push(k);
  for (const [k, v] of srcMap) {
    if (!prodMap.has(k)) continue;
    const d = diffFields(v, prodMap.get(k));
    if (d.length) fieldDiff.push({ id: k, d });
  }

  console.log('=== ' + name + ' ===');
  console.log('  源 ' + srcItems.length + ' 条 / 产物 ' + prodItems.length + ' 条');
  if (onlySrc.length) console.log('  仅源有(' + onlySrc.length + '): ' + onlySrc.slice(0, 8).join(', '));
  if (onlyProd.length) console.log('  仅产物有(' + onlyProd.length + '): ' + onlyProd.slice(0, 8).join(', '));
  for (const fd of fieldDiff.slice(0, 8)) {
    console.log('  差异 ' + fd.id + ':');
    for (const f of fd.d) {
      console.log('    .' + f.field);
      console.log('      源  : ' + String(f.src).slice(0, 160));
      console.log('      产物: ' + String(f.prod).slice(0, 160));
    }
  }
  if (!onlySrc.length && !onlyProd.length && !fieldDiff.length) console.log('  条目级完全一致');
  console.log('');
}

const files = process.argv.slice(2);
if (!files.length) {
  console.log('用法: node compare_data.js <文件名.js> [...]');
  process.exit(1);
}
files.forEach(compare);
