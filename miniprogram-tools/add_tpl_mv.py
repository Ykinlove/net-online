import io, os

P = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js')
s = io.open(P, encoding='utf-8').read()
if 'tpl-zte-base' in s:
    print('已存在，跳过')
    raise SystemExit

NEW = r'''
  /* ============ 多厂商开局模板（第 23 轮补充） ============ */
  {
    id: 'tpl-cisco-base',
    cat: '开局模板',
    name: '思科 IOS 交换机开局模板',
    vendor: '思科 IOS',
    code: '! 1. 命名与时钟\nhostname SW-Access-01\nclock timezone CST 8 0\nntp server <NTP-IP>\n!\n! 2. 管理 VLAN 与地址\nvlan 10\n name MGMT\ninterface Vlan10\n ip address <MGMT-IP> <MASK>\n no shutdown\nip default-gateway <GW-IP>\n!\n! 3. 账号与 SSH\nenable secret <ENABLE-PWD>\nusername admin privilege 15 secret <PASSWORD>\nip domain-name example.local\ncrypto key generate rsa modulus 2048\nip ssh version 2\nline vty 0 4\n login local\n transport input ssh\n!\n! 4. 保存\nend\nwrite memory',
    note: '二层交换机用 ip default-gateway 出管理网，三层交换机要改写成 ip route 0.0.0.0 0.0.0.0 <GW-IP>。crypto key 生成完 SSH 才起得来，顺序别倒。'
  },
  {
    id: 'tpl-h3c-base',
    cat: '开局模板',
    name: 'H3C Comware7 开局模板',
    vendor: 'H3C Comware7',
    code: 'sysname SW-Access-01\nclock timezone Beijing add 08:00:00\nntp-service unicast-server <NTP-IP>\n!\nvlan 10\n description MGMT\ninterface Vlan-interface10\n ip address <MGMT-IP> <MASK>\n!\nip route-static 0.0.0.0 0 <GW-IP>\n!\nlocal-user admin class manage\n password simple <PASSWORD>\n service-type ssh\n authorization-attribute user-role network-admin\n!\nssh server enable\nline vty 0 4\n authentication-mode scheme\n protocol inbound ssh\n!\nsave force',
    note: 'H3C 三个必踩点：① Vlan-interface 带横线（不是 Vlanif）② local-user 必须 class manage 才登得上 ③ save force 免得交互卡住。'
  },
  {
    id: 'tpl-ruijie-base',
    cat: '开局模板',
    name: '锐捷 RGOS 开局模板',
    vendor: '锐捷 RGOS',
    code: 'hostname SW-Access-01\nclock timezone 8\n!\nvlan 10\n name MGMT\ninterface VLAN 10\n ip address <MGMT-IP> <MASK>\n!\nip route 0.0.0.0 0.0.0.0 <GW-IP>\n!\nenable secret <ENABLE-PWD>\nusername admin privilege 15 password <PASSWORD>\n!\nip ssh version 2\nline vty 0 4\n login local\n transport input ssh\n!\nend\nwrite',
    note: '锐捷跟思科九成一样，差异在 interface VLAN 10（中间有空格）、clock timezone 只写数字、保存用 write。'
  },
  {
    id: 'tpl-zte-base',
    cat: '开局模板',
    name: '中兴 ZXR10 开局模板',
    vendor: '中兴 ZXR10',
    code: 'hostname SW-Access-01\n!\nvlan 10\n name MGMT\n!\ninterface vlan10\n ip address <MGMT-IP> <MASK>\n!\nip route 0.0.0.0 0.0.0.0 <GW-IP>\n!\nusername admin password <PASSWORD>\n!\ntelnet server disable\nssh server enable\n!\nwrite',
    note: 'ZXR10 的 SVI 是 interface vlan10 连写、查看用 show（不是 display）、保存用 write。型号/版本间命令略有差异，拿不准时先在设备上敲 ? 补全看。'
  },
  {
    id: 'tpl-junos-base',
    cat: '开局模板',
    name: 'Juniper Junos 开局模板（set 一次到底）',
    vendor: 'Juniper Junos',
    code: '# 先设 root 密码，否则 commit 会报错\nset system root-authentication encrypted-password "<HASH>"\nset system host-name SW-Access-01\nset system time-zone Asia/Shanghai\nset system ntp server <NTP-IP>\nset system login user admin class super-user\nset system services ssh\nset system services netconf ssh\n!\nset vlans MGMT vlan-id 10\nset interfaces irb unit 10 family inet address <MGMT-IP>/24\nset vlans MGMT l3-interface irb.10\n!\nset interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access\nset interfaces ge-0/0/0 unit 0 family ethernet-switching vlan members MGMT\n!\nset routing-options static route 0.0.0.0/0 next-hop <GW-IP>\n!\n# 检查后提交\nshow | compare\ncommit',
    note: 'Junos 开局三步：set 一串 → show | compare 核对 → commit 生效。密码哈希用 set system root-authentication plain-text-password 交互输入更省事。'
  },
  {
    id: 'tpl-eos-base',
    cat: '开局模板',
    name: 'Arista EOS 交换机开局模板',
    vendor: 'Arista EOS',
    code: 'hostname leaf-01\n!\nvlan 10\n   name MGMT\n!\ninterface Vlan10\n   ip address <MGMT-IP>/24\n!\nip route 0.0.0.0/0 <GW-IP>\n!\nusername admin privilege 15 secret <PASSWORD>\n!\nmanagement api http-commands\n   no shutdown\n!\nend\ncopy running-config startup-config',
    note: 'EOS 地址写 CIDR（10.1.10.2/24），不用掩码点分。开启 eAPI 后可以用 REST/JSON 批量下发；配置支持 checkpoint 回滚，改错不用手敲。'
  },
  /* ============ IPv6 / 无线 / 路由 / 割接 ============ */
  {
    id: 'tpl-v6-dual',
    cat: 'IPv6 模板',
    name: 'IPv6 双栈开局模板（IPv4 不动，加一层 v6）',
    vendor: '华为 VRP8',
    code: 'ipv6\n!\nvlan batch <VLAN-A> <VLAN-B>\n!\ninterface Vlanif<VLAN-A>\n ip address <V4-GW> 255.255.255.0\n ipv6 enable\n ipv6 address <V6-PREFIX>::1/64\n undo ipv6 nd ra halt\n ipv6 nd ra prefix <V6-PREFIX>::/64 2592000 604800\n ipv6 nd ra dns server <V6-DNS>\n!\ninterface GigabitEthernet0/0/1\n port link-type trunk\n port trunk allow-pass vlan <VLAN-A> <VLAN-B>\n!\nipv6 route-static :: 0 <V6-NEXT-HOP>',
    note: '三个必做项：① 全局 ipv6 ② 接口 ipv6 enable ③ undo ipv6 nd ra halt——RA 默认是停的，不关掉终端永远拿不到地址、也学不到默认路由。'
  },
  {
    id: 'tpl-wlan-ac',
    cat: '无线模板',
    name: '华为 AC 开局模板（AP 上线 + 放 SSID）',
    vendor: '华为 AC VRP',
    code: 'vlan batch <AP-VLAN> <USER-VLAN>\n!\ndhcp enable\ninterface Vlanif<USER-VLAN>\n ip address <USER-GW> 255.255.255.0\n dhcp select interface\n!\ncapwap source interface Vlanif<AP-VLAN>\n!\nwlan\n regulatory-domain-profile name CN\n  country-code cn\n security-profile name SEC-WPA2\n  security wpa2 psk pass-phrase <PASSWORD> aes\n ssid-profile name SSID-OFFICE\n  ssid <SSID-NAME>\n vap-profile name VAP-OFFICE\n  service-vlan vlan-id <USER-VLAN>\n  ssid-profile SSID-OFFICE\n  security-profile SEC-WPA2\n ap-group name AP-GROUP-1\n  vap-profile VAP-OFFICE wlan 1 radio all',
    note: 'AP 上不了线先查三处：capwap source 指对没有、AP 和 AC 三层通不通（option 43 / DNS）、国家码建没建。VAP 三件套（ssid / security / vap）少一个 SSID 就发不出来。'
  },
  {
    id: 'tpl-ospf-multi',
    cat: '三层模板',
    name: 'OSPF 多区域模板（含 ABR 汇总与接口认证）',
    vendor: '华为 VRP8',
    code: 'ospf 1 router-id <ROUTER-ID>\n area 0.0.0.0\n  network <CORE-NET> 0.0.0.255\n area 0.0.0.1\n  network <BRANCH-NET> 0.0.0.255\n  abr-summary <SUMMARY-NET> 255.255.0.0\n!\ninterface GigabitEthernet0/0/24\n ospf cost 10\n ospf authentication-mode md5 1 cipher <KEY>\n!\ndisplay ospf peer brief\ndisplay ospf routing',
    note: '所有非骨干区域必须挂到 area 0（否则邻居起不来）；ABR 上做 abr-summary 把明细压成一条，分支再多核心路由表也不炸。认证两端 key-id 和密钥必须一致。'
  },
  {
    id: 'tpl-cutover-back',
    cat: '运维模板',
    name: '割接回退清单模板（改之前先写好退路）',
    vendor: '华为 VRP8',
    code: '# === 割接前 30 分钟 ===\ndisplay current-configuration > flash:/before.cfg\ntftp <BACKUP-IP> put flash:/before.cfg SW1-before.cfg\nsave\n# 顺带记下：接口状态 / 路由表 / 在线用户数\ndisplay interface brief\ndisplay ip routing-table\ndisplay users\n\n# === 割接中：每步留痕，写清「改了什么、怎么退」 ===\n# Step 1 加 VLAN 20    回退：undo vlan 20\n# Step 2 改 trunk 放行   回退：port trunk allow-pass vlan <原列表>\n\n# === 回退（按严重程度选） ===\n# 轻：只退这一步\nundo <本次命令>\n# 中：恢复备份配置\nstartup saved-configuration before.cfg\nreboot\n# 重：整机回到出厂（仅限新设备，慎用）\nreset saved-configuration',
    note: '割接真正的保命动作是「提前写好回退命令」，不是现场想。备份要落在别的机器上（设备 flash 一起坏的情况真有）。观察窗口至少 30 分钟再走人。'
  }
'''

idx = s.rindex('];')
s = s[:idx] + NEW + s[idx:]
io.open(P, 'w', encoding='utf-8').write(s)
print('模板已追加')
