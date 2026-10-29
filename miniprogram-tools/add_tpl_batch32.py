# -*- coding: utf-8 -*-
"""为第 32 批命令配套追加 4 个配置模板"""
import io, os

P = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js'))

T = []

T.append({
 'id': 'tpl-iot-vlan',
 'cat': '安全模板',
 'name': '物联网（摄像头 / 门禁 / 仪表）接入隔离模板',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 单独 VLAN + 单独网段，绝不复用办公段 ===
vlan 900
 description IoT-Devices
!
interface Vlanif 900
 ip address 10.90.0.1 255.255.255.0
!
! === 2. 端口配置：只允许 IoT 设备接进来 ===
interface GigabitEthernet 0/0/20
 port link-type access
 port default vlan 900
 stp edged-port enable
 port-isolate enable group 1
! port-isolate 让同 VLAN 的设备互相不通——一台被控不会横向扩散
!
! === 3. 只允许访问它自己的平台，其余全拒 ===
acl number 3900
 rule 5 permit ip source 10.90.0.0 0.0.0.255 destination 10.90.1.10 0
 rule 10 permit ip source 10.90.0.0 0.0.0.255 destination 10.90.1.11 0
 rule 15 permit udp source 10.90.0.0 0.0.0.255 destination 10.90.0.1 0 destination-port eq 123
 rule 100 deny ip
!
interface Vlanif 900
 traffic-filter inbound acl 3900
!
! === 4. 禁掉 IoT 段访问互联网（除非业务确有需要）===
! 需要外网的就单独开白名单域名，别直接放通
!
! === 5. 开启基础防护 ===
interface GigabitEthernet 0/0/20
 storm-control broadcast min-rate 500
 storm-control multicast min-rate 500
! 摄像头广播风暴是经典事故，限一下能救整个接入层
!
! === 6. 验证 ===
display vlan 900
display acl 3900
! 从办公网 ping 10.90.0.20 应该不通，从平台服务器应该通''',
 'note': '物联网段最大的风险是「默认密码设备被控后横向扫全公司」。隔离三件套：单独 VLAN、端口隔离、只放行平台 IP——这三条加上去，即使设备被控也炸不开。'
})

T.append({
 'id': 'tpl-5g-backup',
 'cat': '项目场景',
 'name': '4G/5G 备份线路自动切换模板',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 备份链路基础配置 ===
interface Cellular0/0/0
 apn-profile 5GNET
 ip address negotiate
!
apn-profile 5GNET
 apn gdnet
!
! === 2. 探测主链路（关键：不探测就不知道什么时候该切）===
nqa test-instance admin track_main
 test-type icmp
 destination-address 10.1.1.1
 frequency 5
 probe-count 3
 timeout 2
 start now
!
nqa test-instance admin track_backup
 test-type icmp
 destination-address 10.90.0.1
 frequency 10
 start now
!
! === 3. 用 track + 静态路由做浮动 ===
ip route-static 0.0.0.0 0 200.1.1.1 preference 60 track nqa admin track_main
ip route-static 0.0.0.0 0 Cellular0/0/0 preference 80 track nqa admin track_backup
! 主链路探测失败 → 默认路由失效 → 自动走备份
! preference 越小越优先，备份设大值
!
! === 4. 回切必须加延迟（否则抖动时来回切）===
! 主链路恢复后不要立刻切回：连续 6 个探测周期（30 秒）达标再切
! 华为可用 route-monitor 或控制器侧策略实现
!
! === 5. NAT：备份链路要单独做地址转换 ===
acl number 2000
 rule 5 permit source 10.10.0.0 0.0.255.255
!
interface Cellular0/0/0
 nat outbound 2000
!
! === 6. MTU / MSS（5G 隧道最常见的坑）===
interface Cellular0/0/0
 tcp adjust-mss 1360
! 不调的表现：能 ping 通、微信能发文字、网页和图片全打不开
!
! === 7. 验证 ===
display nqa results test-instance admin track_main
display ip routing-table 0.0.0.0
display cellular 0/0/0 all''',
 'note': '备份链路最常见的失败不是切不过去，是「切过去以后再也没切回来」，或者切过去发现 MTU 不对业务照样不通。上线当天一定要做一次真拔线测试。'
})

T.append({
 'id': 'tpl-rack-baseline',
 'cat': '运维模板',
 'name': '新机柜上架与端口基线模板',
 'vendor': '华为 VRP8',
 'code': r'''! === 1. 上架前先定的三件事 ===
! U 位规划：重设备在下，交换机在中，理线架紧邻设备
! 双路供电：A 路接 UPS-1，B 路接 UPS-2，双电源分插
! 空 U 位全部装盲板（性价比最高的降温手段）
!
! === 2. 交换机基础配置（一次性配完，避免后期返工）===
sysname CORE-RACK-A-01
!
vlan batch 10 20 30 99
!
! 管理 VLAN 单独划，不与管理地址混在业务段
interface Vlanif 99
 ip address 10.99.0.11 255.255.255.0
!
! === 3. 上联口（万兆，做聚合）===
interface Eth-Trunk 1
 port link-type trunk
 port trunk allow-pass vlan 10 20 30
 mode lacp-static
!
interface 10GE1/0/49
 eth-trunk 1
interface 10GE1/0/50
 eth-trunk 1
!
! === 4. 服务器接入口基线（每个口都照这个配）===
interface 10GE1/0/1
 description SRV-APP-01_eth0
 port link-type access
 port default vlan 20
 stp edged-port enable
! 服务器口一律 edged-port，避免 STP 收敛慢导致开机网络起不来
!
! === 5. 安全与运维基线 ===
stelnet server enable
undo telnet server enable
undo http server enable
!
snmp-agent
snmp-agent sys-info version v3
snmp-agent target-host trap address udp-domain 10.99.0.100 params securityname NMSv3 v3
!
ntp-service unicast-server 10.99.0.100
info-center enable
info-center loghost 10.99.0.100
!
! === 6. 保存并记录基线 ===
save
display current-configuration > 上架基线.txt
display interface brief
display mac-address
! 交付时把配置、端口表、拓扑图三份一起归档''',
 'note': '新机柜最容易被跳过的是「服务器口开 edged-port」和「双电源分插」。前者影响服务器重启后多久能通网，后者决定一次 UPS 故障会不会带走整个机柜。'
})

T.append({
 'id': 'tpl-capacity-collect',
 'cat': '运维模板',
 'name': '容量采集与带宽基线命令集',
 'vendor': '华为 VRP8 / Linux',
 'code': r'''! === 1. 采集口径（先统一，不然数据没法比）===
! 采样周期：5 分钟
! 统计数据：入向/出向 bps、错包、丢包、CPU、内存
! 保存时长：至少 3 个月（要覆盖一个月度高峰）
! 判据：用 P95 而不是平均值
!
! === 2. 设备侧一次性取全 ===
display interface brief
display interface | include rate
display cpu-usage
display memory-usage
display counters rate inbound interface
display counters rate outbound interface
!
! === 3. 只看关键链路（大网别全采，采不过来）===
! 出口、核心互联、服务器区上联、专线——这四类必采
display interface 10GE1/0/49 | include rate
!
! === 4. Linux 侧采样（服务器/网关）===
# 每 5 分钟记一次，追加写，别覆盖
while true; do
  date +%s >> /var/log/bw.log
  cat /proc/net/dev | grep -E "eth0|eth1" >> /var/log/bw.log
  sleep 300
done
!
! === 5. SNMP 批量采集（ifHCInOctets 用 64 位计数器，避免回绕）===
snmpwalk -v3 -l authPriv -u monitor -a SHA -A <pwd> -x AES -X <pwd> \
  10.1.1.1 1.3.6.1.2.1.31.1.1.1.6
! 关键：一定用 ifHCInOctets（64 位），32 位计数器在千兆口 5 分钟就回绕
!
! === 6. 出报告时的三个必备数字 ===
! P95 利用率、峰值出现时间点、按当前增速的触顶预估月数
! 只有这三个数字能推动扩容决策，平均值不能''',
 'note': '扩容申请被驳回，多数是因为报告里只有「平均利用率」。改成 P95 + 峰值时段 + 触顶预估，同样的数据，通过率完全不一样——这是网络工程师向上沟通最实用的一招。'
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

MARK = ",\n  {\n    id: 'tpl-iot-vlan',"
if MARK in s:
    s = s[:s.index(MARK)].rstrip() + '\n];\n\nmodule.exports = { TPLS };\n'
    print('已剥离旧的 batch32 追加块')

idx = s.rindex('];')
tail = s[idx:]
head = s[:idx].rstrip()
assert head.endswith('}'), '数组结尾前不是对象'
io.open(P, 'w', encoding='utf-8').write(head + ',\n' + BLOCK + '\n' + tail)
print('已追加 %d 个模板' % len(T))
