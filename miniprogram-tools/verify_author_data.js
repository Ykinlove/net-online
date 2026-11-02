// 验证「作者私有数据」的隔离性与数据契约
//
// 覆盖两块：
//   1) commands（命令手记）—— 有道云笔记导入的 48 条
//   2) projects（项目记录）—— 简历里的 2 个项目 × 2 位作者
//
// 关键断言：这些集合的 ACL 必须是 PRIVATE（客户端只能读自己 _openid 的行），
// 且集合里不能出现第三方 openid 的记录 —— 否则「其他人打开依旧是空白」就不成立。
//
// 用法：node miniprogram-tools/verify_author_data.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENV_ID = 'net-online-d7g1ig4c6f07a8abb';
const TARGETS = [
  { nickname: 'Yang', openid: '__OPENID_A__' },
  { nickname: 'Ykin', openid: '__OPENID_B__' }
];

let pass = 0, fail = 0;
function ok(msg) { pass++; console.log('  ✓ ' + msg); }
function bad(msg) { fail++; console.log('  ✗ ' + msg); }

/* ---------------- tcb CLI ---------------- */
function resolveTcb() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'),
    path.join(nodeDir, '..', 'lib', 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'),
    path.join(nodeDir, '..', 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb')
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return { cmd: process.execPath, prefix: [c] }; } catch (e) { /* ignore */ }
  }
  return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', prefix: [] };
}
const TCB = resolveTcb();
const REPO = path.join(__dirname, '..');

function tcb(args) {
  return execFileSync(TCB.cmd, TCB.prefix.concat(args), {
    cwd: REPO, stdio: 'pipe', timeout: 180000, encoding: 'utf8'
  });
}

/* nosql 兼容层查询 */
function query(table, filter, limit, projection) {
  const payload = JSON.stringify([{
    TableName: table,
    CommandType: 'COMMAND',
    Command: JSON.stringify({ find: table, filter: filter || {}, limit: limit || 500, projection: projection || {} })
  }]);
  const out = tcb(['db', 'nosql', 'execute', '--command', payload, '--json']);
  const j = parseJsonLoose(out);
  const res = (j && j.data && j.data.results) || [];
  return Array.isArray(res[0]) ? res[0] : [];
}

/* 读集合 ACL：返回权限字符串 */
function aclOf(table) {
  const out = tcb([
    'api', 'tcb', 'DescribeDatabaseACL', '--api-version', '2018-06-08',
    '--body', JSON.stringify({ EnvId: ENV_ID, CollectionName: table }), '--json'
  ]);
  const j = parseJsonLoose(out);
  const d = j && j.data;
  if (!d) return '';
  return d.AclTag || d.ACL || d.Privilege || d.CollectionACL || JSON.stringify(Object.keys(d));
}

/* tcb CLI 会在 JSON 前打一行 "i → TCB.XXX" 提示，这里把真正的 JSON 抠出来 */
function parseJsonLoose(out) {
  const s = String(out);
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('输出里没有 JSON：' + s.slice(0, 200));
  return JSON.parse(s.slice(i, j + 1));
}

/* ---------------- 检查项 ---------------- */
console.log('══ 1. 集合 ACL（决定隔离是否成立）══');
const PRIVATE_COLLS = ['commands', 'projects'];
PRIVATE_COLLS.forEach(c => {
  const a = aclOf(c);
  if (/PRIVATE/i.test(a)) ok(c + ' ACL = PRIVATE（客户端只能读自己 _openid 的行）');
  else bad(c + ' ACL = ' + a + ' ← 不是 PRIVATE，隔离不成立！');
});

console.log('');
console.log('══ 2. commands：笔记导入的命令 ══');
{
  const rows = query('commands', { src: 'youdao-note-8AgaX8cm' }, 500);
  const byOpenid = {};
  rows.forEach(r => { byOpenid[r._openid] = (byOpenid[r._openid] || 0) + 1; });

  TARGETS.forEach(t => {
    const n = byOpenid[t.openid] || 0;
    if (n === 24) ok(t.nickname + ' → 24 条命令');
    else bad(t.nickname + ' → ' + n + ' 条（应为 24）');
  });

  const others = Object.keys(byOpenid).filter(o => !TARGETS.some(t => t.openid === o));
  if (!others.length) ok('无第三方 openid 记录');
  else bad('存在第三方记录：' + others.join(', '));

  /* 字段合法性 */
  let badId = 0, badTitle = 0, badDesc = 0, badContent = 0, badDevice = 0;
  rows.forEach(r => {
    if (!/^[0-9a-f]{32}$/.test(String(r._id))) badId++;
    if (!String(r.title || '').trim() || String(r.title).length > 40) badTitle++;
    if (String(r.desc || '').length > 60) badDesc++;
    if (!String(r.content || '').trim()) badContent++;
    if (!String(r.device || '').trim()) badDevice++;
  });
  if (!badId) ok('_id 全为原生 32 位十六进制（客户端 .doc(id) 可用）');
  else bad(badId + ' 条 _id 格式不对');
  if (!badTitle) ok('title 非空且 ≤40 字（对齐表单 maxlength）');
  else bad(badTitle + ' 条 title 超长或为空');
  if (!badDesc) ok('desc ≤60 字（对齐表单 maxlength）');
  else bad(badDesc + ' 条 desc 超长');
  if (!badContent) ok('content 全部非空');
  else bad(badContent + ' 条 content 为空');
  if (!badDevice) ok('device 全部非空（设备筛选栏能命中）');
  else bad(badDevice + ' 条 device 为空');
}

console.log('');
console.log('══ 3. projects：简历里的两个项目 ══');
{
  const rows = query('projects', { src: 'resume-2026-projects' }, 500);
  const byOpenid = {};
  rows.forEach(r => { byOpenid[r._openid] = (byOpenid[r._openid] || 0) + 1; });

  TARGETS.forEach(t => {
    const n = byOpenid[t.openid] || 0;
    if (n === 2) ok(t.nickname + ' → 2 个项目');
    else bad(t.nickname + ' → ' + n + ' 个（应为 2）');
  });

  const others = Object.keys(byOpenid).filter(o => !TARGETS.some(t => t.openid === o));
  if (!others.length) ok('无第三方 openid 记录');
  else bad('存在第三方记录：' + others.join(', '));

  const names = ['兰天公寓一期PON光网建设项目', '校园无线网络升级改造项目'];
  let badId = 0, badName = 0, badRole = 0, badDev = 0, badTags = 0, badContent = 0, badDate = 0;
  rows.forEach(r => {
    if (!/^[0-9a-f]{32}$/.test(String(r._id))) badId++;
    if (!names.includes(r.name)) badName++;
    if (String(r.role || '').length > 20) badRole++;
    if (String(r.devices || '').length > 60) badDev++;
    if (String(r.tags || '').length > 60) badTags++;
    if (!String(r.content || '').trim() || String(r.content).split('\n').length < 3) badContent++;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.startDate || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.endDate || ''))) badDate++;
  });
  if (!badId) ok('_id 全为原生 32 位十六进制');
  else bad(badId + ' 条 _id 格式不对');
  if (!badName) ok('项目名与预期一致');
  else bad(badName + ' 条项目名不符');
  if (!badRole) ok('role ≤20 字（对齐表单 maxlength）');
  else bad(badRole + ' 条 role 超长');
  if (!badDev) ok('devices ≤60 字');
  else bad(badDev + ' 条 devices 超长');
  if (!badTags) ok('tags ≤60 字');
  else bad(badTags + ' 条 tags 超长');
  if (!badContent) ok('content 非空且 ≥3 段（多段落完整收录）');
  else bad(badContent + ' 条 content 段落不足');
  if (!badDate) ok('startDate / endDate 均为 YYYY-MM-DD');
  else bad(badDate + ' 条日期格式不对');
}

console.log('');
console.log('══ 4. 包体无凭据残留 ══');
{
  /* 4a. 笔记里的真实凭据 —— 任何地方都不能出现。
        这些是作者环境里的真密码 / 真 IP，包体人人可下载，出现在包里等于公开。 */
  const noteSecrets = ['__SECRET_1__', '__SNMP_RO__', '__SNMP_RW__', '__TELNET_USER_PASS__',
    '__LOG_HOST__', '__TRAP_HOST__', '__SNMP_RO2__'];
  /* 4b. 管理口令 —— 只允许出现在 admin.js 本身（那是它该在的地方）。 */
  const adminSecret = '__ADMIN_PASS__';

  const hits = [];
  const adminHits = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/\.(js|wxml|wxss|json)$/.test(e.name)) return;
      const s = fs.readFileSync(p, 'utf8');
      const rel = path.relative(REPO, p);
      noteSecrets.forEach(sec => { if (s.indexOf(sec) >= 0) hits.push(rel + ' ← ' + sec); });
      if (s.indexOf(adminSecret) >= 0) {
        if (/subpkg-tool[\\/]pages[\\/]admin[\\/]admin\.js$/.test(rel)) adminHits.push(rel);
        else hits.push(rel + ' ← 管理口令泄漏到非预期位置');
      }
    });
  };
  walk(path.join(REPO, 'miniprogram'));

  if (!hits.length) ok('笔记凭据（SNMP 团体名 / 密码 / 真实 IP）包体内零命中');
  else bad('包体内命中 ' + hits.length + ' 处：\n      ' + hits.join('\n      '));

  if (adminHits.length === 1) ok('管理口令仅存在于 admin.js 本体（真正的写权限由云函数白名单兜底）');
  else bad('管理口令出现位置异常：' + adminHits.length + ' 处');
}

console.log('');
console.log('══ 5. 其他集合未被污染 ══');
['extra_items', 'content_patch', 'contributions'].forEach(c => {
  const rows = query(c, {}, 1);
  if (!rows.length) ok(c + ' 为空（未被污染）');
  else bad(c + ' 有 ' + rows.length + ' 条记录');
});

console.log('');
console.log('════════════════════════════════');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('════════════════════════════════');
process.exit(fail ? 1 : 0);
