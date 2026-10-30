// app.js —— Net 操作命令速记
// 云开发环境：net-online-d7g1ig4c6f07a8abb
const ENV = 'net-online-d7g1ig4c6f07a8abb';

App({
  globalData: {
    env: ENV,
    cloudReady: false,
    envError: '',
    profile: null,
    pendingNavigate: ''
  },

  onLaunch() {
    if (!wx.cloud) {
      this.globalData.envError = '当前基础库过低，请升级微信后重试';
    } else {
      try {
        wx.cloud.init({ env: ENV, traceUser: true });
        this.globalData.cloudReady = true;
      } catch (e) {
        this.globalData.envError = (e && e.message) || '云开发初始化失败';
      }
    }
    /* 云端内容热更新：启动后台静默拉取补丁，不阻塞首屏 */
    try { require('./utils/hotfix.js').refresh(); } catch (e) {}
  }
});
