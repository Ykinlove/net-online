const store = require('../../../utils/store.js');
const { computeCategoryLevels } = require('../../../utils/skill.js');

const STATUS_LIST = [
  { k: 'want', name: '想学' },
  { k: 'learning', name: '学习中' },
  { k: 'lit', name: '已点亮' }
];

function statusText(s) {
  if (s === 'learning') return '学习中';
  if (s === 'lit') return '已点亮';
  return '想学';
}
function statusClass(s) {
  if (s === 'learning') return 's-learning';
  if (s === 'lit') return 's-lit';
  return '';
}

Page({
  data: {
    cats: [],
    tabs: [],
    tab: 'all',
    list: [],
    statusList: STATUS_LIST,
    formOpen: false,
    form: { name: '', status: 'want', goalText: '' }
  },

  onShow() {
    store.init();
    this.rebuild();
  },

  rebuild() {
    const skills = store.getList('skills');
    const cats = computeCategoryLevels(store.getList('commands'), store.getList('projects'), skills);

    const n = k => skills.filter(s => (s.status || 'want') === k).length;
    const tabs = [
      { key: 'all', name: '全部', n: skills.length },
      { key: 'learning', name: '在学', n: n('learning') },
      { key: 'want', name: '想学', n: n('want') },
      { key: 'lit', name: '点亮', n: n('lit') }
    ];

    const tab = this.data.tab;
    const list = skills
      .filter(s => tab === 'all' || (s.status || 'want') === tab)
      .map(s => ({
        _key: s._id || s._localId,
        name: s.name || '',
        goalText: s.goalText || '',
        status: s.status || 'want',
        statusText: statusText(s.status || 'want'),
        statusClass: statusClass(s.status || 'want')
      }));

    this.setData({ cats, tabs, list });
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.v }, () => this.rebuild());
  },

  openAdd() {
    this.setData({ formOpen: true, form: { name: '', status: 'want', goalText: '' } });
  },
  closeForm() {
    this.setData({ formOpen: false });
  },
  noop() {},

  onFormInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  pickStatus(e) {
    this.setData({ 'form.status': e.currentTarget.dataset.v });
  },

  async saveForm() {
    const f = this.data.form;
    if (!(f.name || '').trim()) {
      wx.showToast({ title: '技能名不能为空', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中', mask: true });
    await store.addRecord('skills', {
      name: f.name.trim(),
      status: f.status,
      goalText: (f.goalText || '').trim(),
      progressNote: '',
      confirmedAt: f.status === 'lit' ? store.today() : ''
    });
    wx.hideLoading();
    this.setData({ formOpen: false });
    this.rebuild();
    wx.showToast({ title: '已添加', icon: 'success' });
  },

  async cycleStatus(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.list[idx];
    if (!item) return;
    const rec = store.getList('skills').filter(s => (s._id || s._localId) === item._key)[0];
    if (!rec) return;
    const order = ['want', 'learning', 'lit'];
    const cur = rec.status || 'want';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    await store.updateRecord('skills', rec, { status: next, confirmedAt: next === 'lit' ? store.today() : (rec.confirmedAt || '') });
    this.rebuild();
    wx.showToast({ title: '已切换为「' + statusText(next) + '」', icon: 'none' });
  },

  askDelete(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.list[idx];
    if (!item) return;
    const rec = store.getList('skills').filter(s => (s._id || s._localId) === item._key)[0];
    if (!rec) return;

    const doDelete = async () => {
      store.snapshot('删除技能前');
      await store.removeRecord('skills', rec);
      this.rebuild();
      wx.showToast({ title: '已删除', icon: 'success' });
    };

    wx.showModal({
      title: '确认删除',
      content: '删除「' + item.name + '」？删错了可以在存档库恢复。',
      confirmColor: '#d9534f',
      success: r => { if (r.confirm) doDelete(); }
    });
  }
});
