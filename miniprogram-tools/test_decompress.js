// test_decompress.js —— decompress.js 的往返验证
//
// 这是整个「数据压缩进包」方案的技术风险点，必须做到：
//   1. inflate 实现与 node zlib 完全一致（字节级）
//   2. 边界情况不崩（空输入、极小输入、纯重复、随机字节、超长串）
//   3. 性能可接受（命令库 900 KB 量级）
//
// 跑法：node miniprogram-tools/test_decompress.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert');

const HERE = __dirname;
const DEC = path.join(HERE, '..', 'miniprogram', 'subpkg-tool', 'utils', 'decompress.js');
const { unpack, inflateRaw, b64ToBytes, utf8Decode } = require(DEC);

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

console.log('--- 基础往返 ---');

check('b64 -> bytes 对齐', () => {
  assert.deepStrictEqual(Array.from(b64ToBytes('TWFu')), [0x4d, 0x61, 0x6e]);
  assert.deepStrictEqual(Array.from(b64ToBytes('TWE=')), [0x4d, 0x61]);
  assert.deepStrictEqual(Array.from(b64ToBytes('TQ==')), [0x4d]);
  assert.deepStrictEqual(Array.from(b64ToBytes('')), []);
});

check('base64 带换行/空白仍可解', () => {
  const raw = Buffer.from('hello 世界', 'utf8');
  const b64 = raw.toString('base64');
  const wrapped = b64.slice(0, 4) + '\n' + b64.slice(4);
  assert.deepStrictEqual(Array.from(b64ToBytes(wrapped)), Array.from(raw));
});

check('utf8Decode 处理多字节与代理对', () => {
  const cases = ['', 'ascii only', '中文测试', 'emoji 😀 测试', '\u0000\u007f\u0080\u07ff\u0800'];
  for (const s of cases) {
    const buf = Buffer.from(s, 'utf8');
    assert.strictEqual(utf8Decode(new Uint8Array(buf)), s, `不匹配: ${JSON.stringify(s)}`);
  }
});

check('inflate: 空输入', () => {
  // 空 deflate 流是 0x03 0x00（fixed block, end of block）
  const out = inflateRaw(new Uint8Array([0x03, 0x00]));
  assert.strictEqual(out.length, 0);
});

check('inflate: 单字节', () => {
  const raw = zlib.deflateRawSync(Buffer.from('a'));
  assert.strictEqual(Buffer.from(inflateRaw(new Uint8Array(raw))).toString(), 'a');
});

check('inflate: 高压缩比重复串', () => {
  const src = 'abcdefgh'.repeat(20000);
  const raw = zlib.deflateRawSync(Buffer.from(src));
  const out = Buffer.from(inflateRaw(new Uint8Array(raw))).toString();
  assert.strictEqual(out, src);
  assert.ok(raw.length < 1000, `压缩比异常: ${raw.length}`);
});

check('inflate: 随机字节（stored block 路径）', () => {
  const src = Buffer.alloc(70000);
  for (let i = 0; i < src.length; i++) src[i] = (i * 37 + 11) & 0xff;
  const raw = zlib.deflateRawSync(src, { level: 0 });   // level 0 -> stored block
  assert.deepStrictEqual(Buffer.from(inflateRaw(new Uint8Array(raw))), src);
});

check('inflate: 全部 256 种字节值', () => {
  const src = Buffer.alloc(256 * 100);
  for (let i = 0; i < src.length; i++) src[i] = i & 0xff;
  const raw = zlib.deflateRawSync(src);
  assert.deepStrictEqual(Buffer.from(inflateRaw(new Uint8Array(raw))), src);
});

check('inflate: 截断输入应抛错而非返回脏数据', () => {
  const raw = zlib.deflateRawSync(Buffer.from('hello world '.repeat(500)));
  const truncated = new Uint8Array(raw.subarray(0, raw.length - 5));
  let threw = false;
  try {
    inflateRaw(truncated);
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, '截断输入没有抛错');
});

console.log('\n--- 真实命令库往返 ---');

const DATA_DIR = path.join(HERE, '..', 'miniprogram', 'subpkg-tool', 'utils');
const files = fs.readdirSync(DATA_DIR).filter(f => /^cmdbook.*\.js$/.test(f) && f !== 'cmdbook.js');

check(`全部 ${files.length} 个数据文件解出与原值完全一致`, () => {
  let totalEntries = 0;
  for (const f of files) {
    const abs = path.join(DATA_DIR, f);
    delete require.cache[abs];
    const mod = require(abs);
    const name = Object.keys(mod)[0];
    const value = mod[name];
    // 重新走一遍「压缩 -> 解压」
    const json = JSON.stringify(value);
    const raw = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
    const b64 = raw.toString('base64');
    const back = unpack(b64);
    assert.deepStrictEqual(back, value, `${f} 解压后与原值不一致`);
    totalEntries += value.length;
  }
  console.log(`      共 ${totalEntries} 条`);
});

check('真实数据性能（解压 900 KB 量级）', () => {
  const abs = path.join(DATA_DIR, 'cmdbook-batch33.js');
  delete require.cache[abs];
  const value = require(abs).BATCH33_EXTRA;
  const json = JSON.stringify(value);
  const raw = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  const b64 = raw.toString('base64');
  const t0 = Date.now();
  const out = unpack(b64);
  const dt = Date.now() - t0;
  console.log(`      单文件 ${json.length} B JSON -> ${dt} ms`);
  assert.ok(dt < 500, `解压太慢: ${dt} ms`);
});

console.log('\n--- 全量数据性能 ---');
check('94 个文件全量解压耗时', () => {
  const all = [];
  for (const f of files) {
    const abs = path.join(DATA_DIR, f);
    delete require.cache[abs];
    const value = require(abs)[Object.keys(require(abs))[0]];
    all.push(...value);
  }
  const json = JSON.stringify(all);
  const raw = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  const b64 = raw.toString('base64');
  const t0 = Date.now();
  const out = unpack(b64);
  const dt = Date.now() - t0;
  console.log(`      ${all.length} 条 / ${json.length} B JSON -> ${raw.length} B deflate -> ${dt} ms`);
  assert.deepStrictEqual(out.length, all.length);
  assert.ok(dt < 3000, `全量解压太慢: ${dt} ms`);
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
