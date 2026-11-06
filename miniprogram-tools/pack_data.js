// pack_data.js —— 把数据产物压成「base64(deflate(JSON))」
//
// 用法：node pack_data.js <src.js> <dst.js>
//
// 为什么需要它：
//   微信开发者工具「代码质量」要求每个包（含分包）编译后 < 1.5 MB。
//   命令库原始形态打进包里会让 subpkg-tool 顶到 2.5 MB 以上，
//   而运行时又没有 zlib。所以构建时用 deflate 压一遍，运行时用
//   utils/decompress.js 解回来。
//
// 产物形态：
//   const {unpack}=require('./decompress.js');const NAME=unpack('....');module.exports={NAME};
//   —— 导出名与形状跟压缩前完全一致，调用方（cmdbook.js）一行都不用改。
//
// 关键：用 node 引擎直接 require 求值，而不是用正则去啃 JS 字面量。
// 数据里有大量单引号、双引号、换行转义，正则解析必然出错。

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/** 与 build_data.py 侧保持一致的缓存键算法 */
function hashOf(content) {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex').slice(0, 16);
}

function pack(srcPath, dstPath) {
  const abs = path.resolve(srcPath);
  delete require.cache[abs];
  const mod = require(abs);
  const keys = Object.keys(mod);
  if (keys.length !== 1) {
    throw new Error(`${srcPath}: 期望恰好 1 个导出，实际 ${keys.length} 个 (${keys.join(',')})`);
  }
  const name = keys[0];
  const value = mod[name];
  if (!Array.isArray(value)) {
    throw new Error(`${srcPath}: 导出 ${name} 不是数组，是 ${typeof value}`);
  }
  const json = JSON.stringify(value);
  const raw = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  const b64 = raw.toString('base64');
  const out =
    `const {unpack}=require('./decompress.js');` +
    `const ${name}=unpack('${b64}');` +
    `module.exports={${name}};`;
  fs.writeFileSync(dstPath, out, 'utf8');
  return {
    name,
    entries: value.length,
    jsonBytes: Buffer.byteLength(json, 'utf8'),
    deflateBytes: raw.length,
    b64Bytes: Buffer.byteLength(b64, 'utf8'),
    outBytes: Buffer.byteLength(out, 'utf8'),
  };
}

/**
 * 批量模式：node pack_data.js --batch <stageDir> <outDir>
 *
 * stageDir 里是 minify 后的纯数据文件，outDir 里按 <sha1>.js 落盘。
 * 同时把 minify 后的原文存成 <sha1>.min.js —— build_data.py 的 restore
 * 靠它把源回灌成「再 minify 一次结果不变」的形态，避免格式来回漂移。
 */
function packBatch(stageDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const names = fs.readdirSync(stageDir).filter(f => f.endsWith('.js')).sort();
  let totalJson = 0;
  let totalDeflate = 0;
  let totalOut = 0;
  for (const f of names) {
    const src = path.join(stageDir, f);
    const content = fs.readFileSync(src, 'utf8');
    const h = hashOf(content);
    const r = pack(src, path.join(outDir, h + '.js'));
    fs.writeFileSync(path.join(outDir, h + '.min.js'), content, 'utf8');
    totalJson += r.jsonBytes;
    totalDeflate += r.deflateBytes;
    totalOut += r.outBytes;
  }
  console.log(
    `打包 ${names.length} 个文件：JSON ${totalJson} -> deflate ${totalDeflate} -> 产物 ${totalOut} ` +
    `(节省 ${(100 - totalOut * 100 / totalJson).toFixed(1)}%)`
  );
}

/**
 * 合并模式：node pack_data.js --merge <stageDir> <outDir>
 *
 * stageDir 里是 minify 后的纯数据文件（每个导出恰好一个数组）。
 * 把所有文件的导出合并成一个大对象，整体 deflate 一次，再 base64。
 *
 * 为什么要合并而不是每个文件各压一次：
 *   deflate 的 LZ77 窗口是 32 KB。95 个文件各自压缩时窗口永远用不满，
 *   跨文件的重复内容（命令前缀、厂商名、句式）匹配不到，压缩率从 71% 掉到 58%。
 *   合并后 deflate 能看到全量重复，整体省下约 176 KB —— 这直接决定分包能不能过 1.5 MB。
 *
 * 运行时只需解压一次（模块缓存），比分散解压还快。
 *
 * 产物形态：
 *   cmdbook-data.js   —— 压缩数据包，导出 {批次名: 数组}
 *   shell-<name>.js   —— 薄壳，从数据包里取出自己那一份，导出名与压缩前一致
 *                        （调用方 cmdbook.js 的一行 require 都不用改）
 */
function packMerge(stageDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const names = fs.readdirSync(stageDir).filter(f => f.endsWith('.js')).sort();
  const merged = {};
  const shells = [];
  for (const f of names) {
    const src = path.join(stageDir, f);
    const mod = require(path.resolve(src));
    const keys = Object.keys(mod);
    if (keys.length !== 1) {
      throw new Error(`${f}: 期望恰好 1 个导出，实际 ${keys.length} 个 (${keys.join(',')})`);
    }
    const key = keys[0];
    if (!Array.isArray(mod[key])) {
      throw new Error(`${f}: 导出 ${key} 不是数组`);
    }
    if (merged[key]) {
      throw new Error(`${f}: 导出名 ${key} 与其它文件重名`);
    }
    merged[key] = mod[key];
    shells.push({ file: f, key });
  }

  const json = JSON.stringify(merged);
  const raw = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  const b64 = raw.toString('base64');

  // 分段拼接：每段 8 KB，用 '+' 连接。
  // 开发者工具编译时会把 AST 重新打印，实测单行 1.7 KB 的字符串不会被换行；
  // 但 875 KB 的单行字面量一旦被按行宽折行，体积会炸成好几倍。
  // 分段后即使每段都被折成百来行，膨胀也只有 1% 量级。
  // 同时不影响 minify —— 压缩器会把相邻字面量重新合并成一个。
  const SEG = 8192;
  const segs = [];
  for (let i = 0; i < b64.length; i += SEG) segs.push(b64.slice(i, i + SEG));
  const joined = segs.map(s => `'${s}'`).join('+');

  const dataFile =
    `const {unpack}=require('./decompress.js');` +
    `module.exports=unpack(${joined});`;
  fs.writeFileSync(path.join(outDir, 'cmdbook-data.js'), dataFile, 'utf8');

  for (const s of shells) {
    const shell =
      `const D=require('./cmdbook-data.js');` +
      `module.exports={${s.key}:D.${s.key}};`;
    fs.writeFileSync(path.join(outDir, 'shell-' + s.file), shell, 'utf8');
  }

  console.log(
    `合并 ${names.length} 个文件：JSON ${json.length} -> deflate ${raw.length} -> ` +
    `base64 ${b64.length}，数据包 ${dataFile.length} 字节 + ${shells.length} 个薄壳`
  );
  return { jsonBytes: json.length, deflateBytes: raw.length, b64Bytes: b64.length };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--batch') {
    packBatch(args[1], args[2]);
  } else if (args[0] === '--merge') {
    packMerge(args[1], args[2]);
  } else {
    const [, , src, dst] = process.argv;
    if (!src || !dst) {
      console.error(
        '用法: node pack_data.js <src.js> <dst.js>  |  --batch <stageDir> <outDir>  |  --merge <stageDir> <outDir>'
      );
      process.exit(2);
    }
    const r = pack(src, dst);
    console.log(
      `${path.basename(dst)}  ${r.name}  ${r.entries} 条  ` +
      `JSON ${r.jsonBytes} -> deflate ${r.deflateBytes} -> b64 ${r.b64Bytes} -> 产物 ${r.outBytes}`
    );
  }
}

module.exports = { pack, packBatch, packMerge, hashOf };
