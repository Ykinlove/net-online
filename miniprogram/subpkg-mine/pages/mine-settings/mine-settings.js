const store = require('../../../utils/store.js');
const { buildBook } = require('../../../utils/xlsx.js');

const WECHAT_ID = 'Ykinlove11';

Page({
  data: {
    nickname: '',
    skillCount: 0,
    archiveCount: 0
  },

  onShow() {
    store.init();
    this.refresh();
  },

  refresh() {
    const p = store.getProfile() || {};
    this.setData({
      nickname: p.nickname || '未建立档案',
      skillCount: store.getList('skills').length,
      archiveCount: store.getSnapshots().length
    });
  },

  goSkill() {
    wx.navigateTo({ url: 'subpkg-mine/pages/mine-skill/mine-skill' });
  },

  goArchive() {
    wx.navigateTo({ url: 'subpkg-mine/pages/mine-archive/mine-archive' });
  },

  editProfile() {
    wx.navigateTo({ url: 'subpkg-mine/pages/onboard/onboard' });
  },

  changeChar() {
    wx.navigateTo({ url: 'subpkg-mine/pages/chargen/chargen' });
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
    wx.navigateTo({ url: 'subpkg-mine/pages/maker/maker' });
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
