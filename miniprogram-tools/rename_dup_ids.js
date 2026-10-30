// 清理 data-src 里的重复 id：保留每组较早批次的 id 为原值，把较晚批次的重复项改名。
// 所有重复组都是「内容不同」的真重复，不能删，只能改名。
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'data-src');

// file -> { oldId: newId }
const MAP = {
  'cmdbook-batch33.js': { 'dns-arch': 'dns-arch-design' },
  'cmdbook-batch92.js': {
    'sec-waf': 'waf-web-protection',
    'sec-log-audit': 'sec-log-analysis',
    'sec-ips': 'ids-ips-deploy'
  },
  'cmdbook-batch56.js': {
    'cloud-lb': 'cloud-lb-health',
    'cloud-dns': 'cloud-dns-split'
  },
  'cmdbook-batch94.js': {
    'cloud-lb': 'cloud-lb-alb',
    'cloud-cost': 'cloud-cost-bill',
    'cloud-vpc': 'cloud-vpc-subnet'
  },
  'cmdbook-batch49.js': {
    'case-ip-conflict': 'case-ip-conflict-2',
    'case-duplex': 'case-speed-drop',
    'case-nat-hairpin': 'case-nat-hairpin-2'
  },
  'cmdbook-batch83.js': {
    'ind-finance': 'ind-finance-net',
    'ind-energy': 'ind-energy-power',
    'ind-gov': 'ind-gov-net'
  },
  'cmdbook-batch50.js': { 'dc-cabling': 'dc-cable-select' },
  'cmdbook-batch71.js': { 'dc-cabling': 'dc-cabling-label' },
  'cmdbook-batch87.js': {
    'auto-template': 'auto-template-multi',
    'auto-compliance': 'auto-compliance-check',
    'auto-textfsm': 'auto-textfsm-regex'
  },
  'cmdbook-newtech.js': {
    'dc-roce': 'dc-roce-lossless',
    'cloud-direct-connect': 'cloud-direct-connect-hybrid',
    'auto-nornir': 'auto-nornir-eng'
  },
  'cmdbook-net.js': {
    'qinq': 'qinq-label',
    'dhcp-snooping': 'dhcp-snooping-rogue',
    'port-security': 'port-security-mac'
  },
  'cmdbook-sec.js': { 'wlan-locate': 'wlan-locate-terminal' }
};

// 收集现有全部 id（用于冲突校验）
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const existing = new Set();
fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /id:\s*['"]([^'"]+)['"]/g; let m;
  while ((m = re.exec(src))) existing.add(m[1]);
});

// 校验新 id 不冲突、且彼此不同
const newIds = new Set();
let conflict = false;
Object.keys(MAP).forEach(f => {
  Object.values(MAP[f]).forEach(nid => {
    if (existing.has(nid)) { console.log('冲突：新 id 已存在 ->', nid); conflict = true; }
    if (newIds.has(nid)) { console.log('冲突：新 id 彼此重复 ->', nid); conflict = true; }
    newIds.add(nid);
  });
});
if (conflict) { console.log('存在冲突，终止。'); process.exit(1); }

// 执行替换
let total = 0;
Object.keys(MAP).forEach(f => {
  const fp = path.join(dir, f);
  let src = fs.readFileSync(fp, 'utf8');
  Object.keys(MAP[f]).forEach(oldId => {
    const nid = MAP[f][oldId];
    const re = new RegExp("\\bid:\\s*['\"]" + esc(oldId) + "['\"]", 'g');
    const before = (src.match(re) || []).length;
    if (before !== 1) { console.log('警告：' + f + ' 中 id=' + oldId + ' 命中 ' + before + ' 次（应为 1）'); }
    src = src.replace(re, "id: '" + nid + "'");
    total += before === 1 ? 1 : 0;
  });
  fs.writeFileSync(fp, src);
  console.log('已处理 ' + f);
});
console.log('共替换 ' + total + ' 处 id。下一步：build_data.py build + check + ci。');
