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
