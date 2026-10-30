/* 云端热更新评测：覆盖层合并 + 搜索反映 + 不污染原始数据 + ingest 逻辑
   用法：node eval_hotfix.js
*/
const hotfix = require('../miniprogram/utils/hotfix.js');
const cmdbook = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  (' + extra + ')' : '')); }
}

// 复位
hotfix._dbg.setPatch({ book: {}, tpl: {} }, 0);

// ---- 取一条已知 book 条目 ----
const sample = cmdbook.search('vlan', '全部')[0];
const id = sample.id;
const orig = cmdbook.findById(id);

// 注入 patch（模拟云端已拉取到）
const patch = { __u: Date.now(), name: 'PATCH名称_唯一abc', tip: 'PATCH_tip_唯一', kw: ['唯一关键词xyz'] };
hotfix._dbg.setPatch({ book: { [id]: patch }, tpl: {} }, 7);

const patched = cmdbook.findById(id);
check('patch 后 name 被覆盖', patched.name === patch.name);
check('patch 后 tip 被覆盖', patched.tip === patch.tip);
check('原数据对象未被污染', orig.name !== patched.name);
check('getPatch 返回 patch 且含 __u', !!hotfix.getPatch('book', id) && hotfix.getPatch('book', id).__u > 0);

// 搜索反映 patch：新名字/新 kw 可搜到
const byName = cmdbook.search(patch.name, '全部');
check('热更新后新名称可搜到', byName.length > 0 && byName[0].id === id);
const byKw = cmdbook.search('唯一关键词xyz', '全部');
check('热更新后新 kw 可搜到', byKw.length > 0 && byKw.some(r => r.id === id));

// ---- 模板 patch ----
const tplSample = cmdbook.searchTemplates('开局', 1)[0];
const tplId = tplSample.id;
const tPatch = { __u: Date.now(), name: '模板PATCH名_唯一', note: '模板PATCH_note' };
hotfix._dbg.setPatch({ book: { [id]: patch }, tpl: { [tplId]: tPatch } }, 9);
const tPatched = cmdbook.findTplById(tplId);
check('模板 patch 后 name 覆盖', tPatched.name === '模板PATCH名_唯一');
check('模板 patch 后 note 覆盖', tPatched.note === '模板PATCH_note');

// ---- 纯函数 mergePatch ----
const base = { id: 'x', name: 'a', cmds: [['华为', 'vlan 1']], kw: ['k'], tip: 't' };
const m1 = hotfix.mergePatch(base, { name: 'b', __u: 1, remark: 'meta' });
check('mergePatch 覆盖业务字段', m1.name === 'b');
check('mergePatch 不改原对象', base.name === 'a');
check('mergePatch 跳过元数据', m1.remark === undefined && m1.__u === undefined);
check('mergePatch 无 patch 原样返回', hotfix.mergePatch(base, null) === base);

// ---- ingest：同 targetId 后者覆盖 + version 自增 ----
hotfix._dbg.setPatch({ book: {}, tpl: {} }, 0);
const v0 = hotfix.version();
hotfix._dbg.ingest([
  { kind: 'book', targetId: 't1', patch: { tip: 'v1' }, updatedAt: 100 },
  { kind: 'book', targetId: 't1', patch: { tip: 'v2' }, updatedAt: 200 },
  { kind: 'tpl', targetId: 'p1', patch: { name: 'pn' }, updatedAt: 150 }
]);
check('ingest 同 id 后者覆盖', hotfix.getPatch('book', 't1').tip === 'v2');
check('ingest 跨 kind 分离', hotfix.getPatch('tpl', 'p1').name === 'pn');
check('ingest 自增 version', hotfix.version() === v0 + 1);
check('lastUpdated 取最大 updatedAt', hotfix._dbg.lastUpdated() === 200);

console.log('\n热更新评测：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
