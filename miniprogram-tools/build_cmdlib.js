/* build_cmdlib.js —— 生成云函数 getCmdLib 的内置整库 cmdlib.json
 *
 * 架构（与 build_data.py 同一套「源 → 产物」思路）：
 *     miniprogram/subpkg-tool/utils/cmdbook.js   构建产物（命令库真源）
 *         │  本脚本
 *         ▼
 *     cloudfunctions/getCmdLib/cmdlib.json        云函数内置种子
 *
 * 为什么需要它：
 *   cmdlib.json 有 1.58MB，是「命令库整库」的云端真相源快照。直接入库会让仓库
 *   每次改数据都多一次 1.6MB 的二进制式 diff，且极易与 cmdbook.js 漂移
 *   （cmdbook 改了、cmdlib.json 没改 → 云端发旧版数据，端侧版本号对不上，
 *   离线同步永远拉不到新内容，且这种漂移在界面上完全看不出来）。
 *
 *   所以改为：cmdlib.json 由脚本生成，**不入库**（见 .gitignore），
 *   部署前跑一次本脚本即可。CI 里 check_offline.py 会重新生成一遍并与
 *   云端已部署的版本号比对，确保「本地能生成的」与「云端在跑的」是同一份。
 *
 * 用法：
 *     node miniprogram-tools/build_cmdlib.js          # 生成 cloudfunctions/getCmdLib/cmdlib.json
 *     node miniprogram-tools/build_cmdlib.js --check  # 只校验版本号与条数，不写文件
 *
 * 版本号规则（与云函数 index.js 的 versionOf 保持一致）：
 *     version = 'c' + 条数 + '-' + sha8(JSON.stringify(entries))
 * 内容不变 → 版本号稳定 → 端侧不重复下载；
 * 数据改了 → 版本号变 → 端侧自动重拉并写本地缓存。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'cloudfunctions', 'getCmdLib');
const OUT = path.join(OUT_DIR, 'cmdlib.json');

/* cmdbook.js 依赖 wx.cloud 走练习题异步加载；node 环境下练习题拿不到，
   BOOK 仍是内置的 1216 条 —— 这正是我们要的快照内容。
   但 require 链上若有 wx.* 调用，需给最小桩，否则加载即崩。 */
if (typeof global.wx === 'undefined') {
  global.wx = {
    getStorageSync: () => '',
    setStorageSync: () => {},
    cloud: {
      callFunction: (o) => { if (o && o.fail) o.fail({}); }
    }
  };
}

const cmdbook = require(path.join(ROOT, 'miniprogram', 'subpkg-tool', 'utils', 'cmdbook.js'));
const entries = cmdbook.BOOK;

if (!Array.isArray(entries) || !entries.length) {
  console.error('✗ cmdbook.BOOK 为空，无法生成 cmdlib.json');
  process.exit(1);
}

/* JSON.stringify 的分隔符与顺序必须与云端一致 —— 版本号就是它的 sha8。
   云函数读文件后 JSON.parse 再 JSON.stringify，中间无往返，故此处直接
   stringify(BOOK) 即可字节级对上。 */
const payload = JSON.stringify(entries);
const sha8 = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8);
const version = 'c' + entries.length + '-' + sha8;

const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  console.log('命令库条数：%d', entries.length);
  console.log('版本号：%s', version);
  console.log('字节数：%d', Buffer.byteLength(payload));
  process.exit(0);
}

if (!fs.existsSync(OUT_DIR)) {
  console.error('✗ 找不到输出目录：%s', OUT_DIR);
  process.exit(1);
}

fs.writeFileSync(OUT, payload, 'utf8');

console.log('已生成 %s', path.relative(ROOT, OUT).replace(/\\/g, '/'));
console.log('  条数 %d  字节 %d  版本 %s', entries.length, Buffer.byteLength(payload), version);
