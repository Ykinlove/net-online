const store = require('../../../utils/store.js');
const cmdbook = require('../../utils/cmdbook.js');
const { TPLS } = require('../../../utils/tplbook.js');

/* 分类顺序固定，「全部」在前 */
const CATS = ['全部'];
TPLS.forEach(t => { if (CATS.indexOf(t.cat) < 0) CATS.push(t.cat); });

Page({
  data: {
    cats: CATS,
    cat: '全部',
    shown: [],
    total: TPLS.length,
    catCount: {},
    detail: null
  },

  onLoad() {
    const catCount = { '全部': TPLS.length };
    TPLS.forEach(t => { catCount[t.cat] = (catCount[t.cat] || 0) + 1; });
    this.setData({ catCount });
    this.rebuild();
  },

  pickCat(e) {
    this.setData({ cat: e.currentTarget.dataset.v }, () => this.rebuild());
  },

  rebuild() {
    const list = this.data.cat === '全部'
      ? TPLS.slice()
      : TPLS.filter(t => t.cat === this.data.cat);
    this.setData({
      shown: list.map(t => ({
        id: t.id,
        cat: t.cat,
        name: t.name,
        vendor: t.vendor,
        preview: t.code.split('\n').filter(s => s.trim() && s.trim()[0] !== '!')[0] || t.code.split('\n')[0]
      }))
    });
  },

  /* ---------- 详情 ---------- */
  /* 命令行/注释行拆开：注释行界面灰掉，复制时整行剔掉 */
  buildLines(code) {
    return String(code || '').split('\n').map(t => {
      const s = t.trim();
      const note = !s || s[0] === '!' || !/[a-zA-Z0-9]/.test(s);
      return { t: s ? t : ' ', note: note };
    });
  },

  openTpl(e) {
    const id = e.currentTarget.dataset.id;
    const t = TPLS.filter(x => x.id === id)[0];
    if (!t) return;
    this.setData({
      detail: {
        id: t.id,
        favKind: 'tpl',
        favId: t.id,
        faved: store.isFav('tpl', t.id),
        title: t.name,
        vendor: t.vendor,
        sub: t.vendor + ' · ' + t.cat,
        tip: t.note,
        code: t.code,
        lines: this.buildLines(t.code)
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
      path: '/subpkg-tool/pages/templates/templates'
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

  /* 复制走 cleanCmd：中文注释、说明行不带进剪贴板；
     <占位符> 在命令行上，会原样留下提醒替换 */
  copyTpl() {
    const d = this.data.detail;
    if (!d) return;
    const text = cmdbook.cleanCmd(d.code, d.vendor) || d.code;
    if (!text.trim()) {
      wx.showToast({ title: '没有可复制的命令', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '模板已复制，替换 <占位符> 再用', icon: 'none', duration: 2500 })
    });
  }
});
