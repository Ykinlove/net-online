/* 配置模板库：开局 / 排障直接套的片段。
   占位符统一用 <尖括号>，复制粘贴后设备上会留着显眼的 <XXX>，提醒你替换；
   cleanCmd 只清中文注释行，<占位符> 在命令行上不会被清掉。 */
const TPLS = [
  /* ============ 开局模板 ============ */
  {
    id: 'tpl-switch-base',
    kw: ['交换机开局', '新设备开局', '开局配置', '设备上架配置'],
    cat: '开局模板',
    name: '新交换机开局标准模板',
    vendor: '华为 VRP8',
    code: '! 1. 命名与时钟\nsysname <SW-NAME>\nclock timezone GMT+08:00 00:00\nntp-service unicast-server <NTP-IP>\n!\n! 2. 管理 VLAN 与地址\nvlan batch <MGMT-VLAN>\ninterface Vlanif<MGMT-VLAN>\n ip address <MGMT-IP> <MASK>\n!\n! 3. 本地账号兜底（radius 挂了也能进）\naaa\n local-user admin password cipher <PASSWORD>\n local-user admin privilege level 15\n local-user admin service-type ssh telnet terminal\n!\n! 4. SSH 服务\nstelnet server enable\nssh user admin authentication-type password\nrsa local-key-pair create\n!\n! 5. 保存\nsave',
    note: '五件套一次配全：命名（角色-位置-编号）、时钟 NTP（日志时间线靠它）、管理地址（固定段别用 DHCP）、本地账号兜底、SSH。上线前 save 并归档基线。'
  },
  {
    id: 'tpl-vlan-if',
    kw: ['vlanif', 'vlan网关', '三层交换vlan', '网关配置'],
    cat: '开局模板',
    name: '三层交换机 VLAN 间路由模板',
    vendor: '华为 VRP8',
    code: '! 1. 建 VLAN\nvlan batch <VLAN-A> <VLAN-B>\n!\n! 2. 每个 VLAN 一个网关\ninterface Vlanif<VLAN-A>\n ip address <GW-A-IP> <MASK>\n dhcp select interface\n!\ninterface Vlanif<VLAN-B>\n ip address <GW-B-IP> <MASK>\n dhcp select interface\n!\n! 3. 验证\ndisplay ip interface brief\ndisplay vlan',
    note: 'Vlanif  up 才算网关生效；dhcp select interface 让交换机自己当 DHCP（小规模省一台服务器）。跨网段不通先查 Vlanif up 没 up、 trunk 放行没放行。'
  },
  {
    id: 'tpl-trunk-uplink',
    kw: ['trunk', '上联口配置', '透传vlan'],
    cat: '开局模板',
    name: '上联 trunk 模板（逐条放行 VLAN）',
    vendor: '华为 VRP8',
    code: 'interface <UPLINK-IF>\n port link-type trunk\n port trunk allow-pass vlan <VLAN-A> <VLAN-B> <VLAN-C>\n port trunk pvid vlan <NATIVE-VLAN>\n!',
    note: '别用 port trunk allow-pass vlan all 偷懒——管理 VLAN 会被透传出去，环路风险+安全面暴露。新加 VLAN 记得回来补一条 allow-pass，这是「接入配了就是不通」的第一大坑。'
  },

  /* ============ 二层模板 ============ */
  {
    id: 'tpl-eth-trunk',
    kw: ['聚合', '端口聚合', 'eth-trunk', '双上联'],
    cat: '二层模板',
    name: '链路聚合模板（LACP 双上联）',
    vendor: '华为 VRP8',
    code: 'interface Eth-Trunk<ID>\n mode lacp-static\n trunkport <IF-1>\n trunkport <IF-2>\n!\ninterface <IF-1>\n eth-trunk <ID>\n!\ninterface <IF-2>\n eth-trunk <ID>\n!\n! 验证\ndisplay eth-trunk <ID>',
    note: 'lacp-static 比手工模式稳（协商失败自动退出聚合，不会黑洞）。堆叠场景加 least active-link 2：成员少于 2 条整个 trunk down，防单链路跑流量。'
  },
  {
    id: 'tpl-port-sec',
    kw: ['端口安全', 'mac绑定', '防私接', 'mac认证'],
    cat: '二层模板',
    name: '端口安全模板（MAC 绑定防乱接）',
    vendor: '华为 VRP8',
    code: '! 1. 学到的 MAC 达到上限就关端口\ninterface <USER-IF>\n port-security enable\n port-security max-mac-num 1\n port-security protect-action protect\n port-security protect-action recover automatic\n!\n! 2. 静态绑定（打印机/哑终端用）\n port-security static-mac-address <MAC> vlan <VLAN>\n!\n! 3. 验证\ndisplay port-security interface <USER-IF>',
    note: 'protect 动作（丢新 MAC 的包不关口）适合办公区——换台电脑不用跑弱电间；restrict 会计数告警；shutdown 最狠适合会议室。换电脑频繁的场景配 recover automatic 自动恢复。'
  },
  {
    id: 'tpl-stp-edge',
    kw: ['stp', '生成树', '边缘端口', '根桥'],
    cat: '二层模板',
    name: 'STP 部署模板（edge 口 + 根桥指定）',
    vendor: '华为 VRP8',
    code: '! 1. 全局：RSTP + 核心当根桥\nstp mode rstp\nstp priority 4096\n!\n! 2. 接终端的口：edge 即插即用\ninterface <USER-IF>\n stp edged-port enable\n!\n! 3. 上联口：防有人抢根桥\ninterface <UPLINK-IF>\n stp root-protection\n!\n! 4. 验证\ndisplay stp brief\ndisplay stp root',
    note: '备份核心 priority 8192（stp priority 4096 是主）。edge 口只给接终端的口配——配到上联口，环路来了不收敛直接广播风暴。'
  },

  /* ============ 三层模板 ============ */
  {
    id: 'tpl-static-route',
    kw: ['默认路由', '缺省路由', '静态路由', '浮动路由', '黑洞路由', '路由配置'],
    cat: '三层模板',
    name: '静态路由模板（默认 / 浮动 / 黑洞）',
    vendor: '华为 VRP8',
    code: '! 1. 默认路由（上网）\nip route-static 0.0.0.0 0.0.0.0 <NEXT-HOP>\n!\n! 2. 浮动路由：主链路断开自动切备份（preference 大的备用）\nip route-static <DEST-NET> <MASK> <NEXT-HOP-1> preference 60\nip route-static <DEST-NET> <MASK> <NEXT-HOP-2> preference 100\n!\n! 3. 黑洞路由（防路由环路兜底）\nip route-static <NULL-NET> <MASK> NULL0\n!\n! 4. 验证\ndisplay ip routing-table protocol static',
    note: 'preference 越小越优，默认 60。备份链路 preference 调大（如 100）平时不出现，主链路一断自动顶上——比动态协议省事，链路少的路由器首选。'
  },
  {
    id: 'tpl-ospf-basic',
    kw: ['ospf', 'ospf单区域', 'ospf配置'],
    cat: '三层模板',
    name: 'OSPF 单区域模板',
    vendor: '华为 VRP8',
    code: '! 1. 进程与区域\nospf 1 router-id <RID>\n area 0\n!\n! 2. 接口宣告（反码！别写错）\nnetwork <NET-IP> <WILDCARD> \n!\n! 3. 验证\ndisplay ospf peer\ndisplay ospf routing',
    note: 'network 用反码（255.255.255.0 → 0.0.0.255），写成正掩码是经典错误。邻居起不来按顺序查：底层 ping → 区域号 → 掩码 → 认证 → RID 冲突 → silent-interface。'
  },
  {
    id: 'tpl-vrrp',
    kw: ['vrrp', '网关双机', '网关热备', '主备网关'],
    cat: '三层模板',
    name: 'VRRP 双机热备模板（主备网关）',
    vendor: '华为 VRP8',
    code: '! 主设备：priority 120 抢占\ninterface Vlanif<VLAN>\n ip address <VIP> <MASK>\n vrrp vrid <VRID> virtual-ip <VIP>\n vrrp vrid <VRID> priority 120\n vrrp vrid <VRID> preempt-mode timer delay <DELAY>\n!\n! 备设备：priority 100\ninterface Vlanif<VLAN>\n ip address <REAL-IP-B> <MASK>\n vrrp vrid <VRID> virtual-ip <VIP>\n!\n! 上联跟踪：上联口挂了自动降优先级\nvrrp vrid <VRID> track interface <UPLINK-IF> reduced 30\n!\n! 验证\ndisplay vrrp',
    note: '两台都配 virtual-ip（相同），实际 IP 各不同。preempt delay 配 30s 防主设备刚恢复就抢回来业务再抖一次。track 接口是切换生效的关键，不配上联断了也不切。'
  },

  /* ============ DHCP 模板 ============ */
  {
    id: 'tpl-dhcp-pool',
    kw: ['dhcp地址池', '地址池配置', 'dhcp服务'],
    cat: 'DHCP 模板',
    name: 'DHCP 地址池模板（接口 / 全局）',
    vendor: '华为 VRP8',
    code: '! 方式一：接口式（小规模，网关即 DHCP）\ninterface Vlanif<VLAN>\n dhcp select interface\n dhcp server dns-list <DNS-IP>\n dhcp server lease day 1 hour 12\n!\n! 方式二：全局池（中大规模，地址段和网关分开）\nip pool <POOL-NAME>\n network <NET-IP> mask <MASK>\n gateway-list <GW-IP>\n dns-list <DNS-IP>\n lease day 1\n!',
    note: '地址池别把 .1（网关）和 .254 包进去——留 .10-.50 给服务器打印机固定分配。监控池使用率：display ip pool | include used，到 80% 就该扩段了。'
  },
  {
    id: 'tpl-dhcp-relay',
    kw: ['dhcp中继', '中继配置', '跨网段获取地址'],
    cat: 'DHCP 模板',
    name: 'DHCP 中继模板（跨网段获取）',
    vendor: '华为 VRP8',
    code: '! 1. 开启 DHCP 服务\ndhcp enable\n!\n! 2. 三层口配中继指向 DHCP 服务器\ninterface Vlanif<VLAN>\n dhcp select relay\n dhcp relay server <DHCP-SERVER-IP>\n!\n! 3. 验证\ndisplay dhcp relay statistics',
    note: '中继场景三查：dhcp enable 开了没、relay server 地址对不对、中间防火墙放行 UDP 67/68 没。客户端拿不到地址时在服务器侧看有没有收到 relay 请求。'
  },

  /* ============ 安全模板 ============ */
  {
    id: 'tpl-acl-basic',
    kw: ['acl', 'acl配置', '访问控制列表'],
    cat: '安全模板',
    name: 'ACL 基础模板（定义 + 应用）',
    vendor: '华为 VRP8',
    code: '! 1. 定义 ACL（deny 在前，逐条匹配）\nacl number <ACL-ID>\n rule 5 deny ip source <BAD-IP> 0\n rule 10 permit ip source <GOOD-NET> <WILDCARD> destination <DEST-NET> <WILDCARD>\n!\n! 2. 应用到接口方向\ntraffic-filter inbound acl <ACL-ID>\n!\n! 3. 验证\ndisplay acl <ACL-ID>\ndisplay traffic-filter applied-record',
    note: 'ACL 最后有条隐式 deny all——只想封一个 IP 要写 rule permit any 兜底，否则全断。步长留 10 的倍数，后面好插规则。应用后 display 看匹配计数涨没涨。'
  },
  {
    id: 'tpl-fw-policy',
    kw: ['防火墙策略', '安全策略', '域间策略', '放行策略'],
    cat: '安全模板',
    name: '防火墙域间策略模板（最小化放行）',
    vendor: '华为 USG VRP',
    code: '! 1. 区域绑定（不绑区域的接口流量全丢！）\nfirewall zone trust\n add interface <TRUST-IF>\n!\nfirewall zone untrust\n add interface <UNTRUST-IF>\n!\n! 2. 策略：源区域/目的区域/源地址/目的地址/服务 五要素\nsecurity-policy\n rule name <RULE-NAME>\n  source-zone trust\n  destination-zone untrust\n  source-address <SRC-NET> <WILDCARD>\n  destination-address <DST-NET> <WILDCARD>\n  service protocol tcp destination-port <PORT>\n  action permit\n!\n! 3. 验证命中\ndisplay security-policy statistics',
    note: '五要素缺一不可，匹配不上就走默认拒绝。排障三板斧：statistics 看命中数、display rule all 看顺序（被前面命中就不往下走）、session table 看会话。别图省事改默认动作为 permit。'
  },
  {
    id: 'tpl-ipsec',
    kw: ['ipsec', 'vpn配置', '站点互联', 'ipsec vpn'],
    cat: '安全模板',
    name: 'IPsec VPN 站点互联模板',
    vendor: '华为 VRP8',
    code: '! 1. 一阶段：IKE 提议 + 对端\nike proposal <ID>\n encryption-algorithm aes-256\n dh group14\n authentication-algorithm sha2-256\n!\nike peer <PEER-NAME>\n pre-shared-key cipher <KEY>\n ike-proposal <ID>\n remote-address <PEER-PUBLIC-IP>\n!\n! 2. 二阶段：IPsec 提议 + 感兴趣流\nipsec proposal <IPSEC-NAME>\n transform esp\n esp encryption-algorithm aes-256\n!\nacl number <ACL-ID>\n rule permit ip source <LOCAL-NET> <WILDCARD> destination <PEER-NET> <WILDCARD>\n!\n! 3. 应用\nipsec policy <POLICY-NAME> 10 isakmp\n ike-peer <PEER-NAME>\n proposal <IPSEC-NAME>\n security acl <ACL-ID>\n!\ninterface <PUBLIC-IF>\n ipsec apply policy <POLICY-NAME>\n!\n! 4. 验证\ndisplay ike sa\ndisplay ipsec sa',
    note: '六步顺序别乱。排障铁律：先看 ike sa（一阶段没过=密钥/套件/对端地址/中间NAT），再看 ipsec sa（二阶段没过=感兴趣流两侧不对称/PFS组不一致）。ACL 是触发不是过滤，写反了通的不加不加的通。'
  },
  {
    id: 'tpl-snooping',
    kw: ['dhcp snooping', 'ipsg', '防私接', 'arp防护'],
    cat: '安全模板',
    name: 'DHCP Snooping + IPSG 模板（防私接）',
    vendor: '华为 VRP8',
    code: '! 1. 全局开启\ndhcp enable\ndhcp snooping enable\n!\n! 2. 信任口 = 连 DHCP 服务器/上联的口\ninterface <UPLINK-IF>\n dhcp snooping trusted\n!\n! 3. 接入口：绑定表 + IPSG\ndhcp snooping bind-table static ip <IP> mac <MAC> vlan <VLAN> interface <USER-IF>\n!\ninterface <USER-IF>\n dhcp snooping check dhcp-request enable\n ip source check user-bind enable\n!\n! 4. 验证\ndisplay dhcp snooping bind-table',
    note: '信任口选错 = 整口 DHCP 全断，这是最大坑。打印机等固定 IP 设备必须 bind-table static 补录，否则被 IPSG 当非法地址丢包。私接路由器想偷偷发 DHCP 直接被丢。'
  },

  /* ============ NAT 模板 ============ */
  {
    id: 'tpl-nat',
    kw: ['nat', 'nat上网', '上网配置', 'easy ip', '内网上网'],
    cat: 'NAT 模板',
    name: 'NAT 上网模板（Easy IP + Server）',
    vendor: '华为 VRP8',
    code: '! 1. 出接口 NAT（内网共享公网 IP 上网）\ninterface <PUBLIC-IF>\n nat outbound <ACL-ID>\n!\n! ACL 圈定哪些地址段能上网\nacl number <ACL-ID>\n rule permit ip source <LAN-NET> <WILDCARD>\n!\n! 2. NAT Server：把公网端口映射到内网服务器\nnat server protocol tcp global <PUBLIC-IP> <PORT> inside <SRV-IP> <PORT>\n!\n! 3. 内网访问自己的公网映射（hairpin）\nfirewall defend hairpin enable\n!\n! 4. 验证\ndisplay nat session all\ndisplay nat server',
    note: '外网能访问映射、内网访问同一个公网 IP 不通 = 缺 hairpin。display nat session all 看转换有没有发生——没会话说明 ACL 没圈到或策略拦了。'
  },

  /* ============ 运维模板 ============ */
  {
    id: 'tpl-mgmt-acl',
    kw: ['管理面加固', '只准网管机登录', '登录限制'],
    cat: '运维模板',
    name: '管理面加固模板（只准网管机登录）',
    vendor: '华为 VRP8',
    code: '! 1. ACL 只放行网管服务器\nacl number 2000\n rule 5 permit source <NMS-IP> 0\n!\n! 2. 应用到 VTY 和网管口\nuser-interface vty 0 4\n acl 2000 inbound\n protocol inbound ssh\n!\nuser-interface console 0\n authentication-mode aaa\n!\n! 3. 验证\ndisplay line vty 0 4\ndisplay acl 2000',
    note: '管理面三件套：ACL 限源、只开 SSH 不开 telnet、console 也要认证。改完先测网管机还能登，再踢自己——先想后路再动手。SNMP 同理，community 配 ACL。'
  },
  {
    id: 'tpl-log-snmp',
    kw: ['日志配置', 'snmp配置', '纳管', 'syslog'],
    cat: '运维模板',
    name: '日志 + SNMP 纳管模板',
    vendor: '华为 VRP8',
    code: '! 1. 日志：本地落盘 + 远程服务器\ninfo-center enable\ninfo-center logfile size 16\ninfo-center logfile directory cfcard2:/log\ninfo-center loghost <SYSLOG-IP>\ninfo-center source-id ip-address\n!\n! 2. SNMP：只读共同体 + ACL + Trap\nsnmp-agent\nsnmp-agent sys-info version v2c\nacl number 2001\n rule 5 permit source <NMS-IP> 0\nsnmp-agent community read cipher <COMMUNITY> acl 2001\nsnmp-agent trap enable feature-standard\nsnmp-agent target-host trap address udp-domain <NMS-IP> params securityname <COMMUNITY> v2c\n!\n! 3. 验证\ndisplay info-center\ndisplay snmp-agent target-host',
    note: '日志存 6 个月以上（等保审计要查）。SNMP 共同体务必配 ACL + cipher 密文，公网裸奔等于送设备信息。trap enable 不开，接口 down 告警网管收不到。'
  },
  {
    id: 'tpl-backup',
    kw: ['定时备份', '配置备份', '自动备份'],
    cat: '运维模板',
    name: '定时备份模板（配置不外流）',
    vendor: '华为 VRP8',
    code: '! 1. FTP 服务器模板\nsftp server enable\n!\n! 2. 手工备份（先跑通再定时）\nsftp <SRV-IP>\n put vrpcfg.zip <SW-NAME>_<DATE>.zip\n!\n! 3. 定时任务：每周三 02:00 自动传\nscheduler job BACKUP\n command 1 sftp <SRV-IP>\n scheduler schedule BACKUP\n  user-task backup time 0200 week Wed\n!\n! 4. 验证备份真的在\ndisplay scheduler job\ndisplay sftp client',
    note: '备份铁律：变更前后各备一次、文件名带日期、每季度做一次真实恢复演练——没验证过的备份约等于没有。恢复：get 下载 + startup saved-configuration 指定 + display startup 确认再重启。'
  },

  /* ============ 项目场景模板 ============ */
  {
    id: 'tpl-proj-office',
    kw: ['办公网', 'vlan规划', '按部门划分'],
    cat: '项目场景',
    name: '办公网 VLAN 规划模板（按部门）',
    vendor: '华为 VRP8',
    code: '! VLAN 规划：办公 10 / 财务 20 / 访客 30 / 管理 99\nvlan batch 10 20 30 99\n!\ninterface Vlanif10\n ip address 192.168.10.1 255.255.255.0\n dhcp select interface\n!\ninterface Vlanif20\n ip address 192.168.20.1 255.255.255.0\n dhcp select interface\n!\n! 财务区只准访问指定服务器（接 ACL 按需收紧）\nacl number 3000\n rule 5 permit ip source 192.168.20.0 0.0.0.255 destination <ERP-SRV> 0\n!\n! 接入层按工位划 VLAN\ninterface <USER-IF>\n port link-type access\n port default vlan 10',
    note: '部门 VLAN 分开 + 财务区 ACL 收紧 + 访客区单独 VAP/端口。管理 VLAN 99 只放行网管机访问。IP 规划：.1 网关、.254 测试、.10-.50 固定分配。'
  },
  {
    id: 'tpl-proj-school',
    kw: ['宿舍网', '校园网', '学生网接入'],
    cat: '项目场景',
    name: '宿舍网接入模板（限速 + 防私接）',
    vendor: '华为 VRP8',
    code: '! 1. 宿舍 VLAN + Portal（另配 Portal 模板）\nvlan batch 50\ninterface Vlanif50\n ip address 10.50.0.1 255.255.255.0\n dhcp select interface\n!\n! 2. 每端口限速 4Mbps\ntraffic behavior LIMIT-4M\n car cir 4096 cbs 819200 pbs 1638400\n!\ntraffic classifier CLASS-ALL\n if-match any\n!\ntraffic policy POLICY-LIMIT\n classifier CLASS-ALL behavior LIMIT-4M\n!\ninterface <USER-IF>\n traffic-policy POLICY-LIMIT inbound\n!\n! 3. 防私接：绑定 + 检查\ndhcp snooping enable\ninterface <USER-IF>\n dhcp snooping check dhcp-request enable\n ip source check user-bind enable',
    note: '一间宿舍一个口。Portal 限单账号在线数 1（一号一终端），CAR 限速防抢占，Snooping+IPSG 让私接小路由器发不出假地址。绑定表按月清理（换床率高）。'
  },
  {
    id: 'tpl-proj-video',
    kw: ['监控网', '视频专网', '组播'],
    cat: '项目场景',
    name: '监控专网模板（隔离 + 组播）',
    vendor: '华为 VRP8',
    code: '! 1. 监控独立 VLAN\nvlan batch 60\n!\n! 2. 摄像头口：隔离（互相看不见，都能访问 NVR）\ninterface <CAM-IF>\n port link-type access\n port default vlan 60\n port-isolate enable\n!\n! 3. 组播：多客户端看同一路只占一份带宽\ninterface Vlanif60\n igmp enable\n pim sm\n!\n! 4. 上联保障带宽\ntraffic classifier MON\n if-match vlan 60\n!\ntraffic behavior MON-PRI\n queue ef wfq\n!\ntraffic policy MON-POLICY\n classifier MON behavior MON-PRI\n!\ninterface <UPLINK-IF>\n traffic-policy MON-POLICY inbound',
    note: '流量估算先行：1080P 约 4Mbps/路，200 路 = 800Mbps，上联千兆起且留 40% 余量。NVR 存储 90 天 ≈ 388GB/路。摄像头固定 IP 走绑定防掉线换 IP。'
  },
  {
    id: 'tpl-proj-guest',
    kw: ['访客wifi', '访客网络', 'guest', 'portal认证'],
    cat: '项目场景',
    name: '访客网络模板（Portal + 隔离）',
    vendor: '华为 AC VRP',
    code: '! 1. 访客 SSID + VAP\nwlan ssid-profile SSID-GUEST\n ssid name Guest-WiFi\n!\nportal server WEB-GUEST\n server-url http://<PORTAL-IP>/portal\n source-ip <PORTAL-IP>\n!\nportal auth-profile GUEST-PORTAL\n web-auth-server WEB-GUEST direct\n!\nfree-rule-template GUEST-FREE\n free-rule 10 permit destination ip <PORTAL-IP> 0.0.0.0\n!\nwlan vap-profile VAP-GUEST\n ssid-profile SSID-GUEST\n service-vlan vlan-id 50\n portal-auth-profile GUEST-PORTAL\n user-isolate enable\n!\n! 2. 访客 VLAN 三层口\nvlan batch 50\ninterface Vlanif50\n ip address 192.168.50.1 255.255.255.0\n dhcp select interface',
    note: '访客三隔离：和办公网隔（独立 VLAN+ACL 只放 53/80/443）、访客之间隔（user-isolate）、管理面隔（ACL deny AP/AC 管理地址）。Portal 打不开 90% 是 free-rule 没放 DNS。'
  },

  /* ============ 多厂商开局模板（第 23 轮补充） ============ */
  {
    id: 'tpl-cisco-base',
    kw: ['思科开局', 'cisco开局', 'ios开局'],
    cat: '开局模板',
    name: '思科 IOS 交换机开局模板',
    vendor: '思科 IOS',
    code: '! 1. 命名与时钟\nhostname SW-Access-01\nclock timezone CST 8 0\nntp server <NTP-IP>\n!\n! 2. 管理 VLAN 与地址\nvlan 10\n name MGMT\ninterface Vlan10\n ip address <MGMT-IP> <MASK>\n no shutdown\nip default-gateway <GW-IP>\n!\n! 3. 账号与 SSH\nenable secret <ENABLE-PWD>\nusername admin privilege 15 secret <PASSWORD>\nip domain-name example.local\ncrypto key generate rsa modulus 2048\nip ssh version 2\nline vty 0 4\n login local\n transport input ssh\n!\n! 4. 保存\nend\nwrite memory',
    note: '二层交换机用 ip default-gateway 出管理网，三层交换机要改写成 ip route 0.0.0.0 0.0.0.0 <GW-IP>。crypto key 生成完 SSH 才起得来，顺序别倒。'
  },
  {
    id: 'tpl-h3c-base',
    kw: ['h3c开局', 'comware开局', '华三开局'],
    cat: '开局模板',
    name: 'H3C Comware7 开局模板',
    vendor: 'H3C Comware7',
    code: 'sysname SW-Access-01\nclock timezone Beijing add 08:00:00\nntp-service unicast-server <NTP-IP>\n!\nvlan 10\n description MGMT\ninterface Vlan-interface10\n ip address <MGMT-IP> <MASK>\n!\nip route-static 0.0.0.0 0 <GW-IP>\n!\nlocal-user admin class manage\n password simple <PASSWORD>\n service-type ssh\n authorization-attribute user-role network-admin\n!\nssh server enable\nline vty 0 4\n authentication-mode scheme\n protocol inbound ssh\n!\nsave force',
    note: 'H3C 三个必踩点：① Vlan-interface 带横线（不是 Vlanif）② local-user 必须 class manage 才登得上 ③ save force 免得交互卡住。'
  },
  {
    id: 'tpl-ruijie-base',
    kw: ['锐捷开局', 'rgos开局'],
    cat: '开局模板',
    name: '锐捷 RGOS 开局模板',
    vendor: '锐捷 RGOS',
    code: 'hostname SW-Access-01\nclock timezone 8\n!\nvlan 10\n name MGMT\ninterface VLAN 10\n ip address <MGMT-IP> <MASK>\n!\nip route 0.0.0.0 0.0.0.0 <GW-IP>\n!\nenable secret <ENABLE-PWD>\nusername admin privilege 15 password <PASSWORD>\n!\nip ssh version 2\nline vty 0 4\n login local\n transport input ssh\n!\nend\nwrite',
    note: '锐捷跟思科九成一样，差异在 interface VLAN 10（中间有空格）、clock timezone 只写数字、保存用 write。'
  },
  {
    id: 'tpl-zte-base',
    kw: ['中兴开局', 'zxr10开局'],
    cat: '开局模板',
    name: '中兴 ZXR10 开局模板',
    vendor: '中兴 ZXR10',
    code: 'hostname SW-Access-01\n!\nvlan 10\n name MGMT\n!\ninterface vlan10\n ip address <MGMT-IP> <MASK>\n!\nip route 0.0.0.0 0.0.0.0 <GW-IP>\n!\nusername admin password <PASSWORD>\n!\ntelnet server disable\nssh server enable\n!\nwrite',
    note: 'ZXR10 的 SVI 是 interface vlan10 连写、查看用 show（不是 display）、保存用 write。型号/版本间命令略有差异，拿不准时先在设备上敲 ? 补全看。'
  },
  {
    id: 'tpl-junos-base',
    kw: ['juniper开局', 'junos开局', 'juniper配置'],
    cat: '开局模板',
    name: 'Juniper Junos 开局模板（set 一次到底）',
    vendor: 'Juniper Junos',
    code: '# 先设 root 密码，否则 commit 会报错\nset system root-authentication encrypted-password "<HASH>"\nset system host-name SW-Access-01\nset system time-zone Asia/Shanghai\nset system ntp server <NTP-IP>\nset system login user admin class super-user\nset system services ssh\nset system services netconf ssh\n!\nset vlans MGMT vlan-id 10\nset interfaces irb unit 10 family inet address <MGMT-IP>/24\nset vlans MGMT l3-interface irb.10\n!\nset interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access\nset interfaces ge-0/0/0 unit 0 family ethernet-switching vlan members MGMT\n!\nset routing-options static route 0.0.0.0/0 next-hop <GW-IP>\n!\n# 检查后提交\nshow | compare\ncommit',
    note: 'Junos 开局三步：set 一串 → show | compare 核对 → commit 生效。密码哈希用 set system root-authentication plain-text-password 交互输入更省事。'
  },
  {
    id: 'tpl-eos-base',
    kw: ['arista开局', 'eos开局'],
    cat: '开局模板',
    name: 'Arista EOS 交换机开局模板',
    vendor: 'Arista EOS',
    code: 'hostname leaf-01\n!\nvlan 10\n   name MGMT\n!\ninterface Vlan10\n   ip address <MGMT-IP>/24\n!\nip route 0.0.0.0/0 <GW-IP>\n!\nusername admin privilege 15 secret <PASSWORD>\n!\nmanagement api http-commands\n   no shutdown\n!\nend\ncopy running-config startup-config',
    note: 'EOS 地址写 CIDR（10.1.10.2/24），不用掩码点分。开启 eAPI 后可以用 REST/JSON 批量下发；配置支持 checkpoint 回滚，改错不用手敲。'
  },
  /* ============ IPv6 / 无线 / 路由 / 割接 ============ */
  {
    id: 'tpl-v6-dual',
    kw: ['ipv6', 'ipv6双栈', '双栈配置', 'v6开局'],
    cat: 'IPv6 模板',
    name: 'IPv6 双栈开局模板（IPv4 不动，加一层 v6）',
    vendor: '华为 VRP8',
    code: 'ipv6\n!\nvlan batch <VLAN-A> <VLAN-B>\n!\ninterface Vlanif<VLAN-A>\n ip address <V4-GW> 255.255.255.0\n ipv6 enable\n ipv6 address <V6-PREFIX>::1/64\n undo ipv6 nd ra halt\n ipv6 nd ra prefix <V6-PREFIX>::/64 2592000 604800\n ipv6 nd ra dns server <V6-DNS>\n!\ninterface GigabitEthernet0/0/1\n port link-type trunk\n port trunk allow-pass vlan <VLAN-A> <VLAN-B>\n!\nipv6 route-static :: 0 <V6-NEXT-HOP>',
    note: '三个必做项：① 全局 ipv6 ② 接口 ipv6 enable ③ undo ipv6 nd ra halt——RA 默认是停的，不关掉终端永远拿不到地址、也学不到默认路由。'
  },
  {
    id: 'tpl-wlan-ac',
    kw: ['ac开局', '无线开局', 'ap上线', '放ssid'],
    cat: '无线模板',
    name: '华为 AC 开局模板（AP 上线 + 放 SSID）',
    vendor: '华为 AC VRP',
    code: 'vlan batch <AP-VLAN> <USER-VLAN>\n!\ndhcp enable\ninterface Vlanif<USER-VLAN>\n ip address <USER-GW> 255.255.255.0\n dhcp select interface\n!\ncapwap source interface Vlanif<AP-VLAN>\n!\nwlan\n regulatory-domain-profile name CN\n  country-code cn\n security-profile name SEC-WPA2\n  security wpa2 psk pass-phrase <PASSWORD> aes\n ssid-profile name SSID-OFFICE\n  ssid <SSID-NAME>\n vap-profile name VAP-OFFICE\n  service-vlan vlan-id <USER-VLAN>\n  ssid-profile SSID-OFFICE\n  security-profile SEC-WPA2\n ap-group name AP-GROUP-1\n  vap-profile VAP-OFFICE wlan 1 radio all',
    note: 'AP 上不了线先查三处：capwap source 指对没有、AP 和 AC 三层通不通（option 43 / DNS）、国家码建没建。VAP 三件套（ssid / security / vap）少一个 SSID 就发不出来。'
  },
  {
    id: 'tpl-ospf-multi',
    kw: ['ospf多区域', 'abr汇总', '接口认证'],
    cat: '三层模板',
    name: 'OSPF 多区域模板（含 ABR 汇总与接口认证）',
    vendor: '华为 VRP8',
    code: 'ospf 1 router-id <ROUTER-ID>\n area 0.0.0.0\n  network <CORE-NET> 0.0.0.255\n area 0.0.0.1\n  network <BRANCH-NET> 0.0.0.255\n  abr-summary <SUMMARY-NET> 255.255.0.0\n!\ninterface GigabitEthernet0/0/24\n ospf cost 10\n ospf authentication-mode md5 1 cipher <KEY>\n!\ndisplay ospf peer brief\ndisplay ospf routing',
    note: '所有非骨干区域必须挂到 area 0（否则邻居起不来）；ABR 上做 abr-summary 把明细压成一条，分支再多核心路由表也不炸。认证两端 key-id 和密钥必须一致。'
  },
  {
    id: 'tpl-cutover-back',
    kw: ['割接', '割接回退', '回退方案', '变更方案'],
    cat: '运维模板',
    name: '割接回退清单模板（改之前先写好退路）',
    vendor: '华为 VRP8',
    code: '# === 割接前 30 分钟 ===\ndisplay current-configuration > flash:/before.cfg\ntftp <BACKUP-IP> put flash:/before.cfg SW1-before.cfg\nsave\n# 顺带记下：接口状态 / 路由表 / 在线用户数\ndisplay interface brief\ndisplay ip routing-table\ndisplay users\n\n# === 割接中：每步留痕，写清「改了什么、怎么退」 ===\n# Step 1 加 VLAN 20    回退：undo vlan 20\n# Step 2 改 trunk 放行   回退：port trunk allow-pass vlan <原列表>\n\n# === 回退（按严重程度选） ===\n# 轻：只退这一步\nundo <本次命令>\n# 中：恢复备份配置\nstartup saved-configuration before.cfg\nreboot\n# 重：整机回到出厂（仅限新设备，慎用）\nreset saved-configuration',
    note: '割接真正的保命动作是「提前写好回退命令」，不是现场想。备份要落在别的机器上（设备 flash 一起坏的情况真有）。观察窗口至少 30 分钟再走人。'
  },

  /* ============ 策略 / 认证 / 运维模板（第 25 轮补充） ============ */
  {
    id: 'tpl-qos-limit',
    kw: ['端口限速', '限速配置', '带宽限制', 'car'],
    cat: 'QoS 模板',
    name: '端口限速模板（入向 car / 出向整形）',
    vendor: '华为 VRP8',
    code: '! 1. 入方向：用 CAR 丢弃式限速到 20Mbit\ninterface GigabitEthernet0/0/1\n qos car inbound cir 20000 cbs 250000 pir 20000 pbs 250000 green pass yellow pass red discard\n!\n! 2. 出方向：用队列整形，比 CAR 平滑（不丢突发）\ninterface GigabitEthernet0/0/1\n qos lr outbound cir 20000 cbs 375000\n!\n! 3. 验证\n display qos car interface GigabitEthernet 0/0/1\n display qos queue statistics interface GigabitEthernet 0/0/1\n display interface GigabitEthernet 0/0/1 | include rate',
    note: '入向只能丢（CAR），出向可以排队（整形），所以「对外限速」优先在出方向做。cbs 给太小会把突发全丢掉——经验值取「速率 × 10ms」，20M 约 250000 字节。'
  },
  {
    id: 'tpl-mirror',
    kw: ['端口镜像', '抓包配置', '镜像口', 'rspan'],
    cat: '运维模板',
    name: '端口镜像模板（本地抓包 / 远程 RSPAN）',
    vendor: '华为 VRP8',
    code: '! === 本地镜像：被镜像口 Gi0/0/1 → 观察口 Gi0/0/24 ===\nobserve-port 1 interface GigabitEthernet 0/0/24\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 both\n!\n! === 远程镜像：观察流量打 VLAN 999 送到远端抓包机 ===\nvlan 999\n description RSPAN\nobserve-port 1 vlan 999\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 inbound\n!\n! 中间链路要放行 vlan 999，抓包机接在该 VLAN 的 access 口\ndisplay observe-port\ndisplay port-mirroring',
    note: '观察口不能再承载业务；远程镜像要求整条路径放行 RSPAN VLAN（含 trunk 允许列表）。只抓入向就写 inbound——both 会把带宽翻倍，观察口容易拥塞丢包。'
  },
  {
    id: 'tpl-stack',
    kw: ['堆叠', '堆叠配置', 'istack'],
    cat: '二层模板',
    name: '堆叠模板（iStack 双机 + 交叉连线）',
    vendor: '华为 VRP8',
    code: '! === 交换机 A（主）===\nstack slot 0 priority 200\nstack slot 0 renumber 1\ninterface stack-port 0/1\n port interface XGigabitEthernet 0/0/1 enable\ninterface stack-port 0/2\n port interface XGigabitEthernet 0/0/2 enable\nsave\nreboot\n\n! === 交换机 B（备）===\nstack slot 0 priority 100\nstack slot 0 renumber 2\ninterface stack-port 0/1\n port interface XGigabitEthernet 0/0/1 enable\ninterface stack-port 0/2\n port interface XGigabitEthernet 0/0/2 enable\nsave\nreboot\n\n! 验证：display stack',
    note: '堆叠线要交叉接（A 的 1 口接 B 的 2 口、A 的 2 口接 B 的 1 口），单根能起但没冗余。renumber 改完必须重启才生效，两台要错开 1~2 分钟重启，避免抢主。H3C 对应 irf member + irf-port。'
  },
  {
    id: 'tpl-dual-wan',
    kw: ['双出口', '双线路', '主备出口', '分流出口'],
    cat: '三层模板',
    name: '双出口模板（主备 + 源分流 + 链路探测）',
    vendor: '华为 VRP8',
    code: '! 1. 主备默认路由\nip route-static 0.0.0.0 0.0.0.0 202.1.1.1 preference 60\nip route-static 0.0.0.0 0.0.0.0 100.1.1.1 preference 70\n!\n! 2. 指定网段走第二条出口（策略路由）\nacl number 3000\n rule 5 permit ip source 192.168.20.0 0.0.0.255\ntraffic classifier C-SALES operator or\n if-match acl 3000\ntraffic behavior B-ISP2\n redirect ip-nexthop 100.1.1.1\ntraffic policy P-OUT\n classifier C-SALES behavior B-ISP2\ninterface GigabitEthernet 0/0/1\n traffic-policy P-OUT inbound\n!\n! 3. NQA 探测主链路，断了自动切备\nnqa test-instance admin isp1\n test-type icmp\n destination-address ipv4 114.114.114.114\n frequency 10\nip route-static 0.0.0.0 0.0.0.0 202.1.1.1 track nqa admin isp1',
    note: '双出口三件套：主备 preference + 源地址分流 PBR + NQA 探测。只做前两个，主链路断了不会自动切——因为静态路由不会因为链路 down 就失效（除非接的是能感知的物理口）。'
  },
  {
    id: 'tpl-dot1x',
    kw: ['802.1x', '有线认证', 'dot1x', '认证前放行'],
    cat: '安全模板',
    name: '802.1X 有线接入认证模板（RADIUS + 认证前放行）',
    vendor: '华为 VRP8',
    code: '! 1. RADIUS 模板\nradius-server template RAD\n radius-server shared-key cipher <KEY>\n radius-server authentication <RADIUS-IP> 1812\n!\naaa\n authentication-scheme SCH-DOT1X\n  authentication-mode radius\n domain default\n  authentication-scheme SCH-DOT1X\n  radius-server RAD\n!\n! 2. 全局与接口开启\ndot1x enable\ninterface GigabitEthernet0/0/1\n dot1x enable\n dot1x authentication-method eap\n!\n! 3. 认证前放行 DHCP / DNS，否则终端拿不到地址卡在「正在连接」\nauthentication free-rule-template FREE\n free-rule 1 destination ip <DHCP-IP> mask 255.255.255.255\n free-rule 2 destination ip <DNS-IP> mask 255.255.255.255',
    note: '上线顺序很关键：先拿 IP 再认证，所以 DHCP 必须放行（free-rule）。第一次部署先在测试口开，确认客户端能过认证再批量下发，否则整层楼一起断网。'
  },
  {
    id: 'tpl-snmpv3',
    kw: ['snmpv3', 'snmp加密', 'snmp认证', 'trap配置'],
    cat: '运维模板',
    name: 'SNMPv3 纳管模板（认证 + 加密 + Trap）',
    vendor: '华为 VRP8',
    code: 'snmp-agent\nsnmp-agent sys-info version v3\nsnmp-agent group v3 NMS privacy read-view iso write-view iso\n!\nsnmp-agent usm-user v3 monitor group NMS\nsnmp-agent usm-user v3 monitor authentication-mode sha cipher <AUTH-PWD>\nsnmp-agent usm-user v3 monitor privacy-mode aes128 cipher <PRIV-PWD>\n!\n! Trap 上报到网管\nsnmp-agent target-host trap address udomain <NMS-IP> params securityname monitor v3 privacy\nsnmp-agent trap enable\n!\n! 验证\ndisplay snmp-agent usm-user\ndisplay snmp-agent group',
    note: 'v3 三件套：用户（usm-user）、组（group，决定能读哪些视图）、认证与加密算法（SHA + AES）。网管侧必须填同样的用户名和密钥，算法选错会报「认证失败」而不是超时——两种现象能区分是密码错还是网络不通。'
  },

  /* ============ 数据中心 / 上云 / 运维流水线模板（第 26 轮补充） ============ */
  {
    id: 'tpl-roce',
    kw: ['roce', '无损网络', 'pfc', 'ecn'],
    cat: '数据中心模板',
    name: 'RoCE 无损网络模板（PFC + ECN）',
    vendor: '华为 CE',
    code: '! === 1. 全局使能 PFC ===\ndcb pfc\n!\n! === 2. 无损队列（优先级 3）接入端口 ===\ninterface 100GE1/0/1\n description TO-LEAF-02\n priority-flow-control priority 3\n qos queue 3 wred ecn\n!\n! === 3. 验证 ===\ndisplay dcb pfc\ndisplay interface 100GE1/0/1 | include Pause\ndisplay qos queue statistics interface 100GE1/0/1',
    note: 'PFC 只对无损队列开，全场开容易 PFC 风暴。ECN 门限 30~40% 起标、70% 全标。端到端要一致——服务器网卡侧也要开 PFC/ECN，只配交换机等于没配。'
  },
  {
    id: 'tpl-cloud-connect',
    kw: ['云专线', 'bgp对接', '云上专线'],
    cat: '三层模板',
    name: '云专线对接模板（BGP + 双线主备）',
    vendor: '华为 VRP8',
    code: '! === 1. 互联口（云侧给的 /30 互联段）===\ninterface GigabitEthernet0/0/1\n description TO-CLOUD-DC-1\n ip address 169.254.1.1 255.255.255.252\n!\n! === 2. BGP 对接 ===\nbgp 65001\n router-id 10.0.0.1\n peer 169.254.1.2 as-number 64512\n peer 169.254.1.2 bfd enable\n network 10.10.0.0 255.255.0.0\n!\n! === 3. 双线主备（第二条线同样配，权重低）===\nroute-policy LINE1 permit node 10\n apply local-preference 200\nbgp 65001\n peer 169.254.1.2 route-policy LINE1 import\n!\n! === 4. 验证 ===\ndisplay bgp peer\ndisplay bgp routing-table',
    note: '上云前三查：① 网段是否与云 VPC 重叠（重叠必须改规划）② MTU 是否被隧道吃掉 ③ 云侧路由表/安全组是否放行本地网段。BGP 起不来先看 TCP 179 通不通。'
  },
  {
    id: 'tpl-bastion',
    kw: ['堡垒机', 'tacacs+', '命令审计'],
    cat: '安全模板',
    name: '堡垒机对接模板（TACACS+ 命令审计）',
    vendor: '华为 VRP8',
    code: '! === 1. TACACS+ 服务器 ===\ntacacs-server template TAC\n tacacs-server shared-key cipher <KEY>\n tacacs-server authentication <BASTION-IP> 49\n!\n! === 2. AAA：认证 + 授权 + 计费全走 TACACS+ ===\naaa\n authentication-scheme SCH-TAC\n  authentication-mode tacacs\n authorization-scheme AUT-TAC\n  authorization-mode tacacs\n accounting-scheme ACC-TAC\n  accounting-mode tacacs\n domain default\n  authentication-scheme SCH-TAC\n  authorization-scheme AUT-TAC\n  accounting-scheme ACC-TAC\n  tacacs-server TAC\n!\n! === 3. 应急本地账号（堡垒机故障时用，密码单独保管）===\nlocal-user rescue password irreversible-cipher <PWD>\nlocal-user rescue privilege level 15',
    note: '审计要落地必须走 TACACS+（支持逐条命令授权与记录），RADIUS 做不到命令级。救援账号一定要留，否则堡垒机一挂全线进不去——但密码要单独封存、用完改。'
  },
  {
    id: 'tpl-monitor-full',
    kw: ['监控接入', '监控配置', 'snmp监控', '告警接入'],
    cat: '运维模板',
    name: '监控接入模板（SNMP + Syslog + Trap 全套）',
    vendor: '华为 VRP8',
    code: '! === 1. SNMP v3（只读）===\nsnmp-agent\nsnmp-agent sys-info version v3\nsnmp-agent group v3 NMS privacy read-view iso\nsnmp-agent usm-user v3 monitor group NMS\nsnmp-agent usm-user v3 monitor authentication-mode sha cipher <AUTH-PWD>\nsnmp-agent usm-user v3 monitor privacy-mode aes128 cipher <PRIV-PWD>\n!\n! === 2. Trap 上报 ===\nsnmp-agent target-host trap address udp-domain <NMS-IP> params securityname monitor v3 privacy\nsnmp-agent trap enable\n!\n! === 3. Syslog ===\ninfo-center enable\ninfo-center loghost <SYSLOG-IP>\ninfo-center source default channel loghost log level informational\n!\n! === 4. 时间必须对（否则日志时间线全乱）===\nclock timezone CST add 08:00:00\nntp-service unicast-server <NTP-IP>\n!\ndisplay snmp-agent usm-user\ndisplay info-center',
    note: '监控三件套：指标（SNMP）、事件（Syslog）、告警（Trap）。三样都接之前先把 NTP 配好——时间不对，事后分析日志根本对不上。'
  },
  {
    id: 'tpl-backup-git',
    kw: ['自动备份', 'git备份', '备份流水线'],
    cat: '运维模板',
    name: '配置自动备份流水线（拉取 + Git 版本化）',
    vendor: '通用脚本',
    code: '#!/bin/bash\n# 每天 02:00 备份所有网络设备配置并提交 Git\nset -e\ncd /opt/net-cfg\n\nfor ip in $(cat devices.txt); do\n  python3 - "$ip" <<PY\nimport sys, netmiko\nip = sys.argv[1]\nd = dict(device_type="hp_comware", host=ip, username="backup", password="******")\nwith netmiko.ConnectHandler(**d) as c:\n    open(f"{ip}.cfg", "w").write(c.send_command("display current-configuration"))\nPY\ndone\n\ngit add -A\ngit commit -m "daily $(date +%F)" || echo "无变更"\ngit push -q origin main\n\n# crontab\n# 0 2 * * * /opt/net-cfg/backup.sh >> /var/log/netbak.log 2>&1',
    note: '备份要落在另一台机器（设备 flash 会跟着设备一起坏）。进 Git 后「谁在什么时候改了哪一行」变成 git diff 一眼可见，割接前打个 tag 就是基线。仓库别放公网。'
  },
  {
    id: 'tpl-inspect',
    kw: ['巡检', '巡检报表', '定期检查'],
    cat: '运维模板',
    name: '巡检报表模板（采集 + CSV + 趋势对比）',
    vendor: '通用脚本',
    code: 'from netmiko import ConnectHandler\nimport csv, time\n\nCMDS = [\n    ("display version", "版本"),\n    ("display cpu-usage", "CPU"),\n    ("display memory-usage", "内存"),\n    ("display interface brief", "端口"),\n    ("display interface | include error|CRC|drop", "错包"),\n    ("display transceiver diagnosis interface", "光功率"),\n]\n\nrows = [["时间", "设备", "项目", "结果"]]\nfor ip in open("devices.txt").read().split():\n    d = dict(device_type="hp_comware", host=ip, username="ops", password="******")\n    try:\n        with ConnectHandler(**d) as c:\n            for cmd, name in CMDS:\n                rows.append([time.strftime("%F %T"), ip, name, c.send_command(cmd, read_timeout=30)])\n    except Exception as e:\n        rows.append([time.strftime("%F %T"), ip, "采集失败", str(e)])\n\nwith open(f"report_{time.strftime(\"%Y%m%d\")}.csv", "w", newline="", encoding="utf-8") as f:\n    csv.writer(f).writerows(rows)\nprint("done", len(rows) - 1, "行")',
    note: '关键是每天存档、和前一天比：端口错包增量、CPU 缓慢爬升、光功率缓慢下降——这些趋势问题单次快照永远看不出来。'
  },

  /* ============ 服务器 / 交付 / 加固模板（第 27 轮补充） ============ */
  {
    id: 'tpl-bond',
    kw: ['双网卡绑定', 'bond配置', '网卡冗余'],
    cat: '运维模板',
    name: '服务器双网卡绑定模板（LACP / 主备）',
    vendor: 'Linux',
    code: '# === 方案一：mode 4（LACP，需交换机配 Eth-Trunk）===\nnmcli con add type bond con-name bond0 ifname bond0 mode 802.3ad\nnmcli con add type bond-slave ifname ens33 master bond0\nnmcli con add type bond-slave ifname ens34 master bond0\nnmcli con mod bond0 ipv4.method manual\nnmcli con mod bond0 ipv4.addresses 10.1.10.20/24 ipv4.gateway 10.1.10.1\nnmcli con mod bond0 ipv4.dns "10.1.1.53"\nnmcli con up bond0\n\n# === 方案二：mode 1（主备，交换机零配置）===\n# nmcli con add type bond con-name bond0 ifname bond0 mode active-backup\n\n# === 验证 ===\ncat /proc/net/bonding/bond0\nethtool bond0',
    note: '想省事选 mode 1（主备，交换机不用配）；要带宽叠加选 mode 4（两端都要 LACP）。两块网卡要接不同交换机（或堆叠/M-LAG 的两台）才叫链路冗余。'
  },
  {
    id: 'tpl-lb-health',
    kw: ['健康检查', '负载均衡', 'lb配置'],
    cat: '运维模板',
    name: '负载均衡健康检查模板（四层 / 七层）',
    vendor: 'Nginx / HAProxy',
    code: '# === Nginx：七层健康检查（推荐，能发现进程假死）===\nupstream app_pool {\n    server 10.1.20.11:8080 max_fails=3 fail_timeout=10s;\n    server 10.1.20.12:8080 max_fails=3 fail_timeout=10s;\n    keepalive 32;\n}\nserver {\n    location / {\n        proxy_pass http://app_pool;\n        proxy_next_upstream error timeout http_502 http_504;\n        proxy_connect_timeout 2s;\n    }\n}\n\n# === HAProxy：四层 + 主动探测 ===\n# backend app\n#   server s1 10.1.20.11:8080 check inter 3s fall 3 rise 2\n#   server s2 10.1.20.12:8080 check inter 3s fall 3 rise 2',
    note: '四层探测只看端口能不能连——后端进程卡死但端口还在，流量照样打过去。有 HTTP 服务就一定要用七层探测（探测一个 /health 返回 200）。'
  },
  {
    id: 'tpl-dhcp-option43',
    kw: ['option 43', 'ap跨三层', 'ap上线'],
    cat: 'DHCP 模板',
    name: 'AP 跨三层上线模板（DHCP Option 43）',
    vendor: '华为 VRP8',
    code: 'dhcp enable\n!\n! === AP 地址池：用 Option 43 告诉 AP「AC 在哪」===\nip pool AP\n network 10.1.30.0 mask 255.255.255.0\n gateway-list 10.1.30.1\n option 43 sub-option 2 ip-address 10.1.1.10\n!\n! === 用户地址池（正常业务）===\nip pool USER\n network 10.1.40.0 mask 255.255.255.0\n gateway-list 10.1.40.1\n dns-list 10.1.1.53\n!\n! === 三层接口与路由 ===\ninterface Vlanif30\n ip address 10.1.30.1 255.255.255.0\n dhcp select global\ninterface Vlanif40\n ip address 10.1.40.1 255.255.255.0\n dhcp select global',
    note: 'AP 跨三层上线只有两条路：Option 43 或 DNS 解析（AP 默认找 huawei.com 之类的域名）。Option 43 的写法厂商差异大——华为子选项 2 直接写 IP，思科要转十六进制（10.1.1.10 → 0a01010a）。'
  },
  {
    id: 'tpl-hardening',
    kw: ['加固', '安全基线', '等保配置', '设备加固'],
    cat: '安全模板',
    name: '网络设备加固基线模板（等保三级）',
    vendor: '华为 VRP8',
    code: '! === 1. 关闭不安全服务 ===\nundo telnet server enable\nundo http server enable\nundo http secure-server enable\nundo ftp server\n!\n! === 2. 只用 SSH + 强密码策略 ===\nstelnet server enable\nssh server-source all-interface\naaa\n local-user admin password irreversible-cipher <STRONG-PWD>\n local-user admin service-type ssh\n local-user admin privilege level 15\n!\n! === 3. 管理面只准运维网段进 ===\nacl number 2000\n rule 5 permit source 10.1.0.0 0.0.255.255\n rule 100 deny\nuser-interface vty 0 4\n acl 2000 inbound\n!\n! === 4. 日志外发（留存 ≥ 6 个月）===\ninfo-center enable\ninfo-center loghost <SYSLOG-IP>\ninfo-center source default channel loghost log level informational\n!\n! === 5. 时间同步（否则日志时间线不可信）===\nntp-service unicast-server <NTP-IP>\nclock timezone CST add 08:00:00',
    note: '等保检查最常被挑的三项：Telnet 没关、SNMP 还在 v2c public、日志没外发。这三条十分钟能改完，但整改报告要写两周——上线前就配好。'
  },
  {
    id: 'tpl-microburst',
    kw: ['微突发', 'microburst', '缓存基线'],
    cat: '运维模板',
    name: '微突发（Microburst）观测与缓存基线',
    vendor: '华为 VRP8 + Cisco IOS-XE',
    code: '! === 1. 先确认是不是微突发：平均值正常，峰值打满 ===\ndisplay interface 10GE1/0/1 | include rate\ndisplay qos queue statistics interface 10GE1/0/1\n! 只有某一个队列持续丢 = 该队列对应的业务在打突刺，不是链路不够\n!\n! === 2. 看端口缓存水线（华为）===\ndisplay qos buffer-pool\ndisplay qos buffer usage interface 10GE1/0/1\n! 水线长期顶在 headroom 上限 = 真拥塞；只是偶尔冲高 = 微突发\n!\n! === 3. Cisco 侧看输出丢包与队列 ===\nshow interface Ten1/0/1 | include output drops\nshow queueing interface Ten1/0/1\nshow platform hardware fed switch active qos queue stats interface Ten1/0/1\n!\n! === 4. 抓毫秒级峰值（普通 5 分钟采样看不到突发）===\ndisplay interface 10GE1/0/1 | include "5 seconds"\n! 连续刷 30 次记 peak；峰值 / 均值 > 5 倍即典型微突发\n!\n! === 5. 处理顺序：先整形，再扩带宽，最后才动缓存 ===\ninterface 10GE1/0/1\n qos shaping cir 8000000 cbs 100000\n! 把突发削平到链路 80%，比加缓存有效得多\n! 加缓存只是把丢包延后，队列越长时延越不可控',
    note: '微突发最容易误判成带宽不足。判据只有一个：平均利用率不到 30% 却持续丢包，那就是突发，扩带宽没用，得整形。'
  },
  {
    id: 'tpl-carrier-ticket',
    kw: ['运营商报障', '电路定界', '运营商排障'],
    cat: '项目场景',
    name: '运营商电路报障与定界清单',
    vendor: '通用 / 华为 VRP8',
    code: '! === 报障前必须准备的 6 项（缺一项就被打回）===\n! 1) 电路号 / 专线编号（不是 IP，不是设备名）\n! 2) 两端机房地址 + 现场联系人 + 电话\n! 3) 故障起始时间（精确到分钟）+ 现象描述\n! 4) 已完成的自测结论（见下面命令）\n! 5) 业务影响范围与等级\n! 6) 历史工单号（重复报障要挂原单）\n!\n! === 自测一：证明问题在运营商侧 ===\ndisplay interface GigabitEthernet0/0/1\ndisplay interface GigabitEthernet0/0/1 | include error|CRC|drops\n! CRC / Input errors / Runts 有增长 = 线路质量问题，责任明确\n!\n! === 自测二：光功率（最常见的推诿点）===\ndisplay transceiver diagnosis interface GigabitEthernet0/0/1\n! 收光 -3 ~ -20dBm 正常；低于 -25dBm 直接报障，别自己换模块\n! 收发功率差 > 15dB 也报，说明光路衰减异常\n!\n! === 自测三：环回测试 ===\n! 本地自环：光模块自环后本端口应 up，不 up = 我方模块或端口坏\n! 远端打环：请运营商在对端机房打环，能通 = 我方设备正常\n!\n! === 自测四：分段 ping，逐跳找拐点 ===\nping -c 100 -s 1400 <对端网关>\ntracert -m 15 <目标地址>\n! 判据：从第几跳开始丢，且此后每跳都丢 = 该跳之后拥塞或故障\n! 只有第一跳丢、后面不丢 = 我方出口策略问题，不是运营商\n!\n! === 报障话术（照抄，省得来回扯皮）===\n! 我方已完成：端口状态正常、收光 XX dBm、自环正常、\n! 分段 ping 至第 X 跳开始丢包 XX%、CRC 无增长。\n! 请核查该电路在贵司侧光路与设备端口。',
    note: '运营商最常回的一句是「我方测试正常」。破解办法不是吵，是把光功率、环回、分段 ping 三张证据一起甩过去——有数据的工单从来不会被挂起。'
  },
  {
    id: 'tpl-sdwan-sla',
    kw: ['sd-wan', 'sdwan', 'sla选路'],
    cat: '项目场景',
    name: 'SD-WAN 应用级 SLA 选路策略',
    vendor: '华为 SD-WAN / 通用 CLI',
    code: '! === 1. 先定业务等级，再谈选路 ===\n! Gold  ：ERP / 视频会议 —— 时延 < 50ms，丢包 < 0.1%，抖动 < 20ms\n! Silver：OA / 邮件      —— 时延 < 100ms，丢包 < 1%\n! Bronze：下载 / 备份    —— 无 SLA，走最便宜的链路\n!\n! === 2. 每根 WAN 链路一个探测实例，5 秒一次 ===\nnqa test-instance admin mpls_probe\n test-type icmp\n destination-address <对端POP>\n frequency 5\n probe-count 5\n timeout 2\n start now\n!\nnqa test-instance admin inet_probe\n test-type icmp\n destination-address <公网探测点>\n frequency 5\n start now\n!\n! === 3. 应用识别 + 策略路由落地形态 ===\nacl number 3001\n rule 5 permit tcp destination-port eq 5060\n rule 10 permit udp destination-port eq 3478\ntraffic classifier VOICE operator or\n if-match acl 3001\ntraffic behavior VOICE\n redirect ip-nexthop <MPLS-下一跳>\ntraffic policy SDWAN_VOICE\n classifier VOICE behavior VOICE\ninterface GigabitEthernet0/0/1\n traffic-policy SDWAN_VOICE inbound\n!\n! === 4. 切换阈值：必须有迟滞，否则抖动时来回切 ===\n! 劣化判定：连续 3 个周期超标才切走\n! 恢复判定：连续 6 个周期达标才切回\n! 迟滞设小了，开会每 30 秒断一次，比不切还惨\n!\n! === 5. 验证 ===\ndisplay nqa results test-instance admin mpls_probe\ndisplay nqa results test-instance admin inet_probe',
    note: 'SD-WAN 项目失败八成不是选路算法不行，是阈值没设迟滞。开会时链路抖一下就切、切回来又抖，用户体验比单一专线还差。'
  },
  {
    id: 'tpl-voice-qos',
    kw: ['语音qos', '视频qos', '端到端qos'],
    cat: 'QoS 模板',
    name: '语音视频端到端 QoS（接入→出口）',
    vendor: '华为 VRP8',
    code: '! === 接入层：话机自己打标，交换机信任 ===\ninterface GigabitEthernet0/0/1\n trust dscp\n! 话机一般打 EF(46)，软终端 AF41(34)\n! PC 直连的口绝对不要 trust，否则用户能自己把下载标成 EF\n!\n! === 汇聚 / 核心：每一跳都要保留队列 ===\ndiffserv domain voice\n 8021p 5 map ef\n ip-dscp ef map ef\n!\ninterface 10GE1/0/1\n qos phb marking enable\n trust dscp\n!\n! === 出口：整形 + 优先级队列 ===\ninterface GigabitEthernet0/0/2\n qos shaping cir 100000 kbps\n!\ntraffic classifier VOICE operator or\n if-match dscp ef\ntraffic behavior VOICE\n queue ef\n!\ntraffic classifier SIG operator or\n if-match dscp af41\ntraffic behavior SIG\n queue af bandwidth 2000\n!\n! === 调度原则 ===\n! 语音走 PQ（绝对优先），其余走 WRR\n! 语音队列预留不超过总带宽 1/3，否则把信令饿死\n!\n! === 验证：抓一次真实通话看双向 DSCP 是否一致 ===\ndisplay qos queue statistics interface GigabitEthernet0/0/2\n! VOICE 队列出现 drop = 整形带宽算小了，不是标记错了\n!\n! === 端到端口诀 ===\n! 打标准（话机）→ 信任对（接入）→ 保留住（核心）→ 整形好（出口）→ 统计验证',
    note: '语音质量问题九成出在「只配了接入层」：话机标记对了，中间核心没 trust DSCP，出接口又把 EF 重标成 0，一路白做。QoS 要跳跳配，不能只配一头。'
  },
  {
    id: 'tpl-dc-underlay',
    kw: ['spine-leaf', 'underlay', '数据中心组网'],
    cat: '数据中心模板',
    name: '数据中心 Spine-Leaf Underlay 规划模板',
    vendor: 'Arista EOS / 华为 CE',
    code: '! === 1. 地址规划（每链路一个 /31，loopback 每台一个 /32）===\n! 点对点网段：10.0.0.0/24 起，按 Spine 编号分段\n! Loopback：10.0.1.N/32，同时作为 BGP router-id 与 VTEP 源\n! 每台设备预留 4 个 loopback：管理、BGP、VTEP、带外\n!\n! === 2. Spine 侧（Arista EOS）===\ninterface Ethernet1\n no switchport\n mtu 9214\n ip address 10.0.0.1/31\n!\nrouter bgp 65000\n router-id 10.0.1.1\n maximum-paths 8\n neighbor LEAF peer group\n neighbor LEAF remote-as 65001\n neighbor LEAF bfd\n neighbor LEAF ebgp-multihop 3\n neighbor LEAF allowas-in\n neighbor 10.0.1.11 remote-as 65001\n neighbor 10.0.1.11 peer group LEAF\n!\n! === 3. Leaf 侧（华为 CE 写法）===\ninterface 10GE1/0/1\n undo portswitch\n mtu 9214\n ip address 10.0.0.2 31\n!\nbgp 65001\n router-id 10.0.1.11\n peer 10.0.0.1 as-number 65000\n peer 10.0.0.1 bfd enable\n maximum load-balancing 8\n!\n! === 4. 上线必查 5 项（漏一项后期必出诡异问题）===\n! MTU 全路径 9214，含 VTEP 封装开销，否则大包偶发黑洞\n! BFD 全开，收敛从 180s 降到 200ms 以内\n! ECMP 哈希含 src/dst IP + L4 port，否则大象流全撞一条\n! 互联口关 STP、关无关发现协议\n! 时间同步（PTP 优先，NTP 兜底），否则排障日志对不上\n!\n! === 5. 验证 ===\nshow ip bgp summary\nshow ip route 10.0.1.11/32\nshow interfaces counters errors\n! 每个 Leaf 应看到 N 条等价路径（N = Spine 数量）',
    note: 'Underlay 出问题 90% 是三件事：MTU 没统一、BFD 没开、ECMP 哈希不散。三者上线当天都不会报错，等你上生产跑大流量才炸。'
  },
  {
    id: 'tpl-tshoot-card',
    kw: ['故障定界', '排障速查', '分层排除'],
    cat: '运维模板',
    name: '故障定界速查卡（分层排除法）',
    vendor: '通用',
    code: '! === 万能顺序：物理 → 链路 → 网络 → 传输 → 应用 ===\n! 通就往上查，不通往下查；一层没排除，绝不查上一层\n!\n! 第 1 层 物理\ndisplay interface brief\n! down/down = 线、光模块或对端没开机\n! up/down   = 对端没配或端口 shutdown\ndisplay transceiver diagnosis interface X\n! 收光 -3 ~ -20dBm 正常；低于 -25 换模块或报障\n!\n! 第 2 层 链路\ndisplay mac-address interface X\ndisplay lldp neighbor brief\n! 看不到对端 LLDP = 中间有透明设备，或对端没开\ndisplay stp brief\n! 环路、异常阻塞端口先看这里\n!\n! 第 3 层 网络\ndisplay ip routing-table <目标>\ndisplay arp | include <网关IP>\n! 网关 ping 不通但 ARP 有表项 = 网关设备问题，不是线路\n!\n! 第 4 层 传输\ntelnet <目标> <端口>\n! 端口不通先查中间 ACL 与防火墙策略，别急着查应用\n!\n! 第 5 层 应用\n! 网络层已排除干净，让对方查服务进程与日志\n!\n! === 一句话口诀 ===\n! 换线换口换模块，ping 网关 ping 对端，\n! 逐跳 trace 找拐点，通上不通下。',
    note: '排障慢通常不是技术不够，是跳步——物理层还 down 着就去查路由表。这张卡贴工位，按顺序走，绝大多数故障 5 分钟内能定界。'
  },
  {
    id: 'tpl-iot-vlan',
    kw: ['物联网', '摄像头接入', '门禁接入', 'iot隔离'],
    cat: '安全模板',
    name: '物联网（摄像头 / 门禁 / 仪表）接入隔离模板',
    vendor: '华为 VRP8',
    code: '! === 1. 单独 VLAN + 单独网段，绝不复用办公段 ===\nvlan 900\n description IoT-Devices\n!\ninterface Vlanif 900\n ip address 10.90.0.1 255.255.255.0\n!\n! === 2. 端口配置：只允许 IoT 设备接进来 ===\ninterface GigabitEthernet 0/0/20\n port link-type access\n port default vlan 900\n stp edged-port enable\n port-isolate enable group 1\n! port-isolate 让同 VLAN 的设备互相不通——一台被控不会横向扩散\n!\n! === 3. 只允许访问它自己的平台，其余全拒 ===\nacl number 3900\n rule 5 permit ip source 10.90.0.0 0.0.0.255 destination 10.90.1.10 0\n rule 10 permit ip source 10.90.0.0 0.0.0.255 destination 10.90.1.11 0\n rule 15 permit udp source 10.90.0.0 0.0.0.255 destination 10.90.0.1 0 destination-port eq 123\n rule 100 deny ip\n!\ninterface Vlanif 900\n traffic-filter inbound acl 3900\n!\n! === 4. 禁掉 IoT 段访问互联网（除非业务确有需要）===\n! 需要外网的就单独开白名单域名，别直接放通\n!\n! === 5. 开启基础防护 ===\ninterface GigabitEthernet 0/0/20\n storm-control broadcast min-rate 500\n storm-control multicast min-rate 500\n! 摄像头广播风暴是经典事故，限一下能救整个接入层\n!\n! === 6. 验证 ===\ndisplay vlan 900\ndisplay acl 3900\n! 从办公网 ping 10.90.0.20 应该不通，从平台服务器应该通',
    note: '物联网段最大的风险是「默认密码设备被控后横向扫全公司」。隔离三件套：单独 VLAN、端口隔离、只放行平台 IP——这三条加上去，即使设备被控也炸不开。'
  },
  {
    id: 'tpl-5g-backup',
    kw: ['4g备份', '5g备份', '备份线路切换'],
    cat: '项目场景',
    name: '4G/5G 备份线路自动切换模板',
    vendor: '华为 VRP8',
    code: '! === 1. 备份链路基础配置 ===\ninterface Cellular0/0/0\n apn-profile 5GNET\n ip address negotiate\n!\napn-profile 5GNET\n apn gdnet\n!\n! === 2. 探测主链路（关键：不探测就不知道什么时候该切）===\nnqa test-instance admin track_main\n test-type icmp\n destination-address 10.1.1.1\n frequency 5\n probe-count 3\n timeout 2\n start now\n!\nnqa test-instance admin track_backup\n test-type icmp\n destination-address 10.90.0.1\n frequency 10\n start now\n!\n! === 3. 用 track + 静态路由做浮动 ===\nip route-static 0.0.0.0 0 200.1.1.1 preference 60 track nqa admin track_main\nip route-static 0.0.0.0 0 Cellular0/0/0 preference 80 track nqa admin track_backup\n! 主链路探测失败 → 默认路由失效 → 自动走备份\n! preference 越小越优先，备份设大值\n!\n! === 4. 回切必须加延迟（否则抖动时来回切）===\n! 主链路恢复后不要立刻切回：连续 6 个探测周期（30 秒）达标再切\n! 华为可用 route-monitor 或控制器侧策略实现\n!\n! === 5. NAT：备份链路要单独做地址转换 ===\nacl number 2000\n rule 5 permit source 10.10.0.0 0.0.255.255\n!\ninterface Cellular0/0/0\n nat outbound 2000\n!\n! === 6. MTU / MSS（5G 隧道最常见的坑）===\ninterface Cellular0/0/0\n tcp adjust-mss 1360\n! 不调的表现：能 ping 通、微信能发文字、网页和图片全打不开\n!\n! === 7. 验证 ===\ndisplay nqa results test-instance admin track_main\ndisplay ip routing-table 0.0.0.0\ndisplay cellular 0/0/0 all',
    note: '备份链路最常见的失败不是切不过去，是「切过去以后再也没切回来」，或者切过去发现 MTU 不对业务照样不通。上线当天一定要做一次真拔线测试。'
  },
  {
    id: 'tpl-rack-baseline',
    kw: ['机柜上架', '端口基线', '机柜配置'],
    cat: '运维模板',
    name: '新机柜上架与端口基线模板',
    vendor: '华为 VRP8',
    code: '! === 1. 上架前先定的三件事 ===\n! U 位规划：重设备在下，交换机在中，理线架紧邻设备\n! 双路供电：A 路接 UPS-1，B 路接 UPS-2，双电源分插\n! 空 U 位全部装盲板（性价比最高的降温手段）\n!\n! === 2. 交换机基础配置（一次性配完，避免后期返工）===\nsysname CORE-RACK-A-01\n!\nvlan batch 10 20 30 99\n!\n! 管理 VLAN 单独划，不与管理地址混在业务段\ninterface Vlanif 99\n ip address 10.99.0.11 255.255.255.0\n!\n! === 3. 上联口（万兆，做聚合）===\ninterface Eth-Trunk 1\n port link-type trunk\n port trunk allow-pass vlan 10 20 30\n mode lacp-static\n!\ninterface 10GE1/0/49\n eth-trunk 1\ninterface 10GE1/0/50\n eth-trunk 1\n!\n! === 4. 服务器接入口基线（每个口都照这个配）===\ninterface 10GE1/0/1\n description SRV-APP-01_eth0\n port link-type access\n port default vlan 20\n stp edged-port enable\n! 服务器口一律 edged-port，避免 STP 收敛慢导致开机网络起不来\n!\n! === 5. 安全与运维基线 ===\nstelnet server enable\nundo telnet server enable\nundo http server enable\n!\nsnmp-agent\nsnmp-agent sys-info version v3\nsnmp-agent target-host trap address udp-domain 10.99.0.100 params securityname NMSv3 v3\n!\nntp-service unicast-server 10.99.0.100\ninfo-center enable\ninfo-center loghost 10.99.0.100\n!\n! === 6. 保存并记录基线 ===\nsave\ndisplay current-configuration > 上架基线.txt\ndisplay interface brief\ndisplay mac-address\n! 交付时把配置、端口表、拓扑图三份一起归档',
    note: '新机柜最容易被跳过的是「服务器口开 edged-port」和「双电源分插」。前者影响服务器重启后多久能通网，后者决定一次 UPS 故障会不会带走整个机柜。'
  },
  {
    id: 'tpl-capacity-collect',
    kw: ['容量采集', '带宽基线', '流量采集'],
    cat: '运维模板',
    name: '容量采集与带宽基线命令集',
    vendor: '华为 VRP8 / Linux',
    code: '! === 1. 采集口径（先统一，不然数据没法比）===\n! 采样周期：5 分钟\n! 统计数据：入向/出向 bps、错包、丢包、CPU、内存\n! 保存时长：至少 3 个月（要覆盖一个月度高峰）\n! 判据：用 P95 而不是平均值\n!\n! === 2. 设备侧一次性取全 ===\ndisplay interface brief\ndisplay interface | include rate\ndisplay cpu-usage\ndisplay memory-usage\ndisplay counters rate inbound interface\ndisplay counters rate outbound interface\n!\n! === 3. 只看关键链路（大网别全采，采不过来）===\n! 出口、核心互联、服务器区上联、专线——这四类必采\ndisplay interface 10GE1/0/49 | include rate\n!\n! === 4. Linux 侧采样（服务器/网关）===\n# 每 5 分钟记一次，追加写，别覆盖\nwhile true; do\n  date +%s >> /var/log/bw.log\n  cat /proc/net/dev | grep -E "eth0|eth1" >> /var/log/bw.log\n  sleep 300\ndone\n!\n! === 5. SNMP 批量采集（ifHCInOctets 用 64 位计数器，避免回绕）===\nsnmpwalk -v3 -l authPriv -u monitor -a SHA -A <pwd> -x AES -X <pwd> \\\n  10.1.1.1 1.3.6.1.2.1.31.1.1.1.6\n! 关键：一定用 ifHCInOctets（64 位），32 位计数器在千兆口 5 分钟就回绕\n!\n! === 6. 出报告时的三个必备数字 ===\n! P95 利用率、峰值出现时间点、按当前增速的触顶预估月数\n! 只有这三个数字能推动扩容决策，平均值不能',
    note: '扩容申请被驳回，多数是因为报告里只有「平均利用率」。改成 P95 + 峰值时段 + 触顶预估，同样的数据，通过率完全不一样——这是网络工程师向上沟通最实用的一招。'
  },
  {
    id: 'tpl-nat-server-mix',
    kw: ['nat server', '源nat', '回流处理', 'nat混合'],
    cat: 'NAT 模板',
    name: 'NAT Server + 源 NAT 混合（含回流处理）',
    vendor: '华为 VRP8',
    code: '! === 1. 前提：先分清内网、外网、服务器三个地址 ===\n! 内网网段 10.10.0.0/24，外网口 200.1.1.1/30，服务器 10.10.0.10\n!\n! === 2. 源 NAT（内网上网）===\nacl number 2000\n rule 5 permit source 10.10.0.0 0.0.0.255\n!\ninterface GigabitEthernet 0/0/1\n description WAN\n ip address 200.1.1.1 255.255.255.252\n nat outbound 2000\n!\n! === 3. NAT Server（外网访问内部服务器）===\n! 把 200.1.1.1:8080 映射到 10.10.0.10:80\ninterface GigabitEthernet 0/0/1\n nat server protocol tcp global current-interface 8080 inside 10.10.0.10 80\n!\n! 一组连续端口（如视频流）用 global 端口段\n! nat server protocol tcp global current-interface 9000 9010 inside 10.10.0.10 9000 9010\n!\n! === 4. 内网用户访问自己的公网地址（NAT 回流 / Hairpin）===\n! 不做这一步的表现：外网能访问，内网自己访问不了，很常见的怪现象\n! 华为多数版本自动支持同接口回流，若不通需手动加：\ninterface GigabitEthernet 0/0/1\n nat server protocol tcp global 200.1.1.1 8080 inside 10.10.0.10 80\n! 或在内网侧做 DNS 分离：内网解析到私网地址，外网解析到公网地址\n! 后者更省设备性能，也是更推荐的做法\n!\n! === 5. 安全策略 / ACL（NAT 只是地址转换，不是安全控制）===\nacl number 3000\n rule 5 permit tcp destination 10.10.0.10 0 destination-port eq 80\n rule 10 deny ip\n!\ninterface GigabitEthernet 0/0/0\n traffic-filter inbound acl 3000\n!\n! === 6. 验证 ===\ndisplay nat outbound\ndisplay nat server\ndisplay nat session all\n! 从外网 telnet 200.1.1.1 8080 测试；从内网 ping 公网地址测试回流',
    note: 'NAT 三件套最容易漏的是「回流」——外网能开、内网打不开，客户投诉时最难解释。最省事的解法不是配 hairpin，而是内网 DNS 直接解析到私网地址。'
  },
  {
    id: 'tpl-ipv6-dualstack',
    kw: ['ipv6接入', 'ipv6地址', 'ra配置', 'dhcpv6'],
    cat: 'IPv6 模板',
    name: 'IPv6 双栈接入模板（地址 / RA / DHCPv6）',
    vendor: '华为 VRP8',
    code: '! === 1. 全局开启 IPv6 ===\nipv6\n!\n! === 2. 汇聚/核心互联用 /64 或 /127 ===\ninterface Vlanif 10\n ipv6 enable\n ipv6 address 2001:DB8:10::1/64\n! 点对点互联推荐 /127，节省地址且避免 ND 攻击面\n! interface Vlanif 100\n!  ipv6 address 2001:DB8:FF::1/127\n!\n! === 3. 终端网段：RA 通告（有状态 / 无状态两条路）===\ninterface Vlanif 20\n ipv6 enable\n ipv6 address 2001:DB8:20::1/64\n undo ipv6 nd ra halt\n ipv6 nd ra-interval 30\n ipv6 nd ra-lifetime 1800\n ipv6 nd prefix 2001:DB8:20::/64 2592000 604800\n!\n! 模式一：SLAAC（无状态，终端自己生成地址，最省事）\n ipv6 nd autoconfig managed-address-flag off\n ipv6 nd autoconfig other-flag off\n!\n! 模式二：DHCPv6 有状态（要审计、要按 MAC 分配时用）\n! ipv6 nd autoconfig managed-address-flag on\n! dhcpv6 pool P20\n!  address prefix 2001:DB8:20::/64\n!  excluded-address 2001:DB8:20::1 to 2001:DB8:20::FF\n!  dns-server 2001:DB8:20::53\n!\n! === 4. DNS（RA 里也可以带，DHCPv6 里也可以带）===\n! ipv6 nd ra dns-server 2001:DB8:20::53\n!\n! === 5. 路由：IPv6 默认路由 ===\nipv6 route-static :: 0 2001:DB8:FF::2\n!\n! === 6. 安全：RA Guard 防私接路由器发假 RA ===\n! 接入口一律不发 RA，只允许上联口发\ninterface GigabitEthernet 0/0/5\n ipv6 nd ra halt\n ipv6 nd rogue-ra attack-detect enable\n!\n! === 7. 验证 ===\ndisplay ipv6 interface brief\ndisplay ipv6 nd ra\ndisplay ipv6 routing-table\n! 终端上：ipconfig /all（Windows）或 ip -6 addr（Linux）\n! 看到 2001:DB8:20: 开头的地址 + 默认网关，才算通',
    note: 'IPv6 上线最常见的两个坑：一是忘了 undo ipv6 nd ra halt，终端拿不到地址；二是接入口没禁 RA，被人插一台路由器就把整段流量劫走。'
  },
  {
    id: 'tpl-ac-side',
    kw: ['ac旁挂', '旁挂组网', 'ac配置'],
    cat: '无线模板',
    name: 'AC 旁挂组网模板（AP 上线 + 业务下发）',
    vendor: '华为 VRP8',
    code: '! === 1. 拓扑前提：AC 旁挂在核心旁，AP 管理流量走单独 VLAN ===\n! AP 管理 VLAN 100（10.100.0.0/24），业务 VLAN 200/201\n! 核心与接入之间是 trunk，放行 100/200/201\n!\n! === 2. AC 侧基础 ===\nvlan batch 100 200 201\n!\ninterface Vlanif 100\n ip address 10.100.0.2 255.255.255.0\n!\n! === 3. AP 上线靠 DHCP Option 43 找到 AC ===\n! DHCP 服务器上（可在核心）：\n! ip pool AP\n!  gateway-list 10.100.0.1\n!  network 10.100.0.0 mask 255.255.255.0\n!  option 43 sub-option 2 ip-address 10.100.0.2\n! 关键：option 43 的格式依厂商而定，华为是 sub-option 2 + AC 地址\n!\n! === 4. AC 源接口与 CAPWAP ===\ncapwap source interface Vlanif 100\n!\n! === 5. AP 认证方式（MAC 认证最省事，也最常用）===\nwlan\n ap auth-mode mac-auth\n ap-id 1 ap-mac 00e0-fc00-0001\n  ap-name AP-3F-01\n  ap-group name default\n!\n! 白名单模式：只允许登记过的 AP 上线，防私接 AP\n! ap auth-mode no-auth 便于测试，但生产环境别用\n!\n! === 6. 业务下发（SSID + 转发模式）===\n wlan\n  security-profile name SEC-WPA2\n   security wpa2 psk pass-phrase <PASSWORD> aes\n  ssid-profile name SSID-OFFICE\n   ssid Office-WiFi\n  vap-profile name VAP-OFFICE\n   forward-mode tunnel\n   service-vlan vlan-id 200\n   ssid-profile SSID-OFFICE\n   security-profile SEC-WPA2\n  ap-group name default\n   vap-profile VAP-OFFICE wlan 1 radio all\n!\n! forward-mode tunnel：业务流量回 AC 转发，安全可控\n! forward-mode direct：本地转发，AC 压力小，适合大流量场景\n!\n! === 7. 验证 ===\ndisplay ap all\ndisplay ap online-fail-record all\ndisplay station all\ndisplay vap ssid Office-WiFi\n! AP 上线失败先看 online-fail-record，原因写得很清楚',
    note: 'AP 上不了线，九成在三处：Option 43 没配、CAPWAP 源接口选错 VLAN、中间链路没放行管理 VLAN。先看 online-fail-record，比盲猜快得多。'
  },
  {
    id: 'tpl-qos-priority',
    kw: ['业务优先', '出口限速', '优先级配置'],
    cat: 'QoS 模板',
    name: '关键业务优先 + 出口限速模板',
    vendor: '华为 VRP8',
    code: '! === 1. 先分类：把流量分成五类就够，别分太细 ===\n! EF  语音（RTP，UDP 端口段）\n! AF41 视频会议\n! AF31 关键业务（ERP / 数据库）\n! AF11 普通办公\n! BE   其余（下载 / 更新）\n!\n! === 2. 用 ACL 或 DSCP 打标（终端不打标就按端口/网段分）===\nacl number 3001\n rule 5 permit udp destination-port range 16384 32767\nacl number 3002\n rule 5 permit tcp destination-port eq 443 source 10.10.1.0 0.0.0.255\n!\ntraffic classifier CLS-VOICE operator or\n if-match acl 3001\ntraffic classifier CLS-KEY operator or\n if-match acl 3002\ntraffic classifier CLS-OTHER operator or\n if-match any\n!\n! === 3. 行为：打 DSCP + 指定队列 ===\ntraffic behavior BH-VOICE\n remark dscp ef\n queue ef\ntraffic behavior BH-KEY\n remark dscp af31\n queue af3\ntraffic behavior BH-OTHER\n remark dscp default\n queue wfq weight 10\n!\n! === 4. 策略：绑定 ===\ntraffic policy POL-WAN\n classifier CLS-VOICE behavior BH-VOICE precedence 1\n classifier CLS-KEY behavior BH-KEY precedence 2\n classifier CLS-OTHER behavior BH-OTHER precedence 3\n!\n! === 5. 出口应用（上行方向）===\ninterface GigabitEthernet 0/0/1\n traffic-policy POL-WAN outbound\n!\n! === 6. 接口限速（比队列更硬的手段，用于防一条链路被拖死）===\ninterface GigabitEthernet 0/0/1\n qos car outbound cir 100000 cbs 1250000\n! 出口是 100M 就设 90~95M，留余量给突发和协议报文\n! 设成满值的效果是：一拥堵就先丢关键报文\n!\n! === 7. 验证 ===\ndisplay traffic policy user-defined POL-WAN\ndisplay qos queue statistics interface GigabitEthernet 0/0/1\ndisplay interface GigabitEthernet 0/0/1 | include rate\n! 看队列丢弃计数：EF 队列应该几乎不丢，BE 队列丢是正常的',
    note: 'QoS 最容易做错的是「分类太细」和「出口限速设成满值」。前者配完自己都记不清，后者等于在拥堵时先丢语音。留 5~10% 余量这条，比任何队列参数都管用。'
  },
  {
    id: 'tpl-mlag-tor',
    kw: ['m-lag', 'mlag', '双活tor', '服务器双归'],
    cat: '数据中心模板',
    name: 'M-LAG 双活 ToR 模板（服务器双归接入）',
    vendor: '华为 VRP8',
    code: '! === 1. 前提：两台 ToR 做 M-LAG，服务器双网卡分别上联 ===\n! ToR-A：10.0.0.1   ToR-B：10.0.0.2   虚拟 IP（VIP）：10.0.0.254\n!\n! === 2. DFS 组（peer-link 走双口聚合，必须直连）===\ninterface Eth-Trunk 100\n description Peer-Link\n mode lacp-static\n!\ninterface 100GE1/0/1\n eth-trunk 100\ninterface 100GE1/0/2\n eth-trunk 100\n!\ndfs-group 1\n source ip 10.0.0.1\n priority 150\n!\n! === 3. 接口加入 M-LAG（两台设备配置一致）===\ninterface Eth-Trunk 10\n description To-Server\n mode lacp-static\n dfs-group 1 m-lag 10\n!\ninterface 25GE1/0/1\n eth-trunk 10\n!\n! === 4. 服务器到交换机：跨设备聚合 ===\n! 服务器侧（Linux bond / Windows NIC team）用 802.3ad（LACP）\n! 两台 ToR 的 Eth-Trunk 编号必须一致，否则服务器看到的是两条独立链路\n!\n! === 5. 网关放哪：推荐分布式网关（两台都有 VIP）===\ninterface Vlanif 200\n ip address 10.20.0.252 255.255.255.0\n mac-address 0000-5e00-0101\n vrrp vrid 1 virtual-ip 10.20.0.1 active\n! 或用 anycast 网关模式，两台设备网关 MAC/IP 完全相同\n!\n! === 6. peer-link 的流量必须限制（关键）===\n! peer-link 只是控制与异常兜底通道，正常业务流量不能走它\n! 否则两台上联同时故障时，peer-link 会被打满导致 M-LAG 分裂\ntraffic-filter inbound acl 3999\n!\n! === 7. 验证 ===\ndisplay dfs-group 1 m-lag brief\ndisplay dfs-group 1 m-lag 10\ndisplay eth-trunk 10\n! 服务器侧：cat /proc/net/bonding/bond0 应看到两个 slave 都 up\n! 拔一台 ToR 的电源，业务应无感切换',
    note: 'M-LAG 最危险的不是配错，是「peer-link 承载了业务流量」——平时看不出问题，等上联全断时 peer-link 被打爆，两台设备同时脑裂。这条要在上线前就限流。'
  }
];

module.exports = { TPLS };
