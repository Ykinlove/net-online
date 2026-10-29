/**
 * HCIA / HCIP 补充：二层冗余与保护（Smart Link / RRPP / SEP / M-LAG）+ IP 编址
 * 这几项是 HCIP-Datacom 交换部分的大纲考点，之前完全空缺。
 * 命令按华为、H3C 官方配置指南核对。
 */
const HCIP_EXTRA = [
  {
    id: 'hcip-smart-link',
    devs: ['Switch'],
    name: 'Smart Link 双上行冗余（主备链路）',
    kw: ['smart link', '双上行', '主备链路', '上行冗余', 'flush 报文', 'hcip'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n stp disable\ninterface GigabitEthernet 0/0/2\n stp disable\nsmart-link group 1\n protected-vlan reference-instance 0\n port gigabitethernet 0/0/1 master\n port gigabitethernet 0/0/2 slave\n restore enable\n timer wtr 30\n flush send control-vlan 10 password sha <密码>\n smart-link enable\ndisplay smart-link group 1']
    ],
    tip: 'Smart Link 是华为私有的双上行方案：一台接入交换机两条上行，一条转发一条阻塞，不用跑 STP 也能防环，收敛比 STP 快得多。三个必须做的动作：① 两条上行口先 stp disable（不关 STP 加不进组）；② 组里写 restore enable + timer wtr，否则主链路恢复后不回切；③ 在上游设备接口上配 smart-link flush receive control-vlan 10，让上游立刻刷新 MAC 表——不配的话切换后要等 MAC 老化、业务会断好几秒。'
  },
  {
    id: 'hcip-monitor-link',
    devs: ['Switch'],
    name: 'Monitor Link 上行联动（上行断了自动关下行）',
    kw: ['monitor link', '上行联动', '上行断下行', 'error-down', 'hcip'],
    cmds: [
      ['华为', 'monitor-link group 1\n port gigabitethernet 0/0/1 uplink\n port gigabitethernet 0/0/2 downlink 1\ndisplay monitor-link group 1']
    ],
    tip: 'Monitor Link 解决的是「上行断了、下行还在傻等」的问题：它盯着上行口，上行全部 Down 就把下行口强制 Error-Down，让下游立刻感知、走另一条路。典型用法是和 Smart Link 配在一起——Smart Link 管双上行选路，Monitor Link 管把故障往下游传递。注意上行可以是一个 Smart Link 组，这样上行两条都断了才会触发下行关闭；如果只挂单个物理口，那条口一断下行就全关，可能误伤。'
  },
  {
    id: 'hcip-rrpp',
    devs: ['Switch'],
    name: 'RRPP 环网保护（快速破环）',
    kw: ['rrpp', '环网保护', '破环', '环网收敛', '主节点', 'hcip'],
    cmds: [
      ['华为', 'vlan batch 10 100\nrrpp domain 1\n control-vlan 100\n protected-vlan reference-instance 0\n ring 10 node-mode master primary-port gigabitethernet 0/0/1 secondary-port gigabitethernet 0/0/2 level 0\n ring 10 enable\nrrpp enable\ndisplay rrpp ring 10'],
      ['H3C', 'vlan 10 100\nrrpp domain 1\n control-vlan 100\n protected-vlan reference-instance 0\n ring 10 node-mode master primary-port GigabitEthernet 1/0/1 secondary-port GigabitEthernet 1/0/2 level 0\n ring 10 enable\nrrpp enable']
    ],
    tip: 'RRPP 用一台主节点（Master）平时阻塞副端口，环路断了自己放开副端口，收敛在 50ms 级，比 STP 快一个数量级。配置三个要点：① 加入 RRPP 环的端口必须先 stp disable；② 控制 VLAN 必须落在 protected-vlan 的实例范围里，不包含会直接报错；③ 子控制 VLAN 是控制 VLAN+1（这里 100 和 101 都被占用），规划 VLAN 时别把这两个号分给业务。一个域只能有一个主环（level 0），子环是 level 1，主环必须先建。'
  },
  {
    id: 'hcip-sep',
    devs: ['Switch'],
    name: 'SEP 智能以太网保护（多环组网）',
    kw: ['sep', '智能以太网保护', '多环', '半环', 'block port', 'hcip'],
    cmds: [
      ['华为', 'vlan batch 10 100\nsep segment 1\n control-vlan 10\n protected-instance all\n block port optimal\n preempt delay 30\ninterface GigabitEthernet 0/0/1\n stp disable\n sep segment 1 edge primary\ninterface GigabitEthernet 0/0/3\n stp disable\n sep segment 1 edge secondary\ninterface GigabitEthernet 0/0/2\n stp disable\n sep segment 1\ndisplay sep interface\ndisplay sep segment 1']
    ],
    tip: 'SEP 也是华为私有，比 RRPP 更灵活：不要求整环都是同一厂商设备、支持半环和树形拓扑，最适合接入层大量小环、又混了别家交换机的情况。配法和 RRPP 有两点不同：① 不是设主节点，而是由设备选举出阻塞端口，可以用 block port optimal / hop / sysname 手工指定谁阻塞；② 边缘端口要标 edge primary / edge secondary，普通中间端口直接 sep segment 1 就行。同样要去使能 STP，不去使能加不进段。'
  },
  {
    id: 'hcip-mlag',
    devs: ['Switch'],
    name: 'M-LAG / vPC 跨设备双活（双归接入）',
    kw: ['m-lag', 'mlag', 'dfs-group', 'peer-link', 'vpc', 'drni', 'hcip'],
    cmds: [
      ['华为', 'dfs-group 1\n priority 150\n dual-active detection source ip 10.1.1.1 peer 10.1.1.2\n authentication-mode hmac-sha256 password <密码>\ninterface Eth-Trunk 0\n mode lacp-static\n peer-link 1\n port vlan exclude 1\ninterface Eth-Trunk 10\n mode lacp-static\n port link-type trunk\n dfs-group 1 m-lag 10\ndisplay dfs-group 1 m-lag'],
      ['思科', 'vpc domain 1\n peer-keepalive destination 10.1.1.2 source 10.1.1.1\n peer-gateway\n role priority 100\ninterface port-channel1\n vpc peer-link\ninterface port-channel10\n vpc 10\nshow vpc\nshow vpc consistency-parameters global']
    ],
    tip: 'M-LAG 让两台交换机对下表现为「一台」，服务器双网卡做聚合可以同时转发，不像堆叠那样有主备浪费。三要素缺一不可：① DFS 组（思科叫 vpc domain）负责双主检测和状态同步，双主检测地址必须三层可达；② peer-link 走 Eth-Trunk、且要 port vlan exclude 1 把 VLAN 1 排除；③ 成员口用 dfs-group 1 m-lag <id> 绑定，两端 m-lag id 必须一致。排障顺序：display dfs-group 1 m-lag 看 heartbeat 是不是 OK → 看 peer-link 是不是 Up → 最后看成员口状态。peer-link 断了会进入双主，两端都当主用，可能引发环路和 IP 冲突，所以双主检测链路一定要独立于 peer-link。华三对应的叫 DRNI（port drni group），思科 Nexus 叫 vPC，三者思路一样、命令全不同。'
  },
  {
    id: 'hcia-ip-addr',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: 'IP 地址与掩码配置（含 /30 /31 互联）',
    kw: ['ip地址', '掩码', '子网', 'ip编址', '反掩码', 'hcia'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n ip address 192.168.1.1 24\ninterface GigabitEthernet 0/0/2\n ip address 10.1.1.1 30\ninterface LoopBack0\n ip address 1.1.1.1 32\ndisplay ip interface brief\ndisplay ip routing-table'],
      ['思科', 'interface GigabitEthernet0/1\n ip address 192.168.1.1 255.255.255.0\ninterface GigabitEthernet0/2\n ip address 10.1.1.1 255.255.255.252\ninterface Loopback0\n ip address 1.1.1.1 255.255.255.255\nshow ip interface brief\nshow ip route'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n ip address 192.168.1.1 24\ninterface GigabitEthernet 1/0/2\n ip address 10.1.1.1 30\ninterface LoopBack0\n ip address 1.1.1.1 32\ndisplay ip interface brief'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ip address 192.168.1.1 255.255.255.0\ninterface GigabitEthernet 0/2\n ip address 10.1.1.1 255.255.255.252\ninterface LoopBack0\n ip address 1.1.1.1 255.255.255.255\nshow ip interface brief']
    ],
    tip: '掩码速记：/24 = 255.255.255.0（254 个可用地址），/30 = 255.255.255.252（2 个可用，点对点互联最常用），/31 = 255.255.255.254（RFC 3021 点对点专用，两个地址都能用，但部分老设备不支持），/32 = 255.255.255.255（只给环回口）。华为/H3C 可以直接写位数（ip address 192.168.1.1 24），思科必须写完整掩码、老 IOS 不认 /24 写法。ACL 里用的是反掩码（wildcard），和掩码按位取反：/24 的反掩码是 0.0.0.255，别把这两个搞混，这是 HCIA 最容易失分的地方。'
  }
];

module.exports = { HCIP_EXTRA };
