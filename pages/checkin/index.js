const store = require('../../utils/store');
const achievements = require('../../utils/achievements');
const dateUtil = require('../../utils/date');

Page({
  data: {
    today: '',
    status: 'idle',
    currentStreak: 0
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const todayStatus = store.getTodayStatus();
    const stats = store.computeStats();
    let status = 'idle';
    if (todayStatus.done) status = 'done';
    else if (todayStatus.started) status = 'pending';
    this.setData({
      today: dateUtil.todayString(),
      status,
      currentStreak: stats.currentStreak
    });
  },

  onStartToday() {
    store.startToday();
    this.refresh();
  },

  onConfirmToday() {
    store.confirmToday();
    const stats = store.computeStats();
    const newly = achievements.checkAndUnlock(stats);
    if (newly.length > 0) {
      wx.showModal({
        title: '成就达成！',
        content: '已解锁连续 ' + newly.join('/') + ' 天徽章',
        showCancel: false
      });
    }
    this.refresh();
  }
});
