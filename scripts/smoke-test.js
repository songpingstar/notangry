const assert = require('assert');

const storage = {};
global.wx = {
  getStorageSync: (k) => storage[k],
  setStorageSync: (k, v) => { storage[k] = v; }
};

function mockToday(str) {
  const realDate = Date;
  const fake = new realDate(str + 'T10:00:00');
  global.Date = class extends realDate {
    constructor(...args) { super(...(args.length ? args : [fake.getTime()])); }
    static now() { return fake.getTime(); }
  };
}

mockToday('2026-08-06');
const dateUtil = require('../utils/date');
const store = require('../utils/store');
const achievements = require('../utils/achievements');

// 旧数据迁移：数字解锁 → streak_N
storage['unlocked_achievements'] = [7];
store.migrateUnlocked();
assert.deepStrictEqual(store.getUnlockedAchievements(), ['streak_7']);

// 首次进入
let st = store.computeStats();
assert.strictEqual(st.currentStreak, 0);
assert.strictEqual(st.totalDays, 0);

// 8-06 确认
store.confirmToday();
st = store.computeStats();
assert.strictEqual(st.currentStreak, 1);
assert.strictEqual(st.totalDays, 1);

// 连续 3 天
mockToday('2026-08-07');
store.confirmToday();
mockToday('2026-08-08');
store.confirmToday();
st = store.computeStats();
assert.strictEqual(st.currentStreak, 3);
const newly = achievements.checkAndUnlock();
assert.ok(newly.indexOf('streak_3') >= 0);

// 生气中断
mockToday('2026-08-09');
store.recordAngry(['工作', '被同事气到']);
st = store.computeStats();
assert.strictEqual(st.currentStreak, 0);
assert.strictEqual(st.totalDays, 3);
assert.strictEqual(store.getReasonFrequency()[0].text, '工作');
assert.strictEqual(store.getReasonFrequency()[0].count, 1);

// 重新振作：3 天内重新连续 3 天
mockToday('2026-08-10');
store.confirmToday();
mockToday('2026-08-11');
store.confirmToday();
mockToday('2026-08-12');
store.confirmToday();
st = store.computeStats();
assert.strictEqual(st.currentStreak, 3);
assert.strictEqual(st.totalDays, 6);
assert.ok(achievements.checkAndUnlock().indexOf('recover_3') >= 0);

// angry_log_5：再记录 4 次生气（不同日期）
mockToday('2026-08-13');
store.recordAngry(['家人']);
mockToday('2026-08-14');
store.recordAngry(['通勤']);
mockToday('2026-08-15');
store.recordAngry(['网络信息']);
mockToday('2026-08-16');
store.recordAngry(['身体不适']);
assert.ok(achievements.checkAndUnlock().indexOf('angry_log_5') >= 0);

// 已解锁不重复弹
assert.deepStrictEqual(achievements.checkAndUnlock().filter((x) => x === 'angry_log_5'), []);

// 日期工具
assert.strictEqual(dateUtil.isConsecutiveDay('2026-08-06', '2026-08-05'), true);
assert.strictEqual(dateUtil.isConsecutiveDay('2026-08-06', '2026-08-04'), false);

console.log('SMOKE TEST PASSED');
