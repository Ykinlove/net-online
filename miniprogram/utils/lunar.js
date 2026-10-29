// utils/lunar.js —— 农历（2024-2050）、24 节气、农历/公历节日
// 数据源：2018-2050 每年正月初一的公历日期 + 闰月 + 各月天数（由标准历法库生成并抽样校验）

const YEAR0 = 2018;

/* 每年：[正月初一的月, 日, 闰月(0=无闰), 各月天数...] */
const LUNAR_TABLE = [
  [2,16,0,29,30,29,30,29,29,30,29,30,29,30,30],                  // 2018
  [2,5,0,30,29,30,29,30,29,29,30,29,29,30,30],                   // 2019
  [1,25,4,29,30,30,30,29,30,29,29,30,29,30,29,30],               // 2020
  [2,12,0,29,30,30,29,30,29,30,29,30,29,30,29],                  // 2021
  [2,1,0,30,29,30,29,30,30,29,30,29,30,29,30],                   // 2022
  [1,22,2,29,30,29,29,30,30,29,30,30,29,30,29,30],               // 2023
  [2,10,0,29,30,29,29,30,29,30,30,29,30,30,29],                  // 2024
  [1,29,6,30,29,30,29,29,30,29,30,29,30,30,30,29],               // 2025
  [2,17,0,30,29,30,29,29,30,29,29,30,30,30,29],                  // 2026
  [2,6,0,30,30,29,30,29,29,30,29,29,30,30,29],                   // 2027
  [1,26,5,30,30,30,29,30,29,29,30,29,29,30,30,29],               // 2028
  [2,13,0,30,30,29,30,29,30,29,30,29,29,30,30],                  // 2029
  [2,3,0,29,30,29,30,30,29,30,29,30,29,30,29],                   // 2030
  [1,23,3,29,30,30,29,30,29,30,30,29,30,29,30,29],               // 2031
  [2,11,0,30,29,29,30,29,30,30,29,30,30,29,30],                  // 2032
  [1,31,11,29,30,29,29,30,29,30,29,30,30,30,29,30],              // 2033
  [2,19,0,29,30,29,29,30,29,30,29,30,30,29,30],                  // 2034
  [2,8,0,30,29,30,29,29,30,29,29,30,30,29,30],                   // 2035
  [1,28,6,30,30,29,30,29,29,30,29,29,30,29,30,30],               // 2036
  [2,15,0,30,30,29,30,29,29,30,29,29,30,29,30],                  // 2037
  [2,4,0,30,30,29,30,29,30,29,30,29,29,30,29],                   // 2038
  [1,24,5,30,30,29,30,30,29,30,29,30,29,30,29,29],               // 2039
  [2,12,0,30,29,30,30,29,30,29,30,30,29,30,29],                  // 2040
  [2,1,0,29,30,29,30,29,30,30,29,30,30,29,30],                   // 2041
  [1,22,2,29,30,29,29,30,29,30,29,30,30,29,30,30],               // 2042
  [2,10,0,29,30,29,29,30,29,29,30,30,29,30,30],                  // 2043
  [1,30,7,30,29,30,29,29,30,29,29,30,29,30,30,30],               // 2044
  [2,17,0,30,29,30,29,29,30,29,29,30,29,30,30],                  // 2045
  [2,6,0,30,29,30,29,30,29,30,29,29,30,29,30],                   // 2046
  [1,26,5,30,29,30,30,29,30,29,30,29,29,30,29,30],               // 2047
  [2,14,0,29,30,30,29,30,30,29,30,29,29,30,29],                  // 2048
  [2,2,0,30,29,30,29,30,30,29,30,30,29,30,29],                   // 2049
  [1,23,3,29,30,29,30,29,30,29,30,30,29,30,30,29],               // 2050
];

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function dayCn(d) {
  if (d <= 10) return '初' + NUM_CN[d];
  if (d < 20) return '十' + NUM_CN[d - 10];
  if (d === 20) return '二十';
  if (d < 30) return '廿' + NUM_CN[d - 20];
  return '三十';
}

function monthCn(m) {
  return MONTH_CN[m - 1] + '月';
}

/* 公历 -> 农历；超出 2024-2050 返回 null */
function solarToLunar(y, m, d) {
  let idx = y - YEAR0;
  if (idx < 0 || idx >= LUNAR_TABLE.length) return null;

  const dayMs = Date.UTC(y, m - 1, d);
  let row = LUNAR_TABLE[idx];
  let nyMs = Date.UTC(YEAR0 + idx, row[0] - 1, row[1]);

  /* 1、2 月里还没到春节的日子属于上一个农历年，要回退一年 */
  if (dayMs < nyMs) {
    idx -= 1;
    if (idx < 0) return null;
    row = LUNAR_TABLE[idx];
    nyMs = Date.UTC(YEAR0 + idx, row[0] - 1, row[1]);
  }

  let off = Math.round((dayMs - nyMs) / 86400000);
  if (off < 0) return null;

  const leap = row[2];
  const lens = row.slice(3);
  for (let i = 0; i < lens.length; i++) {
    if (off < lens[i]) {
      let month;
      let isLeap = false;
      if (leap === 0) {
        month = i + 1;
      } else if (i < leap) {
        month = i + 1;
      } else if (i === leap) {
        month = leap;
        isLeap = true;
      } else {
        month = i;
      }
      return {
        year: YEAR0 + idx,
        month,
        day: off + 1,
        isLeap,
        monthDays: lens[i],
        monthName: monthCn(month),
        dayName: off + 1 === 1 ? monthCn(month) : dayCn(off + 1)
      };
    }
    off -= lens[i];
  }
  return null;
}

/* ---------- 24 节气 ---------- */
const TERM_NAMES = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];
/* 每年 24 个节气的日期，用 base36 单字符编码（1-9,a-v 表示 1-31 日）。
   近似公式在部分年份会差一天（如 2024 处暑、2026 芒种），所以直接存精确日期。 */
const TERM_YEAR0 = 2018;
const TERM_TABLE = [
  '5k4j5l5k5l6l7n7n8n8n7m7m', '5k4j6l5k6l6l7n8n8n8o8m7m', '6k4j5k4j5k5l6m7m7m8n7m7l', '5k3i5k4k5l5l7m7n7n8n7m7l',   // 2018-2021
  '5k4j5k5k5l6l7n7n7n8n7m7m', '5k4j6l5k6l6l7n8n8n8o8m7m', '6k4j5k4j5k5l6m7m7m8n7m6l', '5k3i5k4k5l5l7m7n7n8n7m7l',   // 2022-2025
  '5k4i5k5k5l5l7n7n7n8n7m7m', '5k4j6l5k6l6l7n8n8n8n7m7m', '6k4j5k4j5k5l6m7m7m8n7m6l', '5k3i5k4k5l5l7m7n7n8n7m7l',   // 2026-2029
  '5k4i5k5k5l5l7n7n7n8n7m7m', '5k4j6l5k6l6l7n8n8n8n7m7m', '6k4j5k4j5k5l6m7m7m8n7m6l', '5k3i5k4k5l5l7m7n7n8n7m7l',   // 2030-2033
  '5k4i5k5k5l5l7n7n7n8n7m7m', '5k4j6l5k5l6l7n7n8n8n7m7m', '6k4j5k4j5k5l6m7m7m8n7m6l', '5k3i5k4k5l5l7m7n7n8n7m7l',   // 2034-2037
  '5k4i5k5k5l5l7n7n7n8n7m7m', '5k4j6l5k5l6l7n7n8n8n7m7m', '6k4j5k4j5k5l6m7m7m8n7m6l', '5k3i5k4k5k5l7m7n7m8n7m7l',   // 2038-2041
  '5k4i5k4k5l5l7n7n7n8n7m7m', '5k4j6l5k5l6l7n7n8n8n7m7m', '6k4j5k4j5k5l6m7m7m7n7m6l', '5k3i5k4j5k5l7m7n7m8n7m7l',   // 2042-2045
  '5k4i5k4k5l5l7m7n7n8n7m7m', '5k4j6l5k5l6l7n7n8n8n7m7m', '6k4j5k4j5k5k6m7m7m7n7l6l', '5j3i5k4j5k5l6m7m7m8n7m7l',   // 2046-2049
  '5k3i5k4k5l5l7m7n7n8n7m7m',   // 2050-2050
];

function termOf(y, m, d) {
  const idx = y - TERM_YEAR0;
  if (idx < 0 || idx >= TERM_TABLE.length) return '';
  const row = TERM_TABLE[idx];
  const i0 = (m - 1) * 2;
  if (parseInt(row[i0], 36) === d) return TERM_NAMES[i0];
  if (parseInt(row[i0 + 1], 36) === d) return TERM_NAMES[i0 + 1];
  return '';
}

/* ---------- 节日 ---------- */
const SOLAR_FEST = {
  '1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '3-12': '植树节',
  '4-1': '愚人节', '5-1': '劳动节', '5-4': '青年节', '6-1': '儿童节',
  '7-1': '建党节', '8-1': '建军节', '9-10': '教师节', '10-1': '国庆节',
  '12-24': '平安夜', '12-25': '圣诞节'
};

const LUNAR_FEST = {
  '1-1': '春节', '1-15': '元宵', '2-2': '龙抬头', '5-5': '端午',
  '7-7': '七夕', '8-15': '中秋', '9-9': '重阳', '12-8': '腊八'
};

/* 返回 { sub, kind }：kind = fest / term / lunar */
function dayInfo(y, m, d) {
  const lu = solarToLunar(y, m, d);

  const sf = SOLAR_FEST[m + '-' + d];
  if (sf) return { sub: sf, kind: 'fest' };

  if (lu && !lu.isLeap) {
    if (lu.month === 12 && lu.day === lu.monthDays) return { sub: '除夕', kind: 'fest' };
    const lf = LUNAR_FEST[lu.month + '-' + lu.day];
    if (lf) return { sub: lf, kind: 'fest' };
  }

  const t = termOf(y, m, d);
  if (t) {
    /* 清明既是节气也算节日，按节日色显示 */
    return { sub: t, kind: t === '清明' ? 'fest' : 'term' };
  }

  if (!lu) return { sub: '', kind: '' };
  /* 初一显示月份（如「七月」），和纸质日历一样 */
  if (lu.day === 1) {
    return { sub: (lu.isLeap ? '闰' : '') + monthCn(lu.month), kind: 'lunar' };
  }
  return { sub: lu.dayName, kind: 'lunar' };
}

/* 当月第几周（周一为一周开始，含 1 号的那周算第 1 周） */
function weekOfMonth(y, m, d) {
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  return Math.floor((d + offset - 1) / 7) + 1;
}

/* 当月共有几周 */
function weeksInMonth(y, m) {
  const total = new Date(y, m, 0).getDate();
  return weekOfMonth(y, m, total);
}

module.exports = { solarToLunar, termOf, dayInfo, weekOfMonth, weeksInMonth, dayCn, monthCn };
