import io, os

P = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js')
s = io.open(P, encoding='utf-8').read()
if 'tpl-bond' in s:
    print('已存在，跳过'); raise SystemExit

NEW = r'''
  /* ============ 服务器 / 交付 / 加固模板（第 27 轮补充） ============ */
  {
    id: 'tpl-bond',
    cat: '运维模板',
    name: '服务器双网卡绑定模板（LACP / 主备）',
    vendor: 'Linux',
    code: '# === 方案一：mode 4（LACP，需交换机配 Eth-Trunk）===\nnmcli con add type bond con-name bond0 ifname bond0 mode 802.3ad\nnmcli con add type bond-slave ifname ens33 master bond0\nnmcli con add type bond-slave ifname ens34 master bond0\nnmcli con mod bond0 ipv4.method manual\nnmcli con mod bond0 ipv4.addresses 10.1.10.20/24 ipv4.gateway 10.1.10.1\nnmcli con mod bond0 ipv4.dns "10.1.1.53"\nnmcli con up bond0\n\n# === 方案二：mode 1（主备，交换机零配置）===\n# nmcli con add type bond con-name bond0 ifname bond0 mode active-backup\n\n# === 验证 ===\ncat /proc/net/bonding/bond0\nethtool bond0',
    note: '想省事选 mode 1（主备，交换机不用配）；要带宽叠加选 mode 4（两端都要 LACP）。两块网卡要接不同交换机（或堆叠/M-LAG 的两台）才叫链路冗余。'
  },
  {
    id: 'tpl-lb-health',
    cat: '运维模板',
    name: '负载均衡健康检查模板（四层 / 七层）',
    vendor: 'Nginx / HAProxy',
    code: '# === Nginx：七层健康检查（推荐，能发现进程假死）===\nupstream app_pool {\n    server 10.1.20.11:8080 max_fails=3 fail_timeout=10s;\n    server 10.1.20.12:8080 max_fails=3 fail_timeout=10s;\n    keepalive 32;\n}\nserver {\n    location / {\n        proxy_pass http://app_pool;\n        proxy_next_upstream error timeout http_502 http_504;\n        proxy_connect_timeout 2s;\n    }\n}\n\n# === HAProxy：四层 + 主动探测 ===\n# backend app\n#   server s1 10.1.20.11:8080 check inter 3s fall 3 rise 2\n#   server s2 10.1.20.12:8080 check inter 3s fall 3 rise 2',
    note: '四层探测只看端口能不能连——后端进程卡死但端口还在，流量照样打过去。有 HTTP 服务就一定要用七层探测（探测一个 /health 返回 200）。'
  },
  {
    id: 'tpl-dhcp-option43',
    cat: 'DHCP 模板',
    name: 'AP 跨三层上线模板（DHCP Option 43）',
    vendor: '华为 VRP8',
    code: 'dhcp enable\n!\n! === AP 地址池：用 Option 43 告诉 AP「AC 在哪」===\nip pool AP\n network 10.1.30.0 mask 255.255.255.0\n gateway-list 10.1.30.1\n option 43 sub-option 2 ip-address 10.1.1.10\n!\n! === 用户地址池（正常业务）===\nip pool USER\n network 10.1.40.0 mask 255.255.255.0\n gateway-list 10.1.40.1\n dns-list 10.1.1.53\n!\n! === 三层接口与路由 ===\ninterface Vlanif30\n ip address 10.1.30.1 255.255.255.0\n dhcp select global\ninterface Vlanif40\n ip address 10.1.40.1 255.255.255.0\n dhcp select global',
    note: 'AP 跨三层上线只有两条路：Option 43 或 DNS 解析（AP 默认找 huawei.com 之类的域名）。Option 43 的写法厂商差异大——华为子选项 2 直接写 IP，思科要转十六进制（10.1.1.10 → 0a01010a）。'
  },
  {
    id: 'tpl-hardening',
    cat: '安全模板',
    name: '网络设备加固基线模板（等保三级）',
    vendor: '华为 VRP8',
    code: '! === 1. 关闭不安全服务 ===\nundo telnet server enable\nundo http server enable\nundo http secure-server enable\nundo ftp server\n!\n! === 2. 只用 SSH + 强密码策略 ===\nstelnet server enable\nssh server-source all-interface\naaa\n local-user admin password irreversible-cipher <STRONG-PWD>\n local-user admin service-type ssh\n local-user admin privilege level 15\n!\n! === 3. 管理面只准运维网段进 ===\nacl number 2000\n rule 5 permit source 10.1.0.0 0.0.255.255\n rule 100 deny\nuser-interface vty 0 4\n acl 2000 inbound\n!\n! === 4. 日志外发（留存 ≥ 6 个月）===\ninfo-center enable\ninfo-center loghost <SYSLOG-IP>\ninfo-center source default channel loghost log level informational\n!\n! === 5. 时间同步（否则日志时间线不可信）===\nntp-service unicast-server <NTP-IP>\nclock timezone CST add 08:00:00',
    note: '等保检查最常被挑的三项：Telnet 没关、SNMP 还在 v2c public、日志没外发。这三条十分钟能改完，但整改报告要写两周——上线前就配好。'
  }
'''

idx = s.rindex('];')
s = s[:idx] + NEW + s[idx:]
s = s.replace("""  }

  /* ============ 服务器 / 交付 / 加固模板（第 27 轮补充） ============ */""",
              """  },

  /* ============ 服务器 / 交付 / 加固模板（第 27 轮补充） ============ */""", 1)
io.open(P, 'w', encoding='utf-8').write(s)
print('模板已追加')
