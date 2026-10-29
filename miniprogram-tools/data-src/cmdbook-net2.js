// utils/cmdbook-net2.js —— 命令百科扩充（第二批）：交换机进阶与运维

const NET2_EXTRA = [
  {
    id: 'vlan-desc',
    devs: ['Switch'],
    name: 'VLAN 描述与命名',
    kw: ['vlan描述', 'vlan命名', '写备注', 'vlan说明'],
    cmds: [
      ['华为', 'vlan 10\n description office-floor3\nquit'],
      ['思科', 'vlan 10\n name office-floor3\n exit'],
      ['H3C', 'vlan 10\n name office-floor3\nquit'],
      ['锐捷', 'vlan 10\n name office-floor3\n exit']
    ],
    tip: 'VLAN 名字最多 32 字符，别拿它当文档用。真正有用的信息（谁用、哪个楼层）写在这，比编号好认得多。'
  },
  {
    id: 'vlan-ports',
    devs: ['Switch'],
    name: '查某 VLAN 下有哪些端口',
    kw: ['vlan下的端口', '哪些口在这个vlan', 'vlan成员口'],
    cmds: [
      ['华为', 'display vlan 10'],
      ['思科', 'show vlan id 10'],
      ['H3C', 'display vlan 10'],
      ['锐捷', 'show vlan id 10']
    ],
    tip: '用户报「某个 VLAN 不通」，先确认这个 VLAN 到底有没有端口在里头——空的 VLAN 当然不通。'
  },
  {
    id: 'vlan-batch-del',
    devs: ['Switch'],
    name: '批量删除 VLAN',
    kw: ['批量删vlan', '删多个vlan', '清理vlan'],
    cmds: [
      ['华为', 'undo vlan batch 10 to 20'],
      ['思科', 'no vlan 10\nno vlan 11\nno vlan 12'],
      ['H3C', 'undo vlan 10 to 20'],
      ['锐捷', 'no vlan 10\nno vlan 11']
    ],
    tip: '删之前先 `display vlan` 看一眼这些 VLAN 上还挂着哪些端口，删完端口会失去归属。'
  },
  {
    id: 'gvrp',
    devs: ['Switch'],
    name: 'GVRP 动态 VLAN 注册',
    kw: ['gvrp', '动态vlan', 'vlan自动同步'],
    cmds: [
      ['华为', 'gvrp\ninterface GigabitEthernet 0/0/24\n gvrp\n gvrp registration normal'],
      ['思科', 'vtp mode server\ninterface GigabitEthernet 0/24\n switchport mode trunk'],
      ['H3C', 'gvrp\ninterface GigabitEthernet 1/0/24\n gvrp'],
      ['锐捷', 'gvrp enable\ninterface GigabitEthernet 0/24\n gvrp enable']
    ],
    tip: 'GVRP 能自动同步 VLAN，但链路一断就会撤掉动态 VLAN，容易引发莫名其妙的断网。生产环境慎用，思科那边更常用 VTP。'
  },
  {
    id: 'port-errdisable',
    devs: ['Switch'],
    name: '端口 err-disable 恢复',
    kw: ['err-disable', '端口变灰', '端口被关', '自动恢复', '端口down了'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n restart\n# 或全局自动恢复\nerrdisable-recovery interval 300'],
      ['思科', 'errdisable recovery cause bpduguard\nerrdisable recovery interval 300\n# 临时手工恢复\nshutdown → no shutdown'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n shutdown\n undo shutdown'],
      ['锐捷', 'errdisable recovery interval 300']
    ],
    tip: '端口突然不通、状态显示 err-disabled，多半是触发了 BPDU Guard 或端口安全。先查原因再恢复，否则恢复完还会再挂。'
  },
  {
    id: 'port-flap',
    devs: ['Switch'],
    name: '端口震荡抑制（flap 保护）',
    kw: ['端口震荡', 'flap', '接口频繁up down', '端口闪断'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n dampening 10 500 500 20\n# 或直接看历史\ndisplay interface GigabitEthernet 0/0/1 | include flap'],
      ['思科', 'interface GigabitEthernet 0/1\n dampening\n# 查看\nshow interfaces GigabitEthernet0/1 | include flapped'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n link-delay 5'],
      ['锐捷', 'interface GigabitEthernet 0/1\n dampening']
    ],
    tip: '日志里同一端口反复 up/down，先换线换模块；确认硬件没问题再加 dampening，否则只是把故障藏起来。'
  },
  {
    id: 'port-group-cfg',
    devs: ['Switch'],
    name: '端口组批量配置（通用）',
    kw: ['端口组', '批量配端口', 'port-group', 'interface range', '一次配多个口'],
    cmds: [
      ['华为', 'port-group group-member GigabitEthernet 0/0/1 to GigabitEthernet 0/0/8\n shutdown\n description to-pc'],
      ['思科', 'interface range GigabitEthernet 0/1 - 8\n shutdown\n description to-pc'],
      ['H3C', 'interface range GigabitEthernet 1/0/1 to GigabitEthernet 1/0/8\n shutdown'],
      ['锐捷', 'interface range GigabitEthernet 0/1-8\n shutdown']
    ],
    tip: '批量进去之后的命令对范围内所有口生效。改错了想反悔，得再批量进去取消，不如先在一台上验证好再批量。'
  },
  {
    id: 'unknown-unicast',
    devs: ['Switch'],
    name: '未知单播 / 组播抑制',
    kw: ['未知单播', '组播抑制', 'unknown-unicast', '单播泛滥'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n storm-control unicast min-rate 1000\n storm-control multicast min-rate 1000'],
      ['思科', 'interface GigabitEthernet 0/1\n storm-control unicast level 10\n storm-control multicast level 10'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n unicast-suppression pps 1000\n multicast-suppression pps 1000'],
      ['锐捷', 'interface GigabitEthernet 0/1\n storm-control unicast level 10']
    ],
    tip: '广播抑制配了还卡，说明是未知单播或组播在打——三种要分别配，别以为配一个就全管住。'
  },
  {
    id: 'rstp',
    devs: ['Switch'],
    name: 'RSTP 快速生成树',
    kw: ['rstp', '快速生成树', '快速收敛stp', '802.1w'],
    cmds: [
      ['华为', 'stp mode rstp'],
      ['思科', 'spanning-tree mode rapid-pvst'],
      ['H3C', 'stp mode rstp'],
      ['锐捷', 'spanning-tree mode rstp']
    ],
    tip: 'RSTP 收敛是秒级，STP 是 30 秒起步。现在新设备默认基本都 RSTP/MSTP，还在用老 STP 的该换了。'
  },
  {
    id: 'mstp',
    devs: ['Switch'],
    name: 'MSTP 多实例生成树',
    kw: ['mstp', '多实例', 'instance', 'vlan负载分担', 'mst域'],
    cmds: [
      ['华为', 'stp mode mstp\nstp region-configuration\n region-name RG1\n instance 1 vlan 10 to 20\n instance 2 vlan 30 to 40\n active region-configuration'],
      ['思科', 'spanning-tree mode mst\nspanning-tree mst configuration\n name RG1\n instance 1 vlan 10-20\n instance 2 vlan 30-40'],
      ['H3C', 'stp mode mstp\nstp region-configuration\n region-name RG1\n instance 1 vlan 10 to 20\n active region-configuration'],
      ['锐捷', 'spanning-tree mode mst\nspanning-tree mst configuration\n name RG1\n instance 1 vlan 10-20']
    ],
    tip: '同一个 MST 域内 region-name / revision / 实例映射三者必须完全一致，差一个就分成两个域，负载分担直接失效。'
  },
  {
    id: 'stp-root-guard',
    devs: ['Switch'],
    name: 'STP 根桥保护与 TC 保护',
    kw: ['根桥保护', 'root-guard', 'tc保护', '有人抢根桥', 'stp被攻击'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n stp root-protection\nstp tc-protection'],
      ['思科', 'interface GigabitEthernet 0/1\n spanning-tree guard root\nspanning-tree portfast bpdufilter default'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n stp root-protection\nstp tc-protection'],
      ['锐捷', 'interface GigabitEthernet 0/1\n spanning-tree guard root']
    ],
    tip: '根桥保护配在**不该成为根桥的端口**上。有人插个默认优先级的交换机进来抢根，网络一抖就是几十秒。'
  },
  {
    id: 'stp-timer',
    devs: ['Switch'],
    name: 'STP 定时器调整',
    kw: ['stp定时器', 'hello time', 'forward delay', '收敛时间'],
    cmds: [
      ['华为', 'stp timer hello 200\nstp timer forward-delay 1500\nstp timer max-age 2000'],
      ['思科', 'spanning-tree vlan 10 hello-time 2\nspanning-tree vlan 10 forward-time 15\nspanning-tree vlan 10 max-age 20'],
      ['H3C', 'stp timer hello 200\nstp timer forward-delay 1500'],
      ['锐捷', 'spanning-tree hello-time 2']
    ],
    tip: '单位不一样：华为 / H3C 是**百分之一秒**（200 = 2 秒），思科是秒。这个坑能把人绕晕。别乱调，会引发全网震荡。'
  },
  {
    id: 'lacp',
    devs: ['Switch'],
    name: 'LACP 模式链路聚合',
    kw: ['lacp', '动态聚合', '聚合模式', 'eth-trunk lacp', 'channel-group'],
    cmds: [
      ['华为', 'interface Eth-Trunk 1\n mode lacp-static\ninterface GigabitEthernet 0/0/1\n eth-trunk 1\ninterface GigabitEthernet 0/0/2\n eth-trunk 1'],
      ['思科', 'interface range GigabitEthernet 0/1 - 2\n channel-group 1 mode active\ninterface Port-channel1\n switchport mode trunk'],
      ['H3C', 'interface Bridge-Aggregation 1\n link-aggregation mode dynamic\ninterface GigabitEthernet 1/0/1\n port link-aggregation group 1'],
      ['锐捷', 'interface range GigabitEthernet 0/1-2\n port-group 1 mode active']
    ],
    tip: 'active 是主动协商、passive 是被动。两端都配 passive 永远协商不起来——至少要有一端 active。'
  },
  {
    id: 'lacp-hash',
    devs: ['Switch'],
    name: '聚合链路负载分担方式',
    kw: ['负载分担', 'hash', '流量不均', '聚合带宽不均'],
    cmds: [
      ['华为', 'interface Eth-Trunk 1\n load-balance src-dst-mac\n# 或 src-dst-ip / src-dst-mac-ip'],
      ['思科', 'port-channel load-balance src-dst-ip'],
      ['H3C', 'link-aggregation global load-sharing mode source-ip destination-ip'],
      ['锐捷', 'aggregateport load-balance src-dst-ip']
    ],
    tip: '聚合了但速度没翻倍，是哈希不均。跨三层用 src-dst-ip，二层用 src-dst-mac，选错了可能全压在一根线上。'
  },
  {
    id: 'stack-port',
    devs: ['Switch'],
    name: '堆叠口与堆叠优先级',
    kw: ['堆叠口', 'stack-port', '堆叠优先级', 'irf-port', '堆叠线'],
    cmds: [
      ['华为', 'interface stack-port 0/1\n port interface XGigabitEthernet 0/0/1 enable\n port interface XGigabitEthernet 0/0/2 enable'],
      ['思科', 'interface range TenGigabitEthernet 1/0/1 - 2\n stackport 1'],
      ['H3C', 'irf-port 1/1\n port group interface Ten-GigabitEthernet1/0/49\nirf-port 1/2\n port group interface Ten-GigabitEthernet1/0/50'],
      ['锐捷', 'interface range TenGigabitEthernet 0/1-2\n stack-port 1']
    ],
    tip: '堆叠口要**交叉互联**：1 号的 port1 接 2 号的 port2，接成直连会导致堆叠起不来或频繁分裂。'
  },
  {
    id: 'mad',
    devs: ['Switch'],
    name: '堆叠分裂检测 MAD',
    kw: ['mad', '堆叠分裂', '双主', '堆叠检测', 'brain split'],
    cmds: [
      ['华为', 'mad detect mode direct\n# 或 relay 模式\nmad detect mode relay'],
      ['思科', 'switch 1 priority 15\nstack-mac persistent timer 0'],
      ['H3C', 'irf domain 10\nirf link-delay 0\nmad enable'],
      ['锐捷', 'switch 1 domain 10\nstack detect']
    ],
    tip: '堆叠线断了两台都认为自己才是主，IP 全冲突、全网瘫痪，MAD 就是防这个的。叫法各家不同：华为 mad detect、H3C mad enable、思科靠 stack-mac persistent timer 加双活检测、锐捷 stack detect。配了堆叠一定要配它。'
  },
  {
    id: 'ip-routing',
    devs: ['Switch'],
    name: '三层交换机开启路由',
    kw: ['开启路由', 'ip routing', '三层交换', 'vlan间互通'],
    cmds: [
      ['华为', '（华为三层交换机默认开启，无需额外命令）\ndisplay ip routing-table'],
      ['思科', 'ip routing'],
      ['H3C', '（默认开启）\ndisplay ip routing-table'],
      ['锐捷', 'ip routing']
    ],
    tip: '思科 / 锐捷默认是二层模式，不敲 `ip routing` 的话配了 SVI 也不转发——这是最经典的「VLAN 配好了但不通」。'
  },
  {
    id: 'policy-vlan',
    devs: ['Switch'],
    name: '策略 VLAN（按 MAC/IP 分 VLAN）',
    kw: ['策略vlan', 'policy vlan', '按mac分vlan', '自动vlan'],
    cmds: [
      ['华为', 'vlan 10\npolicy-vlan mac-address 0011-2233-4455\n# 或 ip-subnet 形式\npolicy-vlan ip-subnet 192.168.10.0 mask 24'],
      ['思科', 'vlan 10\n# 用 VMPS 或 802.1X 动态 VLAN 实现\n# device-sensor / radius Tunnel-Private-Group-ID'],
      ['H3C', 'vlan 10\n# H3C 通过 MAC-VLAN / IP-Subnet-VLAN\nmac-vlan mac-address 0011-2233-4455 vlan 10'],
      ['锐捷', 'vlan 10\nmac-vlan mac-address 0011.2233.4455']
    ],
    tip: '策略 VLAN 让端口按接入设备的 MAC/IP 自动归 VLAN，适合会议室、工位轮换场景。思科主要靠 802.1X 下发，思路不同。'
  },
  {
    id: 'mac-blackhole',
    devs: ['Switch'],
    name: 'MAC 黑洞（拉黑某个 MAC）',
    kw: ['mac黑洞', '拉黑mac', '封mac', '禁止某设备上网'],
    cmds: [
      ['华为', 'mac-address blackhole 0011-2233-4455 vlan 10'],
      ['思科', 'mac address-table static 0011.2233.4455 vlan 10 drop'],
      ['H3C', 'mac-address blackhole 0011-2233-4455 vlan 10'],
      ['锐捷', 'mac-address-table static 0011.2233.4455 vlan 10 drop']
    ],
    tip: '发现有人在扫段、发攻击包，先黑洞掉这个 MAC 保业务，再慢慢查是谁。比直接关端口影响小。'
  },
  {
    id: 'dhcp-rate',
    devs: ['Switch'],
    name: 'DHCP 报文限速',
    kw: ['dhcp限速', 'dhcp报文抑制', 'dhcp攻击', '地址池被打爆'],
    cmds: [
      ['华为', 'dhcp snooping enable\ninterface GigabitEthernet 0/0/1\n dhcp snooping check dhcp-rate enable\n dhcp snooping check dhcp-rate 100'],
      ['思科', 'interface GigabitEthernet 0/1\n ip dhcp snooping limit rate 100'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n dhcp snooping rate-limit 100'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ip dhcp snooping limit rate 100']
    ],
    tip: '有人拿伪造 DHCP 报文刷屏会把交换机 CPU 打满、地址池耗尽。限速是最快止血手段。'
  },
  {
    id: 'igmp-snooping',
    devs: ['Switch'],
    name: 'IGMP Snooping（二层组播）',
    kw: ['igmp snooping', '二层组播', '组播泛洪', '视频卡顿'],
    cmds: [
      ['华为', 'igmp-snooping enable\nvlan 10\n igmp-snooping enable'],
      ['思科', 'ip igmp snooping\nip igmp snooping vlan 10'],
      ['H3C', 'igmp-snooping\nvlan 10\n igmp-snooping enable'],
      ['锐捷', 'ip igmp snooping\nip igmp snooping vlan 10']
    ],
    tip: '不开 IGMP Snooping，组播流量会当广播在全网泛洪，一个视频流能拖垮整栋楼。'
  },
  {
    id: 'multicast-vlan',
    devs: ['Switch'],
    name: '组播 VLAN',
    kw: ['组播vlan', 'multicast vlan', 'iptv组播', '组播复制'],
    cmds: [
      ['华为', 'multicast-vlan 100\n igmp-snooping enable\n multicast-vlan subvlan 10 20'],
      ['思科', 'vlan 100\n# 用 MVR（Multicast VLAN Registration）\nmvr\nmvr vlan 100\ninterface GigabitEthernet 0/1\n mvr immediate'],
      ['H3C', 'multicast-vlan 100\n multicast-vlan subvlan 10 20'],
      ['锐捷', 'multicast-vlan 100\n subvlan 10 20']
    ],
    tip: 'IPTV 场景：组播源只在一个 VLAN 里产生一份流量，再复制到各用户 VLAN，比每个 VLAN 各拉一路省带宽得多。'
  },
  {
    id: 'queue-schedule',
    devs: ['Switch'],
    name: '队列调度（SP / WRR）',
    kw: ['队列调度', 'wrr', 'sp队列', '优先级队列', '拥塞管理'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n qos schedule wrr 10 10 20 20 20 20 20 20\n# 或严格优先级\n qos schedule pq'],
      ['思科', 'interface GigabitEthernet 0/1\n srr-queue bandwidth share 10 20 30 40\n priority-queue out'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n qos wrr 10 10 20 20'],
      ['锐捷', 'interface GigabitEthernet 0/1\n wrr-queue bandwidth 10 20 30 40']
    ],
    tip: '语音走 PQ（严格优先，延迟最小），数据走 WRR（按权重分带宽）。全配成 PQ 会让普通流量饿死。'
  },
  {
    id: 'rspan',
    devs: ['Switch'],
    name: '远程端口镜像 RSPAN',
    kw: ['rspan', '远程镜像', '跨交换机抓包', 'vlan镜像'],
    cmds: [
      ['华为', 'observe-port 1 interface GigabitEthernet 0/0/24 vlan 999\n# 源交换机\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 both'],
      ['思科', 'vlan 999\n remote-span\nmonitor session 1 source interface GigabitEthernet 0/1 both\nmonitor session 1 destination remote vlan 999'],
      ['H3C', 'mirroring-group 1 remote-source\nmirroring-group 1 mirroring-port GigabitEthernet 1/0/1 both\nmirroring-group 1 remote-probe vlan 999'],
      ['锐捷', 'monitor session 1 source interface GigabitEthernet 0/1 both\nmonitor session 1 destination remote vlan 999']
    ],
    tip: '要抓的流量不在本机时用 RSPAN：把镜像流量塞进一个专用 VLAN，跨交换机送到抓包口。那个 VLAN 别拿来跑业务。'
  },
  {
    id: 'cpu-task',
    devs: ['Switch', 'Router'],
    name: '查看 CPU 各任务占用',
    kw: ['cpu任务', '哪个进程吃cpu', 'cpu占用排查'],
    cmds: [
      ['华为', 'display cpu-usage\ndisplay cpu-usage task'],
      ['思科', 'show processes cpu sorted 1min'],
      ['H3C', 'display cpu-usage\ndisplay cpu-usage task'],
      ['锐捷', 'show cpu\nshow cpu-protect summary']
    ],
    tip: 'CPU 高但业务正常，重点看是哪个任务在吃：如果是 ARP / STP，说明有人在扫段或环路；如果是转发面，看流量是否被打满。'
  },
  {
    id: 'mem-leak',
    devs: ['Switch', 'Router'],
    name: '查看内存使用与泄漏',
    kw: ['内存泄漏', 'memory', '内存占用高', '内存满了'],
    cmds: [
      ['华为', 'display memory-usage\ndisplay memory-usage | include Percent'],
      ['思科', 'show memory statistics\nshow processes memory sorted'],
      ['H3C', 'display memory\ndisplay memory | include Free'],
      ['锐捷', 'show memory']
    ],
    tip: '内存持续上涨不回落，就是泄漏。这类问题只能升级固件解决，重启只是临时缓解。'
  },
  {
    id: 'if-errors',
    devs: ['Switch', 'Router'],
    name: '端口错包明细分析',
    kw: ['错包', 'crc错', 'crc errors', 'errors', '丢包严重'],
    cmds: [
      ['华为', 'display interface GigabitEthernet 0/0/1\ndisplay interface GigabitEthernet 0/0/1 | include error'],
      ['思科', 'show interfaces GigabitEthernet0/1 counters errors\nshow interfaces GigabitEthernet0/1 | include error'],
      ['H3C', 'display interface GigabitEthernet 1/0/1\ndisplay counters inbound interface GigabitEthernet 1/0/1'],
      ['锐捷', 'show interfaces GigabitEthernet 0/1 counters errors']
    ],
    tip: 'CRC 涨 = 物理层问题（线、水晶头、模块）；late collisions 涨 = 双工不匹配；runts 涨 = 对端设备或线有问题。'
  },
  {
    id: 'file-manage',
    devs: ['Switch', 'Router'],
    name: '设备文件管理（dir / 删除 / 重命名）',
    kw: ['文件管理', 'dir', '删文件', '看flash', '配置文件在哪'],
    cmds: [
      ['华为', 'dir\ndir flash:/\ndelete flash:/vrpcfg.zip\nrename flash:/old.cfg flash:/new.cfg'],
      ['思科', 'dir flash:\ndelete flash:old.bin\nrename flash:old.bin new.bin'],
      ['H3C', 'dir\ndelete flash:/startup.cfg\nmove flash:/a.cfg flash:/b.cfg'],
      ['锐捷', 'dir flash:\ndelete flash:config.text']
    ],
    tip: '删配置文件（vrpcfg.zip / startup-config）等于恢复出厂，重启就全没了。手抖之前先备份到电脑。'
  },
  {
    id: 'patch',
    devs: ['Switch', 'Router'],
    name: '补丁升级（热补丁）',
    kw: ['补丁', 'patch', '热补丁', '不打补丁', '漏洞修复'],
    cmds: [
      ['华为', 'patch load flash:/xxx.pat all\npatch active all'],
      ['思科', '（IOS 无热补丁，需整版本升级）\ncopy tftp: flash:'],
      ['H3C', 'patch install flash:/xxx.bin'],
      ['锐捷', '（一般整版本升级）']
    ],
    tip: '热补丁不用重启就能修漏洞，适合不能停机的核心设备。思科大多数平台没有热补丁，只能排窗口重启升级。'
  },
  {
    id: 'eee',
    devs: ['Switch'],
    name: 'EEE 节能（端口休眠）',
    kw: ['eee', '节能', '端口休眠', '省电'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n eee enable'],
      ['思科', 'interface GigabitEthernet 0/1\n power efficient-ethernet auto'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n eee enable'],
      ['锐捷', 'interface GigabitEthernet 0/1\n eee enable']
    ],
    tip: 'EEE 省电但偶尔会引发互通问题（某些老网卡协商异常）。业务口出怪问题时可以关掉排除一下。'
  },
  {
    id: 'cfm',
    devs: ['Switch', 'Router'],
    name: '以太网链路检测（802.1ag / CFM）',
    kw: ['cfm', '802.1ag', '链路检测', '端到端检测', '以太网oam'],
    cmds: [
      ['华为', 'cfm enable\ncfm md md1 format string\n ma ma1 md md1\n  map vlan 10\ninterface GigabitEthernet 0/0/1\n cfm mep md md1 ma ma1 mepid 1'],
      ['思科', 'ethernet cfm domain DOMAIN level 1\n service MA1 vlan 10\nefpservice-instance'],
      ['H3C', 'cfm enable\ncfm md md1\ncfm ma ma1 md md1\n service-instance 1\n  vlan 10'],
      ['锐捷', 'cfm enable\ncfm md md1\ncfm ma ma1']
    ],
    tip: '拨测「这段链路到底通不通、丢不丢包」，比 ping 更细：能定位到具体某个 MA 段，运营商专线验收常用。'
  }
];

module.exports = { NET2_EXTRA };
