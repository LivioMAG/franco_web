function getCurrentWeekValue() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekRange(weekValue) {
  const [yearPart, weekPart] = weekValue.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const monday = new Date(simple);
  if (dayOfWeek <= 4) {
    monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getYearAndWeekFromWeekValue(weekValue) {
  const [yearPart, weekPart] = String(weekValue || '').split('-W');
  return {
    year: Number(yearPart),
    kw: Number(weekPart),
  };
}

function getIsoYearAndWeekFromDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { year: null, kw: null };
  }
  const isoWeekValue = getIsoWeekValueFromDate(date);
  return getYearAndWeekFromWeekValue(isoWeekValue);
}

function getWeekLabel(weekValue) {
  const [, weekPart] = weekValue.split('-W');
  return `KW ${weekPart}`;
}

function shiftWeekValue(weekValue, weekDelta) {
  const weekRange = getWeekRange(weekValue);
  const monday = new Date(`${weekRange.start}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + weekDelta * 7);
  return getIsoWeekValueFromDate(monday);
}

function getIsoWeekValueFromDate(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekdayIndex(dateString) {
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function getDateForWeekOffset(weekOffset, dayOffset) {
  const currentRange = getWeekRange(getCurrentWeekValue());
  const monday = new Date(`${currentRange.start}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + weekOffset * 7 + dayOffset);
  return monday.toISOString().slice(0, 10);
}

function addDays(isoDate,days){const d=new Date(`${isoDate}T00:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
