/**
 * 内容缺口扫描：给一批方向词，看库里有多少条能对上。
 * 只报数量，不做排序判定——用来找「真没写」的方向，而不是「排得不好」。
 *
 *   node gap_scan.js            # 跑内置清单，只报弱覆盖
 *   node gap_scan.js -a         # 全部打印
 */
const { BOOK } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const TERMS = [
  /* 二层 / 三层 */
  'vlan', 'trunk', 'hybrid', 'stp', 'rstp', 'mstp', '链路聚合', 'lacp', '静态路由', 'ospf',
  'isis', 'bgp', 'rip', 'eigrp', '策略路由', '路由重分发', '路由过滤', 'bfd', 'vrrp', '堆叠', 'irf', 'm-lag',
  /* 地址与接入 */
  'dhcp', 'dhcp snooping', 'pppoe', 'nat', 'ipv6', 'ndp', 'slaac', 'dhcpv6', 'ipv6 过渡', '双栈',
  /* 无线 */
  'ssid', 'ac 组网', 'capwap', '漫游', '802.1x', 'portal 认证', 'wifi 6', 'wifi 7', '高密', '无线勘测', 'ap 供电',
  /* 安全 */
  'acl', '防火墙', '安全策略', 'ips', 'waf', '堡垒机', 'vpn', 'ipsec', 'ssl vpn', '零信任', '等保', '准入',
  /* 组播 / qos */
  '组播', 'igmp', 'pim', 'qos', '限速', '优先级', '队列', '拥塞',
  /* 数据中心 / 云 */
  'vxlan', 'evpn', 'vpc', 'cdn', '对象存储', '负载均衡', '容器网络', '混合云', '专线',
  /* 运维 */
  '巡检', '备份', '升级', '割接', '监控', '告警', '日志', 'snmp', 'netconf', 'telemetry', '自动化', 'ansible',
  /* 物理 / 工程 */
  '网线', '光纤', '光模块', '配线架', '机柜', 'ups', 'poe', '接地', '标签', '走线',
  /* 场景 */
  '监控', '无线覆盖', '视频会议', '语音', '门禁', '机房', '园区', '分支', '酒店', '医院', '学校', '工厂',
  /* 终端排障 */
  '上不了网', '网速慢', 'dns', 'ip 冲突', '掉线', '丢包', '时延', '抖动',
  /* 职业 / 流程 */
  '面试', '认证', '方案', '投标', '验收', '变更', '应急', '值班', '文档'
];

const ALL = process.argv.includes('-a');

const stat = [];
TERMS.forEach(function (t) {
  const lw = t.toLowerCase();
  const n = BOOK.filter(function (it) {
    return (it.name || '').toLowerCase().indexOf(lw) >= 0 ||
      (it.kw || []).some(function (k) { return k.toLowerCase().indexOf(lw) >= 0; });
  }).length;
  stat.push({ t: t, n: n });
});

stat.sort(function (a, b) { return a.n - b.n; });

console.log('方向词 ' + stat.length + ' 个');
console.log('');
const weak = stat.filter(function (x) { return x.n <= 2; });
console.log('弱覆盖（≤2 条） ' + weak.length + ' 个：');
weak.forEach(function (x) { console.log('  ' + x.t.padEnd(14) + x.n + ' 条'); });

if (ALL) {
  console.log('');
  console.log('全部：');
  stat.forEach(function (x) { console.log('  ' + x.t.padEnd(14) + x.n); });
}
