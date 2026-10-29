/* 现场与工具批次（第 25 轮）
   前面 649 条几乎都是「设备上敲什么」，但真正卡住人的往往不是命令，而是外围：
   水晶头线序记不清、Console 连上没输出、测带宽不知道用什么、抓包不会写过滤、
   光功率正常范围是多少、这段线到底通到哪。
   这批把「手边工具 + 物理层 + 采集」这一层补上，全部是可以照着做的实操步骤。

   devs 取值同 seed.js 的 DEVICES；现场类条目不绑定厂商，用「T568B / Linux / 通用」等口径。
*/
const FIELD_EXTRA = [
  {
    id: 'fld-rj45',
    devs: ['Switch', '其他设备'],
    name: '网线水晶头线序与制作（T568B / T568A）',
    kw: ['水晶头', '线序', '网线制作', '压线', 'rj45', 't568b', 't568a', '网线接法', '做网线', '直通线', '交叉线'],
    cmds: [
      ['T568B（最常用）', '1 橙白　2 橙　3 绿白　4 蓝　5 蓝白　6 绿　7 棕白　8 棕\n\n# 记忆：橙绿蓝棕，每对白在前\n# 千兆必须 8 芯全接；百兆只用 1/2/3/6 四芯'],
      ['T568A', '1 绿白　2 绿　3 橙白　4 蓝　5 蓝白　6 橙　7 棕白　8 棕\n\n# A 与 B 的差别：橙对和绿对互换\n# 两端同为 A 或同为 B = 直通线（现在基本都做 B-B）\n# 一端 A 一端 B = 交叉线（老设备互联，现设备都支持自动翻转）'],
      ['制作五步', '1. 剥外皮约 2cm，别割伤芯线绝缘\n2. 解绞、按线序排平（解绞长度越短越好）\n3. 剪齐，留约 1.2cm，插入水晶头到底（从前端能看到线芯）\n4. 压线钳压到底，听到「咔」一声\n5. 测线仪 1-8 依次顺亮 = 通'],
      ['测线仪判读', '1..8 依次亮 + 远端同步　　→ 八芯全通\n只亮 1 2 3 6　　　　　　→ 4/5/7/8 没压好（百兆能通、千兆协商不上）\n远端顺序错乱　　　　　　→ 线序做错（两端不是同一标准）\n某一芯不亮　　　　　　　→ 断路，重做该端']
    ],
    tip: '「能上网」不等于线做好了——百兆只用 4 芯。千兆口自协商跑成百兆、或者大流量掉速，十有八九是 4/5/7/8 没压通。现场先看端口协商速率，别急着换设备。'
  },
  {
    id: 'fld-console',
    devs: ['Switch', 'Router', '防火墙', 'AC'],
    name: 'Console 线登录设备（串口参数 / 连不上排查）',
    kw: ['console', '串口登录', '波特率', 'console线', '连不上设备', '乱码', '串口参数', 'usb转串口', '调试线', '进不去命令行'],
    cmds: [
      ['串口参数', '波特率 9600　数据位 8　停止位 1　校验 None　流控 None\n\n# 华为 / 思科 / H3C / 锐捷默认都是 9600 8N1\n# 少数设备（部分 CE 系列、防火墙）是 115200 8N1\n# 连上没输出：先换 115200 试一次'],
      ['常用终端工具', 'Windows：SecureCRT / Xshell / PuTTY / MobaXterm\nmacOS：  screen /dev/tty.usbserial-XXXX 9600\nLinux：  minicom -D /dev/ttyUSB0 -b 9600\n\n# macOS 退出 screen：Ctrl+A 然后按 K'],
      ['USB 转串口驱动', '# 设备管理器看 COM 口是否出现\n常见芯片：CH340 / CP2102 / FT232\n\n# 装了驱动仍无 COM：换 USB 口、换线、关掉占用该口的软件\n# Win10/11 一般是自动装，装不上就去芯片官网下']
    ],
    tip: '两个最常见坑：① 波特率不对 → 满屏乱码；② 流控被打开 → 能收到输出但敲回车没反应（把 RTS/CTS 设成 None）。另外华为原装 Console 线是交叉线序，拿普通网线代替会不通。'
  },
  {
    id: 'fld-iperf',
    devs: ['Switch', 'Router', '服务器', 'Linux'],
    name: 'iperf3 打流测带宽（链路到底能跑多少）',
    kw: ['iperf', '打流', '测带宽', '带宽测试', '吞吐量', '丢包测试', '测速', '压测'],
    cmds: [
      ['服务端（对端机器）', 'iperf3 -s\n# 换端口：iperf3 -s -p 5201\n# 记得放行防火墙对应端口'],
      ['TCP 测试', 'iperf3 -c 10.1.1.100 -t 30 -P 4\n\n# -t 测试时长（秒）\n# -P 并发流数（单流跑不满时加，4~8 常见）\n# -R 反向测（测下行，默认测的是上传）'],
      ['UDP 与双向', 'iperf3 -c 10.1.1.100 -u -b 500M -t 30    # UDP，看丢包与抖动\niperf3 -c 10.1.1.100 --bidir -t 30 -P 2   # 双向同时打'],
      ['结果怎么看', '千兆口实测 930~940Mbps 属正常（TCP/IP 开销）\n# sender 与 receiver 差得多 → 丢包或中间限速\n# 只有 300~500Mbps：查协商速率 / 查限速策略 / 查 CPU']
    ],
    tip: '必须两台机器对打，别在设备自己上面跑。测前先确认两端网卡协商速率（Linux ethtool eth0；交换机 display interface）。单流跑不满先别下结论，加 -P 4 再测一轮。'
  },
  {
    id: 'fld-wireshark',
    devs: ['Linux', '服务器', 'Windows'],
    name: 'Wireshark 过滤表达式（抓完怎么筛）',
    kw: ['wireshark', '抓包过滤', '过滤表达式', 'display filter', '抓包分析', '丢包分析', '重传'],
    cmds: [
      ['最常用', 'ip.addr == 192.168.1.10            # 只看这台主机\nip.src == 10.1.1.1 && tcp.port == 443\nhttp || dns || icmp                 # 多个协议\n!(arp || icmp)                      # 排除干扰'],
      ['TCP 排障', 'tcp.analysis.flags                  # 只留异常（重传/乱序/重复 ACK）\ntcp.analysis.retransmission         # 重传\ntcp.flags.syn == 1 && tcp.flags.ack == 0   # SYN 没人回（连不上）\ntcp.len == 0                        # 纯 ACK'],
      ['HTTP / DNS', 'http.request.method == "GET"\nhttp.response.code >= 400\ndns.qry.name contains "example"\ndns.time > 1                        # 只留超过 1 秒的 DNS'],
      ['抓包（服务器侧）', 'tcpdump -i eth0 -w cap.pcap host 10.1.1.10 and port 443\n# 抓完拷回本地用 Wireshark 打开\n# 生产机别装图形界面']
    ],
    tip: '抓包位置决定能看到什么：镜像口抓不到进设备前就丢的包；设备内部丢的包只能看接口计数器或设备侧抓包。文件太大用 capture filter（抓的时候就筛）而不是 display filter（事后筛）。'
  },
  {
    id: 'fld-snmpwalk',
    devs: ['Linux', '服务器', 'Switch'],
    name: 'snmpwalk 采集设备信息 / 接收 Trap',
    kw: ['snmpwalk', 'snmpget', 'oid', '采集', 'snmp v3', 'trap 接收', 'snmptrapd', '端口流量采集'],
    cmds: [
      ['v2c 采集', 'snmpwalk -v2c -c public 10.1.10.2 1.3.6.1.2.1.1\nsnmpget -v2c -c public 10.1.10.2 1.3.6.1.2.1.1.5.0   # 设备名'],
      ['v3 采集（推荐）', 'snmpwalk -v3 -l authPriv -u monitor -a SHA -A <AUTH-PWD> \\\n         -x AES -X <PRIV-PWD> -t 3 -r 2 10.1.10.2 1.3.6.1.2.1.1'],
      ['常用 OID', '1.3.6.1.2.1.1.5.0        设备名 sysName\n1.3.6.1.2.1.1.3.0        运行时长 sysUpTime\n1.3.6.1.2.1.2.2.1.8      端口状态（1=up 2=down）\n1.3.6.1.2.1.2.2.1.10     端口入流量（32 位）\n1.3.6.1.2.1.31.1.1.1.6   端口出流量（64 位，用这个）'],
      ['收 Trap', 'snmptrapd -f -Lo -c /etc/snmp/snmptrapd.conf udp:162\n# 设备侧要配：snmp-agent target-host trap address udp-domain <NMS-IP>']
    ],
    tip: '流量采集一定用 64 位计数器（ifHCInOctets / ifHCOutOctets）——32 位在千兆口几分钟就回绕，画出来的图是锯齿状。v2c 的 community 等于明文密码，生产网一律 v3。'
  },
  {
    id: 'fld-optical',
    devs: ['Switch', 'Router', '其他设备'],
    name: '光功率与光衰测试（光口不通 / CRC 增长）',
    kw: ['光功率', '光衰', '光模块', 'rx power', '光口不通', 'crc', '误码', '单模', '多模', '光衰大', '擦光纤'],
    cmds: [
      ['设备侧看光功率', '华为：display interface GigabitEthernet 0/0/1     # 找 Rx Power / Tx Power\n思科：show interfaces GigabitEthernet0/1 transceiver detail\nH3C： display transceiver diagnosis interface GigabitEthernet 1/0/1\n锐捷：show interfaces GigabitEthernet 0/1 transceiver'],
      ['正常范围（参考值）', '1000BASE-SX 多模：Rx  -3 ~ -17 dBm\n1000BASE-LX 单模：Rx  -3 ~ -20 dBm\n10GBASE-SR 多模：Rx  -1 ~ -11 dBm\n10GBASE-LR 单模：Rx  -1 ~ -14 dBm\n# 低于下限 = 光衰过大；高于上限 = 过载（要加衰减器）'],
      ['光衰过大四查', '1. 端面脏：无水酒精 + 无尘纸「单向」擦，别来回蹭\n2. 弯折：弯曲半径 < 3cm 会漏光\n3. 熔接点 / 法兰头老化\n4. 距离超规格（多模 550m、单模 10km 是上限）'],
      ['CRC / 误码排查', 'display interface GigabitEthernet 0/0/1 | include error|CRC|drop\nshow interfaces counters errors\n\n# CRC 持续增长 = 物理层问题（脏 / 弯 / 模块劣化）\n# 换跳线 → 换模块 → 换端口，三步定位']
    ],
    tip: '光口「灯不亮」别猜，直接看设备侧 Rx 光功率：Tx 有光 Rx 无光 → 对端没发或光纤断；两端光功率都正常但 CRC 一直涨 → 端面脏或模块要坏。'
  },
  {
    id: 'fld-topo',
    devs: ['Switch', 'Router'],
    name: 'LLDP / CDP 查邻居（自动画拓扑的数据源）',
    kw: ['lldp', 'cdp', '邻居', '拓扑', '查对端', '连线关系', '拓扑发现', 'neighbor'],
    cmds: [
      ['华为', 'display lldp neighbor brief\n\n# 没输出先开功能：\nlldp enable\ninterface GigabitEthernet 0/0/24\n lldp enable'],
      ['思科', 'show lldp neighbors\nshow cdp neighbors detail\n\n# 思科默认开 CDP；LLDP 需 lldp run'],
      ['H3C / 锐捷', 'H3C：display lldp neighbor-information list\n锐捷：show lldp neighbors'],
      ['批量导出（Python）', 'from netmiko import ConnectHandler\nfor sw in switches:\n    with ConnectHandler(**sw) as c:\n        out = c.send_command("display lldp neighbor brief")\n        print(sw["host"], out)']
    ],
    tip: '两端互连却看不到邻居：① 有一端没开 LLDP/CDP ② 中间串了透明设备（光电转换器、非管理小交换机）③ 端口 shutdown。割接前用 LLDP 抓一遍邻居表，比翻图纸靠谱。'
  },
  {
    id: 'fld-label',
    devs: ['Switch', '其他设备'],
    name: '机房布线与标签规范（这根线到底通到哪）',
    kw: ['标签', '布线', '理线', '配线架', '打线', '机房规范', '线缆标识', '走线', '验收'],
    cmds: [
      ['命名规则', '设备：<机房>-<机柜>-<U位>-<角色>     例：A01-03-12-CORE-SW\n端口：<本端设备>:<端口> ↔ <对端设备>:<端口>\n线缆：<类型>-<序号>-<用途>            例：CAT6-018-AP-3F'],
      ['理线要求', '1. 网线走左侧、光纤走右侧，强弱电分开走\n2. 弯折半径 ≥ 线径 4 倍；光纤 ≥ 3cm\n3. 预留 1.5~2m 盘在柜侧，别拉直受力\n4. 扎带松紧：能塞进一根手指为宜'],
      ['配线架', '端口 1 对 1 打，不许跳号\n打完用测线仪把 1-8 全测一遍\n标签贴在距接头 5cm 处，两端都贴'],
      ['验收清单', '标签覆盖率 100%（设备 / 端口 / 线缆三类）\n拍照留档：机柜正面 + 背面 + 配线架\n变更后 24 小时内补齐标签']
    ],
    tip: '机房最难查的不是配置是「这根线通到哪」。割接前补标签，比割接时一个个拔线试快十倍；标签只贴一端等于没贴。'
  }
];

module.exports = { FIELD_EXTRA };
