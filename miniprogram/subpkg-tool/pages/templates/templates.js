// pages/templates/templates.js —— 旧「配置模板」页，已合并进「资料库」页（browse）
//
// 为什么要留这个壳：模板页的历史分享链接、收藏里的跳转都可能还指向这个路径，
// 直接删掉会让旧链接点进来报「页面不存在」。
// 这里改成进来就重定向到资料库页并带上 kind=tpl，用户看到的仍是模板列表，
// 只是换了个统一入口。
//
// 真正的模板浏览逻辑在 browse 页（顶部切到「配置模板库」那一档）。
Page({
  onLoad() {
    getApp().applyTheme(this);
    wx.redirectTo({
      url: '/subpkg-tool/pages/browse/browse?kind=tpl'
    });
  }
});
