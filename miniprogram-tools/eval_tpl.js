/* 模板搜索评测：64 个配置模板并入统一搜索后的排序质量。
 *
 * 跟 eval_rank（百科排序）分开，因为判定的目标不同：
 *   eval_rank  判「百科条目的 Top1 是不是期望那条」
 *   本文件    判「模板的 Top1 是不是期望那个模板」
 *
 * 模板只有 64 条，但每条都有明确的用户意图（配开局、配 NAT、配 ACL），
 * 一旦权重调错就会把 IPsec 顶到 NAT 前面——这类错误必须有护栏。
 *
 * 用法：node miniprogram-tools/eval_tpl.js [--verbose]
 */

const { searchTemplates } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const VERBOSE = process.argv.indexOf('--verbose') >= 0;

/* want 填模板 id 片段（大小写不敏感），多个用 | 分隔 */
const CASES = [
  { q: '开局', want: ['tpl-switch-base'] },
  { q: '新交换机开局', want: ['tpl-switch-base'] },
  { q: '静态路由', want: ['tpl-static-route'] },
  { q: '默认路由配置', want: ['tpl-static-route'] },
  { q: 'nat', want: ['tpl-nat'] },
  { q: 'nat上网', want: ['tpl-nat'] },
  { q: 'acl', want: ['tpl-acl-basic'] },
  { q: 'acl配置', want: ['tpl-acl-basic'] },
  { q: 'ospf', want: ['tpl-ospf-basic'] },
  { q: 'ospf单区域', want: ['tpl-ospf-basic'] },
  { q: 'vrrp', want: ['tpl-vrrp'] },
  { q: '双机热备', want: ['tpl-vrrp'] },
  { q: '端口限速', want: ['tpl-qos-limit'] },
  { q: 'dhcp中继', want: ['tpl-dhcp-relay'] },
  { q: 'dhcp地址池', want: ['tpl-dhcp-pool'] },
  { q: '链路聚合', want: ['tpl-eth-trunk'] },
  { q: '端口安全', want: ['tpl-port-sec'] },
  { q: 'stp', want: ['tpl-stp-edge'] },
  { q: '端口镜像', want: ['tpl-mirror'] },
  { q: '监控接入', want: ['tpl-monitor-full'] },
  { q: '割接回退', want: ['tpl-cutover-back'] },
  { q: '备份', want: ['tpl-backup'] },
  { q: '巡检', want: ['tpl-inspect'] },
  { q: 'ipv6', want: ['tpl-v6-dual'] },
  { q: '访客网络', want: ['tpl-proj-guest'] },
  { q: '访客wifi', want: ['tpl-proj-guest'] },
  { q: '堆叠', want: ['tpl-stack'] },
  { q: '双出口', want: ['tpl-dual-wan'] },
  { q: '802.1x', want: ['tpl-dot1x'] }
];

let pass = 0;
const fails = [];

CASES.forEach(function (c) {
  const r = searchTemplates(c.q) || [];
  const top = r[0] || {};
  const id = String(top.id || '').toLowerCase();
  const ok = c.want.some(function (w) { return id.indexOf(w.toLowerCase()) >= 0; });
  if (ok) {
    pass++;
    if (VERBOSE) console.log('✓ ' + c.q.padEnd(16) + ' → ' + top.name);
  } else {
    fails.push({ q: c.q, want: c.want, got: top.name, gotId: top.id, n: r.length });
  }
});

console.log('用例      ' + CASES.length + ' 条');
console.log('Top1 正确 ' + pass + ' (' + Math.round(pass * 100 / CASES.length) + '%)');
console.log('Top1 错误 ' + (CASES.length - pass) + ' 条');

if (fails.length) {
  console.log('');
  console.log('---- 失败明细 ----');
  fails.forEach(function (f) {
    console.log('  ' + f.q.padEnd(16) + ' 期望 ' + f.want.join('|'));
    console.log('  ' + ''.padEnd(16) + ' 实际 ' + f.got + '   [' + f.gotId + '] 共' + f.n + '条');
  });
}
