function getIncompleteSubmissionProfiles({ selectedOnly = false } = {}) {
  const groups = groupReportsByProfile(state.weeklyReports);
  return getReportableProfiles().flatMap((profile) => {
    if (selectedOnly && state.reportColumnFilter.type === 'employee' && !state.reportColumnFilter.values.includes(profile.id)) {
      return [];
    }

    const reports = groups.get(profile.id) ?? [];
    const totalMinutes = reports.reduce((sum, report) => sum + getAdjustedWorkMinutes(report), 0);
    const weeklyHours = Number(profile.weekly_hours || 40);
    const minimumMinutes = weeklyHours * 60 * 0.8;

    if (!reports.length) {
      return [{
        profile,
        totalMinutes: 0,
        status: 'missing',
        statusLabel: 'Fehlt',
        description: 'Für diese Woche wurde noch kein Rapport eingereicht.',
      }];
    }

    if (totalMinutes < minimumMinutes) {
      return [{
        profile,
        totalMinutes,
        status: 'incomplete',
        statusLabel: 'Unvollständig',
        description: `Rapportierte Zeit liegt unter 80% der Sollzeit (${(minimumMinutes / 60).toFixed(2)} h).`,
      }];
    }

    return [];
  });
}

function getAvailableReportProfileIds() {
  const profileIds = getReportableProfiles().map((profile) => profile.id);
  if (profileIds.length) {
    return profileIds;
  }

  return [...new Set(state.weeklyReports.map((report) => report.profile_id).filter(Boolean))];
}

function getAvailableAbsenceProfileIds() {
  const profileIds = getAbsenceFilterProfiles().map((profile) => profile.id);
  if (profileIds.length) {
    return profileIds;
  }

  return [...new Set(state.holidayRequests.map((request) => request.profile_id).filter(Boolean))];
}

function getReportableProfiles() {
  return getActiveProfiles();
}

function getAbsenceFilterProfiles() {
  return getReportableProfiles();
}

function getActiveProfiles() {
  return state.profiles.filter((profile) => profile.is_active !== false);
}

function getMatchingProfiles(profiles, query) {
  const normalizedQuery = `${query || ''}`.trim().toLowerCase();
  return profiles.filter((profile) => `${profile.full_name}`.toLowerCase().includes(normalizedQuery));
}

function getFilteredHolidayRequests() {
  return [...state.holidayRequests]
    .filter((request) => getHolidayRequestApprovalStatus(request) === 1)
    .sort((a, b) => `${b.start_date}`.localeCompare(`${a.start_date}`));
}

function groupReportsByProfile(reports) {
  const groups = new Map();
  reports.forEach((report) => {
    if (!groups.has(report.profile_id)) {
      groups.set(report.profile_id, []);
    }
    groups.get(report.profile_id).push(report);
  });
  return groups;
}

function buildAdjustedMinutesUpdatePayload(report, adjustedMinutes) {
  return { total_adjusted_work_minutes: adjustedMinutes };
}

function getAdjustedWorkMinutes(report) {
  const baseAdjustedMinutes = getBaseAdjustedWorkMinutes(report);
  if (shouldApplyHolidayDoubleMinutes(report)) {
    return baseAdjustedMinutes * 2;
  }
  return baseAdjustedMinutes;
}

function getBaseAdjustedWorkMinutes(report) {
  const totalAdjustedMinutes = Number(report?.total_adjusted_work_minutes);
  const totalWorkMinutes = Number(report?.total_work_minutes);

  const normalizedAdjustedMinutes = Number.isFinite(totalAdjustedMinutes) && totalAdjustedMinutes >= 0
    ? totalAdjustedMinutes
    : 0;

  if (normalizedAdjustedMinutes > 0) {
    return normalizedAdjustedMinutes;
  }

  if (Number.isFinite(totalWorkMinutes) && totalWorkMinutes > 0) {
    return totalWorkMinutes;
  }

  return normalizedAdjustedMinutes;
}

function shouldApplyHolidayDoubleMinutes(report) {
  if (!report || isHolidayMinutesReport(report)) {
    return false;
  }
  return state.weeklyReports.some((entry) =>
    String(entry?.id) !== String(report.id)
    && String(entry?.profile_id) === String(report.profile_id)
    && String(entry?.work_date) === String(report.work_date)
    && isHolidayMinutesReport(entry));
}

function isHolidayMinutesReport(report) {
  const haystack = [report?.project_name, report?.commission_number, report?.notes, report?.expense_note]
    .map((value) => normalizeSearchValue(value || ''))
    .join(' ');
  return haystack.includes('feiertag');
}

function buildFallbackProfileFromUser(user) {
  if (!user) {
    return null;
  }

  const email = String(user.email || '').trim().toLowerCase();
  return {
    id: user.id,
    email,
    full_name: email || 'Benutzer',
    role_label: 'Benutzer',
    is_admin: false,
    is_active: true,
  };
}

function getAccessConfigurationHint(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) {
    return '';
  }

  if (message.includes('row-level security') || message.includes('permission denied') || message.includes('not allowed')) {
    return 'Bitte das aktualisierte SQL aus supabase/schema.sql im Supabase-Projekt ausführen, damit Profile mit is_admin = true Vollzugriff erhalten.';
  }

  if (message.includes("could not find the table 'public.project_assignments' in the schema cache")) {
    return 'Die Tabelle project_assignments wird in der aktuellen App-Version nicht mehr verwendet. Bitte das aktuelle SQL aus supabase/schema.sql ausführen und veraltete Abfragen auf project_assignments entfernen.';
  }

  return '';
}

function isAdminProfile(profile) {
  return profile?.is_admin === true || profile?.is_admin === 'true' || profile?.is_admin === 1;
}
