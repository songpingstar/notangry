const store = require('./store');

const MILESTONES = [3, 7, 14, 30, 100];

function getAll(stats, unlocked) {
  return MILESTONES.map((days) => ({
    days,
    unlocked: stats.bestStreak >= days || unlocked.indexOf(days) >= 0
  }));
}

function checkAndUnlock(stats) {
  const unlocked = store.getUnlockedAchievements();
  const newly = [];
  MILESTONES.forEach((days) => {
    if (stats.bestStreak >= days && unlocked.indexOf(days) < 0) {
      newly.push(days);
      unlocked.push(days);
    }
  });
  if (newly.length > 0) {
    store.saveUnlockedAchievements(unlocked);
  }
  return newly;
}

module.exports = { MILESTONES, getAll, checkAndUnlock };
