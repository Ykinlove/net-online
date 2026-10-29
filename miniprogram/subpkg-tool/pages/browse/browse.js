const cmdbook = require('../../utils/cmdbook.js');
const { DEVICES, DEVICE_CN } = require('../../../utils/seed.js');

/* 设备栏：跟搜索页一致，中文显示、英文 key */
const SIDE = [{ v: '全部', t: '全部' }].concat(
  DEVICES.map(d => ({ v: d, t: DEVICE_CN[d] || d }))
);

/* 一页 30 条，跟搜索页保持一致 */
const PAGE = 30;

Page({
  data: {
    cats: [],
    cat: '',
    catName: '',
    catDesc: '',
    sideList: SIDE,
    dev: '全部',
    devText: '全部',
    shown: [],
    total: 0,
    hasMore: false,
    detail: null
  },

  onLoad(q) {
    const patch = {};
    if (q && q.dev) patch.dev = q.dev;
    if (q && q.cat) patch.cat = q.cat;
    this.setData(patch);
    this.initCats();
    this.rebuild();
  },

  initCats() {
    const cats = cmdbook.categoryStats();
    const cur = cats.filter(c => c.key === this.data.cat)[0];
    this.setData({
      cats,
      catName: cur ? cur.name : '全部',
      catDesc: cur ? cur.desc : '按分类翻，不是靠搜'
    });
  },

  pickCat(e) {
    const key = String(e.currentTarget.dataset.k || '');
    const cur = this.data.cats.filter(c => c.key === key)[0];
    this.setData({
      cat: key,
      catName: cur ? cur.name : '全部',
      catDesc: cur ? cur.desc : '按分类翻，不是靠搜'
    }, () => this.rebuild());
  },

  pickDev(e) {
    this.setData({ dev: e.currentTarget.dataset.v }, () => this.rebuild());
  },

  rebuild() {
    const opts = {
      cat: this.data.cat || undefined,
      dev: this.data.dev,
      limit: PAGE
    };
    const all = cmdbook.listBy({
      cat: this.data.cat || undefined,
      dev: this.data.dev
    });
    this._all = all;
    this.setData({
      shown: all.slice(0, PAGE),
      total: all.length,
      hasMore: all.length > PAGE,
      devText: (SIDE.filter(s => s.v === this.data.dev)[0] || {}).t || this.data.dev
    });
  },

  loadMore() {
    if (!this.data.hasMore) return;
    const all = this._all || [];
    const cur = this.data.shown.length;
    const next = all.slice(0, cur + PAGE);
    this.setData({ shown: next, hasMore: next.length < all.length });
  },

  /* ---------- 详情 ---------- */
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
    const it = this.data.shown[idx];
    if (!it) return;
    this.setData({
      detail: {
        title: it.name,
        sub: it.devs.map(d => DEVICE_CN[d] || d).join(' / '),
        tip: it.tip,
        blocks: it.cmds.map(c => ({
          vendor: c.vendor,
          code: c.code,
          lines: this.buildLines(c.code)
        }))
      }
    });
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  noop() {},

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
