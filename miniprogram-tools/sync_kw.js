/**
 * 诊断工具：对比 data-src 源与线上产物的 kw 差异。
 *
 * 背景：以前 kw 补丁是直接打在 miniprogram 各 utils 目录的压缩文件上的，
 *       minify_data.py 只在 data-src 不存在时才备份，所以补丁不会回流到 data-src，
 *       一旦执行 `minify_data.py --restore` 补丁就全丢。
 *       历史上靠这个脚本做「产物 → 源」的反向同步。
 *
 * 现在架构改成「源 → 产物」单向（见 build_data.py），
 * 源是唯一真源，不再需要反向同步。
 * 本脚本保留为诊断工具：看源和产物在 kw 上到底差在哪，差多少。
 * 正常情况下应该输出 0 条差异；若有差异，说明产物被手改过，
 * 正确做法是跑 `python build_data.py build` 用源覆盖产物。
 *
 * 用法：
 *   node sync_kw.js            # 检查下面 IDS 里列出的记录
 *   node sync_kw.js --all      # 检查所有同名 id 的 kw（不止 IDS 列表）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'data-src');
const DIRS = [
  path.join(ROOT, 'miniprogram', 'utils'),
  path.join(ROOT, 'miniprogram', 'subpkg-tool', 'utils')
];

const IDS = [
  'vid-storage', 'case-onceway', 'ven-cli-habit', 'tool-simulator', 'ref-led', 'buy-router',
  'ntp', 'pr-clock-ntp', 'port-isolate', 'vm-port-negotiation', 'dhcp-snooping',
  'vm-ap-onboard', 'port-rate-limit', 'fw-policy', 'pwd-policy', 'qos-trust'
];

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* 从 src 里定位 id 对应的 kw 数组，返回 { start, end, list }
   压缩版是 id:'x' / kw:[...]，可读版是 id: 'x' / kw: [...]，正则都要容错 */
function findKw(src, id) {
  const m = new RegExp("id:\\s*'" + esc(id) + "'").exec(src);
  if (!m) return null;
  const idIdx = m.index;
  const nextId = new RegExp("id:\\s*'", 'g');
  nextId.lastIndex = idIdx + m[0].length;
  const nx = nextId.exec(src);

  const kwIdx = src.indexOf('kw', idIdx);
  if (kwIdx < 0) return null;
  if (nx && nx.index < kwIdx) return null;
  const open = src.indexOf('[', kwIdx);
  const close = src.indexOf(']', open);
  if (open < 0 || close < 0) return null;
  let list;
  try {
    list = Function('return [' + src.slice(open + 1, close) + ']')();
  } catch (e) {
    return null;
  }
  if (!Array.isArray(list)) return null;
  return { start: kwIdx, end: close + 1, list: list };
}

/* 所有已上线数据文件 */
const shipped = [];
DIRS.forEach(function (d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(function (f) {
    if (/^cmdbook.*\.js$/.test(f)) shipped.push(path.join(d, f));
  });
});

/* id -> { file, list } */
const live = {};
shipped.forEach(function (p) {
  const src = fs.readFileSync(p, 'utf8');
  const ids = IDS.length && !process.argv.includes('--all')
    ? IDS
    : (src.match(/id:\s*'[^']+'/g) || []).map(function (s) { return s.replace(/^id:\s*'|'$/g, ''); });
  ids.forEach(function (id) {
    if (live[id]) return;
    const hit = findKw(src, id);
    if (hit) live[id] = { file: path.basename(p), list: hit.list };
  });
});

let changed = 0;
const missing = [];
IDS.forEach(function (id) {
  const info = live[id];
  if (!info) { missing.push(id); return; }
  const dst = path.join(SRC, info.file);
  if (!fs.existsSync(dst)) { missing.push(id + '(无源码)'); return; }

  const src = fs.readFileSync(dst, 'utf8');
  const hit = findKw(src, id);
  if (!hit) { missing.push(id + '(源码内找不到)'); return; }
  if (hit.list.join('\u0001') === info.list.join('\u0001')) return; // 已一致

  const onlyProd = info.list.filter(function (w) { return hit.list.indexOf(w) < 0; });
  const onlySrc = hit.list.filter(function (w) { return info.list.indexOf(w) < 0; });
  console.log('差异 ' + info.file + '  ' + id);
  console.log('  仅产物有: ' + (onlyProd.length ? onlyProd.join(', ') : '（无）'));
  console.log('  仅源有  : ' + (onlySrc.length ? onlySrc.join(', ') : '（无）'));
  changed++;
});

console.log('');
console.log('有差异的记录 ' + changed + ' 条');
if (missing.length) console.log('未找到: ' + missing.join(', '));
if (changed > 0) {
  console.log('');
  console.log('提示：源是唯一真源。确认产物里的新词值得保留时，');
  console.log('      先把词补进 data-src 源码，再跑 python build_data.py build。');
}
