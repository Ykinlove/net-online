// utils/cmdbook-route.js —— 命令百科扩充：路由器 / 无线（AC、AP）/ 防火墙

const ROUTE_EXTRA = [
  {
    id: 'if-ip',
    devs: ['Router', '防火墙'],
    name: '接口配置 IP 地址',
    kw: ['配ip', '接口地址', 'ip address', '三层口', '给接口配地址'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0\n ip address 192.168.1.1 24'],
      ['思科', 'interface GigabitEthernet 0/0\n ip address 192.168.1.1 255.255.255.0\n no shutdown'],
      ['H3C', 'interface GigabitEthernet 1/0/0\n ip address 192.168.1.1 24'],
      ['锐捷', 'interface GigabitEthernet 0/0\n ip address 192.168.1.1 255.255.255.0\n no shutdown']
    ],
    tip: '思科 / 锐捷的物理口默认 shutdown，必须 no shutdown 才会 up。'
  },
  {
    id: 'sub-if',
    devs: ['Router'],
    name: '子接口（单臂路由）',
    kw: ['子接口', '单臂路由', 'sub-interface', '一根线跑多vlan', '802.1q'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0.10\n dot1q termination vid 10\n ip address 192.168.10.1 24\n arp broadcast enable'],
      ['思科', 'interface GigabitEthernet 0/0.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0'],
      ['H3C', 'interface GigabitEthernet 1/0/0.10\n vlan-type dot1q vid 10\n ip address 192.168.10.1 24'],
      ['锐捷', 'interface GigabitEthernet 0/0.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0']
    ],
    tip: '华为子接口封 dot1q 之后必须补 arp broadcast enable，否则 ARP 发不出去，业务不通。'
  },
  {
    id: 'pppoe',
    devs: ['Router', '防火墙'],
    name: 'PPPoE 拨号上网',
    kw: ['pppoe', '拨号', '宽带拨号', 'adsl', 'dialer'],
    cmds: [
      ['华为', 'interface Dialer 1\n ppp chap user <宽带账号>\n ppp chap password cipher <密码>\n ip address ppp-negotiate\ndialer-rule 1 ip permit\ninterface GigabitEthernet 0/0/1\n pppoe-client dial-bundle-number 1'],
      ['思科', 'interface Dialer 1\n encapsulation ppp\n ip address negotiated\n ppp chap hostname <账号>\n ppp chap password <密码>\ninterface GigabitEthernet 0/0\n pppoe enable\n pppoe-client dial-pool-number 1'],
      ['H3C', 'interface Dialer 1\n ppp chap user <账号>\n ppp chap password simple <密码>\n ip address ppp-negotiate\ninterface GigabitEthernet 1/0/1\n pppoe-client dial-bundle-number 1'],
      ['锐捷', 'interface Dialer 1\n encapsulation ppp\n ip address negotiated\n ppp chap hostname <账号>\n ppp chap password <密码>']
    ],
    tip: '把内网口加进 NAT（nat outbound / ip nat inside）才算真正能上网，光拨号通只能路由器自己 ping 外网。'
  },
  {
    id: 'nat-server',
    devs: ['Router', '防火墙'],
    name: 'NAT Server（端口映射）',
    kw: ['端口映射', 'nat server', '发布内网服务', '外网访问内网', 'dnat'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0\n nat server protocol tcp global current-interface 8080 inside 192.168.1.10 80'],
      ['思科', 'ip nat inside source static tcp 192.168.1.10 80 interface GigabitEthernet 0/0 8080'],
      ['H3C', 'interface GigabitEthernet 1/0/0\n nat server protocol tcp global current-interface 8080 inside 192.168.1.10 80'],
      ['锐捷', 'ip nat inside source static tcp 192.168.1.10 80 interface GigabitEthernet 0/0 8080']
    ],
    tip: '映射不通时按顺序查：内网能访问吗 → 映射端口通吗 → 防火墙放行了吗 → 服务器网关指向这台设备吗。'
  },
  {
    id: 'bgp',
    devs: ['Router', '防火墙'],
    name: 'BGP 邻居配置',
    kw: ['bgp', '对等体', 'as号', 'peer', '运营商对接'],
    cmds: [
      ['华为', 'bgp 65001\n router-id 1.1.1.1\n peer 192.168.12.2 as-number 65002\n network 10.1.1.0 24'],
      ['思科', 'router bgp 65001\n bgp router-id 1.1.1.1\n neighbor 192.168.12.2 remote-as 65002\n network 10.1.1.0 mask 255.255.255.0'],
      ['H3C', 'bgp 65001\n router-id 1.1.1.1\n peer 192.168.12.2 as-number 65002\n address-family ipv4 unicast\n  network 10.1.1.0 24'],
      ['锐捷', 'router bgp 65001\n bgp router-id 1.1.1.1\n neighbor 192.168.12.2 remote-as 65002\n network 10.1.1.0 mask 255.255.255.0']
    ],
    tip: 'BGP 起不来先查 TCP 179 通不通，再看 AS 号、更新源（update-source）配没配对。'
  },
  {
    id: 'ospf-multi',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'OSPF 多区域 + 被动接口',
    kw: ['ospf多区域', 'area', '被动接口', 'silent-interface', '骨干区域'],
    cmds: [
      ['华为', 'ospf 1 router-id 1.1.1.1\n area 0\n  network 10.1.1.0 0.0.0.255\n area 1\n  network 10.2.2.0 0.0.0.255\n silent-interface GigabitEthernet 0/0/2'],
      ['思科', 'router ospf 1\n router-id 1.1.1.1\n network 10.1.1.0 0.0.0.255 area 0\n network 10.2.2.0 0.0.0.255 area 1\n passive-interface GigabitEthernet 0/2'],
      ['H3C', 'ospf 1 router-id 1.1.1.1\n area 0\n  network 10.1.1.0 0.0.0.255\n area 1\n  network 10.2.2.0 0.0.0.255\n silent-interface GigabitEthernet 1/0/2'],
      ['锐捷', 'router ospf 1\n router-id 1.1.1.1\n network 10.1.1.0 0.0.0.255 area 0\n passive-interface GigabitEthernet 0/2']
    ],
    tip: '接终端的接口配被动接口，既不浪费 Hello 报文，也不会把终端网段的路由瞎通告出去。'
  },
  {
    id: 'rip',
    devs: ['Router'],
    name: 'RIP 基础配置',
    kw: ['rip', '距离矢量', '老网络', 'version 2'],
    cmds: [
      ['华为', 'rip 1\n version 2\n network 10.0.0.0'],
      ['思科', 'router rip\n version 2\n network 10.0.0.0\n no auto-summary'],
      ['H3C', 'rip 1\n version 2\n network 10.0.0.0'],
      ['锐捷', 'router rip\n version 2\n network 10.0.0.0\n no auto-summary']
    ],
    tip: 'RIP 宣告的是主类网段，思科 / 锐捷记得关 auto-summary，否则子网会被汇总成一条。'
  },
  {
    id: 'pbr',
    devs: ['Router', 'Switch', '防火墙'],
    name: '策略路由（PBR）',
    kw: ['策略路由', 'pbr', 'policy-based-route', '指定出口', '源地址走哪条线'],
    cmds: [
      ['华为', 'acl 3000\n rule 5 permit ip source 192.168.1.0 0.0.0.255\npolicy-based-route p1 permit node 10\n if-match acl 3000\n apply ip-address next-hop 10.1.1.2'],
      ['思科', 'access-list 100 permit ip 192.168.1.0 0.0.0.255 any\nroute-map p1 permit 10\n match ip address 100\n set ip next-hop 10.1.1.2\ninterface GigabitEthernet 0/1\n ip policy route-map p1'],
      ['H3C', 'acl advanced 3000\n rule 5 permit ip source 192.168.1.0 0.0.0.255\npolicy-based-route p1 permit node 10\n if-match acl 3000\n apply next-hop 10.1.1.2'],
      ['锐捷', 'access-list 100 permit ip 192.168.1.0 0.0.0.255 any\nroute-map p1 permit 10\n match ip address 100\n set ip next-hop 10.1.1.2']
    ],
    tip: '策略路由优先于路由表，配错了会直接绕开正常路由，排障时先查有没有 PBR。'
  },
  {
    id: 'route-map',
    devs: ['Router', 'Switch'],
    name: '路由策略 route-map',
    kw: ['route-map', '路由重分发', 'redistribute', '路由过滤', '引入直连'],
    cmds: [
      ['华为', 'route-policy rp1 permit node 10\n if-match acl 2000\n apply cost 100\nospf 1\n import-route direct route-policy rp1'],
      ['思科', 'route-map rp1 permit 10\n match ip address 1\n set metric 100\nrouter ospf 1\n redistribute connected route-map rp1'],
      ['H3C', 'route-policy rp1 permit node 10\n if-match acl 2000\n apply cost 100\nospf 1\n import-route direct route-policy rp1'],
      ['锐捷', 'route-map rp1 permit 10\n match ip address 1\n set metric 100\nrouter ospf 1\n redistribute connected route-map rp1']
    ],
    tip: 'route-map 末尾默认拒绝所有，最后一定补一条空的 permit node 9999 / permit 9999 放行其余。'
  },
  {
    id: 'ip-prefix',
    devs: ['Router', 'Switch'],
    name: '前缀列表 / 分发列表',
    kw: ['前缀列表', 'ip-prefix', 'prefix-list', '过滤路由', 'distribution'],
    cmds: [
      ['华为', 'ip ip-prefix p1 permit 10.1.0.0 16 less-equal 24\nospf 1\n filter-policy ip-prefix p1 export'],
      ['思科', 'ip prefix-list p1 permit 10.1.0.0/16 le 24\nrouter ospf 1\n distribute-list prefix p1 in'],
      ['H3C', 'ip prefix-list p1 index 10 permit 10.1.0.0 16 less-equal 24\nospf 1\n filter-policy prefix-list p1 export'],
      ['锐捷', 'ip prefix-list p1 permit 10.1.0.0/16 le 24\nrouter ospf 1\n distribute-list prefix p1 in']
    ],
    tip: '掩码写法不同：华为 / H3C 用空格分长度，思科 / 锐捷用斜杠 CIDR。'
  },
  {
    id: 'gre',
    devs: ['Router', '防火墙'],
    name: 'GRE 隧道',
    kw: ['gre', '隧道', 'tunnel', '打通两个机房'],
    cmds: [
      ['华为', 'interface Tunnel 0/0/0\n tunnel-protocol gre\n source 202.1.1.1\n destination 202.2.2.2\n ip address 10.0.0.1 30'],
      ['思科', 'interface Tunnel0\n tunnel mode gre ip\n tunnel source 202.1.1.1\n tunnel destination 202.2.2.2\n ip address 10.0.0.1 255.255.255.252'],
      ['H3C', 'interface Tunnel 0\n mode gre\n source 202.1.1.1\n destination 202.2.2.2\n ip address 10.0.0.1 30'],
      ['锐捷', 'interface Tunnel 0\n tunnel mode gre ip\n tunnel source 202.1.1.1\n tunnel destination 202.2.2.2\n ip address 10.0.0.1 255.255.255.252']
    ],
    tip: 'GRE 本身不加密也不认证，跑公网必须叠 IPSec，否则里面的流量等于明文。'
  },
  {
    id: 'ipsec',
    devs: ['Router', '防火墙'],
    name: 'IPSec VPN（站点到站点）',
    kw: ['ipsec', 'vpn', '加密隧道', '总部分支互联', 'ike'],
    cmds: [
      ['华为', 'ike proposal 1\nike peer p1 v1\n pre-shared-key cipher <密钥>\n remote-address 202.2.2.2\nipsec proposal ip1\nacl 3000\n rule 5 permit ip source 10.1.1.0 0.0.0.255 destination 10.2.2.0 0.0.0.255\nipsec policy pol1 10 isakmp\n security acl 3000\n ike-peer p1\n proposal ip1'],
      ['思科', 'crypto isakmp policy 10\n encryption aes\n hash sha\n authentication pre-share\ncrypto isakmp key <密钥> address 202.2.2.2\ncrypto ipsec transform-set ts esp-aes esp-sha-hmac\ncrypto map cm 10 ipsec-isakmp\n set peer 202.2.2.2\n set transform-set ts\n match address 100'],
      ['H3C', 'ike proposal 1\nike keychain k1\n pre-shared-key address 202.2.2.2 key simple <密钥>\nipsec transform-set ts\n esp encryption-algorithm aes-cbc-128\nipsec policy pol1 10 isakmp\n security acl 3000\n remote-address 202.2.2.2'],
      ['锐捷', 'crypto isakmp policy 10\n encryption aes\n hash sha\ncrypto isakmp key <密钥> address 202.2.2.2\ncrypto ipsec transform-set ts esp-aes esp-sha-hmac\ncrypto map cm 10 ipsec-isakmp\n set peer 202.2.2.2']
    ],
    tip: 'VPN 起不来按四步查：IKE 阶段一（公网可达+预共享密钥）→ 阶段二（ACL 镜像）→ 感兴趣流（ACL 两边必须互为镜像）→ NAT 是否把流量提前转走了。'
  },
  {
    id: 'bfd',
    devs: ['Router', 'Switch'],
    name: 'BFD 快速检测',
    kw: ['bfd', '链路检测', '快速切换', '毫秒级收敛', '配bfd', 'bfd怎么配'],
    cmds: [
      ['华为', 'bfd\ninterface GigabitEthernet 0/0/1\n bfd min-tx-interval 100 min-rx-interval 100 detect-multiplier 3'],
      ['思科', 'interface GigabitEthernet 0/1\n bfd interval 100 min_rx 100 multiplier 3'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n bfd min-transmit-interval 100 min-receive-interval 100 detect-multiplier 3'],
      ['锐捷', 'interface GigabitEthernet 0/1\n bfd interval 100 min_rx 100 multiplier 3']
    ],
    tip: 'BFD 要和静态路由 / OSPF / VRRP 联动才有意义，光开 BFD 不会自动切换。'
  },
  {
    id: 'time-acl',
    devs: ['Router', 'Switch', '防火墙'],
    name: '基于时间的 ACL',
    kw: ['时间段acl', 'time-range', '上班时间限制', '定时放行'],
    cmds: [
      ['华为', 'time-range work 08:00 to 18:00 working-day\nacl 3000\n rule 5 deny tcp destination-port eq 80 time-range work'],
      ['思科', 'time-range work\n periodic weekdays 8:00 to 18:00\naccess-list 100 deny tcp any any eq 80 time-range work'],
      ['H3C', 'time-range work 08:00 to 18:00 working-day\nacl advanced 3000\n rule 5 deny tcp destination-port eq 80 time-range work'],
      ['锐捷', 'time-range work\n periodic weekdays 8:00 to 18:00\naccess-list 100 deny tcp any any eq 80 time-range work']
    ],
    tip: '依赖设备时钟准确，时区和 NTP 没配好，时间段 ACL 会按错误时间生效。'
  },
  {
    id: 'ecmp',
    devs: ['Router', 'Switch', '防火墙'],
    name: '等价路由与浮动静态路由',
    kw: ['负载均衡', '等价路由', '浮动路由', '主备链路', '备份路由'],
    cmds: [
      ['华为', 'ip route-static 0.0.0.0 0 202.1.1.1\nip route-static 0.0.0.0 0 202.2.2.1 preference 70'],
      ['思科', 'ip route 0.0.0.0 0.0.0.0 202.1.1.1\nip route 0.0.0.0 0.0.0.0 202.2.2.1 70'],
      ['H3C', 'ip route-static 0.0.0.0 0 202.1.1.1\nip route-static 0.0.0.0 0 202.2.2.1 preference 70'],
      ['锐捷', 'ip route 0.0.0.0 0.0.0.0 202.1.1.1\nip route 0.0.0.0 0.0.0.0 202.2.2.1 70']
    ],
    tip: '两条默认路由写同样优先级就是等价负载，第二条写大一点的优先级（70）就变成主备。'
  },
  {
    id: 'dhcp-client',
    devs: ['Router', '防火墙'],
    name: '接口自动获取 IP（DHCP 客户端）',
    kw: ['自动获取ip', 'dhcp客户端', 'ip address dhcp', '动态地址'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n ip address dhcp-alloc'],
      ['思科', 'interface GigabitEthernet 0/1\n ip address dhcp'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n ip address dhcp-alloc'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ip address dhcp']
    ],
    tip: '光猫下面直接接设备时用得上，起来后 display ip interface brief 看有没有拿到地址。'
  },

  /* ---------------- 无线 ---------------- */
  {
    id: 'wlan-ap-group',
    devs: ['AC'],
    name: 'AP 组与批量配置',
    kw: ['ap组', 'ap-group', 'ap分组', '批量ap'],
    cmds: [
      ['华为', 'ap-group name office\n ap-name ap-1\n ap-name ap-2'],
      ['思科', 'config ap group-name office ap-1\nconfig ap group-name office ap-2'],
      ['H3C', 'wlan ap-group office\n ap ap-1\n ap ap-2'],
      ['锐捷', 'ap-group office\n ap-name ap-1']
    ],
    tip: '把 AP 编进组，改配置只改组就行，不用一台台刷。'
  },
  {
    id: 'wlan-ssid',
    devs: ['AC'],
    name: '配置 SSID / WiFi 密码（WPA2-PSK）',
    kw: ['ssid', 'wifi名称', '无线信号', '配wifi', 'wpa2', 'psk', '改wifi密码', 'wifi密码怎么改', '无线密码怎么改', '改无线密码'],
    cmds: [
      ['华为', 'ssid-profile name sp1\n ssid office-wifi\nsecurity-profile name sc1\n security wpa2 psk pass-phrase <密码> aes\nvap-profile name vp1\n ssid-profile sp1\n security-profile sc1\nap-group name default\n vap-profile vp1 wlan 1 radio all'],
      ['思科', 'config wlan create 1 office-wifi office-wifi\nconfig wlan security wpa akm psk set-key ascii 0 <密码> 1\nconfig wlan enable 1'],
      ['H3C', 'wlan service-template 1\n ssid office-wifi\n akm mode psk\n preshared-key pass-phrase simple <密码>\n cipher-suite ccmp\n security-ie rsn\n service-template enable'],
      ['锐捷', 'wlan-config 1 office-wifi\n ssid office-wifi\nwlansec 1\n security rsn enable\n security rsn akm psk set-key ascii 0 <密码>']
    ],
    tip: '华为是「SSID 模板 + 安全模板 + VAP 模板」三层套娃，改 SSID 名要进 ssid-profile，别在 VAP 里找。'
  },
  {
    id: 'wlan-auth-dot1x',
    devs: ['AC'],
    name: 'WLAN 802.1X 认证',
    kw: ['802.1x', '企业认证', 'radius', '账号密码认证', 'dot1x'],
    cmds: [
      ['华为', 'security-profile name sc1\n security wpa2 dot1x aes\nradius-server template rd1\n radius-server shared-key cipher <密钥>\n radius-server authentication 192.168.1.10 1812'],
      ['思科', 'config radius auth add 1 192.168.1.10 1812 ascii <密钥>\nconfig wlan security wpa akm 802.1x enable 1'],
      ['H3C', 'radius scheme rd1\n primary authentication 192.168.1.10\n key authentication simple <密钥>\nwlan service-template 1\n akm mode dot1x\n client-security authentication-mode dot1x'],
      ['锐捷', 'radius-server host 192.168.1.10 key <密钥>\nwlansec 1\n security rsn akm dot1x']
    ],
    tip: '认证一直失败先看 RADIUS 共享密钥两边是否一致，再看 NAS-IP 配的是不是 AC 自己的地址。'
  },
  {
    id: 'wlan-portal',
    devs: ['AC'],
    name: 'WLAN Portal 认证',
    kw: ['portal', '微信认证', '网页认证', '短信认证', '访客wifi'],
    cmds: [
      ['华为', 'web-auth-server ws1\n server-ip 192.168.1.20\n port 8080\n shared-key cipher <密钥>\nvap-profile name vp1\n authentication-profile ap1'],
      ['思科', 'config wlan security web-auth enable 1\nconfig wlan security web-auth server 1 192.168.1.20'],
      ['H3C', 'portal server ps1\n ip 192.168.1.20 key simple <密钥>\nwlan service-template 1\n client-security authentication-mode portal'],
      ['锐捷', 'web-auth template ws1\n ip 192.168.1.20\nwlansec 1\n web-auth portal ws1']
    ],
    tip: 'Portal 不通先分清是页面打不开还是认证不过：前者查 DNS 和放行，后者查 RADIUS。'
  },
  {
    id: 'wlan-radio',
    devs: ['AC', 'AP'],
    name: '射频信道与功率',
    kw: ['信道', '功率', 'channel', 'power', '信号弱', '调功率', '无线信号弱', '信号差', '信号不好'],
    cmds: [
      ['华为', 'ap-group name default\n radio 0\n  channel 20mhz 6\n  power 15'],
      ['思科', 'config 802.11b channel ap ap-1 6\nconfig 802.11b txpower ap ap-1 15'],
      ['H3C', 'wlan ap ap-1 model WA6320\n radio 1\n  channel 6\n  max-power 15'],
      ['锐捷', 'ap-config ap-1\n channel 6\n power 15']
    ],
    tip: '2.4G 只用 1 / 6 / 11 三个不重叠信道，相邻 AP 错开用，别图省事全填 6。'
  },
  {
    id: 'wlan-dca',
    devs: ['AC'],
    name: '射频调优（自动信道/功率）',
    kw: ['射频调优', 'dca', '自动信道', '自动功率', '无线优化'],
    cmds: [
      ['华为', 'rrm-profile name rr1\n calibrate auto-channel-select enable\n calibrate auto-txpower-select enable\nap-group name default\n radio 0\n  rrm-profile rr1'],
      ['思科', 'config 802.11b channel global auto\nconfig 802.11b txpower global auto'],
      ['H3C', 'wlan rrm\n calibrate-channel self-decisive enable\n calibrate-power self-decisive enable'],
      ['锐捷', 'ac-controller\n dca enable']
    ],
    tip: '自动调优 ≠ 不用管。调优后要复查一遍，密集场景经常需要手动压功率。'
  },
  {
    id: 'wlan-clients',
    devs: ['AC'],
    name: '查看在线终端',
    kw: ['在线终端', '连了几个手机', 'sta', '客户端列表', '谁连着wifi'],
    cmds: [
      ['华为', 'display station ssid office-wifi\ndisplay station all'],
      ['思科', 'show client summary'],
      ['H3C', 'display wlan client verbose'],
      ['锐捷', 'show sta all']
    ],
    tip: '终端显示在线但上不了网，多半是地址池或 DHCP 中继的问题，别只在 AC 上找。'
  },
  {
    id: 'wlan-signal',
    devs: ['AC', 'AP'],
    name: '查看 AP 信号与干扰',
    kw: ['信号强度', 'rssi', '干扰', '噪声', 'wifi慢'],
    cmds: [
      ['华为', 'display station assoc-info\ndisplay ap radio 0'],
      ['思科', 'show ap auto-rf 802.11b ap-1'],
      ['H3C', 'display wlan client verbose\ndisplay wlan ap ap-1 radio 1'],
      ['锐捷', 'show ap-config summary\nshow sta all']
    ],
    tip: '用户说「WiFi 慢」先看两点：RSSI 低于 -70dBm 是覆盖问题，噪声高于 -85dBm 是干扰问题。'
  },
  {
    id: 'wlan-hide-ssid',
    devs: ['AC'],
    name: '隐藏 SSID / 关闭广播',
    kw: ['隐藏ssid', '关闭广播', 'hide-ssid', '搜不到wifi'],
    cmds: [
      ['华为', 'ssid-profile name sp1\n hide-ssid'],
      ['思科', 'config wlan broadcast-ssid disable 1'],
      ['H3C', 'wlan service-template 1\n beacon ssid-hide'],
      ['锐捷', 'wlan-config 1\n hide-ssid']
    ],
    tip: '隐藏 SSID 只是不广播，抓包一样能看到，别当成安全手段。'
  },
  {
    id: 'wlan-ap-upgrade',
    devs: ['AC'],
    name: 'AP 批量升级',
    kw: ['ap升级', 'ap版本', '批量升级ap'],
    cmds: [
      ['华为', 'ap update mode ftp\nap update ftp-server 192.168.1.100 admin <密码>\nap update update-filename xxx.bin ap-type xxx'],
      ['思科', 'config ap image predownload\nconfig ap reset ap-1'],
      ['H3C', 'wlan ap ap-1\n firmware-upgrade enable'],
      ['锐捷', 'ap-config ap-1\n update']
    ],
    tip: 'AP 升级会重启断网，一定避开业务时段，并且先升一台验证。'
  },
  {
    id: 'wlan-limit',
    devs: ['AC'],
    name: '基于 SSID 的限速',
    kw: ['限速', 'wifi限速', '带宽限制', 'per-sta', '单个终端限速', 'ssid限速'],
    cmds: [
      ['华为', 'traffic-profile name tp1\n car inbound cir 2048\nvap-profile name vp1\n traffic-profile tp1'],
      ['思科', 'config wlan rate-limit average-data 1 2048'],
      ['H3C', 'wlan service-template 1\n client-rate-limit inbound mode dynamic cir 2048'],
      ['锐捷', 'wlan-config 1\n sta-limit bandwidth 2048']
    ],
    tip: '限速单位基本都是 kbps，写 2048 就是 2Mbps，别写成 2048M。'
  },
  {
    id: 'wlan-ap-fail',
    devs: ['AC'],
    name: 'AP 上线失败排查',
    kw: ['ap不上线', 'ap掉线', 'capwap', 'ap注册失败', 'option 43','ap 起不来','起不来','ap 不上线','ap 无法上线'],
    cmds: [
      ['华为', 'display ap all\ndisplay capwap state'],
      ['思科', 'show ap summary\nshow ap config general ap-1'],
      ['H3C', 'display wlan ap all\ndisplay wlan ap ap-1 verbose'],
      ['锐捷', 'show ap-config summary']
    ],
    tip: 'AP 不上线按顺序查：能拿到 IP 吗 → 能 ping 通 AC 吗 → DHCP option 43 给了 AC 地址吗 → 国家码 / AP 型号在 AC 上支持吗。'
  },

  {
    id: 'wlan-client-fail',
    devs: ['AC', 'AP'],
    name: '终端连不上 WiFi',
    kw: ['连不上wifi', '连不上无线', '认证失败', '关联失败', '密码对但连不上'],
    cmds: [
      ['华为', 'display station all\ndisplay ap all\ndisplay security-profile name sc1'],
      ['思科', 'show client summary\nshow client detail <客户端MAC>\ndebug client <客户端MAC>'],
      ['H3C', 'display wlan client verbose\ndisplay wlan service-template 1'],
      ['锐捷', 'show sta all\ndebug wlan']
    ],
    tip: '按顺序排除：能不能搜到 → 关联上了吗 → 认证过了吗 → 拿到 IP 了吗。卡在哪一步就查哪一步，别一上来就重启 AC。'
  },
  {
    id: 'wlan-airtime',
    devs: ['AC', 'AP'],
    name: '空口利用率 / 信道繁忙度',
    kw: ['空口', '信道利用率', 'airtime', 'wifi卡顿', '无线拥挤'],
    cmds: [
      ['华为', 'display ap radio 0\n（看 channel utilization 一项）'],
      ['思科', 'show ap auto-rf 802.11b ap-1\n（看 Channel Utilization）'],
      ['H3C', 'display wlan ap ap-1 radio 1 verbose'],
      ['锐捷', 'show ap-config summary\nshow ap-config radio']
    ],
    tip: '空口利用率超过 60% 就会明显卡，超过 80% 基本没法用。这时加 AP 不如先降功率、换信道、挪开干扰源。'
  },
  {
    id: 'ap-reset',
    devs: ['AP'],
    name: 'AP 恢复出厂',
    kw: ['ap恢复出厂', 'ap重置', 'ap复位', 'ap忘了密码'],
    cmds: [
      ['华为', '长按 RESET 孔 5 秒以上，指示灯快闪后松开'],
      ['思科', '长按 MODE 键约 20 秒，指示灯变红/橙后松开'],
      ['H3C', '长按 RESET 孔 5 秒以上'],
      ['锐捷', '长按 RESET 孔 5 秒以上']
    ],
    tip: '瘦 AP 复位后会自动重新向 AC 注册，配置由 AC 下发，不用手动配。复位前先确认 AC 在线，否则 AP 会一直挂在「未注册」。'
  },

  /* ---------------- 防火墙 ---------------- */
  {
    id: 'fw-policy',
    devs: ['防火墙'],
    name: '安全策略（放行 / 拒绝）',
    kw: ['配置防火墙策略', '策略怎么配', '安全策略', '防火墙策略', 'security-policy', '放行流量', 'deny'],
    cmds: [
      ['华为', 'security-policy\n rule name allow-web\n  source-zone trust\n  destination-zone untrust\n  action permit'],
      ['思科', 'access-list OUTSIDE extended permit tcp any any eq 443\naccess-group OUTSIDE in interface outside'],
      ['H3C', 'security-policy ip\n rule name allow-web\n  source-zone trust\n  destination-zone untrust\n  action pass'],
      ['锐捷', 'security-policy\n rule 10 permit tcp any any eq 443']
    ],
    tip: '防火墙默认拒绝所有。新业务不通，九成是策略没放行回程或没放行对应端口。'
  },
  {
    id: 'fw-session',
    devs: ['防火墙'],
    name: '查看会话表',
    kw: ['会话表', 'session', '连接数', '并发', '看谁在连'],
    cmds: [
      ['华为', 'display firewall session table\ndisplay firewall session table verbose'],
      ['思科', 'show conn'],
      ['H3C', 'display session table ipv4'],
      ['锐捷', 'show session table']
    ],
    tip: '业务时通时不通，先看会话表里有没有那条连接，以及是不是会话数打满了。'
  },
  {
    id: 'fw-ha',
    devs: ['防火墙'],
    name: '双机热备（HA）',
    kw: ['双机热备', 'ha', '主备防火墙', 'vrrp防火墙', '心跳线'],
    cmds: [
      ['华为', 'hrp enable\nhrp interface GigabitEthernet 1/0/1 remote 10.0.0.2\nhrp mirror session enable'],
      ['思科', 'failover\nfailover lan unit primary\nfailover lan interface failover GigabitEthernet0/3\nfailover interface ip failover 10.0.0.1 255.255.255.0 standby 10.0.0.2'],
      ['H3C', 'remote-backup group\n data-channel interface GigabitEthernet 1/0/1\n'],
      ['锐捷', 'ha group 1\n ha link GigabitEthernet 0/3']
    ],
    tip: '主备切换后业务不通，多半是会话表没同步——检查 hrp mirror session / failover 的会话同步有没有开。'
  },

  /* ---------------- 路由进阶 ---------------- */
  {
    id: 'vrf',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'VRF 虚拟路由转发',
    kw: ['vrf', '虚拟路由', '多租户隔离', '路由实例', 'vpn-instance'],
    cmds: [
      ['华为', 'ip vpn-instance vpn1\n ipv4-family\ninterface GigabitEthernet 0/0/1\n ip binding vpn-instance vpn1\n ip address 10.1.1.1 24'],
      ['思科', 'vrf definition vpn1\n address-family ipv4\ninterface GigabitEthernet 0/1\n vrf forwarding vpn1\n ip address 10.1.1.1 255.255.255.0'],
      ['H3C', 'ip vpn-instance vpn1\n address-family ipv4\ninterface GigabitEthernet 1/0/1\n ip binding vpn-instance vpn1\n ip address 10.1.1.1 24'],
      ['锐捷', 'ip vrf vpn1\ninterface GigabitEthernet 0/1\n ip vrf forwarding vpn1\n ip address 10.1.1.1 255.255.255.0']
    ],
    tip: '接口绑了 VRF 之后，原来的 IP 地址会被清掉，要重新配。查路由记得带 VRF：display ip routing-table vpn-instance vpn1。'
  },
  {
    id: 'bgp-rr',
    devs: ['Router'],
    name: 'BGP 路由反射器（RR）',
    kw: ['路由反射器', 'rr', 'reflect-client', 'ibgp全互联'],
    cmds: [
      ['华为', 'bgp 65001\n peer 10.1.1.2 as-number 65001\n peer 10.1.1.2 reflect-client'],
      ['思科', 'router bgp 65001\n neighbor 10.1.1.2 remote-as 65001\n neighbor 10.1.1.2 route-reflector-client'],
      ['H3C', 'bgp 65001\n peer 10.1.1.2 as-number 65001\n peer 10.1.1.2 reflect-client'],
      ['锐捷', 'router bgp 65001\n neighbor 10.1.1.2 remote-as 65001\n neighbor 10.1.1.2 route-reflector-client']
    ],
    tip: 'IBGP 默认要全互联（n×(n-1)/2 条会话），规模一大就撑不住，用 RR 或联邦打破这个限制。'
  },
  {
    id: 'bgp-attr',
    devs: ['Router'],
    name: 'BGP 选路属性调优',
    kw: ['bgp选路', 'local-preference', 'med', 'as-path', '选路控制', '走哪条出口'],
    cmds: [
      ['华为', 'bgp 65001\n default local-preference 200\n peer 10.1.1.2 route-policy LP in\n# AS-PATH 加长做备份\nroute-policy ASP permit node 10\n apply as-path 65001 65001 65001 additive'],
      ['思科', 'router bgp 65001\n bgp default local-preference 200\n neighbor 10.1.1.2 route-map LP in\nroute-map ASP permit 10\n set as-path prepend 65001 65001'],
      ['H3C', 'bgp 65001\n default local-preference 200\n peer 10.1.1.2 route-policy LP import'],
      ['锐捷', 'router bgp 65001\n bgp default local-preference 200\n neighbor 10.1.1.2 route-map LP in']
    ],
    tip: 'BGP 选路顺序记牢：LocalPref → AS-PATH 长度 → Origin → MED。想让某条线优先，最直接是调 LocalPref。'
  },
  {
    id: 'ospf-vlink',
    devs: ['Router'],
    name: 'OSPF 虚连接（vlink）',
    kw: ['虚连接', 'virtual-link', 'vlink', '区域不连续', 'area0不连续'],
    cmds: [
      ['华为', 'ospf 1\n area 1\n  vlink-peer 3.3.3.3'],
      ['思科', 'router ospf 1\n area 1 virtual-link 3.3.3.3'],
      ['H3C', 'ospf 1\n area 1\n  vlink-peer 3.3.3.3'],
      ['锐捷', 'router ospf 1\n area 1 virtual-link 3.3.3.3']
    ],
    tip: '虚连接必须穿过一个普通区域（不能穿 Stub / NSSA），两端的 router-id 要互为对端。'
  },
  {
    id: 'ospf-stub',
    devs: ['Router'],
    name: 'OSPF Stub / NSSA 区域',
    kw: ['stub', 'nssa', '末梢区域', '非完全末梢', '减少lsa'],
    cmds: [
      ['华为', 'ospf 1\n area 2\n  stub\n# 或\n  nssa'],
      ['思科', 'router ospf 1\n area 2 stub\n area 2 nssa'],
      ['H3C', 'ospf 1\n area 2\n  stub\n# 或\n  nssa'],
      ['锐捷', 'router ospf 1\n area 2 stub\n area 2 nssa']
    ],
    tip: 'Stub 区域不能有 ASBR；要引入外部路由就用 NSSA。两边区域类型配不一致，邻居起不来。'
  },
  {
    id: 'ospf-summary',
    devs: ['Router'],
    name: 'OSPF 路由汇总',
    kw: ['路由汇总', 'abr-summary', 'area range', '路由聚合', '减少路由条目'],
    cmds: [
      ['华为', 'ospf 1\n area 1\n  abr-summary 10.1.0.0 16\n# ASBR 汇总外部路由\n asbr-summary 172.16.0.0 16'],
      ['思科', 'router ospf 1\n area 1 range 10.1.0.0 255.255.0.0\n# 外部路由汇总\n summary-address 172.16.0.0 255.255.0.0'],
      ['H3C', 'ospf 1\n area 1\n  abr-summary 10.1.0.0 16'],
      ['锐捷', 'router ospf 1\n area 1 range 10.1.0.0 255.255.0.0']
    ],
    tip: '汇总会在 ABR 上产生一条指向 Null0 的黑洞路由，目的是防环；看到 Null0 别慌，那是正常的。'
  },
  {
    id: 'isis',
    devs: ['Router'],
    name: 'IS-IS 基础配置',
    kw: ['isis', '中间系统', '运营商常用', 'net地址'],
    cmds: [
      ['华为', 'isis 1\n is-level level-2\n network-entity 49.0001.0000.0000.0001.00\ninterface GigabitEthernet 0/0/1\n isis enable 1'],
      ['思科', 'router isis\n net 49.0001.0000.0000.0001.00\n is-type level-2-only\ninterface GigabitEthernet 0/1\n ip router isis'],
      ['H3C', 'isis 1\n is-level level-2\n network-entity 49.0001.0000.0000.0001.00\ninterface GigabitEthernet 1/0/1\n isis enable 1'],
      ['锐捷', 'router isis\n net 49.0001.0000.0000.0001.00\ninterface GigabitEthernet 0/1\n ip router isis']
    ],
    tip: 'NET 地址的 System ID 部分全网必须唯一，照抄模板两台设备变成一样，邻居直接起不来。'
  },
  {
    id: 'mpls',
    devs: ['Router'],
    name: 'MPLS L3VPN 基础',
    kw: ['mpls', 'ldp', '标签', 'vpn', '运营商专线'],
    cmds: [
      ['华为', 'mpls lsr-id 1.1.1.1\nmpls\nmpls ldp\ninterface GigabitEthernet 0/0/1\n mpls\n mpls ldp'],
      ['思科', 'mpls label protocol ldp\nmpls ldp router-id Loopback0 force\ninterface GigabitEthernet 0/1\n mpls ip'],
      ['H3C', 'mpls lsr-id 1.1.1.1\nmpls ldp\ninterface GigabitEthernet 1/0/1\n mpls\n mpls ldp'],
      ['锐捷', 'mpls ip\nmpls label protocol ldp\ninterface GigabitEthernet 0/1\n mpls ip']
    ],
    tip: 'LDP 会话依赖底层 IGP 的 loopback 路由可达，先确认 IGP 通了再查 MPLS，顺序反了会白查一天。'
  },
  {
    id: 'pim',
    devs: ['Router', 'Switch'],
    name: '组播 PIM-SM',
    kw: ['组播', 'pim', '组播路由', '视频会议', 'iptv'],
    cmds: [
      ['华为', 'multicast routing-enable\ninterface GigabitEthernet 0/0/1\n pim sm\n igmp enable'],
      ['思科', 'ip multicast-routing\ninterface GigabitEthernet 0/1\n ip pim sparse-mode\n ip igmp version 2'],
      ['H3C', 'multicast routing\ninterface GigabitEthernet 1/0/1\n pim sm\n igmp enable'],
      ['锐捷', 'ip multicast-routing\ninterface GigabitEthernet 0/1\n ip pim sparse-mode']
    ],
    tip: '要先全局开组播路由，再在接口上开 PIM。只开接口不开全局，命令敲了也不生效，很多教程漏了这一步。'
  },
  {
    id: 'igmp',
    devs: ['Switch', 'Router'],
    name: 'IGMP 组播成员查询',
    kw: ['igmp', '组播组', '谁在收组播', '组播成员'],
    cmds: [
      ['华为', 'display igmp group\ndisplay pim neighbor'],
      ['思科', 'show ip igmp groups\nshow ip pim neighbor'],
      ['H3C', 'display igmp group\ndisplay pim neighbor'],
      ['锐捷', 'show ip igmp groups']
    ],
    tip: '组播不通先看有没有组成员（IGMP group），再看 PIM 邻居起没起，最后看 RP 配得对不对。'
  },
  {
    id: 'ipv6-basic',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'IPv6 地址配置',
    kw: ['ipv6', 'ipv6地址', 'ipv6配置', 'v6地址', '双栈'],
    cmds: [
      ['华为', 'ipv6\ninterface GigabitEthernet 0/0/1\n ipv6 enable\n ipv6 address 2001:db8:1::1/64'],
      ['思科', 'ipv6 unicast-routing\ninterface GigabitEthernet 0/1\n ipv6 enable\n ipv6 address 2001:DB8:1::1/64'],
      ['H3C', 'ipv6\ninterface GigabitEthernet 1/0/1\n ipv6 address 2001:db8:1::1/64'],
      ['锐捷', 'ipv6 unicast-routing\ninterface GigabitEthernet 0/1\n ipv6 address 2001:DB8:1::1/64']
    ],
    tip: '思科 / 锐捷必须全局 `ipv6 unicast-routing` 才会转发 IPv6，只配接口地址只能自己 ping 通自己。'
  },
  {
    id: 'ipv6-route',
    devs: ['Router', 'Switch'],
    name: 'IPv6 路由与 OSPFv3',
    kw: ['ipv6路由', 'ospfv3', 'ipv6静态路由', 'v6路由'],
    cmds: [
      ['华为', 'ipv6 route-static 2001:db8:2:: 64 2001:db8:1::2\nospfv3 1\n router-id 1.1.1.1\ninterface GigabitEthernet 0/0/1\n ospfv3 1 area 0'],
      ['思科', 'ipv6 route 2001:DB8:2::/64 2001:DB8:1::2\nipv6 router ospf 1\n router-id 1.1.1.1\ninterface GigabitEthernet 0/1\n ipv6 ospf 1 area 0'],
      ['H3C', 'ipv6 route-static 2001:db8:2:: 64 2001:db8:1::2\nospfv3 1\ninterface GigabitEthernet 1/0/1\n ospfv3 1 area 0'],
      ['锐捷', 'ipv6 route 2001:DB8:2::/64 2001:DB8:1::2']
    ],
    tip: 'OSPFv3 和 OSPFv2 是两个独立进程，配了 v3 不代表 v4 也通，双栈要分别配。'
  },
  {
    id: 'traffic-shape',
    devs: ['Router', '防火墙'],
    name: '流量整形（GTS）',
    kw: ['流量整形', 'gts', '限速出口', 'traffic-shape', '带宽控制'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/0\n qos gts cir 10240'],
      ['思科', 'interface GigabitEthernet 0/0\n traffic-shape rate 10240000 1024000 1024000 1000'],
      ['H3C', 'interface GigabitEthernet 1/0/0\n qos gts cir 10240'],
      ['锐捷', 'interface GigabitEthernet 0/0\n traffic-shape rate 10240000']
    ],
    tip: '限速（car）是超了就丢，整形（gts）是超了先缓存再发。语音、视频这类怕丢包的，用整形。'
  },
  {
    id: 'dhcp-static-bind',
    devs: ['Switch', 'Router'],
    name: 'DHCP 静态绑定（固定 IP）',
    kw: ['dhcp静态绑定', '固定ip', '打印机固定地址', 'static-bind'],
    cmds: [
      ['华为', 'ip pool p1\n static-bind ip-address 192.168.1.100 mac-address 0011-2233-4455'],
      ['思科', 'ip dhcp pool printer\n host 192.168.1.100 255.255.255.0\n hardware-address 0011.2233.4455\n default-router 192.168.1.1'],
      ['H3C', 'dhcp server ip-pool p1\n static-bind ip-address 192.168.1.100 mask 255.255.255.0 hardware-address 0011-2233-4455'],
      ['锐捷', 'ip dhcp pool printer\n host 192.168.1.100 255.255.255.0\n hardware-address 0011.2233.4455']
    ],
    tip: '打印机、服务器这类必须固定 IP 的，用 DHCP 静态绑定比手工配更省事：换网段只改 DHCP，设备不用动。'
  },
  {
    id: 'dns-server',
    devs: ['Router', '防火墙'],
    name: '设备做 DNS 代理',
    kw: ['dns代理', 'dns server', '内网dns', '域名解析服务'],
    cmds: [
      ['华为', 'dns resolve\ndns proxy enable\ndns server 114.114.114.114'],
      ['思科', 'ip dns server\nip name-server 114.114.114.114'],
      ['H3C', 'dns resolve\ndns proxy enable\ndns server 114.114.114.114'],
      ['锐捷', 'ip dns server\nip name-server 114.114.114.114']
    ],
    tip: '设备做 DNS 代理能省一台服务器，但性能和缓存都不如专业 DNS，办公网规模大了还是分开部署。'
  },
  {
    id: 'track',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'Track 联动（链路故障自动切）',
    kw: ['track', '联动', 'nqa', '上行口断了自动切', 'bfd联动'],
    cmds: [
      ['华为', 'nqa test-instance admin isp\n test-type icmp\n destination-address ipv4 114.114.114.114\nip route-static 0.0.0.0 0 202.1.1.1 track nqa admin isp'],
      ['思科', 'track 1 ip route 114.114.114.114 255.255.255.255 reachability\nip route 0.0.0.0 0.0.0.0 202.1.1.1 track 1'],
      ['H3C', 'nqa entry admin isp\n type icmp-echo\n destination ip 114.114.114.114\nip route-static 0.0.0.0 0 202.1.1.1 track nqa admin isp'],
      ['锐捷', 'track 1 ip route 114.114.114.114 255.255.255.255\nip route 0.0.0.0 0.0.0.0 202.1.1.1 track 1']
    ],
    tip: '双出口场景必备：光猫断电但交换机口还 up，没有 Track 就不会切，用户会一直卡在坏的那条线上。'
  }
];

module.exports = { ROUTE_EXTRA };
