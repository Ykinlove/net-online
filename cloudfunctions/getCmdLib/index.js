// 云函数 getCmdLib —— 命令库「云端真相源」的读取入口
//
// 设计要点（与小程序端 Offline First 配合）：
//   - 整库 1.58MB，超过 callFunction 约 1MB 回包上限，所以不把正文塞进回包；
//   - mode:'manifest' 只回极小元信息 {version, count, cloudPath}，用于端侧判断是否需要更新；
//   - mode:'full' 才把函数自带的 cmdlib.json 上传到云存储，返回 fileID/cloudPath，
//     端侧再用 wx.cloud.downloadFile 拉大文件。回包只剩 fileID，不触上限；
//   - mode:'delta' 当前以整库文件为来源（无逐条 updatedAt），版本不变回空、否则回退整库。
//
// 版本号 = 'c' + 条数 + '-' + 内容 sha8：内容没变 → 版本号稳定 → 端侧不重复下载；
// 作者改了 cmdlib.json 并重新部署 → 版本号变化 → 端侧自动重新拉取并写本地缓存。
//
// 部署：把本目录整体上传为名为 getCmdLib 的云函数（含 cmdlib.json）。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = cloud.database();

const STORAGE_PATH = 'cmdlib/cmdlib.json';
const COLL = 'cmdlib';
const DOC_ID = 'main';

function sha8(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8);
}

function localLib() {
  const p = path.join(__dirname, 'cmdlib.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function versionOf(arr) {
  return 'c' + arr.length + '-' + sha8(JSON.stringify(arr));
}

exports.main = async (event) => {
  const mode = (event && event.mode) || 'manifest';

  let arr;
  try {
    arr = localLib();
  } catch (e) {
    return { ok: false, error: 'no_local_lib' };
  }
  const version = versionOf(arr);

  if (mode === 'manifest') {
    return { ok: true, version: version, count: arr.length, cloudPath: STORAGE_PATH };
  }

  if (mode === 'delta') {
    // 无逐条时间戳，版本相同即无变化，否则回退整库
    if (event && event.since === version) return { ok: true, version: version, entries: [] };
    return exports.main({ mode: 'full' });
  }

  if (mode === 'full') {
    // 已上传过且版本一致：直接复用存储地址，避免重复上传
    try {
      const doc = await db.collection(COLL).doc(DOC_ID).get();
      if (doc && doc.version === version && doc.fileID) {
        return {
          ok: true, version: version, fileID: doc.fileID,
          cloudPath: doc.cloudPath || STORAGE_PATH, count: arr.length
        };
      }
    } catch (e) { /* 首次无记录，继续上传 */ }

    // 上传整库到云存储
    const tmp = path.join('/tmp', 'cmdlib.json');
    const payload = JSON.stringify(arr);
    fs.writeFileSync(tmp, payload);
    const up = await cloud.uploadFile({ cloudPath: STORAGE_PATH, fileContent: fs.readFileSync(tmp) });
    const fileID = up.fileID;

    // 记录版本 + fileID，供后续调用复用
    try {
      await db.collection(COLL).doc(DOC_ID).set({
        data: {
          version: version,
          fileID: fileID,
          cloudPath: STORAGE_PATH,
          count: arr.length,
          updatedAt: Date.now()
        }
      });
    } catch (e) { /* 记录失败不影响本次返回 */ }

    return { ok: true, version: version, fileID: fileID, cloudPath: STORAGE_PATH, count: arr.length };
  }

  return { ok: false, error: 'unknown_mode' };
};
