/* 把百科条目总数同步到 seed.js 的 BOOK_COUNT。
 *
 * 为什么需要：百科数据在分包（subpkg-tool/utils/cmdbook.js），
 * 主包引用不到分包资源，但首页要显示「命令百科 N 条」。
 * 手写数字必然会和实际条数脱节，所以从真实数据同步。
 *
 * 用法：node miniprogram-tools/sync_book_count.js [--check]
 *   --check 只比对不写入，条数不一致时返回非 0（可挂 CI）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'miniprogram', 'utils', 'seed.js');
const CMD = path.join(ROOT, 'miniprogram', 'subpkg-tool', 'utils', 'cmdbook.js');

const checkOnly = process.argv.indexOf('--check') >= 0;

const { BOOK } = require(CMD);
const real = BOOK.length;

const src = fs.readFileSync(SEED, 'utf8');
const m = src.match(/const BOOK_COUNT\s*=\s*(\d+)\s*;/);
if (!m) {
  console.error('✗ seed.js 里找不到 BOOK_COUNT');
  process.exit(1);
}

const cur = Number(m[1]);
if (cur === real) {
  console.log('✓ BOOK_COUNT 已是最新: ' + real);
  process.exit(0);
}

if (checkOnly) {
  console.error('✗ BOOK_COUNT 过期: seed.js 写的是 ' + cur + '，实际 ' + real + ' 条');
  process.exit(1);
}

const out = src.replace(/const BOOK_COUNT\s*=\s*\d+\s*;/, 'const BOOK_COUNT = ' + real + ';');
fs.writeFileSync(SEED, out, 'utf8');
console.log('已更新 BOOK_COUNT: ' + cur + ' → ' + real);
