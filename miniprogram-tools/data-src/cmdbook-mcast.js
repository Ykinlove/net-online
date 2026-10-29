// utils/cmdbook-mcast.js —— 组播进阶（PIM / IGMP / 组播排障）
// 已有基础组播条目（PIM-SM 开启、PIM-DM、MSDP、静态 RP、IGMP Snooping）不重复，
// 这里补的是「配完之后不通怎么查」和 BSR、SSM、边界过滤这些常用但少写的部分。

const MCAST_EXTRA = [
  {
    id: 'mc-bsr',
    devs: ['Router', 'Switch'],
    name: 'PIM-SM 动态 RP（BSR）',
    kw: ['bsr', '动态rp', '自动rp', 'c-bsr', 'c-rp'],
    cmds: [
      ['华为', 'multicast routing-enable\npim\n c-bsr GigabitEthernet 0/0/0\n c-rp GigabitEthernet 0/0/0'],
      ['思科', 'ip multicast-routing\nip pim bsr-candidate Loopback0\nip pim rp-candidate Loopback0'],
      ['H3C', 'multicast routing\npim\n c-bsr GigabitEthernet 1/0/0\n c-rp GigabitEthernet 1/0/0'],
      ['锐捷', 'ip multicast-routing\nip pim bsr-candidate Loopback0\nip pim rp-candidate Loopback0']
    ],
    tip: 'BSR 靠组播报文自举，所以 c-bsr 的接口必须已经开了 PIM-SM，否则永远选不出 RP。生产上更稳的是静态 RP（Anycast + MSDP），BSR 一断全组播都停。'
  },
  {
    id: 'mc-rpf',
    devs: ['Router', 'Switch'],
    name: '组播 RPF 检查（组播不通第一现场）',
    kw: ['rpf', '组播不通', '组播源检查', '反向路径', '组播流量过不来'],
    cmds: [
      ['华为', 'display pim rp-info\ndisplay multicast rpf-info 10.1.1.100\ndisplay pim neighbor'],
      ['思科', 'show ip rpf 10.1.1.100\nshow ip pim neighbor\nshow ip mroute 239.1.1.1'],
      ['H3C', 'display pim rpf-info 10.1.1.100\ndisplay pim neighbor'],
      ['锐捷', 'show ip rpf 10.1.1.100\nshow ip pim neighbor']
    ],
    tip: '组播不通，九成是 RPF 失败——路由器要求「组播源的来路」和「到源的单播路由」是同一条路。查 RPF 表指向哪个口，跟实际收到的接口一比就知道，多宿主或路由不对称时最容易踩。'
  },
  {
    id: 'mc-mroute',
    devs: ['Router', 'Switch'],
    name: '组播路由表查看（S,G 与 *,G）',
    kw: ['mroute', '组播路由表', 's g', '组播转发表', '看组播流量'],
    cmds: [
      ['华为', 'display multicast routing-table\ndisplay multicast routing-table 239.1.1.1'],
      ['思科', 'show ip mroute\nshow ip mroute 239.1.1.1\nshow ip mroute count'],
      ['H3C', 'display multicast routing-table\ndisplay multicast routing-table 239.1.1.1'],
      ['锐捷', 'show ip mroute\nshow ip mroute 239.1.1.1']
    ],
    tip: '(S,G) 是源树、( *,G) 是共享树。看 Incoming interface 是不是期望的那个口、Outgoing 有没有你的接收者。出接口列表空着，说明下游没人加入，不是转发问题。'
  },
  {
    id: 'mc-igmp-querier',
    devs: ['Switch'],
    name: 'IGMP Snooping 查询器（二层自己不查就没人管）',
    kw: [
      'igmp查询器', 'querier', 'snooping不生效', '组播半小时断一次', '组播看一会儿就断', '组播看一会就断',
      '组播一会儿就断', '组播一会就断', '看一会儿就断', '组播时断时续', '组播断断续续'
    ],
    cmds: [
      ['华为', 'igmp-snooping enable\nvlan 10\n igmp-snooping enable\n igmp-snooping querier enable'],
      ['思科', 'ip igmp snooping\nip igmp snooping querier\nip igmp snooping vlan 10 querier'],
      ['H3C', 'igmp-snooping\nvlan 10\n igmp-snooping enable\n igmp-snooping querier'],
      ['锐捷', 'ip igmp snooping\nip igmp snooping querier']
    ],
    tip: '二层网络里没有三层组播路由器时，没人发 IGMP 查询，交换机过几分钟就把组播表项老化掉，表现是「组播看一会儿就断，换个台又好了」。开 querier 就好了。'
  },
  {
    id: 'mc-ssm',
    devs: ['Router', 'Switch'],
    name: 'SSM 指定源组播（源地址过滤）',
    kw: ['ssm', '指定源组播', '源过滤', 'igmpv3'],
    cmds: [
      ['华为', 'pim\n ssm-policy 2000\nacl 2000\n rule 5 permit source 232.0.0.0 0.255.255.255'],
      ['思科', 'ip pim ssm default\naccess-list 1 permit 232.0.0.0 0.255.255.255\nip igmp ssm-map enable'],
      ['H3C', 'pim\n ssm-policy 2000\nacl basic 2000\n rule 5 permit source 232.0.0.0 0.255.255.255'],
      ['锐捷', 'ip pim ssm default']
    ],
    tip: 'SSM 的组地址必须是 232.0.0.0/8，别用 239 网段试，配了不起作用。而且要求接收端支持 IGMPv3，老设备或运营商只给 v2 的网络用不了 SSM。'
  },
  {
    id: 'mc-boundary',
    devs: ['Router', 'Switch'],
    name: '组播边界与组播组过滤',
    kw: ['组播边界', 'multicast boundary', '组播过滤', '限制组播范围'],
    cmds: [
      ['华为', 'acl 2000\n rule 5 permit source 239.1.1.0 0.0.0.255\ninterface GigabitEthernet 0/0/1\n pim bsr-boundary\n multicast boundary 2000'],
      ['思科', 'access-list 1 permit 239.1.1.0 0.0.0.255\ninterface GigabitEthernet0/1\n ip multicast boundary 1'],
      ['H3C', 'acl basic 2000\n rule 5 permit source 239.1.1.0 0.0.0.255\ninterface GigabitEthernet 1/0/1\n multicast boundary 2000'],
      ['锐捷', 'access-list 1 permit 239.1.1.0 0.0.0.255\ninterface GigabitEthernet 0/1\n ip multicast boundary 1']
    ],
    tip: '不限边界的组播会跑到不该去的区域，一路把带宽吃掉。ACL 写的是「允许通过」的组，不是拒绝的组——方向搞反等于把该通的也拦了。'
  },
  {
    id: 'mc-ttl',
    devs: ['Router'],
    name: '组播 TTL 阈值（限制转发范围）',
    kw: ['ttl阈值', 'multicast ttl', '限制组播跳数', '组播范围控制'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n multicast ttl-threshold 16'],
      ['思科', 'interface GigabitEthernet0/1\n ip multicast ttl-threshold 16'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n multicast ttl-threshold 16'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ip multicast ttl-threshold 16']
    ],
    tip: 'TTL 阈值的意思是「报文 TTL 小于这个值就不从该口转发」，常用来把组播圈在园区内。配大了等于全网通，配小了本楼都不通，别随手写 1。'
  },
  {
    id: 'mc-igmp-version',
    devs: ['Router', 'Switch'],
    name: 'IGMP 版本与接口参数',
    kw: ['igmp版本', 'igmpv2', 'igmpv3', '组播成员查询'],
    cmds: [
      ['华为', 'interface Vlanif 10\n igmp version 2\n igmp robust-count 2'],
      ['思科', 'interface Vlan10\n ip igmp version 2\n ip igmp query-interval 60'],
      ['H3C', 'interface Vlan-interface 10\n igmp version 2'],
      ['锐捷', 'interface Vlan 10\n ip igmp version 2']
    ],
    tip: '两端 IGMP 版本不一致会退到低版本，v3 能做的源过滤就失效了。v2 和 v3 的查询报文格式不同，混用时报文会被丢弃，表现是「组成员学了又老化」。'
  },
  {
    id: 'mc-pim-dr',
    devs: ['Router', 'Switch'],
    name: 'PIM DR 选举与邻居状态',
    kw: ['pim dr', 'dr选举', 'pim邻居', 'pim hello'],
    cmds: [
      ['华为', 'display pim interface\ndisplay pim neighbor'],
      ['思科', 'show ip pim interface\nshow ip pim neighbor'],
      ['H3C', 'display pim interface\ndisplay pim neighbor'],
      ['锐捷', 'show ip pim interface\nshow ip pim neighbor']
    ],
    tip: '共享网段里 DR 负责发注册报文，DR 选错了组播就绕远甚至不通。优先级大的当 DR，相同则看 IP 大的——想指定谁当 DR，把它的优先级调高就行。'
  },
  {
    id: 'mc-anycast-rp',
    devs: ['Router'],
    name: 'Anycast RP（双 RP 冗余）',
    kw: ['anycast rp', '任播rp', 'rp冗余', '双rp'],
    cmds: [
      ['华为', 'interface LoopBack0\n ip address 10.1.1.1 32\npim\n anycast-rp 10.1.1.1 10.1.1.1\n anycast-rp 10.1.1.1 10.1.1.2\nmsdp\n peer 10.1.1.2 connect-interface LoopBack0'],
      ['思科', 'interface Loopback0\n ip address 10.1.1.1 255.255.255.255\nip pim anycast-rp 10.1.1.1 10.1.1.1\nip pim anycast-rp 10.1.1.1 10.1.1.2\nip msdp peer 10.1.1.2 connect-source Loopback0'],
      ['H3C', 'interface LoopBack0\n ip address 10.1.1.1 32\npim\n anycast-rp 10.1.1.1 10.1.1.1\n anycast-rp 10.1.1.1 10.1.1.2\nmsdp\n peer 10.1.1.2 connect-interface LoopBack0'],
      ['锐捷', 'ip pim anycast-rp 10.1.1.1 10.1.1.1\nip pim anycast-rp 10.1.1.1 10.1.1.2\nip msdp peer 10.1.1.2 connect-source Loopback0']
    ],
    tip: '两台 RP 用同一个地址，组播源就近注册，靠 MSDP 同步源信息。少了 MSDP，两台 RP 各管各的，切换时组播会断——这是 Anycast RP 最容易漏的一步。注意 anycast-rp 后面要写两条：第一条是自己的地址（表示本机也是 RP），第二条才是对端。'
  },
  {
    id: 'mc-traffic-stat',
    devs: ['Router', 'Switch'],
    name: '组播流量统计与速率查看',
    kw: ['组播流量', '组播速率', '组播统计', '组播带宽'],
    cmds: [
      ['华为', 'display multicast routing-table statistics\ndisplay pim interface verbose'],
      ['思科', 'show ip mroute count\nshow ip mroute summary\nshow ip pim interface count'],
      ['H3C', 'display multicast routing-table statistics'],
      ['锐捷', 'show ip mroute count']
    ],
    tip: '组播是 UDP，丢包不会重传，业务侧只表现为「卡一下」。看速率最直接的是接口下的组播计数增量，路由器自己报的 RPF 失败数也很说明问题。'
  },
  {
    id: 'mc-igmp-snooping-group',
    devs: ['Switch'],
    name: '查某个组都有谁在收（组播成员定位）',
    kw: ['组播成员', '谁在看组播', 'igmp组', '组播接收者'],
    cmds: [
      ['华为', 'display igmp group\ndisplay igmp-snooping group vlan 10'],
      ['思科', 'show ip igmp groups\nshow ip igmp snooping groups vlan 10'],
      ['H3C', 'display igmp group\ndisplay igmp-snooping group vlan 10'],
      ['锐捷', 'show ip igmp groups\nshow ip igmp snooping groups']
    ],
    tip: '用户说「看不了视频会议」，先在接入交换机上看这个组有没有成员表项。没有表项说明 IGMP 加入报文根本没上来，问题在终端或接入侧，不在组播路由。'
  },
  {
    id: 'mc-mroute-flag',
    devs: ['Router'],
    name: '组播表项标志解读（为什么没转发）',
    kw: ['组播标记', 'mroute标志', '组播不转发', 'pim注册'],
    cmds: [
      ['华为', 'display multicast forwarding-table\ndisplay pim routing-table'],
      ['思科', 'show ip mroute 239.1.1.1\nshow ip pim rp mapping'],
      ['H3C', 'display multicast forwarding-table\ndisplay pim routing-table'],
      ['锐捷', 'show ip mroute 239.1.1.1']
    ],
    tip: '表项里出现 RPF 失败标记说明单播回程有问题；出现 prune 说明下游明确不要流量；只有 *,G 没有 S,G 说明源的注册报文没到 RP。按标志定位比乱改配置快得多。'
  }
];

module.exports = { MCAST_EXTRA };
