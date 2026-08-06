# 不生气打卡 V2 增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已完成的 V1（打卡 + 统计 + 里程碑成就）基础上，新增情绪管理、数据可视化、内容激励、成就扩展四大增强。

**Architecture:** 沿用 V1 原生微信小程序架构。核心逻辑继续收敛在 `utils/` 纯函数模块；新增 `pages/calm` 呼吸安抚页；stats 页扩展日历/趋势图/词频。

**Tech Stack:** 原生微信小程序，`<canvas>` 手绘图表，零第三方依赖。

## Global Constraints

- 原生微信小程序语法，不引入任何 npm 包或跨端框架。
- 存储 key：`checkin_records`、`unlocked_achievements`。
- 日期统一 `YYYY-MM-DD` 字符串，本地时区。
- 打卡判定：当天 `done:true` 才计入连续/累计；`angry:true` 当天失败。
- 成就 ID 命名：`streak_N` / `month_full` / `week_full_N` / `angry_log_N` / `start_N` / `recover_N` / `best_N`。
- 中文字案与设计文档一致。所有 JS 模块用 CommonJS。
- V1 数据兼容：旧记录无 `angry`/`reason` 字段可正常读取；`unlocked_achievements` 旧数值自动迁移为 `streak_N`。

---

### Task 8: 数据模型升级 — `utils/store.js` 记录生气 + 兼容旧数据

**Files:**
- Modify: `utils/store.js`
- Test: `scripts/smoke-test.js`

**Interfaces:**
- Consumes: V1 `getRecords` / `upsert` / `computeStats` / `getUnlockedAchievements` / `saveUnlockedAchievements`。
- Produces:
  - `recordAngry(reasons: Array<string>) => void`
  - `getReasonFrequency() => Array<{text: string, count: number}>`
  - `migrateUnlocked() => void` — 旧数值 `[3,7]` → `['streak_3','streak_7']`
  - `getUnlockedAchievements() => Array<string>`（V2 起返回成就 ID 数组）

- [ ] **Step 1: 在 `utils/store.js` 增加生气记录与词频统计**

在 `module.exports` 前追加：

```js
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
```

将 `getUnlockedAchievements` 的返回值改为数组字符串，并增加迁移：

```js
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
```

`module.exports` 增加 `recordAngry, getReasonFrequency, migrateUnlocked`。

- [ ] **Step 2: 更新冒烟测试覆盖新逻辑（见 Task 15 统一重写）**

先跑现有测试确认兼容：

Run: `node scripts/smoke-test.js`
Expected: `SMOKE TEST PASSED`（旧数据逻辑不受影响）

- [ ] **Step 3: Commit**

```bash
git add utils/store.js
git commit -m "feat: add angry recording and unlock migration to store"
```

---

### Task 9: 内容激励 — `utils/quotes.js` 与 `utils/encourage.js`

**Files:**
- Create: `utils/quotes.js`
- Create: `utils/encourage.js`

**Interfaces:**
- Produces:
  - `quotes.getDailyQuote(dateStr: string) => string` — 按日期确定性返回一句。
  - `encourage.getDoneMessage(streak: number) => string` — 连续天数分档鼓励。
  - `encourage.getCalmMessage() => string` — 安抚页安慰语。

- [ ] **Step 1: 创建 `utils/quotes.js`**

```js
const QUOTES = [
  '生气是拿别人的错误惩罚自己。',
  '能控制情绪的人，才能掌控人生。',
  '深呼吸，世界并没有你想的那么糟。',
  '当你凝视深渊时，也请记得仰望星空。',
  '心平能愈三千疾，心静可通万事理。',
  '今天不生气，就是给未来攒一份从容。',
  '风再大，也吹不倒有根的树。',
  '你已经很棒了，别让一时的怒气毁掉它。',
  '气话只会在伤口上撒盐，温柔才是解药。',
  '遇事不乱，遇难不慌，是你最帅的样子。',
  '怒气就像一把火，烧别人也烧自己。',
  '给别人留余地，也是给自己留退路。',
  '慢一点，再慢一点，答案自然会浮现。',
  '你无法阻止浪潮，但可以学会冲浪。',
  '今日静心，明日顺心。',
  '耐心是苦涩的树，结的是甜蜜的果。',
  '把愤怒咽回去，把福气留下来。',
  '真正的强大，是温柔而不失控。',
  '生活偶尔扎人，但你可以温柔以待。',
  '不为难自己，就是最好的修行。',
  '生气解决不了问题，但冷静可以。',
  '你值得拥有平静的一天。',
  '内心的安宁，是最大的奢侈品。',
  '放过别人，是放过自己。',
  '此刻的平静，胜过千言万语。',
  '深呼吸三次，世界会温柔很多。',
  '所有的好脾气，都是对自己的善待。',
  '心若不动，风又奈何。',
  '今天也要做情绪的主人。',
  '平静是给自己的礼物。'
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getDailyQuote(dateStr) {
  const idx = hashString(dateStr) % QUOTES.length;
  return QUOTES[idx];
}

module.exports = { getDailyQuote };
```

- [ ] **Step 2: 创建 `utils/encourage.js`**

```js
function getDoneMessage(streak) {
  if (streak >= 100) return '百天奇迹，你已炼成温柔本身！';
  if (streak >= 30) return '一个月的从容，了不起的坚持！';
  if (streak >= 14) return '两周不发火，情绪管理大师！';
  if (streak >= 7) return '连续一周心平气和，太棒了！';
  if (streak >= 3) return '连续三天不生气，好状态！';
  if (streak >= 1) return '今天没生气，成功的一天！';
  return '每一天都是新的开始！';
}

function getCalmMessage() {
  return '生气很正常，能停下来就赢了。深呼吸，你已经在变好的路上了。';
}

module.exports = { getDoneMessage, getCalmMessage };
```

- [ ] **Step 3: Commit**

```bash
git add utils/quotes.js utils/encourage.js
git commit -m "feat: add daily quotes and encourage messages"
```

---

### Task 10: 成就扩展 — `utils/achievements.js`

**Files:**
- Modify: `utils/achievements.js`

**Interfaces:**
- Consumes: `store.getRecords()`、`store.getUnlockedAchievements()`、`store.saveUnlockedAchievements()`、`store.migrateUnlocked()`、`dateUtil`。
- Produces:
  - `ALL: Array<{id, title, desc, days}>` — 全部成就定义（徽章展示）。
  - `checkAndUnlock() => Array<string>` — 全量扫描返回新解锁成就 ID。
  - `getAll() => Array<{id, title, desc, unlocked}>`。

判定辅助函数内部实现：`bestStreak`（历史最佳连续 done）、`countMonthFull`（自然月满勤）、`countWeekFull`（连续满周）、`angryCount`、`startCount`、`recoverCount`。

- [ ] **Step 1: 重写 `utils/achievements.js`**

```js
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
  if (doneDates.length < 7) return 0;
  const doneSet = {};
  doneDates.forEach((d) => { doneSet[d] = true; });
  let best = 0, run = 0;
  for (let i = 0; i < doneDates.length; i++) {
    if (doneSet[dateUtil.formatDate(new Date(dateUtil.parseDate(doneDates[i]).getTime() - 86400000))]) {
      run += 1;
    } else {
      run = 1;
    }
    if (run >= 7 && run % 7 === 0 && best < run / 7) best = run / 7;
  }
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
    if (sorted[i - 1].angry) {
      let j = i;
      let streak = 0;
      while (j < sorted.length && sorted[j].done) {
        streak += 1;
        j += 1;
      }
      if (streak >= 3 && dateUtil.parseDate(sorted[i].date).getTime() - dateUtil.parseDate(sorted[i - 1].date).getTime() <= 3 * 86400000) {
        count += 1;
      }
    }
  }
  return count;
}

function evaluate(records) {
  const best = bestStreak(records);
  const unlockedIds = store.getUnlockedAchievements();
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
  return { best, conditions, unlockedIds };
}

function checkAndUnlock() {
  store.migrateUnlocked();
  const { conditions, unlockedIds } = evaluate(store.getRecords());
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
  const { conditions, unlockedIds } = evaluate(store.getRecords());
  return ALL.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.desc,
    days: a.days,
    unlocked: conditions[a.id] || unlockedIds.indexOf(a.id) >= 0
  }));
}

module.exports = { ALL, checkAndUnlock, getAll };
```

> 说明：`getAll` 中的 `unlocked` 采用"条件达成即视为解锁"，解锁持久化仅用于"是否弹新提示"。避免用户在 stats 页看到灰色但条件已满足的徽章。

- [ ] **Step 2: Commit**

```bash
git add utils/achievements.js
git commit -m "feat: extend achievements with full-attendance, behavior and derived types"
```

---

### Task 11: 深呼吸安抚页 — `pages/calm`

**Files:**
- Create: `pages/calm/index.js`
- Create: `pages/calm/index.wxml`
- Create: `pages/calm/index.wxss`
- Create: `pages/calm/index.json`
- Modify: `app.json`（注册页面路径）

**Interfaces:**
- 无模块依赖；`encourage.getCalmMessage()` 提供安慰语。
- 3 轮动画：吸气 4s → 屏息 4s → 呼气 6s，使用 `setTimeout`/`setInterval` 驱动环形缩放。

- [ ] **Step 1: 创建 `pages/calm/index.js`**

```js
const encourage = require('../../utils/encourage');

const PHASES = [
  { label: '吸气', seconds: 4 },
  { label: '屏息', seconds: 4 },
  { label: '呼气', seconds: 6 }
];
const ROUNDS = 3;

Page({
  data: {
    phaseLabel: '',
    scale: 1,
    rounds: 0,
    finished: false,
    message: ''
  },

  onLoad() {
    this.setData({ message: encourage.getCalmMessage() });
    this.start();
  },

  onUnload() {
    this.stop();
  },

  start() {
    this.stop();
    this.setData({ finished: false, rounds: 0 });
    this.runPhase(0, 0);
  },

  runPhase(phaseIdx, round) {
    if (round >= ROUNDS) {
      this.setData({ finished: true, phaseLabel: '完成' });
      return;
    }
    const phase = PHASES[phaseIdx];
    this.setData({
      phaseLabel: phase.label,
      scale: phase.label === '呼气' ? 1 : 1.35
    });
    const that = this;
    this._timer = setTimeout(() => {
      const nextPhase = phaseIdx + 1;
      if (nextPhase >= PHASES.length) {
        this.runPhase(0, round + 1);
      } else {
        this.runPhase(nextPhase, round);
      }
    }, phase.seconds * 1000);
  },

  stop() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  },

  onGoBack() {
    wx.navigateBack();
  }
});
```

> 说明：`scale` 由 `transition` 动画驱动（见 Step 2 wxss），phase 切换时更新目标值即可平滑放大缩小。

- [ ] **Step 2: 创建 `pages/calm/index.wxml`**

```xml
<view class="calm-page">
  <view class="calm-title">慢慢来</view>

  <view class="circle-wrap">
    <view class="circle {{phaseLabel}}" style="transform: scale({{scale}});"></view>
    <view class="phase-label">{{phaseLabel}}</view>
    <view class="round-info" wx:if="{{!finished}}">第 {{rounds + 1}} / {{3}} 轮</view>
  </view>

  <view class="message" wx:if="{{finished}}">{{message}}</view>

  <view class="tips" wx:if="{{!finished}}">
    <view>跟着圆圈节奏呼吸</view>
    <view>吸气 4 秒 · 屏息 4 秒 · 呼气 6 秒</view>
  </view>

  <button class="back-btn" bindtap="onGoBack">返回打卡页</button>
</view>
```

> 说明：`rounds + 1` 实时反映当前轮次（初始 0 → 显示第 1 轮）。

- [ ] **Step 3: 创建 `pages/calm/index.wxss`**

```css
.calm-page {
  min-height: 100vh; background: linear-gradient(180deg, #e8f5e9, #f7f8fa);
  display: flex; flex-direction: column; align-items: center;
  padding: 100rpx 40rpx; box-sizing: border-box;
}
.calm-title { font-size: 40rpx; font-weight: 600; color: #52c41a; margin-bottom: 60rpx; }
.circle-wrap { position: relative; width: 360rpx; height: 360rpx; }
.circle {
  width: 200rpx; height: 200rpx; border-radius: 50%;
  background: rgba(82, 196, 26, 0.25);
  position: absolute; left: 80rpx; top: 80rpx;
  transition: transform 0.2s ease;
  display: flex; align-items: center; justify-content: center;
}
.phase-label {
  position: absolute; left: 0; right: 0; top: 150rpx;
  text-align: center; font-size: 40rpx; font-weight: 600; color: #333;
}
.round-info { position: absolute; left: 0; right: 0; top: 210rpx; text-align: center; color: #9aa0a6; font-size: 26rpx; }
.message { font-size: 32rpx; color: #52c41a; text-align: center; margin: 40rpx 0; line-height: 1.8; }
.tips { color: #9aa0a6; font-size: 26rpx; text-align: center; margin: 40rpx 0; }
.back-btn { margin-top: 60rpx; background: #52c41a; color: #fff; border-radius: 999rpx; width: 60%; }
```

- [ ] **Step 4: 创建 `pages/calm/index.json`**

```json
{ "navigationBarTitleText": "深呼吸" }
```

- [ ] **Step 5: `app.json` pages 数组追加 `"pages/calm/index"`**

- [ ] **Step 6: Commit**

```bash
git add pages/calm app.json
git commit -m "feat: add breathing calm page"
```

---

### Task 12: 打卡页升级 — `pages/checkin` 四态 + 生气弹层 + 每日一句

**Files:**
- Modify: `pages/checkin/index.js`
- Modify: `pages/checkin/index.wxml`
- Modify: `pages/checkin/index.wxss`
- Modify: `pages/checkin/index.json`

**Interfaces:**
- Consumes: `store.getTodayStatus()`、`store.startToday()`、`store.confirmToday()`、`store.recordAngry()`、`store.computeStats()`、`achievements.checkAndUnlock()`、`quotes.getDailyQuote()`、`encourage.getDoneMessage()`。

- [ ] **Step 1: 重写 `pages/checkin/index.js`**

```js
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
    customReason: '',
    showAngryModal: false
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
    this.setData({ showAngryModal: true, selectedReasons: [], customReason: '' });
  },

  closeAngryModal() {
    this.setData({ showAngryModal: false });
  },

  onToggleReason(e) {
    const tag = e.currentTarget.dataset.tag;
    let selected = this.data.selectedReasons;
    if (selected.indexOf(tag) >= 0) {
      selected = selected.filter((t) => t !== tag);
    } else {
      selected = selected.concat(tag);
    }
    this.setData({ selectedReasons: selected });
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
```

- [ ] **Step 2: 重写 `pages/checkin/index.wxml`**

```xml
<view class="page">
  <view class="header">
    <view class="date">{{today}}</view>
    <view class="motto">深呼吸，今天也不要生气</view>
  </view>

  <view class="quote" wx:if="{{status === 'idle' || status === 'pending'}}">「{{dailyQuote}}」</view>

  <view wx:if="{{status === 'idle'}}" class="card">
    <view class="card-title">开启今日挑战</view>
    <view class="card-desc">从今天开始，承诺一整天都不生气</view>
    <button class="primary-btn" bindtap="onStartToday">开启今日挑战</button>
  </view>

  <view wx:elif="{{status === 'pending'}}" class="card">
    <view class="card-title">已承诺</view>
    <view class="card-desc">期待今晚的好消息，坚持住</view>
    <button class="primary-btn" bindtap="onConfirmToday">今晚确认：今天没生气</button>
    <button class="ghost-btn" bindtap="openAngryModal">今天忍不住生气了</button>
  </view>

  <view wx:elif="{{status === 'angry'}}" class="card angry">
    <view class="card-title">今天放松一点</view>
    <view class="card-desc">记录下原因，明天重新开始</view>
    <button class="ghost-btn" bindtap="openAngryModal">补充生气原因</button>
  </view>

  <view wx:else class="card done">
    <view class="card-title">今日挑战成功</view>
    <view class="card-desc">{{doneMessage}}</view>
  </view>

  <view class="streak">
    <view class="streak-num">{{currentStreak}}</view>
    <view class="streak-label">当前连续不生气天数</view>
  </view>

  <view class="modal-mask" wx:if="{{showAngryModal}}" bindtap="closeAngryModal">
    <view class="modal" catchtap="noop">
      <view class="modal-title">这次是因为什么？</view>
      <view class="tag-wrap">
        <view
          wx:for="{{reasonTags}}"
          wx:key="*this"
          class="tag {{selectedReasons.indexOf(item) >= 0 ? 'selected' : ''}}"
          data-tag="{{item}}"
          bindtap="onToggleReason"
        >{{item}}</view>
      </view>
      <input class="custom-input" placeholder="补充说明（可选）" value="{{customReason}}" bindinput="onCustomInput" />
      <button class="primary-btn" bindtap="onConfirmAngry">记下了</button>
    </view>
  </view>
</view>
```

> 说明：`catchtap="noop"` 需在 js 中定义空方法 `noop() {}` 阻止冒泡关闭弹层。

- [ ] **Step 3: `pages/checkin/index.js` 增加 `noop() {}` 方法**

- [ ] **Step 4: 追加 `pages/checkin/index.wxss` 新样式**

```css
.quote { text-align: center; font-size: 26rpx; color: #9aa0a6; font-style: italic; margin-bottom: 32rpx; line-height: 1.6; }
.ghost-btn { background: #fff; color: #ff8a5c; border: 2rpx solid #ff8a5c; border-radius: 999rpx; font-size: 30rpx; margin-top: 20rpx; }
.card.angry .card-title { color: #e6a23c; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { width: 80%; background: #fff; border-radius: 24rpx; padding: 40rpx 32rpx; }
.modal-title { font-size: 32rpx; font-weight: 600; margin-bottom: 24rpx; }
.tag-wrap { display: flex; flex-wrap: wrap; margin-bottom: 24rpx; }
.tag { padding: 12rpx 28rpx; border-radius: 999rpx; border: 2rpx solid #e0e0e0; color: #666; margin: 0 16rpx 16rpx 0; font-size: 28rpx; }
.tag.selected { background: #ff8a5c; border-color: #ff8a5c; color: #fff; }
.custom-input { border: 2rpx solid #e0e0e0; border-radius: 12rpx; padding: 16rpx 20rpx; font-size: 28rpx; margin-bottom: 32rpx; }
```

- [ ] **Step 5: Commit**

```bash
git add pages/checkin
git commit -m "feat: upgrade checkin page with angry flow and daily quote"
```

---

### Task 13: 统计页升级 — `pages/stats` 日历 + 趋势图 + 词频

**Files:**
- Modify: `pages/stats/index.js`
- Modify: `pages/stats/index.wxml`
- Modify: `pages/stats/index.wxss`
- Modify: `pages/stats/index.json`

**Interfaces:**
- Consumes: `store.computeStats()`、`store.getDayMap()`、`store.getReasonFrequency()`、`achievements.getAll()`、`dateUtil`。
- 日历：本月格子；成功绿点 / 生气红点 / 已设定橙点 / 无记录灰。左右切月。
- 趋势图：近 30 天成功天数，`<canvas>` 手绘柱状。
- 词频：原因条形排行。

- [ ] **Step 1: 重写 `pages/stats/index.js`**

```js
const store = require('../../utils/store');
const achievements = require('../../utils/achievements');
const dateUtil = require('../../utils/date');

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

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
    frequencies: []
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
    const unlocked = store.getUnlockedAchievements();
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
    const dayMap = store.getDayMap();
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
    const max = Math.max(1, ...data);
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
```

- [ ] **Step 2: 重写 `pages/stats/index.wxml`**

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

  <view class="section-title">打卡日历</view>
  <view class="cal-header">
    <view class="cal-nav" bindtap="onPrevMonth">‹</view>
    <view class="cal-label">{{monthLabel}}</view>
    <view class="cal-nav" bindtap="onNextMonth">›</view>
  </view>
  <view class="cal-week">
    <view class="cal-week-cell" wx:for="{{WEEK_CN}}" wx:key="*this">{{item}}</view>
  </view>
  <view class="cal-grid">
    <view
      wx:for="{{calendar}}"
      wx:key="index"
      class="cal-cell {{item.type}}"
    >{{item.day}}</view>
  </view>
  <view class="cal-legend">
    <view class="legend-item"><view class="dot done"></view>成功</view>
    <view class="legend-item"><view class="dot angry"></view>生气</view>
    <view class="legend-item"><view class="dot started"></view>已承诺</view>
  </view>

  <view class="section-title">近 30 天趋势</view>
  <canvas canvas-id="trendChart" class="trend-canvas"></canvas>

  <view class="section-title">生气原因排行</view>
  <view class="freq-list">
    <view wx:if="{{frequencies.length === 0}}" class="freq-empty">暂无记录</view>
    <view wx:for="{{frequencies}}" wx:key="text" class="freq-item">
      <view class="freq-text">{{item.text}}</view>
      <view class="freq-bar-wrap"><view class="freq-bar" style="width: {{item.count / 10 * 100}}%;"></view></view>
      <view class="freq-count">{{item.count}}</view>
    </view>
  </view>

  <view class="section-title">成就徽章</view>
  <view class="badge-grid">
    <view
      wx:for="{{achievements}}"
      wx:key="id"
      class="badge {{item.unlocked ? 'unlocked' : 'locked'}}"
    >
      <view class="badge-days">{{item.days > 0 ? item.days : '✓'}}</view>
      <view class="badge-title">{{item.title}}</view>
      <view class="badge-desc">{{item.desc}}</view>
    </view>
  </view>
</view>
```

> 说明：WXML 中 `WEEK_CN` 需在 `data` 提供（见 Step 3）；`freq-bar` 宽度用 `count/10*100%` 简单归一，最多 10 次即满宽。

- [ ] **Step 3: `pages/stats/index.js` 的 `data` 增加 `WEEK_CN`**

```js
data: {
  ...
  WEEK_CN: ['日', '一', '二', '三', '四', '五', '六']
}
```

- [ ] **Step 4: 追加 `pages/stats/index.wxss` 新样式**

```css
.cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.cal-nav { font-size: 40rpx; color: #ff8a5c; padding: 0 20rpx; }
.cal-label { font-size: 30rpx; font-weight: 600; }
.cal-week { display: flex; }
.cal-week-cell { width: 14.28%; text-align: center; color: #9aa0a6; font-size: 24rpx; }
.cal-grid { display: flex; flex-wrap: wrap; background: #fff; border-radius: 24rpx; padding: 16rpx 8rpx; }
.cal-cell { width: 14.28%; height: 80rpx; display: flex; align-items: center; justify-content: center; font-size: 26rpx; color: #666; position: relative; }
.cal-cell.blank { color: transparent; }
.cal-cell.done::after, .cal-cell.angry::after, .cal-cell.started::after {
  content: ''; position: absolute; bottom: 8rpx; width: 12rpx; height: 12rpx; border-radius: 50%;
}
.cal-cell.done::after { background: #52c41a; }
.cal-cell.angry::after { background: #e64340; }
.cal-cell.started::after { background: #ffa94d; }
.cal-legend { display: flex; justify-content: center; margin: 20rpx 0; }
.legend-item { display: flex; align-items: center; font-size: 24rpx; color: #9aa0a6; margin: 0 16rpx; }
.dot { width: 14rpx; height: 14rpx; border-radius: 50%; margin-right: 8rpx; }
.dot.done { background: #52c41a; }
.dot.angry { background: #e64340; }
.dot.started { background: #ffa94d; }
.trend-canvas { width: 680rpx; height: 280rpx; }
.freq-list { background: #fff; border-radius: 24rpx; padding: 24rpx; }
.freq-empty { color: #9aa0a6; font-size: 26rpx; text-align: center; padding: 20rpx; }
.freq-item { display: flex; align-items: center; margin: 16rpx 0; }
.freq-text { width: 160rpx; font-size: 26rpx; color: #333; }
.freq-bar-wrap { flex: 1; background: #f0f0f0; border-radius: 999rpx; height: 24rpx; margin: 0 16rpx; overflow: hidden; }
.freq-bar { height: 100%; background: #ff8a5c; border-radius: 999rpx; }
.freq-count { font-size: 24rpx; color: #9aa0a6; width: 40rpx; text-align: right; }
.badge { width: 200rpx; height: 200rpx; border-radius: 24rpx; margin: 0 20rpx 24rpx 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.badge-days { font-size: 36rpx; font-weight: 700; }
.badge-title { font-size: 24rpx; margin-top: 8rpx; }
.badge-desc { font-size: 20rpx; opacity: 0.85; margin-top: 4rpx; text-align: center; padding: 0 8rpx; }
.badge.unlocked { background: #ff8a5c; color: #fff; }
.badge.locked { background: #e8eaed; color: #9aa0a6; }
.badge-grid { display: flex; flex-wrap: wrap; }
```

> 说明：V2 徽章 3 列改为 `width:200rpx`（近似 3 列），含标题与描述。

- [ ] **Step 5: Commit**

```bash
git add pages/stats
git commit -m "feat: upgrade stats page with calendar, trend chart and frequency"
```

---

### Task 14: 注册页面与整体接线

**Files:**
- Modify: `app.json`（确认 `pages/calm/index` 已注册）

- [ ] **Step 1: 检查 `app.json` 内容**

确保：

```json
"pages": [
  "pages/checkin/index",
  "pages/stats/index",
  "pages/calm/index"
]
```

- [ ] **Step 2: Commit（如 app.json 在本任务有改动）**

```bash
git add app.json
git commit -m "chore: register calm page"
```

---

### Task 15: 冒烟测试升级与验证

**Files:**
- Modify: `scripts/smoke-test.js`

**Interfaces:**
- 覆盖：生气记录中断连续、词频统计、`recover_3`、`angry_log_5`、旧数据迁移、`start_7`。

- [ ] **Step 1: 重写 `scripts/smoke-test.js`**

```js
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
```

- [ ] **Step 2: 运行验证**

Run: `node scripts/smoke-test.js`
Expected: `SMOKE TEST PASSED`

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-test.js
git commit -m "test: cover V2 angry, migration and extended achievements"
```

---

## Self-Review

- **Spec coverage:** 情绪管理（Task 8/11/12）✓、可视化（Task 13）✓、内容激励（Task 9/12）✓、成就扩展（Task 10）✓、兼容旧数据（Task 8）✓、冒烟测试（Task 15）✓。
- **Placeholder scan:** 无 TBD/TODO；每步含完整代码与命令。
- **Type consistency:** `recordAngry(reasons:Array)`、`getReasonFrequency():Array`、`checkAndUnlock():Array<string>` 在 Task 8/10 定义、Task 12/13 一致使用；`getUnlockedAchievements():Array<string>` 迁移后全局一致。
