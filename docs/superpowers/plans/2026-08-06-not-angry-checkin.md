# 不生气打卡小程序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一款原生微信小程序，早设定+晚确认记录"不生气"挑战，统计连续/累计/最多连续天数，并解锁里程碑成就。

**Architecture:** 原生微信小程序（WXML/WXSS/JS），本地存储（`wx.setStorageSync`），单用户。核心逻辑收敛在 `utils/` 的可测试纯函数模块（日期、存储与统计、成就），页面层为薄层，只在 `onShow` 时读取并渲染。

**Tech Stack:** 微信小程序原生框架，零第三方依赖。

## Global Constraints

- 原生微信小程序语法，不引入任何 npm 包或跨端框架。
- 存储 key 固定为 `checkin_records` 与 `unlocked_achievements`。
- 日期统一 `YYYY-MM-DD` 字符串，使用本地时区计算。
- 打卡判定：只有当天 `done:true` 才算成功。
- 里程碑成就：3 / 7 / 14 / 30 / 100 天。
- 中文字案与设计文档一致。所有 JS 模块用 CommonJS（`module.exports`）。

---

### Task 1: 项目脚手架（app.json / app.js / app.wxss / project.config.json / sitemap.json）

**Files:**
- Create: `project.config.json`
- Create: `app.json`
- Create: `app.js`
- Create: `app.wxss`
- Create: `sitemap.json`

**Interfaces:**
- Produces: 可被微信开发者工具打开的最小工程；两个 Tab 页路径 `pages/checkin/index`、`pages/stats/index`。

- [ ] **Step 1: 创建 `project.config.json`**

```json
{
  "compileType": "miniprogram",
  "libVersion": "2.33.0",
  "appid": "touristappid",
  "projectname": "not-angry-checkin",
  "setting": {
    "es6": true,
    "minified": true,
    "urlCheck": false,
    "postcss": true,
    "ignoreUploadUnusedFiles": true
  }
}
```

- [ ] **Step 2: 创建 `app.json`（含 TabBar，文字式无图标）**

```json
{
  "pages": [
    "pages/checkin/index",
    "pages/stats/index"
  ],
  "window": {
    "navigationBarTitleText": "不生气打卡",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f7f8fa"
  },
  "tabBar": {
    "color": "#9aa0a6",
    "selectedColor": "#ff8a5c",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/checkin/index", "text": "今日打卡" },
      { "pagePath": "pages/stats/index", "text": "统计与成就" }
    ]
  },
  "sitemapLocation": "sitemap.json"
}
```

- [ ] **Step 3: 创建 `app.js`**

```js
App({
  onLaunch() {}
});
```

- [ ] **Step 4: 创建 `app.wxss`**

```css
page {
  background: #f7f8fa;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif;
}
```

- [ ] **Step 5: 创建 `sitemap.json`**

```json
{
  "rules": [{ "action": "disallow", "page": "*" }]
}
```

- [ ] **Step 6: Commit**

```bash
git add project.config.json app.json app.js app.wxss sitemap.json
git commit -m "chore: scaffold miniprogram project"
```

---

### Task 2: `utils/date.js` — 日期工具

**Files:**
- Create: `utils/date.js`

**Interfaces:**
- `formatDate(date: Date) => string` — 返回 `YYYY-MM-DD`（本地时区，补零）。
- `todayString() => string` — 今天的 `YYYY-MM-DD`。
- `yesterdayString() => string` — 昨天的 `YYYY-MM-DD`。
- `parseDate(str: string) => Date` — 把 `YYYY-MM-DD` 解析为本地时区 Date（避免 `new Date('YYYY-MM-DD')` 的 UTC 陷阱）。
- `isConsecutiveDay(dateStr: string, prevDateStr: string) => boolean` — `dateStr` 是否为 `prevDateStr` 的后一天。

- [ ] **Step 1: 创建 `utils/date.js`**

```js
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDate(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function todayString() {
  return formatDate(new Date());
}

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function parseDate(str) {
  const parts = str.split('-');
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}

function isConsecutiveDay(dateStr, prevDateStr) {
  const d = parseDate(prevDateStr);
  d.setDate(d.getDate() + 1);
  return formatDate(d) === dateStr;
}

module.exports = {
  formatDate,
  todayString,
  yesterdayString,
  parseDate,
  isConsecutiveDay
};
```

- [ ] **Step 2: Commit**

```bash
git add utils/date.js
git commit -m "feat: add date utilities"
```

---

### Task 3: `utils/store.js` — 存储与统计

**Files:**
- Create: `utils/store.js`

**Interfaces:**
- `getRecords() => Array<{date: string, done: boolean}>` — 读 `checkin_records`；损坏/非数组时返回 `[]` 并重置。
- `getTodayStatus() => { started: boolean, done: boolean }` — 今天是否已设定、已确认。
- `startToday() => void` — 记录今天已设定（在 `checkin_records` 写 `{date: today, started: true, done: false}`，若已存在则补 `started: true`）。
- `confirmToday() => void` — 把今天的记录设为 `{date: today, started: true, done: true}`。
- `computeStats() => { currentStreak: number, totalDays: number, bestStreak: number }` — 实时计算。
- `getDayMap() => Object` — `{ 'YYYY-MM-DD': true }` 仅含 done 日期，供 stats 页日历使用。

**规则：**
- 当前连续天数：今天 `done` 则从今天起往前数；否则从昨天起往前数。中断返回 0。
- 累计 = done 记录条数。最多连续 = 历史最长连续段。

- [ ] **Step 1: 创建 `utils/store.js`**

```js
const dateUtil = require('./date');

const RECORDS_KEY = 'checkin_records';
const UNLOCKED_KEY = 'unlocked_achievements';

function getRecords() {
  try {
    const data = wx.getStorageSync(RECORDS_KEY);
    if (Array.isArray(data)) {
      return data.map((r) => ({ date: String(r.date), started: !!r.started, done: !!r.done }))
        .sort((a, b) => a.date < b.date ? -1 : 1);
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
    done: !!(record && record.done)
  };
}

function startToday() {
  upsert({ date: dateUtil.todayString(), started: true, done: false });
}

function confirmToday() {
  upsert({ date: dateUtil.todayString(), started: true, done: true });
}

function computeStats() {
  const records = getRecords();
  const doneDates = records.filter((r) => r.done).map((r) => r.date).sort();
  const doneSet = {};
  doneDates.forEach((d) => { doneSet[d] = true; });

  const today = dateUtil.todayString();
  let currentStreak = 0;
  let cursor = doneSet[today] ? today : dateUtil.yesterdayString();
  while (doneSet[cursor]) {
    currentStreak += 1;
    cursor = dateUtil.formatDate(new Date(dateUtil.parseDate(cursor).getTime() - 86400000));
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

function getUnlockedAchievements() {
  try {
    const data = wx.getStorageSync(UNLOCKED_KEY);
    if (Array.isArray(data)) return data.map(Number).filter((n) => n > 0);
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
  computeStats,
  getDayMap,
  getUnlockedAchievements,
  saveUnlockedAchievements
};
```

- [ ] **Step 2: Commit**

```bash
git add utils/store.js
git commit -m "feat: add local storage and streak statistics"
```

---

### Task 4: `utils/achievements.js` — 成就定义与判定

**Files:**
- Create: `utils/achievements.js`

**Interfaces:**
- `MILESTONES: Array<number>` — `[3, 7, 14, 30, 100]`。
- `getAll(stats, unlocked) => Array<{days, unlocked}>` — 返回全部里程碑及解锁状态。
- `checkAndUnlock(stats, unlocked) => Array<number>` — 返回本次新解锁的里程碑值（并已写入存储）。

- [ ] **Step 1: 创建 `utils/achievements.js`**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add utils/achievements.js
git commit -m "feat: add milestone achievements logic"
```

---

### Task 5: `pages/checkin` — 今日打卡页

**Files:**
- Create: `pages/checkin/index.js`
- Create: `pages/checkin/index.wxml`
- Create: `pages/checkin/index.wxss`
- Create: `pages/checkin/index.json`

**Interfaces:**
- Consumes: `store.getTodayStatus()`、`store.startToday()`、`store.confirmToday()`、`store.computeStats()`、`achievements.checkAndUnlock()`。
- 三种状态渲染：`idle`（未设定）、`pending`（已设定未确认）、`done`（已确认）。

- [ ] **Step 1: 创建 `pages/checkin/index.js`**

```js
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
```

- [ ] **Step 2: 创建 `pages/checkin/index.wxml`**

```xml
<view class="page">
  <view class="header">
    <view class="date">{{today}}</view>
    <view class="motto">深呼吸，今天也不要生气</view>
  </view>

  <view wx:if="{{status === 'idle'}}" class="card">
    <view class="card-title">开启今日挑战</view>
    <view class="card-desc">从今天开始，承诺一整天都不生气</view>
    <button class="primary-btn" bindtap="onStartToday">开启今日挑战</button>
  </view>

  <view wx:elif="{{status === 'pending'}}" class="card">
    <view class="card-title">已承诺</view>
    <view class="card-desc">期待今晚的好消息，坚持住</view>
    <button class="primary-btn" bindtap="onConfirmToday">今晚确认：今天没生气</button>
  </view>

  <view wx:else class="card done">
    <view class="card-title">今日挑战成功</view>
    <view class="card-desc">你做到了，太棒了！</view>
  </view>

  <view class="streak">
    <view class="streak-num">{{currentStreak}}</view>
    <view class="streak-label">当前连续不生气天数</view>
  </view>
</view>
```

- [ ] **Step 3: 创建 `pages/checkin/index.wxss`**

```css
.page { padding: 40rpx 32rpx; }
.header { text-align: center; margin-bottom: 48rpx; }
.date { font-size: 40rpx; font-weight: 600; color: #ff8a5c; }
.motto { font-size: 26rpx; color: #9aa0a6; margin-top: 12rpx; }
.card {
  background: #fff; border-radius: 24rpx; padding: 56rpx 40rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05); text-align: center;
}
.card-title { font-size: 36rpx; font-weight: 600; margin-bottom: 16rpx; }
.card-desc { font-size: 26rpx; color: #9aa0a6; margin-bottom: 40rpx; }
.card.done .card-title { color: #52c41a; }
.primary-btn {
  background: #ff8a5c; color: #fff; border-radius: 999rpx; font-size: 32rpx;
}
.streak { text-align: center; margin-top: 72rpx; }
.streak-num { font-size: 120rpx; font-weight: 700; color: #ff8a5c; }
.streak-label { font-size: 26rpx; color: #9aa0a6; margin-top: 8rpx; }
```

- [ ] **Step 4: 创建 `pages/checkin/index.json`**

```json
{ "navigationBarTitleText": "今日打卡" }
```

- [ ] **Step 5: Commit**

```bash
git add pages/checkin/index.js pages/checkin/index.wxml pages/checkin/index.wxss pages/checkin/index.json
git commit -m "feat: add today checkin page"
```

---

### Task 6: `pages/stats` — 统计与成就页

**Files:**
- Create: `pages/stats/index.js`
- Create: `pages/stats/index.wxml`
- Create: `pages/stats/index.wxss`
- Create: `pages/stats/index.json`

**Interfaces:**
- Consumes: `store.computeStats()`、`store.getUnlockedAchievements()`、`achievements.getAll()`、`achievements.MILESTONES`。

- [ ] **Step 1: 创建 `pages/stats/index.js`**

```js
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
```

- [ ] **Step 2: 创建 `pages/stats/index.wxml`**

```xml
<view class="page">
  <view class="stats-row">
    <view class="stat-card">
      <view class="stat-num">{{currentStreak}}</view>
      <view class="stat-label">连续天数</view>
    </view>
    <view class="stat-card">
      <view class="stat-num">{{totalDays}}</view>
      <view class="stat-label">累计天数</view>
    </view>
    <view class="stat-card">
      <view class="stat-num">{{bestStreak}}</view>
      <view class="stat-label">最多连续</view>
    </view>
  </view>

  <view class="section-title">成就徽章</view>
  <view class="badge-grid">
    <view
      wx:for="{{milestones}}"
      wx:key="days"
      class="badge {{item.unlocked ? 'unlocked' : 'locked'}}"
    >
      <view class="badge-days">{{item.days}}</view>
      <view class="badge-unit">天</view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 创建 `pages/stats/index.wxss`**

```css
.page { padding: 40rpx 32rpx; }
.stats-row { display: flex; justify-content: space-between; }
.stat-card {
  width: 30%; background: #fff; border-radius: 24rpx; text-align: center;
  padding: 40rpx 0; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
}
.stat-num { font-size: 56rpx; font-weight: 700; color: #ff8a5c; }
.stat-label { font-size: 24rpx; color: #9aa0a6; margin-top: 8rpx; }
.section-title { font-size: 32rpx; font-weight: 600; margin: 48rpx 0 24rpx; }
.badge-grid { display: flex; flex-wrap: wrap; }
.badge {
  width: 140rpx; height: 140rpx; border-radius: 24rpx; margin: 0 24rpx 24rpx 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.badge.unlocked { background: #ff8a5c; color: #fff; }
.badge.locked { background: #e8eaed; color: #9aa0a6; }
.badge-days { font-size: 44rpx; font-weight: 700; }
.badge-unit { font-size: 22rpx; margin-top: 4rpx; }
```

- [ ] **Step 4: 创建 `pages/stats/index.json`**

```json
{ "navigationBarTitleText": "统计与成就" }
```

- [ ] **Step 5: Commit**

```bash
git add pages/stats/index.js pages/stats/index.wxml pages/stats/index.wxss pages/stats/index.json
git commit -m "feat: add stats and achievements page"
```

---

### Task 7: 逻辑验证（Node 冒烟测试）

**Files:**
- Create: `scripts/smoke-test.js`

**Interfaces:**
- Consumes: `utils/date.js`、`utils/store.js`、`utils/achievements.js`（用 mock 的 `global.wx` 与 `global.Date`）。

> 由于微信 API 依赖 `wx` 全局对象，冒烟测试在 Node 中注入 `global.wx`（storage 用内存 Map）并 mock 系统时间，验证统计与成就逻辑，不依赖微信开发者工具即可先跑通核心逻辑。

- [ ] **Step 1: 创建 `scripts/smoke-test.js`**

```js
const assert = require('assert');

const storage = {};
global.wx = {
  getStorageSync: (k) => storage[k],
  setStorageSync: (k, v) => { storage[k] = v; }
};

function mockToday(str) {
  const realDate = Date;
  const realNow = Date.now;
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
```

- [ ] **Step 2: 运行并验证**

Run: `node scripts/smoke-test.js`
Expected: 输出 `SMOKE TEST PASSED`。

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-test.js
git commit -m "test: add smoke test for store and achievements"
```

---

## Self-Review

- **Spec coverage:** 页面（checkin/stats）✓、存储 ✓、天数统计 ✓、成就判定 ✓、幂等/损坏容错 ✓、跨天 ✓、手动测试 → 以冒烟测试替代自动化部分 ✓。
- **Placeholder scan:** 无 TBD/TODO；每步含完整代码与命令。
- **Type consistency:** `computeStats` 返回 `{currentStreak,totalDays,bestStreak}` 在 Task 3 定义，Task 4/5/6 一致使用；`checkAndUnlock(stats)` 返回 `Array<number>`，Task 4 定义、Task 5 使用，一致。
