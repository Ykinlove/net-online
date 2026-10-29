const BATCH99_EXTRA = [
  {
    id: 'ac-deploy',
    devs: ['AC', 'Switch'],
    name: 'AC 组网（直连 / 旁挂 / 三层组网）',
    kw: ['ac组网', 'ac 组网', '旁挂', '直连组网', '三层组网', 'capwap隧道', '隧道转发', '直接转发', '无线组网', 'ap怎么找到ac'],
    cmds: [
      ['三种组网方式', '直连（二层）：AC 串在 AP 与核心之间，AP 和 AC 同二层\n旁挂（二层）：AC 挂在一旁，AP 的 CAPWAP 走二层广播找 AC\n三层组网：AP 与 AC 跨三层，靠 option 43 或 DNS 指定 AC 地址'],
      ['AC 侧关键配置', 'capwap source interface Vlanif100\nwlan\n ap auth-mode mac-auth\n ap-id 1 ap-mac xxxx-xxxx-xxxx'],
      ['AP 怎么找到 AC', '二层：AP 发 CAPWAP 广播，AC 收到后应答\n三层：DHCP option 43 带 AC 地址，或 DNS 解析 huawei.ac / wlan.ac\n都不通就在 AP 命令行里静态指定 AC 地址'],
      ['隧道转发还是直接转发', '隧道（tunnel）：业务流量绕到 AC，管理集中但 AC 成瓶颈\n直接（direct）：业务流量在 AP 本地出，AC 只管管理，大流量场景推荐']
    ],
    tip: '三层组网失败大多是 option 43 没配或格式写错。华为是十六进制子选项，H3C 是字符串，思科是十六进制 IP，三家写法完全不同。'
  },
];
module.exports = { BATCH99_EXTRA };
