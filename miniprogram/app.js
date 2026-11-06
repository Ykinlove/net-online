// app.js —— Net 操作命令速记
// 云开发环境：net-online-d7g1ig4c6f07a8abb
const ENV = 'net-online-d7g1ig4c6f07a8abb';
const THEME_KEY = 'ui_theme_mode'; // 'system' | 'light' | 'dark'
const MOTION_KEY = 'ui_motion_dur'; // 全局过渡时长，由设置页的液态滑块调节

// Offline First：启动即建立网络感知 + 本地缓存预热（搜索离线可用）
const offline = require('./utils/cmd-offline.js');

function readThemeMode() {
  try {
    const m = wx.getStorageSync(THEME_KEY);
    return m === 'light' || m === 'dark' ? m : 'system';
  } catch (e) {
    return 'system';
  }
}

function readSystemTheme() {
  try {
    // app.json 打开 darkmode 后，getSystemInfoSync 才会返回 theme
    return wx.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

App({
  globalData: {
    env: ENV,
    cloudReady: false,
    envError: '',
    profile: null,
    pendingNavigate: '',
    /* 热更新模块句柄：便于调试 / 自动化脚本直接操作缓存与索引 */
    hotfix: null,
    /* 外观：themeMode 是用户在设置页选的值，theme 是最终生效值 */
    themeMode: 'system',
    theme: 'light',
    motionDur: 0.28
  },

  onLaunch() {
    this.initTheme();

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
      /* 冷启动强制拉一次（绕过 TTL）—— 首次进入要拿到最新的云端内容。
         页面进出的常规调用走 TTL，不重复打云端。 */
      hotfix.refresh(true);
    } catch (e) {}

    /* Offline First：网络感知 + 本地缓存预热。内置种子永远兜底，
       云端同步只在后台进行，不阻塞首屏。 */
    try {
      this.globalData.offline = offline;
      offline.initNetwork();
      this.globalData.online = offline.getStatus().online;
    } catch (e) {}
  },

  /* ---------- 外观 / 主题 ---------- */
  initTheme() {
    this.globalData.themeMode = readThemeMode();
    this.globalData.theme = this.globalData.themeMode === 'system'
      ? readSystemTheme()
      : this.globalData.themeMode;

    try {
      const d = wx.getStorageSync(MOTION_KEY);
      if (typeof d === 'number' && d >= 0.12 && d <= 0.48) this.globalData.motionDur = d;
    } catch (e) {}

    // 系统主题变化仅在「跟随系统」时生效，手动选择不被系统覆盖
    if (typeof wx.onThemeChange === 'function') {
      wx.onThemeChange((res) => {
        if (this.globalData.themeMode !== 'system') return;
        const next = res && res.theme === 'dark' ? 'dark' : 'light';
        this.globalData.theme = next;
        this.broadcastTheme(next);
      });
    }
  },

  // 设置页调用：'system' | 'light' | 'dark'
  setThemeMode(mode) {
    const m = mode === 'light' || mode === 'dark' ? mode : 'system';
    this.globalData.themeMode = m;
    try { wx.setStorageSync(THEME_KEY, m); } catch (e) {}
    const next = m === 'system' ? readSystemTheme() : m;
    this.globalData.theme = next;
    this.broadcastTheme(next);
    return next;
  },

  getTheme() {
    return this.globalData.theme;
  },

  getThemeMode() {
    return this.globalData.themeMode;
  },

  // 页面在 onLoad / onShow 调用：把主题同步到页面根节点
  // 小程序没有 DOM 根节点，由页面根 view 上的 data-theme / theme-* 类承载变量覆盖
  applyTheme(page) {
    if (page && typeof page.setData === 'function') {
      page.setData({ theme: this.globalData.theme, dur: this.globalData.motionDur });
    }
  },

  /* 液态滑块：写入本地偏好并广播给所有已打开页面，全站过渡同步变化 */
  setMotionDur(v) {
    const d = Math.max(0.12, Math.min(0.48, Number(v) || 0.28));
    this.globalData.motionDur = d;
    try { wx.setStorageSync(MOTION_KEY, d); } catch (e) {}
    let pages = [];
    try { pages = getCurrentPages() || []; } catch (e) {}
    pages.forEach((p) => { if (p && typeof p.setData === 'function') p.setData({ dur: d }); });
    return d;
  },

  broadcastTheme(theme) {
    let pages = [];
    try { pages = getCurrentPages() || []; } catch (e) {}
    pages.forEach((p) => {
      if (p && typeof p.setData === 'function') p.setData({ theme });
    });
  }
});
