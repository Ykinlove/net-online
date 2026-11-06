const themeColors = require('../../../utils/theme-colors.js');
const store = require('../../../utils/store.js');

function two(n) { return String(n).padStart(2, '0'); }

Page({
  data: { list: [] },

  onShow() {
    getApp().applyTheme(this);
    store.init();
    this.rebuild();
  },

  rebuild() {
    const list = store.getSnapshots().map(s => {
      const d = new Date(s.at || Date.now());
      const p = s.payload || {};
      return {
        at: s.at,
        reason: s.reason || '自动存档',
        timeLabel: (d.getMonth() + 1) + '/' + d.getDate() + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()),
        cmdCount: p.cmdCount || 0,
        projectCount: p.projectCount || 0,
        skillCount: p.skillCount || 0
      };
    });
    this.setData({ list });
  },

  restore(e) {
    const at = Number(e.currentTarget.dataset.at);
    const snap = store.getSnapshots().filter(s => s.at === at)[0];
    if (!snap) return;

    wx.showModal({
      title: '恢复这份存档',
      content: '会把命令、项目、技能、档案全部还原到当时的状态，之后新增的内容会被移除。确定吗？',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '恢复中', mask: true });
        // 恢复前先存一份当前状态，免得恢复错了回不去
        store.snapshot('恢复存档前');
        await store.applySnapshot(snap);
        wx.hideLoading();
        this.rebuild();
        wx.showToast({ title: '已恢复', icon: 'success' });
      }
    });
  },

  askDelete(e) {
    const at = Number(e.currentTarget.dataset.at);
    wx.showModal({
      title: '删除存档',
      content: '删除这份存档？删除后无法恢复。',
      confirmColor: themeColors.get('danger'),
      success: r => {
        if (!r.confirm) return;
        store.removeSnapshot(at);
        this.rebuild();
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  }
});
