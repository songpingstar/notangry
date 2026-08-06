const store = require('./store');
const dateUtil = require('./date');

const ALL = [
  { id: 'streak_3', title: '初露锋芒', desc: '连续 3 天不生气', days: 3 },
  { id: 'streak_7', title: '一周静心', desc: '连续 7 天不生气', days: 7 },
  { id: 'streak_14', title: '半月从容', desc: '连续 14 天不生气', days: 14 },
  { id: 'streak_30', title: '月度修行', desc: '连续 30 天不生气', days: 30 },
  { id: 'streak_100', title: '百炼成钢', desc: '连续 100 天不生气', days: 100 },
  { id: 'streak_365', title: '一年和顺', desc: '连续 365 天不生气', days: 365 },
  { id: 'month_full', title: '满月清净', desc: '单个自然月每天都成功', days: 0 },
  { id: 'week_full_2', title: '双周无怒', desc: '连续 2 个完整周每天都成功', days: 0 },
  { id: 'week_full_4', title: '整月平静', desc: '连续 4 个完整周每天都成功', days: 0 },
  { id: 'angry_log_5', title: '觉察者', desc: '累计记录 5 次情绪', days: 0 },
  { id: 'angry_log_20', title: '情绪洞察家', desc: '累计记录 20 次情绪', days: 0 },
  { id: 'start_7', title: '雷打不动', desc: '连续 7 天开启挑战', days: 0 },
  { id: 'recover_3', title: '东山再起', desc: '生气后 3 天内重新连续 3 天', days: 0 },
  { id: 'best_7', title: '潜龙在渊', desc: '历史最佳连续 7 天', days: 7 },
  { id: 'best_30', title: '渊龙在天', desc: '历史最佳连续 30 天', days: 30 }
];

function bestStreak(records) {
  const done = records.filter((r) => r.done).map((r) => r.date).sort();
  let best = 0, run = 0;
  for (let i = 0; i < done.length; i++) {
    run = (i > 0 && dateUtil.isConsecutiveDay(done[i], done[i - 1])) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function prevDateStr(dateStr) {
  const d = dateUtil.parseDate(dateStr);
  d.setDate(d.getDate() - 1);
  return dateUtil.formatDate(d);
}

function monthFullCount(records) {
  const byMonth = {};
  records.filter((r) => r.done).forEach((r) => {
    const m = r.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  let count = 0;
  Object.keys(byMonth).forEach((m) => {
    const [y, mo] = m.split('-').map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    if (byMonth[m] >= daysInMonth) count += 1;
  });
  return count;
}

function weekFullCount(records) {
  const doneDates = records.filter((r) => r.done).map((r) => r.date).sort();
  const doneSet = {};
  doneDates.forEach((d) => { doneSet[d] = true; });
  let run = 0;
  let best = 0;
  doneDates.forEach((d) => {
    run = doneSet[prevDateStr(d)] ? run + 1 : 1;
    if (run >= 7 && run % 7 === 0) best = run / 7;
  });
  return best;
}

function angryCount(records) {
  return records.filter((r) => r.angry).length;
}

function startStreak(records) {
  const started = records.filter((r) => r.started).map((r) => r.date).sort();
  let best = 0, run = 0;
  for (let i = 0; i < started.length; i++) {
    run = (i > 0 && dateUtil.isConsecutiveDay(started[i], started[i - 1])) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function recoverCount(records) {
  const sorted = records.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  let count = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (!sorted[i - 1].angry) continue;
    const angryDate = dateUtil.parseDate(sorted[i - 1].date);
    let streak = 0;
    let j = i;
    while (j < sorted.length && sorted[j].done) {
      const gap = (dateUtil.parseDate(sorted[j].date).getTime() - angryDate.getTime()) / 86400000;
      if (gap > 3) break;
      streak += 1;
      j += 1;
    }
    if (streak >= 3) count += 1;
  }
  return count;
}

function evaluate(records) {
  const best = bestStreak(records);
  const conditions = {
    streak_3: best >= 3,
    streak_7: best >= 7,
    streak_14: best >= 14,
    streak_30: best >= 30,
    streak_100: best >= 100,
    streak_365: best >= 365,
    month_full: monthFullCount(records) >= 1,
    week_full_2: weekFullCount(records) >= 2,
    week_full_4: weekFullCount(records) >= 4,
    angry_log_5: angryCount(records) >= 5,
    angry_log_20: angryCount(records) >= 20,
    start_7: startStreak(records) >= 7,
    recover_3: recoverCount(records) >= 1,
    best_7: best >= 7,
    best_30: best >= 30
  };
  return { best, conditions };
}

function checkAndUnlock() {
  store.migrateUnlocked();
  const unlockedIds = store.getUnlockedAchievements();
  const { conditions } = evaluate(store.getRecords());
  const newly = [];
  ALL.forEach((a) => {
    if (conditions[a.id] && unlockedIds.indexOf(a.id) < 0) {
      newly.push(a.id);
      unlockedIds.push(a.id);
    }
  });
  if (newly.length > 0) {
    store.saveUnlockedAchievements(unlockedIds);
  }
  return newly;
}

function getAll() {
  store.migrateUnlocked();
  const unlockedIds = store.getUnlockedAchievements();
  const { conditions } = evaluate(store.getRecords());
  return ALL.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.desc,
    days: a.days,
    unlocked: conditions[a.id] || unlockedIds.indexOf(a.id) >= 0
  }));
}

module.exports = { ALL, checkAndUnlock, getAll };
