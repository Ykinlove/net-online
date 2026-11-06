// unpack_data.js —— 把压缩形态的数据产物解回可读源码
//
// 用法：node unpack_data.js <packed.js>  （结果打到 stdout）
//
// 场景：源（data-src/*.js）被误改，而产物是正确版本时，用它把产物还原成源。
// 产物形态是 base64(deflate(JSON))，解出来是 JSON 形态的数组字面量。
// 引号风格会从单引号变成双引号（minify_js 不改字符串内部的引号），
// 数据本身完全一致，再跑一次 build_data.py build 就能让产物与源重新对齐。

const fs = require('fs');
const path = require('path');

function unpackOne(srcPath) {
  const abs = path.resolve(srcPath);
  delete require.cache[abs];
  const mod = require(abs);
  const keys = Object.keys(mod);
  if (keys.length !== 1) {
    throw new Error(`${srcPath}: 期望恰好 1 个导出，实际 ${keys.length} 个`);
  }
  const name = keys[0];
  const value = mod[name];
  if (!Array.isArray(value)) {
    throw new Error(`${srcPath}: 导出 ${name} 不是数组`);
  }
  return `const ${name} = ${JSON.stringify(value, null, 2)};\n\n` +
         `module.exports = { ${name} };\n`;
}

if (require.main === module) {
  const src = process.argv[2];
  if (!src) {
    console.error('用法: node unpack_data.js <packed.js>');
    process.exit(2);
  }
  process.stdout.write(unpackOne(src));
}

module.exports = { unpackOne };
