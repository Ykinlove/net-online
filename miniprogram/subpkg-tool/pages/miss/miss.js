const store = require('../../../utils/store.js');

Page({
  data: {
    list: [],
    total: 0
  },

  onShow() {
    store.init();
    const list = store.getSearchMiss().map(m => ({
      kw: m.kw,
      count: m.count || 1,
      time: this.timeText(m.ts)
    }));
    this.setData({ list, total: list.length });
  },

  timeText(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = n => (n < 10 ? '0' + n : '' + n);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  /* 点一条：带着这个词去搜索页，万一现在能搜到了 */
  goSearch(e) {
    const kw = e.currentTarget.dataset.kw;
    if (!kw) return;
    wx.navigateTo({ url: 'subpkg-tool/pages/search/search?kw=' + encodeURIComponent(kw) });
  },

  /* 复制全部：方便粘到微信/邮件里反馈 */
  copyAll() {
    const list = this.data.list;
    if (!list.length) {
      wx.showToast({ title: '还没有记录', icon: 'none' });
      return;
    }
    const text = list.map(m => m.kw + (m.count > 1 ? '（搜了' + m.count + '次）' : '')).join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制 ' + list.length + ' 条', icon: 'none' })
    });
  },

  clearAll() {
    wx.showModal({
      title: '清空记录',
      content: '这些是搜不到的说法清单，清空后就没了。确定？',
      success: (res) => {
        if (!res.confirm) return;
        store.clearSearchHistory();
        this.setData({ list: [], total: 0 });
        wx.showToast({ title: '已清空', icon: 'none' });
      }
    });
  }
});
