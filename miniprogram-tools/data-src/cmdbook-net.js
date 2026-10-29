// utils/cmdbook-net.js —— 命令百科扩充：交换机部分
// 与 cmdbook.js 的字段完全一致，最终由 cmdbook.js 合并成一个库。

const NET_EXTRA = [
  {
    id: 'vlan-del',
    devs: ['Switch'],
    name: '删除 VLAN',
    kw: ['删vlan', '删除vlan', '去掉vlan', '清理vlan'],
    cmds: [
      ['华为', 'system-view\nundo vlan 10'],
      ['思科', 'configure terminal\nno vlan 10'],
      ['H3C', 'system-view\nundo vlan 10'],
      ['锐捷', 'configure terminal\nno vlan 10']
    ],
    tip: '删 VLAN 前先把端口挪走，否则端口会变成「孤儿」挂在已删的 VLAN 上。'
  },
  {
    id: 'vlan-batch-create',
    devs: ['Switch'],
    name: '批量创建 VLAN',
    kw: ['批量建vlan', '连续vlan', '一次建多个vlan', 'batch'],
    cmds: [
      ['华为', 'vlan batch 10 to 20'],
      ['思科', '! IOS 没有批量命令\nvlan 10\nvlan 11\nvlan 12'],
      ['H3C', 'system-view\nvlan 10 to 20'],
      ['锐捷', '! 没有批量命令，逐个创建\nvlan 10\nvlan 11']
    ],
    tip: '只有华为、H3C 支持一行批量；思科、锐捷得逐个敲。'
  },
  {
    id: 'port-shutdown',
    devs: ['Switch', 'Router'],
    name: '关闭 / 开启端口',
    kw: ['关端口', '启用端口', 'shutdown', '停用接口', '禁用端口', '关闭不用的端口', '关掉不用的端口', '禁用不用的端口', '闲置端口关掉', '屏蔽端口', '屏蔽某个端口', '封掉端口', '停掉端口'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n shutdown\n（开启用 undo shutdown）'],
      ['思科', 'interface GigabitEthernet 0/1\n shutdown\n（开启用 no shutdown）'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n shutdown\n（开启用 undo shutdown）'],
      ['锐捷', 'interface GigabitEthernet 0/1\n shutdown\n（开启用 no shutdown）']
    ],
    tip: '「未开启」和「用 undo/no 开启」是两回事：华为族用 undo，思科族用 no。'
  },
  {
    id: 'port-speed-duplex',
    devs: ['Switch', 'Router'],
    name: '端口速率与双工',
    kw: ['速率', '双工', 'speed', 'duplex', '百兆千兆', '半双工', '自协商'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n speed 1000\n duplex full\n（恢复自协商：speed auto / duplex auto）'],
      ['思科', 'interface GigabitEthernet 0/1\n speed 1000\n duplex full\n（自协商：speed auto）'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n speed 1000\n duplex full'],
      ['锐捷', 'interface GigabitEthernet 0/1\n speed 1000\n duplex full']
    ],
    tip: '两端必须一致。一端写死 1000 全双工、另一端自协商，大概率协商成半双工，速度掉一半。'
  },
  {
    id: 'port-desc',
    devs: ['Switch', 'Router'],
    name: '端口加描述',
    kw: ['描述', 'description', '端口备注', '标注端口', '配端口描述', '端口描述怎么配', '接口描述怎么加'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n description to-core-sw1'],
      ['思科', 'interface GigabitEthernet 0/1\n description to-core-sw1'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n description to-core-sw1'],
      ['锐捷', 'interface GigabitEthernet 0/1\n description to-core-sw1']
    ],
    tip: '这四家写法完全一样。端口描述是最便宜的运维投入，出问题一眼就知道线接到哪。'
  },
  {
    id: 'port-security',
    devs: ['Switch'],
    name: '端口安全（限制 MAC 数）',
    kw: ['端口安全', 'mac限制', '绑定mac', 'port-security', '防私接'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port-security enable\n port-security max-mac-num 1'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport mode access\n switchport port-security\n switchport port-security maximum 1\n switchport port-security violation restrict'],
      ['H3C', 'port-security enable\ninterface GigabitEthernet 1/0/1\n port-security max-mac-count 1\n port-security port-mode autolearn'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport port-security\n switchport port-security maximum 1']
    ],
    tip: 'H3C 的端口安全要先在全局 port-security enable，再进接口配，顺序错了不生效。'
  },
  {
    id: 'stp-edge',
    devs: ['Switch'],
    name: '边缘端口 + BPDU 保护',
    kw: ['边缘端口', 'portfast', 'bpdu保护', '接电脑的端口', '快速收敛'],
    cmds: [
      ['华为', 'stp bpdu-protection\ninterface GigabitEthernet 0/0/1\n stp edged-port enable'],
      ['思科', 'interface GigabitEthernet 0/1\n spanning-tree portfast\n spanning-tree bpduguard enable'],
      ['H3C', 'stp bpdu-protection\ninterface GigabitEthernet 1/0/1\n stp edged-port'],
      ['锐捷', 'interface GigabitEthernet 0/1\n spanning-tree portfast\n spanning-tree bpduguard enable']
    ],
    tip: '接终端电脑的口一定要配边缘端口 + BPDU 保护，否则有人私接小交换机就会把环路引进来。'
  },
  {
    id: 'loop-detect',
    devs: ['Switch'],
    name: '环路检测（非 STP 场景）',
    kw: ['环路', '环路检测', 'loopback', '自环', '私接交换机'],
    cmds: [
      ['华为', 'loopback-detect enable\n（接口下也可单独开）'],
      ['思科', '! IOS 无独立环路检测，靠 STP + BPDU Guard\nspanning-tree guard loop'],
      ['H3C', 'loopback-detection global enable\ninterface GigabitEthernet 1/0/1\n loopback-detection enable vlan all'],
      ['锐捷', 'loopback-detection enable']
    ],
    tip: '思科没有独立环路检测命令，只能靠 STP + BPDU Guard 兜住。'
  },
  {
    id: 'storm-control',
    devs: ['Switch'],
    name: '广播风暴抑制',
    kw: ['风暴抑制', '广播风暴', 'storm-control', '抑制广播', '网络卡死'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n storm-control broadcast min-rate 1000'],
      ['思科', 'interface GigabitEthernet 0/1\n storm-control broadcast level 10'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n broadcast-suppression pps 1000'],
      ['锐捷', 'interface GigabitEthernet 0/1\n storm-control broadcast level 10']
    ],
    tip: '单位不一样：华为 min-rate 是每秒包数，思科 / 锐捷 level 是带宽百分比，H3C 是 pps。抄配置别抄单位。'
  },
  {
    id: 'poe',
    devs: ['Switch'],
    name: 'PoE 供电开关',
    kw: ['poe', '供电', '给ap供电', '摄像头供电', '断电重启'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n poe enable'],
      ['思科', 'interface GigabitEthernet 0/1\n power inline auto'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n poe enable'],
      ['锐捷', 'interface GigabitEthernet 0/1\n poe enable']
    ],
    tip: '摄像头、AP 不上线先看 PoE 有没有开、功率够不够。关掉再开（no poe enable → poe enable）等于给设备断电重启。'
  },
  {
    id: 'lldp',
    devs: ['Switch', 'Router', 'AP'],
    name: 'LLDP 查看邻居',
    kw: ['lldp', '看邻居', '对端设备', '线路接到哪', '拓扑发现'],
    cmds: [
      ['华为', 'lldp enable\ndisplay lldp neighbor brief'],
      ['思科', 'lldp run\nshow lldp neighbors'],
      ['H3C', 'lldp global enable\ndisplay lldp neighbor-information list'],
      ['锐捷', 'show lldp neighbors']
    ],
    tip: '不知道这根线对端接的谁，display/show lldp neighbors 比跑机房快得多。'
  },
  {
    id: 'ntp',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: 'NTP 时间同步',
    kw: ['配置ntp', 'ntp配置', '配ntp', 'ntp', '校时', '时间同步', '时钟', '日志时间不对'],
    cmds: [
      ['华为', 'ntp-service unicast-server 192.168.1.1'],
      ['思科', 'ntp server 192.168.1.1'],
      ['H3C', 'ntp-service unicast-server 192.168.1.1'],
      ['锐捷', 'ntp server 192.168.1.1']
    ],
    tip: '设备时间不对，日志时间戳就全错，多台设备一起排障会彻底对不上。'
  },
  {
    id: 'timezone',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '时区与手动设时间',
    kw: ['时区', '时间', 'clock', '北京时间'],
    cmds: [
      ['华为', 'clock timezone BJ add 08:00:00\nclock datetime 2026-10-24 21:00:00'],
      ['思科', 'clock timezone BJ 8\nclock set 21:00:00 24 October 2026'],
      ['H3C', 'clock timezone BJ add 08:00:00\nclock datetime 21:00:00 10/24/2026'],
      ['锐捷', 'clock timezone BJ 8\nclock set 21:00:00 10 24 2026']
    ],
    tip: '华为 / H3C 用 add 08:00:00，思科 / 锐捷直接写 8。日期格式四家都不一样。'
  },
  {
    id: 'snmp',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: 'SNMP 团体名配置',
    kw: ['snmp', '监控', '网管', '团体名', 'community'],
    cmds: [
      ['华为', 'snmp-agent\nsnmp-agent community read cipher public\nsnmp-agent sys-info version v2c'],
      ['思科', 'snmp-server community public ro\nsnmp-server enable traps'],
      ['H3C', 'snmp-agent\nsnmp-agent community read public\nsnmp-agent sys-info version v2c'],
      ['锐捷', 'snmp-server community public ro']
    ],
    tip: 'SNMP 采不到数据，先查团体名、ACL 有没有放行网管服务器 IP。'
  },
  {
    id: 'loghost',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '日志发到日志服务器',
    kw: ['日志服务器', 'syslog', 'loghost', '日志外发', '集中日志'],
    cmds: [
      ['华为', 'info-center enable\ninfo-center loghost 192.168.1.100'],
      ['思科', 'logging host 192.168.1.100\nlogging trap informational'],
      ['H3C', 'info-center enable\ninfo-center loghost 192.168.1.100'],
      ['锐捷', 'logging server 192.168.1.100']
    ],
    tip: '发日志前先确认设备和服务器通。info-center 里 source 用 loopback 更稳，接口一抖日志就断。'
  },
  {
    id: 'log-view',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '查看设备日志',
    kw: ['看日志', 'logbuffer', '告警', '最近日志', '查log'],
    cmds: [
      ['华为', 'display logbuffer'],
      ['思科', 'show logging'],
      ['H3C', 'display logbuffer'],
      ['锐捷', 'show logging']
    ],
    tip: '排障先看日志再看配置。buffer 里的日志重启就没了，重要的必须发到日志服务器。'
  },
  {
    id: 'stack',
    devs: ['Switch'],
    name: '堆叠 / IRF 配置',
    kw: ['堆叠', 'irf', 'stack', '虚拟化', '两台当一台'],
    cmds: [
      ['华为', 'stack slot 0 priority 200\nstack slot 0 renumber 1\n（重启后生效）'],
      ['思科', 'switch 1 priority 15\nswitch 2 priority 10\n（StackWise，重启生效）'],
      ['H3C', 'irf member 1 priority 32\nirf-port 1/1\n port group interface Ten-GigabitEthernet1/0/49'],
      ['锐捷', 'switch 1 priority 15\nswitch 2 priority 10']
    ],
    tip: '堆叠改优先级和编号都要重启才生效，而且必须一次配完两台再重启，否则会分裂成两个独立设备。'
  },
  {
    id: 'vrrp',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'VRRP 网关冗余',
    kw: ['vrrp', '网关冗余', '主备网关', '双机热备'],
    cmds: [
      ['华为', 'interface Vlanif 10\n vrrp vrid 1 virtual-ip 192.168.10.254\n vrrp vrid 1 priority 120\n vrrp vrid 1 preempt-mode timer delay 20'],
      ['思科', 'interface Vlan 10\n vrrp 1 ip 192.168.10.254\n vrrp 1 priority 120\n vrrp 1 preempt delay minimum 20'],
      ['H3C', 'interface Vlan-interface 10\n vrrp vrid 1 virtual-ip 192.168.10.254\n vrrp vrid 1 priority 120'],
      ['锐捷', 'interface Vlan 10\n vrrp 1 ip 192.168.10.254\n vrrp 1 priority 120']
    ],
    tip: '优先级默认 100，主设备配大一点（如 120）。配了 preempt delay 可以避免链路抖动时来回抢主。'
  },
  {
    id: 'dhcp-snooping',
    devs: ['Switch'],
    name: 'DHCP Snooping（防私接路由）',
    kw: ['dhcp snooping', '防私接路由器', 'dhcp欺骗', '伪造dhcp', '防止私接路由器', '私接路由', '配置dhcp snooping', 'dhcp snooping配置'],
    cmds: [
      ['华为', 'dhcp enable\ndhcp snooping enable\ninterface GigabitEthernet 0/0/24\n dhcp snooping trusted'],
      ['思科', 'ip dhcp snooping\nip dhcp snooping vlan 10\ninterface GigabitEthernet 0/24\n ip dhcp snooping trust'],
      ['H3C', 'dhcp snooping enable\ninterface GigabitEthernet 1/0/24\n dhcp snooping trust'],
      ['锐捷', 'ip dhcp snooping\nip dhcp snooping vlan 10\ninterface GigabitEthernet 0/24\n ip dhcp snooping trust']
    ],
    tip: '上联口一定要设 trusted，否则连正牌 DHCP 服务器的响应也被丢掉，全网拿不到地址。'
  },
  {
    id: 'arp-inspection',
    devs: ['Switch'],
    name: 'ARP 防欺骗',
    kw: ['arp防护', 'arp欺骗', 'arp inspection', 'dai', '网关mac被改', '防arp攻击', 'arp攻击怎么防', 'arp欺骗怎么防'],
    cmds: [
      ['华为', 'arp anti-attack check user-bind enable'],
      ['思科', 'ip arp inspection vlan 10\ninterface GigabitEthernet 0/24\n ip arp inspection trust'],
      ['H3C', 'arp detection enable\ninterface GigabitEthernet 1/0/24\n arp detection trust'],
      ['锐捷', 'ip arp inspection vlan 10']
    ],
    tip: '要配合 DHCP Snooping 一起用，靠绑定表判断 ARP 是否可信。'
  },
  {
    id: 'static-mac',
    devs: ['Switch'],
    name: '静态 MAC 绑定',
    kw: ['静态mac', 'mac绑定', '固定mac', 'mac-address static'],
    cmds: [
      ['华为', 'mac-address static 0011-2233-4455 GigabitEthernet 0/0/1 vlan 10'],
      ['思科', 'mac address-table static 0011.2233.4455 vlan 10 interface GigabitEthernet 0/1'],
      ['H3C', 'mac-address static 0011-2233-4455 interface GigabitEthernet 1/0/1 vlan 10'],
      ['锐捷', 'mac-address-table static 0011.2233.4455 vlan 10 interface GigabitEthernet 0/1']
    ],
    tip: 'MAC 格式不一样：华为 / H3C 用短横线 0011-2233-4455，思科 / 锐捷用点 0011.2233.4455。'
  },
  {
    id: 'dhcp-relay',
    devs: ['Switch', 'Router'],
    name: 'DHCP 中继',
    kw: ['dhcp中继', 'relay', 'helper-address', '跨网段拿地址'],
    cmds: [
      ['华为', 'dhcp enable\ninterface Vlanif 10\n dhcp select relay\n dhcp relay server-ip 192.168.1.100'],
      ['思科', 'interface Vlan 10\n ip helper-address 192.168.1.100'],
      ['H3C', 'dhcp enable\ninterface Vlan-interface 10\n dhcp select relay\n dhcp relay server-address 192.168.1.100'],
      ['锐捷', 'interface Vlan 10\n ip helper-address 192.168.1.100']
    ],
    tip: '思科 / 锐捷一条 ip helper-address 就够，华为 / H3C 要先开 dhcp enable 再指定 relay。'
  },
  {
    id: 'cpu-mem',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '查看 CPU / 内存',
    kw: ['cpu', '内存', '负载高', 'memory', '卡顿'],
    cmds: [
      ['华为', 'display cpu-usage\ndisplay memory-usage'],
      ['思科', 'show processes cpu sorted\nshow memory statistics'],
      ['H3C', 'display cpu-usage\ndisplay memory'],
      ['锐捷', 'show cpu\nshow memory']
    ],
    tip: 'CPU 突然打满，先看是不是环路或广播风暴，再看有没有人 debug all。'
  },
  {
    id: 'transceiver',
    devs: ['Switch', 'Router'],
    name: '查看光模块信息',
    kw: ['光模块', '光衰', 'transceiver', '收发光', '光功率', '光模块不亮', '光口不亮', '模块不亮'],
    cmds: [
      ['华为', 'display transceiver interface GigabitEthernet 0/0/49 verbose'],
      ['思科', 'show interfaces GigabitEthernet0/49 transceiver detail'],
      ['H3C', 'display transceiver interface GigabitEthernet 1/0/49 verbose'],
      ['锐捷', 'show interfaces GigabitEthernet 0/49 transceiver']
    ],
    tip: '重点看 Rx Power 和 Tx Power，收光低于 -20dBm 基本就要查尾纤和模块了。'
  },
  {
    id: 'version',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '查看版本与序列号',
    kw: ['版本', '序列号', 'sn', 'version', '设备型号', '报修要sn'],
    cmds: [
      ['华为', 'display version\ndisplay device manuinfo'],
      ['思科', 'show version\nshow inventory'],
      ['H3C', 'display version\ndisplay device manuinfo'],
      ['锐捷', 'show version\nshow version slots']
    ],
    tip: '报修、查 EOL、对固件版本都要用到，序列号（SN）在 manuinfo / inventory 里。'
  },
  {
    id: 'config-backup',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '配置备份到 TFTP / FTP',
    kw: ['备份配置', '导出配置', 'tftp', '备份到服务器'],
    cmds: [
      ['华为', 'save\ntftp 192.168.1.100 put vrpcfg.zip vrpcfg-backup.zip'],
      ['思科', 'copy running-config tftp:\n（按提示输入服务器 IP 和文件名）'],
      ['H3C', 'save\nbackup startup-configuration to 192.168.1.100 startup-backup.cfg'],
      ['锐捷', 'copy running-config tftp:']
    ],
    tip: '备份前先 save，否则导出去的是上次保存的旧配置。'
  },
  {
    id: 'upgrade',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '升级固件',
    kw: ['升级', '刷版本', 'firmware', '系统文件', '升ios', '升级后版本没变', '升级不生效', '版本没变', '升级了还是老版本', '指定启动文件'],
    cmds: [
      ['华为', 'tftp 192.168.1.100 get xxx.cc\nstartup system-software xxx.cc\nreboot'],
      ['思科', 'copy tftp: flash:\nboot system flash:xxx.bin\nreload'],
      ['H3C', 'tftp 192.168.1.100 get xxx.ipe\nboot-loader file flash:/xxx.ipe all\nreboot'],
      ['锐捷', 'copy tftp: flash:\nreload']
    ],
    tip: '升级前后都要验证版本和配置完整性；思科要先确认 flash 空间够放新镜像。'
  },
  {
    id: 'clear-counter',
    devs: ['Switch', 'Router'],
    name: '清除接口计数',
    kw: ['清零', '清除计数', 'clear counters', '错误包计数'],
    cmds: [
      ['华为', 'reset counters interface GigabitEthernet 0/0/1'],
      ['思科', 'clear counters GigabitEthernet 0/1'],
      ['H3C', 'reset counters interface GigabitEthernet 1/0/1'],
      ['锐捷', 'clear counters GigabitEthernet 0/1']
    ],
    tip: '排查错误包时先清零，等几分钟再看增量，比看累计数字准得多。'
  },
  {
    id: 'show-users',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '查看谁登录了设备',
    kw: ['在线用户', '谁在登录', 'display users', '踢人', 'vty占用'],
    cmds: [
      ['华为', 'display users'],
      ['思科', 'show users'],
      ['H3C', 'display users'],
      ['锐捷', 'show users']
    ],
    tip: 'vty 线路被占满时新会话进不来，用这个看是谁挂着。'
  },
  {
    id: 'arp-table',
    devs: ['Switch', 'Router', '防火墙'],
    name: '查看 ARP 表',
    kw: ['arp表', '查arp', 'ip mac 对应', 'arp缓存', '查看arp', '看arp表', 'arp表怎么查'],
    cmds: [
      ['华为', 'display arp'],
      ['思科', 'show arp'],
      ['H3C', 'display arp'],
      ['锐捷', 'show arp']
    ],
    tip: 'ping 不通但 ARP 有记录，说明二层通了三层没通；ARP 都没有，问题在二层。'
  },
  {
    id: 'local-user',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '创建本地管理员账号',
    kw: ['创建账号', '管理员', 'aaa', 'local-user', '改密码', '设置密码', '新建用户', '登录账号'],
    cmds: [
      ['华为', 'aaa\nlocal-user admin password irreversible-cipher Admin@123\nlocal-user admin privilege level 15\nlocal-user admin service-type ssh telnet'],
      ['思科', 'username admin privilege 15 secret Admin@123\nenable secret Enable@123'],
      ['H3C', 'local-user admin class manage\npassword simple Admin@123\nservice-type ssh telnet\n authorization-attribute user-role network-admin'],
      ['锐捷', 'username admin privilege 15 password Admin@123\nenable secret Enable@123']
    ],
    tip: 'H3C 的本地用户分 class manage / network，配错 class 会登不进去。'
  },
  {
    id: 'if-traffic',
    devs: ['Switch', 'Router'],
    name: '查看接口流量与错误包',
    kw: ['流量', '错误包', 'crc', '接口统计', '看带宽占用'],
    cmds: [
      ['华为', 'display interface GigabitEthernet 0/0/1'],
      ['思科', 'show interfaces GigabitEthernet0/1'],
      ['H3C', 'display interface GigabitEthernet 1/0/1'],
      ['锐捷', 'show interfaces GigabitEthernet 0/1']
    ],
    tip: '重点看 input errors、CRC、runts。CRC 持续增长基本是线缆或模块问题，不是配置问题。'
  },
  {
    id: 'ipsg',
    devs: ['Switch'],
    name: 'IP 源防护 IPSG（防私改 IP）',
    kw: ['ipsg', 'ip源防护', '防私改ip', 'ip仿冒', 'ip verify', '防止私改ip', '防止私改', '私自改ip', '私改ip', '改ip地址', 'ip防篡改', '防止改ip', '私设ip', '防止私设ip', '防止私设', '私设ip地址', '乱设ip', '手动设ip'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n ip source check user-bind enable'],
      ['思科', 'interface GigabitEthernet 0/1\n ip verify source port-security'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n ip verify source ip-address mac-address'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ip verify source']
    ],
    tip: '必须有 DHCP Snooping 或静态绑定表做依据，否则所有包都会被丢掉，直接断网。'
  },
  {
    id: 'voice-vlan',
    devs: ['Switch'],
    name: 'Voice VLAN（IP 电话专用）',
    kw: ['语音vlan', 'voice vlan', 'ip电话vlan', '话机'],
    cmds: [
      ['华为', 'vlan 100\nvoice-vlan 100 enable\ninterface GigabitEthernet 0/0/1\n port link-type hybrid\n voice-vlan mode auto enable'],
      ['思科', 'vlan 100\ninterface GigabitEthernet 0/1\n switchport mode access\n switchport access vlan 10\n switchport voice vlan 100'],
      ['H3C', 'voice vlan 100 enable\ninterface GigabitEthernet 1/0/1\n port link-type hybrid\n voice vlan mode auto'],
      ['锐捷', 'voice vlan 100\ninterface GigabitEthernet 0/1\n switchport voice vlan 100']
    ],
    tip: '话机和电脑共用一个口时，数据走 access VLAN、语音走 Voice VLAN，靠 LLDP 或 OUI 自动识别。识别不出来就查话机的 OUI 有没有在列表里。'
  },
  {
    id: 'super-vlan',
    devs: ['Switch'],
    name: 'Super VLAN（VLAN 聚合）',
    kw: ['supervlan', 'vlan聚合', '多个vlan共用一个网关', '节省地址'],
    cmds: [
      ['华为', 'vlan 100\n aggregate-vlan\n access-vlan 10 20\ninterface Vlanif 100\n ip address 192.168.100.1 24'],
      ['思科', '! IOS 无 Super VLAN，用 Private VLAN 替代\nvlan 100\n private-vlan primary\n private-vlan association 10,20'],
      ['H3C', 'vlan 100\n supervlan\n subvlan 10 20\ninterface Vlan-interface 100\n ip address 192.168.100.1 24'],
      ['锐捷', 'vlan 100\n supervlan\n subvlan 10 20']
    ],
    tip: 'Super VLAN 让多个子 VLAN 共用一个网关网段，省 IP；但子 VLAN 之间默认二层隔离，要互通得靠本地代理 ARP。'
  },
  {
    id: 'qinq',
    devs: ['Switch'],
    name: 'QinQ（VLAN 双层标签）',
    kw: ['qinq', '双层vlan', 'vlan嵌套', '运营商vlan', 'dot1q-tunnel'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port link-type dot1q-tunnel\n port default vlan 100'],
      ['思科', 'interface GigabitEthernet 0/1\n switchport mode dot1q-tunnel\n switchport access vlan 100'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n qinq enable\n port access vlan 100'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport mode dot1q-tunnel\n switchport access vlan 100']
    ],
    tip: 'QinQ 就是给内层 VLAN 再套一层外层标签，让不同客户的相同 VLAN ID 能共存。接运营商专线时常见。'
  },
  {
    id: 'erps',
    devs: ['Switch'],
    name: 'ERPS 环网保护',
    kw: ['erps', '环网', '环网保护', 'rep', '防环倒换'],
    cmds: [
      ['华为', 'erps ring 1\n version v2\n port0 interface GigabitEthernet 0/0/1\n port1 interface GigabitEthernet 0/0/2\n protected-vlan reference-instance 1'],
      ['思科', '! 思科叫 REP\ninterface GigabitEthernet 0/1\n rep segment 1 edge'],
      ['H3C', 'erps ring 1\n instance 1\n  protected-vlan 10 to 20\n port0 interface GigabitEthernet 1/0/1\n port1 interface GigabitEthernet 1/0/2\n rpl port0 owner'],
      ['锐捷', 'erps enable\nerps raps-vlan 4001\n ring-port west GigabitEthernet 0/1 east GigabitEthernet 0/2\n rpl-port west rpl-owner\n state enable']
    ],
    tip: '环网里必须只有一个主节点（RPL owner），配了两个会互相抢，环路照样出现。锐捷的写法跟另外三家差最远：它是 erps raps-vlan <VLAN> 进环视图，不是 erps ring <编号>。'
  },
  {
    id: 'dot1x-wired',
    devs: ['Switch'],
    name: '802.1X 有线认证',
    kw: ['802.1x有线', '入网认证', 'dot1x', '插网线要认证', 'radius认证'],
    cmds: [
      ['华为', 'dot1x enable\ninterface GigabitEthernet 0/0/1\n dot1x enable\n dot1x authentication-method eap'],
      ['思科', 'dot1x system-auth-control\ninterface GigabitEthernet 0/1\n authentication port-control auto\n dot1x pae authenticator'],
      ['H3C', 'dot1x\ninterface GigabitEthernet 1/0/1\n dot1x'],
      ['锐捷', 'dot1x system-auth-control\ninterface GigabitEthernet 0/1\n dot1x port-control auto']
    ],
    tip: '配完没人能上网，先确认 RADIUS 通了没有；实在上不了线，留一个口配 dot1x port-control auto 之外的 force-authorized 做应急口。'
  },
  {
    id: 'mac-auth',
    devs: ['Switch'],
    name: 'MAC 地址认证（免客户端入网）',
    kw: ['mac认证', '免客户端认证', 'mab', '打印机认证', '哑终端'],
    cmds: [
      ['华为', 'mac-authen\ninterface GigabitEthernet 0/0/1\n mac-authen'],
      ['思科', 'interface GigabitEthernet 0/1\n authentication host-mode multi-domain\n mab\n authentication port-control auto'],
      ['H3C', 'mac-authentication\ninterface GigabitEthernet 1/0/1\n mac-authentication'],
      ['锐捷', 'mac-authentication\ninterface GigabitEthernet 0/1\n mac-authentication']
    ],
    tip: '打印机、摄像头这类装不了客户端的设备用 MAC 认证；前提是把它的 MAC 录进 RADIUS，换设备就得重新录。'
  },
  {
    id: 'cpu-defend',
    devs: ['Switch', 'Router'],
    name: 'CPU 防攻击策略',
    kw: ['cpu防攻击', 'cpu占用高', '攻击防护', 'control-plane', '上送限速'],
    cmds: [
      ['华为', 'cpu-defend policy 1\n auto-defend enable\n auto-defend threshold 60\ncpu-defend-policy 1 global'],
      ['思科', 'control-plane\n service-policy input COPP-POLICY\n（需先配 class-map / policy-map 限速）'],
      ['H3C', 'attack-defense policy 1\n signature-detect enable\nattack-defense-policy 1 global'],
      ['锐捷', 'cpu-protect policy 1\n cpu-protect type arp 500']
    ],
    tip: 'CPU 突然 90% 以上、ping 设备变卡但业务正常，八成是有人扫段或者广播风暴打到 CPU 了。'
  },
  {
    id: 'netstream',
    devs: ['Switch', 'Router'],
    name: '流量分析（NetStream / sFlow）',
    kw: ['流量分析', 'netstream', 'sflow', 'netflow', '谁占带宽'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n netstream inbound\nip netstream export host 192.168.1.100 2055'],
      ['思科', 'interface GigabitEthernet 0/1\n ip flow ingress\nip flow-export destination 192.168.1.100 2055'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n ip netstream inbound\nip netstream export host 192.168.1.100 2055'],
      ['锐捷', 'interface GigabitEthernet 0/1\n ip flow ingress\nip flow-export destination 192.168.1.100 2055']
    ],
    tip: '出口带宽跑满但不知道是谁，抓包太重，用 NetStream + 一台采集服务器能直接排出 Top Talker。'
  },
  {
    id: 'qos-trust',
    devs: ['Switch'],
    name: 'QoS 优先级信任与标记',
    kw: ['配置qos', 'qos怎么配', 'qos', '优先级', '802.1p', 'dscp', '语音优先', '队列'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n trust 8021p\n qos priority 5'],
      ['思科', 'mls qos\ninterface GigabitEthernet 0/1\n mls qos trust cos'],
      ['H3C', 'qos trust dot1p'],
      ['锐捷', 'mls qos\ninterface GigabitEthernet 0/1\n mls qos trust cos']
    ],
    tip: '要让语音优先，得整条链路都信任并映射队列，只在接入口配了、核心不认，等于没配。'
  },
  {
    id: 'port-rate-limit',
    devs: ['Switch'],
    name: '端口限速（入方向）',
    kw: ['配置qos限速', '限速怎么配', '端口限速', '限速交换机', 'car', 'qos lr', '限制带宽', '限制网速', '网速限制', '限带宽', '带宽不够', '配置限速', '带宽限制'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n qos lr inbound cir 10240'],
      ['思科', 'interface GigabitEthernet 0/1\n srr-queue bandwidth limit 20\n（或 policy-map + police 做精确限速）'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n qos lr inbound cir 10240'],
      ['锐捷', 'interface GigabitEthernet 0/1\n rate-limit input 10240']
    ],
    tip: '单位基本都是 kbps：10240 就是 10Mbps。思科的 srr-queue 是百分比，和华为 / H3C 的绝对值不是一回事。'
  },
  {
    id: 'mac-aging',
    devs: ['Switch'],
    name: 'MAC 地址表老化时间',
    kw: ['mac老化', 'aging-time', '地址表多久清', 'mac表满'],
    cmds: [
      ['华为', 'mac-address aging-time 300'],
      ['思科', 'mac address-table aging-time 300'],
      ['H3C', 'mac-address timer aging 300'],
      ['锐捷', 'mac-address-table aging-time 300']
    ],
    tip: '默认 300 秒（5 分钟）。MAC 表被刷爆导致丢包时，可以缩短老化时间缓解，但治本还是查攻击源。'
  },
  {
    id: 'jumbo',
    devs: ['Switch', 'Router'],
    name: 'Jumbo 帧 / MTU 调整',
    kw: ['mtu', 'jumbo', '巨帧', '大包不通', '存储网络', '大包不通小包能通', '小包通大包不通', '大包丢'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n jumboframe enable 9216'],
      ['思科', 'system mtu 9216\n（部分平台需要 reload 生效）'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n jumboframe enable 9216'],
      ['锐捷', 'interface GigabitEthernet 0/1\n mtu 9216']
    ],
    tip: 'iSCSI、备份这类大包业务，路径上任何一跳 MTU 不够都会表现为「小包通、大包卡死」，很难查。'
  },
  {
    id: 'env',
    devs: ['Switch', 'Router', '防火墙'],
    name: '查看温度 / 风扇 / 电源',
    kw: ['温度', '风扇', '电源', '环境', '设备过热'],
    cmds: [
      ['华为', 'display environment\ndisplay power'],
      ['思科', 'show environment all\nshow power inline'],
      ['H3C', 'display environment\ndisplay power'],
      ['锐捷', 'show environment']
    ],
    tip: '设备莫名重启、风扇狂转，先看这条。温度超阈值会触发保护性重启，很容易被误判成「设备坏了」。'
  },
  {
    id: 'module',
    devs: ['Switch', 'Router'],
    name: '查看板卡 / 模块状态',
    kw: ['板卡', '模块', '子卡', 'slot', '堆叠成员'],
    cmds: [
      ['华为', 'display device\ndisplay device slot 1'],
      ['思科', 'show module\nshow inventory'],
      ['H3C', 'display device\ndisplay device slot 1'],
      ['锐捷', 'show module']
    ],
    tip: '板卡插上没识别，先看这条确认是「没上线」还是「上线了但接口没起来」，两种情况处理完全不同。'
  },
  {
    id: 'port-link-type',
    devs: ['Switch'],
    name: '端口链路类型（Access / Trunk / Hybrid）',
    kw: ['hybrid', 'hybrid口', '链路类型', '端口模式', 'access口', 'access trunk hybrid 区别', 'pvid', 'untag', 'tag', '配access', 'access口怎么配', 'access口配置'],
    cmds: [
      ['华为', 'interface GigabitEthernet 0/0/1\n port link-type access\n port default vlan 10\ninterface GigabitEthernet 0/0/2\n port link-type trunk\n port trunk allow-pass vlan 10 20\ninterface GigabitEthernet 0/0/3\n port link-type hybrid\n port hybrid pvid vlan 10\n port hybrid untagged vlan 10\n port hybrid tagged vlan 20 30\ndisplay port vlan'],
      ['思科', 'interface GigabitEthernet0/1\n switchport mode access\n switchport access vlan 10\ninterface GigabitEthernet0/2\n switchport trunk encapsulation dot1q\n switchport mode trunk\n switchport trunk allowed vlan 10,20\nshow interfaces switchport'],
      ['H3C', 'interface GigabitEthernet 1/0/1\n port link-type access\n port access vlan 10\ninterface GigabitEthernet 1/0/2\n port link-type trunk\n port trunk permit vlan 10 20\ninterface GigabitEthernet 1/0/3\n port link-type hybrid\n port hybrid vlan 10 untagged\n port hybrid vlan 20 30 tagged\ndisplay port vlan'],
      ['锐捷', 'interface GigabitEthernet 0/1\n switchport mode access\n switchport access vlan 10\ninterface GigabitEthernet 0/2\n switchport mode trunk\n switchport trunk allowed vlan 10,20\nshow interfaces switchport']
    ],
    tip: '三种类型的差别一句话：Access 只属于一个 VLAN、出去不带标签；Trunk 能透传多个 VLAN、出去默认都带标签（PVID 那个不带）；Hybrid 最自由，可以逐个 VLAN 指定带不带标签，华为/H3C 的 Hybrid 用 tagged / untagged 精确控制。思科没有 Hybrid，只有 access 和 trunk，要等效实现得靠 native vlan。收发方向的规则要记牢：收到不带标签的帧按 PVID 打标，发出去时 VLAN 在 untagged 列表里就剥标签、否则带标签——「同一个 VLAN 一会儿通一会儿不通」基本都是 PVID 和 untagged 列表配错。H3C 的 access 口改 VLAN 是 port access vlan，华为是 port default vlan，两家别写混。'
  }
];

module.exports = { NET_EXTRA };
