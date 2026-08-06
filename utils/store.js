const dateUtil = require('./date');

const RECORDS_KEY = 'checkin_records';
const UNLOCKED_KEY = 'unlocked_achievements';

function getRecords() {
  try {
    const data = wx.getStorageSync(RECORDS_KEY);
    if (Array.isArray(data)) {
      return data
        .map((r) => ({
          date: String(r.date),
          started: !!r.started,
          done: !!r.done,
          angry: !!r.angry,
          reason: Array.isArray(r.reason) ? r.reason.map(String) : []
        }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
    }
  } catch (e) { /* ignore */ }
  wx.setStorageSync(RECORDS_KEY, []);
  return [];
}

function saveRecords(records) {
  wx.setStorageSync(RECORDS_KEY, records);
}

function upsert(record) {
  const records = getRecords();
  const idx = records.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    records[idx] = Object.assign({}, records[idx], record);
  } else {
    records.push(record);
  }
  saveRecords(records);
}

function getTodayStatus() {
  const today = dateUtil.todayString();
  const record = getRecords().find((r) => r.date === today);
  return {
    started: !!(record && record.started),
    done: !!(record && record.done),
    angry: !!(record && record.angry)
  };
}

function startToday() {
  upsert({ date: dateUtil.todayString(), started: true, done: false });
}

function confirmToday() {
  upsert({ date: dateUtil.todayString(), started: true, done: true });
}

function recordAngry(reasons) {
  const today = dateUtil.todayString();
  const records = getRecords();
  const idx = records.findIndex((r) => r.date === today);
  const record = {
    date: today,
    started: true,
    done: false,
    angry: true,
    reason: Array.isArray(reasons) ? reasons : []
  };
  if (idx >= 0) {
    records[idx] = Object.assign({}, records[idx], record);
  } else {
    records.push(record);
  }
  saveRecords(records);
}

function getReasonFrequency() {
  const freq = {};
  getRecords().forEach((r) => {
    (r.reason || []).forEach((text) => {
      const key = String(text).trim();
      if (key) freq[key] = (freq[key] || 0) + 1;
    });
  });
  return Object.keys(freq)
    .map((text) => ({ text, count: freq[text] }))
    .sort((a, b) => b.count - a.count);
}

function computeStats() {
  const records = getRecords();
  const doneDates = records.filter((r) => r.done).map((r) => r.date).sort();
  const doneSet = {};
  doneDates.forEach((d) => { doneSet[d] = true; });

  const today = dateUtil.todayString();
  const todayRecord = records.find((r) => r.date === today);
  let currentStreak = 0;
  if (!(todayRecord && todayRecord.angry)) {
    let cursor = doneSet[today] ? today : dateUtil.yesterdayString();
    while (doneSet[cursor]) {
      currentStreak += 1;
      const d = dateUtil.parseDate(cursor);
      d.setDate(d.getDate() - 1);
      cursor = dateUtil.formatDate(d);
    }
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < doneDates.length; i++) {
    if (i > 0 && dateUtil.isConsecutiveDay(doneDates[i], doneDates[i - 1])) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
  }

  return {
    currentStreak,
    totalDays: doneDates.length,
    bestStreak
  };
}

function getDayMap() {
  const map = {};
  getRecords().filter((r) => r.done).forEach((r) => { map[r.date] = true; });
  return map;
}

function migrateUnlocked() {
  try {
    const data = wx.getStorageSync(UNLOCKED_KEY);
    if (!Array.isArray(data)) {
      wx.setStorageSync(UNLOCKED_KEY, []);
      return;
    }
    const hasNumeric = data.some((d) => typeof d === 'number');
    if (hasNumeric) {
      const migrated = data.map((d) => 'streak_' + d);
      wx.setStorageSync(UNLOCKED_KEY, migrated);
    }
  } catch (e) { /* ignore */ }
}

function getUnlockedAchievements() {
  try {
    const data = wx.getStorageSync(UNLOCKED_KEY);
    if (Array.isArray(data)) return data.map(String).filter((s) => s);
  } catch (e) { /* ignore */ }
  return [];
}

function saveUnlockedAchievements(list) {
  wx.setStorageSync(UNLOCKED_KEY, list);
}

module.exports = {
  getRecords,
  getTodayStatus,
  startToday,
  confirmToday,
  recordAngry,
  getReasonFrequency,
  computeStats,
  getDayMap,
  migrateUnlocked,
  getUnlockedAchievements,
  saveUnlockedAchievements
};
