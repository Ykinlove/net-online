// utils/cmdbook-l2.js —— 二层协议进阶（VLAN / STP / 聚合 / 安全接入）
// 命令块里只放纯命令，中文说明一律写在 tip，避免复制粘贴到设备时报错。

const L2_EXTRA = [
  {
    id: 'l2-vlan-mapping',
    devs: ['Switch'],
    name: 'VLAN 映射（改外层 VLAN 标签）',
    kw: ['vlan mapping', 'vlan转换', '改vlan标签', 'vlan映射'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port link-type trunk\n port trunk allow-pass vlan 100\n qinq vlan-translation enable\n port vlan-mapping vlan 100 map-vlan 200'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport mode trunk\n switchport vlan mapping 100 200'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n port link-type trunk\n port trunk permit vlan 100\n vlan mapping 100 200'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport mode trunk\n switchport vlan-mapping 100 200']
    ],
    tip: '运营商给的 VLAN 号跟你规划的不一样时用这个，不用让对端改。注意映射是单向的，回程也要配一条对应的反向映射，否则只能通一半。'
  },
  {
    id: 'l2-vlan-translation',
    devs: ['Switch'],
    name: 'VLAN 标签转换（不改 VLAN，只改 tag）',
    kw: ['vlan translation', '标签转换', '单tag转换'],
    cmds: [
      ['华为', 'qinq vlan-translation enable\ninterface GigabitEthernet 0/0/1\n port vlan-translation 100 to 200'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport mode trunk\n switchport vlan mapping 100 200'],
      ['H3C', 'qinq enable\ninterface GigabitEthernet 1/0/1\n vlan-translation 100 to 200'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport vlan-translation 100 to 200']
    ],
    tip: '跟 VLAN 映射的区别：转换只改 tag 不改转发域，映射会连转发表一起改。多数场景用转换就够了，配错映射会导致该 VLAN 直接不通。'
  },
  {
    id: 'l2-qinq-flex',
    devs: ['Switch'],
    name: '灵活 QinQ（按流分类打外层标签）',
    kw: ['灵活qinq', 'selective qinq', '按vlan打外层', 'qinq流分类'],
    cmds: [
      ['华为', 'traffic classifier c1 operator or\n if-match vlan-id 100\ntraffic behavior b1\n nest top-most vlan-id 200\ntraffic policy p1\n classifier c1 behavior b1\ninterface GigabitEthernet 0/0/1\n traffic-policy p1 inbound'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport mode dot1q-tunnel\n switchport access vlan 200\n l2protocol-tunnel cdp'],
      ['H3C', 'traffic classifier c1 operator or\n if-match vlan 100\ntraffic behavior b1\n nest top-most vlan 200\ntraffic policy p1\n classifier c1 behavior b1\ninterface GigabitEthernet 1/0/1\n qos apply policy p1 inbound'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport mode dot1q-tunnel\n switchport access vlan 200']
    ],
    tip: '基础 QinQ 是整个口都加外层标签，灵活 QinQ 是按内层 VLAN 挑着加。酒店、校园一房一 VLAN 的场景基本都用灵活 QinQ，配完记得两头 MTU 都放大 4 字节。'
  },
  {
    id: 'l2-stp-cost',
    devs: ['Switch'],
    name: 'STP 路径开销与端口优先级',
    kw: ['stp开销', 'cost', '端口优先级', '选路控制', '改stp路径'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n stp cost 20000\n stp port priority 16'],
      ['思科', 'interface GigabitEthernet 0/1\n spanning-tree cost 20000\n spanning-tree port-priority 16'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n stp cost 20000\n stp port priority 16'],
      ['锐捷', 'interface GigabitEthernet 0/1\n spanning-tree cost 20000\n spanning-tree port-priority 16']
    ],
    tip: '想让某条链路当备用，把它的 cost 调大比直接 shutdown 好——断了还能自动回切。端口优先级必须是 16 的倍数，写别的值设备会自己取整。'
  },
  {
    id: 'l2-stp-guard',
    devs: ['Switch'],
    name: 'STP Root / Loop / BPDU 三种保护',
    kw: ['root guard', 'loop guard', 'bpdu guard', 'stp保护', '防私接交换机'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n stp root-protection\n stp loop-protection\n stp bpdu-protection'],
      ['思科', 'interface GigabitEthernet 0/1\n spanning-tree guard root\n spanning-tree guard loop\n spanning-tree bpduguard enable'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n stp root-protection\n stp loop-protection\n stp bpdu-protection'],
      ['锐捷', 'interface GigabitEthernet 0/1\n spanning-tree guard root\n spanning-tree bpduguard enable']
    ],
    tip: '三个别乱开：root-protection 用在接下级交换机的口（防抢根），bpdu-protection 用在接终端的口（收到 BPDU 就 err-disable），loop-protection 用在光口/单通场景。全口都开会把自己网络搞挂。'
  },
  {
    id: 'l2-stp-bpdu-filter',
    devs: ['Switch'],
    name: 'BPDU 过滤（接终端口不参与 STP）',
    kw: ['bpdu filter', '过滤bpdu', '接pc的口', '不打stp报文'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n stp edged-port enable\n stp bpdu-filter enable'],
      ['思科', 'interface GigabitEthernet 0/1\n spanning-tree portfast\n spanning-tree bpdufilter enable'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n stp edged-port\n stp bpdu-filter enable'],
      ['锐捷', 'interface GigabitEthernet 0/1\n spanning-tree portfast\n spanning-tree bpdufilter enable']
    ],
    tip: '接了终端还让它参与 STP，终端一开关机就触发拓扑变更，全网 MAC 表被刷一遍。接 PC 的口开 portfast + bpdufilter，接交换机的口绝对不能开。'
  },
  {
    id: 'l2-mac-drift',
    devs: ['Switch'],
    name: 'MAC 地址漂移定位（找环路/私接）',
    kw: ['mac漂移', 'mac地址漂移', 'mac flapping', '同一个mac两个口', '一个mac到处跳'],
    cmds: [
      ['华为', 'display mac-address flapping\nmac-address flapping detection'],
      ['思科', 'show mac address-table | include <MAC>\nshow mac address-table move update'],
      ['H3C', 'display mac-address mac-move\nmac-address notification mac-move'],
      ['锐捷', 'show mac-address-table | include <MAC>']
    ],
    tip: '同一个 MAC 在两个口之间来回跳，八成是环路或者有人私接了路由器。先开漂移检测让它自己报出来，再去那两个口的方向上找环路——比盲目拔线快得多。'
  },
  {
    id: 'l2-storm-root',
    devs: ['Switch'],
    name: '广播风暴定位（端口流量排名）',
    kw: ['广播风暴', '风暴定位', '谁在发广播', '端口流量排名'],
    cmds: [
      ['华为', 'display interface GigabitEthernet 0/0/1 | include broadcast\ndisplay interface brief'],
      ['思科', 'show interfaces | include broadcast\nshow interfaces sorting'],
      ['H3C', 'display interface GigabitEthernet 1/0/1\ndisplay interface brief'],
      ['锐捷', 'show interfaces counters broadcast']
    ],
    tip: '风暴时设备基本卡死，先看哪个口 broadcast 涨得最快，直接 shutdown 那个口止血，再慢慢查。别一上来就抓包，sshui 抓包本身会把 CPU 打死。'
  },
  {
    id: 'l2-lacp-check',
    devs: ['Switch'],
    name: '链路聚合状态排查（成员口是否选中）',
    kw: ['聚合不up', 'lacp状态', '成员口', 'eth-trunk排查', '聚合只有一半带宽'],
    cmds: [
      ['华为', 'display eth-trunk 1\ndisplay lacp peer'],
      ['思科', 'show etherchannel summary\nshow lacp neighbor'],
      ['H3C', 'display link-aggregation verbose\ndisplay link-aggregation summary'],
      ['锐捷', 'show aggregateport summary\nshow lacp neighbor']
    ],
    tip: '聚合起来带宽没翻倍，先看成员口的状态是不是 (U) 或 Selected。两端速率/双工不一致、或者一端静态一端 LACP，都会导致只有部分口被选中，其余全是 standby。'
  },
  {
    id: 'l2-mlag',
    devs: ['Switch'],
    name: '跨设备聚合 M-LAG / MC-LAG',
    kw: ['mlag', 'mc-lag', '跨设备聚合', '双活', 'vpc', '堆叠替代'],
    cmds: [
      ['华为', 'dfs-group 1\ndfs-group 1 priority 150\ninterface Eth-Trunk 1\n mode lacp-static\n dfs-group 1 m-lag 1'],
      ['思科', 'feature vpc\nvpc domain 1\n peer-keepalive destination 10.1.1.2\ninterface port-channel1\n vpc 1'],
      ['H3C', 'm-lag system-mac 0000-0000-0001\nm-lag system-number 1\nm-lag system-priority 150\ninterface Bridge-Aggregation 1\n port m-lag group 1'],
      ['锐捷', 'mlag domain 1\n mlag peer-address 10.1.1.2\ninterface AggregatePort 1\n mlag 1']
    ],
    tip: '双活比堆叠稳——一台升级另一台还能转发。但 M-LAG 要配 peer-link 和 keepalive 两条链路，keepalive 断了会双主，比堆叠分裂更隐蔽。思科 NX-OS 叫 vPC，华为叫 M-LAG，H3C 也叫 M-LAG。'
  },
  {
    id: 'l2-dhcp-option82',
    devs: ['Switch'],
    name: 'DHCP Option 82（定位谁拿的地址）',
    kw: ['option82', 'dhcp选项', '定位dhcp用户', 'dhcp snooping option'],
    cmds: [
      ['华为', 'dhcp snooping enable\ndhcp option82 insert enable\ninterface GigabitEthernet 0/0/1\n dhcp snooping trusted'],
      ['思科', 'ip dhcp snooping\nip dhcp snooping vlan 10\nno ip dhcp snooping information option allow-untrusted'],
      ['H3C', 'dhcp snooping enable\ndhcp snooping information enable\ninterface GigabitEthernet 1/0/1\n dhcp snooping trust'],
      ['锐捷', 'ip dhcp snooping\nip dhcp snooping vlan 10']
    ],
    tip: '开了 Option 82 后，DHCP 服务器日志里能直接看到「哪个交换机哪个口」拿的地址，查私接和定位用户特别快。注意上行口要配 trusted，否则服务器回的包会被丢掉。'
  },
  {
    id: 'l2-arp-proxy',
    devs: ['Switch'],
    name: 'ARP 代理（跨 VLAN 互通但隔离广播）',
    kw: ['arp代理', 'proxy arp', 'arp proxy', '端口隔离后互通'],
    cmds: [
      ['华为', 'interface Vlanif 10\n arp-proxy enable\n arp-proxy inter-sub-vlan-proxy enable'],
      ['思科', 'interface Vlan10\n ip proxy-arp'],
      ['H3C', 'interface Vlan-interface 10\n proxy-arp enable'],
      ['锐捷', 'interface Vlan 10\n ip proxy-arp']
    ],
    tip: '端口隔离之后，同一个网段里两个端口不能互通了，这时用 ARP 代理可以让它们经过三层绕一下。华为的 inter-sub-vlan-proxy 是给 Super VLAN 用的，别配错。'
  },
  {
    id: 'l2-port-security-sticky',
    devs: ['Switch'],
    name: '端口安全（粘滞 MAC，换机器就断）',
    kw: ['粘滞mac', 'sticky', '端口绑定mac', '换电脑上不了网', '换了电脑上不了网', '新电脑插上不通', '重装系统后上不了网'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port-security enable\n port-security max-mac-num 2\n port-security mac-address sticky'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport port-security\n switchport port-security maximum 2\n switchport port-security mac-address sticky\n switchport port-security violation restrict'],
      ['H3C', 'port-security enable\ninterface GigabitEthernet 1/0/1\n port-security max-mac-count 2\n port-security port-mode autolearn'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport port-security\n switchport port-security maximum 2\n switchport port-security mac-address sticky']
    ],
    tip: '配了 sticky 又没写 violation 动作，默认是 protect——新机器接进来就是不通，而且没日志。排查「换了台电脑上不了网」先看这里，别去查 DHCP。'
  },
  {
    id: 'l2-mac-notify',
    devs: ['Switch'],
    name: 'MAC 上下线通知（接终端做联动）',
    kw: ['mac通知', 'mac上线告警', '终端上下线', 'mac trap'],
    cmds: [
      ['华为', 'mac-address notification enable\nsnmp-agent trap enable feature-name l2if'],
      ['思科', 'mac address-table notification\nmac address-table notification mac-move\nsnmp-server enable traps mac-notification'],
      ['H3C', 'mac-address notification enable\nsnmp-agent trap enable mac-address'],
      ['锐捷', 'mac-address-table notification\nsnmp-server enable traps mac-notification']
    ],
    tip: '做资产准入、终端在线统计时靠这个上报。开了以后 MAC 一变动就发 trap，量大时要限速，否则 NMS 会被淹。'
  },
  {
    id: 'l2-vlan-interface-down',
    devs: ['Switch'],
    name: 'VLAN 内所有端口 down 时网关跟着 down',
    kw: ['vlanif down', '网关不通', 'vlan没端口', 'vlan接口不up'],
    cmds: [
      ['华为', 'display vlan 10\ndisplay interface Vlanif 10'],
      ['思科', 'show vlan id 10\nshow ip interface Vlan10'],
      ['H3C', 'interface Vlan-interface 10\n display vlan 10'],
      ['锐捷', 'interface Vlan 10\n no shutdown']
    ],
    tip: '交换机上一个 VLAN 里只要没有 up 的端口，对应的三层网关接口就会 down，路由表里这条直连路由直接消失。查「网关 ping 不通但配置都在」时，先确认这个 VLAN 还有没有活着的端口。'
  },
  {
    id: 'l2-super-vlan-arp',
    devs: ['Switch'],
    name: 'Super VLAN 下子 VLAN 互通',
    kw: ['supervlan互通', 'sub-vlan互通', 'vlan聚合互访'],
    cmds: [
      ['华为', 'vlan 100\n aggregate-vlan\n access-vlan 10 20\ninterface Vlanif 100\n arp-proxy inter-sub-vlan-proxy enable'],
      ['思科', 'vlan 100\n private-vlan primary\n private-vlan association 10,20'],
      ['H3C', 'vlan 100\n supervlan\n subvlan 10 20\ninterface Vlan-interface 100\n local-proxy-arp enable'],
      ['锐捷', 'vlan 100\n supervlan\n subvlan 10 20']
    ],
    tip: 'Super VLAN 省地址但默认子 VLAN 之间不通，必须开 ARP 代理。很多人配完发现「同网段互 ping 不通」就是漏了这一步。'
  },
  {
    id: 'l2-port-isolate-uplink',
    devs: ['Switch'],
    name: '端口隔离 + 上行口例外（隔离域内只通网关）',
    kw: ['隔离上行口', 'uplink', '隔离组', '隔离后还能上网'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/24\n port-isolate enable group 1\n port-isolate uplink-port group 1'],
      ['思科', 'interface GigabitEthernet 0/24\n switchport mode access\n switchport protected'],
      ['H3C', 'interface GigabitEthernet 1/0/24\n port-isolate uplink-port group 1'],
      ['锐捷', 'interface GigabitEthernet 0/24\n switchport protected']
    ],
    tip: '隔离组里必须留一个 uplink 口通向网关，否则整组都上不了网。华为配 uplink-port 时该口不能再加入隔离组，写了会报冲突。'
  },
  {
    id: 'l2-stp-topo-change',
    devs: ['Switch'],
    name: 'STP 拓扑变更频繁（网络一阵一阵卡）',
    kw: ['拓扑变更', 'tc报文', 'stp震荡', '网络时快时慢', '一阵一阵卡', '网络时断时续'],
    cmds: [
      ['华为', 'display stp brief\ndisplay stp tc-bpdu statistics\n stp tc-protection interval 10\n stp tc-protection threshold 3'],
      ['思科', 'show spanning-tree detail | include topology\n spanning-tree portfast\n spanning-tree uplinkfast'],
      ['H3C', 'display stp brief\ndisplay stp tc-bpdu statistics\n stp tc-protection interval 10'],
      ['锐捷', 'show spanning-tree\n spanning-tree portfast default']
    ],
    tip: '接终端的口没开 portfast，每次插拔都发 TC，全网 MAC 表被刷，表现就是「网络一阵一阵卡」。开 TC 保护能限流，但根治要找出哪个口在频繁发 TC。'
  }
];

module.exports = { L2_EXTRA };
