const store = require('../../utils/store.js');

const STATUS = ['进行中', '已完成', '已暂停'];

function rangeLabel(p) {
  const s = store.formatShortDate(p.startDate || p.date);
  const e = store.formatShortDate(p.endDate);
  if (!s) return '';
  return e ? (s + ' ~ ' + e) : (s + ' 起');
}

function statusClass(s) {
  if (s === '已完成') return 's-done';
  if (s === '已暂停') return 's-pause';
  return '';
}

Page({
  data: {
    statusList: STATUS,
    shown: [],
    total: 0,
    diag: '',
    diagErr: false,
    detail: null,
    formOpen: false,
    editingId: '',
    form: { name: '', status: '进行中', role: '', content: '', devices: '', tags: '', startDate: '', endDate: '' }
  },

  onShow() {
    store.init();
    this.rebuild();
    const app = getApp();
    const act = app.globalData.pendingAction;
    if (act && act.type === 'add-project') {
      app.globalData.pendingAction = null;
      setTimeout(() => this.openAdd(), 120);
    }
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  rebuild() {
    const all = store.getList('projects').slice();
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const shown = all.map(p => {
      const raw = String(p.tags || '');
      return {
        _key: p._id || p._localId,
        _id: p._id || '',
        name: p.name || '(未命名项目)',
        status: p.status || '进行中',
        statusClass: statusClass(p.status || '进行中'),
        role: p.role || '',
        content: p.content || '',
        devices: p.devices || '',
        cmds: p.cmds || '',
        preview: String(p.content || '（没有填写项目内容）').slice(0, 90),
        dateLabel: rangeLabel(p),
        tagList: raw ? raw.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 4) : []
      };
    });

    const now = new Date();
    const diag = store.isReady()
      ? (store.mem.lastError ? ('同步异常：' + store.mem.lastError) : ('云端已连接 · 本地 ' + all.length + ' 个 · 更新于 ' + now.toTimeString().slice(0, 5)))
      : '未连接云开发，数据只存在本机';

    this.setData({ shown, total: all.length, diag, diagErr: !!store.mem.lastError });
  },

  async refresh() {
    wx.showLoading({ title: '同步中', mask: true });
    const res = await store.pullAll();
    wx.hideLoading();
    this.rebuild();
    if (!res.ok) wx.showToast({ title: '同步失败，已用本地数据', icon: 'none', duration: 2000 });
  },

  noop() {},

  openDetail(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.shown[idx];
    if (!item) return;
    this.setData({ detail: item });
  },
  closeDetail() {
    this.setData({ detail: null });
  },

  openAdd() {
    this.setData({
      formOpen: true,
      editingId: '',
      form: { name: '', status: '进行中', role: '', content: '', devices: '', tags: '', startDate: store.today(), endDate: '' }
    });
  },

  openEdit() {
    const d = this.data.detail;
    if (!d) return;
    const rec = store.getList('projects').filter(p => (p._id || p._localId) === d._key)[0] || {};
    this.setData({
      detail: null,
      formOpen: true,
      editingId: d._key,
      form: {
        name: rec.name || '',
        status: rec.status || '进行中',
        role: rec.role || '',
        content: rec.content || '',
        devices: rec.devices || '',
        tags: rec.tags || '',
        startDate: String(rec.startDate || rec.date || store.today()).slice(0, 10),
        endDate: String(rec.endDate || '').slice(0, 10)
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

  pickStatus(e) {
    this.setData({ 'form.status': e.currentTarget.dataset.v });
  },

  onStartDate(e) {
    this.setData({ 'form.startDate': e.detail.value });
  },

  onEndDate(e) {
    this.setData({ 'form.endDate': e.detail.value });
  },

  clearEndDate() {
    this.setData({ 'form.endDate': '' });
  },

  async saveForm() {
    const f = this.data.form;
    if (!(f.name || '').trim()) {
      wx.showToast({ title: '项目名称不能为空', icon: 'none' });
      return;
    }
    const startDate = f.startDate || store.today();
    const payload = {
      date: startDate,
      startDate,
      endDate: f.endDate || '',
      name: f.name.trim(),
      status: f.status,
      role: (f.role || '').trim(),
      content: f.content || '',
      devices: (f.devices || '').trim(),
      cmds: '',
      tags: (f.tags || '').trim(),
      skill: ''
    };
    wx.showLoading({ title: '保存中', mask: true });
    if (this.data.editingId) {
      const rec = store.getList('projects').filter(p => (p._id || p._localId) === this.data.editingId)[0];
      if (rec) await store.updateRecord('projects', rec, payload);
    } else {
      await store.addRecord('projects', payload);
    }
    wx.hideLoading();
    this.setData({ formOpen: false });
    this.rebuild();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  askDelete() {
    const d = this.data.detail;
    if (!d) return;
    const rec = store.getList('projects').filter(p => (p._id || p._localId) === d._key)[0];
    if (!rec) return;

    const doDelete = async () => {
      wx.showLoading({ title: '删除中', mask: true });
      store.snapshot('删除项目前');
      await store.removeRecord('projects', rec);
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
