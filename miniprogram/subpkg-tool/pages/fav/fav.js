const store = require('../../../utils/store.js');
const cmdbook = require('../../utils/cmdbook.js');
const offline = require('../../../utils/cmd-offline.js');

/* 三类收藏：百科条目 / 配置模板 / 自己记的命令 */
const KINDS = [
  { k: 'all', name: '全部' },
  { k: 'book', name: '百科' },
  { k: 'tpl', name: '模板' },
  { k: 'mine', name: '我的' }
];

const KIND_NAME = { book: '百科条目', tpl: '配置模板', mine: '我的命令' };

/* 把文本按关键词切成高亮小段（与搜索页同一套逻辑） */
function segText(text, kw) {
  const t = String(text || '');
  if (!kw) return [{ t: t, hl: false }];
  const lower = t.toLowerCase();
  const k = String(kw).toLowerCase();
  const idx = lower.indexOf(k);
  if (idx < 0) return [{ t: t, hl: false }];
  const out = [];
  if (idx > 0) out.push({ t: t.slice(0, idx), hl: false });
  out.push({ t: t.slice(idx, idx + k.length), hl: true });
  const rest = t.slice(idx + k.length);
  if (rest) out.push({ t: rest, hl: false });
  return out;
}

Page({
  data: {
    tabs: [],
    tab: 'all',
    list: [],
    total: 0,
    kw: '',
    focusKey: '',
    detail: null
  },

  onShow() {
    getApp().applyTheme(this);
    offline.registerBookSetter(function (entries) { return cmdbook.setDataset(entries); });
    offline.ensureReady(); // 本地缓存预热（若有），离线也能查
    store.init();
    /* 进收藏页时清掉上次的搜索词，避免切回来还顶着旧筛选 */
    this.setData({ kw: '' });
    this.rebuild();
  },

  rebuild() {
    const favs = store.getFavs();
    const n = k => favs.filter(f => f.kind === k).length;
    this.setData({
      tabs: KINDS.map(t => ({
        k: t.k,
        name: t.name,
        n: t.k === 'all' ? favs.length : n(t.k)
      }))
    });
    this._totalAll = favs.length;

    const tab = this.data.tab;
    const all = favs
      .filter(f => tab === 'all' || f.kind === tab)
      .map(f => {
        const item = {
          kind: f.kind,
          kindName: KIND_NAME[f.kind] || '收藏',
          id: f.id,
          title: f.title || '(已删除)',
          sub: f.sub || '',
          ts: f.ts || 0
        };
        /* 百科和模板的本体在包里，取出来才能看内容 */
        if (f.kind === 'book') {
          const it = cmdbook.findById ? cmdbook.findById(f.id) : null;
          if (it) {
            item.blocks = it.cmds.map(c => ({ vendor: c[0], code: c[1] }));
            item.tip = it.tip;
            item.devs = it.devs;
          }
        } else if (f.kind === 'tpl') {
          const t = cmdbook.findTplById ? cmdbook.findTplById(f.id) : null;
          if (t) {
            item.blocks = [{ vendor: t.vendor, code: t.code }];
            item.tip = t.note;
          }
        }
        return item;
      });
    this._all = all;
    this.applyFilter();
  },

  /* 顶部搜索：在当前 tab 的收藏里按 标题 / 副标题 / 类型 过滤 */
  onKwInput(e) {
    this.setData({ kw: e.detail.value });
    if (this._deb) clearTimeout(this._deb);
    this._deb = setTimeout(() => this.applyFilter(), 150);
  },

  clearKw() {
    this.setData({ kw: '' }, () => this.applyFilter());
  },

  applyFilter() {
    const kw = String(this.data.kw || '').trim().toLowerCase();
    const all = this._all || [];
    let list = all;
    if (kw) {
      list = all.filter(it => {
        const bag = [it.title, it.sub, it.kindName]
          .map(s => String(s || '').toLowerCase()).join('\n');
        return bag.indexOf(kw) >= 0;
      });
    }
    this.setData({
      list: list.map(it => ({
        ...it,
        titleSegs: segText(it.title, kw),
        /* 副标题里带着设备/厂商信息（模板是「分类·厂商」、其他是设备名），
           搜厂商词时把这块也标黄，跟浏览页的厂商标签高亮一致 */
        subSegs: segText(it.sub, kw)
      })),
      total: this._totalAll || all.length
    });
  },

  pickTab(e) {
    this.setData({ tab: e.currentTarget.dataset.k }, () => this.rebuild());
  },

  buildLines(code) {
    return String(code || '').split('\n').map(t => {
      const s = t.trim();
      const note = !s || /^[#!]/.test(s) || !/[a-zA-Z0-9]/.test(s) ||
        (/^[（(].*[）)]$/.test(s) && /[\u4e00-\u9fa5]/.test(s));
      return { t: s ? t : ' ', note: note };
    });
  },

  openItem(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const it = this.data.list[idx];
    if (!it) return;
    /* 我的命令（mine）的内容存在 store 里，不在包里 */
    if (it.kind === 'mine') {
      const rec = store.getList('commands').filter(c => (c._id || c._localId) === it.id)[0];
      if (!rec) {
        wx.showToast({ title: '这条记录已删除', icon: 'none' });
        return;
      }
      this.setData({
        detail: {
          title: rec.title || '(未命名命令)',
          sub: it.sub || '我的命令',
          tip: rec.desc || '',
          blocks: [{
            vendor: it.sub || '命令',
            code: rec.content || '',
            lines: this.buildLines(rec.content || '')
          }]
        }
      });
      return;
    }
    if (!it.blocks || !it.blocks.length) {
      wx.showToast({ title: '内容已更新，找不到了', icon: 'none' });
      return;
    }
    this.setData({
      detail: {
        title: it.title,
        sub: it.sub,
        tip: it.tip || '',
        blocks: it.blocks.map(b => ({
          vendor: b.vendor,
          code: b.code,
          lines: this.buildLines(b.code)
        }))
      }
    });
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  noop() {},

  /* ---------- 输入框聚焦态（纯视觉，.input-focus） ---------- */
  onFieldFocus(e) {
    this.setData({ focusKey: e.currentTarget.dataset.k || '' });
  },

  onFieldBlur() {
    this.setData({ focusKey: '' });
  },

  /* ---------- 代码块复制：震动 + 剪贴板 + ✓ 反馈（只新增，不动 copyOne/copyAll） ---------- */
  onCopyCode(e) {
    const i = Number(e.currentTarget.dataset.i);
    const d = this.data.detail;
    if (!d || !d.blocks[i]) return;
    const b = d.blocks[i];
    const text = cmdbook.cleanCmd(b.code, b.vendor) || b.code;
    wx.vibrateShort({ type: 'light' });
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制 ' + b.vendor, icon: 'none' })
    });
    this.setData({ ['detail.blocks[' + i + '].copied']: true });
    if (!this._copyTimers) this._copyTimers = {};
    clearTimeout(this._copyTimers[i]);
    this._copyTimers[i] = setTimeout(() => {
      if (!this.data.detail) return;
      this.setData({ ['detail.blocks[' + i + '].copied']: false });
    }, 1600);
  },

  async removeFav(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const it = this.data.list[idx];
    if (!it) return;
    await store.toggleFav({ kind: it.kind, id: it.id });
    wx.showToast({ title: '已取消收藏', icon: 'none' });
    this.rebuild();
  },

  copyOne(e) {
    const i = Number(e.currentTarget.dataset.i);
    const d = this.data.detail;
    if (!d || !d.blocks[i]) return;
    const b = d.blocks[i];
    const text = cmdbook.cleanCmd(b.code, b.vendor) || b.code;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制 ' + b.vendor, icon: 'none' })
    });
  },

  copyAll() {
    const d = this.data.detail;
    if (!d) return;
    const multi = d.blocks.length > 1;
    const text = d.blocks
      .map(b => {
        const body = cmdbook.cleanCmd(b.code, b.vendor) || b.code;
        return multi ? '【' + b.vendor + '】\n' + body : body;
      })
      .join('\n\n');
    if (text.length > 60000) {
      wx.showToast({ title: '内容过长，请逐个复制', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '命令已复制', icon: 'success' })
    });
  }
});
