// app.js —— Net 操作命令速记
// 云开发环境：net-online-d7g1ig4c6f07a8abb
const ENV = 'net-online-d7g1ig4c6f07a8abb';

App({
  globalData: {
    env: ENV,
    cloudReady: false,
    envError: '',
    profile: null,
    pendingNavigate: '',
    /* 热更新模块句柄：便于调试 / 自动化脚本直接操作缓存与索引 */
    hotfix: null
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
    try {
      const hotfix = require('./utils/hotfix.js');
      this.globalData.hotfix = hotfix;
      hotfix.refresh();
    } catch (e) {}
  }
});
