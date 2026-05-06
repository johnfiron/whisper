/**
 * Date utilities for trading calendar operations.
 */
const DateUtils = (() => {
  function toYMD(d) {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  }

  function parseYMD(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
  }

  function isWeekend(d) {
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function nextBusinessDay(d) {
    let dt = new Date(d);
    dt = addDays(dt, 1);
    while (isWeekend(dt)) dt = addDays(dt, 1);
    return dt;
  }

  function prevBusinessDay(d) {
    let dt = new Date(d);
    dt = addDays(dt, -1);
    while (isWeekend(dt)) dt = addDays(dt, -1);
    return dt;
  }

  function tradingDaysBetween(a, b) {
    let count = 0;
    let cur = new Date(a);
    const end = new Date(b);
    while (cur < end) {
      cur = addDays(cur, 1);
      if (!isWeekend(cur)) count++;
    }
    return count;
  }

  function getThreeDayWindow(centerDate) {
    const center = centerDate instanceof Date ? centerDate : parseYMD(centerDate);
    return {
      priorDay: prevBusinessDay(center),
      currentDay: new Date(center),
      nextDay: nextBusinessDay(center),
    };
  }

  function formatDisplay(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[dt.getDay()]} ${months[dt.getMonth()]} ${dt.getDate()}`;
  }

  function isMarketOpen() {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const h = et.getHours();
    const m = et.getMinutes();
    const minutes = h * 60 + m;
    return !isWeekend(et) && minutes >= 570 && minutes < 960; // 9:30 - 16:00 ET
  }

  function fridayOfWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = 5 - day;
    return addDays(dt, diff);
  }

  function getWeekRange(d) {
    const dt = d instanceof Date ? d : parseYMD(d);
    const day = dt.getDay();
    const monday = addDays(dt, -((day + 6) % 7));
    const friday = addDays(monday, 4);
    return { monday, friday };
  }

  return {
    toYMD, parseYMD, addDays, isWeekend, nextBusinessDay, prevBusinessDay,
    tradingDaysBetween, getThreeDayWindow, formatDisplay, isMarketOpen,
    fridayOfWeek, getWeekRange,
  };
})();
