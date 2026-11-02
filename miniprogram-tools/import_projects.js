// 把两个项目导入到指定作者的「项目记录」（projects 集合）
//
// 为什么落在 projects 集合：
//   projects 集合 ACL = PRIVATE，客户端只能读到「自己 _openid 的行」，
//   天然做到「只有这两个人能看到，其他人打开仍是空项目列表」。
//   （与 import_note_commands.js 同一套隔离机制）
//
// 幂等：每条记录带 src + key 标记，重跑不会重复插入。
// 用法：node miniprogram-tools/import_projects.js [--dry-run] [--rebuild]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const localcfg = require('./local_config.js');

const ENV_ID = 'net-online-d7g1ig4c6f07a8abb';
const COLL = 'projects';
const SRC = 'resume-2026-projects';
const DATE = '2026-11-02';

/* 目标作者：昵称 → openid。
   openid **不入库**（仓库要推远端），从本地私密配置读：
     cloudbaserc.local.json 的 adminOpenids / authors，或环境变量 ADMIN_OPENIDS。 */
const TARGETS = localcfg.targets();
if (!TARGETS.length) {
  console.error('✗ 没有读到目标作者。\n' + localcfg.missingHint());
  process.exit(1);
}

/* 两个项目。
   字段口径对齐小程序项目表单（pages/projects/projects.js saveForm）：
     date / startDate / endDate / name / status / role / content / devices / cmds / tags / skill
   约束：name ≤40 字、role ≤20 字、devices ≤60 字、tags ≤60 字（对齐表单 maxlength，
   日后手动编辑时不会被截断）；content 无长度限制（textarea）。 */
const PROJECTS = [
  {
    key: 'lantian-pon',
    name: '兰天公寓一期PON光网建设项目',
    status: '已完成',
    role: '负责人（甲方）',
    startDate: '2026-08-01',
    endDate: '2026-10-31',
    devices: '华为iMaster NeoSight、EA5800-X7 OLT、ONU（929台）、Bras、瘦AP',
    tags: 'PON,OLT,ONU,光衰,链路聚合,SNMP,NETCONF',
    content: [
      '基于华为iMaster NeoSight平台管控EA5800-X7 OLT及929台ONU，负责配置校验、故障分析与整改督办，保障公寓宽带业务交付，完成Bras与OLT间链路聚合配置校验及端口规划等。',
      '确保OLT SNMP/NETCONF通信、业务模板与零配置部署策略，确认ONU自动注册、批量业务下发。',
      '协助排查四十台ONU光衰、瘦AP配置问题、ONU台账SN重复等故障，依托网管链路诊断定位问题，督促施工整改，完成故障闭环；监测设备指标、输出健康报表，支撑项目验收。'
    ].join('\n')
  },
  {
    key: 'campus-wlan',
    name: '校园无线网络升级改造项目',
    status: '进行中',
    role: '负责人（甲方）',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    devices: '无线交换机（78台）、无线AP（2327台）、AC',
    tags: '无线,AP,AC,无线交换机,VLAN,批量配置',
    content: [
      '参与校园无线网络改造项目，新增部署78台无线交换机、2327台无线AP，负责其中部分设备的脚本配置、现场调测及AP上线管控。编写无线交换机批量配置脚本，完成VLAN、管理地址及业务参数标准化配置，提升部分设备上线效率。',
      '负责所承接无线交换机的现场调测、链路连通性验证及版本核对，确保设备稳定接入网络。',
      '完成对应AP在AC上的序列号录入、注册上线、分组管理及频道模式配置，优化无线覆盖效果。',
      '配合开展AP上线后连通性测试、信号覆盖验证及故障排查，保障所负责区域网络交付质量。'
    ].join('\n')
  }
];

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

/* 跑一条 nosql 兼容层命令，返回解析后的 JSON */
function nosql(cmdObj) {
  const payload = JSON.stringify([{
    TableName: COLL,
    CommandType: cmdObj.type,
    Command: JSON.stringify(cmdObj.command)
  }]);
  let out;
  try {
    out = execFileSync(
      TCB.cmd,
      TCB.prefix.concat(['db', 'nosql', 'execute', '--command', payload, '--json']),
      { cwd: REPO, stdio: 'pipe', timeout: 180000, encoding: 'utf8' }
    );
  } catch (e) {
    const detail = String((e && e.stderr) || (e && e.message) || e).slice(0, 600);
    throw new Error('nosql ' + cmdObj.type + ' 失败：' + detail);
  }
  try {
    return JSON.parse(out);
  } catch (e) {
    throw new Error('nosql ' + cmdObj.type + ' 返回非 JSON：' + String(out).slice(0, 400));
  }
}

function findAll(filter, limit) {
  const r = nosql({
    type: 'COMMAND',
    command: { find: COLL, filter: filter || {}, limit: limit || 500 }
  });
  const res = (r && r.data && r.data.results) || [];
  return Array.isArray(res[0]) ? res[0] : [];
}

function insertDocs(docs) {
  const r = nosql({
    type: 'INSERT',
    command: { insert: COLL, documents: docs }
  });
  const res = (r && r.data && r.data.results) || [];
  return Array.isArray(res[0]) ? res[0] : res;
}

/* 删除一批文档。
   兼容层 deletes[].limit 只能取 0 或 1，所以按「过滤 + limit 1」循环删。
   _id 两种形态都要兼容：原生 32 位十六进制字符串，以及早期 {$oid:...} ObjectId。 */
function deleteWhere(filter) {
  let n = 0;
  for (let i = 0; i < 500; i++) {
    const rows = findAll(filter, 1);
    if (!rows.length) break;
    const raw = rows[0]._id;
    const idKey = (raw && typeof raw === 'object' && raw.$oid)
      ? { $oid: raw.$oid }
      : raw;
    nosql({
      type: 'DELETE',
      command: { delete: COLL, deletes: [{ q: { _id: idKey }, limit: 1 }] }
    });
    n++;
  }
  return n;
}

/* 原生 CloudBase 的 _id 是 32 位十六进制字符串，兼容层自生成的是 24 位 ObjectId，
   两者不一致会让客户端 .doc(id) 更新/删除出问题 —— 显式指定原生格式。 */
function newId() {
  return crypto.randomBytes(16).toString('hex');
}

/* ---------------- 主流程 ---------------- */
function main() {
  const dry = process.argv.indexOf('--dry-run') >= 0;
  const rebuild = process.argv.indexOf('--rebuild') >= 0;

  console.log('目标集合：' + COLL + '（ACL = PRIVATE，按 _openid 隔离）');
  console.log('目标作者：' + TARGETS.map(t => t.nickname).join(' / '));
  console.log('项目条数：' + PROJECTS.length + ' 个 × ' + TARGETS.length + ' 位作者 = ' +
    (PROJECTS.length * TARGETS.length) + ' 条');
  console.log('');

  /* --rebuild：先清掉同源旧记录，再重灌 */
  if (rebuild && !dry) {
    const n = deleteWhere({ src: SRC });
    console.log('--rebuild：已清除同源旧记录 ' + n + ' 条。');
  }

  /* 幂等：查已存在的 src 记录 */
  const existing = findAll({ src: SRC }, 500);
  const seen = new Set(existing.map(d => d._openid + '|' + d.key));
  console.log('已存在同源记录 ' + existing.length + ' 条，跳过已存在的。');

  const now = Date.now();
  const pending = [];
  for (const t of TARGETS) {
    for (const p of PROJECTS) {
      const k = t.openid + '|' + p.key;
      if (seen.has(k)) continue;
      pending.push({
        _id: newId(),
        date: p.startDate,
        startDate: p.startDate,
        endDate: p.endDate,
        name: p.name,
        status: p.status,
        role: p.role,
        content: p.content,
        devices: p.devices,
        cmds: '',
        tags: p.tags,
        skill: '',
        src: SRC,
        key: p.key,
        _openid: t.openid,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (dry) {
    console.log('dry-run：待插入 ' + pending.length + ' 条（未写库）。');
    pending.forEach(d => {
      console.log('  → [' + d._openid.slice(0, 10) + '…] ' + d.startDate + '~' + d.endDate +
        ' | ' + d.status + ' | ' + d.name + '（' + d.role + '）');
      console.log('     段落数 ' + d.content.split('\n').length + '，正文字数 ' + d.content.length);
    });
    return;
  }

  if (!pending.length) {
    console.log('没有新记录，跳过写入。');
  } else {
    const CHUNK = 12;
    let done = 0;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const slice = pending.slice(i, i + CHUNK);
      insertDocs(slice);
      done += slice.length;
      console.log('  已插入 ' + done + ' / ' + pending.length);
    }
  }

  /* 回读校验 */
  console.log('');
  const after = findAll({ src: SRC }, 500);
  const byOpenid = {};
  after.forEach(d => { byOpenid[d._openid] = (byOpenid[d._openid] || 0) + 1; });
  console.log('回读校验：');
  TARGETS.forEach(t => {
    console.log('  ' + t.nickname + ' (' + t.openid + ') → ' + (byOpenid[t.openid] || 0) + ' 条');
  });
  const others = Object.keys(byOpenid).filter(o => !TARGETS.some(t => t.openid === o));
  console.log('  其他 openid 的记录：' + (others.length ? others.length + ' 个（异常！）' : '0 个 ✓'));

  const total = findAll({}, 500);
  const totalByOpenid = {};
  total.forEach(d => { totalByOpenid[d._openid] = (totalByOpenid[d._openid] || 0) + 1; });
  console.log('');
  console.log('projects 集合全量分布（共 ' + total.length + ' 条）：');
  Object.keys(totalByOpenid).forEach(o => {
    const who = TARGETS.filter(t => t.openid === o).map(t => t.nickname)[0] || '（其他用户）';
    console.log('  ' + who + ' → ' + totalByOpenid[o] + ' 条');
  });
}

main();
