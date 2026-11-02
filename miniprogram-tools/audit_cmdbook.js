// 命令百科 / 配置模板库 内容审计
//
// 目标：找出「标题与内容对不上」「内容为空」「重复」「搜不到」这类问题条目，
//       为人工清理提供清单。不改数据，只报告。
//
// 用法：node miniprogram-tools/audit_cmdbook.js [--json] [--only=<file>]

const fs = require('fs');
const path = require('path');

const MINI = path.join(__dirname, '..', 'miniprogram');
const TOOL_UTILS = path.join(MINI, 'subpkg-tool', 'utils');
const MAIN_UTILS = path.join(MINI, 'utils');

/* ---------------- 工具 ---------------- */

/* 从标题里抽「有信息量的词」：
   - ASCII 词（长度≥3）如 VLAN / OSPF / SR-MPLS —— 强信号。
   - 中文 2-gram 如 「查看」「配置」 —— 弱信号，通用词容易误伤，只用于兜底。 */
function tokensOf(name) {
  const s = String(name || '');
  const ascii = (s.match(/[A-Za-z][A-Za-z0-9\-_]{2,}/g) || [])
    .map(t => t.toLowerCase())
    /* 纯标签词不算内容词：标题写「FAQ：xxx」不代表正文必须有 faq */
    .filter(t => !LABEL_WORDS.has(t))
    /* 品类标签同理：标题写「家用 / SOHO 路由器」不代表正文必须出现 soho */
    .filter(t => !CATEGORY_WORDS.has(t));
  const cn = s.replace(/[^一-龥]/g, '');
  const cn2 = [];
  for (let i = 0; i + 2 <= cn.length; i++) cn2.push(cn.slice(i, i + 2));
  return { ascii, cn2 };
}

/* 标题里只是「栏目名」而非内容词的词，匹配时忽略 */
const LABEL_WORDS = new Set(['faq', 'tip', 'note', 'how', 'why', 'todo']);

/* 「品类标签」词：描述这个条目属于哪一类东西，正文不必逐字出现。
   「家用 / SOHO 无线路由器设置」的正文是家用路由器指引，天然不会写 SOHO。 */
const CATEGORY_WORDS = new Set([
  'soho', '家用', '企业', '家用级', '消费级', '企业级', '小型', '大型', '个人', '家庭',
  'sso', 'ipv6', 'ipv4', 'vpn', 'lan', 'wan', 'ssid', 'vlan', 'bgp', 'ospf', 'acl',
  'nat', 'dhcp', 'sip', 'ssh', 'snmp', 'ntp', 'syslog', 'stp', 'lacp', 'lag'
]);

/* 正文里的分隔符（- _ / 空格）去掉再比对：
   「SR-MPLS」在正文里写成「SR MPLS」或「srmpls」都应算命中。 */
function flatten(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9一-龥]/g, '');
}

/* 一个 ASCII 词是否在正文出现：
   整词（去分隔符后）命中，或它的分段里任一 ≥3 字符的段命中 */
function asciiHit(token, flatHay) {
  if (flatHay.indexOf(flatten(token)) >= 0) return true;
  const parts = token.split(/[-_/]+/).filter(p => p.length >= 3);
  for (const p of parts) {
    if (flatHay.indexOf(flatten(p)) >= 0) return true;
  }
  return false;
}

/* 标题里的「弱词」：这些词属于通用描述，标题出现不代表正文必须有。
   「查看 IP 配置」——正文写 ipconfig 就够了，不需要出现「查看」；
   「家用 / SOHO 无线路由器设置」——正文是家用路由器指引，不必出现 SOHO。 */
const WEAK_CN = new Set([
  '查看', '配置', '设置', '命令', '方法', '步骤', '说明', '介绍', '入门', '基础',
  '常用', '通用', '整体', '相关', '对应', '以及', '怎么', '如何', '什么', '这个',
  '使用', '操作', '调整', '修改', '新增', '删除', '查询', '检查', '排查', '处理',
  '路由', '上网', '登录', '设置项', '原则', '建议', '必改', '必做', '注意'
]);

/* 标题里是否含「强中文词」：去掉通用描述词后还剩下的部分 */
function strongCnTokens(name) {
  const cn = String(name || '').replace(/[^一-龥]/g, '');
  const out = [];
  for (let i = 0; i + 2 <= cn.length; i++) {
    const g = cn.slice(i, i + 2);
    if (!WEAK_CN.has(g)) out.push(g);
  }
  return out;
}

/* 正文侧的检索文本：别名 + 易错点 + 各厂商命令 + 适用设备（不含 name 本身） */
function haystackOf(it) {
  const parts = [];
  if (Array.isArray(it.kw)) parts.push(it.kw.join(' '));
  parts.push(String(it.tip || ''));
  parts.push(String(it.note || ''));
  parts.push(String(it.cat || ''));
  parts.push(String(it.vendor || ''));
  if (Array.isArray(it.devs)) parts.push(it.devs.join(' '));
  if (Array.isArray(it.cmds)) {
    it.cmds.forEach(c => {
      if (Array.isArray(c)) parts.push(String(c[0] || '') + ' ' + String(c[1] || ''));
      else if (c && typeof c === 'object') parts.push(String(c.vendor || '') + ' ' + String(c.code || ''));
    });
  }
  parts.push(String(it.code || ''));
  return parts.join('\n').toLowerCase();
}

/* 明显是「没写完」的内容。
   注意：xxx / Xxx 这类不能算占位符——命令示例里 `xxx.rpm`、`Xxx@12345`、
   `序列号 xxxx` 本来就该是占位符。只有明确的待办标记才算没写完。 */
const PLACEHOLDER = /todo|fixme|待补充|待完善|待填写|\?\?\?|示例文本|placeholder/i;

/* ---------------- 采集 ---------------- */

function collect() {
  const books = [];
  /* 主包和分包 utils/ 下有同名文件（内容不同），必须按绝对路径去重，
     否则同一份数据会被加载两次，误报成「id/名称重复」。 */
  const files = [];
  [TOOL_UTILS, MAIN_UTILS].forEach(dir => {
    fs.readdirSync(dir).filter(f => /^cmdbook.*\.js$/.test(f) && f !== 'cmdbook.js').forEach(f => {
      files.push(path.join(dir, f));
    });
  });
  files.forEach(full => {
    const f = path.basename(full);
    let mod;
    try { mod = require(full); } catch (e) { return; }
    Object.keys(mod).forEach(k => {
      const arr = mod[k];
      if (!Array.isArray(arr)) return;
      arr.forEach(it => {
        if (it && typeof it === 'object') books.push({ file: f, list: k, it: it });
      });
    });
  });

  /* cmdbook.js 里还有一批直接写在文件内的条目（不在任何 *_EXTRA 数组里），
     按 id 反差把它们补进来，否则这批条目会被审计漏掉。 */
  try {
    const agg = require(path.join(TOOL_UTILS, 'cmdbook.js'));
    const known = {};
    books.forEach(b => { if (b.it.id) known[b.it.id] = 1; });
    (agg.BOOK || []).forEach(it => {
      if (!it || !it.id || known[it.id]) return;
      books.push({ file: 'cmdbook.js', list: 'BOOK', it: it });
    });
  } catch (e) { /* ignore */ }

  const tpls = [];
  try {
    const { TPLS } = require(path.join(MAIN_UTILS, 'tplbook.js'));
    (TPLS || []).forEach(it => tpls.push({ file: 'tplbook.js', list: 'TPLS', it: it }));
  } catch (e) { /* ignore */ }

  return { books, tpls };
}

/* ---------------- 检查项 ---------------- */

function auditBook(entry, dupIds, dupNames) {
  const it = entry.it;
  const issues = [];
  const name = String(it.name || '').trim();
  const P = (t, d) => issues.push({ t: t, d: d || '' });

  if (!it.id) P('缺 id');
  if (!name) P('缺 name');
  if (!Array.isArray(it.devs) || !it.devs.length) P('devs 为空');
  if (!Array.isArray(it.kw) || !it.kw.length) P('kw 为空（搜不到别名）');
  if (!Array.isArray(it.cmds) || !it.cmds.length) {
    P('cmds 为空（没有可复制的命令）');
  } else {
    let emptyCode = 0, emptyVendor = 0, noAscii = 0, docSeg = 0;
    it.cmds.forEach(c => {
      const vendor = Array.isArray(c) ? c[0] : (c && c.vendor);
      const code = Array.isArray(c) ? c[1] : (c && c.code);
      if (!String(code || '').trim()) emptyCode++;
      if (!String(vendor || '').trim()) emptyVendor++;
      else if (!/[a-zA-Z]/.test(String(code || ''))) docSeg++;
    });
    /* 「厂商位」填的是分类标签（必备五件 / 3-2-1 原则 / 接线 …）的段落，
       本身是清单/说明文字，不是可执行命令 —— 不算缺陷，只做提示。 */
    if (emptyCode) P('部分命令正文为空', emptyCode + ' 条');
    if (emptyVendor) P('部分命令缺厂商名', emptyVendor + ' 条');
    if (docSeg) P('说明段落（厂商位是分类标签，非可执行命令）', docSeg + ' 段');
    /* 只有当整条都是说明、没有一条真命令时才算「正文全是说明文字」 */
    if (docSeg && docSeg === it.cmds.length) {
      P('整条都是说明文字（没有任何可复制命令）', docSeg + ' 段');
    }
  }

  /* 标题 vs 内容 */
  if (name && Array.isArray(it.cmds) && it.cmds.length) {
    const hay = haystackOf(it);
    const flat = flatten(hay);
    const tk = tokensOf(name);
    if (tk.ascii.length) {
      const hit = tk.ascii.filter(t => asciiHit(t, flat));
      if (!hit.length) P('标题含 ' + tk.ascii.join('/') + '，正文里没有（标题与内容不符？）');
    } else {
      /* 弱信号：只在这个条目确实有可执行命令时才判错配。
         「案例 / 清单」类条目的正文全是中文说明，不算错配。 */
      const hasRealCmd = it.cmds.some(c => {
        const code = Array.isArray(c) ? c[1] : (c && c.code);
        return /[a-zA-Z]/.test(String(code || ''));
      });
      if (hasRealCmd) {
        /* 优先用「强中文词」判定（去掉「查看/配置」这类通用描述）；
           没有强词时退回全量 2-gram。 */
        const strong = strongCnTokens(name);
        const pool = strong.length ? strong : tk.cn2;
        const hit = pool.filter(t => hay.indexOf(t) >= 0);
        /* 别名（kw）也算正文的一部分 —— 「查ip」「ipconfig」命中即说明内容对得上 */
        const kwHit = (it.kw || []).some(k => hay.indexOf(String(k).toLowerCase()) >= 0);
        if (!hit.length && !kwHit) P('标题与正文无任何词面交集（疑似错配）');
      }
    }
  }

  const all = haystackOf(it);
  if (PLACEHOLDER.test(all)) P('正文含占位符');

  if (it.id && dupIds[it.id]) P('id 重复', '与 ' + dupIds[it.id] + ' 撞了');
  if (name && dupNames[name]) P('名称重复', '与 ' + dupNames[name] + ' 撞了');

  return issues;
}

function auditTpl(entry, dupIds, dupNames) {
  const it = entry.it;
  const issues = [];
  const name = String(it.name || '').trim();
  const P = (t, d) => issues.push({ t: t, d: d || '' });

  if (!it.id) P('缺 id');
  if (!name) P('缺 name');
  if (!it.vendor) P('缺 vendor');
  if (!String(it.code || '').trim()) P('code 为空（模板没内容）');
  if (!it.cat) P('缺 cat（分类）');
  if (!Array.isArray(it.kw) || !it.kw.length) P('kw 为空（搜不到别名）');

  if (name && String(it.code || '').trim()) {
    const hay = haystackOf(it);
    const flat = flatten(hay);
    const tk = tokensOf(name);
    if (tk.ascii.length) {
      const hit = tk.ascii.filter(t => asciiHit(t, flat));
      if (!hit.length) P('标题含 ' + tk.ascii.join('/') + '，正文里没有（标题与内容不符？）');
    } else {
      const strong = strongCnTokens(name);
      const pool = strong.length ? strong : tk.cn2;
      const hit = pool.filter(t => hay.indexOf(t) >= 0);
      const kwHit = (it.kw || []).some(k => hay.indexOf(String(k).toLowerCase()) >= 0);
      if (!hit.length && !kwHit) P('标题与正文无任何词面交集（疑似错配）');
    }
  }
  if (PLACEHOLDER.test(haystackOf(it))) P('正文含占位符');

  if (it.id && dupIds[it.id]) P('id 重复', '与 ' + dupIds[it.id] + ' 撞了');
  if (name && dupNames[name]) P('名称重复', '与 ' + dupNames[name] + ' 撞了');

  return issues;
}

/* ---------------- 主流程 ---------------- */

function main() {
  const asJson = process.argv.indexOf('--json') >= 0;
  const { books, tpls } = collect();

  /* 重复表：只收录「出现次数 > 1」的 id / 名称，值为首次出现的来源文件。
     注意不能直接用 id → 文件 的映射来判断重复——那样每个 id 都命中，等于没判断。 */
  function buildDupMap(entries, keyFn) {
    const seen = {};
    entries.forEach(e => {
      const k = keyFn(e);
      if (!k) return;
      (seen[k] = seen[k] || []).push(e.file);
    });
    const out = {};
    Object.keys(seen).forEach(k => {
      if (seen[k].length > 1) out[k] = seen[k].join(' , ');
    });
    return out;
  }

  const bid = buildDupMap(books, e => String(e.it.id || ''));
  const bname = buildDupMap(books, e => String(e.it.name || '').trim());
  const tid = buildDupMap(tpls, e => String(e.it.id || ''));
  const tname = buildDupMap(tpls, e => String(e.it.name || '').trim());

  const bookIssues = [];
  books.forEach(e => {
    const issues = auditBook(e, bid, bname);
    if (issues.length) bookIssues.push({ file: e.file, id: e.it.id, name: e.it.name, issues });
  });

  const tplIssues = [];
  tpls.forEach(e => {
    const issues = auditTpl(e, tid, tname);
    if (issues.length) tplIssues.push({ file: e.file, id: e.it.id, name: e.it.name, issues });
  });

  if (asJson) {
    console.log(JSON.stringify({ bookIssues, tplIssues }, null, 2));
    return;
  }

  console.log('════════════════════════════════════');
  console.log('  命令百科 / 配置模板库 内容审计');
  console.log('════════════════════════════════════');
  console.log('百科条目 ' + books.length + ' 条，模板 ' + tpls.length + ' 个');
  console.log('');

  /* 按问题类型分组统计 */
  const tally = {};
  bookIssues.concat(tplIssues).forEach(x => {
    x.issues.forEach(i => {
      tally[i.t] = (tally[i.t] || 0) + 1;
    });
  });
  console.log('── 问题类型统计 ──');
  Object.keys(tally).sort((a, b) => tally[b] - tally[a]).forEach(k => {
    console.log('  ' + String(tally[k]).padStart(4) + '  ' + k);
  });

  /* 「说明段落」是百科里的知识条目（交付清单 / 原则说明 / 排查思路），
     本来就不含可复制命令，属正常设计，不算缺陷 —— 单列出来，不混进问题清单。 */
  const NOTE_LABELS = ['说明段落（厂商位是分类标签，非可执行命令）', '整条都是说明文字（没有任何可复制命令）'];
  const realBook = bookIssues.filter(x => x.issues.some(i => NOTE_LABELS.indexOf(i.t) < 0));
  const realTpl = tplIssues.filter(x => x.issues.some(i => NOTE_LABELS.indexOf(i.t) < 0));
  const noteCount = bookIssues.length - realBook.length + (tplIssues.length - realTpl.length);

  console.log('');
  console.log('（另有 ' + noteCount + ' 条为「说明类条目」—— 交付清单 / 原则说明这类知识条目，');
  console.log('  按设计就不含可复制命令，不计入问题）');

  console.log('\n── 命令百科问题条目（' + realBook.length + '）──');
  realBook.forEach(x => {
    console.log('  [' + x.file + '] ' + (x.name || '(无标题)') + '  <' + x.id + '>');
    x.issues.forEach(i => console.log('      · ' + i.t + (i.d ? '（' + i.d + '）' : '')));
  });

  console.log('\n── 配置模板问题条目（' + realTpl.length + '）──');
  realTpl.forEach(x => {
    console.log('  [' + x.file + '] ' + (x.name || '(无标题)') + '  <' + x.id + '>');
    x.issues.forEach(i => console.log('      · ' + i.t + (i.d ? '（' + i.d + '）' : '')));
  });

  if (!realBook.length && !realTpl.length) {
    console.log('');
    console.log('  ✓ 没有需要清理的问题条目。');
  }
}

main();
