/**
 * 把「已上线（压缩版）数据文件」里某条记录的 kw 数组，同步回 data-src 的可读源码。
 *
 * 背景：kw 补丁是在 miniprogram 各 utils 目录的压缩文件上直接打的，
 *       minify_data.py 只在 data-src 不存在时才备份，所以补丁不会回流到 data-src。
 *       一旦执行 `minify_data.py --restore`，补丁就全丢。
 *
 * 用法：
 *   node sync_kw.js            # 同步下面 IDS 里列出的记录
 *   node sync_kw.js --all      # 同步两份数据里所有同名 id 的 kw（慎用，会覆盖手改）
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

  const line = 'kw: [' + info.list.map(function (w) { return "'" + w + "'"; }).join(', ') + ']';
  fs.writeFileSync(dst, src.slice(0, hit.start) + line + src.slice(hit.end), 'utf8');
  console.log('同步 ' + info.file + '  ' + id + '  (' + info.list.length + ' 词)');
  changed++;
});

console.log('');
console.log('共同步 ' + changed + ' 条');
if (missing.length) console.log('未同步: ' + missing.join(', '));
