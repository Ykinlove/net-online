/* 新技术与工程化批次（第 26 轮）
   前 25 轮把「设备上怎么配」铺得比较满了，这批换三个角度：
     ① 新技术面：RoCE 无损、云专线、Wi-Fi 7、零信任、堡垒机
     ② 工程化：Terraform / Nornir / 配置 CI 校验 / 巡检脚本
     ③ 物理与设施：光纤熔接与 OTDR、布线认证测试、UPS 与环境、IPAM、仿真环境

   对「具体开关命令随版本差异大」的（Wi-Fi 7、RoCE），命令只给能确定的骨架，
   在 tip 里明确写「以设备 ? 与产品文档为准」，不硬编造。
*/
const NEWTECH_EXTRA = [
  {
    id: 'dc-roce-lossless',
    devs: ['Switch'],
    name: 'RoCE 无损网络（PFC / ECN / 缓冲区）',
    kw: ['roce', '无损网络', 'pfc', 'ecn', 'rdma', '智算', 'ai 网络', '拥塞控制', '丢包敏感'],
    cmds: [
      ['华为 CE', 'dcb pfc                              # 全局使能 PFC\ninterface 100GE1/0/1\n priority-flow-control priority 3     # 只对优先级 3（无损队列）开\n qos queue 3 wred ecn                 # ECN 标记代替丢包\n!\ndisplay dcb pfc\ndisplay interface 100GE1/0/1 | include Pause'],
      ['思科 Nexus', 'interface Ethernet1/1\n priority-flow-control mode on\n priority-flow-control priority 3\n!\nshow interface priority-flow-control\nshow hardware qos'],
      ['调参要点', 'PFC 只开无损队列，全场开容易引发 PFC 风暴/PFC 死锁\nECN 门限：30%~40% 开始标记，70% 全标\n缓冲区按「带宽 × RTT」估算，小了必然丢包']
    ],
    tip: 'RoCE 对丢包极其敏感（万分之一就能让训练性能腰斩）。三件套缺一不可：PFC 防丢、ECN 防 PFC 风暴、缓冲区够大。上生产前用大包长跑压测确认零丢包。具体命令在 CE 各版本略有差异，以设备 ? 补全为准。'
  },
  {
    id: 'cloud-direct-connect-hybrid',
    devs: ['Router', 'Switch', '防火墙'],
    name: '云专线接入（本地机房 ↔ 云 VPC）',
    kw: ['云专线', '专线', 'direct connect', '混合云', '上云', 'vpc 互联', 'bgp 对接云'],
    cmds: [
      ['本地侧（BGP 对接）', 'interface GigabitEthernet0/0/1\n description TO-CLOUD-DC\n ip address 169.254.1.1 255.255.255.252\n!\nbgp 65001\n peer 169.254.1.2 as-number 64512\n peer 169.254.1.2 bfd enable\n network 10.10.0.0 255.255.0.0\n!\ndisplay bgp peer\ndisplay bgp routing-table'],
      ['双线主备', 'route-policy PREFER-LINE1 permit node 10\n apply local-preference 200\nbgp 65001\n peer 169.254.1.2 route-policy PREFER-LINE1 import\n# 两条专线走不同物理路径，靠 local-preference 分主备'],
      ['上线前检查', '① 网段是否重叠（云 VPC vs 本地）——重叠就得改规划\n② MTU：专线常 1500，叠加隧道要减 40~60\n③ 云侧安全组/路由表是否放行对端网段\n④ BGP 是否 Established']
    ],
    tip: '云专线本质是「一条专线 + BGP 交换路由」。规划期最容易踩的坑是网段重叠——云上子网和本地办公网撞了，后面所有互联都做不成，只能重建 VPC。'
  },
  {
    id: 'wlan-wifi7',
    devs: ['AC', 'AP'],
    name: 'Wi-Fi 7 要点（MLO / 320MHz / 6GHz）',
    kw: [
      'wifi7', 'wi-fi 7', '802.11be', 'mlo', '320mhz', '6ghz',
      'wifi6e', '新一代无线', 'wifi6', 'wifi 6', 'wifi 7', '802.11ax'
    ],
    cmds: [
      ['三个前提', '① AP 与 AC 都支持 802.11be（Wi-Fi 7）\n② 当地法规开放 6GHz（国内仅部分频段可用）\n③ 终端也支持，否则回落 Wi-Fi 6\n# 先确认型号与软件版本，再谈配置'],
      ['验证（华为）', 'display ap all                 # AP 型号与在线状态\ndisplay radio all              # 各射频频宽 / 信道 / 功率\ndisplay station all            # 终端协商协议与速率\ndisplay ap performance all     # 空口质量与干扰'],
      ['关键取舍', 'MLO：2.4G + 5G/6G 同时收发，降时延提可靠\n320MHz：只有 6GHz 才可能（5G 最多 160MHz）\n4K QAM：需要极好信号，边缘反而更差']
    ],
    tip: 'Wi-Fi 7 的「快」主要来自 6GHz 与 320MHz，国内 6GHz 未完全开放时要打折看。别只看标称速率——很多手机支持 MLO 但不支持 320MHz。具体开关随 AP 型号与 AC 版本差异很大，以产品文档为准。'
  },
  {
    id: 'sec-bastion',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: '堡垒机接入（运维审计 / 命令级授权）',
    kw: ['堡垒机', '跳板机', '运维审计', 'tacacs', '命令授权', '操作录像', '等保', '堡垒机部署', '堡垒机怎么接'],
    cmds: [
      ['设备侧（TACACS+）', 'tacacs-server template TAC\n tacacs-server shared-key cipher <KEY>\n tacacs-server authentication <BASTION-IP> 49\n!\naaa\n authentication-scheme SCH-TAC\n  authentication-mode tacacs\n authorization-scheme AUT-TAC\n  authorization-mode tacacs\n accounting-scheme ACC-TAC\n  accounting-mode tacacs\n domain default\n  authentication-scheme SCH-TAC\n  authorization-scheme AUT-TAC\n  accounting-scheme ACC-TAC\n  tacacs-server TAC'],
      ['为什么用 TACACS+ 不用 RADIUS', 'RADIUS：认证为主，授权粒度粗\nTACACS+：支持逐条命令授权（高危命令单独控）+ 命令记录\n# 等保要求「运维操作可审计」时基本都选 TACACS+'],
      ['验证', 'display aaa configuration\ndisplay tacacs-server configuration\ndisplay local-user']
    ],
    tip: '堡垒机的价值不在「登录入口统一」，而在命令级授权 + 全程录像。只把登录指向堡垒机、命令权限还在本地，等于没上审计。'
  },
  {
    id: 'sec-ztna',
    devs: ['防火墙', '其他设备'],
    name: '零信任接入（SDP / ZTNA 落地要点）',
    kw: ['零信任', 'ztna', 'sdp', '替代vpn', '最小权限', '准入', '远程接入'],
    cmds: [
      ['核心思路', '不再「进内网就信任」，改为「每次访问都验证」\n① 身份（人 + 设备） ② 上下文（位置/时间/风险） ③ 最小权限'],
      ['落地三件套', '控制器：策略决策中心，对接 AD/LDAP + MFA\n网关：部署在 DMZ，只暴露网关自身端口，业务端口不对外\n客户端：设备指纹 + 隧道；无客户端场景用反向代理'],
      ['和 VPN 的差别', 'VPN：连上即进入大内网，横向移动无阻\nSDP：默认「不可见」（端口不暴露），按应用授权，先认证再连接'],
      ['排障顺序', '① 客户端能否解析/连到网关 ② 网关能否回源到应用\n③ 策略是否命中（看控制器日志） ④ MFA/设备合规是否通过']
    ],
    tip: '零信任落地最常见的失败：只换了接入方式、没改权限模型——把原来「整个网段全通」的权限原样搬到 SDP 上，等于给 VPN 换了个壳。'
  },
  {
    id: 'sys-nas',
    devs: ['Linux', '服务器', '其他设备'],
    name: 'NAS 挂载与权限排障（NFS / SMB）',
    kw: ['nas', 'nfs', 'smb', 'cifs', '共享存储', '挂载', 'showmount', '文件共享'],
    cmds: [
      ['Linux 挂 NFS', 'showmount -e 10.1.1.50                 # 看服务端导出的目录\nmount -t nfs 10.1.1.50:/data /mnt/data\n\n# 开机自动挂（/etc/fstab）\n# 10.1.1.50:/data /mnt/data nfs defaults,_netdev,soft,timeo=30 0 0'],
      ['NFS 权限坑', '服务端 /etc/exports：\n/data 10.1.0.0/16(rw,sync,no_root_squash)\n\n# no_root_squash 才允许 root 写；默认 root_squash 会变 nobody\n# 改完刷新：exportfs -ra'],
      ['挂 SMB', 'smbclient -L //10.1.1.50 -U user         # 列出共享\nmount -t cifs //10.1.1.50/share /mnt/s -o username=user,vers=3.0'],
      ['卡死/超时排查', 'df -h 卡住 = 存储不可达：先 umount -l 再查网络\n顺序：ping → 端口（2049/445）→ showmount → 服务端日志']
    ],
    tip: 'NFS 默认硬挂载，服务端一挂，访问该目录的进程会进 D 状态卡死（kill -9 都杀不掉）。生产环境建议 soft,timeo=30，或改用 autofs 按需挂载。'
  },
  {
    id: 'sec-cert',
    devs: ['Linux', '服务器', '防火墙', '其他设备'],
    name: '证书到期与 TLS 链路排障',
    kw: ['证书', 'ssl', 'tls', '证书过期', '证书链', 'sni', 'https 报错', 'openssl'],
    cmds: [
      ['看服务端证书', 'openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \\\n  | openssl x509 -noout -dates -subject -issuer\n# 看完整证书链：加 -showcerts'],
      ['看本地文件', 'openssl x509 -in cert.pem -noout -dates -subject\nopenssl verify -CAfile chain.pem cert.pem'],
      ['四类常见报错', '过期：续签并替换（别忘了中间证书）\n链不完整：只发了叶子证书（浏览器能开、Java/App 报错）\nSNI 不匹配：一个 IP 多域名必须配 SNI\n时间偏差：设备时钟错也会被判证书无效'],
      ['批量巡检', '#!/bin/bash\nfor h in a.com b.com; do\n  echo -n "$h  "; echo | openssl s_client -connect $h:443 -servername $h 2>/dev/null \\\n    | openssl x509 -noout -enddate\ndone']
    ],
    tip: '「浏览器能打开、App 报证书错误」几乎都是证书链不完整——服务器只发了站点证书，没发中间证书。用 openssl s_client -showcerts 一看便知。'
  },
  {
    id: 'auto-terraform',
    devs: ['其他设备'],
    name: 'Terraform 管云网络（VPC / 子网 / 路由）',
    kw: ['terraform', 'iac', '基础设施即代码', '云网络', 'vpc 创建', '自动化建网'],
    cmds: [
      ['最小结构', 'provider "alicloud" { region = "cn-hangzhou" }\n\nresource "alicloud_vpc" "main" {\n  vpc_name   = "prod-vpc"\n  cidr_block = "10.10.0.0/16"\n}\nresource "alicloud_vswitch" "web" {\n  vpc_id     = alicloud_vpc.main.id\n  cidr_block = "10.10.1.0/24"\n  zone_id    = "cn-hangzhou-h"\n}'],
      ['工作流', 'terraform init       # 下载 provider\enterraform plan       # 先看要改什么，必看\nterraform apply\nterraform destroy    # 慎用'],
      ['状态管理', 'state 文件必须放远端（OSS/S3 + 锁），不要留本地\n# 多人协作时本地 state 会互相覆盖，后果很严重']
    ],
    tip: 'plan 里出现 destroy 或 replace 一定要停下来看清楚——网络资源被 replace 通常意味着换 IP、断连接。生产环境用 workspace 或按目录隔离环境。'
  },
  {
    id: 'auto-nornir-eng',
    devs: ['其他设备', 'Switch', 'Router'],
    name: 'Nornir 批量任务框架（比手写脚本更工程化）',
    kw: ['nornir', '批量框架', '网络自动化', 'python 批量', '并发执行'],
    cmds: [
      ['hosts.yaml', 'sw1:\n  hostname: 10.1.10.2\n  platform: hp_comware\n  username: admin\n  password: "***"\n  groups: [access]'],
      ['任务脚本', 'from nornir import InitNornir\nfrom nornir_netmiko.tasks import netmiko_send_command\n\nnr = InitNornir(config_file="config.yaml")\nres = nr.run(task=netmiko_send_command, command_string="display version")\nfor host, r in res.items():\n    print(host, str(r[0].result).splitlines()[0])'],
      ['过滤与并发', 'nr.filter(groups=["access"]).run(...)   # 只跑某组设备\n# config.yaml 里 num_workers: 20 控制并发数']
    ],
    tip: 'Nornir 相比自己写 for 循环，强在「清单、分组、并发、结果汇总」四件事都是现成的。设备一过 20 台就该换它，否则脚本里全是 try/except 和 sleep。'
  },
  {
    id: 'auto-gitops',
    devs: ['其他设备'],
    name: '配置的 CI 校验（GitOps 落地）',
    kw: ['gitops', 'ci', '流水线', '配置校验', '变更管控', '配置基线检查'],
    cmds: [
      ['流水线思路', 'push 配置 → ① 语法检查 ② 关键项检查 ③ 人工审批 → 下发\n语法：设备侧回读对比（display current-configuration）\n关键项：必须有 ntp / syslog / aaa / 管理 ACL'],
      ['GitLab CI 片段', 'check:\n  script:\n    - python tools/check_cfg.py "configs/*.cfg"\n    - python tools/diff_baseline.py configs/ baseline/\n  rules:\n    - if: $CI_COMMIT_BRANCH == "main"'],
      ['关键项脚本思路', 'import glob\nMUST = ["ntp-service", "info-center", "stelnet server enable"]\nfor f in glob.glob("configs/*.cfg"):\n    s = open(f, encoding="utf-8").read()\n    for m in MUST:\n        if m not in s:\n            print("缺", m, f)']
    ],
    tip: 'CI 校验挡住的其实是低级错误——漏配 NTP、忘了管理 ACL、命令拼错。但就这几类，占了变更事故的一大半。'
  },
  {
    id: 'ops-otdr',
    devs: ['其他设备'],
    name: '光纤熔接与 OTDR 测试',
    kw: ['熔接', 'otdr', '光纤测试', '光缆', '损耗', '法兰', '盘纤', '光纤断点'],
    cmds: [
      ['熔接流程', '1. 剥纤 4cm → 酒精 + 无尘纸清洁（单向擦）\n2. 切割刀切端面（角度 ≤ 1°）\n3. 熔接机放电熔接，读估算损耗\n4. 热缩管加热保护\n5. 盘纤：弯曲半径 ≥ 3cm'],
      ['指标参考', '熔接点损耗 ≤ 0.05 dB（好的能到 0.02）\n连接器（法兰）≤ 0.3 dB\n1310nm 衰减 ≈ 0.35 dB/km\n1550nm 衰减 ≈ 0.20 dB/km'],
      ['OTDR 参数', '波长：1310 / 1550 各测一次\n脉宽：短链路 10ns、长链路 1μs\n折射率：按光纤型号设（G.652D 约 1.468）\n# 两端对测取平均，单向有盲区']
    ],
    tip: 'OTDR 近端有盲区，短链路要加一段假纤（launch cable）才能看清第一个接头。熔接机显示的估算损耗只能当参考，以 OTDR 实测为准。'
  },
  {
    id: 'ops-cabling-test',
    devs: ['其他设备'],
    name: '综合布线认证测试（Fluke / 永久链路）',
    kw: ['布线测试', 'fluke', '认证测试', '永久链路', '串扰', '回波损耗', 'cat6', '验收'],
    cmds: [
      ['测什么', '插入损耗（IL）、近端串扰（NEXT）、回波损耗（RL）、\n衰减串扰比（ACR-F / ACR-N）、传播时延与时延偏离'],
      ['长度限制', '永久链路（配线架 → 信息面板）≤ 90 m\n信道（含两端跳线）≤ 100 m\n# 超长是 Cat6 不合格的第一大原因'],
      ['常见不合格', 'NEXT 差：解绞过长、线被压、用了劣质水晶头\nRL 差：阻抗不匹配（不同品牌线材/水晶头混用）\n# 重做两端接头通常能救回来'],
      ['验收', '每条链路都要有带曲线的测试报告\n# 只认认证仪表报告，不认测线仪「通断」']
    ],
    tip: '「能通」和「能跑千兆/2.5G」是两回事：测线仪只测通断，认证测试才测串扰与回波。Cat6 跑千兆没问题、跑 2.5G 掉速，往往就是 NEXT 余量不足。'
  },
  {
    id: 'ops-ups',
    devs: ['其他设备', '服务器'],
    name: '机房 UPS / PDU 与环境监控',
    kw: ['ups', 'pdu', '机房环境', '电池', '双路供电', '温湿度', '掉电', '断电'],
    cmds: [
      ['UPS 关注项', '负载率 ≤ 70%（留余量给扩容和旁路切换）\n电池组 3~5 年更换，容量低于 80% 必须换\n每年一次带载放电测试（≥ 30% 负载）'],
      ['PDU 与双路', '服务器双电源必须分别接 A/B 两路 PDU\n# 单路 PDU 掉电 = 双电源白配'],
      ['环境', '温度 18~27℃，湿度 40%~60%\n冷热通道封闭；机柜进风温度比机房整体温度更关键'],
      ['SNMP 接入', 'UPS 网卡告警指向监控平台\n关键告警：市电中断、电池低、转旁路、输出过载']
    ],
    tip: '机房事故里「电池老化 + 从没做过放电测试」占很大比例——市电一断才发现只能撑三分钟。UPS 的 SNMP 卡务必接进监控，别只看面板灯。'
  },
  {
    id: 'ops-ipam',
    devs: ['其他设备'],
    name: 'IP 地址管理（IPAM）与回收',
    kw: ['ipam', 'ip 管理', '地址规划', 'ip 冲突', '地址回收', 'netbox', 'phpipam'],
    cmds: [
      ['为什么需要', '用 Excel 管 IP，冲突是必然的：谁改了什么没人知道\n工具：phpIPAM / NetBox（自建），云上可用厂商 IPAM'],
      ['最小落地集', '① 网段 ↔ VLAN 对应表\n② 已用 / 预留 / 空闲 三态\n③ 谁在用（设备/系统/责任人）\n④ 变更记录'],
      ['核对现状', 'nmap -sn 10.1.10.0/24        # 扫存活\narp -a 或 display arp        # 看设备上实际在用的\n# 与 IPAM 比对，差集就是「黑户」或「漏登记」']
    ],
    tip: 'IP 冲突的根因几乎都是「有人手工配了没登记」。IPAM 不是工具问题是流程问题——申请、分配、回收三个动作必须有人负责，否则再好的系统也会烂掉。'
  },
  {
    id: 'ops-sim',
    devs: ['其他设备'],
    name: '网络仿真环境（EVE-NG / GNS3 / HCL）',
    kw: ['仿真', 'ensp', 'eve-ng', 'gns3', 'hcl', '实验环境', '练手', '模拟器'],
    cmds: [
      ['工具对比', 'EVE-NG：多厂商镜像，功能全，吃内存\nGNS3：轻量，路由实验够用\nHCL（新华三）：官方模拟器，Comware 命令最真实\n华为 eNSP：已停止维护，新系统兼容性差'],
      ['硬件建议', '16 核 / 32G 内存起步；单台交换机镜像约 1~2G\n# 笔记本跑 4~6 台就吃紧，建议服务器或云主机'],
      ['典型实验', '① OSPF 多区域 + 汇总 ② BGP 反射器\n③ VXLAN EVPN ④ 双出口切换 ⑤ 堆叠分裂']
    ],
    tip: '仿真能验证「命令对不对、路由通不通」，但验证不了性能和硬件行为——PFC、ECN、芯片缓存这类问题只能在真机上测。'
  },
  {
    id: 'ops-inspection',
    devs: ['Switch', 'Router', '防火墙'],
    name: '巡检脚本（批量采集 + 生成报表）',
    kw: ['巡检', '批量采集', '报表', '自动化巡检', '定期检查', 'inspection'],
    cmds: [
      ['采集项清单', '版本与运行时长、CPU/内存、端口 up/down 与错包、\n路由邻居状态、日志告警、光功率、风扇与电源状态'],
      ['Python 骨架', 'from netmiko import ConnectHandler\nimport csv\n\nCMDS = ["display version", "display cpu-usage", "display interface brief"]\nrows = []\nfor ip in ips:\n    with ConnectHandler(device_type="hp_comware", host=ip, username=u, password=p) as c:\n        for cmd in CMDS:\n            rows.append([ip, cmd, c.send_command(cmd)])\nwith open("report.csv", "w", newline="", encoding="utf-8") as f:\n    csv.writer(f).writerows(rows)'],
      ['定时执行', '# crontab：每天 07:00 生成并发邮件\n0 7 * * * cd /opt/net && python inspect.py && mail -s 巡检报表 ops@corp < report.csv']
    ],
    tip: '巡检真正的价值在于「和历史比」——单次快照看不出问题，把每天结果存档，端口错包增长、CPU 缓慢爬升这类趋势问题才会暴露。'
  }
];

module.exports = { NEWTECH_EXTRA };
