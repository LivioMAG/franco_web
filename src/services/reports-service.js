async function refreshData() {
  await loadData();
}

function clearLoadRecoveryTimer() {
  if (state.loadRecoveryTimer) {
    window.clearTimeout(state.loadRecoveryTimer);
    state.loadRecoveryTimer = null;
  }
}

function clearLoadingState() {
  state.loadRequestId += 1;
  state.isLoadingData = false;
  state.loadStartedAt = 0;
  clearLoadRecoveryTimer();
}

function recoverInteractionState({ forceReload = false } = {}) {
  if (!state.isLoadingData) {
    return;
  }

  const loadingDuration = state.loadStartedAt ? Date.now() - state.loadStartedAt : 0;
  if (!forceReload && loadingDuration < STALE_LOADING_TIMEOUT_MS) {
    return;
  }

  clearLoadingState();
  render();

  if (state.user) {
    loadData().catch((error) => {
      console.error(error);
    });
  }
}

function triggerResumeRefresh() {
  if (!state.user || state.isLoadingData) {
    return;
  }

  const now = Date.now();
  if (now - state.lastResumeRefreshAt < RESUME_REFRESH_COOLDOWN_MS) {
    return;
  }

  state.lastResumeRefreshAt = now;
  loadData().catch((error) => {
    console.error(error);
  });
}

function handleWindowFocus() {
  const tabWasHidden = state.tabHiddenAt > 0;
  state.tabHiddenAt = 0;
  recoverInteractionState({ forceReload: tabWasHidden });
  if (tabWasHidden) {
    triggerResumeRefresh();
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    state.tabHiddenAt = Date.now();
    return;
  }

  if (document.visibilityState === 'visible') {
    recoverInteractionState({ forceReload: true });
    triggerResumeRefresh();
  }
}

function beginDataLoad() {
  clearLoadRecoveryTimer();
  state.isLoadingData = true;
  state.loadStartedAt = Date.now();
  const requestId = ++state.loadRequestId;
  state.loadRecoveryTimer = window.setTimeout(() => {
    if (!isActiveDataLoad(requestId) || !state.isLoadingData) {
      return;
    }

    recoverInteractionState({ forceReload: true });
  }, LOAD_WATCHDOG_TIMEOUT_MS);
  render();
  return requestId;
}

function isActiveDataLoad(requestId) {
  return requestId === state.loadRequestId;
}

function finishDataLoad(requestId) {
  if (!isActiveDataLoad(requestId)) {
    return false;
  }

  state.isLoadingData = false;
  state.loadStartedAt = 0;
  clearLoadRecoveryTimer();
  return true;
}

function resetAppState() {
  state.session = null;
  state.user = null;
  state.currentProfile = null;
  state.profiles = [];
  state.weeklyReports = [];
  state.futureVacationReports = [];
  state.projects = [];
  state.roleAssignments = [];
  state.dailyAssignments = [];
  state.holidayRequests = [];
  state.requestHistory = [];
  state.platformHolidays = [];
  state.schoolVacations = [];
  state.projectSearchQuery = '';
  state.editingProjectId = null;
  state.showControlledReports = false;
  state.isAbsenceControlModalOpen = false;
  state.isHolidayControlModalOpen = false;
  state.absenceFilterQuery = '';
  state.selectedAbsenceEmployeeIds = [];
  state.absenceSelectionInitialized = false;
  state.absenceSelectionTouched = false;
  state.showControlledAbsences = false;
  state.includeConfirmationHistory = false;
  state.showPastAbsences = false;
  state.reportsPage = 1;
  state.selectedProjectId = null;
  state.dispoExpandedCells = [];
  state.isAbsenceInfoModalOpen = false;
  state.absenceInfoRequestId = null;
  state.isAbsenceInfoLoading = false;
  state.absenceInfoError = '';
  state.absenceInfoSummary = null;
  state.editingReportId = null;
  state.isSavingReport = false;
  state.isSavingProject = false;
  state.isSavingDispo = false;
  state.isSavingSettings = false;
  state.isSchoolVacationImportRunning = false;
  state.schoolVacationImportStepIndex = -1;
  state.isHolidayImportRunning = false;
  state.holidayImportStepIndex = -1;
  state.hasAdminAccess = false;
  state.isAdminStatusResolved = false;
  state.isLoadingData = false;
  state.loadRequestId = 0;
  state.loadStartedAt = 0;
  state.tabHiddenAt = 0;
  state.lastResumeRefreshAt = 0;
  state.pendingDataReload = false;
  clearLoadRecoveryTimer();
  closeReportEditModal();
  closeAdjustedMinutesModal();
  state.dataTimestampText = 'Noch keine Daten geladen';
}

async function loadData() {
  if (!state.user) {
    render();
    return;
  }

  if (state.isLoadingData) {
    state.pendingDataReload = true;
    return;
  }

  state.pendingDataReload = false;

  const shouldResolveAdminStatus = !state.currentProfile || state.currentProfile.id !== state.user.id;
  if (shouldResolveAdminStatus) {
    state.isAdminStatusResolved = false;
  }

  const requestId = beginDataLoad();

  if (state.isDemoMode) {
    await loadDemoData();
    if (!finishDataLoad(requestId)) {
      return;
    }
    render();
    return;
  }

  try {
    const currentProfile = await fetchCurrentProfile();
    if (!isActiveDataLoad(requestId)) {
      return;
    }
    state.currentProfile = currentProfile ?? buildFallbackProfileFromUser(state.user);
    state.hasAdminAccess = isAdminProfile(state.currentProfile);
    state.isAdminStatusResolved = true;

    if (!state.hasAdminAccess) {
      state.profiles = [];
      state.weeklyReports = [];
      state.futureVacationReports = [];
      state.projects = [];
      state.roleAssignments = [];
      state.dailyAssignments = [];
      state.holidayRequests = [];
      state.platformHolidays = [];
      state.schoolVacations = [];
      state.dataTimestampText = 'Kein Zugriff – is_admin ist für dieses Profil nicht aktiviert';
      finishDataLoad(requestId);
      render();
      if (state.pendingDataReload) {
        state.pendingDataReload = false;
        loadData().catch((error) => {
          console.error(error);
        });
      }
      return;
    }

    const { year: selectedYear, kw: selectedKw } = getYearAndWeekFromWeekValue(state.selectedWeek);
    const selectedWeekRange = getWeekRange(state.selectedWeek);
    const reportsQuery = state.supabase
      .from('weekly_reports')
      .select('*')
      .eq('year', selectedYear)
      .eq('kw', selectedKw)
      .order('work_date', { ascending: true })
      .order('start_time', { ascending: true });
    const futureVacationReportsQuery = state.supabase
      .from('weekly_reports')
      .select('profile_id, work_date, total_work_minutes, total_adjusted_work_minutes, start_time, end_time, lunch_break_minutes, additional_break_minutes, abz_typ')
      .eq('abz_typ', 1)
      .gte('work_date', getTodayIsoDate())
      .order('work_date', { ascending: true });

    const profilesQuery = fetchProfiles();
    const absencesQuery = fetchHolidayRequests();
    const projectsQuery = state.supabase
      .from('projects')
      .select('*')
      .order('commission_number', { ascending: true });
    const dailyAssignmentsQuery = state.supabase
      .from('daily_assignments')
      .select('*')
      .gte('assignment_date', selectedWeekRange.start)
      .lte('assignment_date', selectedWeekRange.end)
      .order('assignment_date', { ascending: true });
    const platformHolidaysQuery = state.supabase
      .from(HOLIDAY_TABLE)
      .select('*')
      .order('holiday_date', { ascending: true });
    const schoolVacationsQuery = state.supabase
      .from('school_vacations')
      .select('*')
      .order('start_date', { ascending: true });
    const [
      { data: reports, error: reportsError },
      { data: profiles, error: profilesError },
      { data: futureVacationReports, error: futureVacationReportsError },
      { data: absences, error: absencesError },
      { data: projects, error: projectsError },
      { data: dailyAssignments, error: dailyAssignmentsError },
      { data: platformHolidays, error: platformHolidaysError },
      { data: schoolVacations, error: schoolVacationsError },
    ] = await Promise.all([
      reportsQuery,
      profilesQuery,
      futureVacationReportsQuery,
      absencesQuery,
      projectsQuery,
      dailyAssignmentsQuery,
      platformHolidaysQuery,
      schoolVacationsQuery,
    ]);

    if (reportsError) throw reportsError;
    if (profilesError) throw profilesError;
    if (futureVacationReportsError) throw futureVacationReportsError;
    if (absencesError) throw absencesError;
    if (projectsError) throw projectsError;
    if (dailyAssignmentsError && !isMissingTableError(dailyAssignmentsError, 'daily_assignments')) throw dailyAssignmentsError;
    if (platformHolidaysError && !isMissingTableError(platformHolidaysError, HOLIDAY_TABLE)) throw platformHolidaysError;
    if (schoolVacationsError && !isMissingTableError(schoolVacationsError, 'school_vacations')) throw schoolVacationsError;
    if (!isActiveDataLoad(requestId)) {
      return;
    }

    state.weeklyReports = reports ?? [];
    state.futureVacationReports = futureVacationReports ?? [];
    state.profiles = profiles ?? [];
    state.holidayRequests = absences ?? [];
    state.projects = projects ?? [];
    state.dailyAssignments = dailyAssignments ?? [];
    state.platformHolidays = platformHolidays ?? [];
    state.schoolVacations = schoolVacations ?? [];
    state.roleAssignments = [];
    syncEmployeeSelection();
    syncAbsenceSelection();
    state.dataTimestampText = `Letzte Aktualisierung: ${new Date().toLocaleString('de-CH')}`;
    finishDataLoad(requestId);
    render();
    if (state.pendingDataReload) {
      state.pendingDataReload = false;
      loadData().catch((error) => {
        console.error(error);
      });
    }
  } catch (error) {
    if (!finishDataLoad(requestId)) {
      return;
    }
    console.error(error);
    const hint = getAccessConfigurationHint(error);
    state.dataTimestampText = hint || 'Daten konnten nicht geladen werden';
    render();
    alert(`Daten konnten nicht geladen werden: ${error.message}${hint ? `\n\nHinweis: ${hint}` : ''}`);
    if (state.pendingDataReload) {
      state.pendingDataReload = false;
      loadData().catch((nextError) => {
        console.error(nextError);
      });
    }
  }
}

async function fetchCurrentProfile() {
  const { data, error } = await state.supabase
    .from('app_profiles')
    .select('*')
    .eq('id', state.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function fetchProfiles() {
  const primary = await state.supabase.from('profiles').select('*').order('full_name', { ascending: true });
  if (!primary.error) {
    return primary;
  }
  return state.supabase.from('app_profiles').select('*').order('full_name', { ascending: true });
}

async function fetchHolidayRequests() {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await state.supabase
      .from('holiday_requests')
      .select('*')
      .order('start_date', { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error };
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      return { data: rows, error: null };
    }
  }
}

async function loadDemoData() {
  state.currentProfile = demoProfiles.find((profile) => profile.id === state.user.id) ?? demoProfiles[0];
  state.isAdminStatusResolved = true;

  if (!state.hasAdminAccess) {
    state.profiles = [];
    state.weeklyReports = [];
    state.futureVacationReports = [];
    state.projects = [];
    state.roleAssignments = [];
    state.dailyAssignments = [];
    state.holidayRequests = [];
    state.requestHistory = [];
    state.platformHolidays = [];
    state.schoolVacations = [];
    state.dataTimestampText = 'Kein Zugriff – Demo-Profil hat is_admin = false';
    return;
  }

  state.profiles = demoProfiles;

  const { year: selectedYear, kw: selectedKw } = getYearAndWeekFromWeekValue(state.selectedWeek);
  const reports = demoWeeklyReports.filter((report) => {
    const reportYear = Number(report.year);
    const reportKw = Number(report.kw);
    if (Number.isInteger(reportYear) && Number.isInteger(reportKw)) {
      return reportYear === selectedYear && reportKw === selectedKw;
    }
    const isoWeek = getIsoYearAndWeekFromDateString(report.work_date);
    return isoWeek.year === selectedYear && isoWeek.kw === selectedKw;
  });
  state.weeklyReports = reports;
  state.futureVacationReports = demoWeeklyReports.filter((report) =>
    Number(getAbsenceTypeCode(report)) === 1
    && String(report.work_date || '') >= getTodayIsoDate()
  );
  state.projects = [];
  state.roleAssignments = [];
  state.dailyAssignments = [];
  state.holidayRequests = [...demoHolidayRequests];
  state.requestHistory = [];
  state.platformHolidays = [...demoPlatformHolidays];
  state.schoolVacations = [];
  syncEmployeeSelection();
  syncAbsenceSelection();
  state.dataTimestampText = `Demo-Daten geladen: ${new Date().toLocaleString('de-CH')}`;
}
