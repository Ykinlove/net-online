const store = require('../../../utils/store.js');
const { buildBook } = require('../../../utils/xlsx.js');
const motion = require('../../../utils/motion.js');

const WECHAT_ID = 'Ykinlove11';

Page({
  data: {
    /* 首页太阳/月亮负责浅深直切；这里只留「跟随系统」总开关 */
    followSystem: true,
    tgPress: false,
    tgPop: false,
    liquidPct: 61,
    liquidDragging: false,
    durLabel: '标准'
  },

  onShow() {
    getApp().applyTheme(this);
    const dur = getApp().globalData.motionDur;
    const pct = Math.round((0.48 - dur) / 0.36 * 100);
    this.setData({
      followSystem: getApp().getThemeMode() === 'system',
      liquidPct: pct,
      durLabel: this._label(pct)
    });
    /* 技能树 / 存档库已移到「我的」页，这里不用再读一遍列表算数量 */
    store.init();
  },

  onReady() { motion.cacheRects(this, '.liquid', '_lrects'); },

  _label(p) { return p < 33 ? '舒缓' : (p < 66 ? '标准' : '干脆'); },

  /* 液态滑块：拖动圆头挤压，数值实时广播成全站过渡时长 */
  onLiquidStart(e) {
    this.setData({ liquidDragging: true });
    this._applyLiquid(e);
  },
  onLiquidMove(e) { this._applyLiquid(e); },
  onLiquidEnd() { this.setData({ liquidDragging: false }); },
  _applyLiquid(e) {
    const t = e.touches && e.touches[0];
    const r = (this._lrects || [])[0];
    if (!t || !r || !r.width) return;
    const p = Math.max(0, Math.min(100, (t.clientX - r.left) / r.width * 100));
    const dur = +(0.48 - p / 100 * 0.36).toFixed(2);
    getApp().setMotionDur(dur);
    this.setData({ liquidPct: Math.round(p), durLabel: this._label(p) });
  },

  /* 弹性开关：关掉时把当前生效主题固定成手动值，避免画面突然跳一下 */
  onFollowSystem() {
    const on = !this.data.followSystem;
    const app = getApp();
    app.setThemeMode(on ? 'system' : app.getTheme());
    this.setData({ followSystem: on, tgPop: false, tgPress: true });
    setTimeout(() => this.setData({ tgPop: true, tgPress: false }), 10);
    setTimeout(() => this.setData({ tgPop: false }), 400);
  },

  copyWechat() {
    wx.setClipboardData({
      data: WECHAT_ID,
      success: () => {
        wx.showToast({ title: '微信号已复制', icon: 'none' });
      }
    });
  },

  goMaker() {
    wx.navigateTo({ url: '/subpkg-mine/pages/maker/maker' });
  },

  /* 导出成 .xlsx：命令 / 项目 / 技能 三张表 */
  exportData() {
    const cmds = store.getList('commands').slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const pjs = store.getList('projects').slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const sks = store.getList('skills');

    const cmdRows = [['序号', '设备', '命令标题', '命令内容', '说明', '标签']];
    cmds.forEach((c, i) => {
      cmdRows.push([
        i + 1,
        c.device || '',
        c.title || '',
        c.content || '',
        c.desc || '',
        c.tags || ''
      ]);
    });

    const pjRows = [['序号', '项目名', '状态', '角色', '开始日期', '结束日期', '做了什么', '设备', '标签']];
    pjs.forEach((x, i) => {
      pjRows.push([
        i + 1,
        x.name || '',
        x.status || '',
        x.role || '',
        String(x.startDate || x.date || '').slice(0, 10),
        String(x.endDate || '').slice(0, 10),
        x.content || '',
        x.devices || '',
        x.tags || ''
      ]);
    });

    const skRows = [['序号', '技能', '状态', '目标 / 备注']];
    sks.forEach((s, i) => {
      const st = s.status === 'lit' ? '已点亮' : (s.status === 'learning' ? '在学' : '想学');
      skRows.push([i + 1, s.name || '', st, s.goalText || '']);
    });

    let buffer;
    try {
      buffer = buildBook([
        { name: '命令', widths: [6, 12, 28, 46, 34, 22], rows: cmdRows },
        { name: '项目', widths: [6, 24, 10, 12, 14, 14, 40, 26, 20], rows: pjRows },
        { name: '技能', widths: [6, 24, 10, 30], rows: skRows }
      ]);
    } catch (e) {
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      return;
    }

    const fileName = 'Net操作命令速记-' + store.today() + '.xlsx';
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName;

    try {
      wx.getFileSystemManager().writeFileSync(filePath, buffer);
    } catch (e) {
      wx.showModal({
        title: '导出失败',
        content: '写入文件出错了，可能是手机存储空间不足。',
        showCancel: false
      });
      return;
    }

    wx.showLoading({ title: '打开中', mask: true });
    wx.openDocument({
      filePath,
      fileType: 'xlsx',
      showMenu: true,
      success: () => wx.hideLoading(),
      fail: () => {
        wx.hideLoading();
        // 打不开就用「发送给好友」的方式把文件递出去
        if (wx.shareFileMessage) {
          wx.shareFileMessage({
            filePath,
            fileName,
            fail: () => {
              wx.showModal({
                title: '导出失败',
                content: '手机上没有能打开 Excel 的软件。装个 WPS 或 Excel 再试一次。',
                showCancel: false
              });
            }
          });
        } else {
          wx.showModal({
            title: '导出失败',
            content: '手机上没有能打开 Excel 的软件。装个 WPS 或 Excel 再试一次。',
            showCancel: false
          });
        }
      }
    });
  }
});
