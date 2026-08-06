const store = require('../../utils/store');
const achievements = require('../../utils/achievements');

Page({
  data: {
    currentStreak: 0,
    totalDays: 0,
    bestStreak: 0,
    milestones: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const stats = store.computeStats();
    const unlocked = store.getUnlockedAchievements();
    const milestones = achievements.getAll(stats, unlocked);
    this.setData({
      currentStreak: stats.currentStreak,
      totalDays: stats.totalDays,
      bestStreak: stats.bestStreak,
      milestones
    });
  }
});
