// pages/maker/maker.js —— 制作人页（设置 → 关于 → 制作人 进入）
//
// 内容管理（作者发布云端热更新）与贡献内容（用户投稿）统一收口在此，
// 不在「我的」页直接暴露，避免普通用户误触。
Page({
  goAdmin() {
    wx.navigateTo({ url: '/subpkg-tool/pages/admin/admin' });
  },
  goContribute() {
    wx.navigateTo({ url: '/subpkg-tool/pages/contribute/contribute' });
  }
});
