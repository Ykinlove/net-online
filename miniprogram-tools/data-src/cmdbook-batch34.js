/* 第 34 轮：光层 / 自动化 / 告警工程 / 规范治理
   这批补的是「设备以上、项目以下」的那层能力：
   光层看波分、芯片层看表项、自动化看解析、告警看降噪、文档看规范。
   共同点：都不是配置命令，但决定了你是「会敲命令」还是「能扛事」。
*/
const BATCH34_EXTRA = [
  {
    id: 'otn-dwdm',
    devs: ['其他设备', 'Router', 'Switch'],
    name: '波分（DWDM / OTN）与光层故障判定',
    kw: ['波分', 'dwdm', 'otn', '光层', '色散', '光信噪比', 'osnr', '传输故障', '光功率预算'],
    cmds: [
      ['光层与电层要分开看', '光层：波长、光功率、OSNR、色散——决定「光能不能过去」\n电层：OTN 帧、ODU 交叉、告警——决定「业务能不能装进去」\n# 光层不通，电层配得再对也没用'],
      ['四个核心光指标', '① 收光功率：一般 -8 ~ -20dBm（各厂家型号不同）\n② OSNR：> 20dB 可用，< 15dB 误码飙升\n③ 色散：超限会导致长距传输误码\n④ 光功率预算：发送 - 接收 ≥ 全程衰减 + 余量（3dB）'],
      ['OTN 告警怎么读', 'LOS（信号丢失）：光根本没过来 → 查光路/光模块/尾纤\nLOF（帧丢失）：有光但帧对不上 → 速率/封装不匹配\nLOM（复帧丢失）：帧对上了但复帧错 → 时钟或对接参数\n# 顺序：LOS → LOF → LOM，越往后问题越细'],
      ['误码怎么定界', 'B1/B2（再生段/复用段）误码：线路侧问题\nB3（通道）误码：客户侧或映射问题\n# B1/B2 有误码 = 光路质量差（衰减大/接头脏/色散超限）\n# 只有 B3 有误码 = 客户侧设备或映射配置问题'],
      ['现场能做的四件事', '① 清洁所有光纤接头（无尘纸 + 无水酒精，单向擦拭）\n② 换尾纤试（成本最低，解决率高）\n③ 测收发光功率，与开通时基线对比\n④ 检查弯曲半径（≥ 30mm），盘纤不能死折'],
      ['EDFA 放大器注意', '放大器只放大光，不改善 OSNR，反而会劣化\n多级放大后 OSNR 逐级下降，所以要控制放大级数\n# 长距链路 OSNR 不够时，正确做法是加再生器而不是加放大器'],
      ['和运营商对接时的说法', '不要只说「光断了」，要说：\n「XX 波道收光 -28dBm，低于门限 -20dBm，OSNR 12dB，\n判断为线路衰减异常，请核查该波道全程光功率」\n# 有数值的报障，处理速度快一倍']
    ],
    tip: '波分故障九成在光层，不在配置。清洁接头这个动作看着原始，实际能解决接近三成的现场问题——尤其南方潮湿地区和长期未维护的机房。'
  },
  {
    id: 'py-textfsm',
    devs: ['Linux', '服务器'],
    name: '配置解析与巡检报表（TextFSM / 正则）',
    kw: ['textfsm', '配置解析', '巡检报表', '正则解析', 'nornir', '解析配置', '批量巡检', '导出表格'],
    cmds: [
      ['为什么需要解析', '100 台设备的 display 输出，肉眼看不完\n# 目标：把「文本输出」变成「表格」，再判断异常\n# 输出成 csv 就能直接丢给 Excel 筛选'],
      ['TextFSM 模板怎么写', 'Value IFACE (\\S+)\nValue STATUS (up|down)\nValue PROTO (up|down)\n\nStart\n  ^${IFACE}\\s+${STATUS}\\s+${PROTO} -> Record\n# 保存为 templates/display_interface_brief.textfsm'],
      ['Python 调用（不用记 API，记套路）', 'import re\npat = re.compile(r"^(\\S+)\\s+(up|down)\\s+(up|down)")\nrows = []\nfor line in output.splitlines():\n    m = pat.match(line.strip())\n    if m:\n        rows.append(m.groups())\nprint(len(rows), rows[:3])\n# 先用正则跑通，再考虑上 TextFSM'],
      ['Netmiko + TextFSM 组合', 'from netmiko import ConnectHandler\nfrom textfsm import TextFSM\n\ndev = dict(device_type="huawei", host="10.1.1.1",\n           username="admin", password="***")\nwith ConnectHandler(**dev) as conn:\n    out = conn.send_command("display interface brief")\n\nwith open("templates/huawei_interface.textfsm") as f:\n    tpl = TextFSM(f)\nrows = tpl.ParseTextToDicts(out)'],
      ['巡检报表该有哪些列', '设备名 / 管理 IP / 接口 / 状态 / 描述 / 收发光 / 错包数 / 采集时间\n# 关键：一定要有「采集时间」和「基线值」\n# 只有当前值没有基线，无法判断是否异常'],
      ['异常判定规则（别人工看）', '接口 down 但有描述 → 异常\n收光 < 门限 → 异常\n错包数相比基线增长 > 100 → 异常\nCPU > 70% 持续 3 次 → 异常\n# 规则写成代码，每天自动跑，只输出异常行'],
      ['产出形态', '① 每日巡检 csv（邮件附件）\n② 异常汇总（只发有问题的设备）\n③ 趋势图（收光/错包/CPU 变化）\n# 别做花哨的看板，先做能每天准时发的表']
    ],
    tip: '自动化的价值不在「少敲命令」，在「结果可对比」。同样的数据存了 30 天，你就能回答「这个口的错包是今天开始涨的，还是三个月一直在涨」——这才是排障的关键信息。'
  },
  {
    id: 'alert-noise',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: '告警降噪与阈值设计',
    kw: ['告警降噪', '阈值', '误报', '告警风暴', '告警配置', '监控阈值', '告警治理', '重复告警'],
    cmds: [
      ['先看告警分布（不治本只治标没用）', '# 统计近 7 天告警 TOP10 与来源\n# 通常会发现：80% 的告警来自 20% 的设备，且多为同一条\n# 第一步不是加规则，是找出「谁在刷屏」'],
      ['阈值必须分级（单阈值一定炸）', '警告：CPU > 70% 持续 5 分钟（工作时间）\n严重：CPU > 85% 持续 5 分钟\n紧急：CPU > 95% 持续 3 分钟\n# 单阈值的结果：要么天天误报，要么真出事不报'],
      ['三个降噪手段（按效果排）', '① 抑制（Suppression）：上游故障时，抑制下游衍生告警\n② 聚合（Aggregation）：同设备同类型 N 条合并成 1 条\n③ 依赖（Dependency）：核心断了，接入的告警不再单发\n# 抑制是最有效的，能砍掉一半以上'],
      ['必须抑制的典型场景', '核心交换机重启 → 下挂 50 台 AP 全部离线告警\n运营商链路断 → 全网 200 条「目标不可达」\n# 做法：配置父子关系，父告警出现时子告警静默\n# 没有依赖关系配置的监控系统，等于没做降噪'],
      ['抖动抑制（防告警风暴）', '同一告警 5 分钟内只发一次\n恢复告警延迟 2 个周期再发（防止闪断刷屏）\n# 端口 up/down 抖动是最常见的风暴源，必须配延迟'],
      ['分时段阈值（低成本高收益）', '业务高峰（9:00-18:00）：CPU 阈值 85%\n非工作时间：CPU 阈值 70%\n# 备份窗口、批量任务时段的告警单独设\n# 一条时段策略能消掉大量「 nightly 误报」'],
      ['告警有效性怎么衡量', '每月统计：告警总数 / 真事件数 / 误报率 / 平均响应时长\n# 误报率 > 80% 说明系统形同虚设——没人会看每天 3000 条告警\n# 目标：每人每天有效告警 ≤ 10 条'],
      ['最后一道：告警必须可执行', '每条告警要能回答「我该做什么」\n× 「CPU 高」 → ✓ 「CPU 92%，建议检查是否有环路或广播风暴，命令：display cpu-usage」\n# 不可执行的告警等于噪声']
    ],
    tip: '告警治理的核心不是「多接监控」，是「敢关告警」。一套每天几千条的系统，值班同事三天后就完全不看了——从安全角度讲，这比没有监控更危险。'
  },
  {
    id: 'switch-chip',
    devs: ['Switch'],
    name: '芯片级排障（表项 / 硬件转发 / 诊断shell）',
    kw: ['芯片', 'bcm', 'asic', '表项', '硬件转发', '诊断', 'diag', 'acl 表项', 'mac 表满', 'fdb 满'],
    cmds: [
      ['什么时候需要下到芯片层', '① 接口计数无丢包、策略无命中，但业务就是不通\n② 配置完全正确，转发行为却不对\n③ 表项写不进去（MAC/ARP/ACL 表满）\n# 常规命令查不出来的，才下芯片层'],
      ['先查表项容量（最常见的「静默不通」）', 'display mac-address total-number\ndisplay mac-address blackhole\ndisplay arp all | count\ndisplay acl resource\n# MAC 表满了以后，新 MAC 学不到 → 泛洪 → 性能崩但接口不报错'],
      ['华为：诊断视图', 'system-view\ndiagnose\n display forward-table\ndisplay fib slot 0\ndisplay acl resource\ndisplay mcu\ndisplay device resource\n# diagnose 下命令有风险，生产环境慎用，尤其带 reset/clear 的'],
      ['Cisco：底层查看', 'show platform hardware fed switch active fwd-asic resource\nshow platform hardware fed switch active mac table\nshow platform tcam utilization\nshow platform resources\n# TCAM 利用率是重点：ACL/QoS 表项满了以后新策略下发直接失败'],
      ['「配置生效但转发不对」的三种可能', '① 表项没下发到硬件（软件路径有，硬件路径无）\n② 哈希不均导致单链路拥塞（链路都 up 但实际只走一条）\n③ 表项冲突（新旧规则并存，老的优先）\n# 排查：清表项重下 / 看每条链路的实际计数'],
      ['链路聚合里「只有一条在跑」', 'display eth-trunk 1 verbose\n# 看每个成员口的入/出包计数是否均衡\n# 常见原因：哈希算法只看了 MAC（同源同目的必撞一条）\n# 修：改哈希为 src-dst-ip + src-dst-port L4'],
      ['风险控制', '① 芯片级命令只在业务低峰用\n② 任何 reset/clear 类命令先确认影响面\n③ 有厂商 TAC 支持时先问，别自己试\n# 一条 clear 命令可能让整机转发中断几秒']
    ],
    tip: '「配置对但不通」时最该查的是表项容量，而不是继续改配置。MAC 表、ARP 表、ACL 表、TCAM 满了以后设备不会报错，只会安静地做错事——这类故障最耗时间。'
  },
  {
    id: 'carrier-bras-qos',
    devs: ['Router'],
    name: 'BRAS 业务模板与用户侧限速',
    kw: ['bras', '限速模板', '宽带限速', 'pppoe 限速', '用户模板', 'radius', 'bras 配置', '拨号限速'],
    cmds: [
      ['BRAS 侧的三个核心概念', '① 域（domain）：一类用户的集合，绑定认证方式与地址池\n② 用户模板：限速、QoS、ACL 的集合\n③ RADIUS：认证、授权、计费（AAA）\n# 用户拨上来先找域，域决定用哪个模板'],
      ['华为：域的典型配置', 'aaa\n domain isp1\n  authentication-scheme radius1\n  accounting-scheme radius1\n  ip-pool POOL1\n  user-group GROUP1\n!\nip pool POOL1 local\n gateway 100.64.0.1\n section 0 100.64.0.2 100.64.0.254\n# 地址池不够就是「拨号 691/678」的高频原因'],
      ['限速模板（用户侧带宽）', 'qos-profile USER_100M\n car cir 100000 cbs 1250000\n!\n# 绑定：域下 qos-profile USER_100M inbound/outbound\n# 关键：CIR 单位是 kbps，别写成 bps\n# CBS 一般取 CIR 的 1/8 到 1/10（毫秒级突发）'],
      ['限速不准的常见原因', '① 只限了下行没限上行（用户上行打满，下行也卡）\n② CBS 设太小 → 实际速率跑不到标称值\n③ 限速点在 BRAS 而非用户端口 → 突发仍会冲击汇聚\n④ 多播/组播流量没算进限速'],
      ['RADIUS 授权下发的属性', '限速值通常由 RADIUS 下发：\nFilter-Id / Huawei-QoS-Profile-Name\nSession-Timeout（在线时长）\nIdle-Timeout（空闲下线）\n# 改限速要去 RADIUS 改，改 BRAS 本地模板可能不生效'],
      ['排障：用户说「网速不达标」', '① 看 BRAS 侧实际限速值：display aaa online-fail-record / display access-user\n② 看是否命中限速：display qos car statistics interface\n③ 测速时是否单线程（单线程跑不满是正常的）\n④ 是否被多拨/共享检测降速'],
      ['企业侧只需要记一句', '如果你是客户不是运营商：所有限速模板都在 BRAS 上，你改不了。\n报障时说「请核查该账号的 QoS 模板与地址池」比说「网慢」有效得多。']
    ],
    tip: '「宽带不达标」的投诉里，真正限速配错的不到两成。更多是单线程测速、Wi-Fi 衰减、终端性能。先让用户用有线单机测，能省掉一半上门。'
  },
  {
    id: 'sdwan-aar',
    devs: ['Router'],
    name: 'SD-WAN 应用感知路由（AAR）策略编排',
    kw: ['aar', '应用感知', 'sdwan 策略', 'sla 模板', '选路策略', '应用识别', 'sdwan 编排', '业务选路'],
    cmds: [
      ['AAR 的三层结构', '① 应用识别：把流量归类（Office365 / SAP / 语音 / 未知）\n② SLA 模板：定义每条链路的健康标准（时延/丢包/抖动）\n③ 选路策略：某应用在 SLA 达标时走哪条，不达标时切哪条'],
      ['应用识别怎么落地', '① 基于五元组（最准但难维护）\n② 基于 DPI 特征库（主流做法，要定期更新）\n③ 基于 DNS/FQDN（对 SaaS 有效）\n④ 基于端口猜测（最不可靠，只做兜底）\n# 生产建议：DPI + FQDN 双保险，纯五元组维护不动'],
      ['SLA 模板参数（别拍脑袋定）', '语音：时延 < 150ms，抖动 < 30ms，丢包 < 1%\n视频会议：时延 < 150ms，抖动 < 50ms，丢包 < 2%\nERP：时延 < 100ms，丢包 < 0.5%\n普通办公：时延 < 200ms，丢包 < 3%\n# 这些值来自业务体验，不是链路能力'],
      ['策略优先级（顺序决定结果）', '① 指定应用 + 指定链路（强制）\n② 应用 + SLA 优选（达标走主，不达标切备）\n③ 应用 + 最低成本（能走便宜链路就走）\n④ 默认（按目的地址走常规路由）\n# 规则从上往下匹配，第一条命中就停'],
      ['避坑：策略冲突', '两条策略同时匹配同一流量 → 只有一条生效，另一条形同虚设\n# 做法：策略表按月做一次覆盖检查，找出永远不会命中的规则\n# 和 ACL 体检一个道理'],
      ['避坑：来回路径不一致', '去程走 MPLS、回程走 Internet → 状态防火墙会丢包\n# 有状态设备在路径上时，必须保证同一会话双向同链路\n# 验证：tracert 去和回，看是否对称'],
      ['验证与观测', 'display sdwan policy statistics\ndisplay sdwan app-statistics\ndisplay nqa results all\n# 关注：每个应用的选路命中数、切换次数\n# 切换次数过高说明阈值抖动，要加迟滞']
    ],
    tip: 'SD-WAN 项目验收时最该看的是「切换次数」，不是「能不能切」。一天切两百次的策略等于没有策略——用户体验比单链路还差。'
  },
  {
    id: 'ac-ha',
    devs: ['AC', 'AP'],
    name: 'AC 高可用与 AP 跨 AC 备份',
    kw: ['ac 备份', 'ac 高可用', 'ac 主备', 'vrrp ac', 'hsb', 'ap 跨 ac', '无线高可用', 'ac 双机'],
    cmds: [
      ['三种 AC 可靠性方案', '① AC 主备（HSB 热备）：AP 同时连两台 AC，主挂了秒级切换\n② AC 集群：多台 AC 组成逻辑一台，容量与可靠性兼得\n③ 无 AC（AP 自治）：分支小场景，AP 自己转发，靠云端管理\n# 中小型园区用①，大型园区用②'],
      ['华为：HSB 主备关键配置', 'hsb-service 0\n hsb-service-type access\n hsb-service-type dhcp\n hsb-group 0\n  hsb-service 0\n# 两台 AC 之间要建 HSB 通道，且 VRRP 主备角色要与 HSB 主备一致\n# 配错最常见：VRRP 是 A 主，HSB 却是 B 主 → 切换后 AP 全掉'],
      ['AP 怎么知道有两个 AC', 'capwap source interface Vlanif 100\n# AP 上线时通过 DHCP Option 43 或 DNS 拿到 AC 地址列表\n# 关键：Option 43 里要配「主 AC + 备 AC」两个地址\n# 只配一个，主挂了 AP 就失联'],
      ['切换时业务会断多久', '只做 VRRP 不做 HSB：AP 需要重新建 CAPWAP 隧道，断 10~60 秒\n配了 HSB 会话同步：毫秒级，终端基本无感\n# 差别就在于「AP 状态与用户表项有没有同步」'],
      ['验证方法（必须实测）', '① 手动关闭主 AC 的无线业务口\n② 观察 AP 在线状态与终端重连时间\n③ 记录中断秒数，写进验收报告\n# 不实测的双机都是纸面高可用'],
      ['常见故障', 'AP 只在主 AC 上线，备 AC 上一个 AP 都没有 → Option 43 只配了一个\n切换后 AP 掉线不回来 → AC 版本不一致或 License 不共享\n切换后终端能连但不通 → HSB 没同步用户表项，网关侧 ARP 未更新'],
      ['License 注意', 'AP License 通常绑定 AC 序列号，备机要单独有 License\n# 备机没 License = 切换上去只能带一小部分 AP\n# 采购时常常漏掉这一项']
    ],
    tip: 'AC 主备项目最常见的验收漏洞是「只配了 VRRP 没配 HSB」。肉眼看是双机，实际切换要断一分钟——验收时必须真关一次主 AC，把中断秒数记下来。'
  },
  {
    id: 'nac-compliance',
    devs: ['Switch', '防火墙', '服务器'],
    name: '终端合规准入（补丁 / 杀软 / 外设管控）',
    kw: ['准入', '合规检查', '终端合规', 'nac', '补丁检查', '杀软检查', '外设管控', '终端安全'],
    cmds: [
      ['准入分三层，别只做认证', '① 身份认证：你是谁（802.1X / Portal / MAC 认证）\n② 合规检查：你的设备合格吗（补丁/杀软/屏保/共享）\n③ 权限授予：合格给什么权限，不合格给什么权限\n# 只做①叫认证，做了②③才叫准入'],
      ['合规检查项清单（挑 5 项就够）', '① 操作系统补丁级别\n② 杀毒软件是否安装且病毒库在 N 天内\n③ 是否开启屏幕保护与锁屏\n④ 是否开启个人防火墙\n⑤ 是否安装了禁止软件（P2P/私服）\n# 检太多会导致大量终端不合规，先做最容易达成的'],
      ['不合规怎么处理（三种隔离区）', '① 完全隔离：只能访问修复服务器\n② 受限访问：只能上内网补丁服务器 + 杀软升级\n③ 只读访问：能看不能改\n# 生产建议：受限访问，别一上来就完全隔离——用户会炸'],
      ['华为：准入的落地形态', '# 通常由 Agile Controller / iMaster NCE 下发\n# 交换机侧配合：\n dot1x enable\n authentication-profile NAC\n# 关键：RADIUS 返回的授权属性决定 VLAN 与 ACL\n# 不合规 → 授权到隔离 VLAN'],
      ['MAC 认证的例外（打印机/IoT）', '不支持 802.1X 的设备用 MAC 认证绕过\n# 但 MAC 可伪造，必须配合端口安全：\n port-security enable\n port-security mac-address sticky\n# 否则等于开了个后门'],
      ['上线节奏（这一步决定项目成败）', '① 先「只审计不阻断」跑两周，统计不合规率\n② 发通知 + 提供自助修复工具\n③ 再对不合规率高的部门单独沟通\n④ 最后才开阻断\n# 一上来就阻断，IT 部门会被投诉淹没']
    ],
    tip: '准入项目的失败几乎不是技术问题，是推行节奏问题。先审计两周看清现状，再决定合规项取舍——很多单位发现 60% 的终端连「杀软在运行」都做不到，那你的第一批检查项就定错了。'
  },
  {
    id: 'db-ha',
    devs: ['服务器', 'Linux', '防火墙'],
    name: '数据库 / 中间件高可用的网络侧配合',
    kw: ['数据库高可用', '主备切换', 'vip 漂移', 'keepalived', '心跳', '脑裂', '中间件', '双活'],
    cmds: [
      ['网络侧要保证的三件事', '① 心跳网络独立且低时延（不要和业务共用）\n② VIP 漂移后 ARP 能快速更新\n③ 主备之间的复制流量不抢业务带宽\n# 这三条任何一条不满足，DBA 那边就会怪网络'],
      ['心跳网络要求', '独立 VLAN + 独立物理口，最好直连\n时延 < 1ms，丢包 0（心跳丢包直接触发脑裂）\n# 千万别让心跳走业务链路——业务一拥塞就脑裂'],
      ['VIP 漂移与 ARP 问题（最经典）', '现象：主备切换成功，但客户端还连到旧主，连不上\n# 原因：交换机 ARP 表还缓存着旧 MAC\n# 解决：\n① 应用侧发免费 ARP（gratuitous ARP）\n② 交换机侧缩短 ARP 老化：arp expire-time 60\n③ 关键业务用 BFD 联动'],
      ['交换机侧配合命令', 'arp expire-time 60                # 华为，缩短老化\narp detect mode arp\n# Cisco：arp timeout 60\n# 更彻底：VIP 用同一个虚拟 MAC（VRRP 机制），避免 ARP 变更'],
      ['脑裂的判定与预防', '① 双心跳链路（两条独立路径）\n② 仲裁节点（第三台机器投票）\n③ 交换机侧做 STP 边缘口，避免心跳口被阻塞\n# 脑裂后果：双写数据库，数据损坏，比宕机严重得多'],
      ['复制流量别抢业务', '主备复制（MySQL binlog / Oracle Data Guard）可能跑满万兆\n# 做法：复制走独立网段 + QoS 限速\n# 否则业务高峰时复制延迟，RPO 直接失效'],
      ['排查顺序（网络侧能查什么）', '① ping 心跳口：时延与丢包\n② 看交换机端口错包\n③ 看 VIP 对应 MAC 是否已更新：display arp | include <VIP>\n④ 抓包看免费 ARP 有没有发出\n# 到这一步还查不出，才交给 DBA']
    ],
    tip: '「数据库切了但应用连不上」十次有八次是 ARP 缓存。VIP 漂移后交换机还记着旧 MAC，包全发给已经降备的那台。改个 ARP 老化时间就能解决，但不知道的话能查两天。'
  },
  {
    id: 'proxy-reverse',
    devs: ['服务器', 'Linux', '防火墙'],
    name: '反向代理与 API 网关的网络侧调优',
    kw: ['nginx', 'haproxy', '反向代理', 'api 网关', '负载均衡', '长连接', '502', '504', '超时'],
    cmds: [
      ['502 / 504 / 499 分别代表什么', '502 Bad Gateway：后端没响应或返回非法内容（后端挂了/超时）\n504 Gateway Timeout：后端处理超时（慢查询/阻塞）\n499：客户端主动断开（用户等不及关了页面）\n# 499 多说明后端太慢，不是网关的问题'],
      ['Nginx 关键参数', 'proxy_connect_timeout 5s;      # 连后端的超时\nproxy_read_timeout 60s;        # 等后端响应的超时\nproxy_send_timeout 60s;\nkeepalive_timeout 65;\n# 调优原则：先看后端真实耗时，再定超时，别一律 60s'],
      ['长连接与连接池（吞吐的关键）', 'upstream backend {\n  server 10.0.0.11:8080;\n  keepalive 64;               # 与后端保持 64 个空闲长连接\n}\nproxy_http_version 1.1;\nproxy_set_header Connection "";\n# 不配这三行，每个请求都新建 TCP，高并发下端口耗尽'],
      ['HAProxy 对应要点', 'timeout connect 5s\ntimeout client 60s\ntimeout server 60s\nbalance leastconn              # 长连接业务用 leastconn 比 roundrobin 好\n# 健康检查：option httpchk GET /health'],
      ['端口耗尽（高并发必踩）', 'net.ipv4.ip_local_port_range = 1024 65535\nnet.ipv4.tcp_tw_reuse = 1\nnet.core.somaxconn = 65535\n# 现象：TIME_WAIT 上万、新连接建不上\n# 根本解法：用长连接 + 连接池，而不是只调内核参数'],
      ['真实 IP 传递（日志里全是网关 IP）', 'proxy_set_header X-Real-IP $remote_addr;\nproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\nproxy_set_header X-Forwarded-Proto $scheme;\n# 后端要配合读这些头，否则风控/审计全失效'],
      ['排障顺序', '① 看网关错误日志（502/504 有明确原因）\n② 直接 curl 后端，绕过网关验证\n③ 看后端连接数是否打满\n④ 抓包看是 TCP 建不上还是等响应超时']
    ],
    tip: '网关类问题先分清「连不上」和「等太久」：502 是连不上或后端异常，504 是等太久。前者查后端存活，后者查后端性能——方向完全不同，别一起改。'
  },
  {
    id: 'ipv6-security',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'IPv6 安全（RA Guard / ND 欺骗 / DHCPv6 防护）',
    kw: ['ipv6 安全', 'ra guard', 'nd 欺骗', 'dhcpv6 guard', 'ipv6 攻击', 'ra 攻击', 'ipv6 防护', 'ndp'],
    cmds: [
      ['IPv6 天生比 IPv4 危险在哪', '① 主机自动配置（SLAAC）：插上网线就能上网，绕过 DHCP 管控\n② 邻居发现（NDP）无认证：可伪造，等同 IPv4 的 ARP 欺骗\n③ 一个接口多个地址：难以按 IP 做策略\n# 这三条让「IPv4 时的隔离手段」在 v6 下失效'],
      ['RA Guard（最重要的一条）', 'interface GigabitEthernet 0/0/1\n ipv6 nd raguard attach-policy TRUST\n# 接入端口禁止接收 RA 报文，只有上联口允许\n# 不开这个，任何人插个路由器就能发 RA，全网改网关'],
      ['DHCPv6 Guard', 'ipv6 dhcp guard policy DHCP_TRUST\n trusted-port\ninterface GigabitEthernet 0/0/1\n ipv6 dhcp guard attach-policy DHCP_TRUST\n# 防止私接 DHCPv6 服务器发地址'],
      ['ND 欺骗防护（对应 DAI）', 'ipv6 nd inspection policy ND_INSP\n validate source-mac\ninterface GigabitEthernet 0/0/1\n ipv6 nd inspection attach-policy ND_INSP\n# 检查 ND 报文里的源 MAC 与二层是否一致'],
      ['IPv6 ACL 的三个必做', '① 拒绝 RA/NS 从接入口进入（除上联）\n② 拒绝 ICMPv6 类型 133-137 中的非法组合\n③ 明确放行 ICMPv6（v6 不能全禁 ICMP，否则 ND 全废）\n# 关键：IPv6 里 ICMP 是基础设施，不能像 v4 那样一刀切'],
      ['防火墙侧注意', '① 默认策略要覆盖 IPv6（很多策略只写了 v4）\n② 扩展头（Extension Header）可能绕过简单 ACL\n③ 分片攻击在 v6 下更常见，要开重组检查\n# 检查方法：确认策略表里 IPv6 规则数与 v4 对得上'],
      ['落地节奏', '① 先在上联口定义 trusted，接入口全 untrusted（默认拒 RA）\n② 观察一周，看是否有终端受影响\n③ 再开 ND Inspection（对老旧设备可能不兼容）\n# 先开 RA Guard 收益最大、风险最小']
    ],
    tip: 'IPv6 改造最容易被忽略的是「安全策略没跟着改」。很多单位 v4 侧做了严密的隔离，v6 一开全是通的——因为防火墙上根本没写 v6 规则，默认放行。'
  },
  {
    id: 'qinq',
    devs: ['Switch'],
    name: 'QinQ 双层 VLAN（多租户 / 运营商接入）',
    kw: ['qinq', '双层 vlan', 'vlan 堆叠', '多租户', 'selective qinq', 'svlan', 'cvlan', 'vlan 嵌套'],
    cmds: [
      ['QinQ 解决什么问题', '内层 VLAN（C-VLAN）是客户的，外层（S-VLAN）是我们的\n# 好处：不同客户可以用相同的 VLAN ID，互不冲突\n# 典型场景：园区多租户、运营商宽带接入、酒店/宿舍'],
      ['华为：基本 QinQ', 'interface GigabitEthernet 0/0/1\n port link-type dot1q-tunnel\n port default vlan 100\n# 该口收到的所有报文统一打上外层 VLAN 100\n# 客户内部 VLAN 原样保留在内层'],
      ['选择性 QinQ（按内层 VLAN 打不同外层）', 'interface GigabitEthernet 0/0/1\n port link-type hybrid\n port vlan-stacking vlan 10 stack-vlan 100\n port vlan-stacking vlan 20 stack-vlan 200\n# 灵活但要注意：没匹配到的 VLAN 怎么处理（默认丢弃）'],
      ['Cisco：对应配置', 'interface GigabitEthernet1/0/1\n switchport mode dot1q-tunnel\n switchport access vlan 100\n# 或 selective：switchport vlan mapping 10 dot1q-tunnel 100'],
      ['MTU 必须调（最容易忘）', '外层标签多 4 字节，1500 的包变 1504\n# 全路径 MTU 调到 1504 以上，否则大包被丢\n# 症状：能 ping 通，网页打不开，传大文件失败'],
      ['排障要点', '① 看外层 VLAN 是否打上：display vlan 100\n② 看内层 VLAN 是否保留：抓包确认双层标签\n③ 上联口必须是 trunk 且放行外层 VLAN\n④ 中间设备若不支持 QinQ，内层标签会被当普通 VLAN 处理'],
      ['和 VXLAN 的选择', 'QinQ：二层扩展，范围限于同一广播域，配置简单\nVXLAN：三层扩展，可跨机房，需要 EVPN 控制面\n# 同机房多租户用 QinQ，跨机房用 VXLAN']
    ],
    tip: 'QinQ 的坑集中在 MTU：外层标签多吃 4 字节，全网 MTU 没调的话，表现为「小包通、大包死」。开通当天必做 ping -s 1472，通不过就先查 MTU。'
  },
  {
    id: 'mstp-plan',
    devs: ['Switch'],
    name: 'MSTP 实例规划与负载分担',
    kw: ['mstp', '多实例', '生成树实例', '负载分担', 'stp 实例', 'vlan 映射', 'msti', '生成树规划'],
    cmds: [
      ['为什么用 MSTP 而不是 RSTP', 'RSTP 只有一个实例，所有 VLAN 共享一棵树 → 一半链路永远阻塞\nMSTP 可以按实例建多棵树 → VLAN 10 走左边，VLAN 20 走右边\n# 前提：规划好实例与 VLAN 的映射，否则等于没用'],
      ['华为：MSTP 配置', 'stp mode mstp\nstp region-configuration\n region-name CAMPUS\n revision-level 1\n instance 1 vlan 10 20\n instance 2 vlan 30 40\n active region-configuration\n# 三要素必须全一致：域名 + 修订级别 + 实例-VLAN 映射'],
      ['根桥与备份根桥', 'stp instance 1 root primary\nstp instance 2 root secondary\n# 核心 A：实例 1 主、实例 2 备\n# 核心 B：实例 1 备、实例 2 主 → 两条上行都用到'],
      ['Cisco（PVST+ / MST）对应', 'spanning-tree mode mst\nspanning-tree mst configuration\n name CAMPUS\n revision 1\n instance 1 vlan 10,20\nspanning-tree mst 1 root primary\n# Cisco 默认是 PVST+，每 VLAN 一棵树，规模大时 CPU 压力大'],
      ['最常见的翻车：三要素不一致', '现象：两台设备直连，却各自算出不同的树，出现环路\n# 原因：region-name 大小写不同 / revision 不同 / 映射不同\n# 排查：display stp region-configuration 逐台对比\n# 一句话：MSTP 的域是一个「隐式集群」，参数不一致就不在一个域'],
      ['实例数量别贪多', '一般 2~4 个实例足够（按业务类型分：办公/生产/语音/访客）\n# 实例越多，拓扑变化计算越多，收敛越慢\n# 每个实例都要单独规划根桥，规划不动就别开那么多'],
      ['验证', 'display stp instance 1 brief\ndisplay stp instance 2 brief\n# 关注：每个实例的根桥位置是否符合设计、阻塞端口在哪\n# 设计目标：不同实例的阻塞端口应该落在不同链路上']
    ],
    tip: 'MSTP 最常见的「配了等于没配」是三要素不一致——两台设备域名差一个字母，就不在同一个域，各算各的树。上线前逐台 display 对比一遍，比事后查环快得多。'
  },
  {
    id: 'naming-spec',
    devs: ['Switch', 'Router', '防火墙', '服务器'],
    name: '命名 / 编号 / 地址规划规范',
    kw: ['命名规范', '设备命名', '编号规划', 'vlan 编号', 'ip 规划', '地址规划', '规范', '标准化'],
    cmds: [
      ['设备命名（一眼看懂位置与角色）', '格式：角色-机房-机柜-序号\n例：CORE-A01-R03-01（核心- A 机房-03 机柜-01 号）\n例：ACC-B02-R12-03（接入- B 机房-12 机柜-03 号）\n# 关键：名字里要有「位置」，否则现场永远找不到设备'],
      ['VLAN 编号规划（分段而不是连号）', '1-99：保留（不要用）\n100-199：管理\n200-299：办公\n300-399：生产/业务\n400-499：语音\n500-599：访客 / IoT\n900-999：互联 / 临时\n# 分段的目的是「看 ID 就知道用途」，而不是从 10 开始连号'],
      ['IP 地址规划（按需求留空）', '10.<园区>.<功能>.<主机>/16 或 /24\n例：10.1.200.0/24 办公、10.1.400 段留给未来\n# 三条铁律：\n① 每个园区预留 50% 未分配\n② 互联地址用 /30 或 /31，单独一段\n③ Loopback 单独一段，按设备编号'],
      ['接口描述（比命名更重要）', 'interface 10GE1/0/49\n description TO-CORE-A01-10GE1/0/1\n# 描述写「对端设备+对端端口」，不写「上联」\n# 排障时这句话能省你半小时翻图纸'],
      ['文档三件套（不写等于没规划）', '① IP 地址规划表（Excel，含用途与责任人）\n② VLAN 规划表（ID/用途/网段/网关）\n③ 设备台账（名称/型号/SN/位置/版本/EOL 日期）\n# 三份文档 + git 管理，就是最实用的 IPAM'],
      ['不要做的事', '× 用设备默认名（Huawei / Switch）——出问题不知道是哪台\n× VLAN 1 承载业务\n× 地址段随手分（后期冲突排查极痛苦）\n× 只在脑子里记（人员一换全丢）'],
      ['落地建议', '① 新项目严格执行，老项目逐步整改\n② 命名改了要同步监控、备份、文档三处\n③ 整改分阶段：先文档，再描述，最后改名']
    ],
    tip: '规范的价值不在「整齐好看」，在「出事时能快速定位」。一台叫 Switch 的设备半夜告警，你得先查半天它在哪；叫 ACC-B02-R12-03 的，看一眼就知道该派谁去哪个机房。'
  },
  {
    id: 'report-writing',
    devs: ['其他设备'],
    name: '故障报告与技术文档写作',
    kw: ['故障报告', '复盘', 'rca', '技术文档', '月报', '写报告', '根因分析', '事故复盘'],
    cmds: [
      ['故障报告的六段结构', '① 事件概述（时间、影响范围、持续时长、等级）\n② 时间线（精确到分钟，谁在什么时候做了什么）\n③ 影响分析（业务、客户、金额）\n④ 根因（技术根因 + 管理根因）\n⑤ 处置过程（含走了哪些弯路）\n⑥ 改进项（谁、何时、做到什么程度）\n# 缺任何一段，报告都会被退回'],
      ['时间线怎么写才有用', '09:12 监控告警：核心交换机 CPU 92%\n09:15 值班确认，业务反馈卡顿\n09:20 定位为环路，屏蔽某接入口\n09:28 业务恢复\n# 关键：写「做了什么」和「看到什么」，不写「紧急处理」这种空话'],
      ['根因要分两层', '技术根因：某接入端口配置了错误的上联，形成环路\n管理根因：变更无审批、无回退方案、无验证清单\n# 只写技术根因的报告，改进项永远是「加强培训」'],
      ['改进项必须可验收', '× 「加强监控」→ ✓「11 月 30 日前完成环路告警，阈值 CPU>80% 持续 3 分钟」\n× 「完善流程」→ ✓「12 月起所有变更需填写回退方案，由组长审批」\n# 每条改进项要有：责任人 + 时间 + 可验证的结果'],
      ['月报写什么（别写成流水账）', '① 关键指标：可用率、故障次数、平均恢复时间（MTTR）\n② 容量趋势：出口 P95、核心互联峰值、无线并发\n③ 风险项：EOL 设备、单点、未闭环隐患\n④ 下月计划（三条以内）\n# 领导只看①②③，④用来对齐预期'],
      ['方案书的三段法', '① 现状与问题（用数据说话：P95 78%、故障 6 次/月）\n② 方案（拓扑图 + 关键设计 + 为什么这么选）\n③ 投资与收益（分期、可选项、不做会怎样）\n# 最有用的是「不做会怎样」，它决定预算能不能过'],
      ['通用写作原则', '① 先结论后细节（领导只看第一段）\n② 用数字替代形容词\n③ 图比表好，表比文字好\n④ 术语统一，全文用同一个词\n# 一份好报告的标准：三个月后新人能看懂当时发生了什么']
    ],
    tip: '写报告最值钱的不是文笔，是「数字」。把「网络不稳定」换成「本月故障 6 次、累计中断 187 分钟、环比上升 40%」，一句话就让问题从「感觉」变成「必须解决」。'
  }
];

module.exports = { BATCH34_EXTRA };
