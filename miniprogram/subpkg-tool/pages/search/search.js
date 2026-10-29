const store = require('../../../utils/store.js');
const { DEVICES, DEVICE_CN } = require('../../../utils/seed.js');
const cmdbook = require('../../utils/cmdbook.js');

/* 左侧设备栏：显示中文，值仍用英文 key（与 commands 表一致） */
const SIDE = [{ v: '全部', t: '全部' }].concat(
  DEVICES.map(d => ({ v: d, t: DEVICE_CN[d] || d }))
);

/* 百科条目多（近 300 条），一次全推给视图会很卡，按页追加 */
const PAGE = 30;

Page({
  data: {
    sideList: SIDE,
    dev: '全部',
    devText: '全部',
    kw: '',
    bookHits: [],
    bookTotal: 0,
    hasMore: false,
    tplHits: [],
    history: [],
    mineHits: [],
    hitTotal: 0,
    detail: null,
    detailCopyLabel: '复制全部'
  },

  onLoad(q) {
    store.init();
    const patch = {};
    if (q && q.dev) patch.dev = q.dev;
    if (q && q.kw) patch.kw = q.kw;
    if (Object.keys(patch).length) this.setData(patch);
    this.doSearch();
    /* 分享落地：别人点进来的卡片带了 kind + id，直接打开那一条 */
    if (q && q.kind && q.id) this.openShared(q.kind, q.id);
  },

  /* 从分享卡片进来：按 id 找到条目并打开详情 */
  openShared(kind, id) {
    const it = cmdbook.lookupById(kind, id);
    if (!it) {
      wx.showToast({ title: '这条内容已更新', icon: 'none' });
      return;
    }
    this.setData({
      detail: {
        kind: it.kind,
        favKind: it.kind,
        favId: it.id,
        faved: store.isFav(it.kind, it.id),
        title: it.name,
        sub: it.sub,
        tip: it.tip || '',
        blocks: it.blocks.map(b => ({
          vendor: b.vendor,
          code: b.code,
          lines: this.buildLines(b.code, b.vendor)
        }))
      }
    });
  },

  onShow() {
    this.doSearch();
    this.loadHistory();
  },

  /* 读搜索历史 */
  loadHistory() {
    this.setData({ history: store.getSearchHistory().slice(0, 12) });
  },

  /* 点历史词直接搜 */
  pickHistory(e) {
    const kw = e.currentTarget.dataset.kw;
    if (!kw) return;
    this.setData({ kw }, () => this.doSearch());
    this.recordHistory();
  },

  clearHistory() {
    store.clearSearchHistory();
    this.setData({ history: [] });
    wx.showToast({ title: '已清空', icon: 'none' });
  },

  /* ---------- 搜索 ---------- */
  onInput(e) {
    this.setData({ kw: e.detail.value }, () => this.doSearch());
  },

  onConfirm(e) {
    this.setData({ kw: e.detail.value }, () => this.doSearch());
    /* 记历史只在「确认搜索」时记——每敲一个字都记会把历史冲垮 */
    this.recordHistory();
  },

  clearKw() {
    this.setData({ kw: '' }, () => this.doSearch());
  },

  pickDev(e) {
    this.setData({ dev: e.currentTarget.dataset.v }, () => this.doSearch());
  },

  doSearch() {
    const kw = String(this.data.kw || '').trim();
    let dev = this.data.dev;

    /* 如果输入的就是设备名（「交换机」「路由器」），直接把左侧切过去，按设备列全部 */
    let kwForSearch = kw;
    const hitDev = SIDE.filter(s => s.v !== '全部' && s.t === kw)[0];
    if (hitDev) {
      kwForSearch = '';
      if (dev !== hitDev.v) {
        dev = hitDev.v;
        this.setData({ dev: hitDev.v });
      }
    }

    /* 1. 内置命令百科 */
    const bookHits = cmdbook.search(kwForSearch, dev);

    /* 2. 配置模板：64 个可直接复制的模板并入搜索。
       模板不属于任何设备分类，所以设备筛选时不过滤模板——
       「配个开局模板」这种事不会先想「我这是交换机还是路由器」。 */
    const tplHits = cmdbook.searchTemplates(kwForSearch, 20);

    /* 2. 自己记过的命令 */
    const words = cmdbook.expand(cmdbook.norm(kwForSearch));
    let mine = store.getList('commands').slice();
    mine.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (dev !== '全部') {
      mine = mine.filter(c => (c.device || '其他设备') === dev);
    }
    if (words.length) {
      mine = mine.filter(c => {
        const bag = [c.title, c.content, c.desc, c.tags]
          .map(x => String(x || ''))
          .join('\n')
          .toLowerCase();
        for (let i = 0; i < words.length; i++) {
          const g = words[i];
          let ok = false;
          for (let j = 0; j < g.length; j++) {
            if (bag.indexOf(g[j]) >= 0) { ok = true; break; }
          }
          if (!ok) return false;
        }
        return true;
      });
    }
    const mineHits = mine.slice(0, 50).map(c => ({
      _key: c._id || c._localId,
      title: c.title || '(未命名命令)',
      device: c.device || '其他设备',
      devText: DEVICE_CN[c.device || '其他设备'] || (c.device || '其他设备'),
      preview: String(c.content || '').split('\n')[0],
      content: c.content || '',
      desc: c.desc || ''
    }));

    /* 命中数为 0 的搜索词会被记进「搜不到」清单，
       那是内容建设的输入源——说明库里缺这个说法 */
    this._lastHit = bookHits.length + tplHits.length + mineHits.length;

    this._bookAll = bookHits;
    this.setData({
      bookHits: bookHits.slice(0, PAGE),
      bookTotal: bookHits.length,
      hasMore: bookHits.length > PAGE,
      tplHits,
      mineHits,
      hitTotal: bookHits.length + tplHits.length + mineHits.length,
      devText: (SIDE.filter(s => s.v === dev)[0] || {}).t || dev
    });
  },

  /* 结果多的时候滚动到底部再追加，避免首屏一次渲染几百条 */
  loadMore() {
    if (!this.data.hasMore) return;
    const all = this._bookAll || [];
    const cur = this.data.bookHits.length;
    const next = all.slice(0, cur + PAGE);
    this.setData({ bookHits: next, hasMore: next.length < all.length });
  },

  /* ---------- 详情浮层 ---------- */
  /* 把命令块拆成一行一行：注释/说明行在界面上灰掉，复制时整行剔掉 */
  buildLines(code, vendor) {
    return String(code || '').split('\n').map(t => {
      const s = t.trim();
      const note = !s || /^[#!]/.test(s) || !/[a-zA-Z0-9]/.test(s) ||
        (/^[（(].*[）)]$/.test(s) && /[\u4e00-\u9fa5]/.test(s));
      return { t: s ? t : ' ', note: note };
    });
  },

  openBook(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const it = this.data.bookHits[idx];
    if (!it) return;
    this.setData({
      detail: {
        kind: 'book',
        favKind: 'book',
        favId: it.id,
        faved: store.isFav('book', it.id),
        title: it.name,
        sub: it.devs.map(d => DEVICE_CN[d] || d).join(' / '),
        tip: it.tip,
        blocks: it.cmds.map(c => ({
          vendor: c.vendor,
          code: c.code,
          lines: this.buildLines(c.code, c.vendor)
        }))
      }
    });
  },

  openTpl(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const it = this.data.tplHits[idx];
    if (!it) return;
    this.setData({
      detail: {
        kind: 'tpl',
        favKind: 'tpl',
        favId: it.id,
        faved: store.isFav('tpl', it.id),
        title: it.name,
        sub: it.cat + ' · ' + it.vendor,
        tip: it.note,
        blocks: [{
          vendor: it.vendor,
          code: it.code,
          lines: this.buildLines(it.code, it.vendor)
        }]
      }
    });
  },

  openMine(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const it = this.data.mineHits[idx];
    if (!it) return;
    this.setData({
      detail: {
        kind: 'mine',
        favKind: 'mine',
        favId: it._key,
        faved: store.isFav('mine', it._key),
        title: it.title,
        sub: it.devText,
        tip: it.desc,
        blocks: [{
          vendor: it.devText,
          code: it.content,
          lines: this.buildLines(it.content, it.devText)
        }]
      }
    });
  },

  /* open-type="share" 自己就会拉起分享面板，
     这个 handler 只是占位——部分基础库要求绑定的函数必须存在。 */
  shareBtn() {},

  /* 记搜索历史 + 零结果 */
  recordHistory() {
    const kw = String(this.data.kw || '').trim();
    if (!kw) return;
    store.addSearchHistory(kw, this._lastHit || 0);
  },

  /* ---------- 分享 ---------- */
  /* 转发按钮走 open-type="share"，内容从这里取。
     页面本身也可以通过右上角菜单分享——那就分享当前打开的条目，
     什么都没打开时分享整个小程序。 */
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
      path: '/subpkg-tool/pages/search/search'
    };
  },

  onShareTimeline() {
    const d = this.data.detail;
    if (d && d.favKind) {
      const card = cmdbook.shareCard({
        kind: d.favKind,
        id: d.favId,
        title: d.title,
        sub: d.sub,
        blocks: d.blocks
      });
      return { title: card.title, query: 'kind=' + encodeURIComponent(d.favKind) + '&id=' + encodeURIComponent(d.favId) };
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
    /* 走一遍清洗：中文注释、说明行不带进剪贴板，粘到设备上不报错 */
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
        /* 只有多块时才加厂商前缀——单块（模板 / 我的命令）加了是噪音，
           粘到设备上还得自己删。 */
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
