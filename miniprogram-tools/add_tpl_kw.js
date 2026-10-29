/* 给 64 个模板补 kw（搜索关键词）。
 *
 * 背景：模板原本只有 name / cat / vendor / note / code 五个字段，
 * 搜索时只能拿 name+cat+vendor+note 去凑。note 是排障说明，
 * 术语密度高但用词跟用户口语不一致——于是：
 *   搜「默认路由配置」搜不到「静态路由模板（默认 / 浮动 / 黑洞）」
 *   搜「nat」会把「IPsec VPN 站点互联模板」顶上来（它 note 里写了「中间NAT」）
 *
 * 模板的 name 是给工程师看的，kw 是给用户搜的，两件事分开做。
 *
 * 同时改 data-src（源码版）和 miniprogram/utils（压缩版）。
 *
 * 用法：node miniprogram-tools/add_tpl_kw.js [--dry]
 */

const fs = require('fs');
const path = require('path');

/* id → 补充的搜索关键词（用户真会打出来的说法） */
const KW = {
  'tpl-switch-base': ['交换机开局', '新设备开局', '开局配置', '设备上架配置'],
  'tpl-vlan-if': ['vlanif', 'vlan网关', '三层交换vlan', '网关配置'],
  'tpl-trunk-uplink': ['trunk', '上联口配置', '透传vlan'],
  'tpl-eth-trunk': ['聚合', '端口聚合', 'eth-trunk', '双上联'],
  'tpl-port-sec': ['端口安全', 'mac绑定', '防私接', 'mac认证'],
  'tpl-stp-edge': ['stp', '生成树', '边缘端口', '根桥'],
  'tpl-static-route': ['默认路由', '缺省路由', '静态路由', '浮动路由', '黑洞路由', '路由配置'],
  'tpl-ospf-basic': ['ospf', 'ospf单区域', 'ospf配置'],
  'tpl-vrrp': ['vrrp', '网关双机', '网关热备', '主备网关'],
  'tpl-dhcp-pool': ['dhcp地址池', '地址池配置', 'dhcp服务'],
  'tpl-dhcp-relay': ['dhcp中继', '中继配置', '跨网段获取地址'],
  'tpl-acl-basic': ['acl', 'acl配置', '访问控制列表'],
  'tpl-fw-policy': ['防火墙策略', '安全策略', '域间策略', '放行策略'],
  'tpl-ipsec': ['ipsec', 'vpn配置', '站点互联', 'ipsec vpn'],
  'tpl-snooping': ['dhcp snooping', 'ipsg', '防私接', 'arp防护'],
  'tpl-nat': ['nat', 'nat上网', '上网配置', 'easy ip', '内网上网'],
  'tpl-mgmt-acl': ['管理面加固', '只准网管机登录', '登录限制'],
  'tpl-log-snmp': ['日志配置', 'snmp配置', '纳管', 'syslog'],
  'tpl-backup': ['定时备份', '配置备份', '自动备份'],
  'tpl-proj-office': ['办公网', 'vlan规划', '按部门划分'],
  'tpl-proj-school': ['宿舍网', '校园网', '学生网接入'],
  'tpl-proj-video': ['监控网', '视频专网', '组播'],
  'tpl-proj-guest': ['访客wifi', '访客网络', 'guest', 'portal认证'],
  'tpl-cisco-base': ['思科开局', 'cisco开局', 'ios开局'],
  'tpl-h3c-base': ['h3c开局', 'comware开局', '华三开局'],
  'tpl-ruijie-base': ['锐捷开局', 'rgos开局'],
  'tpl-zte-base': ['中兴开局', 'zxr10开局'],
  'tpl-junos-base': ['juniper开局', 'junos开局', 'juniper配置'],
  'tpl-eos-base': ['arista开局', 'eos开局'],
  'tpl-v6-dual': ['ipv6', 'ipv6双栈', '双栈配置', 'v6开局'],
  'tpl-wlan-ac': ['ac开局', '无线开局', 'ap上线', '放ssid'],
  'tpl-ospf-multi': ['ospf多区域', 'abr汇总', '接口认证'],
  'tpl-cutover-back': ['割接', '割接回退', '回退方案', '变更方案'],
  'tpl-qos-limit': ['端口限速', '限速配置', '带宽限制', 'car'],
  'tpl-mirror': ['端口镜像', '抓包配置', '镜像口', 'rspan'],
  'tpl-stack': ['堆叠', '堆叠配置', 'istack'],
  'tpl-dual-wan': ['双出口', '双线路', '主备出口', '分流出口'],
  'tpl-dot1x': ['802.1x', '有线认证', 'dot1x', '认证前放行'],
  'tpl-snmpv3': ['snmpv3', 'snmp加密', 'snmp认证', 'trap配置'],
  'tpl-roce': ['roce', '无损网络', 'pfc', 'ecn'],
  'tpl-cloud-connect': ['云专线', 'bgp对接', '云上专线'],
  'tpl-bastion': ['堡垒机', 'tacacs+', '命令审计'],
  'tpl-monitor-full': ['监控接入', '监控配置', 'snmp监控', '告警接入'],
  'tpl-backup-git': ['自动备份', 'git备份', '备份流水线'],
  'tpl-inspect': ['巡检', '巡检报表', '定期检查'],
  'tpl-bond': ['双网卡绑定', 'bond配置', '网卡冗余'],
  'tpl-lb-health': ['健康检查', '负载均衡', 'lb配置'],
  'tpl-dhcp-option43': ['option 43', 'ap跨三层', 'ap上线'],
  'tpl-hardening': ['加固', '安全基线', '等保配置', '设备加固'],
  'tpl-microburst': ['微突发', 'microburst', '缓存基线'],
  'tpl-carrier-ticket': ['运营商报障', '电路定界', '运营商排障'],
  'tpl-sdwan-sla': ['sd-wan', 'sdwan', 'sla选路'],
  'tpl-voice-qos': ['语音qos', '视频qos', '端到端qos'],
  'tpl-dc-underlay': ['spine-leaf', 'underlay', '数据中心组网'],
  'tpl-tshoot-card': ['故障定界', '排障速查', '分层排除'],
  'tpl-iot-vlan': ['物联网', '摄像头接入', '门禁接入', 'iot隔离'],
  'tpl-5g-backup': ['4g备份', '5g备份', '备份线路切换'],
  'tpl-rack-baseline': ['机柜上架', '端口基线', '机柜配置'],
  'tpl-capacity-collect': ['容量采集', '带宽基线', '流量采集'],
  'tpl-nat-server-mix': ['nat server', '源nat', '回流处理', 'nat混合'],
  'tpl-ipv6-dualstack': ['ipv6接入', 'ipv6地址', 'ra配置', 'dhcpv6'],
  'tpl-ac-side': ['ac旁挂', '旁挂组网', 'ac配置'],
  'tpl-qos-priority': ['业务优先', '出口限速', '优先级配置'],
  'tpl-mlag-tor': ['m-lag', 'mlag', '双活tor', '服务器双归']
};

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'miniprogram-tools', 'data-src', 'tplbook.js'),
  path.join(ROOT, 'miniprogram', 'utils', 'tplbook.js')
];

const dry = process.argv.indexOf('--dry') >= 0;

function q(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

let changedFiles = 0;
let changedItems = 0;

TARGETS.forEach(function (file) {
  if (!fs.existsSync(file)) {
    console.log('  跳过（不存在）: ' + path.relative(ROOT, file));
    return;
  }
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  Object.keys(KW).forEach(function (id) {
    const kws = KW[id];
    /* 只在 id 后紧跟 cat/name 等字段的位置插入 kw。
       压缩版是 id:'x',cat:'y',... ；源码版是 id: 'x',\n    cat: 'y',... */
    const re = new RegExp("(id:\\s*" + q(id) + "\\s*,)(\\s*)(cat:)");
    const m = src.match(re);
    if (!m) {
      console.log('  ! 未定位到 ' + id + '（' + path.relative(ROOT, file) + '）');
      return;
    }
    /* 已存在 kw 字段就跳过 */
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 120);
    if (/^\s*kw\s*:/.test(after)) return;

    const tight = m[2] === ''; /* 压缩版没空格 */
    const body = kws.map(q).join(tight ? ',' : ', ');
    const insert = 'kw:[' + body + '],' + (tight ? '' : ' ');
    src = src.slice(0, m.index + m[1].length) + insert + src.slice(m.index + m[1].length);
    changedItems++;
  });

  if (src !== before) {
    changedFiles++;
    if (dry) {
      console.log('  [dry] 将写入: ' + path.relative(ROOT, file));
    } else {
      fs.writeFileSync(file, src, 'utf8');
      console.log('  已写入: ' + path.relative(ROOT, file));
    }
  } else {
    console.log('  无变化: ' + path.relative(ROOT, file));
  }
});

console.log('');
console.log('改动条目 ' + changedItems + ' 处，文件 ' + changedFiles + ' 个' + (dry ? '（dry-run，未落盘）' : ''));
