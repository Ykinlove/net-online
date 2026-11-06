// pages/browse/browse.js —— 资料库页（命令百科 + 配置模板库 合并后的统一浏览页）
//
// 为什么合并：以前是两个独立页面（browse 百科 / templates 模板），
// 首页两个入口分别跳过去，用户要来回切。现在合成一页，顶部用分段控件切换两种内容，
// 分类条、列表、详情浮层、收藏、分享、复制全部共用一套逻辑。
//
// 两种内容的数据形态本来就同构，详情浮层都是 blocks:[{vendor, code}]：
//   book（命令百科）—— 一个功能点，华为 / 思科 / H3C / 锐捷四种写法并排
//   tpl （配置模板）—— 成套配置，复制后把占位符换成自己的参数
// 所以浮层不用分两套渲染。
//
// 注意：模板数据走 cmdbook.listTpls()（内部经 tplIndex），
// 而不是直接读 utils/tplbook.js 的原始数组——
// 原始数组不含云端热更新覆盖和「作者审核通过的新增模板」，直接读会漏掉这部分。
const store = require('../../../utils/store.js');
const cmdbook = require('../../utils/cmdbook.js');
const { DEVICES, DEVICE_CN } = require('../../../utils/seed.js');
const offline = require('../../../utils/cmd-offline.js');

/* 设备栏：跟搜索页一致，中文显示、英文 key */
const SIDE = [{ v: '全部', t: '全部' }].concat(
  DEVICES.map(d => ({ v: d, t: DEVICE_CN[d] || d }))
);

/* 一页 30 条，跟搜索页保持一致 */
const PAGE = 30;

/* 两种资源的文案外壳。catDesc 的兜底说明也在这，
   百科的具体分类说明来自 categories.js，比这里的更细。 */
const META = {
  book: {
    icon: '',
    title: '命令百科',
    unit: '条',
    desc: '按分类翻，不是靠搜',
    kwTip: '在这个分类里筛关键词，比如「vlan」'
  },
  tpl: {
    icon: '',
    title: '配置模板库',
    unit: '个',
    desc: '复制后把尖括号占位符换成你的参数',
    kwTip: '在这个分类里筛关键词，比如「开局」'
  }
};

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

/* 设备类型 → 命令卡左侧彩色竖条：
   Windows 蓝(--primary) / Switch 绿(--success) / Router 橙(--warning)，
   与全局 .cmd-card / .vendor-* 对应；其余用默认灰竖条。 */
function vendorClass(d) {
  if (d === 'Windows' || d === 'Linux' || d === '服务器') return 'vendor-windows';
  if (d === 'Switch' || d === 'AC' || d === 'AP') return 'vendor-switch';
  if (d === 'Router' || d === '防火墙') return 'vendor-router';
  return '';
}

Page({
  data: {
    /* book=命令百科 / tpl=配置模板库 */
    kind: 'book',
    icon: META.book.icon,
    title: META.book.title,
    unit: META.book.unit,
    kwTip: META.book.kwTip,
    cats: [],
    cat: '',
    catName: '全部',
    catDesc: META.book.desc,
    sideList: SIDE,
    dev: '全部',
    devText: '全部',
    shown: [],
    /* 筛选后的条数（列表底部的「已显示 / 共 N」用） */
    total: 0,
    /* 当前资源的总条数（头部徽标用，不随筛选变化） */
    libTotal: 0,
    hasMore: false,
    kw: '',
    emptyText: '',
    emptySub: '',
    focusKey: '',
    detail: null
  },

  onLoad(q) {
    getApp().applyTheme(this);
    offline.registerBookSetter(function (entries) { return cmdbook.setDataset(entries); });
    offline.ensureReady(); // 本地缓存预热（若有），离线也能查
    const patch = {};
    if (q && q.dev) patch.dev = q.dev;
    if (q && q.cat) patch.cat = q.cat;
    /* 旧链接 /subpkg-tool/pages/templates/templates 会重定向过来，带 kind=tpl */
    if (q && q.kind === 'tpl') patch.kind = 'tpl';
    this.setData(patch);
    this.initCats();
    this.rebuild();
  },

  onShow() {
    getApp().applyTheme(this);
    /* 与搜索页同理：进资料库时静默拉一次云端内容，
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

  /* ---------- 顶部分段：命令百科 / 配置模板库 ---------- */
  switchKind(e) {
    const kind = String(e.currentTarget.dataset.kind || 'book');
    if (kind === this.data.kind) return;
    /* 换资源类型时，分类和设备筛选的选择全部作废——
       两边的分类体系不一样，混着留会让用户以为筛没生效。 */
    this.setData({ kind: kind, cat: '', dev: '全部', kw: '' }, () => {
      this.initCats();
      this.rebuild();
    });
  },

  /* ---------- 分类 / 设备 ---------- */
  initCats() {
    const kind = this.data.kind;
    const meta = META[kind];
    const cats = kind === 'tpl' ? cmdbook.tplCategoryStats() : cmdbook.categoryStats();
    const cur = cats.filter(c => c.key === this.data.cat)[0];
    this.setData({
      icon: meta.icon,
      title: meta.title,
      unit: meta.unit,
      kwTip: meta.kwTip,
      cats: cats,
      catName: cur ? cur.name : '全部',
      /* 百科的分类说明比通用文案更细，用它；模板没有分类说明，用通用文案 */
      catDesc: kind === 'tpl' ? meta.desc : (cur ? cur.desc : meta.desc),
      libTotal: kind === 'tpl'
        ? cmdbook.listTpls({}).length
        : cmdbook.listBy({}).length
    });
  },

  pickCat(e) {
    const key = String(e.currentTarget.dataset.k || '');
    const cur = this.data.cats.filter(c => c.key === key)[0];
    const meta = META[this.data.kind];
    this.setData({
      cat: key,
      catName: cur ? cur.name : '全部',
      catDesc: this.data.kind === 'tpl' ? meta.desc : (cur ? cur.desc : meta.desc)
    }, () => this.rebuild());
  },

  pickDev(e) {
    this.setData({ dev: e.currentTarget.dataset.v }, () => this.rebuild());
  },

  /* 顶部关键词框：在当前分类（+ 设备）的结果里再筛一遍。
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
    const kind = this.data.kind;
    const all = kind === 'tpl'
      ? cmdbook.listTpls({ cat: this.data.cat || undefined })
      : cmdbook.listBy({
        cat: this.data.cat || undefined,
        dev: this.data.dev
      });
    this._all = all;
    /* 分类 / 设备切换后，顺便把顶部关键词框也清掉，
       否则「在 vlan 分类里搜 ospf」切到别的分类时残留的关键词会让人困惑 */
    this.setData({
      kw: '',
      devText: (SIDE.filter(s => s.v === this.data.dev)[0] || {}).t || this.data.dev
    });
    this.applyFilter();
  },

  /* 在 rebuild 拿到的全集上叠加关键词过滤 + 高亮，并重排分页。
     百科命中 名称 / 厂商 / 命令正文 / 设备；
     模板命中 名称 / 厂商 / 分类 / 别名，跟搜索口径尽量一致。 */
  applyFilter() {
    const kw = String(this.data.kw || '').trim().toLowerCase();
    const kind = this.data.kind;
    const all = this._all || [];
    let rows = all;
    if (kw) {
      rows = all.filter(it => {
        const bag = kind === 'tpl'
          ? [it.name, it.vendor, it.cat, (it.kw || []).join(' ')]
          : [it.name, it.vendorText, (it.cmds || []).map(c => c.code).join(' '), (it.devs || []).join(' ')];
        const text = bag.map(s => String(s || '').toLowerCase()).join('\n');
        return text.indexOf(kw) >= 0;
      });
    }
    this._filtered = rows.map(r => kind === 'tpl' ? this.mapTpl(r, kw) : this.mapBook(r, kw));

    const isTpl = kind === 'tpl';
    this.setData({
      shown: this._filtered.slice(0, PAGE),
      total: rows.length,
      hasMore: rows.length > PAGE,
      emptyText: kw
        ? '没有匹配「' + this.data.kw + '」的' + (isTpl ? '模板' : '条目')
        : (isTpl ? '这个分类下还没有模板' : '这个分类下没有「' + this.data.devText + '」的条目'),
      emptySub: kw
        ? '换个关键词试试'
        : (isTpl ? '换一个分类看看' : '把设备切回「全部」试试')
    });
  },

  /* 百科条目 → 列表渲染模型 */
  mapBook(r, kw) {
    return {
      id: r.id,
      titleSegs: segText(r.name, kw),
      /* 厂商标签也跟着高亮：搜「H3C」时命中的那个厂商 chip 会标黄 */
      chips: (r.cmds || []).map(c => ({
        text: c.vendor,
        segs: segText(c.vendor, kw),
        cls: ''
      })),
      preview: '',
      vendorClass: vendorClass((r.devs || [])[0] || '其他设备')
    };
  },

  /* 模板条目 → 列表渲染模型 */
  mapTpl(r, kw) {
    const code = (r.cmds && r.cmds[0] && r.cmds[0].code) || '';
    return {
      id: r.id,
      titleSegs: segText(r.name, kw),
      chips: [
        { text: r.vendor, segs: segText(r.vendor, kw), cls: '' },
        { text: r.cat, segs: segText(r.cat, kw), cls: 'item-tag-c' }
      ],
      /* 首行有效命令，给列表一个「这模板大概长什么样」的预览 */
      preview: code.split('\n').filter(s => s.trim() && s.trim()[0] !== '!')[0] || '',
      vendorClass: ''
    };
  },

  loadMore() {
    if (!this.data.hasMore) return;
    const all = this._filtered || [];
    const cur = this.data.shown.length;
    const next = all.slice(0, cur + PAGE);
    this.setData({ shown: next, hasMore: next.length < all.length });
  },

  /* ---------- 详情 ---------- */
  /* 命令行 / 注释行拆开：注释行界面灰掉，复制时整行剔掉。
     百科和模板共用这一套判断。 */
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
    const shown = this.data.shown[idx];
    if (!shown) return;
    /* 列表项是渲染模型（标题已切段高亮），详情要用原始条目，
       所以回 _all 里按 id 取原文 */
    const raw = (this._all || []).filter(r => r.id === shown.id)[0];
    if (!raw) return;

    const kind = this.data.kind;
    const isTpl = kind === 'tpl';
    const blocks = (raw.cmds || []).map(c => ({
      vendor: c.vendor,
      code: c.code,
      lines: this.buildLines(c.code)
    }));
    /* 详情顶部明确写出资源类型：命令百科和配置模板点进去后
       页面结构几乎一样，不说清楚用户分不出自己在看哪一种 */
    const devText = (raw.devs || []).map(d => DEVICE_CN[d] || d).join(' / ') || '通用';
    const subParts = isTpl
      ? ['配置模板', raw.vendor, raw.cat]
      : ['命令百科', devText];

    this.setData({
      detail: {
        favKind: kind,
        favId: raw.id,
        faved: store.isFav(kind, raw.id),
        title: raw.name,
        sub: subParts.filter(Boolean).join(' · '),
        tip: raw.tip || '',
        blocks: blocks,
        copyLabel: isTpl
          ? '复制模板命令'
          : (blocks.length > 1 ? '复制全部命令' : '复制命令'),
        copyToast: isTpl ? '模板已复制，替换占位符再用' : '命令已复制'
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

  /* 单块复制：多厂商时复制其中一家，单模板时复制整个模板 */
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
    if (!text.trim()) {
      wx.showToast({ title: '没有可复制的命令', icon: 'none' });
      return;
    }
    if (text.length > 60000) {
      wx.showToast({ title: '内容过长，请逐个复制', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: d.copyToast, icon: 'success' })
    });
  }
});
