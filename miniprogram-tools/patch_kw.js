/**
 * 按 id 给记录的 kw 数组追加关键词。
 *
 * 只改 data-src 的可读源码一处，产物由 build_data.py 生成。
 * 以前这里是「主包 + 分包 + 源码」三个位置一次改到位，
 * 漏掉任何一个都会造成源与产物漂移（本项目已实测漂移 4 个文件）。
 *
 * 只追加、不删除、不改顺序，已存在的词自动跳过。
 *
 * 用法：
 *   node patch_kw.js            # 执行下面 PATCH 表，改完自动重建产物
 *   node patch_kw.js --dry      # 只看会改什么，不落盘
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_SRC = path.join(__dirname, 'data-src');
const DIRS = [DATA_SRC];

/* id → 要补的说法（用户真实会打出来的现象/动作描述） */
const PATCH = {
  'pr-port-isolate': ['配置端口隔离', '端口隔离配置', '隔离端口'],
  'ntp': ['配置ntp', 'ntp配置', '配ntp'],
  'pr-clock-ntp': ['配置时间', '对时怎么配'],
  'port-rate-limit': ['配置qos限速', '限速怎么配'],
  'dhcp-snooping': ['配置dhcp snooping', 'dhcp snooping配置'],
  'vm-ap-onboard': ['配置ap上线', 'ap怎么上线'],
  'fw-policy': ['配置防火墙策略', '策略怎么配'],
  'pwd-policy': ['改设备密码', '设备密码怎么改', '改密码'],
  'qos-trust': ['配置qos', 'qos怎么配'],
  'vm-port-negotiation': ['配置流控', '流控配置'],

  /* 第二轮：探针跑出来的「有内容但 Top1 跑偏」，全是最高频的日常说法 */
  'port-shutdown': ['关闭不用的端口', '关掉不用的端口', '禁用不用的端口', '闲置端口关掉'],
  'tb-port-down': ['端口不亮', '插上不亮'],
  'arp-table': ['查arp', '查看arp', '看arp表', 'arp表怎么查'],
  'mac-show': ['查mac地址表', '查看mac地址表', '看mac地址表', 'mac地址表怎么查'],
  'arp-inspection': ['防arp攻击', 'arp攻击怎么防', 'arp欺骗怎么防'],
  'pr-mgmt-ip': ['配管理ip', '管理ip怎么配', '配带外管理'],
  'ssh': ['配telnet', 'telnet怎么开', '开telnet', '配ssh登录'],
  'vlan-port-access': ['划分vlan', '怎么划分vlan', 'vlan怎么划分'],
  'port-link-type': ['access口', '配access', 'access口怎么配'],
  'l3-bgp-neighbor-state': ['bgp邻居起不来', 'bgp邻居down', 'bgp邻居卡住'],
  'bfd': ['配bfd', 'bfd怎么配'],
  'wlan-roam': ['配漫游', '漫游怎么配'],
  'wlan-ssid': ['改wifi密码', 'wifi密码怎么改', '无线密码怎么改', '改无线密码'],
  'buy-switch': ['交换机怎么选', '交换机选型', '交换机怎么买'],
  /* 第三轮：排序评测暴露的内容缺口（有概念但说法没收录） */
  'port-shutdown': ['屏蔽端口', '屏蔽某个端口', '封掉端口', '停掉端口'],
  'other-camera': ['摄像头不显示', '摄像头黑屏', '监控看不到画面', '监控黑屏'],
  'port-link-type': ['access口', 'access口配置', 'access口怎么配'],
  /* 第四轮：缺口扫描里被误判成「缺口」的说法，其实条目早就有，只是叫法不同。
     正确做法是把用户会打的说法补成别名，而不是再写一条重复条目。 */
  'wlan-wifi7': ['wifi6', 'wifi 6', 'wifi7', 'wifi 7', '802.11ax', '802.11be'],
  'grounding': ['机柜接地', '接地电阻', '等电位跨接', '防雷接地'],
  'room-access': ['门禁网络', '一卡通', '门禁不通', '闸机', '读卡器'],
  'wlan-plan-tool': ['无线勘测', '现场勘测', 'site survey', 'ap点位', '信号强度'],
  'l3-route-tag': ['路由重分发', '双向重分发', '重分发防环'],
  'l3-ospf-filter': ['路由过滤', 'filter-policy', 'distribute-list'],
  'sr-ipv6-transition': ['ipv6过渡', 'ipv6 过渡', '双栈', 'nat64'],
  'sec-bastion': ['堡垒机部署', '堡垒机怎么接', '运维审计'],
  /* 第五轮：基础项名称太短，凑不出动作词，被「BGP 下发默认路由」这类限定条目压住 */
  'route-default': ['配默认路由', '默认路由配置', '默认路由怎么配'],
  'pr-mgmt-ip': ['管理vlan', '管理vlan怎么配', '管理vlan配置'],
  'console-password': ['console密码忘了怎么改', 'console不需要密码', 'console免密', '免密登录console'],

  /* 第六轮：basics_check 扩到 107 条后暴出来的「搜到了但答错了」。
     共同点——这些说法要么被别条目的别名抢走，要么干脆没挂到主条目上。 */
  'svi': ['配网关', '网关怎么配', '配vlanif', 'vlanif怎么配', 'vlanif配置'],
  'port-isolate': ['配端口隔离', '端口隔离怎么配'],
  'mirror': ['配端口镜像', '端口镜像怎么配'],
  'tb-port-down': ['接口不亮', '接口一直up down', '口不亮'],
  'port-rate-limit': ['配置限速', '带宽限制'],
  'tb-wlan-drop': ['wifi老是掉线', 'wifi老掉线', '无线老是掉线', 'wifi总断'],
  'ven-upgrade': ['升级设备版本', '设备怎么升级', '交换机怎么升级版本'],
  'ssh': ['关闭telnet', '关掉telnet', '禁用telnet'],
  'pr-diag-slow': ['上网慢', '网速慢', '上网很慢'],
  'mac-show': ['查看某端口学到的mac', '某个端口学了哪些mac'],
  'port-desc': ['配端口描述', '端口描述怎么配', '接口描述怎么加']
};

const DRY = process.argv.includes('--dry');

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* 定位 id 对应记录的 kw 数组；兼容压缩版与可读版两种写法 */
function findKw(src, id) {
  const m = new RegExp("id:\\s*'" + esc(id) + "'").exec(src);
  if (!m) return null;
  const idIdx = m.index;
  const nextId = new RegExp("id:\\s*'", 'g');
  nextId.lastIndex = idIdx + m[0].length;
  const nx = nextId.exec(src);

  const kwIdx = src.indexOf('kw', idIdx);
  if (kwIdx < 0) return null;
  if (nx && nx.index < kwIdx) return null;
  const open = src.indexOf('[', kwIdx);
  const close = src.indexOf(']', open);
  if (open < 0 || close < 0) return null;

  let list;
  try { list = Function('return [' + src.slice(open + 1, close) + ']')(); } catch (e) { return null; }
  if (!Array.isArray(list)) return null;

  /* 判断该文件是压缩风格还是可读风格：'kw:[' 紧排 vs 'kw: [' 有空格 */
  const tight = /kw:\[/.test(src.slice(kwIdx, kwIdx + 6));
  return { start: kwIdx, end: close + 1, list: list, tight: tight };
}

function render(list, tight) {
  if (tight) return 'kw:[' + list.map(function (w) { return "'" + w + "'"; }).join(',') + ']';
  return 'kw: [' + list.map(function (w) { return "'" + w + "'"; }).join(', ') + ']';
}

/* 建 id → 所在文件 的索引（同一 id 可能同名文件在不同目录） */
const index = {};
DIRS.forEach(function (d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(function (f) {
    if (!/^cmdbook.*\.js$/.test(f)) return;
    const p = path.join(d, f);
    const src = fs.readFileSync(p, 'utf8');
    (src.match(/id:\s*'[^']+'/g) || []).forEach(function (raw) {
      const id = raw.replace(/^id:\s*'|'$/g, '');
      if (!index[id]) index[id] = [];
      if (index[id].indexOf(f) < 0) index[id].push(f);
    });
  });
});

let changed = 0;
const missing = [];

Object.keys(PATCH).forEach(function (id) {
  const files = index[id];
  if (!files) { missing.push(id); return; }

  files.forEach(function (f) {
    DIRS.forEach(function (d) {
      const p = path.join(d, f);
      if (!fs.existsSync(p)) return;
      const src = fs.readFileSync(p, 'utf8');
      const hit = findKw(src, id);
      if (!hit) return;

      const merged = hit.list.slice();
      PATCH[id].forEach(function (w) {
        if (merged.indexOf(w) < 0) merged.push(w);
      });
      if (merged.length === hit.list.length) return;

      const tag = d === DATA_SRC ? 'src' : 'pkg';
      console.log('  [' + tag + '] ' + f + '  ' + id + '  +' + (merged.length - hit.list.length) + ' 词');
      if (!DRY) fs.writeFileSync(p, src.slice(0, hit.start) + render(merged, hit.tight) + src.slice(hit.end), 'utf8');
      changed++;
    });
  });
});

console.log('');
console.log((DRY ? '[dry-run] 将改 ' : '共改 ') + changed + ' 处');
if (missing.length) console.log('id 不存在，已跳过: ' + missing.join(', '));

/* 源改完后重建产物，保证源与产物始终一致 */
if (!DRY && changed > 0) {
  console.log('');
  console.log('重建产物...');
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync('python', [path.join(ROOT, 'miniprogram-tools', 'build_data.py'), 'build'],
      { encoding: 'utf8' });
    console.log(out.trim());
  } catch (e) {
    console.log('  ! 重建失败：' + (e.stdout || e.message));
    process.exitCode = 1;
  }
}
