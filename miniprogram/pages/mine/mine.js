const store = require('../../utils/store.js');
const { computeOverallLevel } = require('../../utils/skill.js');

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
    charImage: '/images/preset/char/character_01.png',
    bgImage: '/images/preset/bg/background_01.jpg',
    interests: [],
    careers: [],
    lv: { level: 1, pct: 0 },
    favCount: 0,
    missList: []
  },

  onShow() {
    store.init();
    const p = store.getProfile() || {};
    this.setData({
      nickname: p.nickname || '',
      oneLineDesc: p.oneLineDesc || '',
      stage: p.stage || '',
      org: p.org || '',
      major: p.major || '',
      charImage: store.getCharImage() || p.charImage || '/images/preset/char/character_01.png',
      bgImage: store.getCharBg() || p.bgImage || '/images/preset/bg/background_01.jpg',
      interests: splitKw(p.interests),
      careers: splitKw(p.careers),
      lv: this.buildLv(),
      favCount: store.getFavs().length,
      missList: store.getSearchMiss().slice(0, 6)
    });
    /* 这里不再问服务端「是不是作者」——
       「内容审核」入口已收敛到 设置 → 制作人 一处，本页没有管理入口，
       少一次 isadmin 云函数往返，进「我的」更快。 */
  },

  /* 总等级：命令 1 点 / 项目 8 点 / 点亮技能 5 点 / 在学技能 2 点，10000 点满级 */
  buildLv() {
    const r = computeOverallLevel(
      store.getList('commands'),
      store.getList('projects'),
      store.getList('skills')
    );
    return { level: r.level, pct: r.pct };
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
