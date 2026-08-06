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
