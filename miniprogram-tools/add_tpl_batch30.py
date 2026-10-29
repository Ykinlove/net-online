# -*- coding: utf-8 -*-
"""为第 30 批命令配套追加 6 个配置模板"""
import io, os, sys

P = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js')
P = os.path.abspath(P)

T = []

T.append({
 'id': 'tpl-microburst',
 'cat': '运维模板',
 'name': '微突发（Microburst）观测与缓存基线',
 'vendor': '华为 VRP8 + Cisco IOS-XE',
 'code': r'''! === 1. 先确认是不是微突发：平均值正常，峰值打满 ===
display interface 10GE1/0/1 | include rate
display qos queue statistics interface 10GE1/0/1
! 只有某一个队列持续丢 = 该队列对应的业务在打突刺，不是链路不够
!
! === 2. 看端口缓存水线（华为）===
display qos buffer-pool
display qos buffer usage interface 10GE1/0/1
! 水线长期顶在 headroom 上限 = 真拥塞；只是偶尔冲高 = 微突发
!
! === 3. Cisco 侧看输出丢包与队列 ===
show interface Ten1/0/1 | include output drops
show queueing interface Ten1/0/1
show platform hardware fed switch active qos queue stats interface Ten1/0/1
!
! === 4. 抓毫秒级峰值（普通 5 分钟采样看不到突发）===
display interface 10GE1/0/1 | include "5 seconds"
! 连续刷 30 次记 peak；峰值 / 均值 > 5 倍即典型微突发
!
! === 5. 处理顺序：先整形，再扩带宽，最后才动缓存 ===
interface 10GE1/0/1
 qos shaping cir 8000000 cbs 100000
! 把突发削平到链路 80%，比加缓存有效得多
! 加缓存只是把丢包延后，队列越长时延越不可控''',
 'note': '微突发最容易误判成带宽不足。判据只有一个：平均利用率不到 30% 却持续丢包，那就是突发，扩带宽没用，得整形。'
})

T.append({
 'id': 'tpl-carrier-ticket',
 'cat': '项目场景',
 'name': '运营商电路报障与定界清单',
 'vendor': '通用 / 华为 VRP8',
 'code': r'''! === 报障前必须准备的 6 项（缺一项就被打回）===
! 1) 电路号 / 专线编号（不是 IP，不是设备名）
! 2) 两端机房地址 + 现场联系人 + 电话
! 3) 故障起始时间（精确到分钟）+ 现象描述
! 4) 已完成的自测结论（见下面命令）
! 5) 业务影响范围与等级
! 6) 历史工单号（重复报障要挂原单）
!
! === 自测一：证明问题在运营商侧 ===
display interface GigabitEthernet0/0/1
display interface GigabitEthernet0/0/1 | include error|CRC|drops
! CRC / Input errors / Runts 有增长 = 线路质量问题，责任明确
!
! === 自测二：光功率（最常见的推诿点）===
display transceiver diagnosis interface GigabitEthernet0/0/1
! 收光 -3 ~ -20dBm 正常；低于 -25dBm 直接报障，别自己换模块
! 收发功率差 > 15dB 也报，说明光路衰减异常
!
! === 自测三：环回测试 ===
! 本地自环：光模块自环后本端口应 up，不 up = 我方模块或端口坏
! 远端打环：请运营商在对端机房打环，能通 = 我方设备正常
!
! === 自测四：分段 ping，逐跳找拐点 ===
ping -c 100 -s 1400 <对端网关>
tracert -m 15 <目标地址>
! 判据：从第几跳开始丢，且此后每跳都丢 = 该跳之后拥塞或故障
! 只有第一跳丢、后面不丢 = 我方出口策略问题，不是运营商
!
! === 报障话术（照抄，省得来回扯皮）===
! 我方已完成：端口状态正常、收光 XX dBm、自环正常、
! 分段 ping 至第 X 跳开始丢包 XX%、CRC 无增长。
! 请核查该电路在贵司侧光路与设备端口。''',
 'note': '运营商最常回的一句是「我方测试正常」。破解办法不是吵，是把光功率、环回、分段 ping 三张证据一起甩过去——有数据的工单从来不会被挂起。'
})

T.append({
 'id': 'tpl-sdwan-sla',
 'cat': '项目场景',
 'name': 'SD-WAN 应用级 SLA 选路策略',
 'vendor': '华为 SD-WAN / 通用 CLI',
 'code': r'''! === 1. 先定业务等级，再谈选路 ===
! Gold  ：ERP / 视频会议 —— 时延 < 50ms，丢包 < 0.1%，抖动 < 20ms
! Silver：OA / 邮件      —— 时延 < 100ms，丢包 < 1%
! Bronze：下载 / 备份    —— 无 SLA，走最便宜的链路
!
! === 2. 每根 WAN 链路一个探测实例，5 秒一次 ===
nqa test-instance admin mpls_probe
 test-type icmp
 destination-address <对端POP>
 frequency 5
 probe-count 5
 timeout 2
 start now
!
nqa test-instance admin inet_probe
 test-type icmp
 destination-address <公网探测点>
 frequency 5
 start now
!
! === 3. 应用识别 + 策略路由落地形态 ===
acl number 3001
 rule 5 permit tcp destination-port eq 5060
 rule 10 permit udp destination-port eq 3478
traffic classifier VOICE operator or
 if-match acl 3001
traffic behavior VOICE
 redirect ip-nexthop <MPLS-下一跳>
traffic policy SDWAN_VOICE
 classifier VOICE behavior VOICE
interface GigabitEthernet0/0/1
 traffic-policy SDWAN_VOICE inbound
!
! === 4. 切换阈值：必须有迟滞，否则抖动时来回切 ===
! 劣化判定：连续 3 个周期超标才切走
! 恢复判定：连续 6 个周期达标才切回
! 迟滞设小了，开会每 30 秒断一次，比不切还惨
!
! === 5. 验证 ===
display nqa results test-instance admin mpls_probe
display nqa results test-instance admin inet_probe''',
 'note': 'SD-WAN 项目失败八成不是选路算法不行，是阈值没设迟滞。开会时链路抖一下就切、切回来又抖，用户体验比单一专线还差。'
})

T.append({
 'id': 'tpl-voice-qos',
 'cat': 'QoS 模板',
 'name': '语音视频端到端 QoS（接入→出口）',
 'vendor': '华为 VRP8',
 'code': r'''! === 接入层：话机自己打标，交换机信任 ===
interface GigabitEthernet0/0/1
 trust dscp
! 话机一般打 EF(46)，软终端 AF41(34)
! PC 直连的口绝对不要 trust，否则用户能自己把下载标成 EF
!
! === 汇聚 / 核心：每一跳都要保留队列 ===
diffserv domain voice
 8021p 5 map ef
 ip-dscp ef map ef
!
interface 10GE1/0/1
 qos phb marking enable
 trust dscp
!
! === 出口：整形 + 优先级队列 ===
interface GigabitEthernet0/0/2
 qos shaping cir 100000 kbps
!
traffic classifier VOICE operator or
 if-match dscp ef
traffic behavior VOICE
 queue ef
!
traffic classifier SIG operator or
 if-match dscp af41
traffic behavior SIG
 queue af bandwidth 2000
!
! === 调度原则 ===
! 语音走 PQ（绝对优先），其余走 WRR
! 语音队列预留不超过总带宽 1/3，否则把信令饿死
!
! === 验证：抓一次真实通话看双向 DSCP 是否一致 ===
display qos queue statistics interface GigabitEthernet0/0/2
! VOICE 队列出现 drop = 整形带宽算小了，不是标记错了
!
! === 端到端口诀 ===
! 打标准（话机）→ 信任对（接入）→ 保留住（核心）→ 整形好（出口）→ 统计验证''',
 'note': '语音质量问题九成出在「只配了接入层」：话机标记对了，中间核心没 trust DSCP，出接口又把 EF 重标成 0，一路白做。QoS 要跳跳配，不能只配一头。'
})

T.append({
 'id': 'tpl-dc-underlay',
 'cat': '数据中心模板',
 'name': '数据中心 Spine-Leaf Underlay 规划模板',
 'vendor': 'Arista EOS / 华为 CE',
 'code': r'''! === 1. 地址规划（每链路一个 /31，loopback 每台一个 /32）===
! 点对点网段：10.0.0.0/24 起，按 Spine 编号分段
! Loopback：10.0.1.N/32，同时作为 BGP router-id 与 VTEP 源
! 每台设备预留 4 个 loopback：管理、BGP、VTEP、带外
!
! === 2. Spine 侧（Arista EOS）===
interface Ethernet1
 no switchport
 mtu 9214
 ip address 10.0.0.1/31
!
router bgp 65000
 router-id 10.0.1.1
 maximum-paths 8
 neighbor LEAF peer group
 neighbor LEAF remote-as 65001
 neighbor LEAF bfd
 neighbor LEAF ebgp-multihop 3
 neighbor LEAF allowas-in
 neighbor 10.0.1.11 remote-as 65001
 neighbor 10.0.1.11 peer group LEAF
!
! === 3. Leaf 侧（华为 CE 写法）===
interface 10GE1/0/1
 undo portswitch
 mtu 9214
 ip address 10.0.0.2 31
!
bgp 65001
 router-id 10.0.1.11
 peer 10.0.0.1 as-number 65000
 peer 10.0.0.1 bfd enable
 maximum load-balancing 8
!
! === 4. 上线必查 5 项（漏一项后期必出诡异问题）===
! MTU 全路径 9214，含 VTEP 封装开销，否则大包偶发黑洞
! BFD 全开，收敛从 180s 降到 200ms 以内
! ECMP 哈希含 src/dst IP + L4 port，否则大象流全撞一条
! 互联口关 STP、关无关发现协议
! 时间同步（PTP 优先，NTP 兜底），否则排障日志对不上
!
! === 5. 验证 ===
show ip bgp summary
show ip route 10.0.1.11/32
show interfaces counters errors
! 每个 Leaf 应看到 N 条等价路径（N = Spine 数量）''',
 'note': 'Underlay 出问题 90% 是三件事：MTU 没统一、BFD 没开、ECMP 哈希不散。三者上线当天都不会报错，等你上生产跑大流量才炸。'
})

T.append({
 'id': 'tpl-tshoot-card',
 'cat': '运维模板',
 'name': '故障定界速查卡（分层排除法）',
 'vendor': '通用',
 'code': r'''! === 万能顺序：物理 → 链路 → 网络 → 传输 → 应用 ===
! 通就往上查，不通往下查；一层没排除，绝不查上一层
!
! 第 1 层 物理
display interface brief
! down/down = 线、光模块或对端没开机
! up/down   = 对端没配或端口 shutdown
display transceiver diagnosis interface X
! 收光 -3 ~ -20dBm 正常；低于 -25 换模块或报障
!
! 第 2 层 链路
display mac-address interface X
display lldp neighbor brief
! 看不到对端 LLDP = 中间有透明设备，或对端没开
display stp brief
! 环路、异常阻塞端口先看这里
!
! 第 3 层 网络
display ip routing-table <目标>
display arp | include <网关IP>
! 网关 ping 不通但 ARP 有表项 = 网关设备问题，不是线路
!
! 第 4 层 传输
telnet <目标> <端口>
! 端口不通先查中间 ACL 与防火墙策略，别急着查应用
!
! 第 5 层 应用
! 网络层已排除干净，让对方查服务进程与日志
!
! === 一句话口诀 ===
! 换线换口换模块，ping 网关 ping 对端，
! 逐跳 trace 找拐点，通上不通下。''',
 'note': '排障慢通常不是技术不够，是跳步——物理层还 down 着就去查路由表。这张卡贴工位，按顺序走，绝大多数故障 5 分钟内能定界。'
})


def esc(s):
    # 顺序很重要：先反斜杠，再换行，最后引号
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

# 幂等：如果之前追加过本批次，先剥掉
MARK = ",\n  {\n    id: 'tpl-microburst',"
if MARK in s:
    s = s[:s.index(MARK)].rstrip() + '\n];\n\nmodule.exports = { TPLS };\n'
    print('已剥离旧的 batch30 追加块')

idx = s.rindex('];')
tail = s[idx:]
assert tail.lstrip().startswith('];'), '未定位到数组结尾'
head = s[:idx].rstrip()

# 前一个对象后面必须补逗号
assert head.endswith('}'), '数组结尾前不是对象'
new = head + ',\n' + BLOCK + '\n' + tail
io.open(P, 'w', encoding='utf-8').write(new)
print('已追加 %d 个模板' % len(T))
