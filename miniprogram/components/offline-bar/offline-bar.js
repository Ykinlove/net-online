// components/offline-bar/offline-bar.js
// 自我订阅离线状态：断网 → 提示「本地命令库已就绪」；同步中 → 轻提示；
// 离线时提供「重新加载」按钮（联网后真正拉取）。搜索永远可用，故不做吓人报错。
const offline = require('../../utils/cmd-offline.js');

Component({
  data: {
    visible: false,
    mode: 'offline',   // 'offline' | 'syncing'
    text: '',
    count: 0,
    showReload: false
  },

  lifetimes: {
    attached() {
      const self = this;
      this._off = offline.onStatus(function (s) { self._render(s); });
      this._render(offline.getStatus());
    },
    detached() {
      if (this._off) this._off();
    }
  },

  methods: {
    _render(s) {
      if (s.syncing) {
        this.setData({
          visible: true,
          mode: 'syncing',
          text: '正在更新命令库…',
          count: s.count,
          showReload: false
        });
        return;
      }
      if (!s.online) {
        const tail = s.count
          ? '已加载本地命令库 ' + s.count + ' 条，联网可获取云端更新'
          : '已加载本地内置命令库，联网可获取云端更新';
        this.setData({
          visible: true,
          mode: 'offline',
          text: '离线模式 · ' + tail,
          count: s.count,
          showReload: true
        });
        return;
      }
      this.setData({ visible: false });
    },

    onReload() {
      wx.showToast({ title: '正在重新加载…', icon: 'none' });
      offline.reload().then(function () {
        wx.showToast({ title: '已尝试更新', icon: 'none' });
      });
    }
  }
});
