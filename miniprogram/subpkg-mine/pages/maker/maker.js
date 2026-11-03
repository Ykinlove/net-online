// pages/maker/maker.js —— 制作人页（设置 → 关于 → 制作人 进入）
//
// 这里只放「作者/管理员专属」的东西：
//   内容审核 —— 管理命令百科与配置模板库，审核其他用户提交的投稿。
//
// 「贡献内容」（投稿）已移到「我的」页，对所有用户开放（谁都能投稿）。
// 管理入口对普通用户整体隐藏，避免误以为这个入口是自己审稿用的。
const admin = require('../../../utils/admin.js');

Page({
  data: {
    isAdmin: false
  },

  onShow() {
    this.setData({ isAdmin: admin.isAdmin() });
    admin.refresh().then(ok => {
      if (ok !== this.data.isAdmin) this.setData({ isAdmin: ok });
    });
  },

  goAdmin() {
    wx.navigateTo({ url: 'subpkg-tool/pages/admin/admin' });
  }
});
