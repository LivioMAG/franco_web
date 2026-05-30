function getHolidayRequestDurationLabel(request) {
  const start = new Date(`${request.start_date}T00:00:00Z`);
  const end = new Date(`${request.end_date}T00:00:00Z`);
  const diffDays = Math.round((end - start) / 86400000) + 1;
  if (diffDays <= 1) {
    return '1 Tag';
  }
  return `${diffDays} Tage`;
}

function buildWeeklyRemarkLines(reports) {
  const notes = [];
  reports.forEach((report) => {
    if (report.notes) {
      notes.push(`${formatDate(report.work_date)}: ${report.notes}`);
    }

    const nightWorkRemark = buildNightWorkRemark(report);
    if (nightWorkRemark) {
      notes.push(nightWorkRemark);
    }
  });
  return dedupeStrings(notes);
}

function buildNightWorkRemark(report) {
  const overlap = getNightShiftOverlap(report.start_time, report.end_time);
  if (!overlap) {
    return '';
  }

  return `Nachtarbeit ${getWeekdayLabel(report.work_date)}: ${formatTimeLabel(overlap.start)}–${formatTimeLabel(overlap.end)}`;
}

function getNightShiftOverlap(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  const normalizedEndMinutes = endMinutes <= startMinutes ? endMinutes + 24 * 60 : endMinutes;
  const nightWindows = [
    { start: 0, end: 6 * 60 },
    { start: 22 * 60, end: 30 * 60 },
  ];

  const overlapSegments = nightWindows
    .map((window) => ({
      start: Math.max(startMinutes, window.start),
      end: Math.min(normalizedEndMinutes, window.end),
    }))
    .filter((segment) => segment.end > segment.start);

  if (!overlapSegments.length) {
    return null;
  }

  return {
    start: overlapSegments[0].start,
    end: overlapSegments[overlapSegments.length - 1].end,
  };
}

function buildEmptyAbsenceRows() {
  return [
    { label: 'Ferien', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Krankheit', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Militär', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Unfall', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Feiertag', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Total Absenzen', days: Array(6).fill(''), total: '', notes: '' },
  ];
}


function isAbsenceReport(report) {
  return getAbsenceTypeCode(report) > 0;
}

function getAbsenceTypeCode(source) {
  const explicitFieldCandidates = ['abz_typ', 'abts_type', 'abts_underscore_type', 'absence_type'];
  for (const fieldName of explicitFieldCandidates) {
    const value = Number(source?.[fieldName]);
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
  }

  const normalizedRequestType = normalizeSearchValue(source?.request_type);
  if (normalizedRequestType && Object.prototype.hasOwnProperty.call(HOLIDAY_REQUEST_TYPE_TO_ABSENCE_TYPE_CODE, normalizedRequestType)) {
    return HOLIDAY_REQUEST_TYPE_TO_ABSENCE_TYPE_CODE[normalizedRequestType];
  }

  return 0;
}

function getAbsenceTypeLabel(source, fallbackLabel = '') {
  const typeCode = getAbsenceTypeCode(source);
  if (typeCode > 0 && ABSENCE_TYPE_CODE_LABELS[typeCode]) {
    return ABSENCE_TYPE_CODE_LABELS[typeCode];
  }

  const requestType = normalizeSearchValue(source?.request_type);
  if (requestType && HOLIDAY_TYPE_LABELS[requestType]) {
    return HOLIDAY_TYPE_LABELS[requestType];
  }

  return String(fallbackLabel || source?.request_type || 'Absenz').trim() || 'Absenz';
}

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseTimeToMinutes(timeString) {
  const match = String(timeString || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatTimeLabel(totalMinutes) {
  const normalizedMinutes = ((Number(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getWeekdayLabel(dateString) {
  return WEEKDAY_LABELS[getWeekdayIndex(dateString)] || '';
}

function formatHours(totalMinutes) {
  const numericMinutes = Number(totalMinutes || 0);
  if (!numericMinutes) {
    return '';
  }
  return (numericMinutes / 60).toFixed(2);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(value || 0));
}

function formatMinutes(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(2)} h`;
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString('de-CH');
}

function formatTimeWithoutSeconds(timeValue) {
  const raw = String(timeValue || '').trim();
  if (!raw) return '–';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function formatTimeRange(startTime, endTime) {
  const startLabel = formatTimeWithoutSeconds(startTime);
  const endLabel = formatTimeWithoutSeconds(endTime);
  if (startLabel === '–' && endLabel === '–') return '–';
  return `${startLabel} – ${endLabel}`;
}

function normalizeTimeForInput(value) {
  const normalized = formatTimeWithoutSeconds(value);
  return normalized === '–' ? '' : normalized;
}



function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
