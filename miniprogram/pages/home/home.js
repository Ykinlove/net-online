const store = require('../../utils/store.js');
const { ANSWER_BOOK } = require('../../utils/seed.js');
const { dayInfo, weekOfMonth, weeksInMonth } = require('../../utils/lunar.js');

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

Page({
  data: {
    answer: '',
    answerIdx: -1,
    nickname: '',
    weekDays: WEEK_DAYS,
    calTitle: '',
    calCells: [],
    calFoot: ''
  },

  onLoad() {
    this.drawAnswer();
  },

  onShow() {
    store.init();
    this.refresh();
    this.buildCalendar(this._calY, this._calM);
  },

  onPullDownRefresh() {
    store.pullAll().then(() => {
      this.refresh();
      wx.stopPullDownRefresh();
    }).catch(() => wx.stopPullDownRefresh());
  },

  refresh() {
    const p = store.getProfile() || {};
    this.setData({
      nickname: p.nickname || ''
    });
  },

  drawAnswer() {
    let i = Math.floor(Math.random() * ANSWER_BOOK.length);
    if (ANSWER_BOOK.length > 1 && i === this.data.answerIdx) i = (i + 1) % ANSWER_BOOK.length;
    this.setData({ answer: ANSWER_BOOK[i], answerIdx: i });
  },

  buildCalendar(y, m) {
    const now = new Date();
    const year = typeof y === 'number' ? y : now.getFullYear();
    const month = typeof m === 'number' ? m : now.getMonth();
    this._calY = year;
    this._calM = month;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 有记录的日期集合
    const marks = {};
    store.getList('commands').forEach(c => { if (c.date) marks[String(c.date).slice(0, 10)] = 1; });
    store.getList('projects').forEach(p => {
      const sd = p.startDate || p.date;
      if (sd) marks[String(sd).slice(0, 10)] = 1;
      if (p.endDate) marks[String(p.endDate).slice(0, 10)] = 1;
    });

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ key: 'e' + i, day: '', sub: '', subKind: '', hasRec: false, isToday: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const key = year + '-' + mm + '-' + dd;
      const info = dayInfo(year, month + 1, d);
      cells.push({
        key,
        day: d,
        sub: info.sub,
        subKind: info.kind,
        hasRec: !!marks[key],
        isToday: year === now.getFullYear() && month === now.getMonth() && d === now.getDate()
      });
    }

    /* 底部显示周数：看的是当前月就报“本月第 N 周”，其它月报“共 N 周” */
    const isThisMonth = year === now.getFullYear() && month === now.getMonth();
    const calFoot = isThisMonth
      ? '本月第 ' + weekOfMonth(year, month + 1, now.getDate()) + ' 周'
      : '共 ' + weeksInMonth(year, month + 1) + ' 周';

    this.setData({
      calTitle: year + ' 年 ' + (month + 1) + ' 月',
      calCells: cells,
      calFoot
    });
  },

  calPrev() {
    let y = this._calY;
    let m = this._calM - 1;
    if (m < 0) { m = 11; y -= 1; }
    this.buildCalendar(y, m);
  },

  calNext() {
    let y = this._calY;
    let m = this._calM + 1;
    if (m > 11) { m = 0; y += 1; }
    this.buildCalendar(y, m);
  },

  goAddCmd() {
    getApp().globalData.pendingAction = { type: 'add-command' };
    wx.switchTab({ url: '/pages/commands/commands' });
  },

  goAddProj() {
    getApp().globalData.pendingAction = { type: 'add-project' };
    wx.switchTab({ url: '/pages/projects/projects' });
  },

  goSearch() {
    wx.navigateTo({ url: '/subpkg-tool/pages/search/search' });
  },

  /* 资料库：命令百科 + 配置模板库（页内顶部可切换两种内容） */
  goLibrary() {
    wx.navigateTo({ url: '/subpkg-tool/pages/browse/browse' });
  }
});
