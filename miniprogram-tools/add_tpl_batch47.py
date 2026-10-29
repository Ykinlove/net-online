# -*- coding: utf-8 -*-
"""为第 47 批追加 5 个配置模板：补齐 NAT / IPv6 / 无线 / QoS / 数据中心 五类短板"""
import io, os

P = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js'))

T = []

T.append({
 'id': 'tpl-nat-server-mix',
 'cat': 'NAT 模板',
 'name': 'NAT Server + 源 NAT 混合（含回流处理）',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 前提：先分清内网、外网、服务器三个地址 ===
! 内网网段 10.10.0.0/24，外网口 200.1.1.1/30，服务器 10.10.0.10
!
! === 2. 源 NAT（内网上网）===
acl number 2000
 rule 5 permit source 10.10.0.0 0.0.0.255
!
interface GigabitEthernet 0/0/1
 description WAN
 ip address 200.1.1.1 255.255.255.252
 nat outbound 2000
!
! === 3. NAT Server（外网访问内部服务器）===
! 把 200.1.1.1:8080 映射到 10.10.0.10:80
interface GigabitEthernet 0/0/1
 nat server protocol tcp global current-interface 8080 inside 10.10.0.10 80
!
! 一组连续端口（如视频流）用 global 端口段
! nat server protocol tcp global current-interface 9000 9010 inside 10.10.0.10 9000 9010
!
! === 4. 内网用户访问自己的公网地址（NAT 回流 / Hairpin）===
! 不做这一步的表现：外网能访问，内网自己访问不了，很常见的怪现象
! 华为多数版本自动支持同接口回流，若不通需手动加：
interface GigabitEthernet 0/0/1
 nat server protocol tcp global 200.1.1.1 8080 inside 10.10.0.10 80
! 或在内网侧做 DNS 分离：内网解析到私网地址，外网解析到公网地址
! 后者更省设备性能，也是更推荐的做法
!
! === 5. 安全策略 / ACL（NAT 只是地址转换，不是安全控制）===
acl number 3000
 rule 5 permit tcp destination 10.10.0.10 0 destination-port eq 80
 rule 10 deny ip
!
interface GigabitEthernet 0/0/0
 traffic-filter inbound acl 3000
!
! === 6. 验证 ===
display nat outbound
display nat server
display nat session all
! 从外网 telnet 200.1.1.1 8080 测试；从内网 ping 公网地址测试回流''',
 'note': 'NAT 三件套最容易漏的是「回流」——外网能开、内网打不开，客户投诉时最难解释。最省事的解法不是配 hairpin，而是内网 DNS 直接解析到私网地址。'
})

T.append({
 'id': 'tpl-ipv6-dualstack',
 'cat': 'IPv6 模板',
 'name': 'IPv6 双栈接入模板（地址 / RA / DHCPv6）',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 全局开启 IPv6 ===
ipv6
!
! === 2. 汇聚/核心互联用 /64 或 /127 ===
interface Vlanif 10
 ipv6 enable
 ipv6 address 2001:DB8:10::1/64
! 点对点互联推荐 /127，节省地址且避免 ND 攻击面
! interface Vlanif 100
!  ipv6 address 2001:DB8:FF::1/127
!
! === 3. 终端网段：RA 通告（有状态 / 无状态两条路）===
interface Vlanif 20
 ipv6 enable
 ipv6 address 2001:DB8:20::1/64
 undo ipv6 nd ra halt
 ipv6 nd ra-interval 30
 ipv6 nd ra-lifetime 1800
 ipv6 nd prefix 2001:DB8:20::/64 2592000 604800
!
! 模式一：SLAAC（无状态，终端自己生成地址，最省事）
 ipv6 nd autoconfig managed-address-flag off
 ipv6 nd autoconfig other-flag off
!
! 模式二：DHCPv6 有状态（要审计、要按 MAC 分配时用）
! ipv6 nd autoconfig managed-address-flag on
! dhcpv6 pool P20
!  address prefix 2001:DB8:20::/64
!  excluded-address 2001:DB8:20::1 to 2001:DB8:20::FF
!  dns-server 2001:DB8:20::53
!
! === 4. DNS（RA 里也可以带，DHCPv6 里也可以带）===
! ipv6 nd ra dns-server 2001:DB8:20::53
!
! === 5. 路由：IPv6 默认路由 ===
ipv6 route-static :: 0 2001:DB8:FF::2
!
! === 6. 安全：RA Guard 防私接路由器发假 RA ===
! 接入口一律不发 RA，只允许上联口发
interface GigabitEthernet 0/0/5
 ipv6 nd ra halt
 ipv6 nd rogue-ra attack-detect enable
!
! === 7. 验证 ===
display ipv6 interface brief
display ipv6 nd ra
display ipv6 routing-table
! 终端上：ipconfig /all（Windows）或 ip -6 addr（Linux）
! 看到 2001:DB8:20: 开头的地址 + 默认网关，才算通''',
 'note': 'IPv6 上线最常见的两个坑：一是忘了 undo ipv6 nd ra halt，终端拿不到地址；二是接入口没禁 RA，被人插一台路由器就把整段流量劫走。'
})

T.append({
 'id': 'tpl-ac-side',
 'cat': '无线模板',
 'name': 'AC 旁挂组网模板（AP 上线 + 业务下发）',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 拓扑前提：AC 旁挂在核心旁，AP 管理流量走单独 VLAN ===
! AP 管理 VLAN 100（10.100.0.0/24），业务 VLAN 200/201
! 核心与接入之间是 trunk，放行 100/200/201
!
! === 2. AC 侧基础 ===
vlan batch 100 200 201
!
interface Vlanif 100
 ip address 10.100.0.2 255.255.255.0
!
! === 3. AP 上线靠 DHCP Option 43 找到 AC ===
! DHCP 服务器上（可在核心）：
! ip pool AP
!  gateway-list 10.100.0.1
!  network 10.100.0.0 mask 255.255.255.0
!  option 43 sub-option 2 ip-address 10.100.0.2
! 关键：option 43 的格式依厂商而定，华为是 sub-option 2 + AC 地址
!
! === 4. AC 源接口与 CAPWAP ===
capwap source interface Vlanif 100
!
! === 5. AP 认证方式（MAC 认证最省事，也最常用）===
wlan
 ap auth-mode mac-auth
 ap-id 1 ap-mac 00e0-fc00-0001
  ap-name AP-3F-01
  ap-group name default
!
! 白名单模式：只允许登记过的 AP 上线，防私接 AP
! ap auth-mode no-auth 便于测试，但生产环境别用
!
! === 6. 业务下发（SSID + 转发模式）===
 wlan
  security-profile name SEC-WPA2
   security wpa2 psk pass-phrase <PASSWORD> aes
  ssid-profile name SSID-OFFICE
   ssid Office-WiFi
  vap-profile name VAP-OFFICE
   forward-mode tunnel
   service-vlan vlan-id 200
   ssid-profile SSID-OFFICE
   security-profile SEC-WPA2
  ap-group name default
   vap-profile VAP-OFFICE wlan 1 radio all
!
! forward-mode tunnel：业务流量回 AC 转发，安全可控
! forward-mode direct：本地转发，AC 压力小，适合大流量场景
!
! === 7. 验证 ===
display ap all
display ap online-fail-record all
display station all
display vap ssid Office-WiFi
! AP 上线失败先看 online-fail-record，原因写得很清楚''',
 'note': 'AP 上不了线，九成在三处：Option 43 没配、CAPWAP 源接口选错 VLAN、中间链路没放行管理 VLAN。先看 online-fail-record，比盲猜快得多。'
})

T.append({
 'id': 'tpl-qos-priority',
 'cat': 'QoS 模板',
 'name': '关键业务优先 + 出口限速模板',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 先分类：把流量分成五类就够，别分太细 ===
! EF  语音（RTP，UDP 端口段）
! AF41 视频会议
! AF31 关键业务（ERP / 数据库）
! AF11 普通办公
! BE   其余（下载 / 更新）
!
! === 2. 用 ACL 或 DSCP 打标（终端不打标就按端口/网段分）===
acl number 3001
 rule 5 permit udp destination-port range 16384 32767
acl number 3002
 rule 5 permit tcp destination-port eq 443 source 10.10.1.0 0.0.0.255
!
traffic classifier CLS-VOICE operator or
 if-match acl 3001
traffic classifier CLS-KEY operator or
 if-match acl 3002
traffic classifier CLS-OTHER operator or
 if-match any
!
! === 3. 行为：打 DSCP + 指定队列 ===
traffic behavior BH-VOICE
 remark dscp ef
 queue ef
traffic behavior BH-KEY
 remark dscp af31
 queue af3
traffic behavior BH-OTHER
 remark dscp default
 queue wfq weight 10
!
! === 4. 策略：绑定 ===
traffic policy POL-WAN
 classifier CLS-VOICE behavior BH-VOICE precedence 1
 classifier CLS-KEY behavior BH-KEY precedence 2
 classifier CLS-OTHER behavior BH-OTHER precedence 3
!
! === 5. 出口应用（上行方向）===
interface GigabitEthernet 0/0/1
 traffic-policy POL-WAN outbound
!
! === 6. 接口限速（比队列更硬的手段，用于防一条链路被拖死）===
interface GigabitEthernet 0/0/1
 qos car outbound cir 100000 cbs 1250000
! 出口是 100M 就设 90~95M，留余量给突发和协议报文
! 设成满值的效果是：一拥堵就先丢关键报文
!
! === 7. 验证 ===
display traffic policy user-defined POL-WAN
display qos queue statistics interface GigabitEthernet 0/0/1
display interface GigabitEthernet 0/0/1 | include rate
! 看队列丢弃计数：EF 队列应该几乎不丢，BE 队列丢是正常的''',
 'note': 'QoS 最容易做错的是「分类太细」和「出口限速设成满值」。前者配完自己都记不清，后者等于在拥堵时先丢语音。留 5~10% 余量这条，比任何队列参数都管用。'
})

T.append({
 'id': 'tpl-mlag-tor',
 'cat': '数据中心模板',
 'name': 'M-LAG 双活 ToR 模板（服务器双归接入）',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 前提：两台 ToR 做 M-LAG，服务器双网卡分别上联 ===
! ToR-A：10.0.0.1   ToR-B：10.0.0.2   虚拟 IP（VIP）：10.0.0.254
!
! === 2. DFS 组（peer-link 走双口聚合，必须直连）===
interface Eth-Trunk 100
 description Peer-Link
 mode lacp-static
!
interface 100GE1/0/1
 eth-trunk 100
interface 100GE1/0/2
 eth-trunk 100
!
dfs-group 1
 source ip 10.0.0.1
 priority 150
!
! === 3. 接口加入 M-LAG（两台设备配置一致）===
interface Eth-Trunk 10
 description To-Server
 mode lacp-static
 dfs-group 1 m-lag 10
!
interface 25GE1/0/1
 eth-trunk 10
!
! === 4. 服务器到交换机：跨设备聚合 ===
! 服务器侧（Linux bond / Windows NIC team）用 802.3ad（LACP）
! 两台 ToR 的 Eth-Trunk 编号必须一致，否则服务器看到的是两条独立链路
!
! === 5. 网关放哪：推荐分布式网关（两台都有 VIP）===
interface Vlanif 200
 ip address 10.20.0.252 255.255.255.0
 mac-address 0000-5e00-0101
 vrrp vrid 1 virtual-ip 10.20.0.1 active
! 或用 anycast 网关模式，两台设备网关 MAC/IP 完全相同
!
! === 6. peer-link 的流量必须限制（关键）===
! peer-link 只是控制与异常兜底通道，正常业务流量不能走它
! 否则两台上联同时故障时，peer-link 会被打满导致 M-LAG 分裂
traffic-filter inbound acl 3999
!
! === 7. 验证 ===
display dfs-group 1 m-lag brief
display dfs-group 1 m-lag 10
display eth-trunk 10
! 服务器侧：cat /proc/net/bonding/bond0 应看到两个 slave 都 up
! 拔一台 ToR 的电源，业务应无感切换''',
 'note': 'M-LAG 最危险的不是配错，是「peer-link 承载了业务流量」——平时看不出问题，等上联全断时 peer-link 被打爆，两台设备同时脑裂。这条要在上线前就限流。'
})


def esc(s):
    return (s.replace('\\', '\\\\')
             .replace('\r\n', '\\n')
             .replace('\n', '\\n')
             .replace('\r', '')
             .replace("'", "\\'"))


parts = []
for t in T:
    parts.append(
        "  {\n"
        "    id: '%s',\n"
        "    cat: '%s',\n"
        "    name: '%s',\n"
        "    vendor: '%s',\n"
        "    code: '%s',\n"
        "    note: '%s'\n"
        "  }" % (esc(t['id']), esc(t['cat']), esc(t['name']),
                esc(t['vendor']), esc(t['code']), esc(t['note']))
    )
BLOCK = ',\n'.join(parts)

s = io.open(P, encoding='utf-8').read()
assert s.rstrip().endswith('module.exports = { TPLS };'), '文件尾部格式不符'

# 幂等：先剥离上次的追加块
MARK = ",\n  {\n    id: 'tpl-nat-server-mix',"
if MARK in s:
    s = s[:s.index(MARK)].rstrip() + '\n];\n\nmodule.exports = { TPLS };\n'
    print('已剥离旧的 batch47 追加块')

idx = s.rindex('];')
tail = s[idx:]
head = s[:idx].rstrip()
assert head.endswith('}'), '数组结尾前不是对象'
io.open(P, 'w', encoding='utf-8').write(head + ',\n' + BLOCK + '\n' + tail)
print('已追加 %d 个模板' % len(T))
