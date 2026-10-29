/**
 * 探针：把一批「真实会输入的说法」丢进搜索，看前三条能不能命中。
 * 用来判断内容「有没有」和排序「对不对」，两件事分开看。
 *
 *   node probe.js                 # 跑内置清单
 *   node probe.js "怎么查mac" "光衰"  # 跑指定词
 */
const { BOOK, search } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const QUERIES = [
  // ── 开局与基础
  '开局配置', '恢复出厂', '保存配置', '改设备名字', '配管理IP', '配telnet', '配ssh',
  // ── VLAN / 二层
  '划分vlan', 'trunk怎么配', 'access口配置', 'vlan间互通', '端口隔离', '链路聚合', '生成树',
  // ── 三层与路由
  '静态路由', 'ospf配置', 'bgp邻居起不来', '策略路由', '默认路由', '路由重分发',
  // ── 地址服务
  'dhcp配置', 'dhcp中继', 'dhcp地址池', 'dns配置', 'nat配置', 'nat回流',
  // ── 可靠性
  'vrrp配置', '双机热备', 'bfd配置', '堆叠配置', '链路备份',
  // ── 无线
  'ap上线', 'wifi密码怎么改', '无线信号弱', '漫游配置', '隐藏ssid',
  // ── 安全
  'acl配置', '防火墙策略', '端口安全', 'ip-mac绑定', '防arp攻击', '关闭不用的端口',
  // ── 运维排障
  '查mac地址表', '查arp', '查看接口状态', '查看光衰', '查看cpu占用', '查看版本',
  '查路由表', '抓包', 'ping不通怎么查', '端口不亮', '网络很卡', '丢包怎么查',
  // ── 其他设备
  '交换机怎么选', '光模块选型', 'console连不上', '超融合',
  // ── 非网络工程师也会问的
  '上不了网', '网速慢', '打印机连不上', '摄像头不显示'
];

const list = process.argv.slice(2).length ? process.argv.slice(2) : QUERIES;

const norm = function (s) { return String(s || '').replace(/\s+/g, ''); };

let hit1 = 0, hit3 = 0, zero = 0;
const weak = [];

list.forEach(function (q) {
  const r = search(q) || [];
  if (!r.length) {
    zero++;
    weak.push(['✗ 无结果', q, '']);
    console.log('✗ 无结果     ' + q);
    return;
  }
  const top = r[0];
  const name = top.name || top.it && top.it.name || '';
  console.log('· ' + q.padEnd(16) + ' → ' + name + '   [' + r.length + ' 条]');
  if (r.length > 1) {
    console.log('    ' + r.slice(1, 3).map(function (x) { return x.name || ''; }).join('  /  '));
  }
  /* 命中判定：把查询里的纯动作词摘掉，剩下的主题词只要有一个出现在
     Top1（名称 + 别名 + 正文）里就算命中。
     早先是「查询的每个字都要出现」，结果「bfd配置 → BFD 快速检测」这种
     正确答案被判成未命中——动作词本来就不该在条目名称里。 */
  const ACT = ['配置', '设置', '查看', '查询', '怎么', '如何', '怎样', '一下', '看看',
    '排查', '排障', '怎么配', '改', '配', '查', '看', '的', '了', '吗', '呢'];
  let q2 = String(q).toLowerCase();
  ACT.forEach(function (w) { q2 = q2.split(w).join(' '); });
  const toks = q2.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(function (t) { return t.length >= 2; });
  const blob = norm((top.name || '') + (top.kw || []).join('') +
    (top.cmds || []).map(function (c) { return c.code || ''; }).join('')).toLowerCase();
  const ok = toks.length ? toks.some(function (t) { return blob.indexOf(t) >= 0; }) : true;
  if (ok) { hit1++; } else { weak.push(['? Top1 未正面命中', q, name]); }
  if (r.length >= 3) hit3++;
});

console.log('');
console.log('---- 汇总 ----');
console.log('探针      ' + list.length + ' 条');
console.log('有结果    ' + (list.length - zero) + ' 条');
console.log('无结果    ' + zero + ' 条');
console.log('Top1 正面命中 ' + hit1 + ' 条');
if (weak.length) {
  console.log('');
  console.log('---- 需要看的地方 ----');
  weak.forEach(function (w) { console.log('  ' + w[0] + '  ' + w[1] + (w[2] ? '  →  ' + w[2] : '')); });
}
