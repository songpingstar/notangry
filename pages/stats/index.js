const store = require('../../utils/store');
const achievements = require('../../utils/achievements');
const dateUtil = require('../../utils/date');

Page({
  data: {
    currentStreak: 0,
    totalDays: 0,
    bestStreak: 0,
    achievements: [],
    viewYear: 0,
    viewMonth: 0,
    calendar: [],
    monthLabel: '',
    frequencies: [],
    WEEK_CN: ['日', '一', '二', '三', '四', '五', '六']
  },

  onShow() {
    this.refresh();
  },

  onReady() {
    this.drawChart();
  },

  refresh() {
    const now = new Date();
    const stats = store.computeStats();
    this.setData({
      currentStreak: stats.currentStreak,
      totalDays: stats.totalDays,
      bestStreak: stats.bestStreak,
      achievements: achievements.getAll(),
      viewYear: now.getFullYear(),
      viewMonth: now.getMonth() + 1,
      frequencies: store.getReasonFrequency()
    });
    this.buildCalendar(now.getFullYear(), now.getMonth() + 1);
    this.drawChart();
  },

  buildCalendar(year, month) {
    const statusMap = {};
    store.getRecords().forEach((r) => {
      statusMap[r.date] = r.done ? 'done' : (r.angry ? 'angry' : 'started');
    });
    const first = new Date(year, month - 1, 1);
    const lead = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) {
      cells.push({ type: 'blank' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = dateUtil.formatDate(new Date(year, month - 1, d));
      cells.push({
        type: statusMap[dateStr] || 'none',
        day: d,
        date: dateStr
      });
    }
    this.setData({
      viewYear: year,
      viewMonth: month,
      monthLabel: year + ' 年 ' + month + ' 月',
      calendar: cells
    });
  },

  onPrevMonth() {
    let y = this.data.viewYear;
    let m = this.data.viewMonth - 1;
    if (m < 1) { m = 12; y -= 1; }
    this.buildCalendar(y, m);
  },

  onNextMonth() {
    let y = this.data.viewYear;
    let m = this.data.viewMonth + 1;
    if (m > 12) { m = 1; y += 1; }
    this.buildCalendar(y, m);
  },

  drawChart() {
    const ctx = wx.createCanvasContext('trendChart', this);
    const data = this.last30Days();
    const w = 340, h = 140, pad = 20;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, Math.max.apply(null, data));
    const barW = (w - pad * 2) / data.length;
    data.forEach((v, i) => {
      const bh = (v / max) * (h - pad * 2);
      ctx.setFillStyle(v > 0 ? '#ff8a5c' : '#e8eaed');
      ctx.fillRect(pad + i * barW + barW * 0.25, h - pad - bh, barW * 0.5, bh);
    });
    ctx.draw();
  },

  last30Days() {
    const dayMap = store.getDayMap();
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(dayMap[dateUtil.formatDate(d)] ? 1 : 0);
    }
    return out;
  }
});
