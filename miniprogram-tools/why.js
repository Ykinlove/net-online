/**
 * 拆解一次搜索：切成哪些词、每个词权重多少、前 N 条各自怎么得分的。
 * 用来判断「排序不对」到底是词切错了、权重给错了，还是被正文分堆上去的。
 *
 *   node why.js "查mac地址表"
 *   node why.js "交换机怎么选" 8
 */
const { norm, expand, _dbg } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');
const { buildIndex, dropGreedy, rarity, scoreOf, intentsOf, isStrongIntent } = _dbg;

const q = process.argv[2] || '查mac地址表';
const N = Number(process.argv[3] || 6);

const all = buildIndex();
const n0 = norm(q);
const e0 = expand(n0);
const words = dropGreedy(all, null, e0);
const wt = rarity(all, null, words);

console.log('原始输入   ' + q);
console.log('norm 后    ' + JSON.stringify(n0));
console.log('expand 后  ' + JSON.stringify(e0));
console.log('dropGreedy ' + JSON.stringify(words));
console.log('各词权重   ' + JSON.stringify(wt));
console.log('');

const ctx = { qi: intentsOf(q), q: String(q).toLowerCase(), nq: String(q).toLowerCase().replace(/\s+/g, '') };
/* 必须和 search() 用同一套 imask / need，否则这里算出来的「全部词命中」
   和真实结果不是一回事（意图词那组本来就不计入门槛） */
const imask = words.map(function (g) {
  return g.every(function (w) { return isStrongIntent(w); });
});
let topic = 0, intentCnt = 0;
for (let i = 0; i < imask.length; i++) { if (imask[i]) intentCnt++; else topic++; }
if (topic === 0) { for (let i = 0; i < imask.length; i++) imask[i] = false; topic = words.length; intentCnt = 0; }
ctx.imask = imask;
ctx.need = (intentCnt === 1 && topic > 0) ? topic : words.length;

console.log('查询意图   ' + JSON.stringify(ctx.qi));
console.log('意图组     ' + JSON.stringify(imask) + '   需命中 ' + ctx.need + ' 个（共 ' + words.length + ' 词）');
console.log('');
const cand = all.map(function (rec) {
  const sc = words.length ? scoreOf(rec, words, wt, ctx) : { hit: 0, score: 0, raw: 0 };
  return { name: rec.it.name, id: rec.it.id, cmds: rec.it.cmds.length,
    hit: sc.hit, score: sc.score, raw: sc.raw };
});

const full = cand.filter(function (c) { return c.hit === words.length; }).sort(function (a, b) { return b.score - a.score; });
const need = cand.filter(function (c) { return c.hit >= ctx.need; })
  .sort(function (a, b) { return (b.score - a.score) || (b.raw - a.raw); });
const part = cand.filter(function (c) { return c.hit > 0 && c.hit < ctx.need; })
  .sort(function (a, b) { return (b.hit - a.hit) || (b.score - a.score); });

const use = full.length ? full : (need.length ? need : part);
const tag = full.length ? '全部词命中 ' : (need.length ? '达到门槛 ' : '仅部分词命中 ');
console.log(tag + use.length + ' 条，前 ' + N + '：');
use.slice(0, N).forEach(function (c, i) {
  console.log('  ' + String(i + 1).padStart(2) + '. ' + c.score.toString().padStart(4) +
    '  hit' + c.hit + '  ' + String(c.cmds).padStart(2) + '组  ' + c.name + '   [' + c.id + ']');
});
