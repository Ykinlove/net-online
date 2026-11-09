// utils/cmdbook.js —— 内置命令百科
// 同一个功能点，四家厂商（华为 / 思科 / H3C / 锐捷）分别怎么写，放在一起对照。
//
// 字段说明
//   id    唯一键
//   devs  适用设备，取值同 seed.js 的 DEVICES
//   name  功能点名称（搜索主要看这个）
//   kw    别名 / 同义词，补充搜索用
//   cmds  [[厂商, 命令], ...]，命令里的 \n 就是换行
//   tip   最容易记混的地方（可空）

const VENDORS = ['华为', '思科', 'H3C', '锐捷'];

/* 云端内容热更新：覆盖层。分包引主包公共资源。 */
const hotfix = require('../../utils/hotfix.js');

/* 扩充库分文件维护，避免单文件过大 */
const { BASIC_EXTRA } = require('./cmdbook-basic.js');
const { NET_EXTRA } = require('./cmdbook-net.js');
const { NET2_EXTRA } = require('./cmdbook-net2.js');
const { L2_EXTRA } = require('./cmdbook-l2.js');
const { ROUTE_EXTRA } = require('./cmdbook-route.js');
const { ROUTE2_EXTRA } = require('./cmdbook-route2.js');
const { L3_EXTRA } = require('./cmdbook-l3.js');
const { MCAST_EXTRA } = require('./cmdbook-mcast.js');
const { V6_EXTRA } = require('./cmdbook-v6.js');
const { MPLS_EXTRA } = require('./cmdbook-mpls.js');
const { HCIE_EXTRA } = require('./cmdbook-hcie.js');
const { HCIP_EXTRA } = require('./cmdbook-hcip.js');
const { CCIE_EXTRA } = require('./cmdbook-ccie.js');
const { VENDOR_MAIN } = require('./cmdbook-vendor-main.js');
const practice = require('./practice.js');
const { SEC_EXTRA } = require('./cmdbook-sec.js');
const { TROUBLE_EXTRA } = require('./cmdbook-trouble.js');
const { SYS_EXTRA } = require('./cmdbook-sys.js');
const { MV_EXTRA } = require('./cmdbook-mv.js');
const { FIELD_EXTRA } = require('./cmdbook-field.js');
const { NEWTECH_EXTRA } = require('./cmdbook-newtech.js');
const { BATCH27_EXTRA } = require('./cmdbook-batch27.js');
const { BATCH28_EXTRA } = require('./cmdbook-batch28.js');
const { BATCH29_EXTRA } = require('./cmdbook-batch29.js');
const { BATCH30_EXTRA } = require('./cmdbook-batch30.js');
const { BATCH31_EXTRA } = require('./cmdbook-batch31.js');
const { BATCH32_EXTRA } = require('./cmdbook-batch32.js');
const { BATCH33_EXTRA } = require('./cmdbook-batch33.js');
const { BATCH34_EXTRA } = require('./cmdbook-batch34.js');
const { BATCH35_EXTRA } = require('./cmdbook-batch35.js');
const { BATCH36_EXTRA } = require('./cmdbook-batch36.js');
const { BATCH37_EXTRA } = require('./cmdbook-batch37.js');
const { BATCH38_EXTRA } = require('./cmdbook-batch38.js');
const { BATCH39_EXTRA } = require('./cmdbook-batch39.js');
const { BATCH40_EXTRA } = require('./cmdbook-batch40.js');
const { BATCH41_EXTRA } = require('./cmdbook-batch41.js');
const { BATCH42_EXTRA } = require('./cmdbook-batch42.js');
const { BATCH43_EXTRA } = require('./cmdbook-batch43.js');
const { BATCH44_EXTRA } = require('./cmdbook-batch44.js');
const { BATCH45_EXTRA } = require('./cmdbook-batch45.js');
const { BATCH46_EXTRA } = require('./cmdbook-batch46.js');
const { BATCH47_EXTRA } = require('./cmdbook-batch47.js');
const { BATCH48_EXTRA } = require('./cmdbook-batch48.js');
const { BATCH49_EXTRA } = require('./cmdbook-batch49.js');
const { BATCH50_EXTRA } = require('./cmdbook-batch50.js');
const { BATCH51_EXTRA } = require('./cmdbook-batch51.js');
const { BATCH52_EXTRA } = require('./cmdbook-batch52.js');
const { BATCH53_EXTRA } = require('./cmdbook-batch53.js');
const { BATCH54_EXTRA } = require('./cmdbook-batch54.js');
const { BATCH55_EXTRA } = require('./cmdbook-batch55.js');
const { BATCH56_EXTRA } = require('./cmdbook-batch56.js');
const { BATCH57_EXTRA } = require('./cmdbook-batch57.js');
const { BATCH58_EXTRA } = require('./cmdbook-batch58.js');
const { BATCH59_EXTRA } = require('./cmdbook-batch59.js');
const { BATCH60_EXTRA } = require('./cmdbook-batch60.js');
const { BATCH61_EXTRA } = require('./cmdbook-batch61.js');
const { BATCH62_EXTRA } = require('./cmdbook-batch62.js');
const { BATCH63_EXTRA } = require('./cmdbook-batch63.js');
const { BATCH64_EXTRA } = require('./cmdbook-batch64.js');
const { BATCH65_EXTRA } = require('./cmdbook-batch65.js');
const { BATCH66_EXTRA } = require('./cmdbook-batch66.js');
const { BATCH67_EXTRA } = require('./cmdbook-batch67.js');
const { BATCH68_EXTRA } = require('./cmdbook-batch68.js');
const { BATCH69_EXTRA } = require('./cmdbook-batch69.js');
const { BATCH70_EXTRA } = require('./cmdbook-batch70.js');
const { BATCH71_EXTRA } = require('./cmdbook-batch71.js');
const { BATCH72_EXTRA } = require('./cmdbook-batch72.js');
const { BATCH73_EXTRA } = require('./cmdbook-batch73.js');
const { BATCH74_EXTRA } = require('./cmdbook-batch74.js');
const { BATCH75_EXTRA } = require('./cmdbook-batch75.js');
const { BATCH76_EXTRA } = require('./cmdbook-batch76.js');
const { BATCH77_EXTRA } = require('./cmdbook-batch77.js');
const { BATCH78_EXTRA } = require('./cmdbook-batch78.js');
const { BATCH79_EXTRA } = require('./cmdbook-batch79.js');
const { BATCH80_EXTRA } = require('./cmdbook-batch80.js');
const { BATCH81_EXTRA } = require('./cmdbook-batch81.js');
const { BATCH82_EXTRA } = require('./cmdbook-batch82.js');
const { BATCH83_EXTRA } = require('./cmdbook-batch83.js');
const { BATCH84_EXTRA } = require('./cmdbook-batch84.js');
const { BATCH85_EXTRA } = require('./cmdbook-batch85.js');
const { BATCH86_EXTRA } = require('./cmdbook-batch86.js');
const { BATCH87_EXTRA } = require('./cmdbook-batch87.js');
const { BATCH88_EXTRA } = require('./cmdbook-batch88.js');
const { BATCH89_EXTRA } = require('./cmdbook-batch89.js');
const { BATCH90_EXTRA } = require('./cmdbook-batch90.js');
const { BATCH91_EXTRA } = require('./cmdbook-batch91.js');
const { BATCH92_EXTRA } = require('./cmdbook-batch92.js');
const { BATCH93_EXTRA } = require('./cmdbook-batch93.js');
const { BATCH94_EXTRA } = require('./cmdbook-batch94.js');
const { BATCH95_EXTRA } = require('./cmdbook-batch95.js');
const { BATCH96_EXTRA } = require('./cmdbook-batch96.js');
const { BATCH97_EXTRA } = require('./cmdbook-batch97.js');
const { BATCH98_EXTRA } = require('./cmdbook-batch98.js');
const { BATCH99_EXTRA } = require('./cmdbook-batch99.js');
const { BATCH100_EXTRA } = require('./cmdbook-batch100.js');

const BASE = [
  {
    id: 'vlan-create',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '创建 VLAN',
    kw: ['新建vlan', '加vlan', '划vlan', 'vlan划分', 'vlan创建'],
    cmds: [
      ['华为', 'system-view\nvlan 10\n description office\nquit'],
      ['思科', 'configure terminal\nvlan 10\n name office\n exit'],
      ['H3C', 'system-view\nvlan 10\n name office\nquit'],
      ['锐捷', 'configure terminal\nvlan 10\n name office\n exit']
    ],
    tip: '华为 / H3C 描述用 description，思科 / 锐捷用 name。'
  },
  {
    id: 'vlan-port-access',
    devs: ['Switch'],
    name: '端口划入 VLAN',
    kw: ['划分端口', '端口划分', '端口加入vlan', 'access口', '改vlan', '端口vlan', '划分vlan', '怎么划分vlan', 'vlan怎么划分'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port link-type access\n port default vlan 10'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport mode access\n switchport access vlan 10'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n port link-type access\n port access vlan 10'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport mode access\n switchport access vlan 10']
    ],
    tip: '华为是 port default vlan，H3C 是 port access vlan —— 一字之差，最容易记混。'
  },
  {
    id: 'vlan-port-batch',
    devs: ['Switch'],
    name: '批量端口划入 VLAN',
    kw: ['批量划vlan', '端口组', 'range', '多端口', '一次性配多个口'],
    cmds: [
      ['华为', 'port-group group-member GigabitEthernet 0/0/1 to GigabitEthernet 0/0/8\n port link-type access\n port default vlan 10'],
      ['思科', 'interface range GigabitEthernet 0/1 - 8\n switchport mode access\n switchport access vlan 10'],
      ['H3C', 'interface range GigabitEthernet 1/0/1 to GigabitEthernet 1/0/8\n port link-type access\n port access vlan 10'],
      ['锐捷', 'interface range GigabitEthernet 0/1-8\n switchport mode access\n switchport access vlan 10']
    ],
    tip: '范围写法只有思科 / 锐捷是连字符（0/1-8），华为 / H3C 必须写 to。'
  },
  {
    id: 'trunk',
    devs: ['Switch'],
    name: '配置 Trunk 放行 VLAN',
    kw: ['trunk口', '级联口', '放行vlan', '透传vlan', '干道'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/24\n port link-type trunk\n port trunk allow-pass vlan 10 20'],
      ['思科', 'interface GigabitEthernet 0/24\n switchport trunk encapsulation dot1q\n switchport mode trunk\n switchport trunk allowed vlan 10,20'],
      ['H3C', 'interface GigabitEthernet 1/0/24\n port link-type trunk\n port trunk permit vlan 10 20'],
      ['锐捷', 'interface GigabitEthernet 0/24\n switchport mode trunk\n switchport trunk allowed vlan 10,20']
    ],
    tip: '放行是 permit（H3C）/ allow-pass（华为）/ allowed vlan（思科、锐捷）；VLAN 之间华为 H3C 用空格，思科锐捷用逗号。'
  },
  {
    id: 'vlan-show',
    devs: ['Switch'],
    name: '查看 VLAN 信息',
    kw: ['查vlan', '显示vlan', 'vlan列表', '有哪些vlan'],
    cmds: [
      ['华为', 'display vlan'],
      ['思科', 'show vlan brief'],
      ['H3C', 'display vlan'],
      ['锐捷', 'show vlan']
    ],
    tip: '华为 display vlan 默认只列 ID 和端口，要带 brief 才看得到 VLAN 名。'
  },
  {
    id: 'if-brief',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '查看接口状态',
    kw: ['查端口', '接口up', '端口状态', '接口down', '看接口'],
    cmds: [
      ['华为', 'display interface brief'],
      ['思科', 'show ip interface brief'],
      ['H3C', 'display interface brief'],
      ['锐捷', 'show ip interface brief']
    ],
    tip: '判断端口好坏就看两列：Status 是不是 up、Protocol 是不是 up。前者物理，后者协议。'
  },
  {
    id: 'svi',
    devs: ['Switch'],
    name: '三层接口配 IP（VLAN 网关）',
    kw: ['svi', '网关', 'vlanif', 'vlan接口', '配网关地址', '配网关', '网关怎么配', '配vlanif', 'vlanif怎么配', 'vlanif配置'],
    cmds: [
      ['华为', 'interface Vlanif 10\n ip address 192.168.10.1 24'],
      ['思科', 'interface Vlan 10\n ip address 192.168.10.1 255.255.255.0\n no shutdown'],
      ['H3C', 'interface Vlan-interface 10\n ip address 192.168.10.1 24'],
      ['锐捷', 'interface Vlan 10\n ip address 192.168.10.1 255.255.255.0\n no shutdown']
    ],
    tip: '华为叫 Vlanif，H3C 叫 Vlan-interface，思科 / 锐捷直接就是 Vlan。思科族掩码要写全，华为 / H3C 可以写 24。'
  },
  {
    id: 'route-static',
    devs: ['Switch', 'Router', '防火墙'],
    name: '静态路由',
    kw: ['加路由', '写路由', '指定下一跳', '静态'],
    cmds: [
      ['华为', 'ip route-static 192.168.20.0 24 192.168.10.2'],
      ['思科', 'ip route 192.168.20.0 255.255.255.0 192.168.10.2'],
      ['H3C', 'ip route-static 192.168.20.0 24 192.168.10.2'],
      ['锐捷', 'ip route 192.168.20.0 255.255.255.0 192.168.10.2']
    ],
    tip: '华为 / H3C 是 ip route-static，思科族是 ip route。掩码两家都能写，但省事程度不同：华为写 24 就行，思科必须写全 255.255.255.0，少写一段就会变成别掩码。'
  },
  {
    id: 'route-default',
    devs: ['Switch', 'Router', '防火墙'],
    name: '默认路由（缺省路由）配置',
    kw: ['缺省路由', '0.0.0.0', '出口路由', '默认网关路由', '配默认路由', '默认路由配置', '默认路由怎么配'],
    cmds: [
      ['华为', 'ip route-static 0.0.0.0 0 192.168.1.1'],
      ['思科', 'ip route 0.0.0.0 0.0.0.0 192.168.1.1'],
      ['H3C', 'ip route-static 0.0.0.0 0 192.168.1.1'],
      ['锐捷', 'ip route 0.0.0.0 0.0.0.0 192.168.1.1']
    ],
    tip: '华为的 0.0.0.0 0 就是 0.0.0.0/0，写 0.0.0.0 0.0.0.0 也认；思科必须四位全 0。真正的坑是没了下一跳或下一跳不可达 —— 路由表里显示但不生效，回程流量照样丢。'
  },
  {
    id: 'route-show',
    devs: ['Switch', 'Router', '防火墙'],
    name: '查看路由表',
    kw: ['查路由', '看路由表', '路由表', '有没有路由'],
    cmds: [
      ['华为', 'display ip routing-table'],
      ['思科', 'show ip route'],
      ['H3C', 'display ip routing-table'],
      ['锐捷', 'show ip route']
    ],
    tip: '华为 display ip routing-table 只显示最优路由，想看全部候选要加 verbose 或查协议表。'
  },
  {
    id: 'save',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '保存配置',
    kw: ['保存', 'write', '存盘', '配置保存', '不保存丢配置'],
    cmds: [
      ['华为', 'save\n（提示 Y/N 时输入 y）'],
      ['思科', 'write memory\n或 copy running-config startup-config'],
      ['H3C', 'save force'],
      ['锐捷', 'write memory']
    ],
    tip: '华为 / H3C 是 save，思科 / 锐捷是 write memory。H3C 加 force 可以不交互直接存。'
  },
  {
    id: 'show-run',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '查看当前配置',
    kw: ['看配置', '当前配置', 'running-config', '配置全文', '导出配置'],
    cmds: [
      ['华为', 'display current-configuration'],
      ['思科', 'show running-config'],
      ['H3C', 'display current-configuration'],
      ['锐捷', 'show running-config']
    ],
    tip: 'show run 输出极长，配 | include 或分屏关闭先，不然一屏屏翻到崩溃。'
  },
  {
    id: 'eth-trunk',
    devs: ['Switch'],
    name: '链路聚合（Eth-Trunk）',
    kw: ['聚合', '捆绑', 'eth-trunk', 'port-channel', '链路聚合', '双上行'],
    cmds: [
      ['华为', 'interface Eth-Trunk 1\n mode lacp-static\nquit\ninterface GigabitEthernet 0/0/1\n eth-trunk 1'],
      ['思科', 'interface range GigabitEthernet 0/1 - 2\n channel-group 1 mode active'],
      ['H3C', 'interface Bridge-Aggregation 1\n link-aggregation mode dynamic\nquit\ninterface GigabitEthernet 1/0/1\n port link-aggregation group 1'],
      ['锐捷', 'interface range GigabitEthernet 0/1-2\n port-group 1']
    ],
    tip: '聚合接口名字四家全不一样：Eth-Trunk / Port-channel / Bridge-Aggregation / AggregatePort。'
  },
  {
    id: 'stp',
    devs: ['Switch'],
    name: '生成树 STP',
    kw: ['生成树', 'stp', '环路', '根桥', 'root'],
    cmds: [
      ['华为', 'stp mode mstp\nstp root primary'],
      ['思科', 'spanning-tree mode rapid-pvst\nspanning-tree vlan 10 root primary'],
      ['H3C', 'stp mode mstp\nstp root primary'],
      ['锐捷', 'spanning-tree mode rstp\nspanning-tree priority 4096']
    ],
    tip: '先把根桥定在核心，别让接入交换机抢到根。display stp 看 CIST Root 是不是你以为的那台。'
  },
  {
    id: 'port-isolate',
    devs: ['Switch'],
    name: '端口隔离',
    kw: ['隔离', '端口隔离', '同vlan不能互通', 'isolate', '配端口隔离', '端口隔离怎么配'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port-isolate enable group 1'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport protected'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n port-isolate enable group 1'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport protected']
    ],
    tip: '思科 / 锐捷叫 protected，华为 / H3C 叫 port-isolate。'
  },
  {
    id: 'mirror',
    devs: ['Switch'],
    name: '端口镜像（抓包用）',
    kw: ['镜像', '抓包', 'monitor', 'span', '流量复制', '配端口镜像', '端口镜像怎么配'],
    cmds: [
      ['华为', 'observe-port 1 interface GigabitEthernet 0/0/24\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 both'],
      ['思科', 'monitor session 1 source interface GigabitEthernet 0/1 both\nmonitor session 1 destination interface GigabitEthernet 0/24'],
      ['H3C', 'mirroring-group 1 local\nmirroring-group 1 mirroring-port GigabitEthernet 1/0/1 both\nmirroring-group 1 monitor-port GigabitEthernet 1/0/24'],
      ['锐捷', 'monitor session 1 source interface GigabitEthernet 0/1 both\nmonitor session 1 destination interface GigabitEthernet 0/24']
    ],
    tip: '镜像口不要配业务，流量会翻倍。抓完记得删掉镜像组，否则一直占带宽。'
  },
  {
    id: 'mac-show',
    devs: ['Switch'],
    name: '查看 MAC 地址表',
    kw: ['mac地址', 'mac表', '查mac', 'mac漂移', '查mac地址表', '查看mac地址表', '看mac地址表', 'mac地址表怎么查', '查看某端口学到的mac', '某个端口学了哪些mac'],
    cmds: [
      ['华为', 'display mac-address'],
      ['思科', 'show mac address-table'],
      ['H3C', 'display mac-address'],
      ['锐捷', 'show mac-address-table']
    ],
    tip: '思科是 mac address-table（有空格），锐捷是 mac-address-table（有连字符）。'
  },
  {
    id: 'ssh',
    devs: ['Switch', 'Router', '防火墙'],
    name: '配置 SSH / Telnet 登录',
    kw: ['远程登录', 'ssh', 'telnet', 'vty', '登录配置', 'console', '配telnet', 'telnet怎么开', '开telnet', '配ssh登录', '关闭telnet', '关掉telnet', '禁用telnet'],
    cmds: [
      ['华为', 'rsa local-key-pair create\nstelnet server enable\nuser-interface vty 0 4\n authentication-mode aaa\n protocol inbound ssh'],
      ['思科', 'ip domain-name lab.local\ncrypto key generate rsa modulus 2048\nusername admin privilege 15 secret Admin@123\nline vty 0 4\n transport input ssh\n login local'],
      ['H3C', 'public-key local create rsa\nssh server enable\nline vty 0 4\n authentication-mode scheme\n protocol inbound ssh'],
      ['锐捷', 'ip domain-name lab.local\ncrypto key generate rsa\nusername admin privilege 15 password Admin@123\nline vty 0 4\n transport input ssh\n login local']
    ],
    tip: '最容易漏的一步：华为要先 rsa local-key-pair create，思科/锐捷要先配 ip domain-name 再生成密钥，否则 ssh 起不来。用户账号还得在 aaa / username 里建好，光开服务是登不进去的。'
  },
  {
    id: 'dhcp-server',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '配置 DHCP 服务',
    kw: ['dhcp', '地址池', '自动分配ip', 'pool'],
    cmds: [
      ['华为', 'dhcp enable\nip pool p1\n network 192.168.10.0 mask 24\n gateway-list 192.168.10.1\n dns-list 114.114.114.114'],
      ['思科', 'ip dhcp pool p1\n network 192.168.10.0 255.255.255.0\n default-router 192.168.10.1\n dns-server 114.114.114.114'],
      ['H3C', 'dhcp enable\ndhcp server ip-pool p1\n network 192.168.10.0 mask 255.255.255.0\n gateway-list 192.168.10.1\n dns-list 114.114.114.114'],
      ['锐捷', 'ip dhcp pool p1\n network 192.168.10.0 255.255.255.0\n default-router 192.168.10.1\n dns-server 114.114.114.114']
    ],
    tip: 'H3C 的地址池命令是 dhcp server ip-pool，比别人多一截。'
  },
  {
    id: 'ospf',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'OSPF 基础配置',
    kw: ['ospf', '动态路由', 'area', '邻居', '宣告网段'],
    cmds: [
      ['华为', 'ospf 1 router-id 1.1.1.1\n area 0\n  network 192.168.10.0 0.0.0.255'],
      ['思科', 'router ospf 1\n router-id 1.1.1.1\n network 192.168.10.0 0.0.0.255 area 0'],
      ['H3C', 'ospf 1 router-id 1.1.1.1\n area 0\n  network 192.168.10.0 0.0.0.255'],
      ['锐捷', 'router ospf 1\n router-id 1.1.1.1\n network 192.168.10.0 0.0.0.255 area 0']
    ],
    tip: '华为 / H3C 先 area 再 network，思科 / 锐捷把 area 写在 network 那一行末尾。'
  },
  {
    id: 'nat',
    devs: ['Router', '防火墙'],
    name: 'NAT（内网访问外网）',
    kw: ['nat', '上网', '地址转换', 'pat', '源nat', 'overload'],
    cmds: [
      ['华为', 'acl 2000\n rule 5 permit source 192.168.0.0 0.0.255.255\nquit\ninterface GigabitEthernet 0/0/0\n nat outbound 2000'],
      ['思科', 'access-list 1 permit 192.168.0.0 0.0.255.255\ninterface GigabitEthernet 0/1\n ip nat inside\ninterface GigabitEthernet 0/0\n ip nat outside\nip nat inside source list 1 interface GigabitEthernet 0/0 overload'],
      ['H3C', 'acl basic 2000\n rule 5 permit source 192.168.0.0 0.0.255.255\nquit\ninterface GigabitEthernet 1/0/0\n nat outbound 2000'],
      ['锐捷', 'access-list 1 permit 192.168.0.0 0.0.255.255\ninterface GigabitEthernet 0/1\n ip nat inside\ninterface GigabitEthernet 0/0\n ip nat outside\nip nat inside source list 1 interface GigabitEthernet 0/0 overload']
    ],
    tip: '华为 / H3C 一条 nat outbound 搞定，思科族必须分 inside / outside 两个口再写全局转换。'
  },
  {
    id: 'acl',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'ACL 访问控制',
    kw: ['acl', '访问控制', '禁ip', '放行', '黑名单'],
    cmds: [
      ['华为', 'acl 3000\n rule 5 deny ip source 192.168.10.0 0.0.0.255 destination 192.168.20.0 0.0.0.255\n rule 10 permit ip'],
      ['思科', 'access-list 100 deny ip 192.168.10.0 0.0.0.255 192.168.20.0 0.0.0.255\naccess-list 100 permit ip any any'],
      ['H3C', 'acl advanced 3000\n rule 5 deny ip source 192.168.10.0 0.0.0.255 destination 192.168.20.0 0.0.0.255\n rule 10 permit ip'],
      ['锐捷', 'access-list 100 deny ip 192.168.10.0 0.0.0.255 192.168.20.0 0.0.0.255\naccess-list 100 permit ip any any']
    ],
    tip: '最后那条 permit any 千万别漏 —— ACL 末尾默认隐式拒绝所有，漏了连管理流量都断。'
  },
  {
    id: 'ap-show',
    devs: ['AC'],
    name: '查看 AP 上线状态',
    kw: ['ap', '无线', 'ap状态', '上线', 'ac', '掉线'],
    cmds: [
      ['华为', 'display ap all'],
      ['思科', 'show ap summary'],
      ['H3C', 'display wlan ap all'],
      ['锐捷', 'show ap-config summary']
    ],
    tip: 'AP 上不了线看三样：二层能不能通、AC 地址对不对、AP 有没有拿到 IP。顺序别乱。'
  },
  {
    id: 'factory-reset',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '恢复出厂 / 清空配置',
    kw: ['恢复出厂', '重置', '清空配置', 'erase', 'reset', '初始化'],
    cmds: [
      ['华为', 'reset saved-configuration\nreboot'],
      ['思科', 'erase startup-config\nreload'],
      ['H3C', 'reset saved-configuration\nreboot'],
      ['锐捷', 'delete flash:config.text\nreload']
    ],
    tip: '清完必须重启才生效。思科 erase 之后别急着断电，要等 reload 提示存不存 running-config 时选 no。'
  }
];

let BOOK = BASIC_EXTRA.concat(
  BASE,
  NET_EXTRA, NET2_EXTRA, L2_EXTRA,
  ROUTE_EXTRA, ROUTE2_EXTRA, L3_EXTRA,
  MCAST_EXTRA, V6_EXTRA, MPLS_EXTRA,
  HCIE_EXTRA,
  HCIP_EXTRA,
  CCIE_EXTRA,
  VENDOR_MAIN,
  practice.getPractice(),
  SEC_EXTRA,
  TROUBLE_EXTRA,
  SYS_EXTRA,
  MV_EXTRA,
  FIELD_EXTRA,
  NEWTECH_EXTRA,
  BATCH27_EXTRA,
  BATCH28_EXTRA,
  BATCH29_EXTRA,
  BATCH30_EXTRA,
  BATCH31_EXTRA,
  BATCH32_EXTRA,
  BATCH33_EXTRA,
  BATCH34_EXTRA,
  BATCH35_EXTRA,
  BATCH36_EXTRA,
  BATCH37_EXTRA,
  BATCH38_EXTRA,
  BATCH39_EXTRA,
  BATCH40_EXTRA,
  BATCH41_EXTRA,
  BATCH42_EXTRA,
  BATCH43_EXTRA,
  BATCH44_EXTRA,
  BATCH45_EXTRA,
  BATCH46_EXTRA,
  BATCH47_EXTRA,
  BATCH48_EXTRA,
  BATCH49_EXTRA,
  BATCH50_EXTRA,
  BATCH51_EXTRA,
  BATCH52_EXTRA,
  BATCH53_EXTRA,
  BATCH54_EXTRA,
  BATCH55_EXTRA,
  BATCH56_EXTRA,
  BATCH57_EXTRA,
  BATCH58_EXTRA,
  BATCH59_EXTRA,
  BATCH60_EXTRA,
  BATCH61_EXTRA,
  BATCH62_EXTRA,
  BATCH63_EXTRA,
  BATCH64_EXTRA,
  BATCH65_EXTRA,
  BATCH66_EXTRA,
  BATCH67_EXTRA,
  BATCH68_EXTRA,
  BATCH69_EXTRA,
  BATCH70_EXTRA,
  BATCH71_EXTRA,
  BATCH72_EXTRA,
  BATCH73_EXTRA,
  BATCH74_EXTRA,
  BATCH75_EXTRA,
  BATCH76_EXTRA,
  BATCH77_EXTRA,
  BATCH78_EXTRA,
  BATCH79_EXTRA,
  BATCH80_EXTRA,
  BATCH81_EXTRA,
  BATCH82_EXTRA,
  BATCH83_EXTRA,
  BATCH84_EXTRA,
  BATCH85_EXTRA,
  BATCH86_EXTRA,
  BATCH87_EXTRA,
  BATCH88_EXTRA,
  BATCH89_EXTRA,
  BATCH90_EXTRA,
  BATCH91_EXTRA,
  BATCH92_EXTRA,
  BATCH93_EXTRA,
  BATCH94_EXTRA,
  BATCH95_EXTRA,
  BATCH96_EXTRA,
  BATCH97_EXTRA,
  BATCH98_EXTRA,
  BATCH99_EXTRA,
  BATCH100_EXTRA
);

/* 疑问词 / 口头语：搜的时候先剔掉，否则「怎么划分端口」这种搜不到。
   「还是」很关键——用户说「网线插上了还是不亮」，剔掉后切成
   「网线插上了 / 不亮」两个词，才能命中「网线插上不亮」。
   「是什么」必须排在「什么」前面——否则「dis cu 是什么的简写」
   先被「什么」切成「cu是的简写」，两个关键词全废。 */
const STOP = ['有什么', '好用的', '好用', '是什么', '怎么', '如何', '怎样', '咋样', '咋', '什么', '请问', '有没有', '没有', '帮我', '一下', '在哪里', '在哪', '求', '多久', '有人', '为什么', '哪些', '能不能', '可以', '想要', '需要', '一个',
  '一份', '一个', '一条', '看看', '告诉我',
  '还是', '到底', '究竟', '难不成', '咋办',
  /* 口语里没有实际检索意义的 filler：‘没有真机怎么练’‘全网断网怎么处理’
     带上这些词会把它们当成必含词，直接把目标条目挤出结果，故一并剔除 */
  '处理', '一直', '落地', '才', '之前', '以后', '东西', '要注意', '注意',
  /* 「但」是纯转折词，剔掉后「能ping通但网页打不开」切成
     「能ping通 / 网页打不开」两个词，才能命中库里的「网页打不开」。
     注意别把「的」也加进来——「的目的地址」会被切成「目地址」，
     把「目的地址」这个真术语毁了；单字「的」交给 dropGreedy 兜底就行 */
  '但是', '但', '某个', '这个', '那个'];

/* 口语里的动词前缀：查端口占用 / 看日志 / 找大文件 → 端口占用 / 日志 / 大文件
   后面这批是「配个 / 起个 / 做个」，不削掉的话整词匹配不上任何条目 */
const LEAD = ['查一下', '看一下', '找一下', '查看', '查询', '查找', '看看',
  '怎么配', '如何配', '怎样配', '怎么设', '如何设',
  '配个', '起个', '做个', '设个', '加个', '弄个', '调个', '写个', '建个', '开个', '拉个', '搞个',
  '查下', '看下', '查', '看', '找',
  /* 口语副词前缀：老掉线 / 老是断 / 总死机 → 掉线 / 断 / 死机。
     放在最后，让上面的动词前缀先匹配；这只是「备选」，原词照样参与匹配，
     所以不会把「总带宽」「老板」这类真词弄丢。 */
  '老是', '总是', '老', '总'];
function stripLead(w) {
  for (let i = 0; i < LEAD.length; i++) {
    const p = LEAD[i];
    /* 至少留两个字，免得「查看」被削成空词 */
    if (w.length > p.length + 1 && w.indexOf(p) === 0) return w.slice(p.length);
  }
  return w;
}

/**
 * 归一化：小写 → 去口头语 → 中英文之间断开 → 切词
 * 「怎么配置trunk」→ ['trunk']，'配置' 保留参与匹配
 */
function norm(s) {
  let t = String(s || '').toLowerCase();
  for (let i = 0; i < STOP.length; i++) {
    t = t.split(STOP[i]).join(' ');
  }
  t = t.replace(/([\u4e00-\u9fa5])([a-z0-9])/g, '$1 $2')
       .replace(/([a-z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
  /* 纯标点（比如只敲了个 / 或 -）不参与搜索，否则会命中一大片 */
  return t.split(/\s+/).filter(function (w) {
    return w && /[a-z0-9\u4e00-\u9fa5]/.test(w);
  }).map(function (w) {
    /* 句尾语气词：用户问「设备自己重启了」，库里写「设备自己重启」，差一个「了」就搜不到。
       只在够长的时候剥，免得「丢了」被削成「丢」。
       但「没了」「不了」是完整否定语义——「日志重启后没了」剥成「日志重启后没」，
       库里的「日志重启后没了」反而对不上了，所以剥完以 没/不/未 结尾的一律不剥。 */
    if (w.length >= 4 && /[了呢吧啊呀哦]$/.test(w)) {
      const stripped = w.slice(0, -1);
      if (!/[没不未]$/.test(stripped)) return stripped;
    }
    return w;
  });
}

/* 强意图词按长度降序，保证「查看」先于「查」被匹配到。
   STRONG_INTENT 定义在后面，这里懒加载，避免 TDZ。 */
let STRONG_SORTED = null;
function strongSorted() {
  if (!STRONG_SORTED) {
    STRONG_SORTED = STRONG_INTENT.slice().sort(function (a, b) { return b.length - a.length; });
  }
  return STRONG_SORTED;
}

/**
 * 拆开「动作词 + 主题词」黏成一串的情况。
 * norm 只按空格和中英文边界切，「配置管理ip」会变成「配置管理」+「ip」，
 * 「配置管理」这个词库里根本没人叫这个，于是「管理 IP 与带外管理口」
 * 整条进不了「所有词都命中」的候选集，搜出来全是「配置备份策略」这类噪音。
 * 只拆强意图词打头、且剩下的确实是词（受词表约束）的串，不乱拆。
 */
function splitIntentHead(w) {
  const list = strongSorted();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    /* 只拆两字以上的动作词。单字（改 / 配 / 看）拆开代价太大：
       「改设备密码」会变成「改」+「设备密码」，「密码复杂度」那条直接被踢出结果。 */
    if (p.length < 2) continue;
    if (w.length > p.length + 1 && w.indexOf(p) === 0) {
      const rest = w.slice(p.length);
      if (rest.length >= 2 && buildVocab().has(rest)) return [p, rest];
    }
  }
  return null;
}

/**
 * 每个词再配一个「去掉口语动词」的候选：查端口占用 → 端口占用。
 * 用「或」的关系参与匹配，原词仍拿到满分，削过的词只补召回，
 * 这样「看日志」既能精确命中，也不会因为一个「看」字搜不到。
 */
function expand(words) {
  const groups = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    /* 先看整串是不是「动作词 + 主题词」黏在一起（查看配置 / 配置管理）。
       要在 stripLead 之前判断——剥完前缀，「查看配置」就只剩「配置」，
       动作词丢了，标题覆盖信号也就无从比较了。 */
    const spRaw = splitIntentHead(w);
    if (spRaw) { groups.push([spRaw[0]]); groups.push([spRaw[1]]); continue; }

    const s = stripLead(w);
    const base = s === w ? [w] : [w, s];
    /* 剥完动词前缀剩下的还是长串汉字（≥3 字）就走词表切词：
       「上架要配」→「上架」，切成多个片段就各自成组（AND），
       一个都切不出来才保留原串（老行为）。 */
    const target = base[base.length - 1];
    if (/^[\u4e00-\u9fa5]{3,}$/.test(target)) {
      const segs = segChinese(target);
      if (segs.length !== 1 || segs[0] !== target) {
        /* 只切出一个片段 = 切坏了：「接口不亮」被切成「接口不」，尾字丢了。
           这时把原词一起当备选，别让整串说法凭空消失。 */
        if (segs.length === 1) { groups.push([segs[0], target]); continue; }
        for (let j = 0; j < segs.length; j++) {
          /* 切出来的片段也要剥一遍口语前缀：「数据库 / 老掉线」里的「老掉线」
             全库没人这么写，剥成「掉线」才对得上「会话老化」那条 */
          const sg = segs[j];
          const cut = stripLead(sg);
          groups.push(cut === sg ? [sg] : [sg, cut]);
        }
        continue;
      }
    }
    const sp = splitIntentHead(base[base.length - 1]);
    if (sp) { groups.push([sp[0]]); groups.push([sp[1]]); continue; }
    groups.push(base);
  }
  return groups;
}

/**
 * 单次搜索里会反复用到小写文本和同一个词的正则，这里缓存下来，
 * 避免 298 条 × 4 组命令每次都重新拼串、重新编译正则。
 */
let IDX = null;
let IDX_VER = '';

/**
 * 数据源版本号 —— 索引 / 词表 / 模板索引统一以它为准。
 *
 * 为什么不能只看 hotfix.version()：
 * 练习题库走 CloudBase 异步加载（practice.loadPractice），
 * 加载完成后 BOOK 被 concat，但练习题**不经 hotfix**，
 * hotfix.version() 永远不会因它变化 → 索引永不失效 →
 * 练习题进了 BOOK 却进不了索引 → 永久搜不到。
 * 所以把「练习题加载代数」并进版本键，两个来源都能触发失效。
 */
let DATA_VER = 0;
function dataVer() {
  return hotfix.version() + ':' + DATA_VER;
}

/* 内置种子永远留一份原始引用：外部注入的数据集可能被替换多次，
   练习题库也是异步来的，rebuildBook() 需要一个稳定的基准。 */
const BOOK_BUILTIN = BOOK;

/* 单条百科条目 → 索引结构（本地条目与云端新增条目共用）。 */
function indexBook(p) {
  return {
    it: p,
    name: p.name.toLowerCase(),
    kws: (p.kw || []).join(' ').toLowerCase(),
    /* 去掉空格版本：查「整句原话」时用，避免「OSPF 邻居起不来」
       因为标题里多一个空格就判不中 */
    ns: p.name.toLowerCase().replace(/\s+/g, ''),
    klist: (p.kw || []).map(function (k) { return String(k).toLowerCase().replace(/\s+/g, ''); }),
    body: (p.cmds || []).map(function (c) { return c[1]; }).join('\n').toLowerCase(),
    /* 分类结果缓存在索引记录上：classifyItem 要对每条遍历 10 分类 × 615 关键词，
       全量 1216 条 = 74.8 万次 indexOf，而 categoryStats() 和 listBy({cat})
       各自重跑一遍。索引整体重建时本记录一并被替换，缓存自动失效，
       不需要额外版本号，也不会与热更新漂移。undefined = 还没算过。 */
    cat: undefined,
    /* 条目名是静态的，意图识别预算一次 —— 否则每次搜索都要对 1216 条
       重算一遍 INTENT 匹配（实测占总打分开销的大头）。 */
    intents: intentsOf(p.name)
  };
}

function buildIndex() {
  /* 云端热更新拉到新数据后 version 会变，这里据此失效索引。
     没有覆盖时 applyPatch 原样返回，性能开销可忽略（且只在 version 变化时重建）。 */
  if (IDX && IDX_VER === dataVer()) return IDX;

  const base = BOOK.map(function (it) {
    return indexBook(hotfix.applyPatch(it, 'book'));
  });

  /* 合并云端「已批准新增条目」（社区投稿审核通过后、本地包还没有的新条目）。
     本地已有同名 id 时本地优先，跳过云端新增，避免重复。 */
  const extras = hotfix.getAllExtras('book');
  const seen = {};
  BOOK.forEach(function (it) { seen[it.id] = 1; });
  extras.forEach(function (it) {
    if (!it || !it.id || seen[it.id]) return;
    /* approvedAt 是云端元数据（给增量游标用），不进条目本体 */
    const clean = {};
    Object.keys(it).forEach(function (k) {
      if (k !== 'approvedAt') clean[k] = it[k];
    });
    if (!Array.isArray(clean.devs) || !clean.devs.length) {
      clean.devs = ['Switch', 'Router', 'AC', 'AP', '防火墙'];
    }
    base.push(indexBook(clean));
  });

  IDX = base;
  IDX_VER = dataVer();
  return IDX;
}

/* 库内词表：所有条目标题 + 别名里的中文片段（2~6 字）。
   用来给口语查询切词——「新交换机上架要配什么」这种整串汉字，
   norm 只按空格切，会变成一个谁也匹配不上的大词；
   用词表做前向最大匹配切成「交换机 / 上架」，才能命中条目。
   只收标题和别名，不收正文——正文太杂，会把词表撑成万能匹配。 */
let VOCAB = null;
let VOCAB_VER = '';
function buildVocab() {
  /* 词表也要跟着数据源走：原来只看 BOOK（包内原始数据），
     不含热更新覆盖、不含云端批准的新增条目 —— 那些条目就切不出词，搜不到。
     而且原来只建一次、永不失效，热更新改了名词表也不更新。
     改成从索引取（索引已叠 applyPatch + extras）+ 按 dataVer() 失效。 */
  const ver = dataVer();
  if (VOCAB && VOCAB_VER === ver) return VOCAB;
  const set = new Set();
  const RE = /[\u4e00-\u9fa5]+/g;
  const all = buildIndex();
  for (let i = 0; i < all.length; i++) {
    const rec = all[i];
    const text = rec.name + ' ' + rec.kws;
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(text))) {
      const run = m[0];
      const max = Math.min(6, run.length);
      for (let L = 2; L <= max; L++) {
        for (let p = 0; p + L <= run.length; p++) set.add(run.substr(p, L));
      }
    }
  }
  /* 模板的关键词也要进词表。少了这一步，模板独有的说法切不开——
     「默认路由配置」在百科里切不出「默认路由」（百科没这条说法），
     整词去匹配模板也匹配不上（模板写的是「默认路由」不是「默认路由配置」），
     结果就是模板明明有、却搜不到。 */
  const tpls = tplIndex();
  for (let i = 0; i < tpls.length; i++) {
    const t = tpls[i].it;
    const text = [t.name, t.cat].concat(t.kw || []).join(' ');
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(text))) {
      const run = m[0];
      const max = Math.min(8, run.length);
      for (let L = 2; L <= max; L++) {
        for (let p = 0; p + L <= run.length; p++) set.add(run.substr(p, L));
      }
    }
  }
  VOCAB = set;
  VOCAB_VER = ver;
  return set;
}

/* 前向最大匹配切词。切不出任何两字以上的片段就原样返回
   （保持老行为：整串当子串去匹配）。 */
function segChinese(w) {
  const vocab = buildVocab();
  const segs = [];
  let i = 0;
  while (i < w.length) {
    let hit = false;
    const max = Math.min(6, w.length - i);
    for (let L = max; L >= 2; L--) {
      if (vocab.has(w.substr(i, L))) {
        segs.push(w.substr(i, L));
        i += L;
        hit = true;
        break;
      }
    }
    if (!hit) { segs.push(w[i]); i++; }
  }
  const multi = segs.filter(function (s) { return s.length >= 2; });
  return multi.length ? multi : [w];
}

const RE_CACHE = {};
function wordRE(w) {
  let r = RE_CACHE[w];
  if (!r) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /* 单个字母（option c 的 c / option a 的 a）必须前后都是边界。
       否则 car、class、acl 里的 c 全中，「c」命中面超过 35% 被当泛词剔掉，
       跨域 A/B/C 三条立刻打成平手按数组次序排——用户问 Option C 给你 Option A。 */
    if (w.length === 1) {
      r = new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)');
    } else {
      r = new RegExp('(^|[^a-z0-9])' + esc);
    }
    RE_CACHE[w] = r;
  }
  return r;
}

/**
 * 单个词是否命中。
 * 英文 / 数字按「词首对齐」匹配：允许后缀延续（vlan 命中 Vlanif、vlan-interface），
 * 但不允许从词中间开始（ping 不会命中 snoo-ping，nat 不会命中 desti-nat-ion）。
 * 中文直接子串匹配。
 */
function hasWord(hay, w) {
  if (/^[a-z0-9]+$/.test(w)) return wordRE(w).test(hay);
  return hay.indexOf(w) >= 0;
}

/* 症状词：用户描述现象时会带，但它不代表任何技术。
   搜「ap起不来」如果让「起不来」拿高权重，就会搜出「OSPF 邻居起不来」——方向完全错了。 */
const SYMPTOM = ['起不来', '不亮', '不通', '掉线', '失败', '卡住', '卡死', '很慢', '丢包',
  '断了', '无法', '不能', '不了', '挂了', '死了', '没了', '丢了', '中断', '异常'];

/**
 * 意图词表：用户真正要做的动作。
 * 这一层的存在理由：搜「配telnet」时，光看词根本分不出「配置 SSH/Telnet 登录」
 * 和「从设备 telnet 到另一台设备」——两条都含 telnet、都是名称命中、同分，
 * 最后靠入库顺序决定谁第一。把「配」这个动作单独提出来，才能把配置型条目顶上去。
 */
const INTENT = {
  /* 只收中文动作词。display / show / config 这类本身就是命令名、也是主题词，
     当意图词收进来会让「show run」搜出「值班 runbook」——run 只是 runbook 的词头。 */
  view: ['查看', '查询', '查', '看', '显示', '列出', '列一下', '有没有', '有哪些', '多少'],
  config: ['配置', '设置', '配', '改', '修改', '新建', '添加', '增加', '开通', '部署',
    '划分', '划入', '划到', '加入', '绑定', '下发', '关闭', '开启', '启用', '禁用',
    '删除', '清空', '上线'],
  /* 只收「用户想做的动作」。不通 / 掉线 / 失败 / 丢包这些是**症状**，
     它们的作用是降权（SYMPTOM 已在做），不是降低命中门槛——
     让症状词参与降门槛，「数据库老掉线」会把「数据库高可用」顶上来。 */
  fix: ['排查', '排障', '解决', '修复', '怎么办', '怎么处理', '报错', '故障'],
  /* 对比 / 区别 多半是主题的一部分（「怎么对比两份配置」），不当选型意图 */
  select: ['怎么选', '选型', '怎么买', '推荐', '哪个好']
};

/* 强意图词：纯泛化动作，几乎不带主题信息，命中它只能算「想做什么」。
   只有这类词允许把「必须命中」的门槛降一格——搜「bfd配置」时「BFD 快速检测」
   才不会因为名字里没写「配置」被整条踢出结果。
   像「上线」「划分」「绑定」既是动作又是主题（AP 上线、VLAN 划分），
   降门槛会把几百条只沾一个「ap」的条目全放进来，所以它们只给加分、不降门槛。 */
const STRONG_INTENT = ['查看', '查询', '查', '看', '显示', '列出', '列一下',
  '配置', '设置', '配', '改', '修改',
  '划分', '划入', '划到', '加入',
  '排查', '排障', '解决', '修复', '怎么办', '怎么处理',
  '怎么选', '选型', '怎么买', '推荐', '哪个好'];

function isStrongIntent(w) {
  return STRONG_INTENT.indexOf(w) >= 0;
}

/* 「排查」「检查」里的「查」不是查看意图，算之前先摘掉，否则故障类查询会被判成查看类 */
const CHECK_WORDS = /排查|检查|审查|调查|巡查|盘查/g;

/**
 * 意图词命中判断。
 * 双字以上直接子串匹配；单字（配 / 查 / 看 / 改）只认词首——
 * 否则「分配」里的「配」会让「查看 DHCP 地址池分配情况」也被算成配置意图，
 * 白白加上配置分，把真正的「配置 DHCP 服务」挤下去。
 */
function hitIntent(hay, w) {
  if (w.length > 1) return hay.indexOf(w) >= 0;
  let i = hay.indexOf(w);
  while (i >= 0) {
    const prev = i > 0 ? hay.charCodeAt(i - 1) : 0;
    const isHan = prev >= 0x4e00 && prev <= 0x9fff;
    if (!isHan) return true;         /* 前面不是汉字 → 是词首 */
    i = hay.indexOf(w, i + 1);
  }
  return false;
}

/* 这个词本身是不是纯意图词（配置 / 查看 / 排查…），没有任何主题信息 */
function isIntentWord(w) {
  for (const k in INTENT) {
    if (INTENT[k].indexOf(w) >= 0) return true;
  }
  return false;
}

function intentsOf(text) {
  const s = String(text || '').toLowerCase();
  const noCheck = s.replace(CHECK_WORDS, '');
  const out = [];
  for (const k in INTENT) {
    const arr = INTENT[k];
    for (let i = 0; i < arr.length; i++) {
      /* 查看类用摘掉「排查」后的文本判断，其余用原文 */
      const hay = k === 'view' ? noCheck : s;
      if (hitIntent(hay, arr[i])) { out.push(k); break; }
    }
  }
  return out;
}

/**
 * 名称里的厂商写死词。用户没提厂商时，名称带厂商的条目要压下去——
 * 搜「划分vlan」，第一条不该是「中兴 VLAN 与端口划分」；
 * 搜「交换机怎么选」，第一条不该是「华三 MDC 多租户」。
 * 库里只有 18 条名称带厂商词，影响面小、命中就是硬伤，所以直接扣分。
 */
const VENDOR_NAME = ['华为', '思科', '华三', 'h3c', '锐捷', '中兴', 'juniper', 'junos',
  'aruba', 'cisco', 'huawei', 'ruijie', 'zte', '飞塔', 'fortinet', '深信服', '山石', '奇安信'];

/* 命中意图计分时的加成 / 名称带多余厂商词时的扣分 */
const INTENT_BONUS = 8;
const VENDOR_PENALTY = 10;
/* 意图词本身（display / 配置 / 查看）太泛，命中它只能算弱证据。
   不打折的话，搜「display health」时「display 常用查询速查表」光靠 display
   就能拿到和「设备健康检查」同等的名称分，反而把后者挤下去。 */
const INTENT_DAMP = 0.4;
/* 短语命中：别名和查询**整句相等**时，说明这条就是为这个说法准备的。
   「ap怎么上线」这种口语，名称里只会分散出现「AP」「上线」两个词，
   按词面分和「查看 AP 上线状态」完全打平，靠条目顺序决胜负——
   而「AP 上线全流程」的别名里早就写着「ap怎么上线」。
   必须是整句相等，不能用子串包含：搜「视频会议卡」时
   「案例：上了防火墙之后，视频会议/SIP 通话不通」的别名里也含这几个字，
   包含式匹配会把它顶到「视频会议卡顿排查」前面。
   门槛设 4 个字：太短的串（「配置」）到处都是，不构成「同一个说法」。
   注：以前这里还有一条 NAME_COVER_BONUS（标题命中的词数 ×4），但 cover
   从未累加过，一直没生效；试过把它接上，53 条排序用例一条没多对，
   反而把「隧道监控怎么组网」从第 3 挤到第 5——标题覆盖已经被
   NAME_PHRASE_BONUS 覆盖得更好，所以整段删掉。 */
const PHRASE_MIN = 4;
/* 名字里就是这句话本身（「ospf邻居起不来」→「OSPF 邻居起不来排查」）最强，
   比别名相等更可信：标题是人工写的主题，别名常常是把一堆说法挂在一条下面。 */
const NAME_PHRASE_BONUS = 16;
const PHRASE_BONUS = 12;
/* 别名里有没有和查询整句相等的（两边都已去掉空格、转小写） */
function hasPhrase(list, nq) {
  for (let i = 0; i < list.length; i++) { if (list[i] === nq) return true; }
  return false;
}
/* 标题里的「限定词」：协议名或特殊场景。用户没提这些限定词时，
   带限定词的条目应该排在主条目后面——
   搜「默认路由怎么写」不该先给「BGP 下发默认路由」，
   搜「查看配置」不该先给「查看下次启动用的配置」。 */
const LIMIT_WORDS = ['bgp', 'ospf', 'isis', 'rip', 'eigrp', 'mpls', 'vxlan', 'evpn',
  'pim', 'igmp', 'ipv6', '下次启动', '策略路由'];
const LIMIT_PENALTY = 6;
/* 标题前缀加成：查询的第一个主题词如果就是条目标题的开头，说明主题完全对上。
   搜「console密码」时「console 口密码」和「BootROM 急救（console 密码忘了）」
   词面分完全打平，靠这条才能让前者胜出。分值必须小于 INTENT_BONUS，
   否则会盖过意图判断（「查arp」会变成「ARP 防欺骗」压过「查看 ARP 表」）。 */


/**
 * 同分时的最后一道裁决：标题里出现了查询的多少个不同汉字。
 * 只用来打破平分，不参与打分，所以不会把无关条目顶上来。
 * 「交换机密码忘了」时「BootROM 急救（控制台进不去 / 系统起不来）」和
 * 「设备密码恢复（忘记密码怎么救回来）」都是 30 分（两边都只靠别名命中「密码忘了」），
 * 排序完全靠入库顺序；比一下标题就能看出来后者才是对的。
 */
function charCover(name, q) {
  let c = 0;
  const seen = {};
  for (let i = 0; i < q.length; i++) {
    const ch = q.charAt(i);
    if (!/[\u4e00-\u9fa5]/.test(ch) || seen[ch]) continue;
    seen[ch] = 1;
    if (name.indexOf(ch) >= 0) c++;
  }
  /* 只对上一个是噪音：「配acl」两个条目标题都带个「配」，
     真要拼这个的话「ACL 配了不生效」会压过「ACL 配置」。
     至少两个字对上，才说明标题和这句话真是一个主题。 */
  return c >= 2 ? c : 0;
}

/**
 * 稀有度权重：命中面越小的词越重要，权重 1~6。

/**
 * 稀有度权重：命中面越小的词越重要，权重 1~6。
 * 两条修正：症状词一律压到 1；纯英文/数字词（vlan、ospf、m-lag）给到至少 2，
 * 因为用户敲英文缩写时，那个词一定是他真正要找的东西。
 */
/**
 * 命中面统计：某个词组能命中多少条记录。
 *
 * rarity（算稀有度权重）和 dropGreedy（判泛词）要的是同一个量，
 * 之前两处各扫一遍「全部记录 × 全部词组 × body 正文」，
 * 白做一遍 —— body 全部加起来 53 万字符，中文词走 indexOf 是线性扫。
 * 这里算一次两边共用，结果按 key 记忆，跨搜索还能复用。
 */
let HCACHE = null;
function hitCounts(all, dev, groups) {
  const gkey = groups.map(function (g) { return g.join('\u0001'); }).join('\u0001');
  const key = IDX_VER + '|' + (dev || '全部') + '|' + gkey;
  if (HCACHE && HCACHE.key === key) return HCACHE.map;

  const pool = [];
  for (let i = 0; i < all.length; i++) {
    if (dev && dev !== '全部' && all[i].it.devs.indexOf(dev) < 0) continue;
    pool.push(all[i]);
  }
  const map = {};
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];
    let c = 0;
    for (let i = 0; i < pool.length; i++) {
      const rec = pool[i];
      for (let j = 0; j < grp.length; j++) {
        const w = grp[j];
        if (hasWord(rec.name, w) || hasWord(rec.kws, w) || hasWord(rec.body, w)) { c++; break; }
      }
    }
    map[grp.join('\u0001')] = c;
  }
  HCACHE = { key: key, map: map };
  return map;
}

function rarity(all, dev, groups) {
  if (groups.length < 2) return null;
  const pool = [];
  for (let i = 0; i < all.length; i++) {
    if (dev && dev !== '全部' && all[i].it.devs.indexOf(dev) < 0) continue;
    pool.push(all[i]);
  }
  if (!pool.length) return null;

  const hmap = hitCounts(all, dev, groups);
  return groups.map(function (g) {
    const t = g[0];
    if (SYMPTOM.indexOf(t) >= 0) return 1;

    const c = hmap[g.join('\u0001')];
    let w0 = Math.max(1, Math.min(6, Math.round(60 / (2 + c))));
    if (/^[a-z0-9-]+$/.test(t) && w0 < 2) w0 = 2;
    return w0;
  });
}

/**
 * 打分：标题命中 > 别名命中 > 正文命中，这样搜 ospf 时「OSPF 基础配置」排第一，
 * 不会让只是命令里顺带出现 ospf 的条目排在前面。
 *
 * wt 是每个词的稀有度权重：像「配置」这种库里有几十条都沾边的词权重低，
 * 「m-lag」这种只有一两条的权重高。没有这层，
 * 搜「m-lag配置」会出现「进入配置视图」和 M-LAG 条目同分、靠条目顺序决定谁第一。
 */
function scoreOf(rec, groups, wt, ctx) {
  const name = rec.name;
  const kws = rec.kws;
  const body = rec.body;
  let hit = 0;
  let score = 0;
  let raw = 0;   /* 原词（没被削过）命中的词数，只用来打破平分 */
  let maxBest = 0; /* 命中强度最高的那一档：10 标题 / 5 别名 / 1 正文 */
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const w0 = wt ? wt[i] : 1;
    let best = 0;
    let inName = false;
    for (let j = 0; j < g.length; j++) {
      const w = g[j];
      let s = 0;
      if (hasWord(name, w)) { s += 10; inName = true; }
      if (hasWord(kws, w)) s += 5;
      if (!s && hasWord(body, w)) s += 1;
      if (s > 0 && j === 0) raw++;
      if (s > best) best = s;
      if (best >= 15) break;
    }
    const isIntent = !!(ctx && ctx.imask && ctx.imask[i]);
    /* 意图组只贡献弱分，且不计入 hit —— hit 是「够不够格进结果」的门槛 */
    if (best > maxBest) maxBest = best;
    if (best > 0 && !isIntent) hit++;
    score += (isIntent ? Math.round(best * INTENT_DAMP) : best) * w0;
  }

  /* 词面分算完，再按「意图对不对得上」加减分。
     只对已经命中词的条目生效——否则一条完全无关的记录也会被意图分抬进结果。
     这一层解决的是同分问题：搜「配telnet」时名字带 telnet 的条目全是 10 分，
     旧逻辑靠入库顺序决定第一，现在由「配」这个动作决定。 */
  if (hit > 0 && ctx && maxBest >= 5) {
    /* 整句原话对上：标题里直接就有这句话 > 只是挂在别名里 */
    if (ctx.nq && ctx.nq.length >= PHRASE_MIN) {
      if (rec.ns.indexOf(ctx.nq) >= 0) score += NAME_PHRASE_BONUS;
      else if (hasPhrase(rec.klist, ctx.nq)) score += PHRASE_BONUS;
    }
    if (ctx.qi && ctx.qi.length) {
      /* 用建索引时预算好的意图，不要每次搜索重算 ——
         intentsOf 要跑一遍 INTENT 的全部意图词，对 1216 条重算是纯浪费。 */
      const ni = rec.intents || [];
      for (let i = 0; i < ni.length; i++) {
        if (ctx.qi.indexOf(ni[i]) >= 0) { score += INTENT_BONUS; break; }
      }
    }
    if (ctx.q) {
      const lower = name.toLowerCase();
      for (let i = 0; i < VENDOR_NAME.length; i++) {
        const v = VENDOR_NAME[i];
        if (lower.indexOf(v) >= 0 && ctx.q.indexOf(v) < 0) { score -= VENDOR_PENALTY; break; }
      }
      for (let i = 0; i < LIMIT_WORDS.length; i++) {
        const v = LIMIT_WORDS[i];
        if (lower.indexOf(v) >= 0 && ctx.q.indexOf(v) < 0) { score -= LIMIT_PENALTY; break; }
      }
    }
  }

  return { hit: hit, score: score, raw: raw };
}

/**
 * 把命令块洗成「能直接粘进设备」的纯命令。
 * 网络设备 CLI（华为/思科/H3C/锐捷）和 Windows CMD 都不认 # 注释，
 * 中文说明、全角括号备注粘进去就是报错，复制前统一清掉。
 * Linux shell 的 # 是合法注释，保留原样。
 */
const IS_NET = { '华为': 1, '思科': 1, 'H3C': 1, '锐捷': 1 };

/* 厂商名可能带角色后缀（「思科（Hub）」「思科（KS 密钥服务器）」），
   判断是不是网络设备时按前缀匹配，否则 cleanCmd 认不出来，
   Hub/Spoke 两段的中文说明行就清不掉，复制时带脏数据 */
function isNetVendor(v) {
  const s = String(v || '');
  return Object.keys(IS_NET).some(function (k) { return s === k || s.indexOf(k) === 0; });
}

function cleanCmd(code, vendor) {
  const isNet = isNetVendor(vendor);
  const isCmd = vendor === 'CMD';
  const lines = String(code || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i];
    if (!ln.trim()) continue;
    /* 整行没有半个英数字 → 是中文说明，不是命令 */
    if (!/[a-zA-Z0-9]/.test(ln)) continue;
    if (isNet || isCmd) {
      /* 整行被括号包住的中文备注，如「（提示 Y/N 时输入 y）」 */
      if (/^\s*[（(][\s\S]*[）)]\s*$/.test(ln) && /[\u4e00-\u9fa5]/.test(ln)) continue;
      /* 「或 copy running-config startup-config」这种中文引导词 */
      ln = ln.replace(/^[\u4e00-\u9fa5、，。\s]+(?=[a-zA-Z])/, '');
      /* 行内 # 中文注释：只在不含中文时才是真命令的一部分 */
      const h = ln.indexOf('#');
      if (h >= 0 && /[\u4e00-\u9fa5]/.test(ln.slice(h))) ln = ln.slice(0, h);
      /* 华为 / H3C 的 ! 不是注释符，粘进去会报错。
         厂商名常带后缀（「华为 VRP8」「华为 USG VRP」），按前缀匹配 */
      if (isNet && /^\s*!/.test(ln) && (vendor.indexOf('华为') === 0 || vendor.indexOf('H3C') === 0)) continue;
      /* 命令尾部的中文说明 */
      ln = ln.replace(/\s{2,}[^\x00-\x7F][\s\S]*$/, '');
    }
    if (!/[a-zA-Z0-9]/.test(ln)) continue;
    ln = ln.replace(/\s+$/, '');
    if (ln.trim()) out.push(ln);
  }
  /* 整块都是中文操作说明（比如「长按 RESET 孔 5 秒」）时原样返回，
     别清成空字符串——那类条目本来就不是命令，复制了也要能看 */
  if (!out.length) return String(code || '').trim();
  return out.join('\n');
}

/**
 * 泛词剔除，两步：
 * ① 单字中文词（「配」「口」「个」）基本都是「怎么配 / hybrid口」切剩下的残渣，
 *    只要还有别的词就一律不要——它会让一条「配置视图」和真正相关的条目打成平手。
 * ② 命中面超过 35% 的词没有区分度，也丢掉。
 * 全丢光了就留命中面最小的那个，别把查询弄成空。
 */
function dropGreedy(all, dev, groups) {
  if (groups.length < 2) return groups;

  let gs = groups.filter(function (g) {
    return !g.every(function (w) { return w.length === 1 && /[\u4e00-\u9fa5]/.test(w); });
  });
  if (!gs.length) gs = groups;
  if (gs.length < 2) return gs;

  const pool = [];
  for (let i = 0; i < all.length; i++) {
    if (dev && dev !== '全部' && all[i].it.devs.indexOf(dev) < 0) continue;
    pool.push(all[i]);
  }
  if (!pool.length) return gs;

  /* 命中面统计与 rarity 共用（hitCounts 内部按 key 记忆，
     两次调用词组一致时第二次直接命中缓存）。 */
  const hmap = hitCounts(all, dev, gs);
  const cnt = gs.map(function (g) {
    return hmap[g.join('\u0001')];
  });

  const limit = pool.length * 0.35;
  const keep = [];
  for (let i = 0; i < gs.length; i++) {
    /* 纯英文 / 数字词不参与剔除。用户敲 ip、vlan、ospf 这种缩写时，
       那个词一定是他真正要找的东西；把它当「太常见的泛词」剔掉，
       「配置管理ip」就只剩一个「管理」，搜出来全是「CMDB 与配置项管理」。 */
    const pure = /^[a-z0-9-]+$/.test(gs[i][0]);
    if (cnt[i] <= limit || pure) keep.push(gs[i]);
  }
  if (keep.length) return keep;

  let best = 0;
  for (let i = 1; i < cnt.length; i++) if (cnt[i] < cnt[best]) best = i;
  return [gs[best]];
}

/**
 * 搜索命令百科
 * @param {string} kw  关键词，空格分隔多个词
 * @param {string} dev 设备大类，'全部' 表示不限
 */
/* 内部实现：算出「排序后的候选序列」。对外 search() 按
   (数据版本, 关键词, 设备大类) 缓存这份序列，命中时只做展示对象映射。 */
function computeSearch(kw, dev) {
  const all = buildIndex();
  const qtext = String(kw || '').toLowerCase();
  const ctx = { qi: intentsOf(kw), q: qtext, nq: qtext.replace(/\s+/g, '') };

  /* 纯意图词（配置 / 查看 / 排查）标记出来：仍参与打分，但**不计入「必须命中」的门槛**。
     以前它们混在检索词里，搜「bfd配置」时「BFD 快速检测」因为名字里没写「配置」
     被整条踢出结果——那十几条「配置ntp」式的复合别名就是在绕这个坑。
     注意不能直接把意图组删掉：删了之后只含主题词的无关条目会大量涌进结果，
     「wifi老是掉线」这类查询反而变差。 */
  const words = dropGreedy(all, dev, expand(norm(kw)));
  const imask = words.map(function (g) {
    return g.every(function (w) { return isStrongIntent(w); });
  });
  let topic = 0, intentCnt = 0;
  for (let i = 0; i < imask.length; i++) {
    if (imask[i]) intentCnt++; else topic++;
  }
  /* 全是意图词（「查看配置」拆完两个都是动作词）时不能再当意图处理，
     否则 hit 永远是 0、门槛永远达不到，直接搜出 0 条。退回普通词处理。 */
  if (topic === 0) {
    for (let i = 0; i < imask.length; i++) imask[i] = false;
    topic = words.length;
    intentCnt = 0;
  }
  ctx.imask = imask;
  /* 只允许降一格：「加域失败怎么查」这种三个意图词同时出现时，门槛不能塌到只剩一个词，
     否则噪音全涌进来。全都不是意图词时等价于原规则。 */
  ctx.need = (intentCnt === 1 && topic > 0) ? topic : words.length;

  const wt = rarity(all, dev, words);
  const cand = [];
  const nq = ctx.nq || '';
  for (let i = 0; i < all.length; i++) {
    const rec = all[i];
    if (dev && dev !== '全部' && rec.it.devs.indexOf(dev) < 0) continue;
    const sc = words.length ? scoreOf(rec, words, wt, ctx) : { hit: 0, score: 0, raw: 0 };
    /* cc 先留空：它只在「词没凑齐」的退化路径里用，
       正常路径（全词命中）排序本来就不看它 ——
       之前对全部 1216 条都算了一遍，结果一个都没用到。 */
    cand.push({ it: rec.it, hit: sc.hit, score: sc.score, raw: sc.raw, cc: 0 });
  }

  /* cc（标题覆盖了几个查询字）只在「词没凑齐」的退化路径里用。
     全词命中时排序本来就准，再拼这个反而把「无线信号弱」推到
     「终端无线连接排查」——只对上「无线」两个字，却比「射频信道与功率」更像。 */
  const byScore = (a, b) => (b.score - a.score) || (b.raw - a.raw);
  const byHit = (a, b) => (b.hit - a.hit) || (b.score - a.score) || (b.raw - a.raw) || (b.cc - a.cc);
  let list = cand;
  if (words.length) {
    const full = cand.filter(c => c.hit === words.length).sort(byScore);
    if (full.length) {
      list = full;
    } else {
      /* 退化路径才需要标题覆盖度，且只算活下来的候选（远少于全量）。 */
      const partial = cand.filter(c => c.hit > 0);
      for (let i = 0; i < partial.length; i++) {
        partial[i].cc = nq ? charCover(partial[i].it.name, nq) : 0;
      }
      list = partial.sort(byHit);
    }
  }

  return list;
}

/* 搜索结果缓存：
   同一个查询在一次会话里常被反复调用（搜索页防抖前后、切 tab 回显、
   admin/contribute 反查），以前每次都对 1216 条重新打分、重算 rarity。
   key 带上 dataVer()，热更新 / 换数据集 / 练习题加载完都会自动失效。
   缓存的是内部 cand（只含索引记录引用），对外**每次重新 map 出全新对象**，
   页面改写返回值不会污染缓存，也不会跨页串数据。
   FIFO 限 24 条，长会话里内存不会一直涨。 */
const SEARCH_CACHE_LIMIT = 24;
const SEARCH_CACHE = Object.create(null);
const SEARCH_KEYS = [];

function search(kw, dev) {
  const key = dataVer() + '\u0002' + String(kw == null ? '' : kw)
              + '\u0002' + String(dev == null ? '' : dev);
  let list = SEARCH_CACHE[key];
  if (!list) {
    list = computeSearch(kw, dev);
    SEARCH_CACHE[key] = list;
    SEARCH_KEYS.push(key);
    if (SEARCH_KEYS.length > SEARCH_CACHE_LIMIT) {
      delete SEARCH_CACHE[SEARCH_KEYS.shift()];
    }
  }
  return list.map(c => {
    const it = c.it;
    return {
      id: it.id,
      name: it.name,
      tip: it.tip,
      devs: it.devs,
      vendorText: it.cmds.map(x => x[0]).join(' '),
      cmds: it.cmds.map(x => ({ vendor: x[0], code: x[1] }))
    };
  });
}

/**
 * 模板搜索：64 个配置模板并入统一搜索。
 *
 * 模板没有 kw 字段，匹配文本分三层，权重递减：
 *   name  —— 模板标题，用户就是按这个找的，权重最高
 *   cat   —— 分类（开局模板 / 安全模板…），次之
 *   note  —— 排障说明，术语密度极高但匹配价值低。
 *           「IPsec VPN 站点互联模板」的 note 里写着「中间NAT」，
 *           搜 nat 时它会命中——但用户想找的是 NAT 模板，不是 IPsec。
 *           所以 note 命中只给很低的分。
 * **code（命令正文）完全不参与匹配**——正文里几乎每条都有 vlan / interface，
 * 拿它匹配会让 64 个模板在「vlan」「接口」这类词下全部命中，失去筛选意义。
 *
 * 分词复用 norm/expand，跟百科走同一套口径，
 * 否则会出现「百科搜得到、模板搜不到」的割裂。
 *
 * 匹配规则（按强度）：
 *   1. 整句出现在 name 里 → 强匹配（这条就是为这个说法准备的）
 *   2. 每个词组都要命中 → 中等匹配，按命中层级加权
 *   3. 只命中一部分 → 弱匹配，只在没有更强结果时补位
 */
let TPL_INDEX = null;
let TPL_VER = -1;
function tplIndex() {
  if (TPL_INDEX && TPL_VER === dataVer()) return TPL_INDEX;
  let list = [];
  try {
    /* tplbook 在主包，分包可引用主包公共资源。
       本文件在 subpkg-tool/utils/ 下，往上两级是 miniprogram/，
       所以是 ../../utils/（分包页面在 subpkg-tool/pages/xxx/ 下，
       才需要往三级——两者别搞混）。 */
    list = require('./tplbook.js').TPLS || [];
  } catch (e) {
    list = [];
  }
  const base = list.map(function (t) {
    const p = hotfix.applyPatch(t, 'tpl');
    return indexTpl(p);
  });

  /* 合并云端「已批准新增模板」。本地已有同名 id 时本地优先。 */
  const extras = hotfix.getAllExtras('tpl');
  const seen = {};
  list.forEach(function (t) { seen[t.id] = 1; });
  extras.forEach(function (it) {
    if (!it || !it.id || seen[it.id]) return;
    /* approvedAt 是云端元数据（给增量游标用），不进条目本体 */
    const clean = {};
    Object.keys(it).forEach(function (k) {
      if (k !== 'approvedAt') clean[k] = it[k];
    });
    base.push(indexTpl(clean));
  });

  TPL_INDEX = base;
  TPL_VER = dataVer();
  return TPL_INDEX;
}

/* 单条模板 → 索引结构（本地条目与云端新增条目共用）。 */
function indexTpl(p) {
  const name = String(p.name || '').toLowerCase();
  const cat = String(p.cat || '').toLowerCase();
  const note = String(p.note || '').toLowerCase();
  const kw = (p.kw || []).map(function (x) { return String(x).toLowerCase(); });
  return {
    it: p,
    name: name,
    kw: kw,
    /* 四层匹配文本，命中时按层级给不同权重：
       kw（用户明确搜的说法）> name > cat > note */
    l0: kw.join('\n'),
    l1: name,
    l2: name + '\n' + cat,
    l3: name + '\n' + cat + '\n' + note
  };
}

/** 一个词组在四层文本里的命中强度：4=kw 3=名称 2=分类 1=说明 0=没中 */
function tplHitLevel(rec, group) {
  let lv = 0;
  for (let j = 0; j < group.length; j++) {
    const w = group[j];
    if (rec.l0.indexOf(w) >= 0) { lv = Math.max(lv, 4); }
    else if (tplKwContains(rec, w)) { lv = Math.max(lv, 4); }
    else if (rec.l1.indexOf(w) >= 0) { lv = Math.max(lv, 3); }
    else if (rec.l2.indexOf(w) >= 0) { lv = Math.max(lv, 2); }
    else if (rec.l3.indexOf(w) >= 0) { lv = Math.max(lv, 1); }
  }
  return lv;
}

/**
 * 查这个说法在模板的关键词里有没有「互相包含」的关系。
 *
 * 场景：查「默认路由配置」，切词后是一个 6 字整词，
 * 而模板的关键词写的是「默认路由」——谁也不包含谁，就都匹配不上。
 * 但用户的意思显然就是那个模板。
 *
 * 只在 kw 层做这个判断：kw 是人工写的说法，噪音极低。
 * 不能推广到 name / note 层——note 是排障说明，
 * 「IPsec VPN」的 note 里写着「中间NAT」，
 * 放开包含就会让搜 nat 把它顶到 NAT 模板前面。
 */
function tplKwContains(rec, w) {
  if (w.length < 2) return false;
  for (let i = 0; i < rec.kw.length; i++) {
    const k = rec.kw[i];
    if (k.length < 2) continue;
    /* 查询词包含关键词：「默认路由配置」包含「默认路由」 */
    if (w.indexOf(k) >= 0) return true;
    /* 关键词包含查询词：「默认路由」包含「默认路由」 */
    if (k.indexOf(w) >= 0) return true;
  }
  return false;
}

/**
 * @param {string} kw 查询词
 * @param {number} limit 最多返回几条
 * @returns {Array} 命中的模板，按匹配强度排序
 */
function searchTemplates(kw, limit) {
  const idx = tplIndex();
  if (!idx.length) return [];
  const qtext = String(kw || '').trim().toLowerCase();
  if (!qtext) return [];
  const nq = qtext.replace(/\s+/g, '');
  const words = expand(norm(qtext));

  const strong = [];
  const mid = [];
  const weak = [];
  for (let i = 0; i < idx.length; i++) {
    const rec = idx[i];
    let score = 0;
    /* 整句相等或整句出现在名字里 */
    if (rec.name === nq || (nq.length >= 4 && rec.name.indexOf(nq) >= 0)) {
      score = 1000;
    } else {
      /* 查询整句就是某个 kw —— 这是模板作者亲手写的说法，最强信号 */
      let kwHit = false;
      for (let k = 0; k < rec.kw.length; k++) {
        const kk = rec.kw[k];
        if (kk === nq) { kwHit = true; break; }
        /* 互相包含也算：查「默认路由配置」该命中关键词「默认路由」 */
        if (nq.length >= 3 && kk.length >= 3 &&
            (kk.indexOf(nq) >= 0 || nq.indexOf(kk) >= 0)) {
          kwHit = true;
          break;
        }
      }
      if (kwHit) {
        score = 900;
      } else {
        /* 逐词组匹配：每个词取它命中的最强层级 */
        let hitAll = true;
        let sum = 0;
        let minLv = 4;
        for (let w = 0; w < words.length; w++) {
          const lv = tplHitLevel(rec, words[w]);
          if (!lv) { hitAll = false; continue; }
          sum += lv;
          if (lv < minLv) minLv = lv;
        }
        if (hitAll && words.length) {
          /* 全词命中：层级越高分越高。kw 全中(4) 明显强于只在 note 里命中(1) */
          score = 100 + sum * 10 + minLv * 5;
        } else if (sum > 0) {
          score = 10 + sum * 2;
        }
      }
    }
    if (!score) continue;
    const item = { tpl: rec.it, score: score };
    if (score >= 1000) strong.push(item);
    else if (score >= 100) mid.push(item);
    else weak.push(item);
  }

  let out = strong.concat(mid, weak);
  /* 弱匹配排在最后：只在有强/中匹配时丢弃 */
  if (strong.length || mid.length) out = strong.concat(mid);
  out.sort(function (a, b) { return b.score - a.score; });
  const max = limit || out.length;
  return out.slice(0, max).map(function (x) {
    const t = x.tpl;
    return {
      id: t.id,
      name: t.name,
      cat: t.cat,
      vendor: t.vendor,
      note: t.note,
      code: t.code,
      score: x.score
    };
  });
}

/**
 * 列出条目（不做搜索打分），用于分类浏览。
 *
 * 与 search 的区别：search 是「按相关度排」，
 * 这里必须保持**稳定顺序**——同一批条目每次进来顺序一样，
 * 用户翻页时不会发现列表在跳。
 *
 * @param {object} opts
 *   cat   分类 key（分类体系里的 key），不限则全部
 *   dev   设备筛选值，不限则全部
 *   limit 最多返回几条
 *   offset 跳过前几条（分页）
 * @returns {Array} 条目概要
 */
function listBy(opts) {
  const o = opts || {};
  const all = buildIndex();
  const cats = require('./categories.js');
  const rows = [];

  for (let i = 0; i < all.length; i++) {
    const rec = all[i];
    const it = rec.it;
    if (o.dev && o.dev !== '全部' && it.devs.indexOf(o.dev) < 0) continue;
    if (o.cat) {
      const rec = all[i];
      if (!rec.cat) rec.cat = cats.classifyItem(it).key;
      if (rec.cat !== o.cat) continue;
    }
    rows.push({
      id: it.id,
      name: it.name,
      tip: it.tip,
      devs: it.devs,
      vendorText: it.cmds.map(function (x) { return x[0]; }).join(' '),
      cmds: it.cmds.map(function (x) { return { vendor: x[0], code: x[1] }; })
    });
  }

  const offset = o.offset || 0;
  const limit = o.limit || rows.length;
  return rows.slice(offset, offset + limit);
}

/**
 * 分类目录：每个分类有多少条，用于浏览页的分类栏。
 * @returns {Array} [{key, name, desc, count}]
 */
function categoryStats() {
  const all = buildIndex();
  const cats = require('./categories.js');
  const counts = {};
  cats.CATEGORIES.forEach(function (c) { counts[c.key] = 0; });
  for (let i = 0; i < all.length; i++) {
    const rec = all[i];
    /* 分类结果缓存在索引记录上：classifyItem 每条要遍历 10 分类 × 615 关键词，
       全量 1216 条 = 74.8 万次 indexOf。这里和 listBy({cat}) 各跑一遍，
       缓存后第二次几乎零成本。索引重建时记录一并替换，缓存自动失效。 */
    if (!rec.cat) rec.cat = cats.classifyItem(rec.it).key;
    const k = rec.cat;
    if (counts[k] === undefined) counts[k] = 0;
    counts[k]++;
  }
  return cats.CATEGORIES.map(function (c) {
    return { key: c.key, name: c.name, desc: c.desc, count: counts[c.key] || 0 };
  });
}

/**
 * 列出模板（不做搜索打分），用于分类浏览。
 *
 * 走 tplIndex() 而不是直接读 utils/tplbook.js 的原始数组：
 * 索引里已经叠了云端热更新覆盖（hotfix.applyPatch）和
 * 「作者审核通过的新增模板」（extras）。直接读原始数组会漏掉
 * 这两部分，模板页就看不到云端发布的内容。
 *
 * 与 listBy 的差别：模板没有 devs（设备）字段，
 * 也没有分类体系 key，用 cat 字符串直接分组。
 *
 * @param {object} opts
 *   cat   模板分类（如 '开局模板'），不限则全部
 *   limit 最多返回几条
 *   offset 跳过前几条（分页）
 * @returns {Array} 模板概要
 */
function listTpls(opts) {
  const o = opts || {};
  const idx = tplIndex();
  const rows = [];

  for (let i = 0; i < idx.length; i++) {
    const it = idx[i].it;
    if (o.cat && it.cat !== o.cat) continue;
    rows.push({
      id: it.id,
      name: it.name,
      tip: it.note,
      cat: it.cat,
      vendor: it.vendor,
      kw: it.kw || [],
      cmds: [{ vendor: it.vendor, code: it.code }]
    });
  }

  const offset = o.offset || 0;
  const limit = o.limit || rows.length;
  return rows.slice(offset, offset + limit);
}

/**
 * 模板分类目录：每个分类有多少条。
 * 分类顺序按模板在库中首次出现的先后，保持稳定。
 * @returns {Array} [{key, name, desc, count}]
 */
function tplCategoryStats() {
  const idx = tplIndex();
  const order = [];
  const counts = {};
  for (let i = 0; i < idx.length; i++) {
    const c = idx[i].it.cat || '其它';
    if (counts[c] === undefined) {
      counts[c] = 0;
      order.push(c);
    }
    counts[c]++;
  }
  return order.map(function (c) {
    return { key: c, name: c, desc: '', count: counts[c] };
  });
}

/**
 * 按 id 取一条百科条目（收藏页用）。
 * @returns {object|null}
 */
function findById(id) {
  const all = buildIndex();
  for (let i = 0; i < all.length; i++) {
    if (all[i].it.id === id) return all[i].it;
  }
  return null;
}

/**
 * 按 id 取一个模板（收藏页用）。
 * @returns {object|null}
 */
function findTplById(id) {
  const idx = tplIndex();
  for (let i = 0; i < idx.length; i++) {
    if (idx[i].it.id === id) return idx[i].it;
  }
  return null;
}

/**
 * 生成分享卡片的内容。
 *
 * 分享路径带 kind + id，别人点进来能直接落到那一条：
 *   /subpkg-tool/pages/search/search?kind=book&id=vlan-basic
 *
 * @param {object} item {kind, id, title, sub, blocks}
 * @returns {object} {title, path, content}
 */
function shareCard(item) {
  const kind = item.kind || 'book';
  const id = item.id || '';
  const name = item.title || 'Net 操作命令速记';

  /* 路径统一走搜索页：它是唯一的入口，而且已经能按 id 直接打开详情。
     模板和百科都能落到那儿。 */
  const path = '/subpkg-tool/pages/search/search?kind=' +
    encodeURIComponent(kind) + '&id=' + encodeURIComponent(id);

  /* 卡片正文：带上第一条命令，让人一眼知道分享的是什么 */
  let content = '';
  const blocks = item.blocks || [];
  if (blocks.length && blocks[0].code) {
    const first = String(blocks[0].code).split('\n')
      .map(x => x.trim())
      .filter(x => x && x[0] !== '!' && x[0] !== '#')
      .slice(0, 3)
      .join('\n');
    content = first;
  }
  if (!content) content = item.sub || '';

  return { title: name, path, content };
}

/**
 * 按 id 找条目（分享落地用）。
 * @returns {object|null} {kind, id, name, tip, devs, blocks:[{vendor,code}]}
 */
function lookupById(kind, id) {
  if (kind === 'tpl') {
    const t = findTplById(id);
    if (!t) return null;
    return {
      kind: 'tpl',
      id: t.id,
      name: t.name,
      tip: t.note,
      sub: t.cat + ' · ' + t.vendor,
      blocks: [{ vendor: t.vendor, code: t.code }]
    };
  }
  const it = findById(id);
  if (!it) return null;
  return {
    kind: 'book',
    id: it.id,
    name: it.name,
    tip: it.tip,
    sub: it.devs.join(' / '),
    blocks: it.cmds.map(c => ({ vendor: c[0], code: c[1] }))
  };
}

/**
 * Offline First 入口：用一份外部数据集（本地缓存 / 云端下载）替换当前内存 BOOK。
 * 搜索页、收藏页等所有消费方都 require 本模块（单例），数据集被替换后它们自动读到新数据，
 * 无需逐个改引用。
 *
 * 为什么用「替换 + 推进版本」而不是暴露 setter 让外面直接改：
 *   - buildIndex/buildVocab 都按 dataVer() 做缓存失效，这里 bump DATA_VER 后，
 *     下一次 search() 会自动重建索引，索引/词表不会停留在旧数据集上。
 *   - 练习题走 CloudBase 异步加载，可能在 setDataset 之后才就绪，
 *     所以这里把已加载的练习数据重新并回新 BOOK，避免替换时把练习弄丢。
 *   - 云端条目本身已是完整 book（含 bundled 全部内容）；hotfix 的覆盖/新增会在
 *     buildIndex 时按 targetId 重新叠加，因此替换不会丢失热更新内容。
 *
 * @param {Array} entries 与内置 BOOK 同 schema 的条目数组（id/devs/name/kw/cmds/tip…）
 * @returns {boolean} 是否真的替换了（入参非法时返回 false，保持原 BOOK 不变）
 */
/* 数据源重建 —— 把「外部注入的数据集」与「远程练习题库」统一成一次构建。
   改版前有三个地方各自 concat + DATA_VER++：
     · setDataset（离线层注入）
     · registerBookSetter → setDataset（每个 tool 页 onLoad 一次）
     · ensureReady → loadCacheIntoBook → setDataset（同一个 onLoad 又一次）
     · practice 异步加载完成
   结果每进一个页面触发 2~3 次索引 / 词表 / 模板索引全失效，
   每次都要对 1216 条重算 intentsOf 与分类缓存。
   现在按「输入引用」判等：同一份数据集只重建一次，
   只有云端换了库、练习题库真的到位时才推进 DATA_VER。 */
let _baseEntries = null;
let _practiceArr = practice.getPractice();
let _builtBase = BOOK_BUILTIN;
let _builtPractice = _practiceArr;

function rebuildBook() {
  const base = _baseEntries || BOOK_BUILTIN;
  const sameBase = base === _builtBase;
  /* 练习题库加载失败时会重新赋一个新的空数组引用，内容没变，
     不该因此白推进一次数据版本。 */
  const samePractice = _practiceArr === _builtPractice
                       || (_practiceArr.length === 0 && _builtPractice.length === 0);
  if (sameBase && samePractice) return false;
  _builtBase = base;
  _builtPractice = _practiceArr;
  BOOK = base.concat(_practiceArr);
  DATA_VER++;
  return true;
}

function setDataset(entries) {
  if (!Array.isArray(entries) || !entries.length) return false;
  if (_baseEntries === entries) return false;   // 幂等：同一份数据集不重复重建
  _baseEntries = entries;
  _practiceArr = (practice && practice.getPractice && practice.getPractice()) || [];
  return rebuildBook();
}

module.exports = { VENDORS,
  /* getter 而非快照：练习题异步加载完成后 BOOK 被重新赋值，
     快照引用会一直指着旧数组，读到 1216 条而不是最新数据。 */
  get BOOK() { return BOOK; },
  search, norm, expand, cleanCmd, searchTemplates,
  listBy, categoryStats, listTpls, tplCategoryStats,
  findById, findTplById, shareCard, lookupById,
  setDataset,
  /* 调试用：只在本地 node 脚本里调，页面不引用 */
  _dbg: { buildIndex, dropGreedy, rarity, scoreOf, intentsOf, segChinese, stripLead,
    isStrongIntent, tplIndex } };

/* 练习题库（原 cmdbook-practice.js，326KB）已移至 CloudBase 存储按需加载，
   避免 subpkg-tool 超过 2MB 分包上限导致微信 errcode 80200。
   页面只调用 search/lookupById 等函数，BOOK 重建后自动包含练习数据，无需改动页面。 */
practice.loadPractice()
  .then(() => {
    /* 练习题不走 hotfix，必须把它并进数据源并推进版本，
       否则索引/词表永不失效，练习题进了 BOOK 也搜不到。
       统一走 rebuildBook()，与 setDataset 共用同一份幂等判定。 */
    _practiceArr = practice.getPractice() || [];
    rebuildBook();
  })
  .catch(() => {});

