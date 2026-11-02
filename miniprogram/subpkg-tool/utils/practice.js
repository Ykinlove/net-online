// utils/practice.js —— 练习题库远程加载
// 原 cmdbook-practice.js（326KB）已从分包移除，改为运行时从 CloudBase 存储拉取，
// 以把 subpkg-tool 体积压到 2MB 限制内（Genie BaaS / miniprogram-ci 上传通道不做压缩，
// 原分包会被打超 -> 微信 errcode 80200）。页面无需改动，cmdbook.js 内部在原数据加载完成后就地重建 BOOK。

let _practice = [];
let _promise = null;

function loadPractice() {
  if (_promise) return _promise;
  _promise = new Promise((resolve) => {
    if (!wx.cloud || typeof wx.cloud.downloadFile !== 'function') {
      resolve(_practice);
      return;
    }
    wx.cloud.downloadFile({
      cloudPath: 'cmdbook/cmdbook-practice.json',
      success(res) {
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: res.tempFilePath,
          encoding: 'utf8',
          success(r) {
            try {
              const obj = JSON.parse(r.data);
              _practice = obj && obj.PRACTICE ? obj.PRACTICE : [];
            } catch (e) {
              _practice = [];
            }
            resolve(_practice);
          },
          fail() {
            resolve(_practice);
          }
        });
      },
      fail() {
        resolve(_practice);
      }
    });
  });
  return _promise;
}

module.exports = {
  loadPractice,
  getPractice: () => _practice
};
