import io, os

P = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js')
s = io.open(P, encoding='utf-8').read()
if 'tpl-qos-limit' in s:
    print('已存在，跳过'); raise SystemExit

NEW = r'''
  /* ============ 策略 / 认证 / 运维模板（第 25 轮补充） ============ */
  {
    id: 'tpl-qos-limit',
    cat: 'QoS 模板',
    name: '端口限速模板（入向 car / 出向整形）',
    vendor: '华为 VRP8',
    code: '! 1. 入方向：用 CAR 丢弃式限速到 20Mbit\ninterface GigabitEthernet0/0/1\n qos car inbound cir 20000 cbs 250000 pir 20000 pbs 250000 green pass yellow pass red discard\n!\n! 2. 出方向：用队列整形，比 CAR 平滑（不丢突发）\ninterface GigabitEthernet0/0/1\n qos lr outbound cir 20000 cbs 375000\n!\n! 3. 验证\n display qos car interface GigabitEthernet 0/0/1\n display qos queue statistics interface GigabitEthernet 0/0/1\n display interface GigabitEthernet 0/0/1 | include rate',
    note: '入向只能丢（CAR），出向可以排队（整形），所以「对外限速」优先在出方向做。cbs 给太小会把突发全丢掉——经验值取「速率 × 10ms」，20M 约 250000 字节。'
  },
  {
    id: 'tpl-mirror',
    cat: '运维模板',
    name: '端口镜像模板（本地抓包 / 远程 RSPAN）',
    vendor: '华为 VRP8',
    code: '! === 本地镜像：被镜像口 Gi0/0/1 → 观察口 Gi0/0/24 ===\nobserve-port 1 interface GigabitEthernet 0/0/24\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 both\n!\n! === 远程镜像：观察流量打 VLAN 999 送到远端抓包机 ===\nvlan 999\n description RSPAN\nobserve-port 1 vlan 999\ninterface GigabitEthernet 0/0/1\n port-mirroring to observe-port 1 inbound\n!\n! 中间链路要放行 vlan 999，抓包机接在该 VLAN 的 access 口\ndisplay observe-port\ndisplay port-mirroring',
    note: '观察口不能再承载业务；远程镜像要求整条路径放行 RSPAN VLAN（含 trunk 允许列表）。只抓入向就写 inbound——both 会把带宽翻倍，观察口容易拥塞丢包。'
  },
  {
    id: 'tpl-stack',
    cat: '二层模板',
    name: '堆叠模板（iStack 双机 + 交叉连线）',
    vendor: '华为 VRP8',
    code: '! === 交换机 A（主）===\nstack slot 0 priority 200\nstack slot 0 renumber 1\ninterface stack-port 0/1\n port interface XGigabitEthernet 0/0/1 enable\ninterface stack-port 0/2\n port interface XGigabitEthernet 0/0/2 enable\nsave\nreboot\n\n! === 交换机 B（备）===\nstack slot 0 priority 100\nstack slot 0 renumber 2\ninterface stack-port 0/1\n port interface XGigabitEthernet 0/0/1 enable\ninterface stack-port 0/2\n port interface XGigabitEthernet 0/0/2 enable\nsave\nreboot\n\n! 验证：display stack',
    note: '堆叠线要交叉接（A 的 1 口接 B 的 2 口、A 的 2 口接 B 的 1 口），单根能起但没冗余。renumber 改完必须重启才生效，两台要错开 1~2 分钟重启，避免抢主。H3C 对应 irf member + irf-port。'
  },
  {
    id: 'tpl-dual-wan',
    cat: '三层模板',
    name: '双出口模板（主备 + 源分流 + 链路探测）',
    vendor: '华为 VRP8',
    code: '! 1. 主备默认路由\nip route-static 0.0.0.0 0.0.0.0 202.1.1.1 preference 60\nip route-static 0.0.0.0 0.0.0.0 100.1.1.1 preference 70\n!\n! 2. 指定网段走第二条出口（策略路由）\nacl number 3000\n rule 5 permit ip source 192.168.20.0 0.0.0.255\ntraffic classifier C-SALES operator or\n if-match acl 3000\ntraffic behavior B-ISP2\n redirect ip-nexthop 100.1.1.1\ntraffic policy P-OUT\n classifier C-SALES behavior B-ISP2\ninterface GigabitEthernet 0/0/1\n traffic-policy P-OUT inbound\n!\n! 3. NQA 探测主链路，断了自动切备\nnqa test-instance admin isp1\n test-type icmp\n destination-address ipv4 114.114.114.114\n frequency 10\nip route-static 0.0.0.0 0.0.0.0 202.1.1.1 track nqa admin isp1',
    note: '双出口三件套：主备 preference + 源地址分流 PBR + NQA 探测。只做前两个，主链路断了不会自动切——因为静态路由不会因为链路 down 就失效（除非接的是能感知的物理口）。'
  },
  {
    id: 'tpl-dot1x',
    cat: '安全模板',
    name: '802.1X 有线接入认证模板（RADIUS + 认证前放行）',
    vendor: '华为 VRP8',
    code: '! 1. RADIUS 模板\nradius-server template RAD\n radius-server shared-key cipher <KEY>\n radius-server authentication <RADIUS-IP> 1812\n!\naaa\n authentication-scheme SCH-DOT1X\n  authentication-mode radius\n domain default\n  authentication-scheme SCH-DOT1X\n  radius-server RAD\n!\n! 2. 全局与接口开启\ndot1x enable\ninterface GigabitEthernet0/0/1\n dot1x enable\n dot1x authentication-method eap\n!\n! 3. 认证前放行 DHCP / DNS，否则终端拿不到地址卡在「正在连接」\nauthentication free-rule-template FREE\n free-rule 1 destination ip <DHCP-IP> mask 255.255.255.255\n free-rule 2 destination ip <DNS-IP> mask 255.255.255.255',
    note: '上线顺序很关键：先拿 IP 再认证，所以 DHCP 必须放行（free-rule）。第一次部署先在测试口开，确认客户端能过认证再批量下发，否则整层楼一起断网。'
  },
  {
    id: 'tpl-snmpv3',
    cat: '运维模板',
    name: 'SNMPv3 纳管模板（认证 + 加密 + Trap）',
    vendor: '华为 VRP8',
    code: 'snmp-agent\nsnmp-agent sys-info version v3\nsnmp-agent group v3 NMS privacy read-view iso write-view iso\n!\nsnmp-agent usm-user v3 monitor group NMS\nsnmp-agent usm-user v3 monitor authentication-mode sha cipher <AUTH-PWD>\nsnmp-agent usm-user v3 monitor privacy-mode aes128 cipher <PRIV-PWD>\n!\n! Trap 上报到网管\nsnmp-agent target-host trap address udomain <NMS-IP> params securityname monitor v3 privacy\nsnmp-agent trap enable\n!\n! 验证\ndisplay snmp-agent usm-user\ndisplay snmp-agent group',
    note: 'v3 三件套：用户（usm-user）、组（group，决定能读哪些视图）、认证与加密算法（SHA + AES）。网管侧必须填同样的用户名和密钥，算法选错会报「认证失败」而不是超时——两种现象能区分是密码错还是网络不通。'
  }
'''

idx = s.rindex('];')
s = s[:idx] + NEW + s[idx:]
# 前面最后一个对象需要补逗号（新块以「/*」开头）
s = s.replace("""  }

  /* ============ 策略 / 认证 / 运维模板（第 25 轮补充） ============ */""",
              """  },

  /* ============ 策略 / 认证 / 运维模板（第 25 轮补充） ============ */""", 1)
io.open(P, 'w', encoding='utf-8').write(s)
print('模板已追加')
