// utils/cmdbook-route2.js —— 命令百科扩充（第二批）：路由器进阶

const ROUTE2_EXTRA = [
  {
    id: 'loopback',
    devs: ['Router', 'Switch', '防火墙'],
    name: '创建 Loopback 接口',
    kw: ['loopback', '环回口', '虚拟接口', 'router-id来源', '永久在线接口'],
    cmds: [
      ['华为', 'interface LoopBack 0\n ip address 1.1.1.1 32'],
      ['思科', 'interface Loopback0\n ip address 1.1.1.1 255.255.255.255'],
      ['H3C', 'interface LoopBack 0\n ip address 1.1.1.1 32'],
      ['锐捷', 'interface Loopback 0\n ip address 1.1.1.1 255.255.255.255']
    ],
    tip: 'Loopback 永远 up，拿来做 router-id、BGP 更新源、管理地址最稳。千万别用它做业务网关。'
  },
  {
    id: 'null0',
    devs: ['Router', 'Switch'],
    name: 'Null0 黑洞接口',
    kw: ['null0', '黑洞路由', '丢弃流量', '防环路由'],
    cmds: [
      ['华为', 'ip route-static 10.1.0.0 16 NULL0'],
      ['思科', 'ip route 10.1.0.0 255.255.0.0 Null0'],
      ['H3C', 'ip route-static 10.1.0.0 16 NULL0'],
      ['锐捷', 'ip route 10.1.0.0 255.255.0.0 Null0']
    ],
    tip: '指向 Null0 的包里直接丢掉。汇总路由配 Null0 是为了防环——汇总段里那些不存在的明细，不至于又绕回来。'
  },
  {
    id: 'ppp-pap',
    devs: ['Router'],
    name: 'PPP PAP 认证',
    kw: ['pap', 'ppp认证', '广域网认证', '拨号认证'],
    cmds: [
      ['华为', 'interface Serial 0/0/0\n link-protocol ppp\n ppp authentication-mode pap\n ppp pap local-user user1 password cipher pass1\naaa\n local-user user1 password cipher pass1\n local-user user1 service-type ppp'],
      ['思科', 'interface Serial0/0\n encapsulation ppp\n ppp authentication pap\n ppp pap sent-username user1 password pass1'],
      ['H3C', 'interface Serial 1/0\n link-protocol ppp\n ppp authentication-mode pap\n ppp pap local-user user1 password simple pass1'],
      ['锐捷', 'interface Serial 0/0\n encapsulation ppp\n ppp authentication pap']
    ],
    tip: 'PAP 是明文传输密码，能选 CHAP 就别用 PAP。现在广域网基本都走以太网 + IPSec 了，PPP 主要见于老专线。'
  },
  {
    id: 'ppp-chap',
    devs: ['Router'],
    name: 'PPP CHAP 认证',
    kw: ['chap', 'ppp chap', '加密认证', '广域网'],
    cmds: [
      ['华为', 'interface Serial 0/0/0\n link-protocol ppp\n ppp authentication-mode chap\naaa\n local-user rt2 password cipher pass1\n local-user rt2 service-type ppp'],
      ['思科', 'interface Serial0/0\n encapsulation ppp\n ppp authentication chap\nusername rt2 password pass1'],
      ['H3C', 'interface Serial 1/0\n link-protocol ppp\n ppp authentication-mode chap'],
      ['锐捷', 'interface Serial 0/0\n encapsulation ppp\n ppp authentication chap']
    ],
    tip: 'CHAP 是挑战-应答，密码不上线传输。两端用户名必须是**对端的主机名**，配错了认证一直失败。'
  },
  {
    id: 'mp-bundle',
    devs: ['Router'],
    name: 'MP 多链路 PPP 捆绑',
    kw: ['mp', '多链路捆绑', 'ppp multilink', '两条专线叠加'],
    cmds: [
      ['华为', 'interface Mp-group 1\n ip address 10.0.0.1 30\ninterface Serial 0/0/0\n link-protocol ppp\n ppp mp Mp-group 1'],
      ['思科', 'interface Multilink1\n ip address 10.0.0.1 255.255.255.252\n ppp multilink\ninterface Serial0/0\n encapsulation ppp\n ppp multilink\n ppp multilink group 1'],
      ['H3C', 'interface MP-group 1\n ip address 10.0.0.1 30'],
      ['锐捷', 'interface Multilink1\n ppp multilink']
    ],
    tip: '两条 E1 绑成一条 4M，比做负载均衡好：单条流也能跑满总带宽。老专线时代的主流做法。'
  },
  {
    id: 'ospf-auth',
    devs: ['Router', 'Switch'],
    name: 'OSPF 区域 / 接口认证',
    kw: ['ospf认证', 'md5认证', '区域认证', 'ospf安全'],
    cmds: [
      ['华为', 'ospf 1\n area 0\n  authentication-mode md5 1 cipher pass123\n# 或接口级\ninterface GigabitEthernet 0/0/1\n ospf authentication-mode md5 1 cipher pass123'],
      ['思科', 'router ospf 1\n area 0 authentication message-digest\ninterface GigabitEthernet 0/1\n ip ospf message-digest-key 1 md5 pass123'],
      ['H3C', 'ospf 1\n area 0\n  authentication-mode md5 1 cipher pass123'],
      ['锐捷', 'router ospf 1\n area 0 authentication message-digest\ninterface GigabitEthernet 0/1\n ip ospf message-digest-key 1 md5 pass123']
    ],
    tip: '区域认证对整个区域生效，接口认证只对那个口。两端认证方式和 key-id 必须一致，否则邻居卡在 INIT/EXSTART。'
  },
  {
    id: 'ospf-gr',
    devs: ['Router'],
    name: 'OSPF 平滑重启 GR',
    kw: ['ospf gr', '平滑重启', 'graceful restart', '重启不断网'],
    cmds: [
      ['华为', 'ospf 1\n graceful-restart'],
      ['思科', 'router ospf 1\n nsf ietf'],
      ['H3C', 'ospf 1\n graceful-restart'],
      ['锐捷', 'router ospf 1\n nsf']
    ],
    tip: 'GR 让控制面重启时转发面继续工作，业务不断。但要邻居也支持并配合，单边开没用。'
  },
  {
    id: 'ospf-bfd',
    devs: ['Router', 'Switch'],
    name: 'OSPF 与 BFD 联动',
    kw: ['ospf bfd', '快速检测ospf', '毫秒收敛', 'bfd联动'],
    cmds: [
      ['华为', 'bfd\nospf 1\n bfd all-interfaces enable'],
      ['思科', 'router ospf 1\n bfd all-interfaces'],
      ['H3C', 'ospf 1\n bfd all-interfaces enable'],
      ['锐捷', 'router ospf 1\n bfd all-interfaces']
    ],
    tip: 'OSPF 默认靠 Hello 超时（通常 40 秒）才发现邻居挂了，联动 BFD 能压到毫秒级。跨传输设备时必配。'
  },
  {
    id: 'bgp-community',
    devs: ['Router'],
    name: 'BGP 团体属性',
    kw: ['团体属性', 'community', 'no-export', '路由标记bgp', '打标签'],
    cmds: [
      ['华为', 'route-policy tag permit node 10\n apply community 65001:100\nbgp 65001\n peer 10.1.1.2 route-policy tag export\n peer 10.1.1.2 advertise-community'],
      ['思科', 'route-map tag permit 10\n set community 65001:100\nrouter bgp 65001\n neighbor 10.1.1.2 send-community\n neighbor 10.1.1.2 route-map tag out'],
      ['H3C', 'route-policy tag permit node 10\n apply community 65001:100\nbgp 65001\n peer 10.1.1.2 route-policy tag export'],
      ['锐捷', 'route-map tag permit 10\n set community 65001:100\nrouter bgp 65001\n neighbor 10.1.1.2 send-community']
    ],
    tip: '团体属性就是给路由贴标签，方便对端统一做策略。别忘 `advertise-community` / `send-community`，忘了标签根本发不出去。'
  },
  {
    id: 'bgp-confed',
    devs: ['Router'],
    name: 'BGP 联邦（confederation）',
    kw: ['bgp联邦', 'confederation', '大as拆分', 'ibgp全互联'],
    cmds: [
      ['华为', 'bgp 65001\n confederation id 100\n confederation peer-as 65002 65003'],
      ['思科', 'router bgp 65001\n bgp confederation identifier 100\n bgp confederation peers 65002 65003'],
      ['H3C', 'bgp 65001\n confederation id 100\n confederation peer-as 65002 65003'],
      ['锐捷', 'router bgp 65001\n bgp confederation identifier 100\n bgp confederation peers 65002 65003']
    ],
    tip: '联邦是除 RR 之外另一种打破 IBGP 全互联的办法。对外仍是一个 AS，对内拆成多个小 AS，配置比 RR 复杂。'
  },
  {
    id: 'bgp-aggregate',
    devs: ['Router'],
    name: 'BGP 路由聚合',
    kw: ['bgp聚合', 'aggregate-address', '路由汇总bgp', '减少bgp路由'],
    cmds: [
      ['华为', 'bgp 65001\n aggregate 10.1.0.0 16 detail-suppressed'],
      ['思科', 'router bgp 65001\n aggregate-address 10.1.0.0 255.255.0.0 summary-only'],
      ['H3C', 'bgp 65001\n address-family ipv4\n  aggregate 10.1.0.0 16 detail-suppressed'],
      ['锐捷', 'router bgp 65001\n aggregate-address 10.1.0.0 255.255.0.0 summary-only']
    ],
    tip: 'detail-suppressed 是关键：不加这个，明细和汇总一起发，路由数不减反增。'
  },
  {
    id: 'bgp-next-hop-self',
    devs: ['Router'],
    name: 'BGP next-hop-self',
    kw: ['next-hop-self', '下一跳不可达', 'bgp不通', 'bgp下一跳'],
    cmds: [
      ['华为', 'bgp 65001\n peer 10.1.1.2 next-hop-local'],
      ['思科', 'router bgp 65001\n neighbor 10.1.1.2 next-hop-self'],
      ['H3C', 'bgp 65001\n peer 10.1.1.2 next-hop-local'],
      ['锐捷', 'router bgp 65001\n neighbor 10.1.1.2 next-hop-self']
    ],
    tip: 'IBGP 传过来的路由下一跳可能不可达，表现为「路由在表里但 ping 不通」。加 next-hop-local / next-hop-self 改成自己。'
  },
  {
    id: 'redistribute',
    devs: ['Router', 'Switch'],
    name: '路由引入（重分发）',
    kw: ['重分发', 'redistribute', '引入直连', '引入静态', '协议间引入'],
    cmds: [
      ['华为', 'ospf 1\n import-route direct\n import-route static\n import-route bgp cost 100'],
      ['思科', 'router ospf 1\n redistribute connected subnets\n redistribute static metric 100'],
      ['H3C', 'ospf 1\n import-route direct\n import-route static'],
      ['锐捷', 'router ospf 1\n redistribute connected subnets']
    ],
    tip: '思科 / 锐捷必须加 `subnets`，否则只引入主类网段，所有子网全丢——这是最经典的「引入成功但路由没有」。'
  },
  {
    id: 'route-tag',
    devs: ['Router', 'Switch'],
    name: '路由标记 tag（防环）',
    kw: ['tag', '路由标记', '双向引入防环', '路由打标'],
    cmds: [
      ['华为', 'route-policy fromOspf permit node 10\n apply tag 100\nospf 1\n import-route bgp route-policy fromOspf'],
      ['思科', 'route-map fromOSPF permit 10\n set tag 100\nrouter ospf 1\n redistribute bgp 65001 subnets route-map fromOSPF'],
      ['H3C', 'route-policy fromOspf permit node 10\n apply tag 100'],
      ['锐捷', 'route-map fromOSPF permit 10\n set tag 100']
    ],
    tip: '两个协议互相引入时打 tag，回程时按 tag 拒掉，否则会形成路由环路，CPU 直接跑满。'
  },
  {
    id: 'pim-dm',
    devs: ['Router', 'Switch'],
    name: 'PIM-DM 密集模式',
    kw: ['pim-dm', '密集模式', '组播推模式', '小型组播网'],
    cmds: [
      ['华为', 'multicast routing-enable\ninterface GigabitEthernet 0/0/1\n pim dm'],
      ['思科', 'ip multicast-routing\ninterface GigabitEthernet 0/1\n ip pim dense-mode'],
      ['H3C', 'multicast routing\ninterface GigabitEthernet 1/0/1\n pim dm'],
      ['锐捷', 'ip multicast-routing\ninterface GigabitEthernet 0/1\n ip pim dense-mode']
    ],
    tip: 'DM 是「先推后剪」，小网络简单但初期会泛洪。成员分散的大网用 PIM-SM。'
  },
  {
    id: 'msdp',
    devs: ['Router'],
    name: 'MSDP 跨域组播',
    kw: ['msdp', '跨域组播', '多pim域', '组播互联'],
    cmds: [
      ['华为', 'msdp\n peer 2.2.2.2 connect-interface LoopBack 0'],
      ['思科', 'ip msdp peer 2.2.2.2 connect-source Loopback0'],
      ['H3C', 'msdp\n peer 2.2.2.2 connect-interface LoopBack 0'],
      ['锐捷', 'ip msdp peer 2.2.2.2 connect-source Loopback0']
    ],
    tip: '多个 PIM-SM 域之间靠 MSDP 共享源信息，否则跨域的组播接收者找不到源。'
  },
  {
    id: 'dhcpv6',
    devs: ['Router', 'Switch'],
    name: 'DHCPv6 服务器',
    kw: ['dhcpv6', 'ipv6地址分配', 'v6 dhcp', '有状态地址'],
    cmds: [
      ['华为', 'dhcpv6 pool p6\n address prefix 2001:db8:1::/64\ninterface GigabitEthernet 0/0/1\n dhcpv6 server p6'],
      ['思科', 'ipv6 dhcp pool p6\n address prefix 2001:DB8:1::/64\ninterface GigabitEthernet 0/1\n ipv6 dhcp server p6'],
      ['H3C', 'dhcpv6 pool p6\n address prefix 2001:db8:1::/64\ninterface GigabitEthernet 1/0/1\n dhcpv6 server p6'],
      ['锐捷', 'ipv6 dhcp pool p6\n address prefix 2001:DB8:1::/64']
    ],
    tip: 'IPv6 有两种玩法：SLAAC（无状态，终端自己算地址）和 DHCPv6（有状态，服务器发）。要发 DNS 必须用 DHCPv6 或 RDNSS。'
  },
  {
    id: 'ipv6-nd',
    devs: ['Router', 'Switch'],
    name: 'IPv6 ND 与 RA 通告',
    kw: ['nd', 'ra', '邻居发现', '路由通告', 'slaac'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n ipv6 enable\n ipv6 address 2001:db8:1::1/64\n undo ipv6 nd ra halt'],
      ['思科', 'interface GigabitEthernet 0/1\n ipv6 address 2001:DB8:1::1/64\n ipv6 nd ra-interval 30\n no ipv6 nd ra suppress'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n ipv6 address 2001:db8:1::1/64\n undo ipv6 nd ra halt'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ipv6 address 2001:DB8:1::1/64\n no ipv6 nd ra suppress']
    ],
    tip: '终端拿不到 IPv6 地址，九成是 RA 被 suppressed 了。华为 / H3C 默认就抑制，要手动 `undo ... ra halt`。'
  },
  {
    id: 'nat64',
    devs: ['Router', '防火墙'],
    name: 'NAT64（IPv6 访问 IPv4）',
    kw: ['nat64', 'v6访问v4', '地址转换v6', '过渡技术'],
    cmds: [
      ['华为', 'nat64 enable\ninterface GigabitEthernet 0/0/1\n nat64 enable'],
      ['思科', 'interface GigabitEthernet 0/1\n nat64 enable'],
      ['H3C', 'nat64 enable'],
      ['锐捷', 'nat64 enable']
    ],
    tip: 'NAT64 要把 IPv4 地址映射成特定前缀的 IPv6 地址（如 64:ff9b::/96），同时得配 DNS64，否则域名解析不出来。'
  },
  {
    id: 'l2tp',
    devs: ['Router', '防火墙'],
    name: 'L2TP VPN（拨号接入）',
    kw: ['l2tp', 'vpn拨号', '远程拨入', '出差连内网'],
    cmds: [
      ['华为', 'l2tp enable\ninterface Virtual-Template 1\n ppp authentication-mode chap\nip pool l2tp 192.168.100.10 192.168.100.100\nl2tp-group 1\n tunnel name LNS\n allow l2tp virtual-template 1'],
      ['思科', 'vpdn enable\nvpdn-group 1\n accept-dialin\n  protocol l2tp\n  virtual-template 1'],
      ['H3C', 'l2tp enable\ninterface Virtual-Template 1\n ppp authentication-mode chap'],
      ['锐捷', 'vpdn enable\nvpdn-group 1\n accept-dialin']
    ],
    tip: 'L2TP 本身不加密，必须叠 IPSec 才安全（L2TP over IPSec）。纯 L2TP 等于把密码明文扔公网。'
  },
  {
    id: 'ssl-vpn',
    devs: ['防火墙', 'Router'],
    name: 'SSL VPN（网页拨入）',
    kw: ['ssl vpn', '网页vpn', '免客户端vpn', 'web vpn'],
    cmds: [
      ['华为', 'v-gateway gw1\nv-gateway gw1 interface GigabitEthernet 1/0/1 private\nv-gateway gw1 security ip-list 192.168.0.0 mask 16'],
      ['思科', 'webvpn\n enable outside\n anyconnect enable'],
      ['H3C', 'ssl-vpn gateway gw1\n ip address 443'],
      ['锐捷', 'ssl-vpn enable']
    ],
    tip: 'SSL VPN 走 443 端口，不容易被酒店/机场网络拦。用户只需浏览器，比 IPSec 客户端省事。'
  },
  {
    id: 'bgp-default-route',
    devs: ['Router'],
    name: 'BGP 下发默认路由',
    kw: ['bgp默认路由', 'default-route originate', '给邻居发默认', '出口默认路由'],
    cmds: [
      ['华为', 'bgp 65001\n peer 10.1.1.2 default-route-advertise'],
      ['思科', 'router bgp 65001\n neighbor 10.1.1.2 default-originate'],
      ['H3C', 'bgp 65001\n peer 10.1.1.2 default-route-advertise'],
      ['锐捷', 'router bgp 65001\n neighbor 10.1.1.2 default-originate']
    ],
    tip: '一般用在出口路由器给内网下发默认路由。注意本机路由表里要真有默认路由，否则发不出去（华为可用 always 强发）。'
  },
  {
    id: 'ospf-default-route',
    devs: ['Router', 'Switch'],
    name: 'OSPF 下发默认路由',
    kw: ['ospf默认路由', 'default-route-advertise', '给ospf区域发默认'],
    cmds: [
      ['华为', 'ospf 1\n default-route-advertise always'],
      ['思科', 'router ospf 1\n default-information originate'],
      ['H3C', 'ospf 1\n default-route-advertise always'],
      ['锐捷', 'router ospf 1\n default-information originate']
    ],
    tip: '不加 always 时，本机必须有默认路由才会下发。加了 always 是无条件下发——双出口场景容易把流量吸错方向，慎用。'
  },
  {
    id: 'bgp-max-prefix',
    devs: ['Router'],
    name: 'BGP 最大前缀数限制',
    kw: ['bgp最大前缀', 'maximum-prefix', '路由泄露', '防止收路由过多'],
    cmds: [
      ['华为', 'bgp 65001\n peer 10.1.1.2 route-limit 1000'],
      ['思科', 'router bgp 65001\n neighbor 10.1.1.2 maximum-prefix 1000 80 warning-only'],
      ['H3C', 'bgp 65001\n peer 10.1.1.2 route-limit 1000'],
      ['锐捷', 'router bgp 65001\n neighbor 10.1.1.2 maximum-prefix 1000']
    ],
    tip: '对端误配导致把全网路由灌过来，内存直接爆。设上限能在越界时掐断邻居，保护自己设备。'
  },
  {
    id: 'bgp-dampening',
    devs: ['Router'],
    name: 'BGP 路由衰减（dampening）',
    kw: ['dampening', '路由震荡', 'bgp抖动', '路由翻动'],
    cmds: [
      ['华为', 'bgp 65001\n ipv4-family unicast\n  dampening 15 750 2000 60'],
      ['思科', 'router bgp 65001\n bgp dampening 15 750 2000 60'],
      ['H3C', 'bgp 65001\n address-family ipv4\n  dampening'],
      ['锐捷', 'router bgp 65001\n bgp dampening']
    ],
    tip: '对端链路抖动会让同一条路由反复撤了又发，全网跟着算。dampening 把它压住，但也会延迟真正恢复，参数别设太狠。'
  },
  {
    id: 'gre-over-ipsec',
    devs: ['Router', '防火墙'],
    name: 'GRE over IPSec',
    kw: ['gre over ipsec', '隧道加密', '组播过vpn', 'ospf过隧道'],
    cmds: [
      ['华为', 'interface Tunnel 0/0/0\n tunnel-protocol gre\n source 202.1.1.1\n destination 202.2.2.2\n ip address 10.0.0.1 30\n# 再把 Tunnel 口流量用 IPSec 保护'],
      ['思科', 'interface Tunnel0\n tunnel mode gre ip\n tunnel source 202.1.1.1\n tunnel destination 202.2.2.2\n ip address 10.0.0.1 255.255.255.252\n# crypto map 应用在物理口上'],
      ['H3C', 'interface Tunnel 0\n mode gre\n source 202.1.1.1\n destination 202.2.2.2'],
      ['锐捷', 'interface Tunnel 0\n tunnel mode gre ip']
    ],
    tip: '纯 IPSec 只能传单播，OSPF/组播过不去。先建 GRE 隧道把组播装进去，再用 IPSec 加密隧道，两个需求都满足。'
  },
  {
    id: 'dmvpn',
    devs: ['Router'],
    name: 'DMVPN 动态多点 VPN',
    kw: ['dmvpn', '多点vpn', 'hub spoke', '分支互联', '绕总部', '分支绕行', '流量不回总部'],
    cmds: [
      ['华为', 'interface Tunnel 0/0/0\n tunnel-protocol gre p2mp\n source 202.1.1.1\n nhrp network-id 1\n nhrp entry multicast dynamic'],
      ['思科', 'interface Tunnel0\n tunnel mode gre multipoint\n tunnel source 202.1.1.1\n ip nhrp network-id 1\n ip nhrp map multicast dynamic'],
      ['H3C', 'interface Tunnel 0\n tunnel mode gre p2mp\n source 202.1.1.1\n nhrp network-id 1\n nhrp entry multicast dynamic'],
      ['锐捷', 'interface Tunnel 0\n tunnel mode gre multipoint\n ip nhrp network-id 1']
    ],
    tip: 'Hub-Spoke 全互联场景，DMVPN 让分支之间直接通信不用绕总部，比一条条配 IPSec 省太多。'
  },
  {
    id: 'car',
    devs: ['Router', '防火墙'],
    name: 'CAR 流量监管',
    kw: ['car', '流量监管', '限速路由器', 'police', '承诺速率'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0\n qos car inbound cir 10240 cbs 640000'],
      ['思科', 'interface GigabitEthernet 0/0\n service-policy input POLICE\n# policy-map 里 police 10000000 conform-action transmit exceed-action drop'],
      ['H3C', 'interface GigabitEthernet 1/0/0\n qos car inbound cir 10240'],
      ['锐捷', 'interface GigabitEthernet 0/0\n rate-limit input 10240']
    ],
    tip: 'CAR 是「超了就丢」，GTS 是「超了先排队」。给运营商链路限速用 CAR，给下游用户限速用 GTS 更平滑。'
  },
  {
    id: 'wred',
    devs: ['Router', 'Switch'],
    name: 'WRED 拥塞避免',
    kw: ['wred', '拥塞避免', '队列丢包', 'tcp全局同步'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0\n qos wred queue 1 low-limit 40 high-limit 80 discard-probability 10'],
      ['思科', 'interface GigabitEthernet 0/0\n random-detect\n random-detect dscp-based'],
      ['H3C', 'interface GigabitEthernet 1/0/0\n qos wred queue 1 low-limit 40 high-limit 80'],
      ['锐捷', 'interface GigabitEthernet 0/0\n random-detect']
    ],
    tip: '队列快满时提前随机丢几个包，让 TCP 主动降速，避免「一起丢、一起重传」的全局同步。出口拥塞时有用。'
  },
  {
    id: 'interface-backup',
    devs: ['Router'],
    name: '接口备份（主备链路）',
    kw: ['接口备份', 'backup interface', '主备口', '链路备份'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0\n standby interface GigabitEthernet 0/0/1 20'],
      ['思科', 'interface GigabitEthernet 0/0\n backup interface GigabitEthernet 0/1\n backup delay 10 60'],
      ['H3C', 'interface GigabitEthernet 1/0/0\n standby interface GigabitEthernet 1/0/1'],
      ['锐捷', 'interface GigabitEthernet 0/0\n backup interface GigabitEthernet 0/1']
    ],
    tip: '主口 down 才启用备口，备口平时是 down 状态。和「双口同时 up 做负载」是两种思路，别混。'
  },
  {
    id: 'static-bfd',
    devs: ['Router', 'Switch'],
    name: '静态路由联动 BFD',
    kw: ['静态路由bfd', 'bfd联动静态', '静态路由自动切换'],
    cmds: [
      ['华为', 'bfd\nip route-static 0.0.0.0 0 202.1.1.1 bfd-session 1'],
      ['思科', 'ip route 0.0.0.0 0.0.0.0 202.1.1.1 track 1\n# track 1 关联 ip sla 做探测'],
      ['H3C', 'ip route-static 0.0.0.0 0 202.1.1.1 bfd control-packet'],
      ['锐捷', 'ip route 0.0.0.0 0.0.0.0 202.1.1.1 track 1']
    ],
    tip: '静态路由本身感知不到中间断链，只能靠 BFD 或 IP SLA 探测，断了才撤路由。双出口场景必须配。'
  },
  {
    id: 'if-utilization',
    devs: ['Router', 'Switch'],
    name: '查看接口带宽利用率',
    kw: ['带宽利用率', '接口流量大小', '跑了多少兆', '带宽跑满'],
    cmds: [
      ['华为', 'display interface GigabitEthernet 0/0/1\n# 看 Input/Output rate 或 bandwidth utilization'],
      ['思科', 'show interfaces GigabitEthernet0/1\nshow interface GigabitEthernet0/1 | include rate'],
      ['H3C', 'display interface GigabitEthernet 1/0/1'],
      ['锐捷', 'show interfaces GigabitEthernet 0/1']
    ],
    tip: '利用率要连续看几次，单次快照可能是突发。持续 70% 以上就该考虑扩容或做流控了。'
  },
  {
    id: 'file-server',
    devs: ['Router'],
    name: '设备做简易文件服务',
    kw: ['ftp服务器', 'tftp服务器', 'http服务', '设备当文件服务器'],
    cmds: [
      ['华为', 'ftp server enable\naaa\n local-user ftp password cipher pass1\n local-user ftp service-type ftp\n local-user ftp ftp-directory flash:'],
      ['思科', 'ip http server\nip http path flash:'],
      ['H3C', 'ftp server enable\nlocal-user ftp class manage\n password simple pass1\n service-type ftp\n authorization-attribute work-directory flash:'],
      ['锐捷', 'ftp-server enable']
    ],
    tip: '临时给设备传固件、导配置时很方便，但别长期开着——明文 FTP 是安全扫描的重点项。注意思科 IOS 只做 HTTP 服务端，不提供 FTP / TFTP 服务端（ip ftp username 是它当客户端去连别人的凭据）。'
  },
  {
    id: 'route-summary-stat',
    devs: ['Router', 'Switch'],
    name: '查看路由表规模与协议分布',
    kw: ['路由表统计', '有多少条路由', '路由数量', '路由表大小'],
    cmds: [
      ['华为', 'display ip routing-table statistics'],
      ['思科', 'show ip route summary'],
      ['H3C', 'display ip routing-table statistics'],
      ['锐捷', 'show ip route summary']
    ],
    tip: '路由数突然暴涨，多半是邻居抖动或引入配置出错。日常记一下基线，异常时一眼能看出来。'
  },
  {
    id: 'static-rp',
    devs: ['Router', 'Switch'],
    name: '组播静态 RP',
    kw: ['静态rp', 'rp地址', '组播汇聚点', 'pim rp'],
    cmds: [
      ['华为', 'pim\n static-rp 2.2.2.2'],
      ['思科', 'ip pim rp-address 2.2.2.2'],
      ['H3C', 'pim\n static-rp 2.2.2.2'],
      ['锐捷', 'ip pim rp-address 2.2.2.2']
    ],
    tip: 'PIM-SM 必须有一个 RP（汇聚点），全网所有路由器都要指向同一个。指错了组播就不通，而且很难查。'
  },
  {
    id: 'dual-mpu',
    devs: ['Router', 'Switch'],
    name: '双主控主备状态',
    kw: ['双主控', '主备切换', 'mpu', '主控板'],
    cmds: [
      ['华为', 'display device\ndisplay switchover state'],
      ['思科', 'show redundancy\nshow redundancy states'],
      ['H3C', 'display device\ndisplay switchover state'],
      ['锐捷', 'show redundancy']
    ],
    tip: '双主控设备升级、割接前先看这条，确认主备都在位、配置已同步，不然切过去就是空配置。'
  },
  {
    id: 'if-flap-detect',
    devs: ['Router', 'Switch'],
    name: '接口抖动历史',
    kw: ['接口抖动', 'flap history', 'up down次数', '链路闪断'],
    cmds: [
      ['华为', 'display interface GigabitEthernet 0/0/1\n# 看 Last 300 seconds input/output rate 与 up/down 计数'],
      ['思科', 'show interfaces GigabitEthernet0/1 | include flap\nshow log | include GigabitEthernet0/1'],
      ['H3C', 'display interface GigabitEthernet 1/0/1'],
      ['锐捷', 'show interfaces GigabitEthernet 0/1']
    ],
    tip: '「flapped N times」这个数字很关键：一直在涨就是物理链路问题，稳定不变说明是历史故障。'
  },
  {
    id: 'router-cpu-protect',
    devs: ['Router'],
    name: '路由器 CPU 保护',
    kw: ['cpu保护', 'cpu-protect', '控制面保护', 'copp'],
    cmds: [
      ['华为', 'cpu-defend policy 1\n auto-defend enable\ncar'],
      ['思科', 'control-plane\n service-policy input COPP'],
      ['H3C', 'attack-defense policy 1'],
      ['锐捷', 'cpu-protect policy 1']
    ],
    tip: '路由器 CPU 被打满会连 BGP 邻居都断，全网跟着抖。控制面限速是最后一道防线。'
  },
  {
    id: 'router-mirror',
    devs: ['Router'],
    name: '路由器端口镜像',
    kw: ['路由器镜像', 'mirror', '抓包路由器', '流量复制'],
    cmds: [
      ['华为', 'observe-port 1 interface GigabitEthernet 0/0/2\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 both'],
      ['思科', 'monitor session 1 source interface GigabitEthernet0/0/1 both\nmonitor session 1 destination interface GigabitEthernet0/0/2'],
      ['H3C', 'mirroring-group 1 local\nmirroring-group 1 mirroring-port GigabitEthernet 1/0/1 both\nmirroring-group 1 monitor-port GigabitEthernet 1/0/2'],
      ['锐捷', 'monitor session 1 source interface GigabitEthernet 0/0/1 both']
    ],
    tip: '路由器抓包和交换机一样，但镜像口别接业务，否则镜像流量会把这个口打满。'
  },
  {
    id: 'arp-static',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'ARP 静态绑定',
    kw: ['arp静态', '静态arp', 'arp绑定', '固定arp'],
    cmds: [
      ['华为', 'arp static 192.168.1.10 0011-2233-4455'],
      ['思科', 'arp 192.168.1.10 0011.2233.4455 arpa'],
      ['H3C', 'arp static 192.168.1.10 0011-2233-4455'],
      ['锐捷', 'arp 192.168.1.10 0011.2233.4455 arpa']
    ],
    tip: '关键服务器做静态 ARP 能防欺骗，但设备一换网卡就得改，维护成本不低。大规模还是靠 DAI。'
  },
  {
    id: 'vxlan',
    devs: ['Switch', 'Router'],
    name: 'VXLAN 基础（大二层）',
    kw: ['vxlan', '大二层', 'vni', 'overlay', '隧道封装'],
    cmds: [
      ['华为', 'bridge-domain 10\n vxlan vni 5010\ninterface Nve1\n source 1.1.1.1\n vni 5010 head-end peer-list 2.2.2.2'],
      ['思科', 'interface nve1\n no shutdown\n source-interface Loopback0\n member vni 5010\n  ingress-replication'],
      ['H3C', 'vsi vpn1\n vxlan 5010\ninterface Vsi-interface 1'],
      ['锐捷', 'vxlan vni 5010']
    ],
    tip: 'VXLAN 解决 VLAN 只有 4096 个、且跨机房二层打不通的问题。底层要有可达的 underlay 路由（通常是 OSPF/BGP）。'
  }
];

module.exports = { ROUTE2_EXTRA };
