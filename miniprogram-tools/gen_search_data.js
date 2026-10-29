const fs = require('fs');
const path = require('path');
const { search, BOOK } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

/* 图1：进入搜索页的默认态（关键词为空，列出全部功能点）
   图2：搜「保存配置」的详情浮层——这条带中文注释行，正好展示「注释灰掉、复制不带」 */
const ALL = search('', '全部');
const SHEET_KW = '保存配置';
const HIT = search(SHEET_KW, '全部');

const SIDE = [
  { v: '全部', t: '全部' },
  { v: 'Switch', t: '交换机' },
  { v: 'Router', t: '路由器' },
  { v: 'AC', t: '无线控制器' },
  { v: 'AP', t: '无线AP' },
  { v: '防火墙', t: '防火墙' },
  { v: 'Linux', t: 'Linux' },
  { v: 'Windows', t: 'Windows' },
  { v: '服务器', t: '服务器' },
  { v: '其他设备', t: '其他' }
];

function withLines(code) {
  return String(code).split('\n').map(t => {
    const s = t.trim();
    const note = !s || /^[#!]/.test(s) || !/[a-zA-Z0-9]/.test(s) ||
      (/^[（(].*[）)]$/.test(s) && /[\u4e00-\u9fa5]/.test(s));
    return { t: s || ' ', note: note };
  });
}

const one = HIT[0];
const data = {
  query: '',
  sheetQuery: SHEET_KW,
  side: SIDE,
  list: ALL.slice(0, 24).map(h => ({ name: h.name, vendors: h.cmds.map(c => c.vendor) })),
  one: {
    name: one.name,
    tip: one.tip,
    cmds: one.cmds.map(c => ({ vendor: c.vendor, code: c.code, lines: withLines(c.code) }))
  },
  stats: {
    points: BOOK.length,
    cmds: BOOK.reduce((a, b) => a + b.cmds.length, 0),
    total: ALL.length
  }
};

const out = path.join(__dirname, '..', 'chargen_preview', 'search_data.json');
fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
console.log('全部', ALL.length, '| 保存配置', HIT.length, '| 详情', one.name);
