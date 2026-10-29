const store = require('../../../utils/store.js');
const cmdbook = require('../../utils/cmdbook.js');

/* 三类收藏：百科条目 / 配置模板 / 自己记的命令 */
const KINDS = [
  { k: 'all', name: '全部' },
  { k: 'book', name: '百科' },
  { k: 'tpl', name: '模板' },
  { k: 'mine', name: '我的' }
];

const KIND_NAME = { book: '百科条目', tpl: '配置模板', mine: '我的命令' };

Page({
  data: {
    tabs: [],
    tab: 'all',
    list: [],
    total: 0,
    detail: null
  },

  onShow() {
    store.init();
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

    const tab = this.data.tab;
    const list = favs
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

    this.setData({ list, total: favs.length });
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
