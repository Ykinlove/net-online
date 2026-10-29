/* 孤儿条目归类补丁
 *
 * 背景：搜索页左侧的设备栏来自 seed.js 的 DEVICES（9 个标准值）。
 * 有 12 条条目的 devs 里一个标准值都没有，用户点任何设备筛选，
 * 这 12 条都搜不出来——内容明明在库里，却像是没收录。
 *
 * 处理：给这 12 条的 devs 补上标准值，**保留原有的细分分类**
 * （OLT / 光猫 / 传输设备 这些词本身有辨识度，删掉是信息损失）。
 * devs 是数组，命中任意一个即可被该设备筛出，所以可以并存。
 *
 * 同时改 data-src（源码版）和 miniprogram/subpkg-tool/utils（压缩版），
 * 两边保持一致，避免以后再生成时又被覆盖回旧值。
 *
 * 用法：node miniprogram-tools/fix_orphan_devs.js [--dry]
 */

const fs = require('fs');
const path = require('path');

const FIX = [
  { id: 'pr-pon-ftth', add: ['其他设备', 'Switch'] },
  { id: 'pr-sys-bond', add: ['服务器', 'Linux'] },
  { id: 'pr-sys-k8s', add: ['Linux', '服务器'] },
  { id: 'pr-net-ipplan', add: ['Switch', 'Router'] },
  { id: 'pr-ops-monitor-system', add: ['服务器', 'Linux'] },
  { id: 'pr-trans-spn', add: ['其他设备', 'Router'] },
  { id: 'pr-net-toolbox', add: ['其他设备'] },
  { id: 'pr-net-deliver', add: ['其他设备'] },
  { id: 'pr-net-cutover-plan', add: ['其他设备'] },
  { id: 'pr-sys-logserver', add: ['服务器', 'Linux'] },
  { id: 'pr-linux-adv', add: ['Linux', '服务器'] },
  { id: 'pr-win-server', add: ['Windows', '服务器'] }
];

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'miniprogram-tools', 'data-src', 'cmdbook-practice.js'),
  path.join(ROOT, 'miniprogram', 'subpkg-tool', 'utils', 'cmdbook-practice.js')
];

const dry = process.argv.indexOf('--dry') >= 0;

/* 引号统一用单引号，跟这两个文件的现有风格一致 */
function q(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

function uniq(arr) {
  const seen = {};
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (seen[arr[i]]) continue;
    seen[arr[i]] = 1;
    out.push(arr[i]);
  }
  return out;
}

let changedFiles = 0;
let changedItems = 0;

TARGETS.forEach(function (file) {
  if (!fs.existsSync(file)) {
    console.log('  跳过（不存在）: ' + path.relative(ROOT, file));
    return;
  }
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  FIX.forEach(function (item) {
    /* 定位这条：id 后面紧跟 devs 数组。
       两种格式：
         源码版  devs: ['OLT', 'ONU', '光猫'],
         压缩版  devs:['OLT','ONU','光猫'],
       正则统一兼容。 */
    const re = new RegExp(
      "(id:\\s*" + q(item.id) + "\\s*,\\s*devs:\\s*\\[)([^\\]]*)(\\])"
    );
    const m = src.match(re);
    if (!m) {
      console.log('  ! 未定位到 ' + item.id + '（' + path.relative(ROOT, file) + '）');
      return;
    }
    const current = m[2].split(',')
      .map(function (x) { return x.trim().replace(/^['"]|['"]$/g, ''); })
      .filter(Boolean);
    const merged = uniq(current.concat(item.add));
    if (merged.length === current.length) return; /* 已有，不动 */

    /* 保持原有紧凑程度：原本没有空格就不加空格 */
    const tight = m[2].indexOf(',') < 0 && m[2].indexOf(':') < 0 && m[2].trim().indexOf(' ') < 0;
    const body = merged.map(q).join(tight ? ',' : ', ');
    src = src.slice(0, m.index) + m[1] + body + m[3] + src.slice(m.index + m[0].length);
    changedItems++;
  });

  if (src !== before) {
    changedFiles++;
    if (dry) {
      console.log('  [dry] 将写入: ' + path.relative(ROOT, file));
    } else {
      fs.writeFileSync(file, src, 'utf8');
      console.log('  已写入: ' + path.relative(ROOT, file));
    }
  } else {
    console.log('  无变化: ' + path.relative(ROOT, file));
  }
});

console.log('');
console.log('改动条目 ' + changedItems + ' 处，文件 ' + changedFiles + ' 个' + (dry ? '（dry-run，未落盘）' : ''));
