// 校验 admin 页的「定位→灌字段→增量 diff」逻辑（node 无 wx 环境）
global.wx = undefined;
const cmdbook = require('../miniprogram/subpkg-tool/utils/cmdbook.js');
const hotfix = require('../miniprogram/utils/hotfix.js');

let fails = 0;
function ok(name, cond) {
  if (cond) { console.log('  PASS  ' + name); }
  else { console.log('  FAIL  ' + name); fails++; }
}

// ---- 模拟 loadEditor(kind, item) 的字段映射 + publish() 的增量 diff ----
function simulate(kind, item, edit) {
  const fields = {};
  const kwOf = (s) => (s || '').split(/[，,\s]+/).map(x => x.trim()).filter(Boolean);
  if (kind === 'book') {
    if (edit.bName !== (item.name || '')) fields.name = edit.bName;
    const kwArr = kwOf(edit.bKw);
    if (JSON.stringify(kwArr) !== JSON.stringify(item.kw || [])) fields.kw = kwArr;
    if (edit.bTip !== (item.tip || '')) fields.tip = edit.bTip;
    const newCmds = edit.bVendors.map(v => [v.vendor, v.code]);
    if (JSON.stringify(newCmds) !== JSON.stringify(item.cmds || [])) fields.cmds = newCmds;
  } else {
    if (edit.tName !== (item.name || '')) fields.name = edit.tName;
    if (edit.tCat !== (item.cat || '')) fields.cat = edit.tCat;
    const kwArr = kwOf(edit.tKw);
    if (JSON.stringify(kwArr) !== JSON.stringify(item.kw || [])) fields.kw = kwArr;
    if (edit.tVendor !== (item.vendor || '')) fields.vendor = edit.tVendor;
    if (edit.tCode !== (item.code || '')) fields.code = edit.tCode;
    if (edit.tNote !== (item.note || '')) fields.note = edit.tNote;
  }
  return fields;
}

// ===== 1. 命令百科 =====
const book = cmdbook.findById('vlan-create');
ok('百科: findById 命中', !!book);
if (book) {
  // loadEditor 映射
  const vendors = (book.cmds || []).map(c => ({ vendor: c[0], code: c[1] || '' }));
  ok('百科: cmds 映射为 vendors', vendors.length === book.cmds.length && vendors[0].vendor === book.cmds[0][0]);

  // 不改 → 空 diff
  const noChange = simulate('book', book, {
    bName: book.name, bKw: (book.kw||[]).join('，'), bTip: book.tip || '', bVendors: vendors
  });
  ok('百科: 无改动时 diff 为空', Object.keys(noChange).length === 0);

  // 改 tip → 只含 tip
  const changeTip = simulate('book', book, {
    bName: book.name, bKw: (book.kw||[]).join('，'), bTip: '新的易错点', bVendors: vendors
  });
  ok('百科: 改 tip 只产出 tip 字段', JSON.stringify(changeTip) === JSON.stringify({ tip: '新的易错点' }));

  // 改第一家厂商命令
  const v2 = vendors.map((v,i) => i===0 ? { vendor: v.vendor, code: v.code + '\n! 追加' } : v);
  const changeCmds = simulate('book', book, {
    bName: book.name, bKw: (book.kw||[]).join('，'), bTip: book.tip || '', bVendors: v2
  });
  ok('百科: 改命令产出 cmds 字段', !!changeCmds.cmds && changeCmds.cmds[0][1].indexOf('追加') >= 0);
}

// ===== 2. 配置模板（关键：验证之前读 cmds 空白的 bug 已修复）=====
const tpl = cmdbook.findTplById('tpl-switch-base');
ok('模板: findTplById 命中', !!tpl);
if (tpl) {
  // loadEditor 映射：模板用 code / vendor，不是 cmds
  ok('模板: 结构含 code 与 vendor', typeof tpl.code === 'string' && typeof tpl.vendor === 'string');
  ok('模板: 结构不含 cmds', !Array.isArray(tpl.cmds));

  const noChange = simulate('tpl', tpl, {
    tName: tpl.name, tCat: tpl.cat, tKw: (tpl.kw||[]).join('，'),
    tVendor: tpl.vendor, tCode: tpl.code, tNote: tpl.note || ''
  });
  ok('模板: 无改动时 diff 为空', Object.keys(noChange).length === 0);

  const changeCode = simulate('tpl', tpl, {
    tName: tpl.name, tCat: tpl.cat, tKw: (tpl.kw||[]).join('，'),
    tVendor: tpl.vendor, tCode: tpl.code + '\n! 追加', tNote: tpl.note || ''
  });
  ok('模板: 改 code 产出 code 字段（不再走 cmds）', changeCode.code === tpl.code + '\n! 追加' && !changeCode.cmds);

  const changeMeta = simulate('tpl', tpl, {
    tName: '改名后的模板', tCat: tpl.cat, tKw: (tpl.kw||[]).join('，'),
    tVendor: tpl.vendor, tCode: tpl.code, tNote: tpl.note || ''
  });
  ok('模板: 改 name 产出 name 字段', changeMeta.name === '改名后的模板');
}

console.log(fails === 0 ? '\nALL PASS' : '\n' + fails + ' FAILED');
process.exit(fails === 0 ? 0 : 1);
