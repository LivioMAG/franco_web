async function createAutoReportsForApprovedHolidayRequest(request) {
  if (!request?.profile_id || !request?.start_date || !request?.end_date) {
    return;
  }

  const requestTypeLabel = getAbsenceTypeLabel(request, String(request.request_type || 'Absenz'));
  const requestTypeCode = getAbsenceTypeCode(request);
  const days = [];
  const cursor = new Date(`${request.start_date}T00:00:00Z`);
  const endDate = new Date(`${request.end_date}T00:00:00Z`);
  while (cursor <= endDate) {
    const weekday = cursor.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      const workDate = cursor.toISOString().slice(0, 10);
      if (getAutoAbsenceMinutesForDate(request, workDate) !== null) {
        days.push(workDate);
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (!days.length) {
    return;
  }

  if (state.isDemoMode) {
    const holidayDates = new Set(
      demoWeeklyReports
        .filter((report) => String(report.profile_id) === String(request.profile_id) && HOLIDAY_TYPE_CODES.has(Number(report.abz_typ)))
        .map((report) => String(report.work_date)),
    );
    state.platformHolidays.forEach((entry) => holidayDates.add(String(entry.holiday_date || '')));
    const daysWithoutHoliday = days.filter((workDate) => !holidayDates.has(String(workDate)));
    if (!daysWithoutHoliday.length) {
      return;
    }
    const existingDates = new Set(
      demoWeeklyReports
        .filter((report) => String(report.profile_id) === String(request.profile_id))
        .map((report) => report.work_date),
    );
    daysWithoutHoliday.forEach((workDate) => {
      if (existingDates.has(workDate)) {
        return;
      }
      demoWeeklyReports.push(buildAutoAbsenceWeeklyReport(request, workDate, requestTypeLabel, requestTypeCode));
    });
    return;
  }

  const { data: existingReports, error: existingReportsError } = await state.supabase
    .from('weekly_reports')
    .select('work_date, abz_typ')
    .eq('profile_id', request.profile_id)
    .in('work_date', days);
  if (existingReportsError) {
    throw existingReportsError;
  }
  const holidayDates = new Set(state.platformHolidays.map((entry) => String(entry.holiday_date || '')));
  (existingReports || []).forEach((report) => {
    if (HOLIDAY_TYPE_CODES.has(Number(report.abz_typ)) && report.work_date) {
      holidayDates.add(String(report.work_date));
    }
  });
  const daysWithoutHoliday = days.filter((workDate) => !holidayDates.has(String(workDate)));
  if (!daysWithoutHoliday.length) {
    return;
  }
  const existingDates = new Set((existingReports ?? []).map((report) => report.work_date));
  const rowsToInsert = daysWithoutHoliday
    .filter((workDate) => !existingDates.has(workDate))
    .map((workDate) => buildAutoAbsenceWeeklyReport(request, workDate, requestTypeLabel, requestTypeCode));
  if (!rowsToInsert.length) {
    return;
  }
  const { error } = await state.supabase.from('weekly_reports').insert(rowsToInsert);
  if (error) {
    throw error;
  }
}

function buildAutoAbsenceWeeklyReport(request, workDate, requestTypeLabel, requestTypeCode) {
  const isoWeek = getIsoYearAndWeekFromDateString(workDate);
  const dailyMinutes = getAutoAbsenceMinutesForDate(request, workDate) ?? getAutoAbsenceDailyMinutesForProfile(request.profile_id);
  return {
    id: crypto.randomUUID(),
    profile_id: request.profile_id,
    work_date: workDate,
    year: isoWeek.year,
    kw: isoWeek.kw,
    project_name: requestTypeLabel,
    commission_number: requestTypeLabel,
    abz_typ: Number.isInteger(requestTypeCode) ? requestTypeCode : 0,
    start_time: '07:00',
    end_time: '16:30',
    lunch_break_minutes: 60,
    additional_break_minutes: 30,
    total_work_minutes: dailyMinutes,
    total_adjusted_work_minutes: dailyMinutes,
    expenses_amount: 0,
    other_costs_amount: 0,
    expense_note: '',
    notes: `Automatisch erstellt aus bestätigter Absenz (${requestTypeLabel}).`,
    controll: '',
    attachments: [],
  };
}

function getAutoAbsenceDailyMinutesForProfile(profileId) {
  const profile = getProfileById(profileId);
  const weeklyHours = Number(profile?.weekly_hours);
  const normalizedWeeklyHours = Number.isFinite(weeklyHours) && weeklyHours > 0 ? weeklyHours : 40;
  return Math.max(8 * 60, Math.round((normalizedWeeklyHours / 5) * 60));
}

function getSpecialRequestHoursMap(request) {
  const value = request?.special_request_hours;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value).length ? value : null;
}


function hasSpecialRequestHours(request) {
  return Boolean(getSpecialRequestHoursMap(request));
}

function isPartialIllnessOrAccidentRequest(request) {
  const typeCode = Number(getAbsenceTypeCode(request));
  return (typeCode === 2 || typeCode === 4) && hasSpecialRequestHours(request);
}

function getGermanWeekdayNameFromDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return weekdayNames[date.getUTCDay()] || '';
}

function getAutoAbsenceMinutesForDate(request, workDate) {
  const specialRequestHours = getSpecialRequestHoursMap(request);
  if (!specialRequestHours) {
    return getAutoAbsenceDailyMinutesForProfile(request?.profile_id);
  }

  const weekdayName = getGermanWeekdayNameFromDateString(workDate);
  const hours = Number(specialRequestHours[weekdayName]);
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  return Math.round(hours * 60);
}
