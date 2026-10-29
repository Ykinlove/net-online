// utils/cmdbook-mpls.js —— MPLS / VPN（LDP / L3VPN / VPLS / 跨域）
// 库里已有 MPLS L3VPN 基础，这里补 LDP 排查、跨域方案、VPLS、静态 LSP 和标签转发排障。
// 锐捷部分命令随版本差异较大，遇到不确定的地方在 tip 里点明。

const MPLS_EXTRA = [
  {
    id: 'mpls-ldp',
    devs: ['Router', 'Switch'],
    name: 'MPLS LDP 开启（标签分发）',
    kw: ['ldp', 'mpls ldp', '标签分发', 'mpls基础配置'],
    cmds: [
      ['华为', 'mpls lsr-id 1.1.1.1\nmpls\nmpls ldp\ninterface GigabitEthernet 0/0/1\n mpls\n mpls ldp'],
      ['思科', 'mpls label protocol ldp\nmpls ldp router-id Loopback0 force\ninterface GigabitEthernet0/1\n mpls ip'],
      ['H3C', 'mpls lsr-id 1.1.1.1\nmpls ldp\ninterface GigabitEthernet 1/0/1\n mpls enable\n mpls ldp enable'],
      ['锐捷', 'mpls label protocol ldp\nmpls ldp router-id Loopback0 force\ninterface GigabitEthernet 0/1\n mpls ip']
    ],
    tip: 'LDP 靠底层 IGP 的 loopback 路由建会话，所以先保证 loopback 互通再开 MPLS。lsr-id 必须全网唯一，写重了标签转发会莫名其妙错乱。锐捷没有全局的 mpls ip 这条，全局只有 mpls label protocol ldp 和 mpls ldp router-id，mpls ip 是在接口下开的——这点和思科一样，别在系统视图里敲。'
  },
  {
    id: 'mpls-ldp-neighbor',
    devs: ['Router', 'Switch'],
    name: 'LDP 邻居与标签绑定排查',
    kw: ['ldp邻居', 'ldp不通', '标签绑定', 'mpls邻居'],
    cmds: [
      ['华为', 'display mpls ldp peer\ndisplay mpls ldp lsp\ndisplay mpls lsp'],
      ['思科', 'show mpls ldp neighbor\nshow mpls ldp bindings\nshow mpls forwarding-table'],
      ['H3C', 'display mpls ldp peer\ndisplay mpls ldp lsp'],
      ['锐捷', 'show mpls ldp neighbor\nshow mpls ldp bindings']
    ],
    tip: 'LDP 会话起不来先查两样：UDP 646 能不能通、两端 lsr-id 有没有路由。会话起来了但没标签，就是该网段没在 IGP 里宣告，LDP 只给有路由的前缀分标签。'
  },
  {
    id: 'mpls-lfib',
    devs: ['Router', 'Switch'],
    name: '标签转发表查看（报文到底怎么走的）',
    kw: ['lfib', '标签转发表', 'mpls转发', 'ilm nhlfe'],
    cmds: [
      ['华为', 'display mpls lsp\ndisplay mpls lsp verbose\ndisplay mpls interface'],
      ['思科', 'show mpls forwarding-table\nshow mpls forwarding-table 10.1.1.0 24 detail\nshow mpls interfaces'],
      ['H3C', 'display mpls lsp\ndisplay mpls interface'],
      ['锐捷', 'show mpls forwarding-table\nshow mpls interfaces']
    ],
    tip: '入标签（In Label）和出标签（Out Label）对不上，或者出标签显示为 Pop，就是 PHP（倒数第二跳弹出）在起作用，正常。真正异常的是表项存在但出接口不对。'
  },
  {
    id: 'mpls-l3vpn-vrf',
    devs: ['Router'],
    name: 'L3VPN 的 VRF 与 RD/RT 完整配置',
    kw: ['l3vpn', 'vrf rd rt', 'vpn实例', 'mpls vpn配置'],
    cmds: [
      ['华为', 'ip vpn-instance vpn1\n ipv4-family\n  route-distinguisher 1:1\n  vpn-target 1:1 export-extcommunity\n  vpn-target 1:1 import-extcommunity\ninterface GigabitEthernet 0/0/1\n ip binding vpn-instance vpn1\n ip address 10.1.1.1 24'],
      ['思科', 'vrf definition vpn1\n rd 1:1\n address-family ipv4\n  route-target export 1:1\n  route-target import 1:1\ninterface GigabitEthernet0/1\n vrf forwarding vpn1\n ip address 10.1.1.1 255.255.255.0'],
      ['H3C', 'ip vpn-instance vpn1\n route-distinguisher 1:1\n vpn-target 1:1 import-extcommunity\n vpn-target 1:1 export-extcommunity\ninterface GigabitEthernet 1/0/1\n ip binding vpn-instance vpn1\n ip address 10.1.1.1 24'],
      ['锐捷', 'ip vrf vpn1\n rd 1:1\n route-target export 1:1\n route-target import 1:1\ninterface GigabitEthernet 0/1\n ip vrf forwarding vpn1\n ip address 10.1.1.1 255.255.255.0']
    ],
    tip: 'RD 只负责让不同客户的相同网段能共存（唯一化），RT 才决定路由往哪个 VRF 灌。两端 RT 对不上是 VPN 不通的头号原因——配完先在两边对一遍 RT，比查 BGP 快。'
  },
  {
    id: 'mpls-vpnv4',
    devs: ['Router'],
    name: 'MP-BGP VPNv4 邻居（PE 之间传 VPN 路由）',
    kw: ['vpnv4', 'mp-bgp', 'address-family vpnv4', 'pe邻居'],
    cmds: [
      ['华为', 'bgp 65001\n peer 2.2.2.2 as-number 65001\n peer 2.2.2.2 connect-interface LoopBack0\n ipv4-family vpnv4\n  peer 2.2.2.2 enable'],
      ['思科', 'router bgp 65001\n neighbor 2.2.2.2 remote-as 65001\n neighbor 2.2.2.2 update-source Loopback0\n address-family vpnv4\n  neighbor 2.2.2.2 activate\n  neighbor 2.2.2.2 send-community extended'],
      ['H3C', 'bgp 65001\n peer 2.2.2.2 as-number 65001\n peer 2.2.2.2 connect-interface LoopBack0\n address-family vpnv4\n  peer 2.2.2.2 enable'],
      ['锐捷', 'router bgp 65001\n neighbor 2.2.2.2 remote-as 65001\n neighbor 2.2.2.2 update-source Loopback0\n address-family vpnv4\n  neighbor 2.2.2.2 activate']
    ],
    tip: 'VPNv4 里 RT 是跟着扩展团体属性走的，进了 address-family vpnv4 就默认携带，不需要额外开 send-community。真正容易漏的是下一跳：RR 上不给客户端改 next-hop-local，客户端拿到的下一跳是不可达的对端 PE 地址，路由进了 BGP 表却不可用——表现和「没收到路由」一模一样，查的时候要先看 next hop 再看 RT。'
  },
  {
    id: 'mpls-pe-ce',
    devs: ['Router'],
    name: 'PE-CE 路由引入（静态 / OSPF / BGP）',
    kw: ['pe ce', 'vpn引入路由', 'vrf import-route', 'vpn客户路由'],
    cmds: [
      ['华为', 'ip vpn-instance vpn1\n ipv4-family\n  import-route static\nbgp 65001\n ipv4-family vpn-instance vpn1\n  import-route ospf 1'],
      ['思科', 'router bgp 65001\n address-family ipv4 vrf vpn1\n  redistribute static\n  redistribute ospf 1'],
      ['H3C', 'bgp 65001\n address-family ipv4 vpn-instance vpn1\n  import-route ospf 1'],
      ['锐捷', 'router bgp 65001\n address-family ipv4 vrf vpn1\n  redistribute static']
    ],
    tip: 'PE 上引入客户路由要在 VRF 自己的 address-family 里做，配到全局 BGP 里等于没配。多客户场景记得每个 VRF 单独引入，别图省事用一条全局策略。'
  },
  {
    id: 'mpls-inter-as-a',
    devs: ['Router'],
    name: '跨域 Option A（VRF 背靠背）',
    kw: ['option a', '跨域vpn', 'inter-as vpn', 'vrf背靠背'],
    cmds: [
      ['华为', 'ip vpn-instance vpn1\n ipv4-family\n  route-distinguisher 1:1\n  vpn-target 1:1 export-extcommunity\n  vpn-target 1:1 import-extcommunity\nbgp 65001\n ipv4-family vpn-instance vpn1\n  peer 202.1.1.2 as-number 65002'],
      ['思科', 'router bgp 65001\n address-family ipv4 vrf vpn1\n  neighbor 202.1.1.2 remote-as 65002\n  neighbor 202.1.1.2 activate'],
      ['H3C', 'bgp 65001\n address-family ipv4 vpn-instance vpn1\n  peer 202.1.1.2 as-number 65002'],
      ['锐捷', 'router bgp 65001\n address-family ipv4 vrf vpn1\n  neighbor 202.1.1.2 remote-as 65002']
    ],
    tip: 'Option A 最简单也最费设备——每个 VPN 在 ASBR 上都要占一个子接口和一个 VRF，客户多了扛不住。它的优点是两域完全解耦，排障边界清楚。'
  },
  {
    id: 'mpls-inter-as-b',
    devs: ['Router'],
    name: '跨域 Option B（ASBR 间传 VPNv4）',
    kw: ['option b', 'asbr vpnv4', '跨域mp-ebgp'],
    cmds: [
      ['华为', 'bgp 65001\n ipv4-family vpnv4\n  peer 202.1.1.2 enable\n  peer 202.1.1.2 next-hop-local\n  undo policy vpn-target'],
      ['思科', 'router bgp 65001\n address-family vpnv4\n  neighbor 202.1.1.2 activate\n  neighbor 202.1.1.2 next-hop-self\n  no bgp default route-target filter'],
      ['H3C', 'bgp 65001\n address-family vpnv4\n  peer 202.1.1.2 enable\n  peer 202.1.1.2 next-hop-local\n  undo policy vpn-target'],
      ['锐捷', 'router bgp 65001\n address-family vpnv4\n  neighbor 202.1.1.2 activate\n  neighbor 202.1.1.2 next-hop-self\nno bgp default route-target filter']
    ],
    tip: 'Option B 要求 ASBR 关掉 RT 过滤（否则自己没配的 VPN 路由全丢），并且下一跳要改成自己。这两条少一条，跨域 VPN 就只剩一半通。'
  },
  {
    id: 'mpls-vpls',
    devs: ['Router', 'Switch'],
    name: 'VPLS 二层 VPN（大二层互通）',
    kw: ['vpls', '二层vpn', 'vsi', '大二层'],
    cmds: [
      ['华为', 'vsi vpls1 static\n pwsignal ldp\n  vsi-id 100\n  peer 2.2.2.2'],
      ['思科', 'l2vpn vfi context VPLS1\n vpn id 100\n member 2.2.2.2 encapsulation mpls\nbridge-domain 100\n member vfi VPLS1'],
      ['H3C', 'vsi vpls1\n pwsignal ldp\n  vsi-id 100\n  peer 2.2.2.2'],
      ['锐捷', 'vpls vpls1\n vpn id 100\n member 2.2.2.2']
    ],
    tip: 'VPLS 就是把二层帧封进 MPLS 网里传，客户两端像接在同一台交换机上。全网状 PW 在节点多时信令量爆炸，超过十几个站点一般改用 EVPN。'
  },
  {
    id: 'mpls-static-lsp',
    devs: ['Router'],
    name: '静态 LSP（不跑 LDP 也能转发）',
    kw: ['静态lsp', 'static lsp', '手工标签'],
    cmds: [
      ['华为', 'static-lsp ingress lsp1 destination 3.3.3.3 32 nexthop 202.1.1.2 out-label 100\nstatic-lsp transit lsp1 incoming-interface GigabitEthernet 0/0/1 in-label 100 nexthop 202.2.2.2 out-label 200\nstatic-lsp egress lsp1 incoming-interface GigabitEthernet 0/0/1 in-label 200'],
      ['思科', 'mpls static binding ipv4 3.3.3.3 255.255.255.255 100 out 200 202.1.1.2\nmpls static binding ipv4 3.3.3.3 255.255.255.255 200 out 300 202.2.2.2\nmpls static binding ipv4 3.3.3.3 255.255.255.255 300'],
      ['H3C', 'static-lsp ingress lsp1 destination 3.3.3.3 32 nexthop 202.1.1.2 out-label 100\nstatic-lsp transit lsp1 in-label 100 nexthop 202.2.2.2 out-label 200'],
      ['锐捷', 'mpls static binding ipv4 3.3.3.3 255.255.255.255 100 out 200 202.1.1.2\nmpls static binding ipv4 3.3.3.3 255.255.255.255 200 out 300 202.2.2.2']
    ],
    tip: '静态 LSP 要头、中、尾三台设备标签严格对接：上一跳的 out-label 必须等于下一跳的 in-label，写错一位就断。思科/锐捷的写法是 mpls static binding ipv4 前缀 掩码 [入标签] [out 出标签 下一跳]，只写标签不带 out 就是末尾弹出。设备少、拓扑固定时才用，节点一多维护成本极高。'
  },
  {
    id: 'mpls-mtu',
    devs: ['Router'],
    name: 'MPLS MTU 与分片（大包不通）',
    kw: ['mpls mtu', '标签mtu', 'mpls大包不通'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n mpls mtu 1500\n tcp adjust-mss 1460'],
      ['思科', 'interface GigabitEthernet0/1\n mpls mtu 1500\n ip tcp adjust-mss 1460'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n mpls mtu 1500'],
      ['锐捷', 'interface GigabitEthernet 0/1\n mpls mtu 1500']
    ],
    tip: '每层标签吃掉 4 字节，两层 VPN 标签就是 8 字节。核心口按 1500 配、边缘不调，就会出现「ping 通但传文件卡死」——MPLS 网里压 MSS 比调 MTU 更省事。'
  },
  {
    id: 'mpls-trouble',
    devs: ['Router'],
    name: 'MPLS 转发不通排查',
    kw: ['mpls不通', 'mpls排障', '标签不通', 'ping mpls'],
    cmds: [
      ['华为', 'ping mpls ipv4 3.3.3.3 32\ntracert lsp ip 3.3.3.3 32\ndisplay mpls lsp include 3.3.3.3 32'],
      ['思科', 'ping mpls ipv4 3.3.3.3/32\ntraceroute mpls ipv4 3.3.3.3/32\nshow mpls forwarding-table 3.3.3.3'],
      ['H3C', 'ping mpls ipv4 3.3.3.3 32\ntracert lsp ip 3.3.3.3 32\ndisplay mpls lsp include 3.3.3.3 32'],
      ['锐捷', 'ping mpls ipv4 3.3.3.3/32\nshow mpls forwarding-table 3.3.3.3']
    ],
    tip: 'ping mpls 是最快的分层手段：能通说明标签转发链路没问题，业务还不通就往 VPN 的 VRF 和 RT 上找。华为/H3C 看每一跳标签值用 tracert lsp ip，普通的 tracert 走的是 IP 转发、看不到标签；思科是 traceroute mpls ipv4。断在哪一跳一目了然。'
  }
];

module.exports = { MPLS_EXTRA };
