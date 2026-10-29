// utils/level.js —— 等级与经验系统（LV.1 ~ LV.30），与 H5 版完全一致

const LEVEL_TABLE = (function () {
  const table = [0];
  let total = 0;
  for (let lv = 1; lv <= 30; lv++) {
    table[lv] = total;
    const base = Math.round(80 + lv * 20 * Math.pow(1.12, lv));
    total += base;
  }
  table[31] = total;
  return table;
})();

function getLevel(exp) {
  const e = Number(exp) || 0;
  for (let lv = 30; lv >= 1; lv--) if (e >= LEVEL_TABLE[lv]) return lv;
  return 1;
}

function getExpProgress(exp) {
  const e = Number(exp) || 0;
  const lv = getLevel(e);
  if (lv >= 30) return { lv: 30, current: e - LEVEL_TABLE[30], need: 0, pct: 100, text: 'MAX' };
  const curBase = LEVEL_TABLE[lv];
  const nextBase = LEVEL_TABLE[lv + 1];
  const current = e - curBase;
  const need = nextBase - curBase;
  const pct = need > 0 ? Math.min(100, Math.round((current / need) * 100)) : 100;
  return { lv, current, need, pct, text: current + ' / ' + need };
}

module.exports = { LEVEL_TABLE, getLevel, getExpProgress };
