// utils/seed.js —— 内置常量：设备类型、网络分类、答案之书、首次启动的 24 条命令

const DEVICES = ['Windows', 'Switch', 'Router', 'AC', 'AP', '防火墙', 'Linux', '服务器', '其他设备'];

// 设备类型的中文显示名（数据里仍存英文 key，界面上给人看中文）
const DEVICE_CN = {
  'Windows': 'Windows',
  'Switch': '交换机',
  'Router': '路由器',
  'AC': 'AC',
  'AP': 'AP',
  '防火墙': '防火墙',
  'Linux': 'Linux',
  '服务器': '服务器',
  '其他设备': '其他'
};

const NET_CATEGORIES = [
  { key: 'switch', name: '交换', kw: ['vlan', 'stp', 'portswitch', 'lldp', 'mac', 'port-isolate', '端口隔离', 'link-aggregation', '聚合', 'trunk', '交换'] },
  { key: 'route', name: '路由', kw: ['route', 'ospf', 'bgp', 'nat', 'dhcp', 'ip address', 'ip route', '路由', 'vlan-interface', '下一跳', '回程'] },
  { key: 'wlan', name: '无线', kw: ['wlan', 'ap-group', 'ssid', '无线', '漫游', 'ac '] },
  { key: 'trouble', name: '排障', kw: ['display', 'ping', 'tracert', 'transceiver', 'flapping', '漂移', 'history-command', 'counters', '日志', '排障', 'debug'] },
  { key: 'security', name: '安全', kw: ['snmp', 'local-user', 'password', 'authentication', 'acl', 'user-interface', '防火墙', '安全'] },
  { key: 'automation', name: '自动化运维', kw: ['python', 'ansible', 'script', '脚本', 'api', 'netmiko', '自动化', 'paramiko', '巡检'] },
  { key: 'pm', name: '项目管理', kw: ['割接', '项目', '上线', '方案', '计划', '验收', '变更', '文档', '实施'] }
];

const ANSWER_BOOK = [
  '配置不会骗人，日志不会说谎。',
  '先看物理层，再谈协议。',
  'display 三板斧：接口、路由、MAC。',
  '割接前备份，是对自己最大的温柔。',
  'ping 不通的时候，先想想回程路由。',
  'MAC 漂移多半是环路。',
  'VLAN 不通，先查 access 和 trunk。',
  '慢一点，把日志看完。',
  '每一个 display 都值得认真读。',
  '排障是网络工程师的主线任务。',
  '光模块不亮，什么都白搭。',
  'STP 端口跳来跳去，先找环路。',
  '配置保存了吗？reboot 见分晓。',
  'write 之前，先 display current。',
  'debug 一时爽，日志火葬场。',
  'ACL 记得放行回程流量。',
  'SNMP 不通，多半是团体名或 ACL。',
  '无线丢包？先看漫游阈值和干扰。',
  'BGP 起不来，先看 TCP 179。',
  'OSPF 起不来，先看区域和掩码。',
  'tag 打对了，排障快一倍。',
  '没有备份的变更，等于裸奔。',
  '把每次排障写进手记，它就是经验值。',
  '网关 ping 不通？先看 ARP。',
  'trunk 漏放 VLAN，是最常见的鬼故事。',
  '接口 error 包涨，先换线。',
  '账号权限最小化，是美德。',
  '能脚本化的重复劳动，都不配手动。',
  '今晚的割接窗口，也是经验值。',
  '拓扑画清楚，故障少一半。',
  '网卡灯不亮，先查网线和模块。',
  '双工不匹配，性能会腰斩。',
  '端口 up 但协议 down，多半是配置或链路。',
  'DHCP 拿不到地址，先看地址池和 relay。',
  'NAT 不通，先确认内外接口方向。',
  '路由表里有，不一定转发得出去。',
  'MTU 不一致，分片能让你怀疑人生。',
  'console 口连不上，先确认波特率 9600。',
  '配置丢了？先 display saved 再比对。',
  '堆叠分裂，先看成员和优先级。',
  'VRRP 主备切换异常，先看优先级和 track。',
  '链路聚合不生效，先确认两端模式一致。',
  'MSTP 域没配对，环路照样来。',
  'ACL 顺序很重要，先匹配先生效。',
  '日志时间戳不对，排障能跑到外太空。',
  '设备时间不同步，日志没法对。',
  '出口带宽跑满，先抓包看是谁。',
  'DNS 解析慢，先看递归和转发。',
  '证书过期，HTTPS 直接躺。',
  '端口安全触发，先查是不是误绑。',
  '电源双路，也要确认都通电。',
  '风扇狂转，先看温度和灰尘。',
  '配置文件版本不对，别急着刷。',
  '回退方案，比上线方案更重要。',
  '变更窗口，留给意外，别排太满。',
  '异地备份，才是真备份。',
  '文档不全，等于没做过。',
  '问之前，先自己 display 一遍。',
  '网线插反了也能通，就是别指望千兆。',
  '交换机不会无缘无故重启，除非你手抖。',
  '看不清的故障，先凑近看灯。',
  '一个 VLAN 配错，全公司陪你加班。',
  '别急着改配置，先问有没有人刚动过。',
  '排障第一问：什么时候开始不行的？',
  '排障第二问：之前改过什么？',
  '排障第三问：还有谁在碰这台设备？',
  '能复现的故障，才有解。',
  '抓包十分钟，胜过猜一小时。',
  '拓扑图是排障的藏宝图。',
  '光衰正常，问题多半在配置。',
  '有备份的设备，才敢做实验。',
  '别在周五下午做割接。',
  '变更文档是写给自己看的，不是写给领导看的。',
  'ping 通不代表业务通，业务通才算通。',
  '路由对称，排障省心。',
  '环路不可怕，可怕的是没开 STP。',
  '端口隔离是个好东西，能治不少网速玄学。',
  '无线问题一半是覆盖，一半是信道。',
  '漫游粘滞，用户就会说处处是死角。',
  '设备时间不对，日志就是废纸。',
  '密码写在便签上，迟早要出事。',
  '账号共用，出事没人认。',
  '一句 display，胜过十句我觉得。',
  '报障的同事永远说“我没动过”。',
  '越是紧急，越要先备份。',
  '割接前把回退命令敲好，手别抖。',
  '会写脚本的网工，晚上能睡觉。',
  '巡检不是填表，是提前拆炸弹。',
  '你记的每一条命令，都是在帮下次的自己。',
  '记住排障过程，比记住结论更有用。',
  '别把希望寄托在“重启试试”。',
  '先确认再动手，比动完再确认便宜得多。',
  '网络不会说谎，它只是没人听得懂。',
  '一小时准备，省三小时救火。',
  '机房里最长的路，是从工位到机柜。',
  '备件箱里那根线，永远是最急需的那根。',
  '标签贴好，三年后的你会感谢现在的你。'
];

// 年级 / 阶段（从在校到资深，用更有意思的称呼）
const STAGES = [
  '大一', '大二', '大三', '大四', '实习',
  '新手小白', '中级选手', '网工老鸟', '技术大牛'
];

// 旧档案里的阶段值 → 新称呼
const STAGE_LEGACY = {
  '入职1年': '新手小白',
  '入职3年': '中级选手',
  '入职5年': '网工老鸟',
  '入职8年': '技术大牛',
  '网络架构师': '技术大牛'
};

const PRESET_CHARS = ['character_01', 'character_02', 'character_03', 'character_04', 'character_05', 'character_08', 'character_09', 'character_10', 'character_12', 'character_14'];
const PRESET_BGS = ['background_01', 'background_02', 'background_03', 'background_04', 'background_05'];

/* 百科条目总数。
   首页要显示「命令百科 1378 条」，但百科数据在分包（subpkg-tool/utils/cmdbook.js），
   主包引用不到分包的东西——所以这里放一个常量，
   由 miniprogram-tools/sync_book_count.js 从真实数据自动同步，
   避免手写数字跟实际条数对不上。 */
const BOOK_COUNT = 1378;

module.exports = { DEVICES, DEVICE_CN, NET_CATEGORIES, ANSWER_BOOK, STAGES, STAGE_LEGACY, PRESET_CHARS, PRESET_BGS, BOOK_COUNT };
