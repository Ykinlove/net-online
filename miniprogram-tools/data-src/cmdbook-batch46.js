// 第 46 批：可观测性与接入安全（NTP / SNMP / 日志 / 镜像 / 流量采集 / 管理面加固 / AAA / DHCP Snooping / 端口安全 / 链路聚合）

const BATCH46_EXTRA = [
  {
    id: 'ntp-sync',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: 'NTP 时间同步（最容易被忽略的地基）',
    kw: ['ntp', '时间同步', '时钟', '时间不一致', '时间不对', '同步时间', 'ntp server', '时间不准', '时间对不上', '时钟不同步', 'ntp 同步不上', '时间差', '校时'],
    cmds: [
      ['华为 / H3C 配置',
        'clock timezone BJ add 08:00:00          # 先设时区，否则时间差 8 小时\nntp-service enable\nntp-service unicast-server 10.1.1.10     # 指向内网时钟源\nntp-service source-interface Vlanif10    # 指定出口，多出口必配\n# 验证\ndisplay ntp-service status               # clock status: synchronized 才算成功\ndisplay ntp-service sessions             # 看 stratum 和 offset'],
      ['思科配置',
        'clock timezone BJ 8\nntp server 10.1.1.10\nntp source Vlanif10\n# 验证\nshow ntp status                          # 看 stratum，16 = 未同步\nshow ntp associations                    # 前面带 * 的是当前同步源\nshow clock detail'],
      ['时间不对会引发什么故障',
        '① HTTPS / SSH 证书校验失败（提示「证书尚未生效」或「已过期」）\n② 日志时间错乱，多设备对齐分析失效，排障直接失去时间线\n③ 双机热备 / 堆叠心跳超时误判，莫名主备切换\n④ 等保测评、安全审计直接不通过\n⑤ 数据库主从、Kerberos 认证失败\n# 这些都是「看起来跟网络无关」的故障源头'],
      ['排障：同步不上怎么查',
        '① stratum 显示 16 = 没同步上，先确认时钟源本身是同步状态\n② ping 不通就查 ACL：UDP 123 必须双向放行\n③ ntp-service access 限制过严会拒绝，先临时放宽验证\n④ 设备时间偏差太大（超过 1000 秒）会被 NTP 判定为异常而拒绝\n   → 先手动 clock datetime 大致调准，再等同步\n⑤ 防火墙做 NAT 时注意 NTP 的源地址是否被改写\n⑥ VRF 内的设备要单独指定 VRF 出口，否则报文出不去'],
      ['现网落地建议',
        '① 核心交换机做内网 NTP Server，其余设备全部指向核心，不要全指公网\n② 核心自己指向企业时钟源或运营商 NTP，配 2 个以上备用\n③ 服务器、摄像头、门禁、AP 全部纳入同步范围\n④ 定期巡检 display ntp-service status，把「未同步」做进监控告警\n# 一台设备时间不准是小事，全网时间不一致是事故']
    ],
    tip: '排障时如果发现日志时间线和现象对不上，第一件事就该查 NTP。「时钟不准」是所有排障里最容易漏掉、又最致命的干扰项。'
  },
  {
    id: 'snmp-collect',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: 'SNMP 与网管采集（监控平台的数据来源）',
    kw: ['snmp', '网管', 'mib', 'oid', 'snmpwalk', 'trap', '监控平台', '采集', 'zabbix', '网管采不到', '采不到数据', '监控没数据', '接口流量 oid', 'snmp 配'],
    cmds: [
      ['华为 / H3C 配置',
        'snmp-agent\nsnmp-agent sys-info version v3            # 生产环境只开 v3\nsnmp-agent sys-info contact IT-zhangsan\nsnmp-agent sys-info location "IDC-A-3F"\nsnmp-agent group v3 monitor privacy read-view iso write-view iso\nsnmp-agent usm-user v3 monitor group monitor\nsnmp-agent usm-user v3 monitor authentication-mode sha2-256\nsnmp-agent usm-user v3 monitor privacy-mode aes128\n# Trap 上送\nsnmp-agent target-host trap address udp-domain 10.1.1.20 params securityname monitor v3 privacy\nsnmp-agent trap enable'],
      ['思科配置',
        'snmp-server community Nms2024Ro RO 10          # v2c + ACL 限制源\nsnmp-server host 10.1.1.20 version 3 priv monitor\nsnmp-server enable traps\nsnmp-server source-interface traps Vlanif10\n# 验证\nshow snmp\nshow snmp user\nshow snmp host'],
      ['命令行验证（最直接）',
        'snmpwalk -v2c -c Nms2024Ro 10.1.1.1 1.3.6.1.2.1.1.5     # 设备名\nsnmpwalk -v3 -l authPriv -u monitor -a SHA -A authpass \\\n  -x AES -X privpass 10.1.1.1 1.3.6.1.2.1.2.2.1.8        # 接口状态\n# 拿到数就说明设备侧没问题，问题在平台侧'],
      ['最常用的几个 OID',
        '1.3.6.1.2.1.1.5.0       sysName        设备名\n1.3.6.1.2.1.1.3.0       sysUpTime      运行时长\n1.3.6.1.2.1.2.2.1.8     ifOperStatus   接口 up/down\n1.3.6.1.2.1.2.2.1.10    ifInOctets     入向字节数\n1.3.6.1.2.1.2.2.1.16    ifOutOctets    出向字节数\n1.3.6.1.2.1.31.1.1.1.15 ifHighSpeed    接口速率\n1.3.6.1.4.1.2011.x      华为私有（CPU/内存/温度）'],
      ['采不到数怎么查',
        '① 设备侧 snmp-agent 没开，或 group 没绑 MIB view\n② ACL 把网管服务器挡了（snmp-agent acl 或接口 ACL 双向查）\n③ v3 的认证/加密算法平台不支持（很多老平台只认 MD5/DES）\n④ Trap 出去了但网管收不到：路由不可达 / 端口 162 被封\n⑤ 接口流量靠计数器差值算，采集周期内设备重启会算出负数\n# 先用 snmpwalk 直连测，能通就是平台配置问题'],
      ['安全红线',
        '① v2c 的 community 是明文，wireshark 一抓就有 → 生产只用 v3\n② 一定带 ACL 限制只允许网管网段\n③ 只读权限就够监控，不要给 write（等于把设备交给平台）\n④ 别用 public / private，扫描器字典第一个试的就是它\n# 见过太多设备因为 SNMP 弱口令被当成跳板']
    ],
    tip: '「监控没数据」90% 不是设备坏了，而是 ACL、算法版本、MIB view 三件事。先 snmpwalk 直连，把设备和平台的责任划分清楚，再往下查能省一半时间。'
  },
  {
    id: 'syslog-server',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: 'Syslog 日志上送与级别管理',
    kw: ['syslog', '日志服务器', '日志上送', 'info-center', '日志级别', '日志丢失', '日志保留', '日志传到服务器', '日志怎么上送', '告警日志丢了', '日志不上报'],
    cmds: [
      ['华为 / H3C 配置',
        'info-center enable\ninfo-center loghost 10.1.1.20            # 默认 UDP 514\ninfo-center loghost 10.1.1.20 channel 2 loglevel warning\ninfo-center source default channel loghost log level informational\ninfo-center timestamp log date precision-time millisecond\n# 验证\ndisplay info-center\ndisplay logbuffer | include ERROR'],
      ['思科配置',
        'logging host 10.1.1.20\nlogging trap informational\nlogging source-interface Vlanif10\nlogging facility local6\nservice timestamps log datetime msec localtime show-timezone\n# 验证\nshow logging\nshow logging | include Trap'],
      ['日志级别（0 最严重）',
        '0 emergencies   系统不可用（设备要挂了）\n1 alerts        需要立刻处理\n2 critical      严重错误\n3 errors        错误\n4 warnings      警告   ← 建议上送起点\n5 notifications 通知   ← 接口 up/down 在这里\n6 informational 常规信息\n7 debugging     调试   ← 别上送，会淹掉有用的\n# 级别数字越大越不严重，配 loglevel 时别搞反'],
      ['日志丢失的四个原因',
        '① 设备侧限速：华为 info-center rate-limit，思科 logging rate-limit\n   → 突发大量日志被丢弃，现象是「日志断档」\n② 本地缓冲区太小，老日志被覆盖：info-center logbuffer size 1024\n③ UDP 514 不重传、不保证顺序，网络抖动就丢\n   → 重要设备可考虑 TCP 或 TLS（RFC 5425）\n④ 磁盘满了，syslog 服务静默停止写入（最隐蔽）\n# 排查顺序：抓包看设备到底发了没有 → 再看服务器收没收到'],
      ['落地要求',
        '① 所有网络设备、安全设备、服务器统一上送，日志必须集中\n② 时间戳带毫秒 + 时区，且必须配 NTP（否则跨设备对不上）\n③ 保留 ≥ 6 个月（等保要求，具体看行业规定）\n④ 接口 up/down 这类频繁日志可以单独降级，避免掩盖真正的告警\n⑤ 上送失败的设备要做监控，日志断了等于瞎了']
    ],
    tip: '日志的价值在于「事后能还原现场」。判断标准很简单：出故障时能不能只看日志就把时间线画出来。画不出来，说明日志方案没做对。'
  },
  {
    id: 'span-mirror',
    devs: ['Switch', 'Router', '防火墙'],
    name: '端口镜像（SPAN / RSPAN / 远程抓包）',
    kw: ['端口镜像', 'span', '镜像口', '抓包口', 'rspan', 'erspan', '流量复制', '交换机抓包', '设备抓包', '没有空闲口抓包', '一台设备能不能抓包', '本地抓包', '镜像配置'],
    cmds: [
      ['华为 / H3C 配置',
        'observe-port 1 interface GigabitEthernet0/0/24      # 定义镜像目的地\n# 进入源端口\ninterface GigabitEthernet0/0/1\n port-mirroring to observe-port 1 both                # inbound / outbound / both\n# 一个 observe-port 可挂多个源端口（端口数有限制）\n# 验证\ndisplay observe-port 1\ndisplay port-mirroring'],
      ['思科配置',
        'monitor session 1 source interface Gi0/1 both\nmonitor session 1 destination interface Gi0/24\n# 多个源口\nmonitor session 1 source interface Gi0/1 - 5 both\n# 验证\nshow monitor session 1'],
      ['远程镜像（跨交换机抓包）',
        'RSPAN（二层，需专门 VLAN）\n思科：vlan 999 / remote-span → 源交换机 monitor session 1 remote-source\n     目的交换机 monitor session 1 remote-destination\nERSPAN（三层，GRE 封装，跨网段）\n思科：monitor session 1 type erspan-source\n     destination erspan-id 1 ip address 10.1.1.50 origin ip address 10.1.1.1\n# 华为叫「远程镜像」或 port-mirroring to observe-port 1 vlan 999'],
      ['交换机本地抓包（不占用额外端口）',
        '华为：capture-packet interface GigabitEthernet0/0/1 destination file cap.cap\n      capture-packet interface GigabitEthernet0/0/1 acl 3000 ...\n# 抓完文件需要导出到 tftp/ftp 才能用 wireshark 打开\n# 优点：现场没笔记本、没空闲口时的救急手段\n# 注意：抓包会占用 CPU，生产设备务必加 ACL 过滤 + 限制包数'],
      ['镜像的五个坑',
        '① 镜像目的端口不能再转发业务，配了就当专用口\n② 镜像会把流量放大：源口 1G 双向 = 目的口最多 2G，会丢包\n   → 抓包不完整时先查是不是镜像口带宽不够\n③ 一个目的口挂太多源口，超带宽后镜像流量被静默丢弃\n④ 镜像不带原端口的时间戳精度，纳秒级分析做不了（需专用 TAP）\n⑤ 有些型号 CPU 镜像和芯片镜像能力不同，全量镜像需专用硬件'],
      ['什么时候必须用 TAP 而不是镜像',
        '① 需要抓满带宽（金融、存储、视频业务）\n② 需要抓物理层错误帧（CRC 错、前导码异常）\n③ 镜像后设备性能明显下降（老设备芯片能力弱）\n④ 需要绝对不丢包取证\n# 光口用分光器，电口用 TAP，都是「物理旁路」，对业务零影响']
    ],
    tip: '镜像抓包最常见的问题是「抓不全」，而不是「抓不到」。看到丢包先算带宽：源口速率 × 方向数 > 目的口速率，就是镜像口撑爆了，跟业务无关。'
  },
  {
    id: 'netflow',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'NetFlow / sFlow / IPFIX 流量采集',
    kw: ['netflow', 'sflow', 'ipfix', '流量分析', '流量采集', '谁占带宽', '流量成分', '什么业务', '业务组成', '流量都是什么', '带宽被谁占了'],
    cmds: [
      ['思科 NetFlow',
        'interface GigabitEthernet0/0/1\n ip flow ingress                      # 建议只采入向，避免重复计数\n ip flow egress\nip flow-export destination 10.1.1.30 2055\nip flow-export version 9\nip flow-export source GigabitEthernet0/0/2\n# 验证\nshow ip cache flow\nshow ip flow export'],
      ['华为 NetStream',
        'interface GigabitEthernet0/0/1\n ip netstream inbound\n ip netstream outbound\nip netstream export source 10.1.1.1\nip netstream export host 10.1.1.30 2055\nip netstream export version 9\n# 验证\ndisplay ip netstream cache\ndisplay ip netstream export statistics'],
      ['sFlow（采样，开销更小）',
        '华为 / H3C：sflow agent ip 10.1.1.1\n           sflow collector 1 ip 10.1.1.30 6343\n           interface GE0/0/1 下 sflow sampling-rate 1000\n思科：ip flow-export destination / 或用 sFlow 代理\n# 采样率 1:1000 适合骨干，边缘链路用 1:100~1:200'],
      ['三种技术怎么选',
        'NetFlow / IPFIX：全量统计，精度高，吃 CPU 和带宽\n   → 出口、核心链路、需要精确计费的场景\nsFlow：固定采样，开销极低，精度取决于采样率\n   → 高带宽骨干、汇聚层大规模部署\nSNMP 计数器：只看总量，不知道「谁」\n   → 只做趋势和容量规划\n# 要回答「谁占满带宽」必须用 Flow，SNMP 永远答不上来'],
      ['典型分析视角',
        '① Top Talkers：按源/目的 IP 排序，找带宽大户\n② Top Conversations：按五元组聚合，找会话对\n③ 协议分布：看是不是扫描、P2P、备份任务\n④ 端口分布：443 占 80% 是正常，8000 突然暴涨要查\n⑤ 方向判断：入向远大于出向 = 有人在下载（内网往外拉）'],
      ['部署注意',
        '① 采集口和业务口分开，别让 Flow 报文抢业务带宽\n② 出口路由器双向都采会出现重复统计，只采 ingress\n③ 采样率太高（如 1:10000）会漏掉大象流之外的所有信息\n④ Flow 数据量很大，分析平台存储要做容量规划\n⑤ 开了 Flow 后设备 CPU 上升明显，高峰前要压测']
    ],
    tip: '「带宽被占满」这类故障，SNMP 只能告诉你水满了，Flow 才能告诉你谁在放水。出口和核心链路不开 Flow，等于排障时少一只眼。'
  },
  {
    id: 'mgmt-harden',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: '设备管理面加固（SSH / VTY / 登录限制）',
    kw: ['管理面加固', 'ssh', 'telnet 关闭', 'vty', '登录限制', '账号安全', '远程登录', '弱口令', '登录不安全', '关掉 telnet', '只让内网登录', '运维网段登录', '禁止 telnet'],
    cmds: [
      ['华为 / H3C 配置',
        'stelnet server enable\ntelnet server disable                    # 第一件事：关掉 telnet\nssh server-source -i Vlanif10\n# 账号\naaa\n local-user netadmin password irreversible-cipher Xxxx@2024\n local-user netadmin privilege level 15\n local-user netadmin service-type ssh\n quit\n# VTY 只允许 SSH + AAA 认证\nuser-interface vty 0 4\n authentication-mode aaa\n protocol inbound ssh                    # 关键，限制只有 ssh\n idle-timeout 10 0\n# 源 IP 限制\nacl 2000\n rule 5 permit source 10.1.8.0 0.0.0.255\n rule 100 deny\n quit\nuser-interface vty 0 4\n acl 2000 inbound'],
      ['思科配置',
        'ip ssh version 2\ncrypto key generate rsa modulus 2048\nline vty 0 4\n transport input ssh                    # 只留 ssh\n login local\n exec-timeout 10 0\n access-class 10 in\n privilege level 15\nip access-list standard 10\n permit 10.1.8.0 0.0.0.255\n deny any log\n# 关掉 http / 无用的服务\nno ip http server\nno ip http secure-server\nno service pad\nno ip finger'],
      ['必做的六件事',
        '① 关闭 telnet、HTTP、FTP、TFTP、finger 等明文服务\n② SSH 只留 v2，RSA 密钥 ≥ 2048 位\n③ VTY 绑定 ACL，只允许运维网段访问（这是性价比最高的一条）\n④ 账号密码走 AAA 集中认证，本地只留 1-2 个应急账号\n⑤ 配 exec-timeout / idle-timeout，避免会话挂着不锁\n⑥ 关闭并发登录数上限：配置 login 最大会话数，防止爆破'],
      ['防爆破',
        '华为：aaa\n       local-aaa-server\n       lock-authentication failed-times 5 observe-period 5 minute\n思科：login block-for 300 attempts 5 within 60\n# 5 分钟内错 5 次锁 5 分钟，这个能挡掉绝大多数脚本爆破\n# 注意：别把自己也锁在外面，配之前确认有 Console 或带外通道'],
      ['上线前自查',
        'show running-config | include (telnet|http|snmp|vty|ssh)\ndisplay current-configuration | include (telnet|http|snmp|vty|stelnet)\n# 逐项确认：没有 telnet、没有默认 community、vty 有 ACL、有超时\n# 这一步花 5 分钟，能挡掉测评里一半的高危项']
    ],
    tip: '管理面加固里性价比最高的两条：关掉 telnet，给 VTY 绑 ACL。这两条几乎零成本，却能挡掉绝大部分扫描和爆破。密码复杂度反而排在后面。'
  },
  {
    id: 'aaa-admin',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'AAA 集中认证（RADIUS / TACACS+ 管设备）',
    kw: ['aaa', 'radius', 'tacacs+', '认证服务器', '统一认证', '账号集中管理', 'acs', 'ise', '账号统一', '认证服务器挂了', '登不进设备', '集中认证', '对接 radius'],
    cmds: [
      ['华为 RADIUS 对接',
        'radius-server template RD1\n radius-server shared-key cipher Shared@2024\n radius-server authentication 10.1.1.40 1812\n radius-server accounting 10.1.1.40 1813\n radius-server retransmit 2\n quit\naaa\n authentication-scheme SCH1\n  authentication-mode radius local        # 关键：local 做兜底\n  accounting-mode radius\n  authentication-mode radius local\n quit\n domain default\n  authentication-scheme SCH1\n  radius-server RD1\n quit\n# 验证\ndisplay radius-server template RD1\ndisplay aaa'],
      ['思科 TACACS+ 对接',
        'tacacs server TAC1\n address ipv4 10.1.1.40\n key Shared@2024\naaa new-model\naaa group server tacacs+ TACGRP\n server name TAC1\naaa authentication login default group TACGRP local\naaa authorization exec default group TACGRP local\naaa accounting exec default start-stop group TACGRP\nline vty 0 4\n login authentication default\n# 最后那个 local 就是本地兜底，千万别漏'],
      ['RADIUS 还是 TACACS+',
        'TACACS+：TCP 49，整包加密，命令级授权（能控制某用户只能执行 display）\n   → 管网络设备首选\nRADIUS：UDP 1812/1813，只加密密码，授权粒度粗（只到权限等级）\n   → 802.1X 接入认证、VPN 认证首选\n# 很多环境两者并存：设备管理用 TACACS+，终端接入用 RADIUS'],
      ['认证不通怎么查',
        '① 共享密钥不一致（最常见，注意两端有没有多余空格）\n② 服务器侧没把设备 IP 加进 NAS 白名单\n③ 设备到服务器 UDP/TCP 端口不通，或走了错误的源地址\n   → radius-server source-interface / ip tacacs source-interface\n④ 用户名带了域名后缀（user@domain），服务器不认\n⑤ 授权阶段失败：认证过了但没权限，看服务器上有没有配 shell profile\n# 用 test-aaa 命令直接打一发，能定位是链路问题还是配置问题\n华为：test-aaa user pass radius-template RD1'],
      ['必须留的后路',
        '① 本地一定要有 1-2 个应急账号，且权限最高\n② 认证服务器双机或至少本地缓存（cached 授权）\n③ 上线前先开新会话验证，别把当前会话踢掉\n④ 改 AAA 前确认有 Console 或带外可进\n# 认证服务器挂了导致全网设备进不去，是运维最狼狈的场景之一']
    ],
    tip: '「authentication-mode radius local」最后那个 local 是保命符。无数事故都是因为只写了 radius，服务器一挂，全网设备集体失联。'
  },
  {
    id: 'dhcp-snooping',
    devs: ['Switch'],
    name: 'DHCP Snooping 与 Option 82',
    kw: ['配置dhcp snooping', 'dhcp snooping配置', 'dhcp snooping', 'option 82', '私接 dhcp', 'dhcp 欺骗', '信任端口', '拿不到地址', '开了 snooping 上不了网', '获取不到 ip', '一直正在获取地址'],
    cmds: [
      ['华为 / H3C 配置',
        'dhcp enable\ndhcp snooping enable                              # 全局开\nvlan 10\n dhcp snooping enable                             # 按 VLAN 开\n# 关键：上联口必须是信任口，否则 DHCP 报文全被丢\ninterface GigabitEthernet0/0/24\n dhcp snooping trusted\n# 用户口保持非信任（默认就是非信任）\n# Option 82：把端口/VLAN 信息带给服务器，便于定位和分配\n dhcp option82 insert enable\n dhcp option82 circuit-id format type3'],
      ['思科配置',
        'ip dhcp snooping\nip dhcp snooping vlan 10\nno ip dhcp snooping information option          # 视服务器支持情况\ninterface GigabitEthernet0/24\n ip dhcp snooping trust\ninterface range GigabitEthernet0/1 - 20\n ip dhcp snooping limit rate 10               # 防 DHCP 洪泛\n# 验证\nshow ip dhcp snooping\nshow ip dhcp snooping binding'],
      ['开了之后用户拿不到地址（第一高频故障）',
        '① 上联口没配 trusted → 服务器的 OFFER 被丢弃\n② DHCP 中继场景：中继口也要 trusted\n③ 无线场景：AP 上联口、AC 侧都要确认信任关系\n④ 跨交换机时每一跳的上联口都要配，漏一个就断一片\n# 现象：用户一直「正在获取 IP 地址」，抓包能看到 DISCOVER 但没 OFFER'],
      ['Option 82 带来的坑',
        '① 服务器不认 Option 82 会直接丢包（很多老 DHCP 服务器这样）\n   → 华为可配 dhcp option82 disable 或让服务器忽略\n② 中继设备重复插入 82 导致报文异常\n③ 换端口后 IP 变了：服务器按 circuit-id 分配，端口换了就是新地址\n④ 排障时抓包看 Option 82 内容，能直接定位用户接在哪个口'],
      ['典型价值',
        '① 防私接路由器：非信任口的 DHCP 服务器报文被丢弃，全网只有一台合法 DHCP\n② 防 DHCP 地址池耗尽攻击：limit rate 挡住洪泛\n③ 精确定位：靠 circuit-id 知道某个 IP 从哪个交换机哪个口来\n④ 配合 IP Source Guard 形成完整的接入安全链']
    ],
    tip: 'DHCP Snooping 装上后断网，十有八九是上联口忘了 trusted。记住一句话：所有通往合法 DHCP 服务器的方向，都要是信任口。'
  },
  {
    id: 'port-security',
    devs: ['Switch'],
    name: '端口安全 / IP Source Guard / DAI（防私接与防欺骗）',
    kw: ['端口安全', 'ip source guard', 'dai', 'arp 欺骗', '私接路由器', 'mac 限制', '防私接', '冒用 ip', '偷用 ip', '盗用地址', '防私接设备', '防 arp 攻击'],
    cmds: [
      ['华为 / H3C',
        'interface GigabitEthernet0/0/1\n port-security enable\n port-security max-mac-num 2                    # 只允许 2 个 MAC\n port-security protect-action restrict          # 超限丢弃并告警\n port-security aging-time 10\n# IP Source Guard：绑定表校验源 IP\nip source check user-bind enable\n# DAI：动态 ARP 检测\narp anti-attack check user-bind enable\n# 静态绑定（关键设备）\nuser-bind static ip-address 10.1.10.20 mac-address 0011-2233-4455 interface GE0/0/1 vlan 10'],
      ['思科',
        'interface GigabitEthernet0/1\n switchport port-security\n switchport port-security maximum 2\n switchport port-security mac-address sticky\n switchport port-security violation restrict\n switchport port-security aging time 10\n# IP Source Guard\nip verify source port-security\n# DAI\nip arp inspection vlan 10\ninterface GigabitEthernet0/24\n ip arp inspection trust                      # 上联口信任\n# 验证\nshow port-security interface Gi0/1\nshow ip verify source\nshow ip arp inspection statistics'],
      ['三种技术各管什么',
        '端口安全：限制「一个口能学几个 MAC」→ 防私接交换机、路由器\nIP Source Guard：限制「源 IP 必须是绑定过的」→ 防冒用 IP\nDAI：校验 ARP 报文是否与绑定表一致 → 防 ARP 欺骗、中间人\n# 三者都依赖同一张绑定表（DHCP Snooping 动态学习或静态配置）\n# 所以顺序是：先 DHCP Snooping，再上这三个'],
      ['最容易踩的坑',
        '① 上联口忘了 ip arp inspection trust，全 VLAN ARP 不通\n② 静态 IP 的设备（服务器、打印机、摄像头）没绑定就上 Guard，直接不通\n③ 员工换网线口（换端口）后绑定失效，表现为「昨天好好的今天上不了网」\n④ 虚拟化环境一台物理口跑几十个 MAC，max-mac-num 要放宽\n⑤ 无线 AP 下挂大量终端，别在 AP 上联口做 MAC 数量限制'],
      ['部署建议',
        '① 办公区、宿舍、考场这类「人可控但设备不可控」的场景必上\n② 数据中心、服务器区慎用，MAC 数量大且变化频繁\n③ 先用 monitor 模式观察一周，看会误杀哪些正常终端，再改 restrict\n④ 违规动作优先选 restrict（丢弃+告警），别一上来就 shutdown\n⑤ 把违规日志接入监控，能看到谁在私接设备']
    ],
    tip: '这类功能最怕「一次性全网推开」。先在一个楼层开 monitor 观察，把服务器、打印机、虚拟化宿主机的绑定补全，再逐步收紧——否则第二天全网报障。'
  },
  {
    id: 'lacp-trouble',
    devs: ['Switch', 'Router', '服务器'],
    name: '链路聚合（LACP / Eth-Trunk）不 UP 排障',
    kw: ['链路聚合', 'lacp', 'eth-trunk', 'port-channel', '聚合不 up', '捆绑', '双网卡', '捆一起', '两条线绑一起', '聚合起不来', '双线不加速', '捆了还是慢'],
    cmds: [
      ['华为 / H3C 配置',
        'interface Eth-Trunk 1\n mode lacp-static                              # 推荐，别用 manual\n load-balance src-dst-ip\n quit\ninterface GigabitEthernet0/0/1\n eth-trunk 1\n# 批量加成员\ninterface range GigabitEthernet0/0/1 to 0/0/4\n eth-trunk 1\n# 验证\ndisplay eth-trunk 1\ndisplay lacp peer'],
      ['思科配置',
        'interface range Gi0/1 - 4\n channel-group 1 mode active                   # active=主动协商\n# 或 mode desirable（PAgP，思科私有，不推荐）\n# 验证\nshow etherchannel summary                     # 看 (SU) 才正常\nshow etherchannel 1 port-channel\nshow lacp neighbor'],
      ['状态不对怎么看',
        'display eth-trunk 1 关注两列\n  Status：Up / Down\n  Weight / Selected：只有 Selected 的成员口才转发流量\nshow etherchannel summary 的标记\n  (SU) 正常    (SD) down    (P) 在捆绑中但未选上\n  (I) 独立（配置不一致，被踢出聚合）\n# 看到 (I) 基本就是成员口配置不一致'],
      ['配了不 UP 的六个原因',
        '① 两端模式不匹配：一端 lacp-static 一端 manual → 永远协商不上\n② 成员口速率/双工不一致：一个千兆一个百兆，不能捆在一起\n③ 成员口上有独立配置（VLAN、ACL、QoS、STP 端口参数）不一致\n   → 加入聚合前先把成员口的独立配置清干净\n④ 光模块/线路问题：物理层没 up，聚合当然起不来\n⑤ 跨设备聚合没做堆叠或 M-LAG → 普通聚合不能跨两台设备\n⑥ 一端是服务器 bond，模式不匹配（balance-rr vs 802.3ad）'],
      ['负载不均与注意事项',
        '① 默认哈希是 src-dst-mac 或 src-dst-ip，大流量单会话只走一条链路\n   → 「捆了 4 条还是慢」通常是哈希问题，不是聚合没生效\n② 可选哈希：src-ip / dst-ip / src-dst-ip / src-port / dst-port\n③ 跨设备聚合用 M-LAG / vPC / IRF，普通聚合做不到\n④ 聚合口上做 STP 要特别注意，成员口不能单独参与生成树\n⑤ 服务器侧 bond 模式要和交换机侧匹配：802.3ad 对 lacp\n# 验证负载是否均衡：看每个成员口的接口计数，而不是只看总流量']
    ],
    tip: '「聚合了但速度没起来」八成不是聚合失败，而是哈希把一条流固定在一个成员口上。用 iperf 单流测速永远是 1G，多流才能跑到 4G——别拿单流结论去怀疑聚合。'
  }
];

module.exports = { BATCH46_EXTRA };
