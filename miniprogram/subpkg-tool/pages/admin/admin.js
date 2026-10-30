// pages/admin/admin.js —— 内容管理发布页（作者入口，口令保护）
//
// 作用：作者在这里按 id / 关键词定位一条命令百科或模板，修正字段后发布到
// 云端 content_patch 集合。普通用户端启动时拉取该集合做热更新，无需发版。
//
// 权限说明：这里用「本地口令」做轻量保护，适合个人开发者。正式运营应改为
// 云函数鉴权（见 DATA_GUIDE.md 的热更新章节）。
const cmdbook = require('../../utils/cmdbook.js');
const hotfix = require('../../../utils/hotfix.js');

const ADMIN_PASS = 'net-admin-2026';

Page({
  data: {
    unlocked: false,
    passInput: '',
    kind: 'book',          // 'book' | 'tpl'
    query: '',
    found: null,           // 定位到的原始条目（含已生效的云端覆盖）
    foundKind: '',
    foundId: '',
    editName: '',
    editKw: '',
    editTip: '',
    vendors: [],           // [{ vendor, code }]
    note: '',
    existingPatch: null,   // 已有云端覆盖对象（业务字段）
    published: ''
  },

  onLoad() {
    const unlocked = wx.getStorageSync('admin_unlocked') === '1';
    this.setData({ unlocked });
  },

  onPassInput(e) { this.setData({ passInput: e.detail.value }); },
  unlock() {
    if (this.data.passInput === ADMIN_PASS) {
      wx.setStorageSync('admin_unlocked', '1');
      this.setData({ unlocked: true, passInput: '' });
    } else {
      wx.showToast({ title: '口令错误', icon: 'none' });
    }
  },
  logout() {
    wx.removeStorageSync('admin_unlocked');
    this.setData({ unlocked: false });
  },

  onKindChange(e) {
    this.setData({ kind: e.currentTarget.dataset.kind, found: null, published: '' });
  },
  onQuery(e) { this.setData({ query: e.detail.value }); },

  locate() {
    const kind = this.data.kind;
    const q = (this.data.query || '').trim();
    if (!q) { wx.showToast({ title: '请输入 id 或关键词', icon: 'none' }); return; }

    let item = null;
    if (kind === 'book') {
      item = cmdbook.findById(q);
      if (!item) {
        const r = cmdbook.search(q, '全部');
        if (r.length) item = cmdbook.findById(r[0].id);
      }
    } else {
      item = cmdbook.findTplById(q);
      if (!item) {
        const r = cmdbook.searchTemplates(q, 1);
        if (r.length) item = cmdbook.findTplById(r[0].id);
      }
    }
    if (!item) { wx.showToast({ title: '没找到该条目', icon: 'none' }); return; }
    this.loadEditor(kind, item);
  },

  loadEditor(kind, item) {
    const vendors = (item.cmds || []).map(function (c) {
      return { vendor: c[0], code: c[1] || '' };
    });
    this.setData({
      found: item,
      foundKind: kind,
      foundId: item.id,
      editName: item.name || '',
      editKw: (item.kw || []).join('，'),
      editTip: item.tip || '',
      vendors: vendors,
      note: '',
      existingPatch: hotfix.getPatch(kind, item.id),
      published: ''
    });
  },

  onName(e) { this.setData({ editName: e.detail.value }); },
  onKw(e) { this.setData({ editKw: e.detail.value }); },
  onTip(e) { this.setData({ editTip: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },
  onVendorCode(e) {
    const i = Number(e.currentTarget.dataset.i);
    const vendors = this.data.vendors.slice();
    vendors[i] = Object.assign({}, vendors[i], { code: e.detail.value });
    this.setData({ vendors: vendors });
  },

  publish() {
    const kind = this.data.foundKind;
    const id = this.data.foundId;
    const orig = this.data.found;
    if (!id) return;

    const fields = {};
    if (this.data.editName !== (orig.name || '')) fields.name = this.data.editName;

    const kwArr = this.data.editKw.split(/[，,\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (JSON.stringify(kwArr) !== JSON.stringify(orig.kw || [])) fields.kw = kwArr;

    if (this.data.editTip !== (orig.tip || '')) fields.tip = this.data.editTip;

    const newCmds = this.data.vendors.map(function (v) { return [v.vendor, v.code]; });
    if (JSON.stringify(newCmds) !== JSON.stringify(orig.cmds || [])) fields.cmds = newCmds;

    if (!Object.keys(fields).length) {
      wx.showToast({ title: '没有任何改动', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中' });
    hotfix.publishPatch(kind, id, fields, this.data.note)
      .then(() => {
        wx.hideLoading();
        this.setData({
          published: '已发布：' + Object.keys(fields).join(' / ') + '（云端与本地已更新）',
          existingPatch: hotfix.getPatch(kind, id)
        });
        wx.showToast({ title: '发布成功', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '发布失败：' + ((err && err.message) || err), icon: 'none' });
      });
  }
});
