const store = require('../../utils/store.js');

Page({
  data: {
    syncing: true,
    syncHint: '',
    entering: false
  },

  onLoad() {
    this.bootstrap();
  },

  async bootstrap() {
    store.init();
    // 先按本地缓存给个判断，再把云端拉下来
    const res = await store.pullAll();
    if (res && res.ok) {
      this.setData({ syncing: false, syncHint: '' });
    } else {
      this.setData({
        syncing: false,
        syncHint: store.isReady() ? (store.mem.lastError || '') : '当前未连接云开发，数据只保存在本机'
      });
    }
  },

  async enter() {
    if (this.data.entering) return;
    this.setData({ entering: true });

    /* 关键：先等云端档案拉下来再判断。
       电脑端首次打开时本地缓存是空的，如果这时直接判断，
       会被当成「新用户」强制重走一遍建档/选形象——这就是那个 BUG。
       正常情况 pullAll 早就跑完了，这里几乎立即返回。 */
    await store.waitPull(3500);

    store.init();

    if (!store.hasProfile()) {
      wx.navigateTo({ url: 'subpkg-mine/pages/onboard/onboard' });
      this.setData({ entering: false });
      return;
    }
    /* 形象/背景会从云端档案回读（store.getCharImage）。
       万一档案是早期版本、没存过 charImage，也不再拦人重选——
       用默认形象直接进首页，想换去「设置 → 我的形象」。
       判断「要不要选形象」的活儿交给建档流程（onboard → chargen?from=first）。 */
    if (!store.getCharImage()) {
      store.setCharImage('/images/preset/char/character_01.png');
      store.setCharBg('/images/preset/bg/background_01.jpg');
    }
    wx.switchTab({ url: '/pages/home/home' });
    this.setData({ entering: false });
  }
});
