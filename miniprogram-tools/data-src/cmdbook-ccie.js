/* CCIE EI（企业基础设施）专题——思科体系。
   华为 HCIE / 华三 H3CIE 的对应内容在 cmdbook-hcie.js / cmdbook-hcip.js，
   这里只放思科独有或思科为考点原点的技术：DMVPN Phase 2/3、FlexVPN、GETVPN、
   Nexus VXLAN 多站点、TrustSec、uRPF。
   命令全部对照思科官方配置指南（IOS/IOS-XE 15.x、NX-OS 9.3）核实；
   随版本差异大的语法在 tip 里明确提醒。 */
const CCIE_EXTRA = [
  {
    id: 'ccie-dmvpn-p2',
    devs: ['Router'],
    name: 'DMVPN Phase 2 完整配置（Hub + Spoke + IPSec）',
    kw: [
      'dmvpn phase 2', 'dmvpn p2', 'dmvpn二阶段', '分支互联', 'spoke to spoke', 'ngre',
      'mgre', 'nhrp map', 'dmvpn配置', '多点gre'
    ],
    cmds: [
      ['思科（Hub）', 'crypto keyring DMVPN-KEYRING\n pre-shared-key address 0.0.0.0 0.0.0.0 key cisco123\n!\ncrypto isakmp profile DMVPN-ISAKMP-PROFILE\n keyring DMVPN-KEYRING\n match identity address 0.0.0.0\n!\ncrypto ipsec transform-set DMVPN-TS esp-aes 256 esp-sha-hmac\n mode tunnel\n!\ncrypto ipsec profile DMVPN-IPSEC-PROFILE\n set transform-set DMVPN-TS\n set ikev1-profile DMVPN-ISAKMP-PROFILE\n!\ninterface Tunnel0\n description DMVPN-HUB\n ip address 172.16.0.1 255.255.255.0\n no ip redirects\n ip mtu 1400\n ip nhrp authentication cisco\n ip nhrp map multicast dynamic\n ip nhrp network-id 1\n ip nhrp server-only\n ip ospf network broadcast\n ip ospf priority 255\n ip tcp adjust-mss 1360\n delay 1000\n tunnel source GigabitEthernet0/0\n tunnel mode gre multipoint\n tunnel key 100\n tunnel protection ipsec profile DMVPN-IPSEC-PROFILE\n!\nrouter ospf 1\n network 172.16.0.0 0.0.0.255 area 0'],
      ['思科（Spoke）', 'crypto keyring DMVPN-KEYRING\n pre-shared-key address 202.1.1.1 key cisco123\n!\ncrypto isakmp profile DMVPN-ISAKMP-PROFILE\n keyring DMVPN-KEYRING\n match identity address 202.1.1.1\n!\ncrypto ipsec transform-set DMVPN-TS esp-aes 256 esp-sha-hmac\n mode tunnel\n!\ncrypto ipsec profile DMVPN-IPSEC-PROFILE\n set transform-set DMVPN-TS\n set ikev1-profile DMVPN-ISAKMP-PROFILE\n!\ninterface Tunnel0\n description DMVPN-SPOKE\n ip address 172.16.0.100 255.255.255.0\n no ip redirects\n ip mtu 1400\n ip nhrp authentication cisco\n ip nhrp map 172.16.0.1 202.1.1.1\n ip nhrp map multicast 202.1.1.1\n ip nhrp nhs 172.16.0.1\n ip nhrp network-id 1\n ip nhrp shortcut\n ip ospf network broadcast\n ip ospf priority 0\n ip tcp adjust-mss 1360\n tunnel source GigabitEthernet0/0\n tunnel mode gre multipoint\n tunnel key 100\n tunnel protection ipsec profile DMVPN-IPSEC-PROFILE']
    ],
    tip: 'CCIE 高频题。三个必配项：① mGRE 的 mtu 1400 + ip tcp adjust-mss 1360——GRE 头 + IPSec 头吃掉 100 字节，不调 MSS 大包必卡；② Hub 用 ip nhrp server-only（Spoke 只向 Hub 注册），Spoke 用 ip nhrp nhs 指向 Hub 内网地址；③ 加密用 crypto ipsec profile 挂在 tunnel protection 下，比 crypto map 干净。排错：show dmvpn（看隧道和 NHRP 状态）、show ip nhrp（Spoke 有没有注册上）、show crypto session。Phase 2 的流量特点是 Spoke 间第一包仍绕 Hub，之后才可能走直连——要全程最优路径就上 Phase 3。'
  },
  {
    id: 'ccie-dmvpn-p3',
    devs: ['Router'],
    name: 'DMVPN Phase 3（NHRP Redirect 触发分支直连）',
    kw: ['dmvpn phase 3', 'dmvpn p3', 'dmvpn三阶段', 'nhrp redirect', 'nhrp shortcut', 'dmvpn优化路径', '分支直连'],
    cmds: [
      ['思科（Hub）', 'interface Tunnel0\n description DMVPN-HUB-P3\n ip address 172.16.0.1 255.255.255.0\n no ip redirects\n ip mtu 1400\n ip nhrp authentication cisco\n ip nhrp network-id 1\n ip nhrp redirect\n ip ospf network broadcast\n ip ospf priority 255\n ip tcp adjust-mss 1360\n delay 1000\n tunnel source GigabitEthernet0/0\n tunnel mode gre multipoint\n tunnel key 100\n tunnel protection ipsec profile DMVPN-IPSEC-PROFILE\n!\nrouter ospf 1\n network 172.16.0.0 0.0.255.255 area 0'],
      ['思科（Spoke）', 'interface Tunnel0\n description DMVPN-SPOKE-P3\n ip address 172.16.0.100 255.255.255.0\n no ip redirects\n ip mtu 1400\n ip nhrp authentication cisco\n ip nhrp map 172.16.0.1 202.1.1.1\n ip nhrp map multicast 202.1.1.1\n ip nhrp nhs 172.16.0.1\n ip nhrp network-id 1\n ip nhrp shortcut\n ip ospf network broadcast\n ip ospf priority 0\n ip tcp adjust-mss 1360\n tunnel source GigabitEthernet0/0\n tunnel mode gre multipoint\n tunnel key 100\n tunnel protection ipsec profile DMVPN-IPSEC-PROFILE']
    ],
    tip: 'Phase 2 换 Phase 3 的核心就是 Hub 上一行：ip nhrp server-only 换成 ip nhrp redirect。机制：Spoke 间流量第一包仍送 Hub，Hub 发现对端 Spoke 也直连着自己，就用 NHRP Redirect 通知源 Spoke「有更近的路」，源 Spoke 随即向目标 Spoke 发 NHRP 解析、建直连隧道并刷新路由（靠 shortcut）。好处是路由汇总可以做得更狠（Hub 只发汇总，Spoke 间靠 redirect 自愈）。坑：① 两端 tunnel key 和 nhrp network-id 必须一致，否则 Hub 根本认不出这是自家 Spoke；② Spoke 在 NAT 后面时 Hub 需要 ip nhrp shortcut 配合静态映射，动态场景建议上 nhrp redirect + 地址池。验证：show ip nhrp redirect（看 redirect 计数）、show dmvpn（Spoke 间出现 H 标志说明直连隧道已建）。'
  },
  {
    id: 'ccie-flexvpn',
    devs: ['Router'],
    name: 'FlexVPN IKEv2 站点到站点（虚拟模板 + 自动寻址）',
    kw: [
      'flexvpn', 'ikev2 vpn', 'ikev2 站点到站点', '虚拟模板vpn', 'ip address negotiated', 'ikev2 profile',
      'site-to-site ikev2'
    ],
    cmds: [
      ['思科（Hub）', 'crypto ikev2 keyring FLEX-KEYRING\n peer SPOKES\n  address 0.0.0.0 0.0.0.0\n  pre-shared-key local cisco123\n  pre-shared-key remote cisco123\n!\ncrypto ikev2 authorization policy FLEX-AUTH\n pool FLEX-POOL\n def-domain cisco.com\n!\ncrypto ikev2 profile FLEX-PROFILE\n match identity remote address 0.0.0.0\n authentication local pre-share\n authentication remote pre-share\n keyring local FLEX-KEYRING\n aaa authorization group psk list FLEX-AUTH default\n virtual-template 1\n!\nip local pool FLEX-POOL 172.16.1.1 172.16.1.254\n!\ninterface Virtual-Template1 type tunnel\n ip unnumbered GigabitEthernet0/0\n ip ospf 1 area 0\n tunnel protection ipsec profile default'],
      ['思科（Spoke）', 'crypto ikev2 keyring FLEX-KEYRING\n peer HUB\n  address 202.1.1.1\n  pre-shared-key local cisco123\n  pre-shared-key remote cisco123\n!\ncrypto ikev2 profile FLEX-PROFILE\n match identity remote address 202.1.1.1 255.255.255.255\n authentication local pre-share\n authentication remote pre-share\n keyring local FLEX-KEYRING\n!\ninterface Tunnel0\n ip address negotiated\n tunnel source GigabitEthernet0/0\n tunnel mode ipsec ipv4\n tunnel destination 202.1.1.1\n tunnel protection ipsec profile FLEX-PROFILE']
    ],
    tip: '思科推的 DMVPN 现代替代，IKEv2 原生形态。三个和 DMVPN 完全不同的点：① 地址是协商来的——Spoke 接口写 ip address negotiated，Hub 侧 ip local pool + crypto ikev2 authorization policy 下发，Spoke 搬家不用改配置；② Hub 不配置物理隧道接口，用 virtual-template 动态派生， Spoke 连进来才创建 Virtual-Access；③ 认证走 IKEv2 profile（可叠 EAP 证书），密钥环按 peer 地址段匹配。也能和 DMVPN 混跑（FlexVPN spoke 挂 NHRP）。排错：show crypto ikev2 session（IKE SA）、show crypto ikev2 sa detail、show derived-config interface Virtual-Access1（看协商出来的地址）。'
  },
  {
    id: 'ccie-getvpn',
    devs: ['Router'],
    name: 'GETVPN 组加密（GDOI，流量不过密钥服务器）',
    kw: ['getvpn', 'gdoi', '组加密vpn', 'group encrypted', 'gdoi group', '密钥服务器', 'ks gm', '组播vpn加密'],
    cmds: [
      ['思科（KS 密钥服务器）', 'crypto key generate rsa general-keys modulus 2048 label GETVPN-KEY\n!\ncrypto gdoi group GETVPN-GROUP\n identity number 100\n server local\n  rekey authentication mypubkey rsa GETVPN-KEY\n  rekey transport unicast\n  sa ipsec 1\n   profile GETVPN-IPSEC-PROFILE\n   match address ipv4 GETVPN-ACL\n   replay time window absolute 100\n  address ipv4 202.1.1.1\n!\ncrypto ipsec profile GETVPN-IPSEC-PROFILE\n set transform-set GETVPN-TS\n!\ncrypto ipsec transform-set GETVPN-TS esp-aes 256 esp-sha-hmac\n!\nip access-list extended GETVPN-ACL\n permit ip 10.0.0.0 0.255.255.255 10.0.0.0 0.255.255.255'],
      ['思科（GM 组成员）', 'crypto gdoi group GETVPN-GROUP\n identity number 100\n server address ipv4 202.1.1.1\n!\ncrypto map GETVPN-MAP 10 gdoi\n set group GETVPN-GROUP\n!\ninterface GigabitEthernet0/0\n crypto map GETVPN-MAP']
    ],
    tip: '和传统点对点 IPSec 最大的区别：组内任意两台 GM 之间直接加密通信，流量不过 KS，KS 只负责用 GDOI 协议统一下发/更换组密钥（TEK）。所以适合语音、视频、组播这种「网状 + 实时」的大网，也支持组播/广播（原始 IP 头保留，不像隧道模式全封装）。identity number 是组的身份证，KS 和 GM 必须一致，配错了最常见的现象是 GM 一直卡在 GDOI_REGISTER。验证：show crypto gdoi group（GM 看注册状态和密钥版本）、show crypto gdoi ks members（KS 看都有谁）、show crypto gdoi sa。rekey 相关排错重点看 KS 的 RSA key 有没有 generate、时间同步（NTP）对不对。'
  },
  {
    id: 'ccie-vxlan-multisite',
    devs: ['Switch', 'Router'],
    name: 'VXLAN BGP EVPN 多站点（Border Leaf DCI 互联）',
    kw: [
      'vxlan多站点', 'evpn多站点', '多站点', 'dci', 'border leaf', 'rt重写',
      'rewrite-evpn-rt', '跨站点vxlan', '多fabric', '两个数据中心', '跨数据中心', '数据中心互联',
      '两个 dc 互联'
    ],
    cmds: [
      ['思科 Nexus', 'nv overlay evpn\nfeature bgp\nfeature interface-vlan\n!\ninterface loopback0\n ip address 10.1.1.1/32\n!\ninterface Ethernet1/1\n  no switchport\n  mtu 9216\n  ip address 172.20.1.1/30\n  ip ospf network point-to-point\n  ip router ospf underlay area 0.0.0.0\n!\nrouter ospf underlay\n!\nrouter bgp 65001\n  address-family l2vpn evpn\n  template peer DCI-PEER\n    remote-as 65002\n    update-source loopback0\n    ebgp-multihop 2\n    address-family l2vpn evpn\n      send-community\n      send-community extended\n      rewrite-evpn-rt-as-needed\n  neighbor 10.2.2.2\n    inherit peer-session DCI-PEER\n    address-family l2vpn evpn\n      send-community\n      send-community extended\n      rewrite-evpn-rt-as-needed']
    ],
    tip: '两个站点各是一套独立 VXLAN Fabric（各自 underlay、各自 VNI 规划），中间用 Border Leaf（或独立 Border Gateway）通过 DCI 链路建 eBGP EVPN 邻居。三个必考点：① rewrite-evpn-rt-as-needed——两个站点常用相同 VNI/RT，不重写对端导入不了，这是多站点能不能通的第一开关；② send-community extended——EVPN 路由的 RT 是扩展团体属性，不发它 RT 根本传不过去；③ DCI 链路 mtu 9216，VXLAN 封装比 underlay 路径更怕分片。进阶是 Site-of-Origin（SoO）扩展团体防环：一个站点的路由绕回本端时直接拒。验证：show bgp l2vpn evpn（路由有没有收到并导入）、show nve vni（VNI 表项）、show bgp l2vpn evpn neighbors（DCI 邻居状态）。'
  },
  {
    id: 'ccie-trustsec',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'TrustSec 安全组访问（SGT 打标 + SXP 传播 + SGACL）',
    kw: ['trustsec', 'sgt', 'sgacl', 'sxp', '安全组', 'cts', '安全组标记', '基于sgt的acl', 'cts manual'],
    cmds: [
      ['思科（凭证与打标）', 'cts credentials id SW1 password Cisco123\n!\ninterface GigabitEthernet0/1\n cts manual\n  policy static sgt 10\n  sap pmk 12345678901234567890123456789012'],
      ['思科（SXP 传播）', 'cts sxp enable\ncts sxp default password Cisco123\ncts sxp connection peer 10.1.1.2 password default mode local speaker\n!\nip access-list extended SGACL-VOICE-TO-DATA\n permit udp any eq 5060 any\n!\ncts role-based permissions from 10 to 20 SGACL-VOICE-TO-DATA']
    ],
    tip: 'TrustSec 解决的是「按角色而不是按 IP 做策略」。三步走：① 分类——入口给流量打 SGT（安全组标签），来源可以是 802.1X 授权、接口静态 cts manual、或防火墙回注；② 传播——SGT-IP 映射通过 SXP（SGT Exchange Protocol）传给不支持 native tagging 的老交换机，上游就能知道「这个 IP 属于哪个组」；③ 执行——出口按「源 SGT → 目的 SGT」查 SGACL 放行或拒绝，IP 怎么变都不影响策略。native tagging 的设备（Catalyst 3850/9000 系）数据面直接在帧里带 SGT（sap pmk 是手动模式的对端密钥）， legacy 设备才需要 SXP。SGACL 的完整语法各版本差异不小，以 cts role-based ? 在线帮助为准。验证：show cts interface（打标情况）、show cts sxp connections（SXP 邻居）、show cts environment-data（拿到的 SGT 列表）。'
  },
  {
    id: 'ccie-urpf',
    devs: ['Router', '防火墙'],
    name: 'uRPF 单播反向路径转发（防源地址欺骗）',
    kw: ['urpf', '反向路径', '源地址校验', 'rpfc', '防源ip欺骗', 'ip verify', '反向路径转发', '防私设ip'],
    cmds: [
      ['思科（松散模式）', 'interface GigabitEthernet0/0\n ip verify unicast source reachable-vrx allow-default'],
      ['思科（严格模式）', 'ip access-list 10\n permit 10.1.1.0 0.0.0.255\n!\ninterface GigabitEthernet0/1\n ip verify unicast reverse-path 10 allow-self-ping'],
      ['思科（VRF-Aware）', 'ip access-list 100\n permit ip 10.1.1.0 0.0.0.255 any\n!\ninterface GigabitEthernet0/2\n ip verify unicast source reachable-vrx 100']
    ],
    tip: '防源 IP 欺骗的第一道闸：收到包先拿源地址查 FIB，假装出来的地址直接丢。三种模式按场景选：① 严格（reverse-path）——源地址必须在 FIB 里且入接口等于 FIB 算出的出接口，防伪造最狠，但不对称路由（流量从一个口进、CEF 从另一个口出）会误杀，多出口场景慎用；② 松散（reachable-vrx）——源地址在 FIB 即可，不校验接口，适合路由不对称的互联网侧；③ VRF-Aware——多 VRF 环境按 ACL 判断源属于哪个 VRF，防跨 VRF 冒充。坑：allow-default 放行匹配默认路由的源（防默认路由把所有源判死）；allow-self-ping 放行设备 ping 自己。验证：show ip traffic 看 uRPF drop 计数、show cef drop 看具体丢因。'
  },
  {
    id: 'ccie-eem',
    devs: ['Router', 'Switch'],
    name: 'EEM 嵌入式事件管理器（事件触发自动执行）',
    kw: ['eem', 'embedded event manager', 'applet', '事件管理器', '自动执行', '自动巡检', 'event manager'],
    cmds: [
      ['思科（syslog 触发）', 'event manager applet MON-LINK-DOWN\n event syslog pattern "Interface GigabitEthernet0/0, changed state to down"\n action 1.0 cli command "enable"\n action 2.0 cli command "show ip interface brief"\n action 3.0 mail server 10.1.1.5 to admin@corp.com from router@corp.com subject "Link Down" body "Gi0/0 down"'],
      ['思科（跟踪对象联动）', 'track 1 ip route 8.8.8.8 255.255.255.255 reachability\n!\nevent manager applet FAILOVER\n event track 1 state any\n action 1.0 cli command "enable"\n action 2.0 cli command "configure terminal"\n action 3.0 cli command "interface GigabitEthernet0/1 shutdown"'],
      ['思科（CLI 审计）', 'event manager applet CFG-AUDIT\n event cli pattern ".*write.*" sync yes\n action 1.0 syslog msg "Config saved by $cli_user"']
    ],
    tip: '设备级自动化，不用外部服务器。三类事件最常用：① syslog pattern——日志里出现什么就触发，正则匹配；② track 对象——IP SLA 探测失败触发切换动作（配合 ccie-sla-track 的浮动路由/HSRP）；③ cli pattern——有人敲匹配的命令就记账/告警（配置审计）。坑：action 里多个命令要逐条 enable/config 切换；环境变量 $cli_user、$_event_syslog_msg 可直接用在 action 文本里；默认同时最多跑 20 条 policy，超了不执行。验证：show event manager policy registered（已注册）、show event manager policy active（在跑）、show event manager history events（执行历史）。'
  },
  {
    id: 'ccie-guest-shell',
    devs: ['Router', 'Switch'],
    name: 'Guest Shell + 设备端 Python（on-box 脚本）',
    kw: ['guest shell', 'iox', 'on-box python', '设备上跑python', 'guestshell run', 'python on box', '设备内嵌python'],
    cmds: [
      ['思科（启用与进入）', 'configure terminal\n iox\n!\nguestshell run bash\nguestshell run python3'],
      ['思科（装包与文件）', 'guestshell run pip install netmiko requests\nguestshell run cp /bootflash/script.py .\nguestshell run python3 /bootflash/script.py']
    ],
    tip: 'IOS-XE 里跑一个 Linux 容器（CentOS 7），设备本地就能执行 Python——连本机 RESTCONF、批量连别的设备、本地日志分析都行。两个入口：① guestshell run 逐条执行；② guestshell enable 常驻交互 shell。文件放在 bootflash 上和 Guest Shell 共享，脚本路径直接写 /bootflash/xxx.py。注意：先要 iox 启用（部分平台要装 IOX 镜像）；pip 装的包重启 Guest Shell 后还在（装在持久化目录）。如果脚本逻辑简单、不想起容器，直接用 EEM 3.0 的 action python bootflash:/xxx.py 更快。验证：show app-hosting list、guestshell run uname -a。'
  },
  {
    id: 'ccie-restconf',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'RESTCONF / YANG API（HTTPS 管理设备）',
    kw: [
      'restconf', 'yang api', 'restconf配置', 'api调设备', 'application/yang-data+json', 'netconf api',
      'yang-data', 'https管理设备'
    ],
    cmds: [
      ['思科（启用）', 'configure terminal\n ip http secure-server\n restconf\n!\ncrypto pki trustpoint TP-SELF-SIGNED\n enrollment selfsigned\n subject-name cn=IOS-XE\n revocation-check none\n rsakeypair SELF\n!\ncrypto pki enroll TP-SELF-SIGNED'],
      ['思科（客户端调用）', 'curl -i -k -u admin:cisco -H "Accept: application/yang-data+json" \\\n https://10.1.1.1/restconf/data/ietf-interfaces:interfaces\n\ncurl -i -k -u admin:cisco -H "Content-Type: application/yang-data+json" -X PUT \\\n -d \'{"ietf-interfaces:interface":{"name":"Lo0","enabled":true}}\' \\\n https://10.1.1.1/restconf/data/ietf-interfaces:interfaces/interface=Lo0']
    ],
    tip: 'NETCONF 的 HTTP 兄弟：用普通 REST 风格（GET/PUT/POST/DELETE + JSON）读写设备的 YANG 模型，比 NETCONF 的 XML 好写太多，是 SDN 控制器和自研平台管设备的主流接口。常见容器：/restconf/data/ietf-interfaces:interfaces（接口）、/restconf/data/Cisco-IOS-XE-native:native（厂商全量模型）、/restconf/data/ietf-routing:routing-state（路由状态）。坑：① 必须先 ip http secure-server 再 restconf；② 自签证书要 crypto pki enroll 后才生效，客户端 -k 跳过校验；③ 认证用本地用户，权限不够会 403。排错：show platform software yang-management process、浏览器访问 https://设备/.well-known/host-meta 看根资源。'
  },
  {
    id: 'ccie-ansible',
    devs: ['服务器'],
    name: 'Ansible 网络自动化（批量推配置/采状态）',
    kw: ['ansible', 'ansible playbook', '批量配置', 'ios_config', '网络自动化', 'ansible 网络', 'iac', 'ansible 批量'],
    cmds: [
      ['Ansible（清单）', '# inventory.ini\n[ios]\nr1 ansible_host=10.1.1.1 ansible_network_os=ios\nr2 ansible_host=10.1.1.2 ansible_network_os=ios\n\n[ios:vars]\nansible_user=admin\nansible_password=cisco123\nansible_connection=ansible.netcommon.network_cli'],
      ['Ansible（Playbook）', '# pb.yml\n- name: 批量配置接口描述\n  hosts: ios\n  gather_facts: no\n  tasks:\n    - name: 改描述\n      cisco.ios.ios_config:\n        lines:\n          - description Configured-by-Ansible\n        parents: interface GigabitEthernet0/1\n    - name: 采接口状态\n      cisco.ios.ios_facts:\n        gather_subset: interfaces\n    - name: 跑 show version\n      cisco.ios.ios_command:\n        commands:\n          - show version\n      register: out\n    - debug:\n        var: out.stdout_lines'],
      ['Ansible（执行）', 'ansible-playbook -i inventory.ini pb.yml\nansible -i inventory.ini ios -m cisco.ios.ios_command -a "commands=\'show ip int brief\'"']
    ],
    tip: '批量管理的正解：playbook 一次推 N 台，幂等（重复执行不反复改）。四个核心模块：ios_config（推配置，parents 定位配置节）、ios_command（跑 show 拿文本）、ios_facts（采结构化状态）、resource 模块（ios_interfaces/ios_bgp 等按模型管理）。坑：① ansible_connection 必须是 network_cli，默认 ssh 连不上网络设备；② 批量执行前用 --check 或 -l r1 先拿一台试；③ 认证别写死在 playbook 里，用 ansible-vault encrypt 或环境变量。日常还有 ios_backup（定期备份配置）配 git 做配置版本管理。'
  },
  {
    id: 'ccie-netflow',
    devs: ['Router', 'Switch'],
    name: 'Flexible NetFlow（流量采集送分析平台）',
    kw: [
      'netflow', 'flexible netflow', 'flow monitor', 'flow exporter', '流量采集', '网络流量分析',
      'flow record', '谁在占用带宽', '看谁占带宽', '谁占带宽', '占带宽', '带宽占用',
      '谁占了带宽', '流量排名'
    ],
    cmds: [
      ['思科（定义与绑定）', 'flow record NF-RECORD\n match ipv4 source address\n match ipv4 destination address\n match ipv4 protocol\n match transport source-port\n match transport destination-port\n collect counter bytes\n collect counter packets\n collect timestamp sys-uptime first\n!\nflow exporter NF-EXPORTER\n destination 10.1.1.200\n source GigabitEthernet0/0\n transport udp 2055\n template data timeout 60\n!\nflow monitor NF-MONITOR\n record NF-RECORD\n exporter NF-EXPORTER\n cache timeout active 60\n!\ninterface GigabitEthernet0/0\n ip flow monitor NF-MONITOR input'],
      ['思科（采样降负载）', 'sampler NF-SAMPLER\n mode random 1 out-of 100\n!\ninterface GigabitEthernet0/1\n ip flow monitor NF-MONITOR input sampler NF-SAMPLER']
    ],
    tip: '回答「带宽被谁占了」的标准姿势。三层结构：record 定义采什么字段（match 七元组 + collect 字节数/包数）、exporter 定义送到哪（UDP 2055 默认）、monitor 把两者绑起来挂接口。两件事必须做：① cache timeout active 60——活跃流 60 秒导一次，不配就永远不导；② 高流量口挂 sampler，1/100 采样能把 NetFlow 自身开销砍掉 99%。验证：show flow monitor NF-MONITOR cache（当前流）、show flow exporter statistics（导出计数）。注意它是抽样统计，不是逐包镜像——要原始包用端口镜像。'
  },
  {
    id: 'ccie-sla-track',
    devs: ['Router', 'Switch', '防火墙'],
    name: 'IP SLA + Track（链路质量探测联动路由/网关）',
    kw: ['ip sla', 'sla探测', 'track', '浮动静态路由', 'hsrp track', '链路质量探测', 'sla icmp-echo', '主备链路自动切换'],
    cmds: [
      ['思科（探测 + 浮动路由）', 'ip sla 1\n icmp-echo 8.8.8.8 source-interface GigabitEthernet0/0\n frequency 5\n threshold 1000\n!\nip sla schedule 1 life forever start-time now\n!\ntrack 1 ip sla 1 reachability\n!\nip route 0.0.0.0 0.0.0.0 10.1.1.1 track 1\nip route 0.0.0.0 0.0.0.0 10.2.2.2 10'],
      ['思科（HSRP 联动）', 'interface GigabitEthernet0/0.100\n encapsulation dot1Q 100\n ip address 192.168.1.2 255.255.255.0\n standby 1 ip 192.168.1.1\n standby 1 priority 110\n standby 1 preempt\n standby 1 track 1 decrement 30']
    ],
    tip: '「接口 up 不等于路通」的解法：用 IP SLA 主动探测对端（icmp-echo / tcp-connect / udp-echo / http / dhcp / dns），track 对象把探测结果变成路由看得懂的状态。两个经典组合：① 浮动静态路由——主下一跳跟 track 绑定，探测失败自动切备份链路；② HSRP 联动——standby 1 track 1 decrement 30，上行断了主动让出 Gateway。坑：ip sla schedule 忘配，探测根本不跑；frequency 多数版本最快 1 秒；threshold 是触发 syslog 的阈值不是判定失败。验证：show ip sla statistics 1（成功/失败计数）、show ip sla configuration 1、show track 1。'
  },
  {
    id: 'ccie-flexconnect',
    devs: ['AC', 'AP'],
    name: 'FlexConnect 分支 AP 本地转发（WAN 断网不断认证）',
    kw: ['flexconnect', '分支ap', 'ap本地转发', '本地交换', 'flex ap', '分支无线', 'ap本地转发'],
    cmds: [
      ['思科 WLC', 'config ap mode flexconnect Cisco_AP_Name\n!\nconfig flexconnect group FG1 add ap Cisco_AP_Name\nconfig flexconnect group FG1 radius auth set add 1\nconfig flexconnect group FG1 radius acct set add 1\n!\nconfig wlan flexconnect local-switching enable 1\n!\nconfig ap flexconnect native-vlan-id 1 Cisco_AP_Name']
    ],
    tip: '分支办公网无线的标准解法。两种转发模式：central switching（数据回总部 WLC，分支带宽全被吃）和 local switching（数据本地转发，CAPWAP 隧道只走控制和认证，省 90% 分支带宽）。三个开关：① AP 切 flexconnect 模式；② WLAN 上开 local-switching；③ FlexConnect AP Group 里配本地认证/计费服务器——配了本地认证，分支 WAN 断了客户端照样能连上无线（凭证缓存在 AP 上）。验证：show flexconnect group summary、show ap config general Cisco_AP_Name（看 AP 模式和 VLAN 映射）。'
  },
  {
    id: 'ccie-mdns',
    devs: ['AC', 'AP'],
    name: 'mDNS 网关（AirPlay/投屏跨网段发现）',
    kw: ['mdns', 'mdns网关', 'airplay', 'chromecast', 'airprint', '投屏跨网段', '苹果投屏', '隔网段投屏', 'bonjour'],
    cmds: [
      ['思科 WLC', 'config mdns profile create default-mdns\nconfig mdns profile default-mdns add service AirPlay\nconfig mdns profile default-mdns add service Google-Chromecast\nconfig mdns profile default-mdns add service AirPrint\n!\nconfig mdns profile default-mdns query-interval 15\n!\nconfig wlan mdns profile 1 default-mdns']
    ],
    tip: '解决「手机投屏找不到客厅电视」——mDNS（ Bonjour ）是链路本地组播 224.0.0.251，不过三层，无线客户端和投屏盒子不在一个网段就互相看不见。WLC 当 mDNS 网关：缓存/代理/按需中继这些组播发现报文，还能按位置限制（只转发同楼层的 AirPlay，别让全公司都搜到）。要点：① 服务按需加（AirPlay/Chromecast/AirPrint/DIAL），全加会增加负担；② 位置感知（location-aware）避免跨楼层乱推；③ 投屏盒子和手机最好在同一 WLAN 或做 Bonnie 映射。验证：show mdns profile summary、show mdns service all。'
  },
  {
    id: 'ccie-pim-bidir',
    devs: ['Router'],
    name: 'PIM Bidirectional 双向共享树（多对多组播）',
    kw: ['pim bidir', 'bidir', '双向树', '共享树双向', '双向pim', '多对多组播', '组播双向'],
    cmds: [
      ['思科', 'ip multicast-routing\n!\ninterface GigabitEthernet0/0\n ip pim sparse-mode\n ip pim bidir-enable\n!\nip pim rp-address 10.1.1.1 100\n!\n! 或者只让指定组走 bidir RP\nip access-list standard BIDIR-GROUPS\n permit 239.1.0.0 0.0.255.255\n!\nip pim rp-address 10.2.2.2 BIDIR-GROUPS bidir']
    ],
    tip: '组播三种树里最适合「多对多」的一种：任何源都往同一个组发、任何接收者都收（典型：金融行情群发、视频会议矩阵）。和 ASM 的关键区别：共享树双向（(*,G) 状态，无 (S,G)）、RP 是数据中转点不只是控制点、RP 上不做 RPF 检查。所以 RP 必须放在带宽最好的位置，RP 挂了整组瘫。DF（Designated Forwarder）选举决定每段共享树谁往 RP 方向发包，多个源同时发时 DF 也要处理多播源冲突。坑：接口级 ip pim bidir-enable 不能漏，漏了那段树退化成 ASM。验证：show ip pim rp mapping、show ip mroute bidirectional（看 bidir 组的 (*,G) 和 OIL）。'
  },
  {
    id: 'ccie-macsec',
    devs: ['Router', 'Switch'],
    name: 'MACsec 802.1AE 二层链路加密',
    kw: ['macsec', '802.1ae', '二层加密', '链路加密', 'mka', '光纤加密', '二层ipsec', '线速加密'],
    cmds: [
      ['思科（手工密钥）', 'mka policy 1\n key-server-priority 10\n macsec-cak 12345678901234567890123456789012\n send-secure-announcements\n!\ninterface GigabitEthernet0/0\n mka policy 1'],
      ['思科（调优）', 'mka policy 1\n sak-rekey-interval 60\n macsec replay-protection window-size 10\n!\nshow macsec interface GigabitEthernet0/0']
    ],
    tip: '和 IPSec 的本质区别：MACsec 在二层加密整个以太帧（ARP、CDP 全都包进去），IPSec 只加密三层以上（ARP 还是裸奔）。用于楼宇间光纤、DC 互联这类「物理链路可能被窃听」的场景，硬件 ASIC 线速加密不损性能。两端必须都支持（Catalyst 3850/9000、ASR、Nexus 9K）。关键机制：MKA（MACsec Key Agreement）自动协商 SAK，key-server 由 key-server-priority 最大者担任；SAK 定期重协商（sak-rekey-interval）防长期用同一把密钥。验证：show macsec interface X（看 CAK 状态、SAK 重协商计数、加解密字节数）。'
  },
  {
    id: 'ccie-6vpe',
    devs: ['Router'],
    name: '6VPE / 6PE（IPv6 over MPLS 骨干）',
    kw: ['6vpe', 'ipv6 vpn', 'vpnv6', 'ipv6 mpls', '6pe', 'ipv6 over mpls', 'ipv6 vpn', 'vpnv6地址族'],
    cmds: [
      ['思科（6VPE）', 'ip vrf V6VPN\n rd 100:1\n route-target export 100:1\n route-target import 100:1\n!\naddress-family ipv6\n!\ninterface GigabitEthernet0/0\n ip vrf forwarding V6VPN\n ipv6 address 2001:DB8::1/64\n!\nrouter bgp 100\n address-family vpnv6\n  neighbor 10.1.1.2 activate\n  neighbor 10.1.1.2 send-community extended\n!\nrouter bgp 100\n address-family ipv6 vrf V6VPN\n  redistribute connected'],
      ['思科（6PE）', 'router bgp 100\n address-family ipv6\n  neighbor 10.2.2.2 activate\n  neighbor 10.2.2.2 send-label\n  allocate-label all']
    ],
    tip: 'IPv4 MPLS 骨干上跑 IPv6 的两条路，CCIE 高频辨析题：① 6PE——用现成的 VPNv4 标签承载 IPv6 前缀，**没有 VRF 隔离**，本质是公网 IPv6 接入，配置简单（ipv6 地址族 + send-label + allocate-label）；② 6VPE——每客户一个 VRF，走 **VPNv6 地址族**，RD/RT 全链路，和 L3VPN 架构完全一致，适合 IPv6 VPN 商业业务。坑：6PE 的 allocate-label 老命令是 allocate-label all（per-nexthop 也可但 all 最省事）；PE-CE 跑 IPv6 IGP 时 remember to redistribute。验证：show bgp vpnv6 unicast all summary（6VPE）、show bgp ipv6 unicast summary（6PE）、show mpls forwarding-table。'
  },
  {
    id: 'ccie-wlc-ha-sso',
    devs: ['AC'],
    name: 'WLC 双机热备（9800 HA / SSO，AP 秒级切换）',
    kw: ['wlc热备', '控制器双机', 'sso', '无线ha', '9800 ha', 'ap双归属', '无线控制器主备', 'wlc双机'],
    cmds: [
      ['思科 9800', 'redundancy\n mode sso\n!\nredundancy\n peer-ip 10.1.1.2\n!\nchassis redundancy-interface GigabitEthernet1\n!\nwireless config sync\n!\nshow redundancy\nshow wireless redundancy summary']
    ],
    tip: '无线控制器单点故障=全园区 AP 掉线，必须上双机。9800（IOS-XE）用 SSO：Active/Standby 全状态同步（客户端会话、AP 列表、mobility 隧道），AP CAPWAP 同时连两台，WLC 故障时 AP 秒级重连备机，客户端无感知。三个要点：① RMI（Redundancy Management Interface，Gi1 这类独立管理口）配 peer-ip 指对端；② 配置/状态同步用 wireless config sync；③ 两台软件版本必须一致，先升备机再升主机。老平台（AireOS 5508/WiSM2）叫 SSO 但配置走 config redundancy 系命令且是控制端口模式，升级场景以当前平台 show redundancy ? 为准。'
  },
  {
    id: 'ccie-sd-access',
    devs: ['Switch', 'Router'],
    name: 'SD-Access Fabric（LISP 控制面 + VXLAN 数据面）',
    kw: [
      'sd-access', 'sd access', 'fabric', 'lisp', 'sda', 'campus fabric',
      'dna center', '意图 based network', '虚拟网络'
    ],
    cmds: [
      ['思科（架构三要素）', '! 三个角色节点：\n! Control-Plane：Map-Server / Map-Resolver / PxGrid（策略同步）\n! Border：Fabric 与传统网络 / 外部域互联（VRF-lite、LISP 代理）\n! Edge：接入交换机，策略执行点（SGT/ SGACL / VN 隔离）\n! 数据面：VXLAN（L3 VNI 做 VN 间路由，L2 VNI 同子网）\n! 控制面：LISP（EID→RLOC 映射，替代 BGP EVPN）'],
      ['思科（关键排错命令）', 'show fabric summary\nshow lisp session\nshow lisp dynamic-eid detail\nshow lisp ipv4 map-cache\nshow sda summary']
    ],
    tip: '思科推的下一代园区网，和 Nexus VXLAN EVPN 最大的区别：控制面用 LISP 不用 BGP EVPN。三张网分层：Underlay（自动化的 IS-IS + PnP 零配置上线）+ Overlay（LISP 映射 + VXLAN 封装）+ 策略层（虚拟网络 VN + SGT，基于意图）。CLI 占比极低——绝大部分配置是 Catalyst Center（DNA Center）图形化推的，设备上真正要手敲的通常是排错命令。上线的坑八成都在这：① PnP 阶段 DHCP option 43 没指对 PNP 服务器，AP/交换机根本不上线；② Border 的 VRF-lite 没配对，Fabric 里能通、出不去；③ 控制节点 Map-Server 单点，没做冗余。学习重点放在「架构 + show 命令看懂状态」，别背配置。'
  },
  {
    id: 'ccie-sdwan',
    devs: ['Router'],
    name: 'SD-WAN（cEdge + OMP + 应用级选路）',
    kw: ['sd-wan', 'sdwan', 'viptela', 'omp', 'tloc', '应用选路', 'cedge', 'vmanage', '广域网加速', 'sdwan选路'],
    cmds: [
      ['思科（cEdge 引导）', 'vbond 10.1.1.1\norganization-name "corp"\n!\ncontroller-mode enable\n!\ninterface GigabitEthernet0/0/0\n description MPLS-TLOC\n ip address 10.1.1.2 255.255.255.0\n!\nsdwan\n interface GigabitEthernet0/0/0\n  tunnel-interface\n   encapsulation ipsec'],
      ['思科（验证命令）', 'show sdwan control connections\nshow sdwan omp routes\nshow sdwan tunnel statistics\nshow sdwan policy from-vsmart']
    ],
    tip: '传统广域网的换代方案。四个组件：vManage（管理面，模板化配置）、vBond（ NAT 穿透引导）、vSmart（控制面，OMP 路由+策略）、cEdge（数据面，路由器）。核心是 OMP（Overlay Management Protocol）：所有 cEdge 的 TLOC（Transport Locator，隧道端点）、路由、策略都通过 OMP 汇总到 vSmart 再分发，vSmart 是全知的策略大脑。杀手锏是应用级选路：视频会议这类丢包敏感流量自动切到质量好的链路（MPPLS 卡了切 LTE），普通流量走便宜链路。配置几乎全在 vManage 模板，设备本地只留引导三行（vbond/org/certificate）。排错三板斧：control connections（OMP 邻居起没起）、omp routes（路由收没收到）、tunnel statistics（隧道通不通、丢包多少）。'
  },
  {
    id: 'ccie-csr1000v',
    devs: ['Router'],
    name: 'CSR1000v 虚拟路由器（部署与性能要点）',
    kw: ['csr1000v', '虚拟路由器', 'csrv', '云路由器', 'aws cisco', 'azure cisco', 'csr 性能', '虚拟化路由'],
    cmds: [
      ['思科', 'show platform hardware throughput level\nshow platform hardware qfp active feature all\n!\n! 性能由 license 等级决定（安装后需 reload）\nlicense boot level ax\n!\nshow memory statistics\nshow processes cpu platform sorted\n!\n! 云上三网卡模式：管理 + 公网 + 私网\nshow ip interface brief']
    ],
    tip: 'CSR1000v 是把 IOS-XE 跑在虚机/云上的形态， AWS/Azure/GCP  marketplace 直接部署，用于云上 VPC 和本地数据中心的混合组网（通常配 SD-WAN cEdge 或 DMVPN）。三个必知：① 吞吐由 license 等级决定（standard 只有几十 Mbps，ax/appx 套餐才到 G 级），改 license 要 reload；② 性能看 QFP（数据面 ASIC 模拟进程）的 CPU，QFP 100% 才是真的忙，RP CPU 高只是控制面；③ 云上部署注意网卡角色（第一个口是管理面 GigabitEthernet1，别把公网 IP 配错口）。坑：规格缩水（vCPU/内存不足）会导致 BGP 邻居反复震荡，先看 show platform hardware throughput level 对账单再排协议。'
  }
];

module.exports = { CCIE_EXTRA };
