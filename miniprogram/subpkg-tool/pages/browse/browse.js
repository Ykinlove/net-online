const store = require('../../../utils/store.js');
const cmdbook = require('../../utils/cmdbook.js');
const { DEVICES, DEVICE_CN } = require('../../../utils/seed.js');

/* 设备栏：跟搜索页一致，中文显示、英文 key */
const SIDE = [{ v: '全部', t: '全部' }].concat(
  DEVICES.map(d => ({ v: d, t: DEVICE_CN[d] || d }))
);

/* 一页 30 条，跟搜索页保持一致 */
const PAGE = 30;

/* 把文本按关键词切成高亮小段（与搜索页同一套逻辑，让两处高亮长得一样） */
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
    kw: '',
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

  onShow() {
    /* 与搜索页同理：进浏览页时静默拉一次云端内容，
       让作者新发布 / 审核通过的新条目能立刻出现在列表里。
       拉到新数据才重建列表，避免无谓的刷新闪烁。 */
    this.syncCloud();
  },

  async syncCloud() {
    try {
      const hotfix = require('../../../utils/hotfix.js');
      const before = hotfix.version();
      await hotfix.refresh();
      if (hotfix.version() !== before) {
        this.initCats();
        this.rebuild();
      }
    } catch (e) { /* 云端不可用就用本地内容 */ }
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

  /* 顶部关键词框：在当前分类 + 设备的结果里再筛一遍。
     轻量防抖，避免每个字都重算一遍筛选。 */
  onKwInput(e) {
    const v = e.detail.value;
    this.setData({ kw: v });
    if (this._deb) clearTimeout(this._deb);
    this._deb = setTimeout(() => this.applyFilter(), 150);
  },

  clearKw() {
    this.setData({ kw: '' }, () => this.applyFilter());
  },

  rebuild() {
    const all = cmdbook.listBy({
      cat: this.data.cat || undefined,
      dev: this.data.dev
    });
    this._all = all;
    /* 分类 / 设备切换后，顺便把顶部关键词框也清掉，
       否则「在 vlan 分类里搜 ospf」切到别的分类时残留的关键词会让人困惑 */
    this.setData({ kw: '', devText: (SIDE.filter(s => s.v === this.data.dev)[0] || {}).t || this.data.dev });
    this.applyFilter();
  },

  /* 在 rebuild 拿到的全集上叠加关键词过滤 + 高亮，并重排分页。
     关键词命中 名称 / 厂商 / 命令正文 / 设备，跟搜索口径尽量一致。 */
  applyFilter() {
    const kw = String(this.data.kw || '').trim().toLowerCase();
    const all = this._all || [];
    let rows = all;
    if (kw) {
      rows = all.filter(it => {
        const bag = [it.name, it.vendorText, (it.cmds || []).map(c => c.code).join(' '), (it.devs || []).join(' ')]
          .map(s => String(s || '').toLowerCase()).join('\n');
        return bag.indexOf(kw) >= 0;
      });
    }
    this._filtered = rows.map(r => ({
      ...r,
      titleSegs: segText(r.name, kw),
      /* 厂商标签也跟着高亮：搜「H3C」时命中的那个厂商 chip 会标黄 */
      cmds: (r.cmds || []).map(c => ({ ...c, vendorSegs: segText(c.vendor, kw) }))
    }));
    this.setData({
      shown: this._filtered.slice(0, PAGE),
      total: rows.length,
      hasMore: rows.length > PAGE
    });
  },

  loadMore() {
    if (!this.data.hasMore) return;
    const all = this._filtered || [];
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
        favKind: 'book',
        favId: it.id,
        faved: store.isFav('book', it.id),
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


  /* open-type="share" 自己就会拉起分享面板，
     这个 handler 只是占位——部分基础库要求绑定的函数必须存在。 */
  shareBtn() {},

  /* ---------- 分享 ---------- */
  onShareAppMessage() {
    const d = this.data.detail;
    if (d && d.favKind) {
      const card = cmdbook.shareCard({
        kind: d.favKind,
        id: d.favId,
        title: d.title,
        sub: d.sub,
        blocks: d.blocks
      });
      return { title: card.title, path: card.path, content: card.content };
    }
    return {
      title: 'Net 操作命令速记 · 网络工程师命令速查',
      path: '/subpkg-tool/pages/browse/browse'
    };
  },

  onShareTimeline() {
    const d = this.data.detail;
    if (d && d.favKind) {
      return {
        title: d.title,
        query: 'kind=' + encodeURIComponent(d.favKind) + '&id=' + encodeURIComponent(d.favId)
      };
    }
    return { title: 'Net 操作命令速记 · 网络工程师命令速查' };
  },

  /* ---------- 收藏 ---------- */
  async toggleFav() {
    const d = this.data.detail;
    if (!d || !d.favKind) return;
    const on = await store.toggleFav({
      kind: d.favKind,
      id: d.favId,
      title: d.title,
      sub: d.sub
    });
    this.setData({ 'detail.faved': on });
    wx.showToast({ title: on ? '已收藏' : '已取消收藏', icon: 'none' });
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
