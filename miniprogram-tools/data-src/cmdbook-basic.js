// utils/cmdbook-basic.js —— 命令百科扩充：基础操作（从零开始的那一层）
// 这一批全是「天天要用、但老手已经忘了当初怎么学」的命令：进配置、改名、看帮助、
// 关分屏、过滤输出、ping、重启…… 跨设备通用，所以 devs 基本都是满的。

const BASIC_EXTRA = [
  {
    id: 'mode-switch',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '进入 / 退出配置视图',
    kw: ['进配置', 'system-view', 'configure terminal', '命令行模式', '用户视图', '特权模式', '第一课'],
    cmds: [
      ['华为', '<Huawei> system-view          # 用户视图 → 系统视图\n[Huawei] interface GigabitEthernet 0/0/1\n[Huawei-GigabitEthernet0/0/1] quit    # 退一层\n[Huawei] return                # 直接回用户视图'],
      ['思科', 'Router> enable                   # 用户模式 → 特权模式\nRouter# configure terminal       # 特权 → 全局配置\nRouter(config)# interface Gi0/1\nRouter(config-if)# exit          # 退一层\nRouter(config)# end              # 直接回特权模式'],
      ['H3C', '<H3C> system-view\n[H3C] interface GigabitEthernet 1/0/1\n[H3C-GigabitEthernet1/0/1] quit\n[H3C] return'],
      ['锐捷', 'Router> enable\nRouter# configure terminal\nRouter(config)# interface GigabitEthernet 0/1\nRouter(config-if)# exit\nRouter(config)# end']
    ],
    tip: '看提示符就知道在哪一层：`<>` 用户视图（只能看）、`[]` 系统视图、`()` 子视图。思科是 `>` / `#` / `(config)`。'
  },
  {
    id: 'sysname',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '修改设备名称',
    kw: ['改名字', '设备名', 'sysname', 'hostname', '第一件事'],
    cmds: [
      ['华为', 'system-view\nsysname SW-Core-01'],
      ['思科', 'configure terminal\nhostname SW-Core-01'],
      ['H3C', 'system-view\nsysname SW-Core-01'],
      ['锐捷', 'configure terminal\nhostname SW-Core-01']
    ],
    tip: '上线第一件事就是改名，否则一堆默认名设备根本分不清谁是谁。改名不会断业务。'
  },
  {
    id: 'help',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '查看命令帮助 / Tab 补全',
    kw: ['帮助', '问号', 'tab补全', '忘了命令', '不会敲', '命令提示'],
    cmds: [
      ['华为', '?\nsys?\ndisplay ?'],
      ['思科', '?\nsh?\ndis?'],
      ['H3C', '?\nsys?\ndisplay ?'],
      ['锐捷', '?\nsh?\ndisplay ?']
    ],
    tip: '`?` 是唯一不用背命令的办法：先敲个前缀加问号，能接什么全列出来。Tab 只在唯一匹配时补全，多个匹配时会不动作。'
  },
  {
    id: 'screen-length',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '关闭分屏输出（---- More ----）',
    kw: ['分屏', '关分屏', '分屏关闭', 'more', '翻页', '输出太长', '一屏一屏', 'screen-length', '总停下来'],
    cmds: [
      ['华为', 'screen-length 0 temporary      # 临时，当前会话有效\n（永久：user-interface vty 0 4 下 screen-length 0）'],
      ['思科', 'terminal length 0'],
      ['H3C', 'screen-length disable'],
      ['锐捷', 'terminal length 0']
    ],
    tip: '敲完这条，display current-configuration 就一口气全出来，不再一屏一屏等你按空格。新手最容易被这个卡住。'
  },
  {
    id: 'filter-output',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '过滤命令输出（| include）',
    kw: ['过滤', 'include', 'grep输出', '只看某个', '输出太长找关键字', '管道'],
    cmds: [
      ['华为', 'display current-configuration | include vlan\ndisplay mac-address | include 0011-2233\ninterface GigabitEthernet 0/0/1 | include rate'],
      ['思科', 'show running-config | include vlan\nshow mac address-table | include 0011.2233\nshow run | section ospf'],
      ['H3C', 'display current-configuration | include vlan\ndisplay mac-address | include 0011-2233'],
      ['锐捷', 'show running-config | include vlan\nshow mac-address-table | include 0011.2233']
    ],
    tip: '排障第一效率工具。想在几百行配置里找某个 VLAN，不用肉眼翻，`| include 关键字` 直接过滤。'
  },
  {
    id: 'history',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '查看历史命令（忘了刚才敲了啥）',
    kw: ['历史命令', 'history', '刚才敲了什么', '上一条命令'],
    cmds: [
      ['华为', 'display history-command\n（方向键 ↑ 也能翻）'],
      ['思科', 'show history\n（方向键 ↑ / Ctrl+P）'],
      ['H3C', 'display history-command'],
      ['锐捷', 'show history']
    ],
    tip: '接手别人的设备、或者自己手抖配错了，先看历史命令，比猜快得多。'
  },
  {
    id: 'logout',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '退出登录 / 断开当前会话',
    kw: ['退出', '登出', 'logoff', '断开会话', '关掉终端'],
    cmds: [
      ['华为', '<Huawei> quit'],
      ['思科', 'Router# exit\n或 logout'],
      ['H3C', '<H3C> quit'],
      ['锐捷', 'Router# exit']
    ],
    tip: '设备上 quit 只退一层，return 直接回用户视图。远程调完记得退干净，别把会话挂着。'
  },
  {
    id: 'reboot',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '重启设备',
    kw: ['重启', 'reboot', 'reload', '开关机', '设备卡了'],
    cmds: [
      ['华为', 'reboot\n（提示是否保存时按需选择 y/n）'],
      ['思科', 'reload\n（提示 save? 时按需选择）'],
      ['H3C', 'reboot'],
      ['锐捷', 'reload']
    ],
    tip: '重启前一定先 save，不然配了半天全丢。远程操作时还要确认设备能自己起来（没改过启动文件）。'
  },
  {
    id: 'ping',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: 'ping 测试连通性',
    kw: ['ping', '通不通', '测试连通', '丢包', '基础排查'],
    cmds: [
      ['华为', 'ping 192.168.1.1\nping -c 10 192.168.1.1        # 指定次数'],
      ['思科', 'ping 192.168.1.1\nping 192.168.1.1 repeat 10    # 扩展命令：直接敲 ping 回车按提示填'],
      ['H3C', 'ping 192.168.1.1\nping -c 10 192.168.1.1'],
      ['锐捷', 'ping 192.168.1.1\nping 192.168.1.1 n 10']
    ],
    tip: '思科的扩展 ping 是先敲 `ping` 回车，再一条条填参数；华为 / H3C 是直接跟 `-c`。参数写法完全不通用。'
  },
  {
    id: 'ping-source',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '指定源地址 ping',
    kw: ['源地址ping', '指定源', 'source ping', '用某个接口ping', '回程路由'],
    cmds: [
      ['华为', 'ping -a 192.168.10.1 8.8.8.8'],
      ['思科', 'ping 8.8.8.8 source 192.168.10.1'],
      ['H3C', 'ping -a 192.168.10.1 8.8.8.8'],
      ['锐捷', 'ping 8.8.8.8 source 192.168.10.1']
    ],
    tip: '默认 ping 用的是出接口地址，测业务网段通不通要指定业务网关做源，否则测了个寂寞。'
  },
  {
    id: 'tracert',
    devs: ['Switch', 'Router', 'AC', '防火墙', 'Windows', 'Linux'],
    name: '路由追踪（tracert）',
    kw: ['tracert', 'traceroute', '追踪路由', '在哪一跳断了', '路径'],
    cmds: [
      ['华为', 'tracert 8.8.8.8'],
      ['思科', 'traceroute 8.8.8.8'],
      ['H3C', 'tracert 8.8.8.8'],
      ['锐捷', 'traceroute 8.8.8.8'],
      ['Windows', 'tracert -d 8.8.8.8'],
      ['Linux', 'traceroute -n 8.8.8.8\nmtr 8.8.8.8        # 更好用，持续统计']
    ],
    tip: '中间几跳显示 * 不一定是断，很多设备默认不回 ICMP 超时。重点看从哪一跳开始「之后全不通」。'
  },
  {
    id: 'telnet-out',
    devs: ['Switch', 'Router', 'AC', 'AP', '防火墙'],
    name: '从设备 telnet 到另一台设备',
    kw: ['telnet', '登录别的设备', '跳板', '测端口'],
    cmds: [
      ['华为', 'telnet 192.168.1.1\n（测端口：telnet 192.168.1.1 8080）'],
      ['思科', 'telnet 192.168.1.1\n（老 IOS 测端口用 telnet 192.168.1.1 8080）'],
      ['H3C', 'telnet 192.168.1.1'],
      ['锐捷', 'telnet 192.168.1.1']
    ],
    tip: '站在交换机上 telnet 目标端口，能确认「是网络不通」还是「对方服务没起」，比在电脑上猜快。'
  },
  {
    id: 'term-monitor',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '关闭日志弹屏（敲命令被日志打断）',
    kw: ['日志弹屏', '刷屏', '日志乱跳', 'terminal monitor', 'terminal monitor关掉'],
    cmds: [
      ['华为', 'undo terminal monitor'],
      ['思科', 'terminal no monitor'],
      ['H3C', 'undo terminal monitor'],
      ['锐捷', 'terminal no monitor']
    ],
    tip: '接口一 up/down 日志就跳到光标位置，把正在敲的命令打乱。排障前先在用户视图下关掉，敲完再开回来（undo terminal monitor / terminal monitor）。'
  },
  {
    id: 'startup-config',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '查看下次启动用的配置',
    kw: ['启动配置', 'startup-config', '下次启动', '保存的配置', '重启后生效哪个'],
    cmds: [
      ['华为', 'display startup\ndisplay saved-configuration'],
      ['思科', 'show startup-config'],
      ['H3C', 'display startup\ndisplay saved-configuration'],
      ['锐捷', 'show startup-config']
    ],
    tip: '改完配置没 save，running-config 是新的、startup-config 还是旧的，这时候重启就白干了。'
  },
  {
    id: 'if-desc-list',
    devs: ['Switch', 'Router'],
    name: '查看所有端口描述一览',
    kw: ['端口描述列表', '哪个口接什么', '接口说明', 'interface description'],
    cmds: [
      ['华为', 'display interface description'],
      ['思科', 'show interfaces description'],
      ['H3C', 'display interface description'],
      ['锐捷', 'show interfaces description']
    ],
    tip: '接手一台陌生交换机，这一条命令就能知道每个口大概接的是什么，比挨个查快得多。'
  },
  {
    id: 'route-lookup',
    devs: ['Switch', 'Router', '防火墙'],
    name: '查某个地址走哪条路由',
    kw: ['查路由明细', '这个ip走哪', '路由查找', '最长匹配'],
    cmds: [
      ['华为', 'display ip routing-table 10.1.1.1'],
      ['思科', 'show ip route 10.1.1.1'],
      ['H3C', 'display ip routing-table 10.1.1.1'],
      ['锐捷', 'show ip route 10.1.1.1']
    ],
    tip: '比看整张路由表准：它直接告诉你这个目的地址最终匹配了哪一条，一眼看出是不是被明细路由抢走了。'
  },
  {
    id: 'dhcp-pool-show',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '查看 DHCP 地址池分配情况',
    kw: ['地址池', '分配了多少', 'dhcp binding', '还剩多少地址', '租约'],
    cmds: [
      ['华为', 'display ip pool\ndisplay ip pool name p1 used'],
      ['思科', 'show ip dhcp binding\nshow ip dhcp pool'],
      ['H3C', 'display dhcp server ip-in-use\ndisplay dhcp server pool'],
      ['锐捷', 'show ip dhcp binding']
    ],
    tip: '用户说「拿不到 IP」，先看池子是不是满了（尤其访客网络，手机一多就耗尽）。'
  },
  {
    id: 'config-section',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '只看配置里的某一段',
    kw: ['看某段配置', 'section', '只看ospf配置', '配置片段'],
    cmds: [
      ['华为', 'display current-configuration configuration ospf\ndisplay current-configuration | begin ospf'],
      ['思科', 'show running-config | section ospf\nshow running-config | begin ospf'],
      ['H3C', 'display current-configuration | begin ospf'],
      ['锐捷', 'show running-config | section ospf']
    ],
    tip: '`| section` 只出这一段，`| begin` 从匹配行一直出到结尾。找特定协议配置时省事很多。'
  },
  {
    id: 'tech-support',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '一键收集诊断信息（报障给厂商）',
    kw: ['收集信息', 'show tech', 'diagnostic-information', '报障', '给厂商看', '巡检', '信息收集', '一键收集', '排错信息', '收集日志'],
    cmds: [
      ['华为', 'display diagnostic-information\n!\n! 存成文件（内容极大，直接刷屏刷不完）\ndisplay diagnostic-information > flash:/diag.txt'],
      ['思科', 'show tech-support\n!\nshow tech-support > flash:/tech.txt'],
      ['H3C', 'display diagnostic-information\n!\ndisplay diagnostic-information > flash:/diag.txt'],
      ['锐捷', 'show tech-support']
    ],
    tip: '设备出疑难故障要报厂商，这条命令一次把所有信息打包好，比对方问一句你敲一句快十倍。三个注意：① 一定重定向到文件（> flash:/diag.txt）再下载，直接屏刷会卡控制台；② 采集前先 save 一次，报障时对方第一个问题就是「保存了吗」；③ 敏感环境先脱敏——diagnostic 信息里有完整配置，含密码哈希和 ACL，外发前过一遍。日常排错不用它，针对性 display 更快；这是「交作业」用的全家桶。'
  },
  {
    id: 'exec-timeout',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '命令行空闲超时',
    kw: ['超时', 'exec-timeout', '自动退出', '会话超时', '安全加固'],
    cmds: [
      ['华为', 'user-interface vty 0 4\n idle-timeout 5 0'],
      ['思科', 'line vty 0 4\n exec-timeout 5 0'],
      ['H3C', 'line vty 0 4\n idle-timeout 5 0'],
      ['锐捷', 'line vty 0 4\n exec-timeout 5 0']
    ],
    tip: '默认 10 分钟不动就断。改成 0 0 是永不超时，方便但很危险——人走了会话还挂在特权模式。'
  },
  {
    id: 'pwd-policy',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '密码复杂度与登录锁定',
    kw: ['改设备密码', '设备密码怎么改', '改密码', '密码复杂度', '弱口令', '登录失败锁定', '设置密码', '改密码', '密码策略', '安全加固', '等保'],
    cmds: [
      ['华为', 'aaa\n local-user admin password irreversible-cipher Admin@12345\nlocal-aaa-user password policy administrator\n password complexity-check enable\n password expire 90'],
      ['思科', 'aaa new-model\nsecurity passwords min-length 10\nlogin block-for 120 attempts 3 within 60'],
      ['H3C', 'password-control enable\npassword-control length 10\npassword-control login-attempt 3 exceed lock-time 120'],
      ['锐捷', 'security passwords min-length 10\nlogin block-for 120 attempts 3 within 60']
    ],
    tip: '等保测评基本都要查这条：密码长度、复杂度、90 天过期、失败锁定。提前配好省得整改。'
  },
  {
    id: 'https-only',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '关闭 HTTP，只留 HTTPS',
    kw: ['https', '关闭http', 'web管理', '安全加固', '证书'],
    cmds: [
      ['华为', 'undo http server enable\nhttp secure-server enable'],
      ['思科', 'no ip http server\nip http secure-server'],
      ['H3C', 'undo ip http enable\nip https enable'],
      ['锐捷', 'no ip http server\nip http secure-server']
    ],
    tip: 'HTTP 是明文传密码，扫描器一扫就报高危。只留 HTTPS，再配个证书。'
  },
  {
    id: 'snmp-v3',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: 'SNMP v3（加密认证）',
    kw: ['snmp v3', 'snmpv3', '安全snmp', '加密网管', '等保snmp'],
    cmds: [
      ['华为', 'snmp-agent\nsnmp-agent group v3 mon group privacy write-view iso view iso\nsnmp-agent usm-user v3 mon group mon\nsnmp-agent usm-user v3 mon authentication-mode sha cipher Auth@123\nsnmp-agent usm-user v3 mon privacy-mode aes128 cipher Priv@123'],
      ['思科', 'snmp-server group mon v3 priv\nsnmp-server user mon mon v3 auth sha Auth@123 priv aes 128 Priv@123'],
      ['H3C', 'snmp-agent\nsnmp-agent group v3 mon privacy\nsnmp-agent usm-user v3 mon mon authentication-mode sha Auth@123 privacy-mode aes128 Priv@123'],
      ['锐捷', 'snmp-server group mon v3 priv\nsnmp-server user mon mon v3 auth sha Auth@123 priv aes 128 Priv@123']
    ],
    tip: 'v2c 的团体名是明文传输，等保要求用 v3。配完记得在网管平台上同步改，否则采集直接断。'
  },
  {
    id: 'alarm',
    devs: ['Switch', 'Router', '防火墙'],
    name: '查看当前告警',
    kw: ['告警', 'alarm', '当前告警', '设备报警', '红灯'],
    cmds: [
      ['华为', 'display alarm active\ndisplay alarm history'],
      ['思科', 'show logging | include CRITICAL\nshow environment all'],
      ['H3C', 'display alarm\ndisplay alarm history'],
      ['锐捷', 'show alarm']
    ],
    tip: '设备面板红灯但业务正常，先看这条确认是电源、风扇还是温度告警，别直接重启。'
  },
  {
    id: 'ntp-status',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '查看 NTP 同步状态',
    kw: ['ntp状态', '时间同步成功没', '时钟同步', 'ntp不同步'],
    cmds: [
      ['华为', 'display ntp-service status\ndisplay ntp-service sessions'],
      ['思科', 'show ntp status\nshow ntp associations'],
      ['H3C', 'display ntp-service status\ndisplay ntp-service sessions'],
      ['锐捷', 'show ntp status']
    ],
    tip: '配了 NTP 不代表同步上了。`show ntp status` 里要看到 `synchronized` 才算成功，否则查 ACL 和可达性。'
  },
  {
    id: 'log-level',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '调整日志级别',
    kw: ['日志级别', 'log level', '日志太少', 'debug日志', '日志太多'],
    cmds: [
      ['华为', 'info-center console channel console\ninfo-center source default channel console log level warning'],
      ['思科', 'logging console warnings\nlogging buffered 40960 debugging'],
      ['H3C', 'info-center source default console level warning'],
      ['锐捷', 'logging console warnings']
    ],
    tip: '级别越低记录越多：emergency < alert < critical < error < warning < notice < info < debug。调到 debug 会把 CPU 拖垮，用完立刻调回来。'
  },
  {
    id: 'config-diff',
    devs: ['Switch', 'Router', 'AC', '防火墙'],
    name: '对比配置差异（改前改后）',
    kw: ['配置对比', 'diff', '改了哪里', '配置差异', '变更核对'],
    cmds: [
      ['华为', 'compare configuration\ndisplay current-configuration | include ospf'],
      ['思科', 'show archive config differences\nshow running-config | include ospf'],
      ['H3C', 'display current-configuration | include ospf\ndisplay current-configuration | begin ospf'],
      ['锐捷', 'show running-config | include ospf']
    ],
    tip: '华为的 compare configuration 直接比「当前配置 vs 下次启动配置」，改完还没保存时最好用；思科要先把 archive 路径配好，否则 show archive config differences 没输出。老设备都没有 diff，只能存两份文本自己比。'
  },
  {
    id: 'ping-sweep',
    devs: ['Switch', 'Router'],
    name: '批量测多个地址（巡检）',
    kw: ['批量ping', '巡检', '测一堆地址', 'sweep'],
    cmds: [
      ['华为', 'ping -c 4 192.168.1.1\n（华为无批量命令，可写脚本或用 NQA）'],
      ['思科', '（无批量命令，用 TCL 脚本或 EEM）\ntclsh\n foreach ip {192.168.1.1 192.168.1.2} { ping $ip }'],
      ['H3C', 'ping -c 4 192.168.1.1'],
      ['锐捷', 'ping -c 4 192.168.1.1']
    ],
    tip: '要批量巡检建议上 NMS 或被管平台，手工一条条 ping 只能应急。'
  }
];

module.exports = { BASIC_EXTRA };
