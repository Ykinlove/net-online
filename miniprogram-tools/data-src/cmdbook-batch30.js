/* 底层排障与专项批次（第 30 轮）
   这批往「更硬」和「更软」两头走：
   硬的一头是交换机芯片/缓存/转发面、光功率预算、运营商电路定界；
   软的一头是 SD-WAN 选路、语音视频 QoS、蓝队处置、考试速查。
   共同点：资料散在各厂商白皮书里，现场搜不到成体系的答案。
*/
const BATCH30_EXTRA = [
  {
    id: 'hw-microburst',
    devs: ['Switch'],
    name: '微突发与交换机缓存（水线 / 丢包但带宽没跑满）',
    kw: ['微突发', 'microburst', '缓存', 'buffer', '水线', '丢包', '带宽没用满', '突发流量'],
    cmds: [
      ['现象特征', '监控显示带宽利用率只有 30%，但端口有大量丢包\n瞬时突发（毫秒级）把队列缓存打满，平均利用率看不出来\n# 典型：存储、AI 训练、视频分发、备份窗口'],
      ['看丢包在哪队列', 'display qos queue statistics interface 100GE1/0/1\n# 找 Discard 计数的队列号\n# 对比入向/出向：入向丢 = 上联拥塞；出向丢 = 本端口拥塞'],
      ['看水线', 'display qos buffer-usage interface 100GE1/0/1\n# 部分型号：display hardware buffer / display qos queue buffer'],
      ['缓解手段', '① 加带宽或做多链路负载（治本）\n② 扩大缓存并调大突发门限\n③ 给关键业务单独队列 + 严格优先级\n④ 端侧限速（把突发削平，如 TCP 发送端限速）']
    ],
    tip: '「带宽没满却丢包」基本可以断定是微突发。平均 30% 利用率不代表瞬时不超过 100%——1 秒里 10 毫秒打满就能把缓存冲掉。监控要开毫秒级采样才能看见。'
  },
  {
    id: 'hw-forward-plane',
    devs: ['Switch', 'Router'],
    name: '转发面 vs 控制面（丢包到底在哪一级）',
    kw: ['转发面', '控制面', '丢包定位', '接口计数', 'cpu 高', '丢包在哪', '硬件转发'],
    cmds: [
      ['先看接口计数（转发面）', 'display interface GigabitEthernet 0/0/1\n# 关注：Input errors / CRC / Overruns / Drops / Giants\n# CRC 增长 = 物理层；Overruns = 队列溢出；Drops = 拥塞/策略'],
      ['再看策略与 ACL（转发面）', 'display acl 3000                 # 命中的 deny\n display traffic-policy statistics interface GigabitEthernet 0/0/1\n# 策略丢包一般有计数，注意别把「策略丢」当成「链路丢」'],
      ['最后看 CPU（控制面）', 'display cpu-usage\ndisplay cpu-defend statistics all\n# 控制面高只会影响协议收敛/管理，正常转发靠芯片，除非上送 CPU 的流量被限速'],
      ['芯片级（必要时）', 'display hardware-forwarding statistics   # 部分型号\ndisplay fib slot 0                       # 路由表是否下到芯片\n# 表项没下发到芯片 = 走 CPU 慢路径，表现为「通但极慢」']
    ],
    tip: '排丢包先定层：接口计数（物理/队列）→ 策略计数（ACL/QoS）→ CPU（控制面）。三层都没有丢包，才怀疑芯片表项或上游设备。'
  },
  {
    id: 'carrier-circuit',
    devs: ['Router', '防火墙', '其他设备'],
    name: '运营商电路故障定界（电路号 / 告警 / 丢包）',
    kw: ['运营商', '电路', '专线故障', '报障', '光路告警', '丢包定界', '电信联通移动', '链路中断'],
    cmds: [
      ['报障前先自证', '① 本端光模块 Tx/Rx 光功率（无光 = 光路断，直接报障）\n② 本端接口计数（CRC 增长 = 线路质量）\n③ 环回测试：本端自环（光模块是否正常）\n④ 对端设备是否可达（若中间有传输设备）'],
      ['需要提供的四项信息', '电路号（专线编号）、两端设备与端口、\n故障时间与现象、已做的自测结果\n# 没有电路号，运营商基本无法受理'],
      ['丢包定界', '本端 ping 运营商网关（第一跳）丢包 → 线路/接入侧\n运营商网关不丢、跨网丢 → 骨干或对端\n# 用 mtr 记录每一跳，截图作为证据'],
      ['常见责任划分', '光功率过低/无光 → 运营商（光路）\n本端 CRC 增长但对端正常 → 本端模块或跳线\n两端都正常但业务异常 → 多半是自己路由/策略']
    ],
    tip: '和运营商扯皮最有效的方式是「数据」：光功率读数、CRC 计数、mtr 逐跳截图、时间点。只说「我们这边网络不好」，通常换来一句「我们这边检测正常」。'
  },
  {
    id: 'sdwan-policy',
    devs: ['Router', '防火墙', '其他设备'],
    name: 'SD-WAN 应用选路（SLA 探测 + 切换）',
    kw: ['sdwan', 'sd-wan', '应用选路', 'sla 探测', '智能选路', '多链路', '链路切换'],
    cmds: [
      ['三个核心概念', '① 应用识别（按特征/DSCP/端口分类）\n② SLA 探测（时延/丢包/抖动阈值）\n③ 策略（应用 → 优先链路，超阈值切备链）'],
      ['策略示例（思路）', '业务：视频会议 → 优先 MPLS，SLA 超阈值切 5G\n办公：O365 → 优先宽带，负载分担\n# 实际命令随厂商（华为 SD-WAN / 思科 vEdge / 深信服）差异大'],
      ['探测参数建议', '探测间隔 3~5s，连续 3 次超阈值才切（防抖）\n阈值：时延 <150ms、丢包 <1%、抖动 <30ms（语音/视频）'],
      ['验证', '看各链路 SLA 曲线与切换日志\n# 关键：切换后要能自动回切（prefer 原链路），否则会长期跑在备链上']
    ],
    tip: 'SD-WAN 落地最容易忽略的是「回切」——只配了切走没配切回，一次抖动之后业务永久跑在 5G 上，一个月流量费能翻几倍。'
  },
  {
    id: 'voice-qos',
    devs: ['Switch', 'Router', '防火墙'],
    name: '语音 / 视频端到端 QoS（DSCP 标记与队列）',
    kw: ['语音qos', '视频会议 qos', 'dscp', 'ef', '优先级队列', '语音卡顿', '丢包抖动'],
    cmds: [
      ['推荐标记', '语音承载 EF（DSCP 46）\n视频会议 AF41（DSCP 34）\n信令 CS3（DSCP 24）\n# 终端/话机先打标，交换机信任端口 DSCP'],
      ['接入层（信任 + 队列）', 'interface GigabitEthernet0/0/10\n trust dscp\n qos queue 6 wfq weight 30     # 语音队列\n# 华为可用：qos priority-queue ef（部分型号）'],
      ['上行与广域', 'trunk 上联要保留 DSCP（别被 remark 成 0）\n防火墙/路由器做整形时给 EF 留 10%~20% 带宽'],
      ['判断 QoS 是否生效', 'display qos queue statistics interface GigabitEthernet 0/0/10\n# 语音队列应有稳定出队计数；若 EF 队列也在丢包 → 带宽不足'],
      ['常见失败', '话机没打标（DSCP=0）→ 全网当普通流量\n中间设备 remark 清零\n无线侧未开 WMM → 语音走 BE 队列']
    ],
    tip: '语音卡顿先测三件事：时延（<150ms）、抖动（<30ms）、丢包（<1%）。三个都达标还卡，就是 QoS 没生效或无线 WMM 没开。'
  },
  {
    id: 'sec-blue-team',
    devs: ['防火墙', 'Switch', '其他设备'],
    name: '蓝队视角：内网失陷后的网络侧处置',
    kw: ['蓝队', '应急响应', '失陷', '横向移动', '隔离', '勒索病毒', '挖矿', '溯源'],
    cmds: [
      ['第一步：止血（别急着溯源）', '① 定位失陷主机（EDR 告警 / 异常外联 / 流量突增）\n② 断网隔离（关端口或划隔离 VLAN），保留镜像取证\n③ 排查同网段横向（看 ARP/MAC 表和 SMB/RDP 连接）'],
      ['网络侧关键动作', '封禁外联 IP/域名（防火墙出方向 deny + 记录）\n关闭不必要的 135/139/445/3389 跨段访问\n收紧 ACL：只保留业务必需端口'],
      ['取证要留的东西', '交换机 MAC/ARP 表快照、会话表、防火墙日志、\n受影响时段的流量镜像（若提前做了）\n# 时间线要和设备时钟对齐（NTP 一定要准）'],
      ['事后加固', '① 分区隔离（办公/服务器/IoT 分开）\n② 服务器区禁止直接上外网（走代理）\n③ 横向访问审计（SMB/RDP 日志集中）']
    ],
    tip: '应急时最忌讳「先溯源后止血」——一边分析一边继续扩散。正确顺序：隔离 → 保留证据 → 排查横向 → 清点影响 → 再溯源。'
  },
  {
    id: 'dc-underlay',
    devs: ['Switch'],
    name: '数据中心 underlay（收敛比 / 布线 / 上联）',
    kw: ['underlay', '收敛比', 'spine leaf', '数据中心布线', '上联带宽', '东西向流量'],
    cmds: [
      ['收敛比怎么选', '接入 : 汇聚 = 1:1 ~ 3:1（通用业务）\n计算/存储/AI 场景趋近 1:1（东西向流量大）\n# 收敛比越大，越容易在汇聚侧微突发丢包'],
      ['布线', '服务器双上联接不同 leaf（MLAG/EVPN 多活）\n跨机柜走主干，避免同柜单点\n# 光纤优先（AOC/DAC 短距），铜缆只用于柜内'],
      ['上联规划', '每台 leaf 至少 2 条上联到不同 spine（ECMP）\n# 上联带宽按「单台服务器峰值 × 台数 ÷ 收敛比」估算'],
      ['常见问题', '单条上联（没冗余）—— 一台 leaf 挂了整柜掉线\n上联 hash 不均 → 某条链路先满\n跨 spine 走二层 → 收敛慢、环路风险']
    ],
    tip: '数据中心 80% 流量是东西向，别按「南北向」思路设计。收敛比、上联哈希、MLAG 双活这三件事定错了，后面扩容只能重建。'
  },
  {
    id: 'net-optical-budget',
    devs: ['Switch', 'Router', '其他设备'],
    name: '光功率预算计算（这条链路到底能不能通）',
    kw: ['光功率预算', '链路预算', '光衰计算', '传输距离', '光模块选型', '分光器', '插损'],
    cmds: [
      ['基本公式', '接收光功率 = 发送光功率 - 链路总损耗\n链路总损耗 = 光纤衰减(长度×系数) + 熔接点(0.05×N) + 连接器(0.3×N) + 分光器插损'],
      ['常用系数', '1310nm：0.35 dB/km；1550nm：0.20 dB/km\n熔接点：≤0.05 dB/个；法兰(连接器)：≤0.3 dB/个\n1:8 分光器插损约 10.5 dB，1:16 约 13.8 dB'],
      ['举例', '10km 单模 1550nm：10×0.2=2.0dB\n+ 2 个熔接 0.1dB + 2 个法兰 0.6dB = 2.7dB\n发送 -3dBm → 接收约 -5.7dBm（10GBASE-LR 下限 -14dBm，合格）'],
      ['余量要求', '设计时留 3dB 余量（老化、脏污、弯折）\n# 余量不足的链路「现在能通、半年后断」']
    ],
    tip: 'PON 网络算光功率千万别忘了分光器——1:16 就是 13.8dB，很多「光猫不亮」其实是分光比选大了，不是光模块坏。'
  },
  {
    id: 'ops-twamp',
    devs: ['Router', 'Switch'],
    name: '时延测量（NQA / IP SLA / TWAMP）',
    kw: ['nqa', 'ip sla', 'twamp', '时延测量', '性能探测', '链路质量监测'],
    cmds: [
      ['华为 NQA', 'nqa test-instance admin to-core\n test-type icmp\n destination-address ipv4 10.1.1.1\n frequency 30\n!\nstart now\ndisplay nqa results admin to-core'],
      ['思科 IP SLA', 'ip sla 1\n icmp-echo 10.1.1.1 source-interface GigabitEthernet0/0/1\n frequency 30\nip sla schedule 1 life forever start-time now\nshow ip sla statistics 1'],
      ['看什么', 'min/avg/max 时延、丢包率、抖动（jitter 需 UDP 类型）\n# ICMP 类型测不出单向时延，要看双向对称性另测'],
      ['和 ping 的区别', 'ping 是人手动看一次；NQA/SLA 是持续采样 + 可联动路由切换\n# 生产建议用 NQA 做链路探测并 track 到静态路由']
    ],
    tip: 'ICMP 探测会被设备对 ICMP 限速干扰，测出来偏高；要精确测时延用 UDP/TWAMP 类型。探测频率别低于 10s，否则设备上全是探测流量。'
  },
  {
    id: 'exam-quick',
    devs: ['Switch', 'Router'],
    name: '认证考试高频命令速查（HCIA/HCIP/CCNA 通用）',
    kw: ['考试', 'hcia', 'hcip', 'ccna', '刷题', '认证', '高频命令', '考点'],
    cmds: [
      ['必背排障五连', 'display version / display current-configuration\ndisplay interface brief / display ip routing-table\ndisplay mac-address / display arp / display logbuffer'],
      ['协议验证', 'OSPF：display ospf peer brief、display ospf lsdb\nBGP：  display bgp peer、display bgp routing-table\nSTP：  display stp brief、display stp root\nVRRP： display vrrp brief'],
      ['易错点', '华为 trunk：port trunk allow-pass vlan all（不是 allowed）\nH3C SVI：interface Vlan-interface 10（带横线）\n思科保存：write memory / copy run start\n掩码：/30 只有 2 个可用地址，点对点互联首选'],
      ['实验常考', '① VLAN 间路由（SVI vs 单臂路由）\n② OSPF 多区域与虚连接\n③ VRRP 主备 + 上行 track\n④ ACL 应用方向（inbound/outbound 的相对性）']
    ],
    tip: '考试里 ACL 的方向最容易错：站在「路由器的接口」看流量是进还是出，不是站在源主机看。做题前先画箭头。'
  }
];

module.exports = { BATCH30_EXTRA };
