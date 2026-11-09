const store = require('../../utils/store.js');
const { ANSWER_BOOK } = require('../../utils/seed.js');
const portrait = require('../../utils/portrait.js');
const motion = require('../../utils/motion.js');

function shortDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return p(d.getMonth() + 1) + '-' + p(d.getDate());
}

Page({
  data: {
    theme: 'light',
    /* 答案之书：只有一个内容节点，翻面靠两段动画，不做双面 DOM */
    answerText: '',
    flipPhase: '',
    flipping: false,
    liked: false,
    bursting: false,
    /* 波纹按宿主槽位存（data-r = 0..3）。motion.ripple 只做路径式
       setData，不再每次触摸覆盖整条数组；id = 0 表示该槽位空闲。 */
    ripples: [
      { id: 0, x: 0, y: 0, cls: 0 },
      { id: 0, x: 0, y: 0, cls: 0 },
      { id: 0, x: 0, y: 0, cls: 0 },
      { id: 0, x: 0, y: 0, cls: 0 }
    ],
    nickname: '',
    themePulse: false,
    /* 页头小头像：由档案里的全身立绘映射到头肩特写 */
    portraitImage: '/images/portrait/character_01.png',
    /* 最近手记 */
    recent: [],
    cmdCount: 0,
    projCount: 0
  },

  onLoad() {
    getApp().applyTheme(this);
    this.setData({ answerText: this._pick() });
  },

  onReady() {
    motion.cacheRects(this, '.ripple-host');
  },

  onShow() {
    getApp().applyTheme(this);
    store.init();
    this.refresh();
  },

  onPullDownRefresh() {
    store.pullAll().then(() => {
      this.refresh();
      wx.stopPullDownRefresh();
    }).catch(() => wx.stopPullDownRefresh());
  },

  refresh() {
    const p = store.getProfile() || {};
    const charPath = store.getCharImage() || 'character_01';
    this.setData({
      nickname: p.nickname || '',
      portraitImage: portrait.fromChar(charPath)
    });
    this.buildRecent();
  },

  /* 最近手记：命令 + 项目合并按时间倒序取 3 条，内容是真实数据 */
  buildRecent() {
    const cmds = store.getList('commands') || [];
    const projs = store.getList('projects') || [];
    const rows = cmds.map((c) => ({
      key: 'c-' + (c._id || c._localId),
      kind: '命令',
      title: c.title || '(未命名命令)',
      sub: (c.device || '其他设备') + (c.content ? ' · ' + String(c.content).split('\n')[0].slice(0, 18) : ''),
      date: shortDate(c.createdAt || c.updatedAt),
      ts: c.createdAt || c.updatedAt || 0,
      tab: 'commands'
    })).concat(projs.map((p) => ({
      key: 'p-' + (p._id || p._localId),
      kind: '项目',
      title: p.name || '(未命名项目)',
      sub: (p.status || '进行中') + (p.content ? ' · ' + String(p.content).slice(0, 18) : ''),
      date: shortDate(p.createdAt || p.updatedAt),
      ts: p.createdAt || p.updatedAt || 0,
      tab: 'projects'
    })));
    rows.sort((a, b) => b.ts - a.ts);
    this.setData({
      recent: rows.slice(0, 3),
      cmdCount: cmds.length,
      projCount: projs.length
    });
  },

  /* 首页快捷切换：太阳=浅色、月亮=深色。
     走 App.setThemeMode，会广播到所有已打开页面并写进本地存储。
     不做震动、不做位移：切换只播一次极轻的明度淡变，避免「屏幕抖一下」。 */
  onThemeSwitch(e) {
    const mode = e.currentTarget.dataset.mode;
    if (getApp().getTheme() === mode || this.data.themePulse) return;
    const next = getApp().setThemeMode(mode);
    this.setData({ theme: next, themePulse: true });
    setTimeout(() => this.setData({ themePulse: false }), 420);
  },

  _pick() {
    let i = Math.floor(Math.random() * ANSWER_BOOK.length);
    if (ANSWER_BOOK.length > 1 && i === this._answerIdx) i = (i + 1) % ANSWER_BOOK.length;
    this._answerIdx = i;
    return ANSWER_BOOK[i];
  },

  /* 卡片翻面：前半程翻出 → 中点换文本 → 后半程翻回。
     单一内容节点，任意次数点击结构都一致，不会出现第二面跑到左上角。 */
  drawAnswer() {
    if (this.data.flipping) return;
    const next = this._pick();
    this.setData({ flipping: true, flipPhase: 'out' });
    setTimeout(() => {
      this.setData({ answerText: next, flipPhase: 'in' });
      setTimeout(() => this.setData({ flipping: false, flipPhase: '' }), 270);
    }, 225);
  },

  /* 点赞炸一下：粒子节点靠 bursting 重建，保证每次点击都重新播 */
  likeAnswer() {
    const liked = !this.data.liked;
    this.setData({ liked: liked, bursting: false });
    if (!liked) return;
    setTimeout(() => this.setData({ bursting: true }), 10);
    setTimeout(() => this.setData({ bursting: false }), 720);
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
  },

  onRipple(e) { motion.ripple(this, e); },

  goRecords() {
    wx.switchTab({ url: '/pages/commands/commands' });
  },

  goTab(e) {
    const tab = e.currentTarget.dataset.tab === 'projects' ? 'projects' : 'commands';
    wx.switchTab({ url: '/pages/' + tab + '/' + tab });
  },

  goAddCmd() {
    getApp().globalData.pendingAction = { type: 'add-command' };
    wx.switchTab({ url: '/pages/commands/commands' });
  },

  goAddProj() {
    getApp().globalData.pendingAction = { type: 'add-project' };
    wx.switchTab({ url: '/pages/projects/projects' });
  },

  goSearch() {
    wx.navigateTo({ url: '/subpkg-tool/pages/search/search' });
  },

  /* 资料库：命令百科 + 配置模板库（页内顶部可切换两种内容） */
  goLibrary() {
    wx.navigateTo({ url: '/subpkg-tool/pages/browse/browse' });
  }
});
