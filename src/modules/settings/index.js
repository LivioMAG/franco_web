async function handleSettingsUsersTableClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || state.isSavingSettings) {
    return;
  }

  const profileId = trigger.dataset.profileId;
  const profile = state.profiles.find((item) => String(item.id) === String(profileId));
  if (!profile) {
    return;
  }

  const action = trigger.dataset.action;
  if (action === 'save-user-settings') {
    await handleSaveUserSettings(profileId);
    return;
  }

  if (action === 'purge-user-account') {
    await handlePurgeUserAccount(profile);
    return;
  }

  if (action === 'edit-block-days') {
    openBlockDayModal(profile);
    return;
  }

  if (action !== 'toggle-user-active') return;

  const nextValue = profile.is_active === false;
  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const demoProfile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (demoProfile) demoProfile.is_active = nextValue;
    } else {
      const { error } = await state.supabase
        .from('app_profiles')
        .update({ is_active: nextValue })
        .eq('id', profileId);
      if (error) throw error;
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Benutzerstatus konnte nicht aktualisiert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

function handleSettingsUsersTableChange(event) {
  const roleSelect = event.target.closest('select[data-role-label-input]');
  if (!roleSelect) return;
  const profileId = roleSelect.dataset.roleLabelInput;
  const schoolDaySelect = document.querySelector(`select[data-school-day-input="${profileId}"]`);
  if (!schoolDaySelect) return;
  const blockSettingsButton = document.querySelector(`button[data-block-days-input="${profileId}"]`);
  const isApprentice = normalizeRoleLabelForSettings(roleSelect.value) === 'Lehrling';
  schoolDaySelect.disabled = state.isSavingSettings || !isApprentice;
  if (blockSettingsButton) {
    blockSettingsButton.disabled = state.isSavingSettings;
  }
  if (!isApprentice) {
    schoolDaySelect.value = '';
  }
}

function normalizeRoleLabelForSettings(roleLabel) {
  const trimmedRoleLabel = String(roleLabel || '').trim();
  const canonicalRoleLabel = APP_ROLE_OPTIONS.find((option) => option.toLowerCase() === trimmedRoleLabel.toLowerCase());
  return canonicalRoleLabel || trimmedRoleLabel;
}

function getSelectedSchoolDay(profileId) {
  const select = document.querySelector(`select[data-school-day-input="${profileId}"]`);
  const value = Number(select?.value);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return null;
  }
  return value;
}

function normalizeBlockSchedule(rawSchedule) {
  const rows = Array.isArray(rawSchedule) ? rawSchedule : [];
  return rows
    .map((entry) => {
      const weekday = Number(entry?.weekday);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
        return null;
      }
      const legacyMode = String(entry?.mode || '').trim();
      const fallback = BLOCK_DAY_LEGACY_MODE_OPTIONS[legacyMode] || null;
      const start_time = normalizeDispoTimeValue(entry?.start_time, fallback?.start || BLOCK_DAY_DEFAULT_START);
      const end_time = normalizeDispoTimeValue(entry?.end_time, fallback?.end || BLOCK_DAY_DEFAULT_END);
      const startMinutes = parseClockToMinutes(start_time);
      const endMinutes = parseClockToMinutes(end_time);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
        return null;
      }
      return { weekday, start_time, end_time };
    })
    .filter(Boolean);
}

function parseBlockSchedule(profile) {
  if (!profile) return [];
  const raw = profile.block_schedule;
  if (Array.isArray(raw)) {
    return normalizeBlockSchedule(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeBlockSchedule(JSON.parse(raw));
    } catch (error) {
      return [];
    }
  }
  return [];
}

function getBlockScheduleSummary(profile) {
  const schedule = parseBlockSchedule(profile);
  if (!schedule.length) return '–';
  return schedule
    .sort((left, right) => left.weekday - right.weekday || left.start_time.localeCompare(right.start_time))
    .map((entry) => `${WEEKDAY_LABELS[entry.weekday - 1]} (${entry.start_time}–${entry.end_time})`)
    .join(', ');
}

async function handleSaveUserSettings(profileId) {
  const roleSelect = document.querySelector(`select[data-role-label-input="${profileId}"]`);
  const roleLabel = normalizeRoleLabelForSettings(roleSelect?.value);
  const targetInput = document.querySelector(`[data-target-revenue-input="${profileId}"]`);
  const weeklyHoursInput = document.querySelector(`[data-weekly-hours-input="${profileId}"]`);
  const vacationAllowanceInput = document.querySelector(`[data-vacation-allowance-hours-input="${profileId}"]`);
  if (!roleLabel) {
    alert('Bitte eine gültige Rolle auswählen.');
    return;
  }
  const schoolDay = getSelectedSchoolDay(profileId);
  if (roleLabel === 'Lehrling' && !schoolDay) {
    alert('Für Lehrlinge muss mindestens ein Schultag ausgewählt werden.');
    return;
  }
  const parsedTargetRevenue = Number(String(targetInput?.value || '').replace(',', '.'));
  if (!Number.isFinite(parsedTargetRevenue) || parsedTargetRevenue < 0) {
    alert('Bitte einen gültigen Sollerlös (CHF) >= 0 eingeben.');
    return;
  }
  const parsedWeeklyHours = Number(String(weeklyHoursInput?.value || '').replace(',', '.'));
  if (!Number.isFinite(parsedWeeklyHours) || parsedWeeklyHours < 0) {
    alert('Bitte eine gültige Wochenarbeitszeit >= 0 eingeben.');
    return;
  }
  const parsedVacationAllowanceHours = Number(String(vacationAllowanceInput?.value || '').replace(',', '.'));
  if (!Number.isFinite(parsedVacationAllowanceHours) || parsedVacationAllowanceHours < 0) {
    alert('Bitte ein gültiges Ferienguthaben >= 0 eingeben.');
    return;
  }
  const updates = {
    role_label: roleLabel,
    target_revenue: parsedTargetRevenue,
    weekly_hours: parsedWeeklyHours,
    vacation_allowance_hours: parsedVacationAllowanceHours,
    school_day_1: roleLabel === 'Lehrling' ? schoolDay : null,
    school_day_2: null,
  };

  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const demoProfile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (demoProfile) Object.assign(demoProfile, updates);
    } else {
      const { error } = await state.supabase.from('app_profiles').update(updates).eq('id', profileId);
      if (error) throw error;
    }
    const localProfile = state.profiles.find((item) => String(item.id) === String(profileId));
    if (localProfile) Object.assign(localProfile, updates);
    await synchronizeApprenticeSchoolReportsForYears(profileId, getSchoolReportSyncYears());
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Benutzereinstellungen konnten nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

function openBlockDayModal(profile) {
  if (!elements.blockDayModal || !profile) return;
  const year = new Date().getUTCFullYear();
  elements.blockDayProfileIdInput.value = profile.id;
  elements.blockDayYearInput.value = String(year);
  const selectedEntries = parseBlockSchedule(profile);
  const selectedByWeekday = new Map(selectedEntries.map((entry) => [entry.weekday, entry]));
  const rows = SCHOOL_DAY_OPTIONS.map((day) => {
    const existing = selectedByWeekday.get(day.value);
    return `<tr>
      <td>${escapeHtml(day.label)}</td>
      <td><label class="checkbox-inline"><input type="checkbox" data-blockday-active="${day.value}" ${existing ? 'checked' : ''} /><span>Ja</span></label></td>
      <td><input type="time" data-blockday-start="${day.value}" value="${escapeAttribute(existing?.start_time || BLOCK_DAY_DEFAULT_START)}" /></td>
      <td><input type="time" data-blockday-end="${day.value}" value="${escapeAttribute(existing?.end_time || BLOCK_DAY_DEFAULT_END)}" /></td>
    </tr>`;
  }).join('');
  elements.blockDayOptionsBody.innerHTML = rows;
  elements.blockDayModal.classList.remove('hidden');
}

function closeBlockDayModal() {
  if (!elements.blockDayModal) return;
  elements.blockDayModal.classList.add('hidden');
  if (elements.blockDayForm) elements.blockDayForm.reset();
}

function isMissingBlockScheduleColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) return false;
  return message.includes("'block_schedule'") && message.includes("'app_profiles'") && message.includes('schema cache');
}

async function handleBlockDayFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings) return;
  const profileId = String(elements.blockDayProfileIdInput?.value || '').trim();
  const year = Number(elements.blockDayYearInput?.value);
  if (!profileId) return;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    alert('Bitte ein gültiges Kalenderjahr wählen.');
    return;
  }
  const blockSchedule = [];
  for (const day of SCHOOL_DAY_OPTIONS) {
    const activeInput = elements.blockDayOptionsBody?.querySelector(`input[data-blockday-active="${day.value}"]`);
    if (!(activeInput instanceof HTMLInputElement) || !activeInput.checked) continue;
    const startInput = elements.blockDayOptionsBody?.querySelector(`input[data-blockday-start="${day.value}"]`);
    const endInput = elements.blockDayOptionsBody?.querySelector(`input[data-blockday-end="${day.value}"]`);
    const start_time = normalizeDispoTimeValue(startInput?.value, BLOCK_DAY_DEFAULT_START);
    const end_time = normalizeDispoTimeValue(endInput?.value, BLOCK_DAY_DEFAULT_END);
    const startMinutes = parseClockToMinutes(start_time);
    const endMinutes = parseClockToMinutes(end_time);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
      alert(`Ungültige Blockzeit für ${day.label}. Bitte "Von" und "Bis" prüfen.`);
      return;
    }
    blockSchedule.push({ weekday: day.value, start_time, end_time });
  }
  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const demoProfile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (demoProfile) {
        demoProfile.block_schedule = blockSchedule;
      }
    } else {
      const { error } = await state.supabase.from('app_profiles').update({ block_schedule: blockSchedule }).eq('id', profileId);
      if (error) throw error;
    }
    const profile = state.profiles.find((item) => String(item.id) === String(profileId));
    if (profile) profile.block_schedule = blockSchedule;
    await synchronizeBlockDayReportsForYear(profileId, year);
    closeBlockDayModal();
    await loadData();
  } catch (error) {
    console.error(error);
    const errorMessage = isMissingBlockScheduleColumnError(error)
      ? BLOCK_SCHEDULE_SCHEMA_HINT
      : error.message;
    alert(`Blocktage konnten nicht gespeichert werden: ${errorMessage}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handlePurgeUserAccount(profile) {
  const profileId = profile?.id;
  if (!profileId) return;
  if (String(profileId) === String(state.currentProfile?.id)) {
    alert('Der eigene Account kann hier nicht gelöscht werden.');
    return;
  }
  const shouldDelete = window.confirm(`Account von "${profile.full_name || profile.email}" inkl. Dateien wirklich restlos entfernen?`);
  if (!shouldDelete) return;

  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const index = demoProfiles.findIndex((item) => String(item.id) === String(profileId));
      if (index >= 0) demoProfiles.splice(index, 1);
    } else {
      const { error } = await state.supabase.rpc('purge_user_account', {
        p_profile_id: profileId,
      });
      if (error) throw error;
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Account konnte nicht vollständig entfernt werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleHolidayFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings) return;

  const holidayDate = String(elements.holidayDateInput?.value || '').trim();
  const label = String(elements.holidayNameInput?.value || '').trim();
  const isPaid = String(elements.holidayIsPaidInput?.value || 'true') !== 'false';
  if (!holidayDate || !label) {
    alert('Bitte Datum und Bezeichnung erfassen.');
    return;
  }

  state.isSavingSettings = true;
  try {
    await createPlatformHoliday(holidayDate, label, isPaid);
    if (elements.holidayForm) {
      elements.holidayForm.reset();
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Feiertag konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleSettingsHolidaysTableClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || state.isSavingSettings) {
    return;
  }

  const holidayId = trigger.dataset.holidayId;
  if (!holidayId) return;
  const action = String(trigger.dataset.action || '').trim();

  if (action === 'start-edit-holiday') {
    state.editingHolidayId = holidayId;
    render();
    return;
  }

  if (action === 'cancel-edit-holiday') {
    state.editingHolidayId = null;
    render();
    return;
  }

  if (action === 'save-edit-holiday') {
    const row = trigger.closest('tr');
    const select = row?.querySelector('[data-holiday-paid-select]');
    const isPaid = String(select?.value || 'true') !== 'false';
    state.isSavingSettings = true;
    try {
      await updatePlatformHolidayCompensation(holidayId, isPaid);
      state.editingHolidayId = null;
      await loadData();
    } catch (error) {
      console.error(error);
      alert(`Feiertag konnte nicht aktualisiert werden: ${error.message}`);
    } finally {
      state.isSavingSettings = false;
      render();
    }
    return;
  }

  if (action === 'delete-holiday') {
    if (!confirm('Feiertag aus der Liste entfernen?')) return;
    state.isSavingSettings = true;
    try {
      await deletePlatformHoliday(holidayId);
      state.editingHolidayId = null;
      await loadData();
    } catch (error) {
      console.error(error);
      alert(`Feiertag konnte nicht entfernt werden: ${error.message}`);
    } finally {
      state.isSavingSettings = false;
      render();
    }
  }
}

async function deleteHolidayWeeklyReportsForDate(holidayDate) {
  if (state.isDemoMode) {
    for (let index = demoWeeklyReports.length - 1; index >= 0; index -= 1) {
      const report = demoWeeklyReports[index];
      if (String(report.work_date) === String(holidayDate) && HOLIDAY_TYPE_CODES.has(Number(report.abz_typ))) {
        demoWeeklyReports.splice(index, 1);
      }
    }
    return;
  }

  const { error } = await state.supabase
    .from('weekly_reports')
    .delete()
    .eq('work_date', holidayDate)
    .in('abz_typ', [...HOLIDAY_TYPE_CODES]);
  if (error) throw error;
}

async function deletePlatformHoliday(holidayId) {
  const holiday = state.platformHolidays.find((item) => String(item.id) === String(holidayId));
  if (!holiday) {
    throw new Error('Feiertag nicht gefunden.');
  }

  if (state.isDemoMode) {
    const index = demoPlatformHolidays.findIndex((item) => String(item.id) === String(holidayId));
    if (index >= 0) demoPlatformHolidays.splice(index, 1);
  } else {
    const { error } = await state.supabase.from(HOLIDAY_TABLE).delete().eq('id', holidayId);
    if (error) throw error;
  }

  await deleteHolidayWeeklyReportsForDate(holiday.holiday_date);
}

async function updatePlatformHolidayCompensation(holidayId, isPaid) {
  const holiday = state.platformHolidays.find((item) => String(item.id) === String(holidayId));
  if (!holiday) {
    throw new Error('Feiertag nicht gefunden.');
  }

  if (state.isDemoMode) {
    const entry = demoPlatformHolidays.find((item) => String(item.id) === String(holidayId));
    if (entry) {
      entry.is_paid = isPaid;
    }
    const holidayTypeCode = isPaid ? PAID_HOLIDAY_TYPE_CODE : UNPAID_HOLIDAY_TYPE_CODE;
    demoWeeklyReports.forEach((report) => {
      if (String(report.work_date) === String(holiday.holiday_date) && HOLIDAY_TYPE_CODES.has(Number(report.abz_typ))) {
        const holidayMinutes = getHolidayMinutesForProfile(report.profile_id);
        report.abz_typ = holidayTypeCode;
        report.total_work_minutes = holidayMinutes;
        report.total_adjusted_work_minutes = holidayMinutes;
        report.notes = `Automatisch aus ${isPaid ? 'bezahltem' : 'unbezahltem'} Feiertag (${holiday.label || 'Feiertag'}) erstellt.`;
      }
    });
    return;
  }

  const { error: holidayError } = await state.supabase.from(HOLIDAY_TABLE).update({ is_paid: isPaid }).eq('id', holidayId);
  if (holidayError) throw holidayError;

  const { data: holidayReports, error: reportsLoadError } = await state.supabase
    .from('weekly_reports')
    .select('id, profile_id')
    .eq('work_date', holiday.holiday_date)
    .in('abz_typ', [...HOLIDAY_TYPE_CODES]);
  if (reportsLoadError) throw reportsLoadError;

  const reportsToUpdate = (holidayReports || []).map((report) => {
    const holidayMinutes = getHolidayMinutesForProfile(report.profile_id);
    return {
      id: report.id,
      abz_typ: isPaid ? PAID_HOLIDAY_TYPE_CODE : UNPAID_HOLIDAY_TYPE_CODE,
      total_work_minutes: holidayMinutes,
      total_adjusted_work_minutes: holidayMinutes,
      notes: `Automatisch aus ${isPaid ? 'bezahltem' : 'unbezahltem'} Feiertag (${holiday.label || 'Feiertag'}) erstellt.`,
    };
  });
  if (!reportsToUpdate.length) return;

  for (const report of reportsToUpdate) {
    const { id, ...updates } = report;
    const { error: reportError } = await state.supabase
      .from('weekly_reports')
      .update(updates)
      .eq('id', id);
    if (reportError) throw reportError;
  }
}

function isAbsenceTypeCode(value) {
  return ABSENCE_TYPE_CODES.has(Number(value));
}

function getHolidayMinutesForProfile(profileId) {
  const profile = state.profiles.find((entry) => String(entry.id) === String(profileId));
  const weeklyHours = Number(profile?.weekly_hours);
  const normalizedWeeklyHours = Number.isFinite(weeklyHours) && weeklyHours > 0 ? weeklyHours : 40;
  return Math.max(480, Math.round((normalizedWeeklyHours / 5) * 60));
}

function buildHolidayWeeklyReportRow(profileId, holidayDate, label, isPaid = true) {
  const yearKw = getIsoYearAndWeekFromDateString(holidayDate);
  const holidayMinutes = getHolidayMinutesForProfile(profileId);
  return {
    profile_id: profileId,
    work_date: holidayDate,
    year: yearKw.year,
    kw: yearKw.kw,
    project_name: 'Feiertag',
    commission_number: label || 'Feiertag',
    abz_typ: isPaid ? PAID_HOLIDAY_TYPE_CODE : UNPAID_HOLIDAY_TYPE_CODE,
    start_time: '07:00',
    end_time: '16:30',
    lunch_break_minutes: 60,
    additional_break_minutes: 30,
    total_work_minutes: holidayMinutes,
    total_adjusted_work_minutes: holidayMinutes,
    expenses_amount: 0,
    other_costs_amount: 0,
    expense_note: '',
    notes: `Automatisch aus ${isPaid ? 'bezahltem' : 'unbezahltem'} Feiertag (${label || 'Feiertag'}) erstellt.`,
    controll: '',
    attachments: [],
  };
}

function groupReportsByProfile(reports) {
  return reports.reduce((map, report) => {
    const profileKey = String(report.profile_id);
    if (!map.has(profileKey)) {
      map.set(profileKey, []);
    }
    map.get(profileKey).push(report);
    return map;
  }, new Map());
}

async function loadReportsForHolidayDate(holidayDate, profileIds) {
  if (state.isDemoMode) {
    return demoWeeklyReports.filter((report) => String(report.work_date) === String(holidayDate) && profileIds.includes(report.profile_id));
  }

  const { data, error } = await state.supabase
    .from('weekly_reports')
    .select('*')
    .eq('work_date', holidayDate)
    .in('profile_id', profileIds);
  if (error) throw error;
  return data || [];
}

async function replaceWithHolidayWeeklyReport(profileId, holidayDate, label, isPaid, reportsToDelete) {
  if (state.isDemoMode) {
    if (reportsToDelete.length) {
      const reportIds = new Set(reportsToDelete.map((report) => String(report.id)));
      for (let index = demoWeeklyReports.length - 1; index >= 0; index -= 1) {
        if (reportIds.has(String(demoWeeklyReports[index].id))) {
          demoWeeklyReports.splice(index, 1);
        }
      }
    }
    demoWeeklyReports.push({ id: crypto.randomUUID(), ...buildHolidayWeeklyReportRow(profileId, holidayDate, label, isPaid) });
    return;
  }

  if (reportsToDelete.length) {
    const { error: deleteError } = await state.supabase.from('weekly_reports').delete().in('id', reportsToDelete.map((report) => report.id));
    if (deleteError) throw deleteError;
  }

  const { error: insertError } = await state.supabase.from('weekly_reports').insert(buildHolidayWeeklyReportRow(profileId, holidayDate, label, isPaid));
  if (insertError) throw insertError;
}

async function createHolidayWeeklyReportsForDate(holidayDate, label, isPaid = true) {
  const activeProfiles = getActiveProfiles();
  if (!activeProfiles.length) {
    return;
  }

  const profileIds = activeProfiles.map((profile) => profile.id);
  const existingRows = await loadReportsForHolidayDate(holidayDate, profileIds);
  const reportsByProfile = groupReportsByProfile(existingRows);

  for (const profile of activeProfiles) {
    const reportsForProfile = reportsByProfile.get(String(profile.id)) || [];
    const hasAutoBlockDay = reportsForProfile.some((report) => isAutoBlockDayReport(report));
    if (hasAutoBlockDay) {
      continue;
    }
    const absenceReportsForDate = reportsForProfile.filter((report) => isAbsenceTypeCode(report.abz_typ));
    // eslint-disable-next-line no-await-in-loop
    await replaceWithHolidayWeeklyReport(profile.id, holidayDate, label, isPaid, absenceReportsForDate);
  }
}

async function createPlatformHoliday(holidayDate, label, isPaid = true) {
  if (state.isDemoMode) {
    const alreadyExists = demoPlatformHolidays.some((item) => item.holiday_date === holidayDate);
    if (!alreadyExists) {
      demoPlatformHolidays.push({ id: crypto.randomUUID(), holiday_date: holidayDate, label, is_paid: isPaid });
    }
    await createHolidayWeeklyReportsForDate(holidayDate, label, isPaid);
    return;
  }

  const upsertResult = await state.supabase
    .from(HOLIDAY_TABLE)
    .upsert({ holiday_date: holidayDate, label, is_paid: isPaid }, { onConflict: 'holiday_date' })
    .select('*')
    .maybeSingle();
  if (upsertResult.error && !isMissingTableError(upsertResult.error, HOLIDAY_TABLE)) {
    throw upsertResult.error;
  }
  await createHolidayWeeklyReportsForDate(holidayDate, label, isPaid);
}

async function handleSchoolVacationFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings) return;
  const startDate = String(elements.schoolVacationStartInput?.value || '').trim();
  const endDate = String(elements.schoolVacationEndInput?.value || '').trim();
  if (!startDate || !endDate) {
    alert('Bitte Start- und Enddatum erfassen.');
    return;
  }
  if (endDate < startDate) {
    alert('Das Enddatum muss am oder nach dem Startdatum liegen.');
    return;
  }
  state.isSavingSettings = true;
  try {
    const syncYears = mergeSchoolReportSyncYears(
      getSchoolReportSyncYears(),
      getYearsFromDateRange(startDate, endDate),
    );
    if (state.isDemoMode) {
      state.schoolVacations.push({ id: crypto.randomUUID(), start_date: startDate, end_date: endDate });
    } else {
      const { error } = await state.supabase.from('school_vacations').insert({ start_date: startDate, end_date: endDate });
      if (error) throw error;
    }
    await synchronizeAllApprenticeSchoolReportsForYears(syncYears);
    if (elements.schoolVacationForm) {
      elements.schoolVacationForm.reset();
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Ferienzeit konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleSettingsSchoolVacationsTableClick(event) {
  const trigger = event.target.closest('[data-action="delete-school-vacation"]');
  if (!trigger || state.isSavingSettings) return;
  const vacationId = trigger.dataset.schoolVacationId;
  if (!vacationId) return;
  const vacationRange = state.schoolVacations.find((item) => String(item.id) === String(vacationId));
  if (!confirm('Ferienzeit entfernen?')) return;
  state.isSavingSettings = true;
  try {
    const syncYears = mergeSchoolReportSyncYears(
      getSchoolReportSyncYears(),
      getYearsFromDateRange(vacationRange?.start_date, vacationRange?.end_date),
    );
    if (state.isDemoMode) {
      state.schoolVacations = state.schoolVacations.filter((item) => String(item.id) !== String(vacationId));
    } else {
      const { error } = await state.supabase.from('school_vacations').delete().eq('id', vacationId);
      if (error) throw error;
    }
    await synchronizeAllApprenticeSchoolReportsForYears(syncYears);
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Ferienzeit konnte nicht entfernt werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

function openHolidayImportModal() {
  if (!elements.holidayImportModal) return;
  if (elements.holidayImportForm) elements.holidayImportForm.reset();
  populateHolidayImportYearOptions();
  resetHolidayImportProgress();
  elements.holidayImportModal.classList.remove('hidden');
  renderHolidayImportProgress();
}

function closeHolidayImportModal(force = false) {
  if (!elements.holidayImportModal) return;
  if (state.isHolidayImportRunning && !force) return;
  elements.holidayImportModal.classList.add('hidden');
  resetHolidayImportProgress();
}

function resetHolidayImportProgress() {
  state.isHolidayImportRunning = false;
  state.holidayImportStepIndex = -1;
}

function setHolidayImportStep(stepIndex) {
  state.holidayImportStepIndex = stepIndex;
  renderHolidayImportProgress();
}

function renderHolidayImportProgress() {
  if (!elements.holidayImportProgress || !elements.holidayImportProgressList || !elements.holidayImportProgressLabel) return;
  const isVisible = state.isHolidayImportRunning;
  if (elements.holidayImportCantonInput) elements.holidayImportCantonInput.disabled = isVisible;
  if (elements.holidayImportYearInput) elements.holidayImportYearInput.disabled = isVisible;
  if (elements.cancelHolidayImportButton) elements.cancelHolidayImportButton.disabled = isVisible;
  if (elements.closeHolidayImportModalButton) elements.closeHolidayImportModalButton.disabled = isVisible;
  if (elements.confirmHolidayImportButton) {
    elements.confirmHolidayImportButton.disabled = isVisible;
    elements.confirmHolidayImportButton.textContent = isVisible ? 'Wird hinzugefügt …' : 'Hinzufügen';
  }
  elements.holidayImportProgress.classList.toggle('hidden', !isVisible);
  if (!isVisible) {
    elements.holidayImportProgressList.innerHTML = '';
    return;
  }

  const currentIndex = state.holidayImportStepIndex;
  elements.holidayImportProgressLabel.textContent = currentIndex >= 0
    ? `Aktuell: ${HOLIDAY_IMPORT_STEPS[currentIndex]}`
    : 'Import wird vorbereitet …';
  elements.holidayImportProgressList.innerHTML = HOLIDAY_IMPORT_STEPS.map((step, index) => {
    const isDone = index < currentIndex;
    const isActive = index === currentIndex;
    const classNames = ['import-progress-step'];
    if (isDone) classNames.push('done');
    if (isActive) classNames.push('active');
    return `<li class="${classNames.join(' ')}">${escapeHtml(step)}</li>`;
  }).join('');
}

function isWeekdayIsoDate(dateIso) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

async function handleHolidayImportFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings || state.isDemoMode || !state.supabase) return;

  const canton = String(elements.holidayImportCantonInput?.value || '').trim().toUpperCase();
  const year = String(elements.holidayImportYearInput?.value || '').trim();
  if (!HOLIDAY_IMPORT_CANTONS.has(canton)) {
    alert('Bitte einen gültigen Kanton auswählen.');
    return;
  }
  if (!HOLIDAY_IMPORT_YEARS.has(year)) {
    alert('Bitte ein gültiges Jahr auswählen.');
    return;
  }

  state.isSavingSettings = true;
  state.isHolidayImportRunning = true;
  setHolidayImportStep(0);
  try {
    const invokeOptions = {
      body: { canton, year },
    };
    if (state.supabaseAnonKey) {
      invokeOptions.headers = {
        Authorization: `Bearer ${state.supabaseAnonKey}`,
        apikey: state.supabaseAnonKey,
      };
    }
    const { data, error } = await state.supabase.functions.invoke('import-public-holidays', invokeOptions);
    if (error) throw error;

    const holidays = Array.isArray(data?.holidays) ? data.holidays : [];
    const weekdayHolidays = holidays.filter((entry) => isIsoDate(String(entry?.holiday_date || '')) && isWeekdayIsoDate(entry.holiday_date));
    setHolidayImportStep(1);

    let importedCount = 0;
    for (const entry of weekdayHolidays) {
      const holidayDate = String(entry?.holiday_date || '').trim();
      const label = String(entry?.label || 'Feiertag').trim() || 'Feiertag';
      const isPaid = entry?.is_paid === true;
      await createPlatformHoliday(holidayDate, label, isPaid);
      importedCount += 1;
    }
    setHolidayImportStep(2);
    await loadData();
    setHolidayImportStep(3);
    closeHolidayImportModal(true);
    const skipped = Math.max(0, holidays.length - weekdayHolidays.length);
    alert(`${importedCount} Feiertag(e) wurden aus ${canton} für ${year} importiert.${skipped ? ` ${skipped} Wochenend-Feiertag(e) wurden übersprungen.` : ''}`);
  } catch (error) {
    console.error(error);
    const errorMessage = await getFunctionInvokeErrorMessage(error);
    alert(`Feiertage konnten nicht importiert werden: ${errorMessage}`);
  } finally {
    resetHolidayImportProgress();
    state.isSavingSettings = false;
    render();
  }
}

function openSchoolVacationImportModal() {
  if (!elements.schoolVacationImportModal) return;
  if (elements.schoolVacationImportForm) elements.schoolVacationImportForm.reset();
  resetSchoolVacationImportProgress();
  elements.schoolVacationImportModal.classList.remove('hidden');
  renderSchoolVacationImportProgress();
}

function closeSchoolVacationImportModal(force = false) {
  if (!elements.schoolVacationImportModal) return;
  if (state.isSchoolVacationImportRunning && !force) return;
  elements.schoolVacationImportModal.classList.add('hidden');
  resetSchoolVacationImportProgress();
}

function resetSchoolVacationImportProgress() {
  state.isSchoolVacationImportRunning = false;
  state.schoolVacationImportStepIndex = -1;
}

function setSchoolVacationImportStep(stepIndex) {
  state.schoolVacationImportStepIndex = stepIndex;
  renderSchoolVacationImportProgress();
}

function renderSchoolVacationImportProgress() {
  if (!elements.schoolVacationImportProgress || !elements.schoolVacationImportProgressList || !elements.schoolVacationImportProgressLabel) return;
  const isVisible = state.isSchoolVacationImportRunning;
  if (elements.schoolVacationImportCantonInput) elements.schoolVacationImportCantonInput.disabled = isVisible;
  if (elements.schoolVacationImportSchoolYearInput) elements.schoolVacationImportSchoolYearInput.disabled = isVisible;
  if (elements.cancelSchoolVacationImportButton) elements.cancelSchoolVacationImportButton.disabled = isVisible;
  if (elements.closeSchoolVacationImportModalButton) elements.closeSchoolVacationImportModalButton.disabled = isVisible;
  if (elements.confirmSchoolVacationImportButton) {
    elements.confirmSchoolVacationImportButton.disabled = isVisible;
    elements.confirmSchoolVacationImportButton.textContent = isVisible ? 'Wird hinzugefügt …' : 'Hinzufügen';
  }
  elements.schoolVacationImportProgress.classList.toggle('hidden', !isVisible);
  if (!isVisible) {
    elements.schoolVacationImportProgressList.innerHTML = '';
    return;
  }

  const currentIndex = state.schoolVacationImportStepIndex;
  elements.schoolVacationImportProgressLabel.textContent = currentIndex >= 0
    ? `Aktuell: ${SCHOOL_VACATION_IMPORT_STEPS[currentIndex]}`
    : 'Import wird vorbereitet …';
  elements.schoolVacationImportProgressList.innerHTML = SCHOOL_VACATION_IMPORT_STEPS.map((step, index) => {
    const isDone = index < currentIndex;
    const isActive = index === currentIndex;
    const classNames = ['import-progress-step'];
    if (isDone) classNames.push('done');
    if (isActive) classNames.push('active');
    return `<li class="${classNames.join(' ')}">${escapeHtml(step)}</li>`;
  }).join('');
}


async function getFunctionInvokeErrorMessage(error) {
  const fallbackMessage = String(error?.message || 'Unbekannter Fehler');
  const context = error?.context;
  if (!context) return fallbackMessage;

  try {
    if (typeof context.json === 'function') {
      const payload = await context.json();
      if (payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim();
      }
      if (payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
    }
  } catch (parseJsonError) {
    console.warn('Konnte Edge-Function-Fehlerantwort nicht als JSON lesen.', parseJsonError);
  }

  try {
    if (typeof context.text === 'function') {
      const text = String(await context.text() || '').trim();
      if (text) return text;
    }
  } catch (parseTextError) {
    console.warn('Konnte Edge-Function-Fehlerantwort nicht als Text lesen.', parseTextError);
  }

  return fallbackMessage;
}

async function handleSchoolVacationImportFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings || state.isDemoMode || !state.supabase) return;

  const canton = String(elements.schoolVacationImportCantonInput?.value || '').trim().toUpperCase();
  const schoolYear = String(elements.schoolVacationImportSchoolYearInput?.value || '').trim();
  if (!SCHOOL_VACATION_IMPORT_CANTONS.has(canton)) {
    alert('Bitte einen gültigen Kanton auswählen.');
    return;
  }
  if (!SCHOOL_VACATION_IMPORT_YEARS.has(schoolYear)) {
    alert('Bitte ein gültiges Schuljahr auswählen.');
    return;
  }

  state.isSavingSettings = true;
  state.isSchoolVacationImportRunning = true;
  setSchoolVacationImportStep(0);
  try {
    const invokeOptions = {
      body: { canton, schoolYear },
    };
    if (state.supabaseAnonKey) {
      invokeOptions.headers = {
        Authorization: `Bearer ${state.supabaseAnonKey}`,
        apikey: state.supabaseAnonKey,
      };
    }
    const { data, error } = await state.supabase.functions.invoke('import-school-vacations', invokeOptions);
    if (error) throw error;
    const importedCount = Number(data?.importedCount || 0);
    setSchoolVacationImportStep(1);
    await loadData();
    setSchoolVacationImportStep(2);
    await synchronizeAllApprenticeSchoolReportsForYears(getSchoolReportSyncYears());
    setSchoolVacationImportStep(3);
    await loadData();
    closeSchoolVacationImportModal(true);
    alert(`${importedCount} Ferienzeit(en) wurden aus ${canton} für ${schoolYear} importiert.`);
  } catch (error) {
    console.error(error);
    const errorMessage = await getFunctionInvokeErrorMessage(error);
    alert(`Ferienzeiten konnten nicht importiert werden: ${errorMessage}`);
  } finally {
    resetSchoolVacationImportProgress();
    state.isSavingSettings = false;
    render();
  }
}


function renderHistoryActionsCell(entry) {
  return `
    <div class="table-row-actions">
      <button class="button button-small button-secondary button-icon-only" type="button" data-action="download-history-confirmation" data-history-entry-id="${escapeAttribute(entry.id)}" title="PDF exportieren" aria-label="PDF exportieren">${renderIconButtonContent('file-down', 'PDF exportieren')}</button>
      <button class="button button-small button-danger button-icon-only" type="button" data-action="delete-history-entry" data-history-entry-id="${escapeAttribute(entry.id)}" title="Eintrag löschen" aria-label="Eintrag löschen" ${state.isSavingConfirmation ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Eintrag löschen')}</button>
    </div>
  `;
}


function renderSettingsUsersTable() {
  if (!elements.settingsUsersTableBody) return;
  if (!state.profiles.length) {
    elements.settingsUsersTableBody.innerHTML = '<tr><td colspan="10">Keine Benutzer gefunden.</td></tr>';
    return;
  }

  const sortedProfiles = [...state.profiles].sort((left, right) => `${left.full_name || ''}`.localeCompare(`${right.full_name || ''}`, 'de'));
  elements.settingsUsersTableBody.innerHTML = sortedProfiles.map((profile) => {
    const isActive = profile.is_active !== false;
    const isOwnProfile = String(profile.id) === String(state.currentProfile?.id);
    const normalizedRoleLabel = normalizeRoleLabelForSettings(profile.role_label);
    const isApprentice = normalizedRoleLabel === 'Lehrling';
    const roleOptions = APP_ROLE_OPTIONS.includes(normalizedRoleLabel)
      ? APP_ROLE_OPTIONS
      : [...APP_ROLE_OPTIONS, normalizedRoleLabel || 'Benutzer'];
    return `<tr>
      <td>${escapeHtml(profile.full_name || '–')}</td>
      <td>${escapeHtml(profile.email || '–')}</td>
      <td>
        <select data-role-label-input="${escapeAttribute(profile.id)}" ${state.isSavingSettings ? 'disabled' : ''}>
          ${roleOptions.map((role) => `<option value="${escapeAttribute(role)}" ${normalizedRoleLabel === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('')}
        </select>
      </td>
      <td>
        <select data-school-day-input="${escapeAttribute(profile.id)}" ${state.isSavingSettings || !isApprentice ? 'disabled' : ''}>
          <option value="">–</option>
          ${SCHOOL_DAY_OPTIONS.map((option) => {
            const selected = Number(profile.school_day_1) === option.value;
            return `<option value="${option.value}" ${selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
          }).join('')}
        </select>
      </td>
      <td>
        <div class="stacked-cell">
          <button class="button button-small button-secondary button-icon-only" type="button" data-action="edit-block-days" data-block-days-input="${escapeAttribute(profile.id)}" data-profile-id="${escapeAttribute(profile.id)}" title="Blocktage bearbeiten" aria-label="Blocktage bearbeiten" ${state.isSavingSettings ? 'disabled' : ''}>${renderIconButtonContent('calendar-off', 'Blocktage bearbeiten')}</button>
          <small class="subtle-text">${escapeHtml(getBlockScheduleSummary(profile))}</small>
        </div>
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="0.01"
          value="${escapeAttribute(Number(profile.target_revenue || 0).toFixed(2))}"
          data-target-revenue-input="${escapeAttribute(profile.id)}"
          ${state.isSavingSettings ? 'disabled' : ''}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="0.01"
          value="${escapeAttribute(Number(profile.weekly_hours ?? 40).toFixed(2))}"
          data-weekly-hours-input="${escapeAttribute(profile.id)}"
          ${state.isSavingSettings ? 'disabled' : ''}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="0.01"
          value="${escapeAttribute(Number(profile.vacation_allowance_hours || 0).toFixed(2))}"
          data-vacation-allowance-hours-input="${escapeAttribute(profile.id)}"
          ${state.isSavingSettings ? 'disabled' : ''}
        />
      </td>
      <td><span class="pill ${isActive ? 'success' : 'warning'}">${isActive ? 'Aktiv' : 'Deaktiviert'}</span></td>
      <td>
        <div class="table-row-actions">
          ${isActive ? `<button class="button button-small button-primary button-icon-only" type="button" data-action="save-user-settings" data-profile-id="${escapeAttribute(profile.id)}" title="Benutzer speichern" aria-label="Benutzer speichern" ${state.isSavingSettings ? 'disabled' : ''}>${renderIconButtonContent('save', 'Benutzer speichern')}</button>` : `<button class="button button-small button-danger button-icon-only" type="button" data-action="purge-user-account" data-profile-id="${escapeAttribute(profile.id)}" title="Benutzer restlos löschen" aria-label="Benutzer restlos löschen" ${state.isSavingSettings || isOwnProfile ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Benutzer restlos löschen')}</button>`}
          <button class="button button-small ${isActive ? 'button-danger' : 'button-secondary'} button-icon-only" type="button" data-action="toggle-user-active" data-profile-id="${escapeAttribute(profile.id)}" title="${isActive ? 'Benutzer deaktivieren' : 'Benutzer aktivieren'}" aria-label="${isActive ? 'Benutzer deaktivieren' : 'Benutzer aktivieren'}" ${state.isSavingSettings || isOwnProfile ? 'disabled' : ''}>
            ${renderIconButtonContent(isActive ? 'user-x' : 'user-check', isActive ? 'Benutzer deaktivieren' : 'Benutzer aktivieren')}
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
  renderLucideIcons();
}

function renderSettingsManagementButtons() {
  const vacationsButton = elements.openSettingsSchoolVacationsPageButton;
  if (vacationsButton) {
    const hasEntries = state.schoolVacations.length > 0;
    const label = hasEntries ? 'Ferienzeit verwalten' : 'Fehlende Ferienzeit';
    vacationsButton.innerHTML = `${getIconMarkup('calendar-range')}<span>${escapeHtml(label)}</span>`;
    vacationsButton.setAttribute('aria-label', label);
    vacationsButton.setAttribute('title', label);
    vacationsButton.classList.toggle('is-complete', hasEntries);
    vacationsButton.classList.toggle('is-missing', !hasEntries);
  }

  const holidaysButton = elements.openSettingsHolidaysPageButton;
  if (holidaysButton) {
    const hasEntries = state.platformHolidays.length > 0;
    const label = hasEntries ? 'Feiertage verwalten' : 'Fehlende Feiertage';
    holidaysButton.innerHTML = `${getIconMarkup('party-popper')}<span>${escapeHtml(label)}</span>`;
    holidaysButton.setAttribute('aria-label', label);
    holidaysButton.setAttribute('title', label);
    holidaysButton.classList.toggle('is-complete', hasEntries);
    holidaysButton.classList.toggle('is-missing', !hasEntries);
  }
  renderLucideIcons();
}

function renderSettingsHolidaysTable() {
  if (!elements.settingsHolidaysTableBody) return;
  const rows = [...state.platformHolidays].sort((a, b) => `${a.holiday_date || ''}`.localeCompare(`${b.holiday_date || ''}`));
  if (!rows.length) {
    elements.settingsHolidaysTableBody.innerHTML = '<tr><td colspan="4">Noch keine Feiertage erfasst.</td></tr>';
    return;
  }

  elements.settingsHolidaysTableBody.innerHTML = rows.map((entry) => {
    const isEditing = String(state.editingHolidayId) === String(entry.id);
    return `
      <tr>
        <td>${escapeHtml(formatDate(entry.holiday_date))}</td>
        <td>${escapeHtml(entry.label || 'Feiertag')}</td>
        <td>
          ${isEditing ? `
            <select data-holiday-paid-select="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>
              <option value="true" ${entry.is_paid === false ? '' : 'selected'}>Bezahlt</option>
              <option value="false" ${entry.is_paid === false ? 'selected' : ''}>Unbezahlt</option>
            </select>
          ` : (entry.is_paid === false ? 'Unbezahlt' : 'Bezahlt')}
        </td>
        <td>
          <div class="table-row-actions">
            ${isEditing ? `
              <button class="button button-small button-primary button-icon-only" type="button" data-action="save-edit-holiday" data-holiday-id="${escapeAttribute(entry.id)}" title="Feiertag speichern" aria-label="Feiertag speichern" ${state.isSavingSettings ? 'disabled' : ''}>${renderIconButtonContent('save', 'Feiertag speichern')}</button>
              <button class="button button-small button-secondary button-icon-only" type="button" data-action="cancel-edit-holiday" data-holiday-id="${escapeAttribute(entry.id)}" title="Bearbeitung abbrechen" aria-label="Bearbeitung abbrechen" ${state.isSavingSettings ? 'disabled' : ''}>${renderIconButtonContent('x', 'Bearbeitung abbrechen')}</button>
            ` : `
              <button class="button button-small button-secondary button-icon-only" type="button" data-action="start-edit-holiday" data-holiday-id="${escapeAttribute(entry.id)}" title="Feiertag bearbeiten" aria-label="Feiertag bearbeiten" ${state.isSavingSettings ? 'disabled' : ''}>${renderIconButtonContent('pencil', 'Feiertag bearbeiten')}</button>
              <button class="button button-small button-danger button-icon-only" type="button" data-action="delete-holiday" data-holiday-id="${escapeAttribute(entry.id)}" title="Feiertag entfernen" aria-label="Feiertag entfernen" ${state.isSavingSettings ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Feiertag entfernen')}</button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  renderLucideIcons();
}

function renderSettingsSchoolVacationsTable() {
  if (!elements.settingsSchoolVacationsTableBody) return;
  const rows = [...state.schoolVacations].sort((a, b) => `${a.start_date || ''}`.localeCompare(`${b.start_date || ''}`));
  if (!rows.length) {
    elements.settingsSchoolVacationsTableBody.innerHTML = '<tr><td colspan="3">Noch keine Ferienzeiten erfasst.</td></tr>';
    return;
  }
  elements.settingsSchoolVacationsTableBody.innerHTML = rows.map((entry) => `
    <tr>
      <td>${escapeHtml(formatDate(entry.start_date))}</td>
      <td>${escapeHtml(formatDate(entry.end_date))}</td>
      <td>
        <button class="button button-small button-danger button-icon-only" type="button" data-action="delete-school-vacation" data-school-vacation-id="${escapeAttribute(entry.id)}" title="Ferienzeit entfernen" aria-label="Ferienzeit entfernen" ${state.isSavingSettings ? 'disabled' : ''}>
          ${renderIconButtonContent('trash-2', 'Ferienzeit entfernen')}
        </button>
      </td>
    </tr>
  `).join('');
  renderLucideIcons();
}

async function handleDeleteHistoryEntry(historyEntryId) {
  if (!historyEntryId || state.isSavingConfirmation) {
    return;
  }

  const entry = state.requestHistory.find((item) => String(item.id) === String(historyEntryId));
  if (!entry) {
    alert('Der ausgewählte Bestätigungseintrag wurde nicht gefunden.');
    return;
  }

  const shouldDelete = window.confirm('Soll dieser Bestätigungseintrag wirklich gelöscht werden?');
  if (!shouldDelete) {
    return;
  }

  state.isSavingConfirmation = true;
  try {
    if (state.isDemoMode) {
      const index = demoRequestHistory.findIndex((item) => String(item.id) === String(historyEntryId));
      if (index === -1) {
        throw new Error('Demo-Bestätigung nicht gefunden');
      }
      demoRequestHistory.splice(index, 1);
    } else {
      const { error } = await state.supabase.from('request_history').delete().eq('id', historyEntryId);
      if (error) {
        throw error;
      }
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Bestätigungseintrag konnte nicht gelöscht werden: ${error.message}`);
  } finally {
    state.isSavingConfirmation = false;
    render();
  }
}

function isHolidayRequestFullyApproved(request) {
  return getHolidayRequestApprovalStatus(request) === 2;
}

function getHolidayRequestApprovalStatus(request) {
  const explicitStatus = Number(request?.approval_status);
  if (explicitStatus === 0 || explicitStatus === 1 || explicitStatus === 2) {
    return explicitStatus;
  }
  const hasRejectionMarker = String(request?.controll_pl || '').trim() === 'Abgelehnt'
    || String(request?.controll_gl || '').trim() === 'Abgelehnt';
  if (hasRejectionMarker) return 0;
  const isApproved = Boolean(String(request?.controll_pl || '').trim() && String(request?.controll_gl || '').trim());
  return isApproved ? 2 : 1;
}

function getHolidayRequestsByApprovalStatus(status) {
  return [...state.holidayRequests]
    .filter((request) => getHolidayRequestApprovalStatus(request) === status)
    .sort((a, b) => `${b.start_date}`.localeCompare(`${a.start_date}`));
}

function buildApprovalByLabel(request) {
  const names = [String(request?.controll_pl || '').trim(), String(request?.controll_gl || '').trim()].filter(Boolean);
  return names.length ? names.join(' / ') : '–';
}
