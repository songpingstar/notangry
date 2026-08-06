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

// 首次进入：无记录
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
assert.strictEqual(st.totalDays, 3);
const newly = achievements.checkAndUnlock(st);
assert.deepStrictEqual(newly, [3]);

// 中断：8-10 才确认（跳过 8-09）
mockToday('2026-08-10');
store.confirmToday();
st = store.computeStats();
assert.strictEqual(st.currentStreak, 1);
assert.strictEqual(st.totalDays, 4);
assert.strictEqual(st.bestStreak, 3);

// 已解锁的不重复解锁
const again = achievements.checkAndUnlock(st);
assert.deepStrictEqual(again, []);

// 日期工具
assert.strictEqual(dateUtil.todayString(), '2026-08-10');
assert.strictEqual(dateUtil.isConsecutiveDay('2026-08-06', '2026-08-05'), true);
assert.strictEqual(dateUtil.isConsecutiveDay('2026-08-06', '2026-08-04'), false);

console.log('SMOKE TEST PASSED');
