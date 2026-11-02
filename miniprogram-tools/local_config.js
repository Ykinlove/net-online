// miniprogram-tools/local_config.js —— 读取本地私密配置
//
// 为什么有这个文件：
//   openid 白名单、管理口令、SNMP 团体名、真实服务器 IP 这些东西
//   **不能进仓库**（仓库要推到远端，远端可能公开）。
//   仓库里只留占位符和示例模板，真实值放在项目根的 cloudbaserc.local.json
//   （已在 .gitignore 里），或用环境变量覆盖。
//
// 查找顺序：
//   1) 环境变量 LOCAL_CONFIG（指向一个 json 文件）
//   2) 环境变量 ADMIN_OPENIDS（直接给 openid 列表）
//   3) 项目根的 cloudbaserc.local.json
//
// 用法：
//   const cfg = require('./local_config.js');
//   const targets = cfg.targets();          // [{nickname, openid}, ...]
//   cfg.adminPass()                          // 管理口令（没有则 null）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

/* 找到本地私密配置文件 */
function localFile() {
  if (process.env.LOCAL_CONFIG) {
    const p = path.isAbsolute(process.env.LOCAL_CONFIG)
      ? process.env.LOCAL_CONFIG
      : path.join(ROOT, process.env.LOCAL_CONFIG);
    if (fs.existsSync(p)) return p;
  }
  const def = path.join(ROOT, 'cloudbaserc.local.json');
  return fs.existsSync(def) ? def : null;
}

let cached = null;
function local() {
  if (cached === null) {
    const f = localFile();
    cached = f ? (readJson(f) || {}) : {};
  }
  return cached;
}

/* openid 列表：逗号分隔的字符串 → 数组 */
function openidList() {
  const raw = process.env.ADMIN_OPENIDS || local().adminOpenids || '';
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

/* 目标作者列表：[{nickname, openid}]
   昵称从 local().authors 读（形如 {"Yang":"oXXX","Ykin":"oYYY"}），
   没有昵称就退回按顺序编号。 */
function targets() {
  const ids = openidList();
  const authors = local().authors || {};
  const names = Object.keys(authors);
  return ids.map((openid, i) => ({
    nickname: authors[openid] || (names[i] || ('作者' + (i + 1))),
    openid: openid
  }));
}

/* 管理口令 */
function adminPass() {
  return process.env.ADMIN_PASS || local().adminPass || null;
}

/* 敏感串清单：用于「包体内不能有凭据」这类检查。
   来自 local().secrets，形如 ["某个 SNMP 团体名", "某个真实 IP", ...]
   没有配置时返回空数组（此时该检查项自动跳过，而不是误报）。 */
function secrets() {
  const s = local().secrets;
  return Array.isArray(s) ? s : [];
}

function missingHint() {
  return [
    '未找到本地私密配置。',
    '  做法：cp cloudbaserc.local.example.json cloudbaserc.local.json 然后填上真实值。',
    '  或设置环境变量 ADMIN_OPENIDS=oXXX,oYYY'
  ].join('\n');
}

module.exports = { local, localFile, openidList, targets, adminPass, secrets, missingHint, ROOT };
