// 验证：把「有道云笔记」导入的命令，按小程序客户端真实读取 + 渲染逻辑跑一遍
//
// 目的：不依赖开发者工具，直接用云端真实数据验证数据契约：
//   1) 字段名是否和 pages/commands/commands.js 的 rebuild() 期望的一致
//   2) _id 是否是客户端能直接用的字符串（原生 32 位十六进制）
//   3) device 是否都是 seed.js DEVICES 里的合法 key（否则设备筛选栏点不到）
//   4) 多行命令在 pre-wrap 下能完整渲染
//
// 用法：node miniprogram-tools/verify_note_commands.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const COLL = 'commands';
const SRC = 'youdao-note-8AgaX8cm';
const TARGETS = [
  { nickname: 'Yang', openid: '__OPENID_A__' },
  { nickname: 'Ykin', openid: '__OPENID_B__' }
];

let pass = 0, fail = 0;
const ok = (s) => { console.log('  ✓ ' + s); pass++; };
const bad = (s) => { console.log('  ✗ ' + s); fail++; };

function resolveTcb() {
  const nodeDir = path.dirname(process.execPath);
  for (const c of [
    path.join(nodeDir, 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'),
    path.join(nodeDir, '..', 'lib', 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'),
    path.join(nodeDir, '..', 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb')
  ]) {
    try { if (fs.existsSync(c)) return { cmd: process.execPath, prefix: [c] }; } catch (e) { /* ignore */ }
  }
  return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', prefix: [] };
}
const TCB = resolveTcb();
const REPO = path.join(__dirname, '..');

function nosql(cmdObj) {
  const payload = JSON.stringify([{
    TableName: COLL, CommandType: cmdObj.type, Command: JSON.stringify(cmdObj.command)
  }]);
  const out = execFileSync(
    TCB.cmd,
    TCB.prefix.concat(['db', 'nosql', 'execute', '--command', payload, '--json']),
    { cwd: REPO, stdio: 'pipe', timeout: 180000, encoding: 'utf8' }
  );
  return JSON.parse(out);
}
function findAll(filter, limit) {
  const r = nosql({ type: 'COMMAND', command: { find: COLL, filter: filter || {}, limit: limit || 500 } });
  const res = (r && r.data && r.data.results) || [];
  return Array.isArray(res[0]) ? res[0] : [];
}

/* seed.js 里的合法设备 key（硬编码一份，避免依赖小程序模块路径） */
const DEVICES = ['Windows', 'Switch', 'Router', 'AC', 'AP', '防火墙', 'Linux', '服务器', '其他设备'];

/* —— 复刻 pages/commands/commands.js 的 rebuild() 映射 —— */
function mapLikeClient(c) {
  return {
    _key: c._id || c._localId,
    _id: c._id || '',
    device: c.device || '其他设备',
    title: c.title || '(未命名命令)',
    preview: String(c.content || '').split('\n').slice(0, 2).join('\n'),
    content: c.content || '',
    desc: c.desc || '',
    skill: c.skill || '',
    tags: c.tags || ''
  };
}

console.log('════════════════════════════════════');
console.log('  私有命令导入验证');
console.log('════════════════════════════════════');

const all = findAll({ src: SRC }, 500);

console.log('\n── 1. 数据总量与归属 ──');
if (all.length === 48) ok('同源记录 48 条（24 条 × 2 位作者）');
else bad('同源记录 ' + all.length + ' 条，期望 48');
const byOpenid = {};
all.forEach(d => { byOpenid[d._openid] = (byOpenid[d._openid] || 0) + 1; });
TARGETS.forEach(t => {
  const n = byOpenid[t.openid] || 0;
  if (n === 24) ok(t.nickname + ' → 24 条');
  else bad(t.nickname + ' → ' + n + ' 条，期望 24');
});
const stray = Object.keys(byOpenid).filter(o => !TARGETS.some(t => t.openid === o));
if (stray.length === 0) ok('没有任何记录归属到其他 openid');
else bad('存在 ' + stray.length + ' 个其他 openid 的记录：' + stray.join(', '));

console.log('\n── 2. 客户端数据契约 ──');
const badId = all.filter(d => typeof d._id !== 'string' || !/^[0-9a-f]{32}$/.test(d._id));
if (badId.length === 0) ok('_id 全部是原生 32 位十六进制字符串（客户端 .doc(id) 可用）');
else bad(badId.length + ' 条 _id 格式异常，例如：' + JSON.stringify(badId[0]._id));

const badDev = all.filter(d => DEVICES.indexOf(d.device) < 0);
if (badDev.length === 0) ok('device 全部是 seed.js DEVICES 的合法 key（设备筛选栏可命中）');
else bad('device 非法值：' + badDev.map(d => d.device).join(','));

const noTitle = all.filter(d => !d.title);
const noContent = all.filter(d => !d.content);
if (noTitle.length === 0 && noContent.length === 0) ok('title / content 均非空');
else bad('空 title ' + noTitle.length + ' 条、空 content ' + noContent.length + ' 条');

const longTitle = all.filter(d => String(d.title).length > 40);
const longDesc = all.filter(d => String(d.desc || '').length > 60);
if (longTitle.length === 0) ok('title ≤ 40 字（对齐表单 maxlength）');
else bad(longTitle.length + ' 条 title 超过 40 字');
if (longDesc.length === 0) ok('desc ≤ 60 字（对齐表单 maxlength）');
else bad(longDesc.length + ' 条 desc 超过 60 字：' + longDesc.map(d => d.title).join(' / '));

console.log('\n── 3. 渲染链路（复刻 rebuild 映射）──');
const yangRows = all.filter(d => d._openid === TARGETS[0].openid).map(mapLikeClient);
if (yangRows.length === 24) ok('Yang 端映射出 24 条列表项');
else bad('Yang 端映射出 ' + yangRows.length + ' 条');

const multi = yangRows.filter(r => r.content.indexOf('\n') >= 0);
if (multi.length > 0) ok(multi.length + ' 条是多行命令（pre-wrap 下完整换行渲染）');
else bad('没有多行命令，映射可能有误');

const devCount = {};
yangRows.forEach(r => { devCount[r.device] = (devCount[r.device] || 0) + 1; });
console.log('  Yang 端按设备分布：' + Object.keys(devCount).map(k => k + ' ' + devCount[k] + ' 条').join('，'));

console.log('\n── 4. 抽查渲染效果 ──');
['配置端口隔离', '配置远程登录用户（SSH）', '进入AP组/指定AP', '查看光衰'].forEach(t => {
  const hit = yangRows.filter(r => r.title === t)[0];
  if (!hit) { bad('缺条目：' + t); return; }
  console.log('  【' + hit.device + '】' + hit.title);
  hit.content.split('\n').forEach(l => console.log('      ' + l));
  console.log('      说明：' + hit.desc);
});

console.log('\n── 5. 隔离面检查 ──');
const other = findAll({ src: { $ne: SRC } }, 500);
console.log('  commands 集合总记录 ' + findAll({}, 500).length + ' 条（同源 ' + all.length + ' + 既有 ' + (other.length) + '）');
const leak = findAll({ content: { $regex: '__SECRET_1__|210\\.26\\.111\\.61|__SNMP_RO__' } }, 500);
const leakOutside = leak.filter(d => d.src !== SRC || !TARGETS.some(t => t.openid === d._openid));
if (leakOutside.length === 0) ok('含凭据的 ' + leak.length + ' 条记录全部归属这 2 位作者，无外溢');
else bad('有 ' + leakOutside.length + ' 条含凭据的记录落在目标之外');

console.log('\n════════════════════════════════════');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('════════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);
