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
    recent: []
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
      recent: this.buildRecent()
    });
  },

  /* 最近三条命令 */
  buildRecent() {
    return store
      .getList('commands')
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 3)
      .map(c => ({
        _key: c._id || c._localId,
        _id: c._id || '',
        title: c.title || '(未命名命令)',
        device: c.device || '其他设备'
      }));
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

  goCommands() {
    wx.switchTab({ url: '/pages/commands/commands' });
  },

  openCmd(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.recent[idx];
    if (!item) return;
    getApp().globalData.pendingAction = { type: 'open-command', id: item._id };
    wx.switchTab({ url: '/pages/commands/commands' });
  },

  goSettings() {
    wx.navigateTo({ url: '/subpkg-mine/pages/mine-settings/mine-settings' });
  }
});
