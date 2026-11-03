const store = require('../../../utils/store.js');
const { STAGES, STAGE_LEGACY } = require('../../../utils/seed.js');

const KW_MAX = 8;

// 昵称输入框的随机提示，每次进来换一个
const NICK_HINTS = [
  '给自己起个名字',
  '比如：机房守夜人',
  '比如：会发光的网线',
  '比如：VLAN 巫师',
  '比如：凌晨三点的网工',
  '比如：光模块搬运工',
  '比如：Rack 里的猫',
  '比如：插拔大师',
  '比如：环路终结者',
  '比如：display 侠'
];

function parseList(str) {
  if (!str) return [];
  return String(str)
    .split(/[,，、\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, KW_MAX);
}

Page({
  data: {
    stages: STAGES,
    stageIdx: 0,
    editing: false,
    nickPh: NICK_HINTS[0],
    form: { nickname: '', org: '', major: '', stage: '', oneLineDesc: '' },
    interests: [],
    careers: [],
    kwInput: { interests: '', careers: '' }
  },

  onLoad() {
    store.init();
    this.setData({ nickPh: NICK_HINTS[Math.floor(Math.random() * NICK_HINTS.length)] });
    const p = store.getProfile();
    if (p && p.nickname) {
      // 旧档案里的「入职N年」统一映射成新的有趣称呼
      const stage = STAGE_LEGACY[p.stage] || p.stage || '';
      this.setData({
        editing: true,
        form: {
          nickname: p.nickname || '',
          org: p.org || '',
          major: p.major || '',
          stage,
          oneLineDesc: p.oneLineDesc || ''
        },
        stageIdx: Math.max(0, STAGES.indexOf(stage)),
        interests: parseList(p.interests),
        careers: parseList(p.careers)
      });
    }
  },

  onInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  onStage(e) {
    const i = Number(e.detail.value) || 0;
    this.setData({ stageIdx: i, 'form.stage': STAGES[i] });
  },

  onKwInput(e) {
    const kind = e.currentTarget.dataset.kind;
    this.setData({ ['kwInput.' + kind]: e.detail.value });
  },

  addKw(e) {
    const kind = e.currentTarget.dataset.kind;
    const raw = (this.data.kwInput[kind] || '').trim();
    if (!raw) return;
    const list = (this.data[kind] || []).slice();
    raw.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean).forEach(w => {
      if (list.length >= KW_MAX) return;
      if (list.indexOf(w) < 0) list.push(w);
    });
    this.setData({ [kind]: list, ['kwInput.' + kind]: '' });
  },

  removeKw(e) {
    const { kind, idx } = e.currentTarget.dataset;
    const list = (this.data[kind] || []).slice();
    list.splice(Number(idx), 1);
    this.setData({ [kind]: list });
  },

  async submit() {
    const f = this.data.form;
    const nickname = (f.nickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '昵称是必填的哦', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中', mask: true });
    const old = store.getProfile() || {};
    const payload = {
      nickname,
      org: (f.org || '').trim(),
      major: (f.major || '').trim(),
      stage: f.stage || '',
      oneLineDesc: (f.oneLineDesc || '').trim(),
      interests: this.data.interests.join('，'),
      careers: this.data.careers.join('，'),
      exp: old.exp || 0,
      charImage: old.charImage || store.getCharImage() || '',
      bgImage: old.bgImage || store.getCharBg() || ''
    };
    await store.saveProfile(payload);
    wx.hideLoading();

    if (store.mem.lastError) {
      wx.showToast({ title: '已存本机，云端同步失败', icon: 'none', duration: 2200 });
    }

    if (this.data.editing) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    if (!store.getCharImage()) {
      wx.redirectTo({ url: '/subpkg-mine/pages/chargen/chargen?from=first' });
      return;
    }
    wx.switchTab({ url: '/pages/home/home' });
  }
});
