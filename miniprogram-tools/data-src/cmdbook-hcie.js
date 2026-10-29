/**
 * HCIE-Datacom / H3CIE 专题：MPLS TE / SR-MPLS / SRv6 / EVPN-VXLAN
 * 这一批对应认证里最难、也是最容易在实验题里翻车的部分。
 * 命令均按厂商官方配置指南核对，版本差异写在 tip 里。
 */
const HCIE_EXTRA = [
  /* ================= MPLS TE ================= */
  {
    id: 'hcie-te-tunnel',
    devs: ['Router'],
    name: 'MPLS TE 隧道（RSVP-TE 动态建立）',
    kw: ['mpls te', 'te隧道', 'rsvp-te', '流量工程', '隧道接口', 'hcie'],
    cmds: [
      ['华为', 'mpls lsr-id 1.1.1.1\nmpls\n mpls te\n mpls te cspf\ninterface GigabitEthernet 0/0/1\n mpls\n mpls te\n mpls rsvp-te\ninterface Tunnel 0/0/1\n ip address unnumbered interface LoopBack0\n tunnel-protocol mpls te\n destination 3.3.3.3\n mpls te tunnel-id 100\n mpls te bandwidth ct0 10000\n mpls te commit'],
      ['思科', 'mpls traffic-eng tunnels\ninterface GigabitEthernet0/1\n mpls traffic-eng tunnels\n ip rsvp bandwidth 10000\ninterface Tunnel1\n tunnel mode mpls traffic-eng\n tunnel destination 3.3.3.3\n tunnel mpls traffic-eng bandwidth 10000\n tunnel mpls traffic-eng autoroute announce'],
      ['H3C', 'mpls lsr-id 1.1.1.1\nmpls ldp\nmpls te\nrsvp\ninterface GigabitEthernet 1/0/1\n mpls enable\n mpls te enable\n mpls te max-link-bandwidth 10000\n mpls te max-reservable-bandwidth 5000\n rsvp enable\ninterface Tunnel 1 mode mpls-te\n ip address unnumbered interface LoopBack0\n destination 3.3.3.3\n mpls te signaling rsvp-te\n mpls te bandwidth 2000'],
      ['锐捷', 'mpls traffic-eng tunnels\ninterface GigabitEthernet 0/1\n mpls traffic-eng tunnels\n ip rsvp bandwidth 10000\ninterface Tunnel1\n tunnel mode mpls traffic-eng\n tunnel destination 3.3.3.3\n tunnel mpls traffic-eng bandwidth 10000']
    ],
    tip: '三处最容易错：① 华为必须在隧道口 mpls te commit，不 commit 配置不生效、隧道永远 Down；② H3C 的 RSVP 是系统视图 rsvp + 接口 rsvp enable，不是华为那种 mpls rsvp-te；③ H3C 的隧道口要写 interface Tunnel 1 mode mpls-te，少了 mode 就建成了普通 Tunnel。带宽要先在接口上用 max-link-bandwidth 和 max-reservable-bandwidth 把可预留池开出来，池子是 0 的话隧道照样建不起来。'
  },
  {
    id: 'hcie-te-path',
    devs: ['Router'],
    name: 'TE 显式路径与流量引入',
    kw: ['显式路径', 'explicit-path', 'te引流量', '转发捷径', 'autoroute', 'hcie'],
    cmds: [
      ['华为', 'explicit-path pri-path\n next hop 10.1.1.2\n next hop 10.1.2.2\ninterface Tunnel 0/0/1\n mpls te path explicit-path pri-path\n mpls te igp shortcut ospf\n mpls te igp metric absolute 10\nospf 1\n enable traffic-adjustment'],
      ['思科', 'ip explicit-path name PRI enable\n next-address strict 10.1.1.2\n next-address strict 10.1.2.2\ninterface Tunnel1\n tunnel mpls traffic-eng path-option 10 explicit name PRI\n tunnel mpls traffic-eng autoroute announce'],
      ['H3C', 'explicit-path pri-path\n nexthop 10.1.1.2\n nexthop 10.1.2.2\ninterface Tunnel 1 mode mpls-te\n mpls te path preference 10 explicit-path pri-path'],
      ['锐捷', 'ip explicit-path name PRI enable\n next-address strict 10.1.1.2\n next-address strict 10.1.2.2\ninterface Tunnel1\n tunnel mpls traffic-eng path-option 10 explicit name PRI']
    ],
    tip: '显式路径的下一跳写的是「沿途接口地址」，不是 router-id。华为/H3C 用 next hop、思科/锐捷用 next-address strict，strict 表示必须直连、loose 允许中间插别的设备。要让 IGP 自动把流量引到隧道上，华为是隧道下 mpls te igp shortcut + OSPF 进程 enable traffic-adjustment 两步，只配第一步不生效。'
  },
  {
    id: 'hcie-te-frr',
    devs: ['Router'],
    name: 'TE FRR 与热 standby 备份隧道',
    kw: ['te frr', '快速重路由', '备份隧道', 'hot-standby', 'bypass', 'hcie'],
    cmds: [
      ['华为', 'interface Tunnel 0/0/1\n mpls te fast-reroute\n mpls te backup hot-standby\n mpls te commit'],
      ['思科', 'interface Tunnel1\n tunnel mpls traffic-eng fast-reroute\ninterface Tunnel2\n tunnel mode mpls traffic-eng\n tunnel destination 3.3.3.3\n tunnel mpls traffic-eng path-option 10 explicit name BACKUP'],
      ['H3C', 'interface Tunnel 1 mode mpls-te\n mpls te fast-reroute\n mpls te backup hot-standby mode ordinary'],
      ['锐捷', 'interface Tunnel1\n tunnel mpls traffic-eng fast-reroute']
    ],
    tip: 'FRR 是「主路径某一跳断了，由断点旁边的 PLR 立刻切到旁路」，靠预先算好的 bypass 隧道，切换在 50ms 级别；hot-standby 是备用隧道整体顶替，切换慢一些但不用依赖 PLR。HCIE 实验常考两者区别：FRR 保护的是链路/节点，hot-standby 保护的是整条隧道。'
  },
  {
    id: 'hcie-te-trouble',
    devs: ['Router'],
    name: 'TE 隧道起不来怎么查',
    kw: ['te隧道down', 'te排障', '隧道状态', 'cspf', 'te不通', 'hcie'],
    cmds: [
      ['华为', 'display mpls te tunnel-interface\n display interface Tunnel 0/0/1\ndisplay mpls rsvp-te peer\ndisplay mpls te cspf tedb all'],
      ['思科', 'show mpls traffic-eng tunnels\nshow mpls traffic-eng tunnels brief\nshow mpls traffic-eng topology\nshow ip rsvp interface'],
      ['H3C', 'display mpls te tunnel\n display interface Tunnel 1\ndisplay rsvp peer\ndisplay mpls te cspf tedb'],
      ['锐捷', 'show mpls traffic-eng tunnels\nshow mpls traffic-eng topology']
    ],
    tip: '按这个顺序查不会乱：先看隧道口是不是 Up（不是就看 destination 有没有路由）→ 再看 RSVP 邻居有没有起来（没起来是接口没开 mpls rsvp-te / rsvp enable）→ 再看 CSPF 的 TEDB 里有没有拓扑（没有是 IGP 没开 TE 扩展）→ 最后看带宽够不够。七成的情况卡在第二步：接口开了 mpls 而漏了 rsvp。'
  },

  /* ================= SR-MPLS ================= */
  {
    id: 'hcie-sr-mpls',
    devs: ['Router', 'Switch'],
    name: 'SR-MPLS BE（SRGB + Prefix-SID）',
    kw: ['segment routing', 'sr-mpls', 'srgb', 'prefix-sid', '段路由', 'hcie'],
    cmds: [
      ['华为', 'segment-routing\n tunnel-prefer segment-routing\nisis 1\n cost-style wide\n segment-routing mpls\n segment-routing global-block 16000 23999\ninterface LoopBack0\n isis prefix-sid index 10'],
      ['思科', 'router isis 1\n net 49.0001.0000.0000.0001.00\n metric-style wide\n segment-routing mpls\n segment-routing global-block 16000 23999\ninterface LoopBack0\n ip router isis 1\n isis prefix-sid index 10'],
      ['H3C', 'segment-routing\n global-block 16000 24000\nisis 1\n cost-style wide\n address-family ipv4 unicast\n  segment-routing mpls\ninterface LoopBack0\n isis prefix-sid index 10'],
      ['锐捷', 'router isis 1\n net 49.0001.0000.0000.0001.00\n metric-style wide\n segment-routing mpls\ninterface LoopBack0\n ip router isis 1\n isis prefix-sid index 10']
    ],
    tip: 'SRGB 全局块必须全网一致（各家默认值不一样，不一致就对不齐标签）。cost-style 必须 wide，窄度量带不了 SID 的扩展字段。Prefix-SID 配在 LoopBack 上，index 是相对偏移（index 10 + 块起点 16000 = 标签 16010），absolute 才是绝对标签。和 LDP 共存时用 tunnel-prefer segment-routing 让 SR 优先级更高。'
  },
  {
    id: 'hcie-sr-tilfa',
    devs: ['Router'],
    name: 'TI-LFA 与 SR 快速收敛',
    kw: ['ti-lfa', 'lfa', 'sr收敛', '无环备份', 'frr', 'hcie'],
    cmds: [
      ['华为', 'isis 1\n frr\n  loop-free-alternate level-1\n  ti-lfa level-1\nospf 1\n frr\n  loop-free-alternate\n  ti-lfa enable'],
      ['思科', 'router isis 1\n fast-reroute per-prefix level-1 all\n fast-reroute ti-lfa level-1'],
      ['H3C', 'isis 1\n address-family ipv4 unicast\n  fast-reroute lfa\n  fast-reroute ti-lfa level-1'],
      ['锐捷', 'router isis 1\n fast-reroute per-prefix level-1 all\n fast-reroute ti-lfa level-1']
    ],
    tip: 'TI-LFA 的价值在于「拓扑无关」——LFA 在环网、M-lag 这种拓扑里常常算不出备份路径，TI-LFA 用 SR 的段列表强行把报文从修复点拉到目的，覆盖率接近 100%。前提是这条链路上的设备都开了 SR，中间有一台没开就退化成普通 LFA。'
  },
  {
    id: 'hcie-sr-trouble',
    devs: ['Router', 'Switch'],
    name: 'SR-MPLS 标签与转发排查',
    kw: ['sr排障', 'sr标签', 'prefix-sid冲突', 'srgb冲突', 'sr不通', 'hcie'],
    cmds: [
      ['华为', 'display segment-routing prefix mpls forwarding\ndisplay tunnel-info all\ndisplay mpls lsp\ndisplay isis 1 peer verbose'],
      ['思科', 'show isis segment-routing prefix-sid-map\nshow mpls forwarding-table\nshow mpls label range\nshow isis neighbors detail'],
      ['H3C', 'display segment-routing prefix-sid\ndisplay mpls lsp\ndisplay isis peer verbose'],
      ['锐捷', 'show mpls forwarding-table\nshow isis neighbors detail']
    ],
    tip: 'SR 不通先看三件事：① SRGB 有没有重叠（两台设备块区间交叉，标签就指错地方）；② Prefix-SID 有没有冲突（同一 index 分给了两个前缀）；③ 前缀有没有 Active。日志里搜 SRGB_OVERLAP 和 PREFIX_SID_CONFLICT 命中率很高，比逐条 show 快。'
  },

  /* ================= SRv6 ================= */
  {
    id: 'hcie-srv6-be',
    devs: ['Router'],
    name: 'SRv6 BE（Locator + End.DT4）',
    kw: ['srv6', 'segment routing ipv6', 'locator', 'end.dt4', 'sid', 'hcie'],
    cmds: [
      ['华为', 'segment-routing ipv6\n encapsulation source-address 2001:DB8:1::1\n locator PE1 ipv6-prefix 2001:DB8:100:: 64 static 32\n  opcode ::100 end-dt4 vpn-instance vpn1\nisis 1\n segment-routing ipv6 locator PE1 auto-sid-disable'],
      ['H3C', 'segment-routing ipv6\n locator PE1 ipv6-prefix 2001:DB8:100:: 64 static 32\n  opcode ::100 end-dt4 vpn-instance vpn1\nisis 1\n address-family ipv6 unicast\n  segment-routing ipv6 locator PE1'],
      ['锐捷', 'segment-routing ipv6\n locator PE1 ipv6-prefix 2001:DB8:100:: 64 static 32\n  opcode ::100 end-dt4 vpn-instance vpn1\nrouter isis 1\n address-family ipv6 unicast\n  segment-routing ipv6 locator PE1']
    ],
    tip: 'Locator 的前缀长度和静态段长度决定可用 SID 数：/64 里留 32 位给 opcode，就是 2 的 32 次方个 SID。End.DT4 表示「剥掉 SRH 后查 IPv4 VPN 表转发」，L3VPN 必须用它；纯 IPv4 转发的 BE 场景用 End.DX4 或 End。auto-sid-disable 关掉自动分配，避免和手工 opcode 抢地址。思科这边是 IOS-XR 的 segment-routing srv6 体系，命令结构完全不同，不混在这一条里。'
  },
  {
    id: 'hcie-srv6-l3vpn',
    devs: ['Router'],
    name: 'L3VPN over SRv6 BE',
    kw: ['srv6 l3vpn', 'srv6 vpn', 'best-effort', 'prefix-sid', 'hcie'],
    cmds: [
      ['华为', 'bgp 100\n ipv4-family vpnv4\n  peer 2001:DB8:3::3 prefix-sid\n ipv4-family vpn-instance vpn1\n  segment-routing ipv6 locator PE1\n  segment-routing ipv6 best-effort'],
      ['H3C', 'bgp 100\n address-family vpnv4\n  peer 2001:DB8:3::3 prefix-sid\n ipv4-family vpn-instance vpn1\n  segment-routing ipv6 locator PE1\n  segment-routing ipv6 best-effort'],
      ['锐捷', 'router bgp 100\n address-family vpnv4\n  neighbor 2001:DB8:3::3 prefix-sid\n address-family ipv4 vrf vpn1\n  segment-routing ipv6 locator PE1\n  segment-routing ipv6 best-effort']
    ],
    tip: '两处必配：VPNv4 邻居下要加 prefix-sid（让 BGP 携带 SRv6 的 SID 属性，不加的话路由能传但报文没有 SID 可封装），VRF 的 BGP 下要 best-effort（表示用 BE 方式、不打 Policy）。PE 之间必须是 IPv6 可达的环回口建邻居，这条是最常见的翻车点——用 IPv4 建邻居，SID 属性根本带不过去。'
  },

  /* ================= EVPN / VXLAN ================= */
  {
    id: 'hcie-vxlan-evpn',
    devs: ['Switch', 'Router'],
    name: 'VXLAN + BGP EVPN 基础（控制面 + 数据面）',
    kw: ['vxlan evpn', 'bgp evpn', 'vni', 'nve', '头端复制', 'hcie', 'evpn rt', 'rt匹配', 'rt不通', 'evpn的rt', 'vpn-target', 'route-distinguisher'],
    cmds: [
      ['华为', 'bridge-domain 10\n vxlan vni 5010\n evpn\n  route-distinguisher 10:1\n  vpn-target 100:10\ninterface Nve1\n source 2.2.2.2\n vni 5010 head-end peer-list protocol bgp\nbgp 100\n l2vpn-family evpn\n  peer 3.3.3.3 enable\n  peer 3.3.3.3 advertise irb'],
      ['思科', 'feature nv overlay\nfeature vn-segment-vlan-based\nfeature bgp\nvlan 10\n vn-segment 5010\ninterface nve1\n no shutdown\n source-interface loopback0\n member vni 5010\n  ingress-replication protocol bgp\nrouter bgp 100\n address-family l2vpn evpn\n  neighbor 3.3.3.3 activate\n  neighbor 3.3.3.3 send-community extended'],
      ['H3C', 'l2vpn enable\nvsi vxlan10\n vxlan 5010\n evpn encapsulation vxlan\n  route-distinguisher 10:1\n  vpn-target 100:10 export-extcommunity\n  vpn-target 100:10 import-extcommunity\ninterface Tunnel 0 mode vxlan\n source 2.2.2.2\n destination 3.3.3.3\n vxlan vsi vxlan10\nbgp 100\n address-family l2vpn evpn\n  peer 3.3.3.3 enable'],
      ['锐捷', 'vlan 10\n vxlan vni 5010\ninterface nve1\n source 2.2.2.2\n member vni 5010\n  ingress-replication protocol bgp\nrouter bgp 100\n address-family l2vpn evpn\n  neighbor 3.3.3.3 activate']
    ],
    tip: '华为用 bridge-domain + Nve 接口；H3C 必须先用 l2vpn enable 才能建 VSI，数据面是手工建 interface Tunnel mode vxlan 再 vxlan vsi 绑定（这点和华为完全相反，华为的隧道是自动生成的）；思科在 Nexus 上要先开 feature nv overlay。三家都要在 EVPN 地址族里 send-community extended，否则 RT 传不过去。'
  },
  {
    id: 'hcie-evpn-gw',
    devs: ['Switch'],
    name: 'EVPN 分布式网关（Anycast Gateway）',
    kw: ['分布式网关', 'anycast gateway', 'vbdif', 'vsi-interface', 'irb', 'hcie'],
    cmds: [
      ['华为', 'ip vpn-instance vpn1\n vxlan vni 5010\n ipv4-family\n  route-distinguisher 20:1\n  vpn-target 100:5010 evpn\ninterface Vbdif10\n ip binding vpn-instance vpn1\n ip address 192.168.10.1 24\n vxlan anycast-gateway enable\n arp collect host enable\nbgp 100\n ipv4-family vpn-instance vpn1\n  advertise l2vpn evpn'],
      ['思科', 'vlan 10\n vn-segment 5010\ninterface Vlan10\n no shutdown\n vrf member vpn1\n ip address 192.168.10.1/24\n fabric forwarding mode anycast-gateway\nrouter bgp 100\n vrf vpn1\n  address-family ipv4 unicast\n   advertise l2vpn evpn'],
      ['H3C', 'ip vpn-instance vpn1\n address-family ipv4\n  route-distinguisher 20:1\n  vpn-target 100:5010 export-extcommunity\n  vpn-target 100:5010 import-extcommunity\ninterface Vsi-interface 5010\n ip binding vpn-instance vpn1\n ip address 192.168.10.1 24\n l3-vni 5010\nbgp 100\n ipv4-family vpn-instance vpn1\n  advertise l2vpn evpn'],
      ['锐捷', 'ip vrf vpn1\n rd 20:1\n route-target export 100:5010\n route-target import 100:5010\ninterface Vlan 10\n ip vrf forwarding vpn1\n ip address 192.168.10.1 255.255.255.0\nrouter bgp 100\n address-family ipv4 vrf vpn1\n  advertise l2vpn evpn']
    ],
    tip: '分布式网关的核心是「所有 Leaf 用同一个网关 IP 和同一个 MAC」——华为要 vxlan anycast-gateway enable + arp collect host enable（后者收集主机 ARP 用于生成主机路由，不配就只能在本地 VLAN 内互通），思科是 fabric forwarding mode anycast-gateway。三层转发要 advertise l2vpn evpn 把直连网段以 Type-5 前缀路由发出去，漏了这一步跨 VTEP 的三层就不通。'
  },
  {
    id: 'hcie-vxlan-trouble',
    devs: ['Switch', 'Router'],
    name: 'VXLAN 隧道与转发表排查',
    kw: ['vxlan不通', 'vxlan排障', '隧道状态', 'mac表', 'vni表', 'hcie'],
    cmds: [
      ['华为', 'display vxlan tunnel\ndisplay vxlan vni\ndisplay bridge-domain\ndisplay mac-address dynamic\ndisplay bgp evpn all routing-table'],
      ['思科', 'show nve peers\nshow nve vni\nshow bgp l2vpn evpn summary\nshow mac address-table dynamic vlan 10\nshow l2route evpn mac all'],
      ['H3C', 'display l2vpn vsi verbose\ndisplay vxlan tunnel\ndisplay mac-address\ndisplay bgp l2vpn evpn'],
      ['锐捷', 'show nve peers\nshow nve vni\nshow mac address-table dynamic']
    ],
    tip: '四步定位：① VTEP 之间能不能 ping 通（底层路由有没有通）；② display nve peers 里对端是不是 up（不是就查 EVPN 邻居和 VNI 配置）；③ VNI 表里 MAC 有没有学到（学不到是 EVPN 路由没收到，查 RT）；④ 学到了但 ping 不通，去看 Type-5 前缀路由和网关的 arp collect。八成问题在第三步的 RT 不匹配。'
  },

  /* ================= BGP / IGP 高级 ================= */
  {
    id: 'hcie-bgp-advanced',
    devs: ['Router', 'Switch'],
    name: 'BGP 高级特性（ADD-PATH / GTSM / 路由数量限制）',
    kw: ['add-path', 'bgp选路', 'gtsm', 'bgp安全', 'maximum-prefix', 'hcie'],
    cmds: [
      ['华为', 'bgp 100\n peer 2.2.2.2 capability-advertise add-path both\n peer 2.2.2.2 add-path send-path-number 4\n peer 2.2.2.2 valid-ttl-hops 255\n peer 2.2.2.2 password cipher <密码>\n peer 2.2.2.2 route-limit 1000'],
      ['思科', 'router bgp 100\n neighbor 2.2.2.2 capability additional-paths send\n neighbor 2.2.2.2 capability additional-paths receive\n neighbor 2.2.2.2 ttl-security hops 255\n neighbor 2.2.2.2 password <密码>\n neighbor 2.2.2.2 maximum-prefix 1000 80 warning-only'],
      ['H3C', 'bgp 100\n peer 2.2.2.2 capability-advertise add-path both\n peer 2.2.2.2 add-path send-path-number 4\n peer 2.2.2.2 valid-ttl-hops 255\n peer 2.2.2.2 password cipher <密码>\n peer 2.2.2.2 route-limit 1000'],
      ['锐捷', 'router bgp 100\n neighbor 2.2.2.2 capability additional-paths send\n neighbor 2.2.2.2 ttl-security hops 255\n neighbor 2.2.2.2 password <密码>\n neighbor 2.2.2.2 maximum-prefix 1000']
    ],
    tip: 'ADD-PATH 解决的是「BGP 默认只发最优一条」导致的路由丢失和收敛慢，RR 场景基本必开——不开的话客户端只能收到一条备份路径，主路径一断要等整轮收敛。GTSM 用 TTL 255 校验，防止远端伪造 BGP 报文攻击，两端必须都配同一个 hops 值。maximum-prefix 一定要带 warning-only 或 80 的门限，直接设死会导致邻居被 reset、业务全断。'
  },
  {
    id: 'hcie-isis-adv',
    devs: ['Router', 'Switch'],
    name: 'IS-IS 多级别与路由渗透（ATT 位）',
    kw: ['isis级别', 'level-1', 'level-2', '路由渗透', 'att位', 'hcie'],
    cmds: [
      ['华为', 'isis 1\n is-level level-1-2\n network-entity 49.0001.0000.0000.0001.00\n import-route isis level-2 into level-1\ninterface GigabitEthernet 0/0/1\n isis circuit-level level-2'],
      ['思科', 'router isis 1\n net 49.0001.0000.0000.0001.00\n is-type level-1-2\n metric-style wide\n redistribute isis ip level-2 into level-1\ninterface GigabitEthernet0/1\n ip router isis 1\n isis circuit-type level-2-only'],
      ['H3C', 'isis 1\n is-level level-1-2\n network-entity 49.0001.0000.0000.0001.00\n import-route isis level-2 into level-1\ninterface GigabitEthernet 1/0/1\n isis circuit-level level-2'],
      ['锐捷', 'router isis 1\n net 49.0001.0000.0000.0001.00\n is-type level-1-2\n metric-style wide\n redistribute isis ip level-2 into level-1']
    ],
    tip: 'L1 路由器只有一条到 L2 的默认路由，靠 L1/L2 路由器在 L1 LSP 里置 ATT 位实现。默认 L2 路由不进 L1，所以 L1 设备看不到明细——想做最优路径就得打路由渗透（import-route isis level-2 into level-1），但渗透会把 L2 全表灌进 L1，大网里要用 route-policy 过滤。这是 HCIE 排障题的经典陷阱：L1 设备 ping 不通另一个区域的明细网段，就是因为没渗透、只走了默认路由绕回。'
  },
  {
    id: 'hcie-bfd-nsr',
    devs: ['Router', 'Switch'],
    name: 'BFD 静态会话与 NSR / GR 高可用',
    kw: ['bfd静态', 'bfd会话', 'nsr', 'graceful-restart', '不中断转发', 'hcie'],
    cmds: [
      ['华为', 'bfd to-peer bind peer-ip 10.1.1.2\n discriminator local 1\n discriminator remote 2\n commit\nospf 1\n graceful-restart\nbgp 100\n graceful-restart\n nsr'],
      ['思科', 'interface GigabitEthernet0/1\n bfd interval 100 min_rx 100 multiplier 3\nrouter ospf 1\n nsf\nrouter bgp 100\n bgp graceful-restart\n neighbor 2.2.2.2 nsf'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n bfd min-transmit-interval 100\n bfd min-receive-interval 100\n bfd detect-multiplier 3\nospf 1\n graceful-restart\nbgp 100\n graceful-restart'],
      ['锐捷', 'interface GigabitEthernet 0/1\n bfd interval 100 min_rx 100 multiplier 3\nrouter ospf 1\n nsf\nrouter bgp 100\n bgp graceful-restart']
    ],
    tip: 'BFD 静态会话的 discriminator 必须两端互为镜像（本地 1 对远端 2、远端 1 对本机 2），配成一样就起不来，这是手工 BFD 最常见的错。NSR 和 GR 的区别要能说清：GR 是「控制面重启期间靠邻居帮忙保转发」，依赖邻居支持；NSR 是「本机主备控板同步了全部状态，重启时邻居完全无感知」，不依赖邻居。'
  },

  /* ================= QoS ================= */
  {
    id: 'hcie-qos-mqc',
    devs: ['Router', 'Switch'],
    name: 'MQC 流分类与优先级标记',
    kw: ['mqc', '流策略', 'traffic policy', 'dscp标记', 'qos分类', 'hcie'],
    cmds: [
      ['华为', 'traffic classifier c1 operator or\n if-match acl 3000\ntraffic behavior b1\n remark dscp ef\ntraffic policy p1\n classifier c1 behavior b1\ninterface GigabitEthernet 0/0/1\n traffic-policy p1 inbound'],
      ['思科', 'class-map match-any CM1\n match access-group 100\npolicy-map PM1\n class CM1\n  set dscp ef\ninterface GigabitEthernet0/1\n service-policy input PM1'],
      ['H3C', 'traffic classifier c1 operator or\n if-match acl 3000\ntraffic behavior b1\n remark dscp ef\nqos policy p1\n classifier c1 behavior b1\ninterface GigabitEthernet 1/0/1\n qos apply policy p1 inbound'],
      ['锐捷', 'class-map match-any CM1\n match access-group 100\npolicy-map PM1\n class CM1\n  set dscp ef\ninterface GigabitEthernet 0/1\n service-policy input PM1']
    ],
    tip: '华为和 H3C 都是「分类器 + 行为 + 策略」三段式，但套用到接口的命令不同：华为 traffic-policy、H3C qos apply policy，写混了直接报错。operator or 表示命中任一条件就算匹配，and 是全部命中；实验里常因为写 and 导致策略一条都没生效。DSCP 的 EF（46）留给语音，标记在接入侧做、核心侧只信任不重标。'
  },
  {
    id: 'hcie-qos-shaping',
    devs: ['Router'],
    name: '流量监管（CAR）与流量整形（GTS）',
    kw: ['流量监管', '流量整形', 'car', 'gts', 'shaping', 'hcie'],
    cmds: [
      ['华为', 'traffic behavior b1\n car cir 10000 pir 20000 cbs 187500 pbs 375000 green pass yellow pass red discard\ntraffic behavior b2\n gts cir 10000 cbs 200000'],
      ['思科', 'policy-map POLICE\n class CM1\n  police cir 10000000 bc 312500 pir 20000000 be 625000\n   conform-action transmit\n   exceed-action transmit\n   violate-action drop\npolicy-map SHAPE\n class class-default\n  shape average 10000000'],
      ['H3C', 'traffic behavior b1\n car cir 10000 pir 20000 cbs 187500 pbs 375000 green pass yellow pass red discard\ntraffic behavior b2\n gts cir 10000 cbs 200000'],
      ['锐捷', 'policy-map POLICE\n class CM1\n  police cir 10000000 bc 312500\n   conform-action transmit\n   exceed-action drop']
    ],
    tip: '监管（CAR/policer）是「超了就丢或降级」，会直接丢包；整形（GTS/shape）是「超了先缓存再发」，靠队列吸收突发，代价是增加时延。选型口诀：运营商边缘用监管（不能让客户超用），企业出口向内用整形（保住上行不丢包）。CIR 单位要注意——华为/H3C 的 car 写 kbps，思科的 police cir 写 bps，同一句话差 1000 倍，实验里翻车最多的就是这个。'
  },

  /* ================= 可编程运维 ================= */
  {
    id: 'hcie-telemetry',
    devs: ['Router', 'Switch'],
    name: 'Telemetry 与 NETCONF/YANG 采集',
    kw: ['telemetry', 'grpc', 'netconf', 'yang', 'sensor-group', 'hcie'],
    cmds: [
      ['华为', 'snetconf server enable\ntelemetry\n sensor-group g1\n  sensor-path huawei-devm:devm/cpuInfos/cpuInfo\n destination-group d1\n  ipv4-address 10.1.1.100 port 50001 protocol grpc no-tls\n subscription s1\n  sensor-group g1 sample-interval 5000\n  destination-group d1'],
      ['思科', 'netconf-yang\nnetconf-yang feature candidate-datastore\ntelemetry ietf subscription 1\n encoding encode-kvgpb\n source-address 10.1.1.1\n stream yang-push\n update-policy periodic 5000\n receiver ip address 10.1.1.100 57500 protocol grpc-tcp'],
      ['H3C', 'netconf soap http enable\nnetconf ssh server enable\ntelemetry\n sensor-group g1\n  sensor-path ifmgr/interfaceStatistics\n destination-group d1\n  ipv4-address 10.1.1.100 port 50001 protocol grpc\n subscription s1\n  sensor-group g1 sample-interval 5000\n  destination-group d1'],
      ['锐捷', 'netconf-yang enable\ntelemetry\n destination-group d1\n  ipv4-address 10.1.1.100 port 50001\n sensor-group g1\n  sensor-path rj-devm:devm/cpuInfo']
    ],
    tip: 'SNMP 是「拉」，Telemetry 是「推」——推模式才能做到秒级甚至毫秒级采集，这是它取代 SNMP 做流量分析的根本原因。三个组件必须齐：sensor-group（采什么）、destination-group（发到哪）、subscription（多久采一次、绑哪个组），少一个订阅就不生效。sensor-path 是 YANG 模型路径，各家私有模型不一样，抄别家的路径一定采不到数据。'
  },
  {
    id: 'hcie-slice',
    devs: ['Router', 'Switch'],
    name: '网络切片（FlexE 通道化）',
    kw: ['网络切片', 'network slice', 'flexe', 'flex-channel', '切片', 'hcie'],
    cmds: [
      ['华为', 'network-slice enable\nnetwork-slice protocol-number 160\nnetwork-slice instance 10\nnetwork-slice instance 20\ninterface 10GE1/0/1\n network-slice 10 flex-channel 1000\n network-slice 20 flex-channel 1000\ntraffic behavior b1\n network-slice 10\ntraffic policy p1\n classifier c1 behavior b1'],
      ['H3C', 'flexe enable\ninterface HundredGigE1/0/1\n flexe mode\n flexe client 10 bandwidth 1000\ninterface FlexE1/0/1:10\n ip address 10.1.1.1 24']
    ],
    tip: '切片的本质是把一个物理口用 FlexE 切成若干硬隔离的通道，每个通道有自己的带宽和队列，一条通道拥塞不影响另一条——这是硬切片和 QoS 软隔离的根本区别。华为是在物理口上 network-slice instance + flex-channel 划通道，再用流策略把业务引到指定切片；H3C 走的是 FlexE client 通道化，接口名会变成 FlexE1/0/1:10 这种形式。要注意整条路径上的每一台设备都要支持并开启，中间断一台切片就通了。'
  },
  {
    id: 'hcie-vrrp-adv',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'VRRP 高级（负载分担 + 上行跟踪 + BFD 联动）',
    kw: ['vrrp负载分担', 'vrrp跟踪', 'vrrp主备', 'vrrp切换慢', '上行链路', 'hcie'],
    cmds: [
      ['华为', 'interface Vlanif 10\n vrrp vrid 1 virtual-ip 192.168.10.254\n vrrp vrid 1 priority 120\n vrrp vrid 1 preempt-mode timer delay 20\n vrrp vrid 1 track interface GigabitEthernet 0/0/1 reduced 30\n vrrp vrid 1 track bfd-session 1 reduced 40\ninterface Vlanif 20\n vrrp vrid 2 virtual-ip 192.168.20.254'],
      ['思科', 'interface Vlan10\n vrrp 1 ip 192.168.10.254\n vrrp 1 priority 120\n vrrp 1 preempt delay minimum 20\n vrrp 1 track 1 decrement 30\ninterface Vlan20\n vrrp 2 ip 192.168.20.254'],
      ['H3C', 'interface Vlan-interface 10\n vrrp vrid 1 virtual-ip 192.168.10.254\n vrrp vrid 1 priority 120\n vrrp vrid 1 preempt-mode delay 20\n vrrp vrid 1 track interface GigabitEthernet 1/0/1 reduced 30\ninterface Vlan-interface 20\n vrrp vrid 2 virtual-ip 192.168.20.254'],
      ['锐捷', 'interface Vlan 10\n vrrp 1 ip 192.168.10.254\n vrrp 1 priority 120\n vrrp 1 preempt delay 20\n vrrp 1 track 1 decrement 30\ninterface Vlan 20\n vrrp 2 ip 192.168.20.254']
    ],
    tip: '负载分担就是在两个 VLAN 里把主备对调：VLAN10 让 A 当 Master、VLAN20 让 B 当 Master，两台都干活，不浪费带宽。三个坑：① 只配 priority 不配 preempt delay，主设备恢复后会立刻抢回，瞬断一次；② 不配 track，上行断了 VRRP 还以为自己健康，流量照样往死路送，所以必须 track 上行口或 track BFD；③ track 的 reduced 值要比 priority 差值大，否则降完还是 Master，等于没配。'
  },

  /* ================= SR-TE Policy ================= */
  {
    id: 'hcie-sr-te-policy',
    devs: ['Router'],
    name: 'SR-MPLS TE Policy（候选路径 + BSID）',
    kw: ['sr-te policy', 'sr policy', '候选路径', 'binding sid', 'bsid', 'hcie'],
    cmds: [
      ['华为', 'segment-routing\n segment-list pe1\n  index 10 sid label 330000\n  index 20 sid label 330002\n segment-list pe1backup\n  index 10 sid label 330001\n sr-te policy policy100 endpoint 3.3.3.9 color 100\n  binding-sid 115\n  candidate-path preference 100\n   segment-list pe1backup\n  candidate-path preference 200\n   segment-list pe1'],
      ['思科', 'segment-routing\n traffic-eng\n  segment-list SL1\n   index 10 mpls label 16010\n   index 20 mpls label 16020\n  policy POL1\n   color 10 end-point ipv4 3.3.3.3\n   candidate-paths\n    preference 100\n     explicit segment-list SL1'],
      ['H3C', 'segment-routing\n traffic-engineering\n  segment-list s1\n   index 10 mpls label 16020\n   index 20 mpls label 17030\n  policy p1\n   binding-sid mpls 15000\n   color 10 end-point ipv4 4.4.4.4\n   candidate-paths\n    preference 10\n     explicit segment-list s1']
    ],
    tip: 'SR Policy 是「颜色（Color）+ 终点（Endpoint）」三元组唯一标识一条策略，业务流量靠路由携带 Color 扩展团体去匹配，不需要像 RSVP-TE 那样逐跳建状态。候选路径的 preference 越大越优先，生效的是 preference 最高的那条，其余待命——所以备份路径要给较小的值，别写反。Binding SID 是这条 Policy 对外的入口标签，业务引流靠它，漏配就没有入口、Policy 是 Down 的。华三的 SID 列表写在 traffic-engineering 视图下、并且用 explicit segment-list 引用，这两点和华为不同。'
  },
  {
    id: 'hcie-srv6-te-policy',
    devs: ['Router'],
    name: 'SRv6 TE Policy（手工 SID 列表）',
    kw: ['srv6 te policy', 'srv6 policy', 'binding sid', 'sid list', 'hcie'],
    cmds: [
      ['华为', 'segment-routing ipv6\n segment-list list1\n  index 5 sid ipv6 2001:DB8:120::20\n  index 10 sid ipv6 2001:DB8:130::30\n srv6-te-policy locator PE1\n srv6-te policy policy1 endpoint 2001:DB8:3::3 color 101\n  binding-sid 2001:DB8:100::450\n  candidate-path preference 100\n   segment-list list1'],
      ['H3C', 'segment-routing ipv6\n traffic-engineering\n  segment-list s1\n   index 10 sid ipv6 2001:DB8:120::20\n  policy p1\n   color 10 end-point ipv6 2001:DB8:3::3\n   candidate-paths\n    preference 100\n     explicit segment-list s1']
    ],
    tip: 'SRv6 Policy 和 SR-MPLS Policy 的结构一样（Policy → 候选路径 → SID 列表），区别只在 SID 是 128 位 IPv6 地址而不是标签。华为要先 srv6-te-policy locator 指定用哪个 Locator 分配 BSID，H3C 没有这一步、直接写策略。手工指定路径时 SID 列表的顺序就是报文实际走的顺序，写反了流量会绕一大圈甚至不通——排查时先 display srv6-te policy 看候选路径是不是 Active。'
  },

  /* ================= 跨域 VPN ================= */
  {
    id: 'hcie-vpn-option-c',
    devs: ['Router'],
    name: 'MPLS VPN 跨域 Option C（ASBR 间传带标签路由）',
    kw: ['option c', '跨域vpn', 'inter-as', 'label-route-capability', 'send-label', 'hcie'],
    cmds: [
      ['华为', 'bgp 100\n peer 3.3.3.3 as-number 100\n peer 3.3.3.3 connect-interface LoopBack0\n ipv4-family vpnv4\n  peer 3.3.3.3 enable\n peer 202.1.1.2 as-number 200\n peer 202.1.1.2 label-route-capability\n ipv4-family unicast\n  network 1.1.1.1 32'],
      ['思科', 'router bgp 100\n neighbor 3.3.3.3 remote-as 100\n neighbor 3.3.3.3 update-source Loopback0\n address-family vpnv4\n  neighbor 3.3.3.3 activate\n neighbor 202.1.1.2 remote-as 200\n neighbor 202.1.1.2 send-label'],
      ['H3C', 'bgp 100\n peer 3.3.3.3 as-number 100\n peer 3.3.3.3 connect-interface LoopBack0\n address-family vpnv4\n  peer 3.3.3.3 enable\n peer 202.1.1.2 as-number 200\n peer 202.1.1.2 label-route-capability'],
      ['锐捷', 'router bgp 100\n neighbor 3.3.3.3 remote-as 100\n neighbor 3.3.3.3 update-source Loopback0\n address-family vpnv4\n  neighbor 3.3.3.3 activate\n neighbor 202.1.1.2 remote-as 200\n neighbor 202.1.1.2 send-label']
    ],
    tip: '三种跨域的核心区别要能一句话说清：A 是 ASBR 上每个 VPN 一个 VRF 背靠背（简单但设备扛不住），B 是 ASBR 之间直接传 VPNv4（要求 ASBR 也跑 MPLS），C 是 ASBR 之间只传「带标签的 PE 环回路由」、VPNv4 邻居在两端 PE 之间直接建（最省设备、最主流）。C 的关键就是 label-route-capability / send-label，不加这条 ASBR 只传普通 IP 路由，PE 之间拿不到对端环回口的标签，VPNv4 邻居永远起不来。'
  },
  {
    id: 'hcie-evpn-multihoming',
    devs: ['Switch', 'Router'],
    name: 'EVPN 多归属（ESI 与 DF 选举）',
    kw: ['evpn多归属', 'esi', 'df选举', '双归', 'all-active', 'hcie'],
    cmds: [
      ['华为', 'evpn\n esi dynamic-name esi1\n evpn redundancy-mode all-active\n df-election type preference-based\n preference 100\n non-revertive\ninterface Eth-Trunk 1\n mode lacp-static\n esi dynamic esi1\ntimer df-delay 0'],
      ['思科', 'evpn\nesi multi-homing\ninterface port-channel1\n switchport mode trunk\n evpn ethernet-segment\n  identifier 0000:1111:2222:3333:4444\n  redundancy all-active'],
      ['H3C', 'evpn\n esi esi1\n  redundancy-mode all-active\ninterface Bridge-Aggregation 1\n link-aggregation mode dynamic\n esi esi1']
    ],
    tip: 'ESI 是「这条链路属于同一个以太网段」的唯一标识，两台 PE 连同一个 CE 必须配同一个 ESI，PE 之间靠 ES 路由和 AD 路由互相认识。DF（指定转发者）负责把 BUM 流量只发给其中一台、避免重复——all-active 下每台都转发单播、只有 DF 转 BUM；single-active 下只有一台转发全部流量。华为除了静态 esi 还可以 mode lacp-static 自动生成（格式 01 + LACP 系统 MAC + 端口 Key），但生产上官方也推荐写静态 ESI，因为 DF 切换更快。单归场景若误配了 ESI，接口 Up 会触发延迟 DF 选举、BUM 断流，要用 timer df-delay 0 关掉。'
  },

  /* ================= 防火墙与接入认证 ================= */
  {
    id: 'hcie-fw-ha',
    devs: ['防火墙'],
    name: '防火墙双机热备（HRP / failover）',
    kw: ['双机热备', 'hrp', '防火墙主备', '会话同步', 'failover', 'hcie'],
    cmds: [
      ['华为', 'hrp interface GigabitEthernet 1/0/7 remote 10.10.0.2\nhrp authentication-key <密钥>\nhrp track interface GigabitEthernet 1/0/1\nhrp track interface GigabitEthernet 1/0/3\nhrp mirror session enable\nhrp preempt delay 60\nhrp adjust ospf-cost enable\nhrp enable\ndisplay hrp state\ndisplay hrp interface'],
      ['思科', 'failover lan interface FAILOVER GigabitEthernet0/3\nfailover interface ip FAILOVER 10.10.0.1 255.255.255.0 standby 10.10.0.2\nfailover lan unit primary\nfailover replication http\nfailover\nshow failover\nshow failover history']
    ],
    tip: '顺序不能乱：先配心跳接口和认证密钥 → 再配 hrp track 监控上下行业务口 → 最后 hrp enable，顺序反了会先切主备再改配置、业务抖一次。hrp track 是双机热备的灵魂——不监控上行口，上行断了主设备还以为自己健康、不切换，流量全黑洞。负载分担组网必须加 hrp mirror session enable，否则来回路径不一致、会话表对不上。display hrp state 里 HRP_M 是主、HRP_S 是备，两台都显示 HRP_M 就是心跳断了。华三这边对应的是 RBM（remote-backup group）体系，命令结构完全不同，不能照抄 HRP。'
  },
  {
    id: 'hcie-8021x',
    devs: ['Switch', 'AC', '防火墙'],
    name: '802.1X 接入认证（RADIUS）',
    kw: ['802.1x', 'dot1x', 'radius认证', '准入', '端口认证', 'hcie'],
    cmds: [
      ['华为', 'dot1x enable\nradius-server template rd1\n radius-server shared-key cipher <密钥>\n radius-server authentication 10.1.1.1 1812\naaa\n authentication-scheme sch1\n  authentication-mode radius\n domain default\n  authentication-scheme sch1\ninterface GigabitEthernet 0/0/1\n dot1x enable'],
      ['思科', 'aaa new-model\nradius server RAD1\n address ipv4 10.1.1.1 auth-port 1812 acct-port 1813\n key <密钥>\naaa authentication dot1x default group radius\ndot1x system-auth-control\ninterface GigabitEthernet0/1\n switchport mode access\n authentication port-control auto\n dot1x pae authenticator'],
      ['H3C', 'dot1x\nradius scheme rd1\n primary authentication 10.1.1.1\n key authentication simple <密钥>\ndomain default\n authentication lan-access radius-scheme rd1\ninterface GigabitEthernet 1/0/1\n dot1x'],
      ['锐捷', 'aaa new-model\nradius-server host 10.1.1.1 key <密钥>\naaa authentication dot1x default group radius\ndot1x\ninterface GigabitEthernet 0/1\n dot1x port-control auto']
    ],
    tip: '802.1X 有三段必须都通：终端（ supplicant ）→ 交换机（ authenticator ）→ RADIUS 服务器。排障顺序就是这三段：先看端口是不是 unauthorized（display dot1x），再看 RADIUS 报文有没有发出去、有没有回应，最后看服务器侧账号和共享密钥。最常见的两个错：① 全局 dot1x 开了但端口下没开，端口永远是 authorized；② RADIUS 共享密钥两端不一致，现象是请求发出去了、服务器不回，日志里只有超时，很难看出来。端口模式选 auto，force-authorized 等于不认证，实验里别用错。'
  }
];

module.exports = { HCIE_EXTRA };
