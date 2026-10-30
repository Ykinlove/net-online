// pages/admin/admin.js —— 内容管理发布页（作者入口，口令保护）
//
// 作用：作者在这里按 id / 关键词定位一条命令百科或配置模板，修正字段后发布到
// 云端 content_patch 集合。普通用户端启动时拉取该集合做热更新，无需发版。
//
// 权限说明：这里用「本地口令」做轻量保护，适合个人开发者。正式运营应改为
// 云函数鉴权（见 DATA_GUIDE.md 的热更新章节）。
//
// 数据结构差异（决定两套编辑字段）：
//   命令百科 book：{ id, devs, name, kw:[], cmds:[[厂商,命令],...], tip }
//   配置模板 tpl ：{ id, kw:[], cat, name, vendor, code, note }
const cmdbook = require('../../utils/cmdbook.js');
const hotfix = require('../../../utils/hotfix.js');
const contrib = require('../../../utils/contrib.js');

const ADMIN_PASS = 'net-admin-2026';

// 待审核卡片的字段摘要（只读预览用）
function buildSummary(kind, f) {
  const parts = [];
  if (kind === 'book') {
    if (f.kw && f.kw.length) parts.push('别名：' + f.kw.join('，'));
    if (f.tip) parts.push('易错点：' + f.tip);
    if (f.cmds && f.cmds.length) parts.push('厂商命令 ' + f.cmds.length + ' 条');
  } else {
    if (f.cat) parts.push('分类：' + f.cat);
    if (f.kw && f.kw.length) parts.push('别名：' + f.kw.join('，'));
    if (f.code) parts.push('code：' + f.code.replace(/\n/g, ' ').slice(0, 80));
    if (f.note) parts.push('说明：' + f.note);
  }
  return parts.join('\n') || '（无字段）';
}

Page({
  data: {
    unlocked: false,
    passInput: '',
    kind: 'book',          // 'book' | 'tpl'
    query: '',

    found: null,           // 定位到的原始条目（含已生效的云端覆盖）
    foundKind: '',
    foundId: '',

    /* —— 命令百科编辑字段 —— */
    bName: '',
    bKw: '',
    bTip: '',
    bVendors: [],          // [{ vendor, code }]，由 item.cmds 映射而来

    /* —— 配置模板编辑字段 —— */
    tName: '',
    tCat: '',
    tKw: '',
    tVendor: '',
    tCode: '',
    tNote: '',

    existingPatch: null,   // 已有云端覆盖对象（业务字段）
    published: '',
    note: '',              // 本次发布的备注（写入云端记录的 remark）

    tab: 'edit',           // 'edit' 编辑发布 | 'review' 待审核
    pending: [],           // 待审核投稿列表
    pendingErr: '',
    pendingLoading: false
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

  /* 把定位到的条目灌进对应的一套编辑字段。
     这里分别处理 book 的 cmds:[[vendor,code]] 和 tpl 的单段 code/vendor，
     避免把模板当百科去读 cmds 导致编辑区空白。 */
  loadEditor(kind, item) {
    if (kind === 'book') {
      this.setData({
        found: item,
        foundKind: 'book',
        foundId: item.id,
        bName: item.name || '',
        bKw: (item.kw || []).join('，'),
        bTip: item.tip || '',
        bVendors: (item.cmds || []).map(function (c) {
          return { vendor: c[0], code: c[1] || '' };
        }),
        /* 清掉模板字段，避免切类型后残留 */
        tName: '', tCat: '', tKw: '', tVendor: '', tCode: '', tNote: '',
        existingPatch: hotfix.getPatch('book', item.id),
        published: '', note: ''
      });
    } else {
      this.setData({
        found: item,
        foundKind: 'tpl',
        foundId: item.id,
        tName: item.name || '',
        tCat: item.cat || '',
        tKw: (item.kw || []).join('，'),
        tVendor: item.vendor || '',
        tCode: item.code || '',
        tNote: item.note || '',
        /* 清掉百科字段，避免切类型后残留 */
        bName: '', bKw: '', bTip: '', bVendors: [],
        existingPatch: hotfix.getPatch('tpl', item.id),
        published: '', note: ''
      });
    }
  },

  /* —— 百科编辑事件 —— */
  onBName(e) { this.setData({ bName: e.detail.value }); },
  onBKw(e) { this.setData({ bKw: e.detail.value }); },
  onBTip(e) { this.setData({ bTip: e.detail.value }); },
  onBCode(e) {
    const i = Number(e.currentTarget.dataset.i);
    const bVendors = this.data.bVendors.slice();
    bVendors[i] = Object.assign({}, bVendors[i], { code: e.detail.value });
    this.setData({ bVendors: bVendors });
  },

  /* —— 模板编辑事件 —— */
  onTName(e) { this.setData({ tName: e.detail.value }); },
  onTCat(e) { this.setData({ tCat: e.detail.value }); },
  onTKw(e) { this.setData({ tKw: e.detail.value }); },
  onTVendor(e) { this.setData({ tVendor: e.detail.value }); },
  onTCode(e) { this.setData({ tCode: e.detail.value }); },
  onTNote(e) { this.setData({ tNote: e.detail.value }); },

  onNote(e) { this.setData({ note: e.detail.value }); },

  /* ---------- 待审核（社区投稿） ---------- */
  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab: tab });
    if (tab === 'review') this.loadPending();
  },

  loadPending() {
    this.setData({ pendingLoading: true, pendingErr: '' });
    contrib.listPending()
      .then((res) => {
        if (res.ok) {
          // 给每条补充展示用的标题与摘要
          const list = (res.list || []).map(function (c) {
            const f = c.fields || {};
            return {
              _id: c._id,
              kind: c.kind,
              type: c.type,
              targetId: c.targetId || '',
              title: f.name || (c.type === 'add' ? '（新条目）' : c.targetId),
              summary: buildSummary(c.kind, f),
              fields: f
            };
          });
          this.setData({ pending: list, pendingLoading: false });
        } else {
          this.setData({ pendingErr: res.msg || '加载失败', pendingLoading: false });
        }
      })
      .catch((err) => {
        this.setData({ pendingErr: ((err && err.message) || String(err)), pendingLoading: false });
      });
  },

  approve(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.findPending(id);
    if (!item) return;
    wx.showLoading({ title: '通过中' });
    contrib.approve(id, item.fields, '')
      .then((res) => {
        wx.hideLoading();
        if (res && res.ok) {
          this.removePending(id);
          wx.showToast({ title: '已通过', icon: 'success' });
        } else {
          wx.showToast({ title: (res && res.msg) || '通过失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '通过异常', icon: 'none' });
      });
  },

  reject(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '驳回中' });
    contrib.reject(id, '')
      .then((res) => {
        wx.hideLoading();
        if (res && res.ok) {
          this.removePending(id);
          wx.showToast({ title: '已驳回', icon: 'success' });
        } else {
          wx.showToast({ title: (res && res.msg) || '驳回失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '驳回异常', icon: 'none' });
      });
  },

  findPending(id) {
    const list = this.data.pending;
    for (let i = 0; i < list.length; i++) if (list[i]._id === id) return list[i];
    return null;
  },
  removePending(id) {
    this.setData({ pending: this.data.pending.filter(function (x) { return x._id !== id; }) });
  },

  /* 发布：只上传「被改动的字段」（增量），写进 content_patch。 */
  publish() {
    const kind = this.data.foundKind;
    const id = this.data.foundId;
    const orig = this.data.found;
    if (!id) return;

    const fields = {};
    let changed = false;
    const kwOf = (s) => (s || '').split(/[，,\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);

    if (kind === 'book') {
      if (this.data.bName !== (orig.name || '')) { fields.name = this.data.bName; changed = true; }
      const kwArr = kwOf(this.data.bKw);
      if (JSON.stringify(kwArr) !== JSON.stringify(orig.kw || [])) { fields.kw = kwArr; changed = true; }
      if (this.data.bTip !== (orig.tip || '')) { fields.tip = this.data.bTip; changed = true; }
      const newCmds = this.data.bVendors.map(function (v) { return [v.vendor, v.code]; });
      if (JSON.stringify(newCmds) !== JSON.stringify(orig.cmds || [])) { fields.cmds = newCmds; changed = true; }
    } else {
      if (this.data.tName !== (orig.name || '')) { fields.name = this.data.tName; changed = true; }
      if (this.data.tCat !== (orig.cat || '')) { fields.cat = this.data.tCat; changed = true; }
      const kwArr = kwOf(this.data.tKw);
      if (JSON.stringify(kwArr) !== JSON.stringify(orig.kw || [])) { fields.kw = kwArr; changed = true; }
      if (this.data.tVendor !== (orig.vendor || '')) { fields.vendor = this.data.tVendor; changed = true; }
      if (this.data.tCode !== (orig.code || '')) { fields.code = this.data.tCode; changed = true; }
      if (this.data.tNote !== (orig.note || '')) { fields.note = this.data.tNote; changed = true; }
    }

    if (!changed) {
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
