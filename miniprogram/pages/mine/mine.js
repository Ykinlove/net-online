const store = require('../../utils/store.js');
const portrait = require('../../utils/portrait.js');

function splitKw(s) {
  return String(s || '').split(/[,，、]/).map(x => x.trim()).filter(Boolean);
}

Page({
  data: {
    nickname: '',
    oneLineDesc: '',
    stage: '',
    org: '',
    major: '',
    portraitImage: '/images/portrait/character_01.png',
    bgImage: '/images/preset/bg/background_01.jpg',
    interests: [],
    careers: [],
    favCount: 0,
    skillCount: 0,
    archiveCount: 0,
    missList: []
  },

  onShow() {
    getApp().applyTheme(this);
    store.init();
    const p = store.getProfile() || {};
    const charPath = store.getCharImage() || p.charImage || '/images/preset/char/character_01.png';
    this.setData({
      nickname: p.nickname || '',
      oneLineDesc: p.oneLineDesc || '',
      stage: p.stage || '',
      org: p.org || '',
      major: p.major || '',
      portraitImage: portrait.fromChar(charPath),
      bgImage: store.getCharBg() || p.bgImage || '/images/preset/bg/background_01.jpg',
      interests: splitKw(p.interests),
      careers: splitKw(p.careers),
      favCount: store.getFavs().length,
      skillCount: store.getList('skills').length,
      archiveCount: store.getSnapshots().length,
      missList: store.getSearchMiss().slice(0, 6)
    });
    /* 这里不再问服务端「是不是作者」——
       「内容审核」入口已收敛到 设置 → 制作人 一处，本页没有管理入口，
       少一次 isadmin 云函数往返，进「我的」更快。 */
  },

  /* 资料与形象合并：都从档案页进入，形象在档案页里再往下一层 */
  editProfile() {
    wx.navigateTo({ url: '/subpkg-mine/pages/onboard/onboard' });
  },

  goSkill() {
    wx.navigateTo({ url: '/subpkg-mine/pages/mine-skill/mine-skill' });
  },

  goArchive() {
    wx.navigateTo({ url: '/subpkg-mine/pages/mine-archive/mine-archive' });
  },

  goSettings() {
    wx.navigateTo({ url: '/subpkg-mine/pages/mine-settings/mine-settings' });
  },

  goFav() {
    wx.navigateTo({ url: '/subpkg-tool/pages/fav/fav' });
  },

  /* 投稿：提交命令百科 / 配置模板的修改建议，由作者审核 */
  goContribute() {
    wx.navigateTo({ url: '/subpkg-tool/pages/contribute/contribute' });
  },

  goSearchMiss() {
    wx.navigateTo({ url: '/subpkg-tool/pages/miss/miss' });
  }
});
