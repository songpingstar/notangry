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
      scale: phase.label === '呼气' ? 1 : 1.35,
      rounds: round
    });
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
