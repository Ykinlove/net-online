// pages/contribute/contribute.js —— 社区投稿（普通用户可用，不需集成到内容管理）
//
// 用户可：① 新增一条命令百科 / 配置模板；② 修改已有条目。
// 提交后写 contributions（status=pending），由作者在小程序管理页审核通过后才生效。
//
// 数据结构：
//   命令百科 book：{ id, devs, name, kw:[], cmds:[[厂商,命令],...], tip }
//   配置模板 tpl ：{ id, kw:[], cat, name, vendor, code, note }
const cmdbook = require('../../utils/cmdbook.js');
const contrib = require('../../../utils/contrib.js');

const DEFAULT_DEVS = ['Switch', 'Router', 'AC', 'AP', '防火墙'];

Page({
  onShow() {
    getApp().applyTheme(this);
  },
  data: {
    type: 'add',            // 'add' | 'edit'
    kind: 'book',          // 'book' | 'tpl'
    query: '',
    locatedId: '',         // 修改类：定位到的目标 id

    // 命令百科字段
    bName: '', bKw: '', bTip: '', bDevs: DEFAULT_DEVS.join('，'),
    bVendors: [{ vendor: '', code: '' }],

    // 配置模板字段
    tName: '', tCat: '', tKw: '', tVendor: '', tCode: '', tNote: '',

    newId: '',             // 新增类：可选短 id，留空自动生成
    submitted: '',
    error: '',

    /* 视觉态（纯新增，不参与业务逻辑） */
    focusKey: '',
    copiedCode: ''
  },

  onType(e) { this.setData({ type: e.currentTarget.dataset.t, locatedId: '', submitted: '', error: '' }); },
  onKind(e) {
    this.setData({ kind: e.currentTarget.dataset.k, locatedId: '', submitted: '', error: '' });
  },

  onQuery(e) { this.setData({ query: e.detail.value }); },

  /* 修改类：定位已有条目并回填 */
  locate() {
    const kind = this.data.kind;
    const q = (this.data.query || '').trim();
    if (!q) { wx.showToast({ title: '请输入 id 或关键词', icon: 'none' }); return; }
    let item = kind === 'book' ? cmdbook.findById(q) : cmdbook.findTplById(q);
    if (!item && kind === 'book') {
      const r = cmdbook.search(q, '全部');
      if (r.length) item = cmdbook.findById(r[0].id);
    } else if (!item) {
      const r = cmdbook.searchTemplates(q, 1);
      if (r.length) item = cmdbook.findTplById(r[0].id);
    }
    if (!item) { wx.showToast({ title: '没找到该条目', icon: 'none' }); return; }
    if (kind === 'book') {
      this.setData({
        locatedId: item.id,
        bName: item.name || '',
        bKw: (item.kw || []).join('，'),
        bTip: item.tip || '',
        bDevs: (item.devs || DEFAULT_DEVS).join('，'),
        bVendors: (item.cmds || []).map(function (c) { return { vendor: c[0], code: c[1] || '' }; }) || [{ vendor: '', code: '' }],
        submitted: '', error: ''
      });
    } else {
      this.setData({
        locatedId: item.id,
        tName: item.name || '',
        tCat: item.cat || '',
        tKw: (item.kw || []).join('，'),
        tVendor: item.vendor || '',
        tCode: item.code || '',
        tNote: item.note || '',
        submitted: '', error: ''
      });
    }
    wx.showToast({ title: '已定位，可修改后提交', icon: 'none' });
  },

  /* —— 百科字段 —— */
  onBName(e) { this.setData({ bName: e.detail.value }); },
  onBKw(e) { this.setData({ bKw: e.detail.value }); },
  onBTip(e) { this.setData({ bTip: e.detail.value }); },
  onBDevs(e) { this.setData({ bDevs: e.detail.value }); },
  onBVendor(e) {
    const i = Number(e.currentTarget.dataset.i);
    const bVendors = this.data.bVendors.slice();
    bVendors[i] = Object.assign({}, bVendors[i], { vendor: e.detail.value });
    this.setData({ bVendors: bVendors });
  },
  onBCode(e) {
    const i = Number(e.currentTarget.dataset.i);
    const bVendors = this.data.bVendors.slice();
    bVendors[i] = Object.assign({}, bVendors[i], { code: e.detail.value });
    this.setData({ bVendors: bVendors });
  },
  addVendor() {
    if (this.data.bVendors.length >= 6) { wx.showToast({ title: '最多 6 个厂商', icon: 'none' }); return; }
    this.setData({ bVendors: this.data.bVendors.concat([{ vendor: '', code: '' }]) });
  },
  delVendor(e) {
    const i = Number(e.currentTarget.dataset.i);
    const bVendors = this.data.bVendors.slice();
    bVendors.splice(i, 1);
    if (!bVendors.length) bVendors.push({ vendor: '', code: '' });
    this.setData({ bVendors: bVendors });
  },

  /* —— 模板字段 —— */
  onTName(e) { this.setData({ tName: e.detail.value }); },
  onTCat(e) { this.setData({ tCat: e.detail.value }); },
  onTKw(e) { this.setData({ tKw: e.detail.value }); },
  onTVendor(e) { this.setData({ tVendor: e.detail.value }); },
  onTCode(e) { this.setData({ tCode: e.detail.value }); },
  onTNote(e) { this.setData({ tNote: e.detail.value }); },

  onNewId(e) { this.setData({ newId: e.detail.value }); },

  /* ---------- 视觉态：输入框聚焦 + 代码块复制（纯新增） ---------- */
  onFieldFocus(e) { this.setData({ focusKey: e.currentTarget.dataset.k || '' }); },
  onFieldBlur() { this.setData({ focusKey: '' }); },

  onCopyCode(e) {
    const code = e.currentTarget.dataset.code || '';
    wx.vibrateShort({ type: 'light' });
    wx.setClipboardData({ data: code });
    this.setData({ copiedCode: code });
    clearTimeout(this._copyTimer);
    this._copyTimer = setTimeout(() => this.setData({ copiedCode: '' }), 1600);
  },

  /* 组装并提交 */
  submit() {
    const type = this.data.type;
    const kind = this.data.kind;
    const kwOf = (s) => (s || '').split(/[，,\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    let fields = {};
    let targetId = '';
    let id = '';

    if (kind === 'book') {
      if (!this.data.bName.trim()) { this.setData({ error: '请填写名称' }); return; }
      const cmds = this.data.bVendors
        .filter(function (v) { return v.vendor.trim() && v.code.trim(); })
        .map(function (v) { return [v.vendor.trim(), v.code.trim()]; });
      if (!cmds.length) { this.setData({ error: '请至少填写一个厂商的命令' }); return; }
      fields = {
        name: this.data.bName.trim(),
        kw: kwOf(this.data.bKw),
        tip: this.data.bTip.trim(),
        cmds: cmds
      };
      if (type === 'add') {
        fields.devs = kwOf(this.data.bDevs).length ? kwOf(this.data.bDevs) : DEFAULT_DEVS.slice();
        id = this.data.newId.trim() || ('u-book-' + Date.now());
        fields.id = id;
      } else {
        targetId = this.data.locatedId;
        if (!targetId) { this.setData({ error: '请先定位要修改的条目' }); return; }
      }
    } else {
      if (!this.data.tName.trim()) { this.setData({ error: '请填写模板名称' }); return; }
      if (!this.data.tCode.trim()) { this.setData({ error: '请填写命令 code' }); return; }
      fields = {
        name: this.data.tName.trim(),
        cat: this.data.tCat.trim(),
        kw: kwOf(this.data.tKw),
        vendor: this.data.tVendor.trim(),
        code: this.data.tCode.trim(),
        note: this.data.tNote.trim()
      };
      if (type === 'add') {
        id = this.data.newId.trim() || ('u-tpl-' + Date.now());
        fields.id = id;
      } else {
        targetId = this.data.locatedId;
        if (!targetId) { this.setData({ error: '请先定位要修改的条目' }); return; }
      }
    }

    wx.showLoading({ title: '提交中' });
    contrib.submit(kind, type, targetId, fields)
      .then((res) => {
        wx.hideLoading();
        if (res.ok) {
          this.setData({ submitted: '已提交，等待作者审核通过后生效。可继续提交下一条。', error: '' });
          wx.showToast({ title: '提交成功', icon: 'success' });
        } else {
          this.setData({ error: res.msg || '提交失败' });
          wx.showToast({ title: '提交失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ error: ((err && err.message) || String(err)) });
        wx.showToast({ title: '提交异常', icon: 'none' });
      });
  },

  reset() {
    this.setData({
      query: '', locatedId: '',
      bName: '', bKw: '', bTip: '', bDevs: DEFAULT_DEVS.join('，'), bVendors: [{ vendor: '', code: '' }],
      tName: '', tCat: '', tKw: '', tVendor: '', tCode: '', tNote: '',
      newId: '', submitted: '', error: ''
    });
  }
});
