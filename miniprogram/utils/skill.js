// utils/skill.js —— 等级体系：100 级满级，满级需要 10000 条命令的等价量
const { NET_CATEGORIES } = require('./seed.js');

function inferCat(text) {
  const s = String(text || '').toLowerCase();
  for (let i = 0; i < NET_CATEGORIES.length; i++) {
    const cat = NET_CATEGORIES[i];
    for (let j = 0; j < cat.kw.length; j++) {
      if (s.indexOf(String(cat.kw[j]).toLowerCase()) >= 0) return cat.key;
    }
  }
  return null;
}

/* ---------- 经验权重：1 点 = 1 条命令 ---------- */
const EXP_PER_CMD = 1;      // 一条命令 1 点（= 0.1 经验）
const EXP_PER_PROJ = 8;     // 一个项目 ≈ 8 条命令
const EXP_PER_LIT = 5;      // 一个已点亮技能 ≈ 5 条命令
const EXP_PER_LEARN = 2;    // 一个在学技能 ≈ 2 条命令

/* ---------- 100 级阈值表（累积点数） ----------
   由等比递增曲线生成：升到 Lv.n 需要的点数逐级放大，满级 Lv.100 正好 10000 点。
   关键节点：Lv.2=5条  Lv.5=21条  Lv.10=54条  Lv.20=148条
             Lv.30=297条  Lv.50=906条  Lv.70=2435条  Lv.100=10000条 */
const EXP_TIERS = [
  0, 5, 10, 16, 21, 27, 34, 40, 47, 54,
  62, 70, 78, 87, 96, 106, 116, 126, 137, 148,
  160, 173, 186, 200, 214, 229, 245, 262, 279, 297,
  316, 336, 357, 379, 401, 425, 450, 477, 504, 533,
  563, 594, 627, 662, 698, 736, 776, 817, 861, 906,
  954, 1004, 1056, 1111, 1168, 1228, 1291, 1357, 1426, 1498,
  1573, 1652, 1735, 1822, 1913, 2008, 2107, 2211, 2321, 2435,
  2555, 2680, 2811, 2948, 3092, 3243, 3401, 3566, 3739, 3920,
  4109, 4308, 4516, 4733, 4961, 5200, 5450, 5712, 5986, 6272,
  6573, 6887, 7217, 7562, 7923, 8301, 8697, 9111, 9545, 10000
];

const MAX_LEVEL = EXP_TIERS.length;

function levelOf(pts) {
  let lv = 1;
  for (let i = 1; i < EXP_TIERS.length; i++) {
    if (pts >= EXP_TIERS[i]) lv = i + 1;
    else break;
  }
  return lv;
}

function progressOf(pts) {
  const lv = levelOf(pts);
  if (lv >= MAX_LEVEL) return 100;
  const cur = EXP_TIERS[lv - 1];
  const next = EXP_TIERS[lv];
  const p = Math.round(((pts - cur) / (next - cur)) * 100);
  return Math.max(0, Math.min(100, p));
}

/* 点数 -> 展示用经验（1 点 = 0.1 经验，保留一位小数） */
function toExp(pts) {
  return Math.round(pts) / 10;
}

/* 总等级：命令 + 项目 + 技能全部合在一起，不分方向 */
function computeOverallLevel(commands, projects, skills) {
  const cmds = (commands || []).length;
  const projs = (projects || []).length;
  let lit = 0;
  let learning = 0;
  (skills || []).forEach(s => {
    if (s.status === 'lit') lit += 1;
    else if (s.status === 'learning') learning += 1;
  });

  const pts = cmds * EXP_PER_CMD + projs * EXP_PER_PROJ
    + lit * EXP_PER_LIT + learning * EXP_PER_LEARN;

  const level = levelOf(pts);
  const maxed = level >= MAX_LEVEL;
  const nextLevel = maxed ? MAX_LEVEL : level + 1;
  const toNext = maxed ? 0 : EXP_TIERS[level] - pts;

  return {
    level,
    maxed,
    nextLevel,
    exp: toExp(pts),
    pct: progressOf(pts),
    /* 还差几条命令升到下一级；满级为 0 */
    toNext,
    /* 各来源的原始条数，页面上用来解释等级是怎么来的 */
    stat: { cmds, projs, lit, learning }
  };
}

/* 方向等级：口径与总等级一致（同权重、同阈值），只是按分类拆开算 */
function computeCategoryLevels(commands, projects, skills) {
  const evidence = {};
  NET_CATEGORIES.forEach(c => { evidence[c.key] = 0; });

  (commands || []).forEach(c => {
    const cat = c.cat || inferCat([c.title, c.content, c.desc, c.skill, c.tags].join(' '));
    if (cat && evidence[cat] !== undefined) evidence[cat] += EXP_PER_CMD;
  });
  (projects || []).forEach(p => {
    const cat = inferCat([p.name, p.content, p.devices, p.cmds, p.tags, p.skill].join(' '));
    if (cat && evidence[cat] !== undefined) evidence[cat] += EXP_PER_PROJ;
  });
  (skills || []).forEach(s => {
    const cat = s.cat || inferCat(s.name + ' ' + (s.goalText || ''));
    if (cat && evidence[cat] !== undefined) {
      evidence[cat] += (s.status === 'lit' ? EXP_PER_LIT : EXP_PER_LEARN);
    }
  });

  return NET_CATEGORIES
    .map(c => {
      const ev = evidence[c.key];
      const lv = levelOf(ev);
      return {
        key: c.key,
        name: c.name,
        count: ev,
        level: lv,
        pct: progressOf(ev),
        /* 距离下一级还差多少点，满级为 0 */
        left: lv >= MAX_LEVEL ? 0 : EXP_TIERS[lv] - ev
      };
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  inferCat,
  computeOverallLevel,
  computeCategoryLevels,
  EXP_TIERS,
  MAX_LEVEL,
  toExp
};
