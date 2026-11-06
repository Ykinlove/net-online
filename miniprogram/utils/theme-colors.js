const themeColors = require('./theme-colors.js');
/* 原生 API 色值桥接
   wx.showModal 的 confirmColor、wx.setNavigationBarColor 等只接受 #RRGGBB，
   不认 CSS 变量。业务代码统一用 get(key) 取当前主题的等价色值，
   避免把十六进制散落在页面逻辑里。色值只在本文件与 theme.json 中定义。 */
const LIGHT = {
  primary: '#3B7DD8',
  danger: '#D64545',
  success: '#2E9E6B',
  warning: '#D98A34'
};
const DARK = {
  primary: '#5A9AE6',
  danger: '#E87373',
  success: '#5FBF8E',
  warning: '#D9A05B'
};

function isDark() {
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.theme === 'dark');
  } catch (e) {
    return false;
  }
}

function get(key) {
  const table = isDark() ? DARK : LIGHT;
  return table[key] || LIGHT[key] || LIGHT.primary;
}

module.exports = { get, LIGHT, DARK, isDark };
