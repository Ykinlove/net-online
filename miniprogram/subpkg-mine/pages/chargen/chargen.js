const store = require('../../../utils/store.js');
const admin = require('../../utils/admin.js');
const { PRESET_CHARS, PRESET_BGS } = require('../../../utils/seed.js');
const { REWARDED_AD_UNIT, FREE_CHARS, FREE_BGS, ENABLE_LOCKS } = require('../../utils/config.js');
const portrait = require('../../../utils/portrait.js');

const DEFAULT_CHAR = PRESET_CHARS[0];
const DEFAULT_BG = PRESET_BGS[0];

Page({
  data: {
    chars: [],
    bgs: [],
    pickChar: DEFAULT_CHAR,
    pickBg: DEFAULT_BG,
    /* v4：预览区插画路径，随选中项实时更新 */
    charImage: portrait.charPath(DEFAULT_CHAR),
    bgImage: portrait.bgPath(DEFAULT_BG),
    nickname: '',
    from: '',
    adReady: !!REWARDED_AD_UNIT
  },

  onLoad(options) {
    getApp().applyTheme(this);
    store.init();
    const p = store.getProfile() || {};
    /* 兼容三种存档形态：纯 ID（当前）、旧路径（/images/preset/char/x.png）、新路径 */
    const savedChar = portrait.idOf(store.getCharImage());
    const savedBg = portrait.idOf(store.getCharBg());
    /* 老档案可能存着已被移出列表的形象/背景，归一化到默认，避免「一个都没选中」 */
    this.setData({
      nickname: p.nickname || '',
      pickChar: PRESET_CHARS.indexOf(savedChar) >= 0 ? savedChar : DEFAULT_CHAR,
      pickBg: PRESET_BGS.indexOf(savedBg) >= 0 ? savedBg : DEFAULT_BG,
      from: (options && options.from) || ''
    });
    this.build();

    /* 作者（Ykin / Yang 等在 ADMIN_OPENIDS 白名单内）豁免解锁：
       首次进入时 isAdmin 缓存可能还没 refresh，异步问一次服务端后重算，
       避免作者第一眼看到锁。普通用户不受影响。 */
    admin.refresh().then(() => this.build());
  },

  /* 重算每个格子的「是否上锁 / 是否选中」 */
  build() {
    const u = store.getUnlocks();
    const lockOn = ENABLE_LOCKS && !admin.isAdmin();
    const pickChar = this.data.pickChar;
    const pickBg = this.data.pickBg;

    const chars = PRESET_CHARS.map((id, i) => ({
      id,
      locked: lockOn && i >= FREE_CHARS && id !== pickChar && u.char.indexOf(id) < 0,
      on: id === pickChar
    }));
    const bgs = PRESET_BGS.map((id, i) => ({
      id,
      locked: lockOn && i >= FREE_BGS && id !== pickBg && u.bg.indexOf(id) < 0,
      on: id === pickBg
    }));

    this.setData({
      chars,
      bgs,
      charImage: portrait.charPath(pickChar),
      bgImage: portrait.bgPath(pickBg)
    });
  },

  pickCharFn(e) {
    const id = e.currentTarget.dataset.v;
    const item = this.data.chars.filter(c => c.id === id)[0];
    if (!item) return;
    if (item.locked) return this.startAd('char', id);
    this.setData({ pickChar: id }, () => this.build());
  },

  pickBgFn(e) {
    const id = e.currentTarget.dataset.v;
    const item = this.data.bgs.filter(b => b.id === id)[0];
    if (!item) return;
    if (item.locked) return this.startAd('bg', id);
    this.setData({ pickBg: id }, () => this.build());
  },

  /* ---------- 激励视频 ---------- */
  ensureAd() {
    if (!REWARDED_AD_UNIT || !wx.createRewardedVideoAd) return null;
    if (!this._ad) {
      this._ad = wx.createRewardedVideoAd({ adUnitId: REWARDED_AD_UNIT });
      this._ad.onError(() => { this._adErr = true; });
      this._ad.onClose(res => {
        const pending = this._pending;
        this._pending = null;
        if (!pending) return;
        if (res && res.isEnded) {
          this.doUnlock(pending.kind, pending.id);
        } else {
          wx.showToast({ title: '看完广告才能解锁', icon: 'none' });
        }
      });
    }
    return this._ad;
  },

  startAd(kind, id) {
    const label = kind === 'char' ? '形象' : '背景';
    if (!this.data.adReady) {
      wx.showModal({
        title: '暂未开放',
        content: '这个' + label + '需要看一段广告才能解锁。解锁功能正在开发中，敬请期待。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    wx.showModal({
      title: '解锁这个' + label,
      content: '看一段激励视频，就能永久解锁。',
      confirmText: '去看',
      success: r => {
        if (!r.confirm) return;
        const ad = this.ensureAd();
        if (!ad) {
          wx.showToast({ title: '广告暂不可用', icon: 'none' });
          return;
        }
        this._pending = { kind, id };
        ad.show().catch(() => {
          ad.load()
            .then(() => ad.show())
            .catch(() => {
              this._pending = null;
              wx.showToast({ title: '广告加载失败，稍后再试', icon: 'none' });
            });
        });
      }
    });
  },

  async doUnlock(kind, id) {
    await store.addUnlock(kind, id);
    if (kind === 'char') this.setData({ pickChar: id });
    else this.setData({ pickBg: id });
    this.build();
    wx.showToast({ title: '已解锁', icon: 'success' });
  },

  /* ---------- 保存 ---------- */
  async confirm() {
    /* 存档存 ID 而不是路径：立绘在分包里，路径会随分包布局变 */
    const charId = this.data.pickChar;
    const bgId = this.data.pickBg;
    store.setCharImage(charId);
    store.setCharBg(bgId);

    const p = store.getProfile();
    if (p && p.nickname) {
      await store.saveProfile(Object.assign({}, p, { charImage: charId, bgImage: bgId }));
    }

    if (this.data.from === 'first') {
      wx.switchTab({ url: '/pages/home/home' });
    } else {
      wx.navigateBack({ delta: 1 });
    }
  }
});
