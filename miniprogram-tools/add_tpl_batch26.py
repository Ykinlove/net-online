import io, os

P = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'utils', 'tplbook.js')
s = io.open(P, encoding='utf-8').read()
if 'tpl-roce' in s:
    print('已存在，跳过'); raise SystemExit

NEW = r'''
  /* ============ 数据中心 / 上云 / 运维流水线模板（第 26 轮补充） ============ */
  {
    id: 'tpl-roce',
    cat: '数据中心模板',
    name: 'RoCE 无损网络模板（PFC + ECN）',
    vendor: '华为 CE',
    code: '! === 1. 全局使能 PFC ===\ndcb pfc\n!\n! === 2. 无损队列（优先级 3）接入端口 ===\ninterface 100GE1/0/1\n description TO-LEAF-02\n priority-flow-control priority 3\n qos queue 3 wred ecn\n!\n! === 3. 验证 ===\ndisplay dcb pfc\ndisplay interface 100GE1/0/1 | include Pause\ndisplay qos queue statistics interface 100GE1/0/1',
    note: 'PFC 只对无损队列开，全场开容易 PFC 风暴。ECN 门限 30~40% 起标、70% 全标。端到端要一致——服务器网卡侧也要开 PFC/ECN，只配交换机等于没配。'
  },
  {
    id: 'tpl-cloud-connect',
    cat: '三层模板',
    name: '云专线对接模板（BGP + 双线主备）',
    vendor: '华为 VRP8',
    code: '! === 1. 互联口（云侧给的 /30 互联段）===\ninterface GigabitEthernet0/0/1\n description TO-CLOUD-DC-1\n ip address 169.254.1.1 255.255.255.252\n!\n! === 2. BGP 对接 ===\nbgp 65001\n router-id 10.0.0.1\n peer 169.254.1.2 as-number 64512\n peer 169.254.1.2 bfd enable\n network 10.10.0.0 255.255.0.0\n!\n! === 3. 双线主备（第二条线同样配，权重低）===\nroute-policy LINE1 permit node 10\n apply local-preference 200\nbgp 65001\n peer 169.254.1.2 route-policy LINE1 import\n!\n! === 4. 验证 ===\ndisplay bgp peer\ndisplay bgp routing-table',
    note: '上云前三查：① 网段是否与云 VPC 重叠（重叠必须改规划）② MTU 是否被隧道吃掉 ③ 云侧路由表/安全组是否放行本地网段。BGP 起不来先看 TCP 179 通不通。'
  },
  {
    id: 'tpl-bastion',
    cat: '安全模板',
    name: '堡垒机对接模板（TACACS+ 命令审计）',
    vendor: '华为 VRP8',
    code: '! === 1. TACACS+ 服务器 ===\ntacacs-server template TAC\n tacacs-server shared-key cipher <KEY>\n tacacs-server authentication <BASTION-IP> 49\n!\n! === 2. AAA：认证 + 授权 + 计费全走 TACACS+ ===\naaa\n authentication-scheme SCH-TAC\n  authentication-mode tacacs\n authorization-scheme AUT-TAC\n  authorization-mode tacacs\n accounting-scheme ACC-TAC\n  accounting-mode tacacs\n domain default\n  authentication-scheme SCH-TAC\n  authorization-scheme AUT-TAC\n  accounting-scheme ACC-TAC\n  tacacs-server TAC\n!\n! === 3. 应急本地账号（堡垒机故障时用，密码单独保管）===\nlocal-user rescue password irreversible-cipher <PWD>\nlocal-user rescue privilege level 15',
    note: '审计要落地必须走 TACACS+（支持逐条命令授权与记录），RADIUS 做不到命令级。救援账号一定要留，否则堡垒机一挂全线进不去——但密码要单独封存、用完改。'
  },
  {
    id: 'tpl-monitor-full',
    cat: '运维模板',
    name: '监控接入模板（SNMP + Syslog + Trap 全套）',
    vendor: '华为 VRP8',
    code: '! === 1. SNMP v3（只读）===\nsnmp-agent\nsnmp-agent sys-info version v3\nsnmp-agent group v3 NMS privacy read-view iso\nsnmp-agent usm-user v3 monitor group NMS\nsnmp-agent usm-user v3 monitor authentication-mode sha cipher <AUTH-PWD>\nsnmp-agent usm-user v3 monitor privacy-mode aes128 cipher <PRIV-PWD>\n!\n! === 2. Trap 上报 ===\nsnmp-agent target-host trap address udp-domain <NMS-IP> params securityname monitor v3 privacy\nsnmp-agent trap enable\n!\n! === 3. Syslog ===\ninfo-center enable\ninfo-center loghost <SYSLOG-IP>\ninfo-center source default channel loghost log level informational\n!\n! === 4. 时间必须对（否则日志时间线全乱）===\nclock timezone CST add 08:00:00\nntp-service unicast-server <NTP-IP>\n!\ndisplay snmp-agent usm-user\ndisplay info-center',
    note: '监控三件套：指标（SNMP）、事件（Syslog）、告警（Trap）。三样都接之前先把 NTP 配好——时间不对，事后分析日志根本对不上。'
  },
  {
    id: 'tpl-backup-git',
    cat: '运维模板',
    name: '配置自动备份流水线（拉取 + Git 版本化）',
    vendor: '通用脚本',
    code: '#!/bin/bash\n# 每天 02:00 备份所有网络设备配置并提交 Git\nset -e\ncd /opt/net-cfg\n\nfor ip in $(cat devices.txt); do\n  python3 - "$ip" <<PY\nimport sys, netmiko\nip = sys.argv[1]\nd = dict(device_type="hp_comware", host=ip, username="backup", password="******")\nwith netmiko.ConnectHandler(**d) as c:\n    open(f"{ip}.cfg", "w").write(c.send_command("display current-configuration"))\nPY\ndone\n\ngit add -A\ngit commit -m "daily $(date +%F)" || echo "无变更"\ngit push -q origin main\n\n# crontab\n# 0 2 * * * /opt/net-cfg/backup.sh >> /var/log/netbak.log 2>&1',
    note: '备份要落在另一台机器（设备 flash 会跟着设备一起坏）。进 Git 后「谁在什么时候改了哪一行」变成 git diff 一眼可见，割接前打个 tag 就是基线。仓库别放公网。'
  },
  {
    id: 'tpl-inspect',
    cat: '运维模板',
    name: '巡检报表模板（采集 + CSV + 趋势对比）',
    vendor: '通用脚本',
    code: 'from netmiko import ConnectHandler\nimport csv, time\n\nCMDS = [\n    ("display version", "版本"),\n    ("display cpu-usage", "CPU"),\n    ("display memory-usage", "内存"),\n    ("display interface brief", "端口"),\n    ("display interface | include error|CRC|drop", "错包"),\n    ("display transceiver diagnosis interface", "光功率"),\n]\n\nrows = [["时间", "设备", "项目", "结果"]]\nfor ip in open("devices.txt").read().split():\n    d = dict(device_type="hp_comware", host=ip, username="ops", password="******")\n    try:\n        with ConnectHandler(**d) as c:\n            for cmd, name in CMDS:\n                rows.append([time.strftime("%F %T"), ip, name, c.send_command(cmd, read_timeout=30)])\n    except Exception as e:\n        rows.append([time.strftime("%F %T"), ip, "采集失败", str(e)])\n\nwith open(f"report_{time.strftime('%Y%m%d')}.csv", "w", newline="", encoding="utf-8") as f:\n    csv.writer(f).writerows(rows)\nprint("done", len(rows) - 1, "行")',
    note: '关键是每天存档、和前一天比：端口错包增量、CPU 缓慢爬升、光功率缓慢下降——这些趋势问题单次快照永远看不出来。'
  }
'''

idx = s.rindex('];')
s = s[:idx] + NEW + s[idx:]
s = s.replace("""  }

  /* ============ 数据中心 / 上云 / 运维流水线模板（第 26 轮补充） ============ */""",
              """  },

  /* ============ 数据中心 / 上云 / 运维流水线模板（第 26 轮补充） ============ */""", 1)
io.open(P, 'w', encoding='utf-8').write(s)
print('模板已追加')
