const store = require('../../utils/store');
const achievements = require('../../utils/achievements');
const dateUtil = require('../../utils/date');
const quotes = require('../../utils/quotes');
const encourage = require('../../utils/encourage');

const REASON_TAGS = ['工作', '家人', '通勤', '网络信息', '身体不适', '其他'];

Page({
  data: {
    today: '',
    status: 'idle',
    currentStreak: 0,
    dailyQuote: '',
    doneMessage: '',
    reasonTags: REASON_TAGS,
    selectedReasons: [],
    selectedMap: {},
    customReason: '',
    showAngryModal: false
  },

  syncSelectedMap(reasons) {
    const map = {};
    reasons.forEach((r) => { map[r] = true; });
    return map;
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const todayStatus = store.getTodayStatus();
    const stats = store.computeStats();
    let status = 'idle';
    if (todayStatus.done) status = 'done';
    else if (todayStatus.angry) status = 'angry';
    else if (todayStatus.started) status = 'pending';
    this.setData({
      today: dateUtil.todayString(),
      status,
      currentStreak: stats.currentStreak,
      dailyQuote: quotes.getDailyQuote(dateUtil.todayString()),
      doneMessage: encourage.getDoneMessage(stats.currentStreak)
    });
  },

  onStartToday() {
    store.startToday();
    this.refresh();
  },

  onConfirmToday() {
    store.confirmToday();
    const newly = achievements.checkAndUnlock();
    if (newly.length > 0) {
      this.showAchievements(newly);
    }
    this.refresh();
  },

  openAngryModal() {
    this.setData({ showAngryModal: true, selectedReasons: [], selectedMap: {}, customReason: '' });
  },

  closeAngryModal() {
    this.setData({ showAngryModal: false });
  },

  noop() {},

  onToggleReason(e) {
    const tag = e.currentTarget.dataset.tag;
    let selected = this.data.selectedReasons;
    if (selected.indexOf(tag) >= 0) {
      selected = selected.filter((t) => t !== tag);
    } else {
      selected = selected.concat(tag);
    }
    this.setData({
      selectedReasons: selected,
      selectedMap: this.syncSelectedMap(selected)
    });
  },

  onCustomInput(e) {
    this.setData({ customReason: e.detail.value });
  },

  onConfirmAngry() {
    const reasons = this.data.selectedReasons.slice();
    const custom = this.data.customReason.trim();
    if (custom) reasons.push(custom);
    store.recordAngry(reasons);
    const newly = achievements.checkAndUnlock();
    this.setData({ showAngryModal: false });
    this.refresh();
    if (newly.length > 0) {
      this.showAchievements(newly);
    }
    wx.navigateTo({ url: '/pages/calm/index' });
  },

  showAchievements(ids) {
    const titles = ids
      .map((id) => {
        const a = achievements.ALL.find((x) => x.id === id);
        return a ? a.title : id;
      })
      .join(' / ');
    wx.showModal({
      title: '成就达成！',
      content: '解锁徽章：' + titles,
      showCancel: false
    });
  }
});
