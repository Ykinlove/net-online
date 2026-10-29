const store = require('../../utils/store.js');
const { DEVICES } = require('../../utils/seed.js');

Page({
  data: {
    devices: ['全部'].concat(DEVICES),
    devices2: DEVICES,
    filter: '全部',
    filterText: '全部设备',
    devCount: {},
    shown: [],
    total: 0,
    diag: '',
    diagErr: false,
    detail: null,
    formOpen: false,
    editingId: '',
    form: { device: 'Switch', title: '', content: '', desc: '', tags: '', date: '' },
    keyword: '',
    searching: false
  },

  onShow() {
    store.init();
    this.rebuild();
    const app = getApp();
    const act = app.globalData.pendingAction;
    if (act) {
      app.globalData.pendingAction = null;
      if (act.type === 'add-command') {
        setTimeout(() => this.openAdd(), 120);
      } else if (act.type === 'open-command') {
        const target = store.getList('commands').filter(c => c._id === act.id)[0];
        if (target) setTimeout(() => this.showDetail(target), 120);
      }
    }
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  rebuild() {
    const all = store.getList('commands').slice();
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const devCount = {};
    all.forEach(c => {
      const d = c.device || '其他设备';
      devCount[d] = (devCount[d] || 0) + 1;
    });

    const kw = (this.data.keyword || '').trim().toLowerCase();
    let list = all;
    if (this.data.filter !== '全部') list = list.filter(c => (c.device || '其他设备') === this.data.filter);
    if (kw) {
      list = list.filter(c =>
        String(c.title || '').toLowerCase().indexOf(kw) >= 0 ||
        String(c.content || '').toLowerCase().indexOf(kw) >= 0 ||
        String(c.desc || '').toLowerCase().indexOf(kw) >= 0
      );
    }

    const shown = list.map(c => ({
      _key: c._id || c._localId,
      _id: c._id || '',
      device: c.device || '其他设备',
      title: c.title || '(未命名命令)',
      preview: String(c.content || '').split('\n').slice(0, 2).join('\n'),
      content: c.content || '',
      desc: c.desc || '',
      skill: c.skill || '',
      tags: c.tags || ''
    }));

    const now = new Date();
    const diag = store.isReady()
      ? (store.mem.lastError ? ('同步异常：' + store.mem.lastError) : ('云端已连接 · 本地 ' + all.length + ' 条 · 更新于 ' + now.toTimeString().slice(0, 5)))
      : '未连接云开发，数据只存在本机';

    this.setData({
      shown,
      total: all.length,
      devCount,
      diag,
      diagErr: !!store.mem.lastError,
      filterText: this.data.filter === '全部' ? '全部设备' : this.data.filter
    });
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.v }, () => this.rebuild());
  },

  toggleSearch() {
    this.setData({ searching: !this.data.searching, keyword: '' }, () => this.rebuild());
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.rebuild());
  },

  async refresh() {
    wx.showLoading({ title: '同步中', mask: true });
    const res = await store.pullAll();
    wx.hideLoading();
    this.rebuild();
    if (!res.ok) {
      wx.showToast({ title: '同步失败，已用本地数据', icon: 'none', duration: 2000 });
    }
  },

  noop() {},

  /* ---------- 详情 ---------- */
  openDetail(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    this.showDetail(this.data.shown[idx]);
  },

  showDetail(item) {
    if (!item) return;
    this._detailKey = item._key;
    this.setData({ detail: item });
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  copyCmd() {
    const d = this.data.detail;
    if (!d) return;
    wx.setClipboardData({
      data: d.content,
      success: () => wx.showToast({ title: '命令已复制', icon: 'success' })
    });
  },

  /* ---------- 新增 / 编辑 ---------- */
  openAdd() {
    this.setData({
      formOpen: true,
      editingId: '',
      form: {
        device: this.data.filter === '全部' ? 'Switch' : this.data.filter,
        title: '', content: '', desc: '', tags: '',
        date: store.today()
      }
    });
  },

  openEdit() {
    const d = this.data.detail;
    if (!d) return;
    const rec = store.getList('commands').filter(c => (c._id || c._localId) === d._key)[0] || {};
    this.setData({
      detail: null,
      formOpen: true,
      editingId: d._key,
      form: {
        device: rec.device || 'Switch',
        title: rec.title || '',
        content: rec.content || '',
        desc: rec.desc || '',
        tags: rec.tags || '',
        date: String(rec.date || store.today()).slice(0, 10)
      }
    });
  },

  closeForm() {
    this.setData({ formOpen: false });
  },

  onFormInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  pickDevice(e) {
    this.setData({ 'form.device': e.currentTarget.dataset.v });
  },

  async saveForm() {
    const f = this.data.form;
    if (!(f.title || '').trim()) { wx.showToast({ title: '标题不能为空', icon: 'none' }); return; }
    if (!(f.content || '').trim()) { wx.showToast({ title: '命令内容不能为空', icon: 'none' }); return; }

    const payload = {
      date: f.date || store.today(),
      device: f.device,
      title: f.title.trim(),
      content: f.content,
      desc: (f.desc || '').trim(),
      tags: (f.tags || '').trim(),
      skill: ''
    };

    wx.showLoading({ title: '保存中', mask: true });
    if (this.data.editingId) {
      const rec = store.getList('commands').filter(c => (c._id || c._localId) === this.data.editingId)[0];
      if (rec) await store.updateRecord('commands', rec, payload);
    } else {
      await store.addRecord('commands', payload);
    }
    wx.hideLoading();
    this.setData({ formOpen: false });
    this.rebuild();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  /* ---------- 编辑弹层内的删除 ---------- */
  deleteFromForm() {
    const key = this.data.editingId;
    if (!key) return;
    const rec = store.getList('commands').filter(c => (c._id || c._localId) === key)[0];
    if (!rec) { wx.showToast({ title: '记录不存在', icon: 'none' }); return; }

    wx.showModal({
      title: '确认删除',
      content: '删错了可以在「我的 → 存档库」恢复，确定删除？',
      confirmColor: '#d9534f',
      success: async r => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        store.snapshot('删除命令前');
        await store.removeRecord('commands', rec);
        wx.hideLoading();
        this.setData({ formOpen: false, editingId: '', detail: null });
        this.rebuild();
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  },

  /* ---------- 删除 ---------- */
  askDelete() {
    const d = this.data.detail;
    if (!d) return;
    const key = d._key;
    const rec = store.getList('commands').filter(c => (c._id || c._localId) === key)[0];
    if (!rec) return;

    const doDelete = async () => {
      wx.showLoading({ title: '删除中', mask: true });
      store.snapshot('删除命令前');
      await store.removeRecord('commands', rec);
      wx.hideLoading();
      this.setData({ detail: null });
      this.rebuild();
      wx.showToast({ title: '已删除', icon: 'success' });
    };

    wx.showModal({
      title: '确认删除',
      content: '删错了可以在「我的 → 存档库」恢复，确定删除？',
      confirmColor: '#d9534f',
      success: r => { if (r.confirm) doDelete(); }
    });
  }
});
