/**
 * 基础命令逐条核对：一条一行，打印 Top1（带 id），人工确认「最基本的那条」在不在。
 * 不用 want 词匹配——会误判（「配置console口密码」会被 BootROM 急救条目的名称骗过）。
 *
 * 清单按「开局到运维」的实际顺序排，不是按分类凑数：
 * 一台设备从加电到能交出去，下面这些说法必须都能一句搜到。
 *
 *   node basics_check.js          # 全部
 *   node basics_check.js 登录      # 只看标题含「登录」的那一段
 */
const { search } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const SECTIONS = [
  ['一、登录与控制台（开局第一件事）', [
    'console口密码', '配置console口密码', '改console密码', 'console密码忘了',
    'console线连不上', '配置telnet密码', '配置enable密码', '配置ssh', '关闭telnet',
    '禁止telnet登录', '创建本地用户', '配置aaa', '改设备密码', '会话超时自动退出',
    '限制登录ip', '忘记密码怎么办'
  ]],
  ['二、基础设置（上架就要配的）', [
    '改设备名字', '配置管理ip', '配置管理vlan', '配网关', '保存配置', '查看当前配置',
    '恢复出厂', '重启设备', '查看版本', '查看序列号', '配置ntp', '手工对时',
    '配置snmp', '配置日志服务器', '查看日志', '查看cpu', '查看内存', '查看温度'
  ]],
  ['三、端口与二层', [
    '关闭端口', '开启端口', '配速率双工', '配端口描述', '端口划vlan', '批量划vlan',
    '配trunk', '配access', '配hybrid', '配链路聚合', '配端口隔离', '配置生成树',
    '查看mac地址表', '查看某端口学到的mac', '配置端口安全', '配端口镜像', '查看光衰',
    '查看接口状态', '接口不亮', '接口一直up down'
  ]],
  ['四、三层与路由', [
    '配vlanif', '配静态路由', '配默认路由', '查看路由表', '跑ospf', '跑bgp',
    '配置路由重分发', '配置策略路由', '配置vrrp', '查看arp表', 'ping', 'tracert',
    '配置dhcp', '配置dhcp中继', '配置nat', '配置acl', '配置限速', '配置qos'
  ]],
  ['五、无线', [
    '配置ssid', '改wifi密码', 'ap怎么上线', '查看ap状态', 'ap不上线', '配置漫游',
    '配置ac组网', '无线信号弱', 'wifi老是掉线', '配访客网络', '隐藏ssid'
  ]],
  ['六、防火墙与安全', [
    '配置防火墙策略', '划分安全区域', '配置nat server', '端口映射', '防arp攻击',
    '配置端口安全', '配置ips', '配置url过滤', '防火墙双机热备', '查看会话表'
  ]],
  ['七、运维与排障', [
    '备份配置', '升级设备版本', '对比两份配置', '配置丢失', '设备cpu高',
    '网络卡顿', '网络环路', '广播风暴', 'ip地址冲突', '端口不亮', '上网慢',
    '某个网站打不开', 'dns解析不了', '光猫注册不上'
  ]]
];

const filter = process.argv[2] || '';
let n = 0;
let empty = 0;

SECTIONS.forEach(function (sec) {
  if (filter && sec[0].indexOf(filter) < 0) return;
  console.log('\n' + sec[0]);
  sec[1].forEach(function (q) {
    const r = search(q) || [];
    n++;
    const top = r[0];
    if (!top) { empty++; console.log('  ✗ ' + q + '  → 无结果'); return; }
    console.log('   ' + q + '  →  ' + top.name + '  [' + top.id + ']');
  });
});

console.log('\n共 ' + n + ' 条说法，无结果 ' + empty + ' 条');
