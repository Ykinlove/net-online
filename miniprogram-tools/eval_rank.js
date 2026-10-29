/**
 * 排序专用评测：只看「Top1 是不是用户真要的那条」。
 *
 * 与 eval_search.js 的区别：
 *   eval_search.js 判定「名称里包含 want 里任意一个词」，宽，测的是「搜得到」。
 *   本文件判定「Top1 的 id 落在期望集合里」，严，测的是「排得对」。
 *
 * 用例来源：上一轮 47 条高频说法探针里 Top1 跑偏的那些（先看到问题、后写期望，
 * 不是先写期望再调代码）。每条都先反查过库里确实有对应条目。
 *
 *   node eval_rank.js           # 汇总 + 只列失败
 *   node eval_rank.js -v        # 连通过的一起列
 */
const { search } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const CASES = [
  /* ---------- 查看类：用户打「查/看/查看」，Top1 应该是查看命令 ---------- */
  { q: '查arp', want: ['arp-table'] },
  { q: '查看arp表', want: ['arp-table'] },
  { q: '查mac地址表', want: ['mac-show'] },
  { q: '查看mac地址表', want: ['mac-show'] },
  { q: '查路由表', want: ['route-show'] },
  { q: '查看接口状态', want: ['if-brief'] },
  { q: '查看版本', want: ['version'] },
  { q: '查看cpu占用', want: ['cpu-mem', 'cpu-task'] },
  { q: '查看内存', want: ['cpu-mem', 'mem-leak'] },
  { q: '查看光衰', want: ['opt-power', 'fld-optical'] },
  { q: '查看某vlan下有哪些端口', want: ['vlan-ports'] },

  /* ---------- 配置类：用户打「配/配置/改」，Top1 应该是配置命令 ---------- */
  { q: '配telnet', want: ['ssh'] },
  { q: '配ssh', want: ['ssh'] },
  { q: '划分vlan', want: ['vlan-port-access', 'pr-vlan-deploy'] },
  { q: 'access口配置', want: ['port-link-type', 'pr-vlan-deploy'] },
  { q: 'bfd配置', want: ['bfd'] },
  { q: '配bfd', want: ['bfd'] },
  { q: '漫游配置', want: ['wlan-roam'] },
  { q: '改设备名字', want: ['sysname'] },
  { q: '配管理ip', want: ['pr-mgmt-ip'] },
  { q: '配置ntp', want: ['ntp', 'ntp-sync'] },
  { q: '配置端口隔离', want: ['port-isolate', 'pr-port-isolate', 'l2-port-isolate-uplink'] },
  { q: '关闭不用的端口', want: ['port-shutdown'] },
  { q: '屏蔽某个端口', want: ['port-shutdown'] },
  { q: '配acl', want: ['acl', 'pr-acl-deploy'] },
  { q: '改wifi密码', want: ['wlan-ssid', 'soho-router'] },
  { q: '配置ssid', want: ['wlan-ssid'] },
  { q: '批量划vlan', want: ['vlan-port-batch'] },

  /* ---------- 排障类：用户描述故障，Top1 应该是对症的排查条 ---------- */
  { q: '端口不亮', want: ['tb-port-down'] },
  { q: 'bgp邻居起不来', want: ['l3-bgp-neighbor-state'] },
  { q: '防arp攻击', want: ['arp-inspection'] },
  { q: '摄像头不显示', want: ['other-camera', 'surveillance'] },
  { q: '网络卡顿', want: ['pr-diag-slow'] },
  { q: 'acl不生效', want: ['pr-ops-aclmiss'] },
  { q: '时间不同步', want: ['ntp-trouble', 'ntp-status', 'tb-clock-auth'] },

  /* ---------- 选型类 ---------- */
  { q: '交换机怎么选', want: ['buy-switch'] },
  { q: '超融合', want: ['buy-hci'] },

  /* ---------- 回归护栏：这些本来就对，改排序不能把它们弄坏 ---------- */
  { q: '怎么划分vlan', want: ['vlan-port-access', 'pr-vlan-deploy'] },
  { q: '配个trunk', want: ['trunk', 'port-link-type'] },
  { q: '配个静态路由', want: ['route-static', 'pr-static-deploy'] },
  { q: '跑ospf', want: ['ospf'] },
  { q: '做个nat', want: ['nat'] },
  { q: '怎么备份配置', want: ['config-backup'] },
  { q: '交换机怎么恢复出厂', want: ['factory-reset'] },
  { q: '限制网速', want: ['port-rate-limit'] },
  { q: 'ap怎么上线', want: ['vm-ap-onboard'] },
  { q: '配置防火墙策略', want: ['fw-policy'] },
  { q: '改设备密码', want: ['pwd-policy'] },
  { q: '配置qos', want: ['qos-trust'] },
  { q: '配置流控', want: ['vm-port-negotiation'] },
  { q: '配dhcp', want: ['dhcp-server'] },
  { q: '配vrrp', want: ['vrrp'] },
  { q: '配堆叠', want: ['stack', 'irf'] },

  /* ---------- 长句口语：用户原话整句丢进来，不能被切碎后随便找一条 ---------- */
  { q: 'console口密码忘了，远程可以登录，如何修改console口密码', want: ['console-password'] },
  { q: '交换机密码忘了', want: ['pwd-recovery'] },
  { q: '配置丢了', want: ['emg-backup-restore'] }
];

const VERBOSE = process.argv.includes('-v');
let pass = 0;
const fails = [];

CASES.forEach(function (c) {
  const r = search(c.q) || [];
  const top = r[0] || {};
  const ok = c.want.indexOf(top.id) >= 0;
  if (ok) {
    pass++;
    if (VERBOSE) console.log('✓ ' + c.q.padEnd(20) + ' → ' + top.name);
  } else {
    fails.push({ q: c.q, want: c.want, got: top.name, gotId: top.id, n: r.length });
  }
});

if (VERBOSE) console.log('');
console.log('用例      ' + CASES.length + ' 条');
console.log('Top1 正确 ' + pass + ' (' + Math.round(pass * 100 / CASES.length) + '%)');
console.log('Top1 错误 ' + (CASES.length - pass) + ' 条');

if (fails.length) {
  console.log('');
  console.log('---- 失败明细 ----');
  fails.forEach(function (f) {
    console.log('  ' + f.q.padEnd(20) + ' 期望 ' + f.want.join('|'));
    console.log('  ' + ''.padEnd(20) + ' 实际 ' + f.got + '   [' + f.gotId + '] 共' + f.n + '条');
  });
}
