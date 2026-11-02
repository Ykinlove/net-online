// 把「有道云笔记」里的命令导入到指定作者的「我的命令」（commands 集合）
//
// 为什么落在 commands 集合而不是 extra_items（命令百科）：
//   commands    集合 ACL = PRIVATE，客户端只能读到「自己 _openid 的行」，
//               天然做到「只有这两个人能看到，其他人打开仍是空命令状态」；
//   extra_items 集合 ACL = READONLY（全员可读），放进去等于公开泄露。
//
// 所以本方案零代码改动、零泄露面：不需要给 listContent 加白名单逻辑，
// 也不需要把这些命令打进包体（包体是所有用户都能下载的）。
//
// 幂等：每条记录带 src + key 标记，重跑不会重复插入。
// 用法：node miniprogram-tools/import_note_commands.js [--dry-run]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ENV_ID = 'net-online-d7g1ig4c6f07a8abb';
const COLL = 'commands';
const SRC = 'youdao-note-8AgaX8cm';
const DATE = '2026-11-02';

/* 目标作者：昵称 → openid（来自 profiles 集合）
   这两位正是云函数里的 ADMIN_OPENIDS。 */
const TARGETS = [
  { nickname: 'Yang', openid: '__OPENID_A__' },
  { nickname: 'Ykin', openid: '__OPENID_B__' }
];

/* 笔记里的命令。device 取 seed.js 的 DEVICES 英文 key。
   title ≤ 40 字、desc ≤ 60 字（对齐小程序表单的 maxlength，改编时不会被截断）。 */
const COMMANDS = [
  /* ---------------- Windows ---------------- */
  {
    key: 'w-ipconfig', device: 'Windows', title: '释放/更新IP地址',
    lines: ['ipconfig /release', 'ipconfig /renew'],
    desc: 'release 释放 IP，renew 重新获取 IP 地址',
    tags: 'Windows,ipconfig,IP地址'
  },
  {
    key: 'w-route', device: 'Windows', title: 'Windows查看/添加路由',
    lines: ['route print', 'route add 目标网段 mask 子网掩码 下一跳 -p'],
    desc: '命令行查路由表；添加路由，-p 表示永久生效',
    tags: 'Windows,route,路由'
  },

  /* ---------------- Switch（华三 H3C） ---------------- */
  {
    key: 's-portswitch', device: 'Switch', title: '接口二层变三层',
    lines: ['undo portswitch', 'portswitch'],
    desc: 'undo portswitch 二层转三层；portswitch 反之转回二层',
    tags: 'H3C,portswitch,接口'
  },
  {
    key: 's-clear-int', device: 'Switch', title: '清空接口配置',
    lines: ['clear configuration interface [接口类型 编号]'],
    desc: '清空指定接口上的配置',
    tags: 'H3C,接口,清配置'
  },
  {
    key: 's-reset-saved', device: 'Switch', title: '清空交换机配置并重启',
    lines: ['reset saved-configuration <main | backup>', 'reboot'],
    desc: '清交换机配置；reboot 时是否保存当前配置选 n，重启确认选 Y',
    tags: 'H3C,重置,重启'
  },
  {
    key: 's-history', device: 'Switch', title: '查看用户历史命令',
    lines: ['display history-command all'],
    desc: '查看设备上执行过的历史命令',
    tags: 'H3C,历史命令,排障'
  },
  {
    key: 's-lldp', device: 'Switch', title: '查看LLDP邻居及详细信息',
    lines: [
      'display lldp neighbor-information list',
      'display lldp neighbor brief',
      'display lldp neighbor-information interface GigabitEthernet 1/0/21 verbose'
    ],
    desc: '华三查看LLDP邻居；简写 dis ll ne b',
    tags: 'H3C,LLDP,邻居'
  },
  {
    key: 's-transceiver', device: 'Switch', title: '查看光衰',
    lines: [
      'display transceiver diagnosis interface',
      'display transceiver diagnosis interface [接口类型 编号]',
      'display transceiver interface XGigabitEthernet 1/5/0/23 verbose'
    ],
    desc: '华三测光衰命令；简写 dis tr di int',
    tags: 'H3C,光衰,transceiver'
  },
  {
    key: 's-port-isolate-group', device: 'Switch', title: '查看端口隔离组',
    lines: ['display port-isolate group'],
    desc: '查看端口组；配置端口隔离后用 display port-isolate group all',
    tags: 'H3C,端口隔离'
  },
  {
    key: 's-vlan-port', device: 'Switch', title: '查看VLAN端口配置',
    lines: ['display port vlan active', 'display port vlan'],
    desc: '查看端口的 VLAN 配置',
    tags: 'H3C,VLAN,端口'
  },
  {
    key: 's-cur-int', device: 'Switch', title: '快速查看接口配置',
    lines: ['dis cur int g0/0/1'],
    desc: '快速查看指定接口的当前配置',
    tags: 'H3C,接口,当前配置'
  },
  {
    key: 's-reset-counters', device: 'Switch', title: '重置接口流量统计信息',
    lines: ['reset counters interface [接口类型 编号]'],
    desc: '清零接口的流量统计计数',
    tags: 'H3C,接口,流量统计'
  },
  {
    key: 's-link-agg', device: 'Switch', title: '查看聚合口及成员状态',
    lines: ['display link-aggregation verbose Bridge-Aggregation'],
    desc: '查看链路聚合口及成员口状态',
    tags: 'H3C,链路聚合,聚合口'
  },
  {
    key: 's-clock', device: 'Switch', title: '设置时间与时区同步',
    lines: [
      'clock protocol none',
      'clock datetime 15:24:30 2026/5/13',
      'clock protocol ntp'
    ],
    desc: '系统模式下关/开 NTP，手动设置时间需在用户模式下执行',
    tags: 'H3C,NTP,时间,时钟'
  },
  {
    key: 's-syslog', device: 'Switch', title: '配置Syslog日志采集',
    lines: [
      'info-center timestamp loghost iso with-timezone',
      'info-center loghost __LOG_HOST__ facility local6'
    ],
    desc: '配置 syslog 上报到日志服务器，带时间戳和时区',
    tags: 'H3C,Syslog,日志'
  },
  {
    key: 's-port-isolate', device: 'Switch', title: '配置端口隔离',
    lines: [
      'port-isolate group 1',
      'interface range GigabitEthernet 1/0/1 to GigabitEthernet 1/0/24',
      'port access vlan 10',
      'port-isolate enable group 1',
      'stp edged-port',
      'arp rate-limit 20'
    ],
    desc: '批量配置端口隔离；查看端口组用 display port-isolate group all',
    tags: 'H3C,端口隔离,安全'
  },
  {
    key: 's-local-user-ssh', device: 'Switch', title: '配置远程登录用户（SSH）',
    lines: [
      'local-user ruijie class manage',
      'password simple __LOCAL_USER_PASS__',
      'service-type ssh http https',
      'authorization-attribute user-role level-1',
      'authorization-attribute user-role network-operator'
    ],
    desc: '创建管理类远程用户，指定密码与服务类型并授权角色',
    tags: 'H3C,SSH,远程登录,账号'
  },
  {
    key: 's-local-user-telnet', device: 'Switch', title: '配置Telnet远程登录',
    lines: [
      'local-user h3c',
      'password simple __TELNET_USER_PASS__',
      'authorization-attribute level 3',
      'service-type telnet',
      'user-interface vty 0 15',
      'authentication-mode scheme'
    ],
    desc: '创建 telnet 远程用户并配置 VTY 线路',
    tags: 'H3C,Telnet,远程登录,账号'
  },
  {
    key: 's-mac-flapping', device: 'Switch', title: '查看MAC地址漂移',
    lines: ['display mac-address flapping record'],
    desc: '查看 MAC 地址漂移记录（多半是环路）',
    tags: 'H3C,MAC,漂移,排障'
  },
  {
    key: 's-dhcp-alloc', device: 'Switch', title: '模拟终端获取IP地址',
    lines: [
      'interface Vlan-interface 10',
      'ip address dhcp-alloc',
      'display ip interface brief'
    ],
    desc: '进入 Vlan-interface 10 用 dhcp-alloc 取址',
    tags: 'H3C,DHCP,VLAN'
  },
  {
    key: 's-snmp-ro', device: 'Switch', title: '配置SNMP（只读团体名）',
    lines: [
      'snmp-agent',
      'snmp-agent community read __SNMP_RO__',
      'snmp-agent community read __SNMP_RO2__',
      'snmp-agent sys-info version all'
    ],
    desc: '开启 SNMP 代理，配置只读团体名与版本',
    tags: 'H3C,SNMP,监控'
  },
  {
    key: 's-snmp-rw-trap', device: 'Switch', title: '配置SNMP（读写团体名与Trap）',
    lines: [
      'snmp-agent',
      'snmp-agent local-engineid 383030303633413236353133373033443135363539364630',
      'snmp-agent community read __SNMP_RO__',
      'snmp-agent community write __SNMP_RW__',
      'snmp-agent sys-info version all',
      'snmp-agent target-host trap address udp-domain __TRAP_HOST__ params securityname __SNMP_RO__ v2c',
      'snmp-agent trap enable default-route'
    ],
    desc: '读写团体名 + Trap 上报；local-engineid 可不配置，设备会自动生成',
    tags: 'H3C,SNMP,Trap,监控'
  },

  /* ---------------- AC ---------------- */
  {
    key: 'a-ap-group', device: 'AC', title: '查看AP组及AP信息',
    lines: ['display wlan ap-group brief', 'dis wlan ap all'],
    desc: '查看 AP 组与全部 AP 信息',
    tags: 'AC,WLAN,AP'
  },
  {
    key: 'a-enter-ap', device: 'AC', title: '进入AP组/指定AP',
    lines: ['wlan ap-group <name>', 'wlan ap <name>', 'display wlan ap all | include <SN>'],
    desc: '进入 AP 组或指定 AP；用 include 按 SN 过滤查询',
    tags: 'AC,WLAN,AP'
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

/* MongoDB 兼容层的 find：取 results[0] */
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
   MongoDB 兼容层的 deletes[].limit 只能取 0 或 1（取 N 会报 FailedToParse），
   所以按「过滤条件 + limit 1」循环删，直到删不动为止。
   _id 两种形态都要兼容：原生 32 位十六进制字符串（当前），
   以及早期兼容层自生成的 {$oid:...} ObjectId。 */
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

/* 原生 CloudBase 的 _id 是 32 位十六进制字符串（如 b58957626adc846400214dc73ff1faee）。
   兼容层若自己生成，是 24 位 Mongo ObjectId（{$oid:...}），与集合里既有记录格式不一致，
   客户端 .doc(id) 更新/删除时可能出岔子 —— 所以这里显式指定原生格式。 */
function newId() {
  return crypto.randomBytes(16).toString('hex');
}

/* ---------------- 主流程 ---------------- */
function main() {
  const dry = process.argv.indexOf('--dry-run') >= 0;
  const rebuild = process.argv.indexOf('--rebuild') >= 0;

  console.log('来源：有道云笔记 share.note.youdao.com/s/8AgaX8cm');
  console.log('目标集合：' + COLL + '（ACL = PRIVATE，按 _openid 隔离）');
  console.log('目标作者：' + TARGETS.map(t => t.nickname).join(' / '));
  console.log('命令条数：' + COMMANDS.length + ' 条 × ' + TARGETS.length + ' 位作者 = ' +
    (COMMANDS.length * TARGETS.length) + ' 条');
  console.log('');

  /* --rebuild：先清掉同源旧记录（用于修正 _id 格式），再重灌 */
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
    for (const c of COMMANDS) {
      const k = t.openid + '|' + c.key;
      if (seen.has(k)) continue;
      pending.push({
        _id: newId(),
        title: c.title,
        content: c.lines.join('\n'),
        desc: c.desc,
        tags: c.tags,
        skill: '',
        device: c.device,
        date: DATE,
        src: SRC,
        key: c.key,
        _openid: t.openid,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (dry) {
    console.log('dry-run：待插入 ' + pending.length + ' 条（未写库）。');
    pending.slice(0, 3).forEach(d => {
      console.log('  示例 → [' + d._openid.slice(0, 10) + '…] ' + d.device + ' | ' + d.title);
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
  after.forEach(d => {
    byOpenid[d._openid] = (byOpenid[d._openid] || 0) + 1;
  });
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
  console.log('commands 集合全量分布（共 ' + total.length + ' 条）：');
  Object.keys(totalByOpenid).forEach(o => {
    const who = TARGETS.filter(t => t.openid === o).map(t => t.nickname)[0] || '（其他用户）';
    console.log('  ' + who + ' → ' + totalByOpenid[o] + ' 条');
  });
}

main();
