// utils/decompress.js —— 数据包解压（base64 -> raw deflate -> UTF-8 -> JSON）
//
// 为什么需要它：
//   微信开发者工具「代码质量」有一条硬规则 —— 主包与每个分包的编译后体积都必须
//   小于 1.5 MB。命令库的原始形态（JSON 化后约 889 KB）打进包里，再叠加编译
//   转义膨胀，会把 subpkg-tool 顶到 2.5 MB 以上。
//
//   微信运行时没有 zlib，但 deflate 的解码器本身不大（几百行），
//   于是「构建时压缩 + 运行时解压」就能把命令库压进配额里。
//
// 为什么不用 gzip 而是 raw deflate：
//   gzip 只是 deflate 外面套了 10 字节头 + 8 字节尾，raw deflate 少一次
//   头尾解析，构建端用 zlib.deflateRawSync 即可，运行端也更简单。
//
// base64 为什么要多这一步：
//   压缩结果是二进制，而 JS 源码文件里只能放字符串。二进制转字符串有两条路：
//     · base64   —— 6 bit/字符，膨胀 33%，字符集全在可打印 ASCII，源码友好
//     · latin1   —— 每个字节映射成一个 charCode，但源码是 UTF-8，
//                    0x80-0xFF 的字符要占 2 字节，实际膨胀 50%，还不可读
//   base64 更省，且不会让源码里出现一堆控制字符。
//
// 运行环境：纯 ES5 语法，无任何平台依赖，node 与小程序都能跑（便于 CI 往返测试）。

var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/* ------------------------------------------------------------------ base64 */

/**
 * base64 -> Uint8Array。不用 atob / wx.base64ToArrayBuffer，
 * 这样 node 与小程序共用同一份实现，CI 能做往返验证。
 */
function b64ToBytes(s) {
  // 去掉换行（源码里长字符串会按行拼接）
  var str = String(s).replace(/[\s]/g, '');
  var len = str.length;
  // 每 4 个字符解出 3 字节；末尾 '=' 是填充
  var pad = 0;
  if (str.charAt(len - 1) === '=') pad++;
  if (str.charAt(len - 2) === '=') pad++;
  var outLen = (len / 4) * 3 - pad;
  var out = new Uint8Array(outLen);
  var o = 0;
  var i = 0;
  while (i < len) {
    var c0 = B64_CHARS.indexOf(str.charAt(i));
    var c1 = B64_CHARS.indexOf(str.charAt(i + 1));
    var c2 = str.charAt(i + 2) === '=' ? 0 : B64_CHARS.indexOf(str.charAt(i + 2));
    var c3 = str.charAt(i + 3) === '=' ? 0 : B64_CHARS.indexOf(str.charAt(i + 3));
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) throw new Error('decompress: bad base64');
    var n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (o < outLen) out[o++] = (n >> 16) & 0xff;
    if (o < outLen) out[o++] = (n >> 8) & 0xff;
    if (o < outLen) out[o++] = n & 0xff;
    i += 4;
  }
  return out;
}

/* ----------------------------------------------------------------- inflate */

var MAX_BITS = 15;
var LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258
];
var LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
];
var DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577
];
var DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
];
var CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/**
 * 构建规范 Huffman 解码表（counts + symbols，canonical 顺序）。
 * 与 zlib 的 puff 参考实现同构 —— 短小且已被无数实现验证过。
 */
function buildHuffman(lengths, n) {
  var count = new Int32Array(MAX_BITS + 1);
  var i;
  for (i = 0; i < n; i++) count[lengths[i]]++;
  count[0] = 0;
  var offs = new Int32Array(MAX_BITS + 2);
  for (i = 1; i <= MAX_BITS; i++) offs[i + 1] = offs[i] + count[i];
  var symbols = new Int32Array(n);
  for (i = 0; i < n; i++) {
    if (lengths[i]) symbols[offs[lengths[i]]++] = i;
  }
  return { count: count, symbols: symbols };
}

var FIXED_LIT = null;
var FIXED_DIST = null;

function fixedTables() {
  if (FIXED_LIT) return;
  var l = new Uint8Array(288);
  var i;
  for (i = 0; i < 144; i++) l[i] = 8;
  for (i = 144; i < 256; i++) l[i] = 9;
  for (i = 256; i < 280; i++) l[i] = 7;
  for (i = 280; i < 288; i++) l[i] = 8;
  FIXED_LIT = buildHuffman(l, 288);
  var d = new Uint8Array(30);
  for (i = 0; i < 30; i++) d[i] = 5;
  FIXED_DIST = buildHuffman(d, 30);
}

/**
 * raw deflate 解压。
 * 逐 bit 读（LSB first），Huffman 用 canonical 计数法解码 —— 逻辑短、易验证，
 * 代价是比查表法慢一些。对 900 KB 量级的命令库，实测量级在百毫秒内。
 */
function inflateRaw(src) {
  var pos = 0;
  var bitbuf = 0;
  var bitcnt = 0;
  var out = new Uint8Array(Math.max(1024, src.length * 4));
  var outlen = 0;

  function grow(need) {
    if (need <= out.length) return;
    var cap = out.length;
    while (cap < need) cap *= 2;
    var next = new Uint8Array(cap);
    next.set(out);
    out = next;
  }

  function needBits(n) {
    while (bitcnt < n) {
      if (pos >= src.length) throw new Error('decompress: inflate input truncated');
      bitbuf |= src[pos++] << bitcnt;
      bitcnt += 8;
    }
  }

  function getBits(n) {
    if (n === 0) return 0;
    needBits(n);
    var v = bitbuf & ((1 << n) - 1);
    bitbuf >>>= n;
    bitcnt -= n;
    return v;
  }

  function decode(h) {
    var code = 0;
    var first = 0;
    var index = 0;
    for (var len = 1; len <= MAX_BITS; len++) {
      code |= getBits(1);
      var count = h.count[len];
      if (code - first < count) return h.symbols[index + (code - first)];
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('decompress: invalid huffman code');
  }

  function readDynamicTables() {
    var hlit = getBits(5) + 257;
    var hdist = getBits(5) + 1;
    var hclen = getBits(4) + 4;
    var clen = new Uint8Array(19);
    var i;
    for (i = 0; i < hclen; i++) clen[CLEN_ORDER[i]] = getBits(3);
    var clTree = buildHuffman(clen, 19);

    var lengths = new Uint8Array(hlit + hdist);
    var n = 0;
    while (n < hlit + hdist) {
      var sym = decode(clTree);
      if (sym < 16) {
        lengths[n++] = sym;
      } else if (sym === 16) {
        if (n === 0) throw new Error('decompress: repeat with no previous length');
        var prev = lengths[n - 1];
        var rep = 3 + getBits(2);
        while (rep--) lengths[n++] = prev;
      } else if (sym === 17) {
        var rep17 = 3 + getBits(3);
        while (rep17--) lengths[n++] = 0;
      } else {
        var rep18 = 11 + getBits(7);
        while (rep18--) lengths[n++] = 0;
      }
    }
    if (n !== hlit + hdist) throw new Error('decompress: code length overflow');

    var litLen = new Uint8Array(hlit);
    for (i = 0; i < hlit; i++) litLen[i] = lengths[i];
    var distLen = new Uint8Array(hdist);
    for (i = 0; i < hdist; i++) distLen[i] = lengths[hlit + i];
    return {
      lit: buildHuffman(litLen, hlit),
      dist: buildHuffman(distLen, hdist)
    };
  }

  for (;;) {
    var last = getBits(1);
    var type = getBits(2);
    if (type === 0) {
      // 存储块：先对齐到字节边界
      bitbuf = 0;
      bitcnt = 0;
      if (pos + 4 > src.length) throw new Error('decompress: stored block truncated');
      var len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error('decompress: stored block truncated');
      grow(outlen + len);
      out.set(src.subarray(pos, pos + len), outlen);
      outlen += len;
      pos += len;
    } else {
      var litH;
      var distH;
      if (type === 1) {
        fixedTables();
        litH = FIXED_LIT;
        distH = FIXED_DIST;
      } else if (type === 2) {
        var t = readDynamicTables();
        litH = t.lit;
        distH = t.dist;
      } else {
        throw new Error('decompress: invalid block type');
      }
      for (;;) {
        var sym = decode(litH);
        if (sym < 256) {
          grow(outlen + 1);
          out[outlen++] = sym;
        } else if (sym === 256) {
          break;
        } else {
          sym -= 257;
          if (sym >= 29) throw new Error('decompress: invalid length code');
          var length = LENGTH_BASE[sym] + getBits(LENGTH_EXTRA[sym]);
          var dsym = decode(distH);
          if (dsym >= 30) throw new Error('decompress: invalid distance code');
          var distance = DIST_BASE[dsym] + getBits(DIST_EXTRA[dsym]);
          if (distance > outlen) throw new Error('decompress: distance too far back');
          grow(outlen + length);
          var from = outlen - distance;
          for (var k = 0; k < length; k++) out[outlen++] = out[from + k];
        }
      }
    }
    if (last) break;
  }
  return out.subarray(0, outlen);
}

/* ------------------------------------------------------------------- utf-8 */

/**
 * UTF-8 字节 -> JS 字符串。
 * 小程序运行时不一定有 TextDecoder，所以自带一份（含代理对处理）。
 */
function utf8Decode(bytes) {
  var n = bytes.length;
  // 常见情况：全 ASCII，直接走快路径
  var ascii = true;
  for (var i = 0; i < n; i++) {
    if (bytes[i] >= 0x80) { ascii = false; break; }
  }
  if (ascii) {
    var s = '';
    var CHUNK = 4096;
    for (var k = 0; k < n; k += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.subarray(k, Math.min(k + CHUNK, n)));
    }
    return s;
  }
  var out = '';
  var j = 0;
  while (j < n) {
    var b = bytes[j];
    var cp;
    if (b < 0x80) {
      cp = b;
      j += 1;
    } else if ((b & 0xe0) === 0xc0) {
      cp = ((b & 0x1f) << 6) | (bytes[j + 1] & 0x3f);
      j += 2;
    } else if ((b & 0xf0) === 0xe0) {
      cp = ((b & 0x0f) << 12) | ((bytes[j + 1] & 0x3f) << 6) | (bytes[j + 2] & 0x3f);
      j += 3;
    } else {
      cp = ((b & 0x07) << 18) | ((bytes[j + 1] & 0x3f) << 12) |
           ((bytes[j + 2] & 0x3f) << 6) | (bytes[j + 3] & 0x3f);
      j += 4;
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return out;
}

/* ------------------------------------------------------------------- 入口 */

/**
 * base64 压缩串 -> 原始对象（走一遍 base64 -> deflate -> utf8 -> JSON.parse）
 */
function unpack(b64) {
  return JSON.parse(utf8Decode(inflateRaw(b64ToBytes(b64))));
}

module.exports = {
  unpack: unpack,
  b64ToBytes: b64ToBytes,
  inflateRaw: inflateRaw,
  utf8Decode: utf8Decode
};
