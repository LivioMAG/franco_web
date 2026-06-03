function render() {
  const loggedIn = Boolean(state.user);
  const hasAdminAccess = loggedIn && state.hasAdminAccess;
  const isCheckingAdminAccess = loggedIn && !state.isAdminStatusResolved && !state.currentProfile;
  const showAccessDenied = loggedIn && state.isAdminStatusResolved && !state.hasAdminAccess;

  elements.loginView.classList.toggle('hidden', loggedIn || isCheckingAdminAccess);
  elements.appView.classList.toggle('hidden', !hasAdminAccess);
  elements.accessDeniedView.classList.toggle('hidden', !showAccessDenied);

  if (isCheckingAdminAccess) {
    closeReportEditModal();
    closeSpecialReportEditModal();
    closeAdjustedMinutesModal();
    closeAbsenceControlModal({ renderStateOnly: true });
    closeHolidayControlModal({ renderStateOnly: true });
    elements.accessDeniedView.classList.add('hidden');
    elements.loginView.classList.remove('hidden');
    if (elements.loginAlert) {
      showLoginMessage('Admin-Zugriff wird geprüft …', false);
    }
    renderLoadingOverlay();
    renderLucideIcons();
    return;
  }

  if (!hasAdminAccess) {
    closeReportEditModal();
    closeSpecialReportEditModal();
    closeAdjustedMinutesModal();
    closeAbsenceControlModal({ renderStateOnly: true });
    closeHolidayControlModal({ renderStateOnly: true });
    renderLoadingOverlay();
    renderLucideIcons();
    return;
  }

  renderSidebar();
  renderPages();
  renderWeekSummary();
  renderReportStats();
  renderEmployeeFilters();
  renderAbsenceFilters();
  renderReportsTable();
  renderSubmissionLists();
  renderHolidayControlButtonState();
  renderAbsenceControlModalState();
  renderHolidayControlModalState();
  renderMissingReportsCallModalState();
  renderAbsenceTable();
  renderBulkConfirmModalState();
  renderAbsenceInfoModalState();
  renderProjectsTable();
  renderDispoPlanner();
  renderSettingsUsersTable();
  renderSettingsManagementButtons();
  renderSettingsHolidaysTable();
  renderSettingsSchoolVacationsTable();
  renderHolidayImportProgress();
  renderSchoolVacationImportProgress();
  renderLoadingOverlay();
  renderLucideIcons();
}

function renderSidebar() {
  const profile = state.currentProfile;
  if (elements.userName) {
    elements.userName.textContent = profile?.full_name ?? state.user.email;
  }
  if (elements.userRole) {
    elements.userRole.textContent = profile?.role_label ?? 'Benutzer';
  }
  if (elements.userBadge) {
    elements.userBadge.textContent = state.hasAdminAccess ? 'Admin' : 'Kein Zugriff';
  }
}

function renderLoadingOverlay() {
  if (!elements.loadingOverlay || !elements.loadingOverlayText) {
    return;
  }
  elements.loadingOverlay.classList.toggle('hidden', !state.isLoadingOverlayVisible);
  elements.loadingOverlayText.textContent = state.loadingOverlayReason || 'Aktion wird ausgeführt.';
}

function scheduleLoadingOverlay(reason) {
  if (state.loadingOverlayTimer) {
    clearTimeout(state.loadingOverlayTimer);
  }
  state.loadingOverlayTimer = setTimeout(() => {
    state.isLoadingOverlayVisible = true;
    state.loadingOverlayReason = reason || 'Aktion wird ausgeführt.';
    renderLoadingOverlay();
  }, LONG_TASK_OVERLAY_DELAY_MS);
}

function hideLoadingOverlay() {
  if (state.loadingOverlayTimer) {
    clearTimeout(state.loadingOverlayTimer);
    state.loadingOverlayTimer = null;
  }
  state.isLoadingOverlayVisible = false;
  state.loadingOverlayReason = '';
  renderLoadingOverlay();
}

async function withLongTask(reason, task) {
  state.loadingTaskDepth += 1;
  if (state.loadingTaskDepth === 1) {
    scheduleLoadingOverlay(reason);
  }

  try {
    return await task();
  } finally {
    state.loadingTaskDepth = Math.max(0, state.loadingTaskDepth - 1);
    if (state.loadingTaskDepth === 0) {
      hideLoadingOverlay();
    }
  }
}

function renderPages() {
  for (const [key, page] of Object.entries(elements.pages)) {
    if (!page) continue;
    page.classList.toggle('hidden', key !== state.currentPage);
  }

  elements.navTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.page === state.currentPage);
  });
}

function renderWeekSummary() {
  const weekRange = getWeekRange(state.selectedWeek);
  elements.weekPicker.value = state.selectedWeek;
  elements.weekLabel.textContent = getWeekLabel(state.selectedWeek);
  elements.weekDateRange.textContent = `${formatDate(weekRange.start)} – ${formatDate(weekRange.end)}`;
  const disableWeekNavigation = state.isLoadingData || state.isSavingReport;
  elements.previousWeekButton.disabled = disableWeekNavigation;
  elements.nextWeekButton.disabled = disableWeekNavigation;
  if (elements.dispoPreviousWeekButton) elements.dispoPreviousWeekButton.disabled = disableWeekNavigation;
  if (elements.dispoNextWeekButton) elements.dispoNextWeekButton.disabled = disableWeekNavigation;
}

function renderReportStats() {
  const missingProfiles = getIncompleteSubmissionProfiles();
  const hasMissingReports = missingProfiles.length > 0;

  elements.reportStatusButton.classList.toggle('is-missing', hasMissingReports);
  elements.reportStatusButton.classList.toggle('is-complete', !hasMissingReports);
  elements.reportStatusIcon.innerHTML = hasMissingReports ? String(missingProfiles.length) : getIconMarkup('check', 'app-icon report-status-check-icon');
  elements.reportStatusText.textContent = hasMissingReports ? 'fehlende/unvollständige Rapporte' : 'Alle Wochenrapporte vollständig';
}

function renderEmployeeFilters() {
  if (elements.openReportCreateButton) elements.openReportCreateButton.disabled = state.isLoadingData || state.isSavingReport || !getReportableProfiles().length;
  if (elements.showControlledReportsInput) elements.showControlledReportsInput.checked = state.showControlledReports;
  if (elements.reportsSortSelect) elements.reportsSortSelect.value = state.reportsSortMode;
  if (elements.showControlledReportsToggle) {
    elements.showControlledReportsToggle.classList.toggle('is-active', state.showControlledReports);
    elements.showControlledReportsToggle.setAttribute('aria-pressed', state.showControlledReports ? 'true' : 'false');
  }
}

function renderReportsTable() {
  if (state.isLoadingData) {
    elements.reportsTableBody.innerHTML = `<tr><td colspan="9">Rapporte für ${escapeHtml(getWeekLabel(state.selectedWeek))} werden geladen …</td></tr>`;
    renderReportsPagination({ totalItems: 0, totalPages: 1, currentPage: 1, startIndex: 0, endIndex: 0 });
    return;
  }

  const allReports = getSortedFilteredReports();
  const pagination = getReportsPaginationMeta(allReports);

  if (!state.weeklyReports.length) {
    elements.reportsTableBody.innerHTML = `<tr><td colspan="9">Keine Rapporte in dieser Woche gefunden.</td></tr>`;
    renderReportsPagination(pagination);
    return;
  }

  if (!allReports.length) {
    elements.reportsTableBody.innerHTML = `<tr><td colspan="9">Für die aktuelle Auswahl wurden keine Rapporte gefunden.</td></tr>`;
    renderReportsPagination(pagination);
    return;
  }

  elements.reportsTableBody.innerHTML = pagination.pageItems
    .map((report) => {
      const profile = getProfileById(report.profile_id);
      return `
        <tr class="report-row report-row-clickable" data-action="open-report-edit" data-report-id="${escapeAttribute(report.id)}">
          <td>${escapeHtml(profile?.full_name ?? 'Unbekannt')}</td>
          <td>${renderControllCell(report)}</td>
          <td>${formatDateWithWeekday(report.work_date)}</td>
          <td>${escapeHtml(report.commission_number || '–')}</td>
          <td>${escapeHtml(report.project_name || '–')}</td>
          <td>${formatMinutes(report.total_work_minutes)}</td>
          <td>${formatCurrency(Number(report.expenses_amount || 0) + Number(report.other_costs_amount || 0))}</td>
          <td>${renderAttachmentLinks(report.attachments)}</td>
          <td>
            <div class="table-row-actions">
              <button class="button button-small button-danger button-icon-only" type="button" data-action="delete-report" data-report-id="${escapeAttribute(report.id)}" title="Rapport löschen" aria-label="Rapport löschen" ${state.isSavingReport ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Rapport löschen')}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
  renderReportsPagination(pagination);
  renderLucideIcons();
}

function renderSubmissionLists() {
  const summaries = getProfileSubmissionSummary();
  const submittedItems = summaries
    .filter((summary) => summary.hasSubmission)
    .map((summary) => {
      const statusLabel = summary.hasPendingControll ? 'Kontrolle ausstehend' : 'Rapporte erfasst';
      const statusClass = summary.hasPendingControll ? 'warning' : 'success';
      return `
      <li class="align-start">
        <div class="status-stack">
          <strong>${escapeHtml(summary.profile.full_name)}</strong>
          <div class="subtle-text">${summary.entryCount} Rapporteinträge in dieser Woche</div>
        </div>
        <div class="status-meta">
          <span class="pill ${statusClass}">${escapeHtml(statusLabel)}</span>
          <strong>${formatMinutes(summary.totalMinutes)}</strong>
        </div>
      </li>
    `;
    });

  const missingItems = getIncompleteSubmissionProfiles()
    .map(
      (entry) => `
      <li class="align-start">
        <div class="status-stack">
          <strong>
            <button
              class="button button-secondary button-small button-icon"
              type="button"
              data-action="call-missing-profile"
              data-profile-id="${escapeAttribute(entry.profile.id)}"
              title="Nur diese Person telefonisch delegieren"
              aria-label="Nur ${escapeAttribute(entry.profile.full_name || 'diese Person')} telefonisch delegieren"
            >${renderIconButtonContent('phone-forwarded', 'Telefonisch delegieren')}</button>
            ${escapeHtml(entry.profile.full_name)}
          </strong>
          <div class="subtle-text">${escapeHtml(entry.description)}</div>
        </div>
        <div class="status-meta">
          <span class="pill warning">${escapeHtml(entry.statusLabel)}</span>
          <strong>${formatMinutes(entry.totalMinutes)}</strong>
        </div>
      </li>
    `,
    );

  elements.submissionList.innerHTML = submittedItems.join('') || '<li>In dieser Woche wurde noch kein Rapport erfasst.</li>';
  elements.missingList.innerHTML = missingItems.join('') || '<li>Alle Profile haben abgegeben.</li>';
  if (elements.openMissingReportsCallModalButton) {
    elements.openMissingReportsCallModalButton.disabled = !missingItems.length;
  }
}


function handleShowControlledReportsToggle(event) {
  state.showControlledReports = event?.target === elements.showControlledReportsInput
    ? Boolean(elements.showControlledReportsInput?.checked)
    : !state.showControlledReports;
  state.reportsPage = 1;
  renderEmployeeFilters();
  renderReportsTable();
}

function handleReportsSortChange(event) {
  state.reportsSortMode = event.target?.value || 'date_desc';
  state.reportsPage = 1;
  renderReportsTable();
}

function openAbsenceControlModal() {
  state.isAbsenceControlModalOpen = true;
  renderAbsenceControlModalState();
}

function closeAbsenceControlModal({ renderStateOnly = false } = {}) {
  state.isAbsenceControlModalOpen = false;
  if (renderStateOnly) {
    elements.absenceControlModal?.classList.add('hidden');
    return;
  }

  renderAbsenceControlModalState();
}

function openHolidayControlModal() {
  state.isHolidayControlModalOpen = true;
  renderHolidayControlModalState();
}

function closeHolidayControlModal({ renderStateOnly = false } = {}) {
  state.isHolidayControlModalOpen = false;
  if (renderStateOnly) {
    elements.holidayControlModal?.classList.add('hidden');
    return;
  }

  renderHolidayControlModalState();
}

function renderHolidayControlButtonState() {
  if (!elements.holidayControlButton) {
    return;
  }

  const summary = getHolidayControlSummary();
  const hasMissingReports = summary.missingHolidayPeople.length > 0;
  const hasInvalidReports = summary.invalidHolidayReports.length > 0;
  const hasHolidayControlIssues = hasMissingReports || hasInvalidReports;
  const shouldShow = !state.isLoadingData && hasHolidayControlIssues;
  let title = 'Feiertagskontrolle: fehlende Feiertagsrapporte';
  if (hasInvalidReports && hasMissingReports) {
    title = 'Feiertagskontrolle: fehlende und falsch rapportierte Feiertage';
  } else if (hasInvalidReports) {
    title = 'Feiertagskontrolle: rapportierte Feiertage ohne Plattform-Feiertag';
  }

  elements.holidayControlButton.classList.toggle('hidden', !shouldShow);
  elements.holidayControlButton.classList.toggle('is-alert', shouldShow);
  elements.holidayControlButton.setAttribute('title', title);
  elements.holidayControlButton.setAttribute('aria-label', title);

  if (!shouldShow && state.isHolidayControlModalOpen) {
    closeHolidayControlModal({ renderStateOnly: true });
  }
}

function renderHolidayControlModalState() {
  if (!elements.holidayControlModal) {
    return;
  }

  elements.holidayControlModal.classList.toggle('hidden', !state.isHolidayControlModalOpen);
  if (!state.isHolidayControlModalOpen || !elements.holidayControlModalContent) {
    return;
  }

  elements.holidayControlModalContent.innerHTML = renderHolidayControlContent(getHolidayControlSummary());
}

function renderAbsenceControlModalState() {
  if (!elements.absenceControlModal) {
    return;
  }

  elements.absenceControlModal.classList.toggle('hidden', !state.isAbsenceControlModalOpen);
  if (!state.isAbsenceControlModalOpen || !elements.absenceControlModalContent) {
    return;
  }

  const summaries = getAbsenceControlSummaries();
  elements.absenceControlModalContent.innerHTML = renderAbsenceControlContent(summaries);
}

function getHolidayControlSummary() {
  const weekRange = getWeekRange(state.selectedWeek);
  const weekPlatformHolidays = state.platformHolidays
    .filter((entry) => isDateInRange(entry?.holiday_date, weekRange.start, weekRange.end))
    .sort((left, right) => String(left.holiday_date || '').localeCompare(String(right.holiday_date || '')));
  const platformHolidayDates = new Set(weekPlatformHolidays.map((entry) => String(entry.holiday_date || '')));
  const holidayReports = state.weeklyReports
    .filter((report) => HOLIDAY_TYPE_CODES.has(Number(getAbsenceTypeCode(report))))
    .filter((report) => String(report.work_date || ''));
  const invalidHolidayReports = holidayReports.filter((report) => !platformHolidayDates.has(String(report.work_date || '')));
  const hasPlatformHoliday = weekPlatformHolidays.length > 0;

  return {
    weekRange,
    weekPlatformHolidays,
    platformHolidayDates,
    holidayReports,
    invalidHolidayReports,
    reportedHolidayPeople: buildHolidayControlReportedPeople(holidayReports),
    missingHolidayPeople: hasPlatformHoliday ? buildHolidayControlMissingPeople(weekPlatformHolidays, holidayReports) : [],
  };
}

function isDateInRange(dateValue, startDate, endDate) {
  const date = String(dateValue || '');
  return date && date >= String(startDate || '') && date <= String(endDate || '');
}

function buildHolidayControlReportedPeople(reports) {
  const grouped = groupReportsByProfile(reports);
  return [...grouped.entries()]
    .map(([profileId, profileReports]) => {
      const profile = getProfileById(profileId);
      const dates = [...new Set(profileReports.map((report) => String(report.work_date || '')).filter(Boolean))]
        .sort()
        .map((date) => ({
          date,
          minutes: profileReports
            .filter((report) => String(report.work_date || '') === date)
            .reduce((sum, report) => sum + getAbsenceControlReportMinutes(report), 0),
        }));
      return {
        profile,
        profileName: profile?.full_name || 'Unbekannt',
        dates,
        totalMinutes: profileReports.reduce((sum, report) => sum + getAbsenceControlReportMinutes(report), 0),
      };
    })
    .sort((left, right) => left.profileName.localeCompare(right.profileName, 'de'));
}

function buildHolidayControlMissingPeople(platformHolidays, holidayReports) {
  const reportedDatesByProfile = new Map();
  holidayReports.forEach((report) => {
    const profileKey = String(report.profile_id || '');
    if (!profileKey) return;
    if (!reportedDatesByProfile.has(profileKey)) {
      reportedDatesByProfile.set(profileKey, new Set());
    }
    reportedDatesByProfile.get(profileKey).add(String(report.work_date || ''));
  });

  return getReportableProfiles()
    .map((profile) => {
      const reportedDates = reportedDatesByProfile.get(String(profile.id)) || new Set();
      const missingHolidays = platformHolidays.filter((holiday) => !reportedDates.has(String(holiday.holiday_date || '')));
      return {
        profile,
        profileName: profile.full_name || 'Unbekannt',
        missingHolidays,
      };
    })
    .filter((entry) => entry.missingHolidays.length > 0)
    .sort((left, right) => left.profileName.localeCompare(right.profileName, 'de'));
}

function renderHolidayControlContent(summary) {
  if (state.isLoadingData) {
    return `<p class="empty-state">Feiertagskontrolle für ${escapeHtml(getWeekLabel(state.selectedWeek))} wird geladen …</p>`;
  }

  const hasPlatformHoliday = summary.weekPlatformHolidays.length > 0;
  const hasInvalidReports = summary.invalidHolidayReports.length > 0;
  const platformHolidayLabel = summary.weekPlatformHolidays
    .map((holiday) => `${escapeHtml(formatDate(holiday.holiday_date))}${holiday.label ? ` · ${escapeHtml(holiday.label)}` : ''}`)
    .join('<br>');

  if (!hasPlatformHoliday) {
    return renderHolidayControlNoPlatformHolidayContent(summary, hasInvalidReports);
  }

  return `
    <div class="absence-control-summary subtle-text">
      <strong>Plattform-Feiertag(e) in ${escapeHtml(getWeekLabel(state.selectedWeek))}:</strong><br>${platformHolidayLabel}
    </div>
    ${hasInvalidReports ? renderHolidayControlInvalidNotice(summary) : ''}
    <div class="absence-control-list holiday-control-list">
      ${summary.missingHolidayPeople.length
        ? summary.missingHolidayPeople.map(renderHolidayControlMissingPersonCard).join('')
        : '<p class="empty-state">Alle aktiven Mitarbeiter haben den Plattform-Feiertag rapportiert.</p>'}
    </div>
  `;
}

function renderHolidayControlNoPlatformHolidayContent(summary, hasInvalidReports) {
  if (!summary.reportedHolidayPeople.length) {
    return `<p class="empty-state">In ${escapeHtml(getWeekLabel(state.selectedWeek))} gibt es keinen Plattform-Feiertag und keine rapportierten Feiertage.</p>`;
  }

  return `
    <div class="absence-control-summary subtle-text ${hasInvalidReports ? 'holiday-control-alert-summary' : ''}">
      In ${escapeHtml(getWeekLabel(state.selectedWeek))} ist kein Plattform-Feiertag hinterlegt. Aufgelistet sind Personen, die trotzdem einen Feiertag rapportiert haben.
    </div>
    <div class="absence-control-list holiday-control-list">
      ${summary.reportedHolidayPeople.map(renderHolidayControlReportedPersonCard).join('')}
    </div>
  `;
}

function renderHolidayControlInvalidNotice(summary) {
  const invalidPeople = buildHolidayControlReportedPeople(summary.invalidHolidayReports);
  return `
    <div class="absence-control-summary holiday-control-alert-summary">
      <strong>Achtung:</strong> Zusätzlich wurden Feiertage an Tagen rapportiert, die nicht als Plattform-Feiertag hinterlegt sind:
      <div class="holiday-control-inline-list">${invalidPeople.map((entry) => `${escapeHtml(entry.profileName)} (${renderHolidayControlDateList(entry.dates)})`).join(' · ')}</div>
    </div>
  `;
}

function renderHolidayControlMissingPersonCard(entry) {
  const details = entry.missingHolidays
    .map((holiday) => `${escapeHtml(formatDate(holiday.holiday_date))}${holiday.label ? ` · ${escapeHtml(holiday.label)}` : ''}`)
    .join('<br>');
  return `
    <article class="absence-control-card holiday-control-card">
      <div class="absence-control-card-heading">
        <div>
          <strong>${escapeHtml(entry.profileName)}</strong>
          <div class="subtle-text">Feiertag nicht rapportiert</div>
        </div>
        <span class="pill warning">Fehlt</span>
      </div>
      <div class="subtle-text">${details}</div>
    </article>
  `;
}

function renderHolidayControlReportedPersonCard(entry) {
  return `
    <article class="absence-control-card holiday-control-card">
      <div class="absence-control-card-heading">
        <div>
          <strong>${escapeHtml(entry.profileName)}</strong>
          <div class="subtle-text">Rapportierter Feiertag ohne Plattform-Feiertag</div>
        </div>
        <span class="pill warning">Prüfen</span>
      </div>
      <div class="subtle-text">${renderHolidayControlDateList(entry.dates)} · Total ${formatMinutes(entry.totalMinutes)}</div>
    </article>
  `;
}

function renderHolidayControlDateList(dates) {
  return dates
    .map((entry) => `${escapeHtml(formatDate(entry.date))}${entry.minutes ? ` (${formatMinutes(entry.minutes)})` : ''}`)
    .join(', ');
}

function getAbsenceControlSummaries() {
  const reportsByProfile = groupReportsByProfile(state.weeklyReports);

  return [...reportsByProfile.entries()]
    .map(([profileId, reports]) => {
      const profile = getProfileById(profileId);
      const buckets = reports.reduce((totals, report) => {
        const minutes = getAbsenceControlReportMinutes(report);
        if (minutes <= 0) {
          return totals;
        }

        const typeCode = Number(getAbsenceTypeCode(report));
        if (typeCode === 1) {
          totals.vacationMinutes += minutes;
        } else if (typeCode === 2) {
          totals.illnessMinutes += minutes;
        } else if (typeCode === 4) {
          totals.accidentMinutes += minutes;
        } else if (HOLIDAY_TYPE_CODES.has(typeCode)) {
          totals.holidayMinutes += minutes;
        } else if (typeCode > 0) {
          totals.otherAbsenceMinutes += minutes;
          const label = getAbsenceTypeLabel(report, 'Absenz');
          totals.otherAbsenceBreakdown.set(label, (totals.otherAbsenceBreakdown.get(label) || 0) + minutes);
        } else {
          totals.remainingMinutes += minutes;
        }

        totals.totalMinutes += minutes;
        return totals;
      }, {
        illnessMinutes: 0,
        accidentMinutes: 0,
        holidayMinutes: 0,
        vacationMinutes: 0,
        otherAbsenceMinutes: 0,
        remainingMinutes: 0,
        totalMinutes: 0,
        otherAbsenceBreakdown: new Map(),
      });

      const relevantAbsenceMinutes = buckets.illnessMinutes
        + buckets.accidentMinutes
        + buckets.holidayMinutes
        + buckets.vacationMinutes
        + buckets.otherAbsenceMinutes;

      return {
        profile,
        profileName: profile?.full_name || 'Unbekannt',
        ...buckets,
        sicknessAccidentMinutes: buckets.illnessMinutes + buckets.accidentMinutes,
        relevantAbsenceMinutes,
        confirmedAbsenceChecks: getConfirmedAbsenceChecksForSummary(profileId, reports),
      };
    })
    .filter((summary) => summary.sicknessAccidentMinutes > 0)
    .sort((left, right) => left.profileName.localeCompare(right.profileName, 'de'));
}

function getConfirmedAbsenceChecksForSummary(profileId, reports) {
  return [
    buildConfirmedAbsenceCheck(profileId, reports, 2, 'Krankheit'),
    buildConfirmedAbsenceCheck(profileId, reports, 4, 'Unfall'),
  ].filter(Boolean);
}

function buildConfirmedAbsenceCheck(profileId, reports, typeCode, label) {
  const matchingReports = reports.filter((report) => Number(getAbsenceTypeCode(report)) === typeCode);
  if (!matchingReports.length) {
    return null;
  }

  const matchingDates = matchingReports
    .map((report) => String(report.work_date || ''))
    .filter(Boolean);
  const confirmedRequests = getConfirmedAbsenceRequestsForReports(profileId, typeCode, matchingDates);
  const uncoveredReports = matchingReports
    .filter((report) => !isReportCoveredByConfirmedAbsenceRequests(report, confirmedRequests));
  const certificateChecks = buildMedicalCertificateChecks(uncoveredReports);

  return {
    label,
    reportMinutes: matchingReports.reduce((sum, report) => sum + getAbsenceControlReportMinutes(report), 0),
    confirmedRequests,
    hasConfirmedAbsence: confirmedRequests.length > 0,
    certificateChecks,
  };
}

function getConfirmedAbsenceRequestsForReports(profileId, typeCode, reportDates) {
  const uniqueDates = [...new Set(reportDates)];
  if (!uniqueDates.length) {
    return [];
  }

  return state.holidayRequests
    .filter((request) => String(request.profile_id) === String(profileId))
    .filter((request) => Number(getAbsenceTypeCode(request)) === Number(typeCode))
    .filter((request) => getHolidayRequestApprovalStatus(request) === 2)
    .filter((request) => uniqueDates.some((workDate) => isDateWithinAbsenceRequest(workDate, request)))
    .map((request) => buildConfirmedAbsenceRequestControlInfo(request))
    .sort((left, right) => String(left.startDate || '').localeCompare(String(right.startDate || '')));
}

function isReportCoveredByConfirmedAbsenceRequests(report, confirmedRequests) {
  const workDate = String(report?.work_date || '');
  if (!workDate || !Array.isArray(confirmedRequests) || !confirmedRequests.length) {
    return false;
  }

  return confirmedRequests.some((request) =>
    workDate >= String(request.startDate || '') && workDate <= String(request.endDate || '')
  );
}

function buildMedicalCertificateChecks(reports) {
  const streaks = getConsecutiveAbsenceReportStreaks(reports);
  return streaks
    .filter((streak) => streak.days >= 2)
    .map((streak) => {
      const attachments = collectReportAttachments(streak.reports);
      return {
        startDate: streak.reports[0]?.work_date || '',
        endDate: streak.reports[streak.reports.length - 1]?.work_date || '',
        days: streak.days,
        attachments,
        hasAttachment: attachments.length > 0,
      };
    });
}

function getConsecutiveAbsenceReportStreaks(reports) {
  const reportGroupsByDate = reports
    .filter((report) => String(report?.work_date || ''))
    .reduce((groups, report) => {
      const workDate = String(report.work_date || '');
      if (!groups.has(workDate)) {
        groups.set(workDate, []);
      }
      groups.get(workDate).push(report);
      return groups;
    }, new Map());
  const dateGroups = [...reportGroupsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, groupedReports]) => ({ date, reports: groupedReports }));
  const streaks = [];
  let currentStreak = [];

  dateGroups.forEach((dateGroup) => {
    const previousGroup = currentStreak[currentStreak.length - 1];
    if (!previousGroup || isNextCalendarDay(previousGroup.date, dateGroup.date)) {
      currentStreak.push(dateGroup);
      return;
    }

    streaks.push({
      days: currentStreak.length,
      reports: currentStreak.flatMap((group) => group.reports),
    });
    currentStreak = [dateGroup];
  });

  if (currentStreak.length) {
    streaks.push({
      days: currentStreak.length,
      reports: currentStreak.flatMap((group) => group.reports),
    });
  }

  return streaks;
}

function isNextCalendarDay(previousDateString, nextDateString) {
  const previousDate = new Date(`${previousDateString}T00:00:00Z`);
  const nextDate = new Date(`${nextDateString}T00:00:00Z`);
  if (Number.isNaN(previousDate.getTime()) || Number.isNaN(nextDate.getTime())) {
    return false;
  }

  previousDate.setUTCDate(previousDate.getUTCDate() + 1);
  return previousDate.toISOString().slice(0, 10) === String(nextDateString || '');
}

function collectReportAttachments(reports) {
  return reports.flatMap((report) => Array.isArray(report.attachments) ? report.attachments : []);
}

function buildConfirmedAbsenceRequestControlInfo(request) {
  const specialRequestHours = getAbsenceControlSpecialRequestHoursMap(request);
  const profile = getProfileById(request.profile_id);
  const weeklyHours = getAbsenceControlProfileWeeklyHours(profile);
  const weeklyAbsenceHours = specialRequestHours
    ? getAbsenceControlWeeklySpecialRequestHours(request, specialRequestHours)
    : weeklyHours;
  const rawIncapacityPercent = specialRequestHours && weeklyHours > 0
    ? (weeklyAbsenceHours / weeklyHours) * 100
    : 100;

  return {
    id: request.id,
    startDate: request.start_date,
    endDate: request.end_date,
    weeklyHours,
    weeklyAbsenceHours,
    rawIncapacityPercent,
    incapacityPercent: specialRequestHours ? roundAbsenceControlPercent(rawIncapacityPercent) : 100,
    isFullIncapacity: !specialRequestHours,
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
  };
}

function getAbsenceControlSpecialRequestHoursMap(request) {
  const value = request?.special_request_hours;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value).length ? value : null;
}

function getAbsenceControlWeeklySpecialRequestHours(request, specialRequestHours) {
  const weekdayHours = new Map();
  const dateHours = [];

  Object.entries(specialRequestHours || {}).forEach(([key, value]) => {
    const hours = normalizeAbsenceControlHours(value);
    if (hours <= 0) return;

    const weekdayIndex = getAbsenceControlWeekdayIndexFromKey(key);
    if (weekdayIndex !== null) {
      weekdayHours.set(weekdayIndex, hours);
      return;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(key))) {
      dateHours.push({ date: String(key), hours });
    }
  });

  if (weekdayHours.size) {
    return [...weekdayHours.values()].reduce((sum, hours) => sum + hours, 0);
  }

  const weeklyTotals = new Map();
  dateHours.forEach((entry) => {
    const week = getIsoWeekValueFromDate(new Date(`${entry.date}T00:00:00Z`));
    weeklyTotals.set(week, (weeklyTotals.get(week) || 0) + entry.hours);
  });

  if (weeklyTotals.size) {
    return [...weeklyTotals.values()].reduce((sum, hours) => sum + hours, 0) / weeklyTotals.size;
  }

  return 0;
}

function getAbsenceControlWeekdayIndexFromKey(key) {
  const normalizedKey = normalizeSearchValue(key);
  const weekdayAliases = {
    montag: 0, mo: 0, monday: 0,
    dienstag: 1, di: 1, tuesday: 1,
    mittwoch: 2, mi: 2, wednesday: 2,
    donnerstag: 3, do: 3, thursday: 3,
    freitag: 4, fr: 4, friday: 4,
    samstag: 5, sa: 5, saturday: 5,
    sonntag: 6, so: 6, sunday: 6,
  };
  return Object.prototype.hasOwnProperty.call(weekdayAliases, normalizedKey) ? weekdayAliases[normalizedKey] : null;
}

function normalizeAbsenceControlHours(value) {
  const normalizedValue = typeof value === 'string' ? value.replace(',', '.') : value;
  const hours = Number(normalizedValue);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

function getAbsenceControlProfileWeeklyHours(profile) {
  const weeklyHours = Number(profile?.weekly_hours);
  return Number.isFinite(weeklyHours) && weeklyHours > 0 ? weeklyHours : 40;
}

function roundAbsenceControlPercent(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(value / 5) * 5);
}

function isDateWithinAbsenceRequest(workDate, request) {
  const date = String(workDate || '');
  return date && date >= String(request?.start_date || '') && date <= String(request?.end_date || '');
}

function getAbsenceControlReportMinutes(report) {
  if (isAbsenceReport(report)) {
    return getAbsenceMinutes(report);
  }

  return getAdjustedWorkMinutes(report);
}

function renderAbsenceControlContent(summaries) {
  if (state.isLoadingData) {
    return `<p class="empty-state">Auswertung für ${escapeHtml(getWeekLabel(state.selectedWeek))} wird geladen …</p>`;
  }

  if (!summaries.length) {
    return `<p class="empty-state">In ${escapeHtml(getWeekLabel(state.selectedWeek))} wurden keine Rapporte mit Krankheit oder Unfall gefunden.</p>`;
  }

  return `
    <div class="absence-control-summary subtle-text">
      ${escapeHtml(getWeekLabel(state.selectedWeek))}: ${summaries.length} Mitarbeiter mit rapportierter Krankheit oder rapportiertem Unfall.
    </div>
    <div class="absence-control-list">
      ${summaries.map(renderAbsenceControlEmployeeCard).join('')}
    </div>
  `;
}

function renderAbsenceControlEmployeeCard(summary) {
  const totalMinutes = Math.max(0, summary.totalMinutes || 0);
  const rows = [
    { label: 'Krankheit', minutes: summary.illnessMinutes, className: 'illness' },
    { label: 'Unfall', minutes: summary.accidentMinutes, className: 'accident' },
    { label: 'Feiertag', minutes: summary.holidayMinutes, className: 'holiday' },
    { label: 'Ferien', minutes: summary.vacationMinutes, className: 'vacation' },
    { label: 'Weitere Absenzen', minutes: summary.otherAbsenceMinutes, className: 'other-absence' },
    { label: 'Rest', minutes: summary.remainingMinutes, className: 'remaining' },
  ].filter((row) => row.minutes > 0 || row.className !== 'other-absence');

  const otherBreakdown = [...summary.otherAbsenceBreakdown.entries()]
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel, 'de'))
    .map(([label, minutes]) => `${escapeHtml(label)}: ${formatMinutes(minutes)} (${formatAbsenceControlPercent(minutes, totalMinutes)})`)
    .join(' · ');

  return `
    <article class="absence-control-card">
      <div class="absence-control-card-heading">
        <div>
          <strong>${escapeHtml(summary.profileName)}</strong>
          <div class="subtle-text">Total rapportierte Stunden: ${formatMinutes(totalMinutes)}</div>
        </div>
        <span class="pill warning">Absenzen ${formatAbsenceControlPercent(summary.relevantAbsenceMinutes, totalMinutes)}</span>
      </div>
      <div class="absence-control-bars" role="list">
        ${rows.map((row) => renderAbsenceControlRatioRow(row, totalMinutes)).join('')}
      </div>
      ${otherBreakdown ? `<div class="absence-control-breakdown subtle-text">${otherBreakdown}</div>` : ''}
      ${renderConfirmedAbsenceChecks(summary.confirmedAbsenceChecks)}
    </article>
  `;
}

function renderConfirmedAbsenceChecks(checks) {
  if (!Array.isArray(checks) || !checks.length) {
    return '';
  }

  return `
    <div class="absence-control-confirmations" aria-label="Bestätigte Absenzen Krankheit und Unfall">
      ${checks.map((check) => renderConfirmedAbsenceCheck(check)).join('')}
    </div>
  `;
}

function renderConfirmedAbsenceCheck(check) {
  const statusClass = check.hasConfirmedAbsence ? 'positive' : 'negative';
  const statusLabel = check.hasConfirmedAbsence ? 'Bestätigte Absenz vorhanden' : 'Keine bestätigte Absenz gefunden';
  const requestDetails = check.confirmedRequests.length
    ? check.confirmedRequests.map((request) => renderConfirmedAbsenceRequestDetail(request)).join('')
    : '';
  const certificateDetails = renderMedicalCertificateChecks(check.certificateChecks);

  return `
    <div class="absence-control-confirmation ${escapeAttribute(statusClass)}">
      <div class="absence-control-confirmation-heading">
        <strong>${escapeHtml(check.label)}</strong>
        <span class="pill ${escapeAttribute(statusClass === 'positive' ? 'success' : 'warning')}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="subtle-text">Rapportiert: ${formatMinutes(check.reportMinutes)}</div>
      ${requestDetails}
      ${certificateDetails}
    </div>
  `;
}

function renderConfirmedAbsenceRequestDetail(request) {
  const percentLabel = `${request.incapacityPercent} %`;
  const hoursLabel = request.isFullIncapacity
    ? ''
    : `${formatAbsenceControlHours(request.weeklyAbsenceHours)} von ${formatAbsenceControlHours(request.weeklyHours)} pro Woche`;
  const attachments = renderAbsenceControlAttachments(request.attachments);
  return `
    <div class="absence-control-confirmation-detail">
      <span>Bestätigte Absenz: ${formatDate(request.startDate)} bis ${formatDate(request.endDate)}</span>
      <strong>Arbeitsunfähigkeit ${escapeHtml(percentLabel)}</strong>
      ${hoursLabel ? `<small>${escapeHtml(hoursLabel)}</small>` : ''}
      ${attachments ? `<small>Anhang: ${attachments}</small>` : ''}
    </div>
  `;
}

function renderAbsenceControlAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return '';
  }

  return renderAttachmentLinks(attachments);
}

function renderMedicalCertificateChecks(checks) {
  if (!Array.isArray(checks) || !checks.length) {
    return '';
  }

  return `
    <div class="absence-control-certificate-checks">
      ${checks.map((check) => renderMedicalCertificateCheck(check)).join('')}
    </div>
  `;
}

function renderMedicalCertificateCheck(check) {
  const dateLabel = check.startDate === check.endDate
    ? formatDate(check.startDate)
    : `${formatDate(check.startDate)} bis ${formatDate(check.endDate)}`;
  const attachmentLinks = renderAbsenceControlAttachments(check.attachments);
  const message = check.hasAttachment
    ? 'Muss geprüft werden: Anhang vorhanden – OK.'
    : 'Arztzeugnis fehlt.';
  const statusClass = check.hasAttachment ? 'positive' : 'negative';

  return `
    <div class="absence-control-confirmation-detail ${escapeAttribute(statusClass)}">
      <span>${escapeHtml(dateLabel)} · ${check.days} Tage am Stück ohne vorgängig bestätigte Absenz</span>
      <strong>${escapeHtml(message)}</strong>
      ${attachmentLinks ? `<small>Anhang: ${attachmentLinks}</small>` : ''}
    </div>
  `;
}

function formatAbsenceControlHours(hours) {
  return `${Number(hours || 0).toFixed(2)} h`;
}

function renderAbsenceControlRatioRow(row, totalMinutes) {
  const percent = getAbsenceControlPercentValue(row.minutes, totalMinutes);
  return `
    <div class="absence-control-ratio-row ${escapeAttribute(row.className)}" role="listitem">
      <div class="absence-control-ratio-meta">
        <span>${escapeHtml(row.label)}</span>
        <strong>${formatMinutes(row.minutes)} · ${formatAbsenceControlPercent(row.minutes, totalMinutes)}</strong>
      </div>
      <div class="absence-control-bar" aria-hidden="true">
        <span style="width: ${escapeAttribute(String(percent))}%;"></span>
      </div>
    </div>
  `;
}

function getAbsenceControlPercentValue(minutes, totalMinutes) {
  if (!totalMinutes) {
    return 0;
  }

  return Math.min(100, Math.max(0, (minutes / totalMinutes) * 100));
}

function formatAbsenceControlPercent(minutes, totalMinutes) {
  return `${getAbsenceControlPercentValue(minutes, totalMinutes).toFixed(1)}%`;
}


function syncEmployeeSelection() {
  const filter = state.reportColumnFilter || { type: 'none', values: [] };
  if (filter.type !== 'employee') {
    return;
  }

  const validIds = new Set(getReportableProfiles().map((profile) => String(profile.id)));
  const selectedValues = Array.isArray(filter.values)
    ? filter.values.map((value) => String(value)).filter((value) => validIds.has(value))
    : [];

  if (!selectedValues.length) {
    state.reportColumnFilter = { type: 'none', values: [] };
    return;
  }

  if (selectedValues.length !== filter.values.length) {
    state.reportColumnFilter = { type: 'employee', values: selectedValues };
  }
}

function getFilteredReports() {
  return state.weeklyReports
    .filter((report) => state.showControlledReports || !String(report.controll || '').trim())
    .filter((report) => matchesReportColumnFilter(report));
}

function matchesReportColumnFilter(report) {
  const filter = state.reportColumnFilter || { type: 'none', values: [] };
  if (filter.type === 'employee') return filter.values.includes(report.profile_id);
  if (filter.type === 'commission') return filter.values.includes(String(report.commission_number || ''));
  if (filter.type === 'expenses') return Number(report.expenses_amount || 0) + Number(report.other_costs_amount || 0) > 0;
  if (filter.type === 'attachments') return Array.isArray(report.attachments) && report.attachments.length > 0;
  return true;
}

function getOpenCommissionFilterOptions(reports = state.weeklyReports) {
  const commissionsWithOpenReports = new Set();

  reports.forEach((report) => {
    const commissionNumber = String(report.commission_number || '').trim();
    if (!commissionNumber || String(report.controll || '').trim()) {
      return;
    }

    commissionsWithOpenReports.add(commissionNumber);
  });

  return [...commissionsWithOpenReports].sort();
}

function getSortedFilteredReports() {
  return [...getFilteredReports()].sort((a, b) => {
    const dateCompare = `${a.work_date || ''}${a.start_time || ''}`.localeCompare(`${b.work_date || ''}${b.start_time || ''}`);
    const nameCompare = (getProfileById(a.profile_id)?.full_name ?? '').localeCompare(getProfileById(b.profile_id)?.full_name ?? '');

    if (state.reportsSortMode === 'date_asc') {
      if (dateCompare !== 0) return dateCompare;
      return nameCompare;
    }

    if (state.reportsSortMode === 'personal_asc') {
      if (nameCompare !== 0) return nameCompare;
      return dateCompare;
    }

    if (state.reportsSortMode === 'personal_desc') {
      if (nameCompare !== 0) return -nameCompare;
      return dateCompare;
    }

    if (dateCompare !== 0) return -dateCompare;
    return nameCompare;
  });
}


function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseHistoryPeriod(periodLabel) {
  const match = String(periodLabel || '').match(/(\d{4}-\d{2}-\d{2})\s+bis\s+(\d{4}-\d{2}-\d{2})/i);
  if (!match) return null;
  return { startDate: match[1], endDate: match[2] };
}

function parseRequestHistoryEntry(entry) {
  const requestValue = String(entry?.request || '').trim();
  const requestParts = requestValue ? requestValue.split(' | ').map((part) => part.trim()).filter(Boolean) : [];
  const typeLabel = requestParts[0] || 'Unbekannt';
  const periodMatch = requestParts.find((part) => part.includes(' bis '));

  const approvalNames = getHistoryApprovalNamesFromContext(entry);

  return {
    typeLabel,
    periodLabel: periodMatch || '–',
    approvedByLabel: buildHistoryApprovedByLabel(entry),
    plApprovalLabel: approvalNames.pl,
    glApprovalLabel: approvalNames.gl,
  };
}

function getHistoryApprovalNamesFromContext(entry) {
  const contextValue = String(entry?.context || '').trim();
  const plMatch = contextValue.match(/PL:\s*([^|]+)/i);
  const glMatch = contextValue.match(/GL:\s*([^|]+)/i);
  return {
    pl: String(plMatch?.[1] || '').trim() || 'Noch nicht bestätigt',
    gl: String(glMatch?.[1] || '').trim() || 'Noch nicht bestätigt',
  };
}

function buildHistoryApprovedByLabel(entry) {
  const contextValue = String(entry?.context || '').trim();
  if (!contextValue) {
    return '–';
  }

  const approvalNames = getHistoryApprovalNamesFromContext(entry);
  const names = [approvalNames.pl, approvalNames.gl]
    .filter((value) => value && value !== '–' && value !== 'Noch nicht bestätigt');

  if (names.length) {
    return names.join(' / ');
  }

  return contextValue;
}


function getReportsPaginationMeta(reports = getSortedFilteredReports()) {
  const totalItems = reports.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.reportsPerPage));
  const currentPage = Math.min(Math.max(1, state.reportsPage), totalPages);
  const startIndex = (currentPage - 1) * state.reportsPerPage;
  const endIndex = Math.min(startIndex + state.reportsPerPage, totalItems);

  state.reportsPage = currentPage;

  return {
    totalItems,
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    pageItems: reports.slice(startIndex, endIndex),
  };
}

function getProfileSubmissionSummary() {
  const groups = groupReportsByProfile(state.weeklyReports);
  return getReportableProfiles().map((profile) => {
    const reports = groups.get(profile.id) ?? [];
    const totalMinutes = reports.reduce((sum, report) => sum + getAdjustedWorkMinutes(report), 0);
    const hasPendingControll = reports.some((report) => !String(report.controll || '').trim());
    return {
      profile,
      reports,
      entryCount: reports.length,
      totalMinutes,
      hasSubmission: reports.length > 0,
      hasPendingControll,
    };
  });
}

function handleReportsTableClick(event) {
  if (event.target.closest('a')) {
    return;
  }

  const clickedRow = event.target.closest('tr[data-action="open-report-edit"]');
  if (clickedRow && !event.target.closest('button, input, label, a')) {
    const rowReportId = clickedRow.dataset.reportId;
    if (rowReportId) {
      openReportEditModal(rowReportId);
      return;
    }
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const reportId = trigger.dataset.reportId;
  if (!reportId) {
    return;
  }

  if (trigger.dataset.action === 'edit-report' || trigger.dataset.action === 'open-report-edit') {
    openReportEditModal(reportId);
    return;
  }

  if (trigger.dataset.action === 'edit-adjusted-time') {
    openAdjustedMinutesModal(reportId);
    return;
  }

  if (trigger.dataset.action === 'confirm-report') {
    handleConfirmReport(reportId);
    return;
  }

  if (trigger.dataset.action === 'delete-report') {
    handleDeleteReport(reportId);
  }
}

async function handleConfirmReport(reportId) {
  if (!reportId || state.isSavingReport) {
    return;
  }

  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report || String(report.controll || '').trim()) {
    return;
  }

  const controllName = getControllDisplayName();
  if (!controllName) {
    alert('Der Name für die Kontrolle konnte nicht ermittelt werden.');
    return;
  }

  const previousControll = report.controll;
  report.controll = controllName;
  state.isSavingReport = true;
  renderReportsTable();

  try {
    await confirmReportUsingSingleConfirmationLogic(reportId, controllName);
  } catch (error) {
    report.controll = previousControll;
    console.error(error);
    alert(`Kontrolle konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    renderReportsTable();
  }
}

async function confirmReportUsingSingleConfirmationLogic(reportId, controllName = getControllDisplayName()) {
  if (!controllName) {
    throw new Error('Der Name für die Kontrolle konnte nicht ermittelt werden.');
  }

  if (state.isDemoMode) {
    updateDemoReport(reportId, { controll: controllName });
    return;
  }

  const { error } = await state.supabase
    .from('weekly_reports')
    .update({ controll: controllName })
    .eq('id', reportId);
  if (error) throw error;
}

async function handleBulkConfirmSubmit() {
  if (state.isBulkConfirmSaving || state.isSavingReport) {
    return;
  }
  const reportsToConfirm = getBulkConfirmFilteredReports({ onlyOpenReports: true });
  if (!reportsToConfirm.length) {
    state.bulkConfirmResultMessage = 'Keine offenen Rapporte für die aktuelle Kalenderwoche und Filter (Wochentag/Kommission) gefunden.';
    state.bulkConfirmResultIsError = false;
    renderBulkConfirmModalState();
    return;
  }

  const shouldConfirm = window.confirm(`Möchten Sie alle Rapporte bestätigen? (${reportsToConfirm.length} Einträge)`);
  if (!shouldConfirm) {
    return;
  }

  state.isBulkConfirmSaving = true;
  state.bulkConfirmResultMessage = '';
  state.bulkConfirmResultIsError = false;
  renderBulkConfirmModalState();

  const errors = [];
  let successCount = 0;

  try {
    await withLongTask('Sammelbestätigung wird verarbeitet …', async () => {
      for (const report of reportsToConfirm) {
        try {
          await confirmReportUsingSingleConfirmationLogic(report.id);
          successCount += 1;
        } catch (error) {
          errors.push(`${getProfileById(report.profile_id)?.full_name || 'Unbekannt'} (${formatDate(report.work_date)}): ${error.message}`);
        }
      }
      await loadData();
    });
  } catch (error) {
    errors.push(error.message);
  } finally {
    state.isBulkConfirmSaving = false;
  }

  if (!errors.length) {
    state.bulkConfirmResultMessage = `${successCount} Rapporte erfolgreich bestätigt.`;
    state.bulkConfirmResultIsError = false;
  } else {
    state.bulkConfirmResultMessage = `${successCount} Rapporte bestätigt, ${errors.length} fehlgeschlagen: ${errors.join(' | ')}`;
    state.bulkConfirmResultIsError = true;
  }
  renderBulkConfirmModalState();
}

const EDITABLE_SPECIAL_ABSENCE_TYPE_CODES = new Set([1, 2, 3, 4, 6, 7]);

function isEditableSpecialAbsenceReport(report) {
  return EDITABLE_SPECIAL_ABSENCE_TYPE_CODES.has(Number(report?.abz_typ));
}

function getEditableSpecialAbsenceOptions() {
  return ABSENCE_CATEGORY_CONFIG.filter((item) => EDITABLE_SPECIAL_ABSENCE_TYPE_CODES.has(Number(item.typeCode)));
}

function getEditableSpecialAbsenceLabel(typeCode) {
  const option = getEditableSpecialAbsenceOptions().find((item) => Number(item.typeCode) === Number(typeCode));
  return option?.label || 'Absenz';
}

function renderSpecialReportEditAbsenceTypeOptions(selectedTypeCode) {
  if (!elements.specialEditAbsenceType) return;
  elements.specialEditAbsenceType.innerHTML = getEditableSpecialAbsenceOptions()
    .map((option) => `<option value="${escapeAttribute(option.typeCode)}" ${Number(option.typeCode) === Number(selectedTypeCode) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');
}

function setReportEditMode(isCreating) {
  state.isCreatingReport = Boolean(isCreating);
  if (elements.reportEditTitle) {
    elements.reportEditTitle.textContent = isCreating ? 'Rapport erstellen' : 'Rapport bearbeiten';
  }
  if (elements.reportEditDescription) {
    elements.reportEditDescription.textContent = isCreating
      ? 'Admin-Rapport für einen ausgewählten Mitarbeiter neu erfassen. Die bestehende RLS prüft den Insert serverseitig.'
      : 'Bestehende Rapporte können hier kontrolliert und angepasst werden.';
  }
  elements.editEmployeeNameField?.classList.toggle('hidden', isCreating);
  elements.createReportProfileField?.classList.toggle('hidden', !isCreating);
  if (elements.createReportProfileSelect) {
    elements.createReportProfileSelect.required = isCreating;
  }
  if (elements.editProjectName) {
    elements.editProjectName.readOnly = !isCreating;
  }
  if (elements.saveReportEditButton) {
    elements.saveReportEditButton.textContent = isCreating ? 'Rapport erstellen' : 'Änderungen speichern';
  }
}

function renderCreateReportProfileOptions(selectedProfileId = '') {
  if (!elements.createReportProfileSelect) return;
  const profiles = getReportableProfiles()
    .slice()
    .sort((left, right) => String(left.full_name || '').localeCompare(String(right.full_name || '')));
  elements.createReportProfileSelect.innerHTML = profiles
    .map((profile) => `<option value="${escapeAttribute(profile.id)}" ${String(profile.id) === String(selectedProfileId) ? 'selected' : ''}>${escapeHtml(profile.full_name || profile.email || 'Unbekannt')}</option>`)
    .join('');
}

function getDefaultCreateReportProfileId() {
  if (state.reportColumnFilter.type === 'employee' && state.reportColumnFilter.values.length === 1) {
    const [profileId] = state.reportColumnFilter.values;
    if (getReportableProfiles().some((profile) => String(profile.id) === String(profileId))) {
      return profileId;
    }
  }
  return getReportableProfiles()[0]?.id || '';
}

function openReportCreateModal() {
  if (!elements.reportEditModal || state.isSavingReport) {
    return;
  }
  const defaultProfileId = getDefaultCreateReportProfileId();
  if (!defaultProfileId) {
    alert('Es ist kein aktiver Mitarbeiter vorhanden, für den ein Rapport erstellt werden kann.');
    return;
  }

  const weekRange = getWeekRange(state.selectedWeek);
  state.editingReportId = null;
  state.editingReportPauseMinutes = 90;
  setReportEditMode(true);
  renderCreateReportProfileOptions(defaultProfileId);
  elements.editReportId.value = '';
  elements.editEmployeeName.value = '';
  elements.editWorkDate.value = weekRange.start;
  elements.editCommissionNumber.value = '';
  elements.editProjectName.value = '';
  elements.editStartTime.value = '07:00';
  elements.editEndTime.value = '16:30';
  elements.editPauseMinutes.value = 90;
  elements.editTotalMinutes.value = 480;
  elements.editExpensesAmount.value = 0;
  elements.editOtherCostsAmount.value = 0;
  elements.editNotes.value = '';
  elements.editStartTime.disabled = false;
  elements.editEndTime.disabled = false;
  if (elements.reportEditAttachments) {
    elements.reportEditAttachments.innerHTML = '–';
  }
  elements.reportEditModal.classList.remove('hidden');
}

function openReportEditModal(reportId) {
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    return;
  }

  if (isEditableSpecialAbsenceReport(report)) {
    openSpecialReportEditModal(report);
    return;
  }

  const profile = getProfileById(report.profile_id);
  state.editingReportId = report.id;
  setReportEditMode(false);
  elements.editReportId.value = report.id;
  elements.editEmployeeName.value = profile?.full_name ?? 'Unbekannt';
  elements.editWorkDate.value = report.work_date || '';
  elements.editCommissionNumber.value = report.commission_number || '';
  elements.editProjectName.value = report.project_name || '';
  elements.editStartTime.value = normalizeTimeForInput(report.start_time);
  elements.editEndTime.value = normalizeTimeForInput(report.end_time);
  elements.editTotalMinutes.value = Number(report.total_work_minutes || 0);
  elements.editExpensesAmount.value = Number(report.expenses_amount || 0);
  elements.editOtherCostsAmount.value = Number(report.other_costs_amount || 0);
  elements.editNotes.value = report.notes || '';
  const pauseMinutes = Number(report.lunch_break_minutes || 0) + Number(report.additional_break_minutes || 0);
  state.editingReportPauseMinutes = pauseMinutes;
  elements.editPauseMinutes.value = pauseMinutes;
  if (elements.reportEditAttachments) {
    elements.reportEditAttachments.innerHTML = renderAttachmentLinks(report.attachments);
  }
  applyReportEditTimeFieldState(report);
  elements.reportEditModal.classList.remove('hidden');
}

function closeReportEditModal() {
  state.editingReportId = null;
  state.isCreatingReport = false;
  state.editingReportPauseMinutes = 0;
  if (!elements.reportEditModal || !elements.reportEditForm) {
    return;
  }

  elements.reportEditModal.classList.add('hidden');
  elements.editStartTime.disabled = false;
  elements.editEndTime.disabled = false;
  setReportEditMode(false);
  elements.reportEditForm.reset();
  if (elements.reportEditAttachments) {
    elements.reportEditAttachments.innerHTML = '';
  }
}

function openSpecialReportEditModal(report) {
  const profile = getProfileById(report.profile_id);
  state.editingReportId = report.id;
  elements.specialEditReportId.value = report.id;
  if (elements.specialReportEditContext) {
    const employeeName = profile?.full_name ?? 'Unbekannt';
    elements.specialReportEditContext.textContent = `${employeeName} · ${formatDate(report.work_date)} · Absenzart, Stunden und Spesen anpassen.`;
  }
  renderSpecialReportEditAbsenceTypeOptions(report.abz_typ);
  elements.specialEditTotalMinutes.value = Number(report.total_work_minutes || 0);
  elements.specialEditExpensesAmount.value = Number(report.expenses_amount || 0);
  elements.specialReportEditModal.classList.remove('hidden');
}

function closeSpecialReportEditModal() {
  if (state.editingReportId && elements.specialReportEditModal && !elements.specialReportEditModal.classList.contains('hidden')) {
    state.editingReportId = null;
  }
  if (!elements.specialReportEditModal || !elements.specialReportEditForm) {
    return;
  }
  elements.specialReportEditModal.classList.add('hidden');
  elements.specialReportEditForm.reset();
  if (elements.specialEditAbsenceType) {
    elements.specialEditAbsenceType.innerHTML = '';
  }
}

async function handleSpecialReportEditSubmit(event) {
  event.preventDefault();
  if (!state.editingReportId || state.isSavingReport) {
    return;
  }

  const reportId = state.editingReportId;
  const existingReport = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!existingReport || !isEditableSpecialAbsenceReport(existingReport)) {
    closeSpecialReportEditModal();
    return;
  }

  const selectedAbsenceTypeCode = Number(elements.specialEditAbsenceType.value || existingReport.abz_typ);
  const selectedAbsenceLabel = getEditableSpecialAbsenceLabel(selectedAbsenceTypeCode);
  const totalWorkMinutes = Math.max(0, Number(elements.specialEditTotalMinutes.value || 0));
  const updates = {
    commission_number: selectedAbsenceLabel,
    project_name: selectedAbsenceLabel,
    abz_typ: selectedAbsenceTypeCode,
    start_time: '00:00',
    end_time: '00:00',
    lunch_break_minutes: 0,
    additional_break_minutes: 0,
    total_work_minutes: totalWorkMinutes,
    ...buildAdjustedMinutesUpdatePayload(existingReport, totalWorkMinutes),
    expenses_amount: Number(elements.specialEditExpensesAmount.value || 0),
  };

  state.isSavingReport = true;
  try {
    if (state.isDemoMode) {
      updateDemoReport(reportId, updates);
    } else {
      const { error } = await state.supabase.from('weekly_reports').update(updates).eq('id', reportId);
      if (error) throw error;
    }

    await loadData();
    closeSpecialReportEditModal();
  } catch (error) {
    console.error(error);
    alert(`Spezialrapport konnte nicht aktualisiert werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

function openAdjustedMinutesModal(reportId) {
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report || !elements.adjustedMinutesModal) {
    return;
  }

  state.editingAdjustedReportId = report.id;
  elements.adjustedReportId.value = report.id;
  elements.adjustedMinutesInput.value = Number(getAdjustedWorkMinutes(report));
  elements.adjustedMinutesModal.classList.remove('hidden');
}

function closeAdjustedMinutesModal() {
  state.editingAdjustedReportId = null;
  if (!elements.adjustedMinutesModal || !elements.adjustedMinutesForm) {
    return;
  }
  elements.adjustedMinutesModal.classList.add('hidden');
  elements.adjustedMinutesForm.reset();
}

async function handleAdjustedMinutesSubmit(event) {
  event.preventDefault();
  if (!state.editingAdjustedReportId || state.isSavingReport) {
    return;
  }

  const reportId = state.editingAdjustedReportId;
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    closeAdjustedMinutesModal();
    return;
  }

  const adjustedMinutes = Math.max(0, Number(elements.adjustedMinutesInput.value || 0));
  const baseAdjustedMinutes = shouldApplyHolidayDoubleMinutes(report) ? Math.round(adjustedMinutes / 2) : adjustedMinutes;
  const updates = buildAdjustedMinutesUpdatePayload(report, baseAdjustedMinutes);
  state.isSavingReport = true;

  try {
    if (state.isDemoMode) {
      updateDemoReport(reportId, updates);
    } else {
      const { error } = await state.supabase.from('weekly_reports').update(updates).eq('id', reportId);
      if (error) throw error;
    }

    await loadData();
    closeAdjustedMinutesModal();
  } catch (error) {
    console.error(error);
    alert(`Bereinigte Arbeitszeit konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

function syncEditedWorkMinutesWithTimeRange() {
  if (elements.editStartTime.disabled || elements.editEndTime.disabled) {
    return;
  }
  const startMinutes = parseTimeToMinutes(elements.editStartTime.value);
  const endMinutes = parseTimeToMinutes(elements.editEndTime.value);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return;
  }

  let durationMinutes = endMinutes - startMinutes;
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }
  const pauseMinutes = Math.max(0, Number(elements.editPauseMinutes.value || 0));
  state.editingReportPauseMinutes = pauseMinutes;
  const workMinutes = Math.max(0, durationMinutes - pauseMinutes);
  elements.editTotalMinutes.value = String(workMinutes);
}

function isZeroTimeValue(value) {
  const normalized = String(value || '').trim();
  return normalized === '00:00' || normalized === '00:00:00';
}

function applyReportEditTimeFieldState(report) {
  const lockTimeFields = isZeroTimeValue(report?.start_time) && isZeroTimeValue(report?.end_time);
  elements.editStartTime.disabled = lockTimeFields;
  elements.editEndTime.disabled = lockTimeFields;
}

async function handleReportEditSubmit(event) {
  event.preventDefault();
  if (state.isSavingReport) {
    return;
  }

  const isCreating = state.isCreatingReport;
  const reportId = state.editingReportId;
  const existingReport = isCreating
    ? null
    : state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!isCreating && !existingReport) {
    closeReportEditModal();
    return;
  }

  const selectedProfileId = isCreating ? elements.createReportProfileSelect?.value : existingReport.profile_id;
  const workDate = elements.editWorkDate.value;
  const commissionNumber = elements.editCommissionNumber.value.trim();
  if (isCreating && !selectedProfileId) {
    alert('Bitte einen Mitarbeiter auswählen.');
    return;
  }
  if (!workDate) {
    alert('Bitte ein Datum auswählen.');
    return;
  }
  if (!commissionNumber) {
    alert('Bitte eine Kommission erfassen.');
    return;
  }

  syncEditedWorkMinutesWithTimeRange();
  const totalWorkMinutes = Math.max(0, Number(elements.editTotalMinutes.value || 0));
  const pauseMinutes = Math.max(0, Number(elements.editPauseMinutes.value || 0));
  const baseAdjustedMinutes = existingReport && shouldApplyHolidayDoubleMinutes(existingReport)
    ? Math.round(totalWorkMinutes / 2)
    : totalWorkMinutes;
  const sharedPayload = {
    work_date: workDate,
    ...getIsoYearAndWeekFromDateString(workDate),
    commission_number: commissionNumber,
    project_name: elements.editProjectName.value.trim() || null,
    start_time: !isCreating && elements.editStartTime.disabled ? (existingReport.start_time || '00:00:00') : elements.editStartTime.value,
    end_time: !isCreating && elements.editEndTime.disabled ? (existingReport.end_time || '00:00:00') : elements.editEndTime.value,
    lunch_break_minutes: pauseMinutes,
    additional_break_minutes: 0,
    total_work_minutes: totalWorkMinutes,
    expenses_amount: Number(elements.editExpensesAmount.value || 0),
    other_costs_amount: Number(elements.editOtherCostsAmount.value || 0),
    notes: elements.editNotes.value.trim(),
  };
  const payload = isCreating
    ? {
      profile_id: selectedProfileId,
      abz_typ: 0,
      ...sharedPayload,
      total_adjusted_work_minutes: baseAdjustedMinutes,
      expense_note: '',
      controll: '',
      attachments: [],
    }
    : {
      ...sharedPayload,
      ...buildAdjustedMinutesUpdatePayload(existingReport, baseAdjustedMinutes),
    };

  state.isSavingReport = true;
  try {
    if (state.isDemoMode) {
      if (isCreating) {
        demoWeeklyReports.push({ id: crypto.randomUUID(), ...payload });
      } else {
        updateDemoReport(reportId, payload);
      }
    } else if (isCreating) {
      const { error } = await state.supabase.from('weekly_reports').insert(payload);
      if (error) throw error;
    } else {
      const { error } = await state.supabase.from('weekly_reports').update(payload).eq('id', reportId);
      if (error) throw error;
    }

    await loadData();
    closeReportEditModal();
  } catch (error) {
    console.error(error);
    alert(`Rapport konnte nicht ${isCreating ? 'erstellt' : 'aktualisiert'} werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

async function handleDeleteReport(reportId) {
  if (!reportId || state.isSavingReport) {
    return;
  }

  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    alert('Der ausgewählte Rapport wurde nicht gefunden.');
    return;
  }

  const shouldDelete = window.confirm('Soll dieser Wochenrapport wirklich gelöscht werden?');
  if (!shouldDelete) {
    return;
  }

  state.isSavingReport = true;
  try {
    if (state.isDemoMode) {
      const index = demoWeeklyReports.findIndex((item) => String(item.id) === String(reportId));
      if (index === -1) {
        throw new Error('Demo-Rapport nicht gefunden');
      }
      demoWeeklyReports.splice(index, 1);
    } else {
      await deleteWeeklyReportAttachmentsSafely(report.attachments);
      const { error } = await state.supabase.from('weekly_reports').delete().eq('id', reportId);
      if (error) throw error;
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Rapport konnte nicht gelöscht werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}


async function synchronizeAllApprenticeSchoolReportsForYear(year) {
  const apprentices = state.profiles.filter((profile) => String(profile.role_label || '').trim() === 'Lehrling');
  for (const apprentice of apprentices) {
    // eslint-disable-next-line no-await-in-loop
    await synchronizeApprenticeSchoolReportsForYear(apprentice.id, year);
  }
}

function getSchoolReportSyncYears() {
  const years = new Set();
  const currentYear = new Date().getUTCFullYear();
  years.add(currentYear);
  years.add(currentYear + 1);
  const selectedWeekYear = Number(getYearAndWeekFromWeekValue(state.selectedWeek).year);
  if (Number.isInteger(selectedWeekYear)) {
    years.add(selectedWeekYear);
  }
  state.schoolVacations.forEach((range) => {
    const startYear = Number(String(range?.start_date || '').slice(0, 4));
    const endYear = Number(String(range?.end_date || '').slice(0, 4));
    if (Number.isInteger(startYear)) years.add(startYear);
    if (Number.isInteger(endYear)) years.add(endYear);
  });
  return [...years].sort((left, right) => left - right);
}

function getYearsFromDateRange(startDate, endDate) {
  const years = new Set();
  const startYear = Number(String(startDate || '').slice(0, 4));
  const endYear = Number(String(endDate || '').slice(0, 4));
  if (Number.isInteger(startYear)) years.add(startYear);
  if (Number.isInteger(endYear)) years.add(endYear);
  return [...years];
}

function mergeSchoolReportSyncYears(...yearLists) {
  const years = new Set();
  yearLists.flat().forEach((year) => {
    if (Number.isInteger(Number(year))) years.add(Number(year));
  });
  return [...years].sort((left, right) => left - right);
}

async function synchronizeAllApprenticeSchoolReportsForYears(years = []) {
  for (const year of years) {
    // eslint-disable-next-line no-await-in-loop
    await synchronizeAllApprenticeSchoolReportsForYear(year);
  }
}

async function synchronizeApprenticeSchoolReportsForYears(profileId, years = []) {
  for (const year of years) {
    // eslint-disable-next-line no-await-in-loop
    await synchronizeApprenticeSchoolReportsForYear(profileId, year);
  }
}

async function synchronizeApprenticeSchoolReportsForYear(profileId, year) {
  const profile = state.profiles.find((item) => String(item.id) === String(profileId))
    || demoProfiles.find((item) => String(item.id) === String(profileId));
  if (!profile) return;

  const schoolDays = [Number(profile.school_day_1), Number(profile.school_day_2)]
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
  const isApprentice = String(profile.role_label || '') === 'Lehrling';
  const desiredDates = new Set();
  if (isApprentice && schoolDays.length) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const stop = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= stop) {
      const isoDate = cursor.toISOString().slice(0, 10);
      const weekday = getWeekdayIndex(isoDate) + 1;
      if (schoolDays.includes(weekday) && !isDateInSchoolVacation(isoDate)) {
        desiredDates.add(isoDate);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  let profileReports = [];
  if (state.isDemoMode) {
    profileReports = demoWeeklyReports.filter((report) => report.profile_id === profileId && Number(getIsoYearAndWeekFromDateString(report.work_date).year) === year);
  } else {
    const { data, error } = await state.supabase
      .from('weekly_reports')
      .select('*')
      .eq('profile_id', profileId)
      .eq('year', year);
    if (error) throw error;
    profileReports = data || [];
  }

  const autoSchoolReports = profileReports.filter(isAutoSchoolReport);
  const manualReportDates = new Set(profileReports.filter((report) => !isAutoSchoolReport(report)).map((report) => report.work_date));
  const blockDayDates = new Set(profileReports.filter((report) => isAutoBlockDayReport(report)).map((report) => report.work_date));
  const existingAutoDates = new Set(autoSchoolReports.map((report) => report.work_date));
  const todayIso = new Date().toISOString().slice(0, 10);
  const holidayDates = new Set(state.platformHolidays.map((entry) => String(entry.holiday_date || '')));
  profileReports.forEach((report) => {
    if (HOLIDAY_TYPE_CODES.has(Number(report.abz_typ)) && report.work_date) {
      holidayDates.add(String(report.work_date));
    }
  });
  const datesToInsert = [...desiredDates].filter(
    (date) => date >= todayIso
      && !manualReportDates.has(date)
      && !existingAutoDates.has(date)
      && !holidayDates.has(date)
      && !blockDayDates.has(date),
  );
  const reportsToDeleteIds = profileReports
    .filter((report) => report.work_date >= todayIso && !desiredDates.has(report.work_date) && isSchoolReport(report))
    .map((report) => report.id);

  if (datesToInsert.length) {
    const rows = datesToInsert.map((workDate) => {
      const isoWeek = getIsoYearAndWeekFromDateString(workDate);
      return {
        profile_id: profileId,
        work_date: workDate,
        year: isoWeek.year,
        kw: isoWeek.kw,
        project_name: 'Berufsschule',
        commission_number: 'Berufsschule',
        abz_typ: 7,
        start_time: '07:00',
        end_time: '16:30',
        lunch_break_minutes: 60,
        additional_break_minutes: 30,
        total_work_minutes: 480,
        total_adjusted_work_minutes: 480,
        expenses_amount: 0,
        other_costs_amount: 0,
        expense_note: '',
        notes: SCHOOL_REPORT_NOTE_MARKER,
        controll: '',
        attachments: [],
      };
    });
    if (state.isDemoMode) {
      rows.forEach((row) => demoWeeklyReports.push({ id: crypto.randomUUID(), ...row }));
    } else {
      const { error } = await state.supabase.from('weekly_reports').insert(rows);
      if (error) throw error;
    }
  }

  if (reportsToDeleteIds.length) {
    if (state.isDemoMode) {
      for (const reportId of reportsToDeleteIds) {
        const index = demoWeeklyReports.findIndex((item) => String(item.id) === String(reportId));
        if (index >= 0) demoWeeklyReports.splice(index, 1);
      }
    } else {
      const { error } = await state.supabase.from('weekly_reports').delete().in('id', reportsToDeleteIds);
      if (error) throw error;
    }
  }
}

async function synchronizeBlockDayReportsForYear(profileId, year) {
  let profileReports = [];
  if (state.isDemoMode) {
    profileReports = demoWeeklyReports.filter((report) => report.profile_id === profileId && Number(getIsoYearAndWeekFromDateString(report.work_date).year) === year);
  } else {
    const { data, error } = await state.supabase
      .from('weekly_reports')
      .select('*')
      .eq('profile_id', profileId)
      .eq('year', year);
    if (error) throw error;
    profileReports = data || [];
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const idsToDelete = profileReports
    .filter((report) => report.work_date >= todayIso && isAutoBlockDayReport(report))
    .map((report) => report.id);
  if (idsToDelete.length) {
    if (state.isDemoMode) {
      for (const reportId of idsToDelete) {
        const index = demoWeeklyReports.findIndex((item) => String(item.id) === String(reportId));
        if (index >= 0) demoWeeklyReports.splice(index, 1);
      }
    } else {
      const { error } = await state.supabase.from('weekly_reports').delete().in('id', idsToDelete);
      if (error) throw error;
    }
  }
}

function getBlockDayModeFromReport(report) {
  const match = String(report?.notes || '').match(/\((full|am|pm)\)/);
  if (match?.[1]) return match[1];
  const startTime = String(report?.start_time || '').slice(0, 5);
  if (startTime === '07:00' && String(report?.end_time || '').slice(0, 5) === '12:00') return 'am';
  if (startTime === '13:00') return 'pm';
  return 'full';
}

function isAutoBlockDayReport(report) {
  return Number(report?.abz_typ) === BLOCK_DAY_TYPE_CODE && String(report?.notes || '').includes(BLOCK_DAY_REPORT_NOTE_MARKER);
}

function isAutoSchoolReport(report) {
  return Number(report?.abz_typ) === 7 && String(report?.notes || '').includes(SCHOOL_REPORT_NOTE_MARKER);
}

function isSchoolReport(report) {
  if (isAutoSchoolReport(report)) return true;
  if (Number(report?.abz_typ) === 7) return true;
  const projectName = String(report?.project_name || '').toLowerCase();
  const commissionNumber = String(report?.commission_number || '').toLowerCase();
  return projectName.includes('berufsschule') || commissionNumber.includes('berufsschule');
}

function hasUkToken(value) {
  const normalized = String(value || '').toLowerCase();
  return /(^|[^a-z0-9])(ük|uek|uk)([^a-z0-9]|$)/.test(normalized);
}

function isUkReport(report) {
  if (Number(report?.abz_typ) === 6) return true;
  const projectName = String(report?.project_name || '');
  const commissionNumber = String(report?.commission_number || '');
  return hasUkToken(projectName) || hasUkToken(commissionNumber);
}

function isSchoolOrUkReport(report) {
  return isSchoolReport(report) || isUkReport(report);
}

function isDateInSchoolVacation(date) {
  return state.schoolVacations.some((range) => date >= String(range.start_date || '') && date <= String(range.end_date || ''));
}

function updateDemoReport(reportId, updates) {
  const report = demoWeeklyReports.find((item) => item.id === reportId);
  if (!report) {
    throw new Error('Demo-Rapport nicht gefunden');
  }

  Object.assign(report, updates);
}

function updateDemoHolidayRequest(requestId, updates) {
  const request = demoHolidayRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error('Demo-Absenz nicht gefunden');
  }

  Object.assign(request, updates);
}

function deleteDemoHolidayRequest(requestId) {
  const requestIndex = demoHolidayRequests.findIndex((item) => item.id === requestId);
  if (requestIndex === -1) {
    throw new Error('Demo-Absenz nicht gefunden');
  }

  demoHolidayRequests.splice(requestIndex, 1);
}

function archiveDemoHolidayRequestDecision(request, context) {
  if (!request) {
    throw new Error('Demo-Absenz nicht gefunden');
  }

  demoRequestHistory.unshift({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    profile_id: request.profile_id,
    request: buildHolidayRequestArchiveSummary(request),
    context,
  });
}

function extractFirstName(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const [firstName] = normalizedValue.split(/\s+/);
  return firstName || '';
}

function getControllDisplayName() {
  const fullName = String(state.currentProfile?.full_name || '').trim();
  if (fullName) {
    return fullName;
  }

  const userMetadataName = String(state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || '').trim();
  if (userMetadataName) {
    return userMetadataName;
  }

  const emailName = String(state.user?.email || '').trim().split('@')[0];
  return extractFirstName(emailName);
}

function getApprovalDisplayName() {
  const fullName = String(state.currentProfile?.full_name || '').trim();
  if (fullName) {
    return fullName;
  }

  const userMetadataName = String(state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || '').trim();
  if (userMetadataName) {
    return userMetadataName;
  }

  return String(state.user?.email || '').trim().split('@')[0];
}

function buildHolidayRequestArchiveSummary(request) {
  if (!request) {
    return 'Absenzantrag';
  }

  const parts = [
    getAbsenceTypeLabel(request, request.request_type ?? 'Absenzantrag'),
    request.start_date && request.end_date ? `${formatDate(request.start_date)} bis ${formatDate(request.end_date)}` : '',
    String(request.notes || '').trim(),
  ].filter(Boolean);

  return parts.join(' | ');
}

function buildApprovedHolidayRequestContext(request) {
  const plLabel = String(request?.controll_pl || '').trim() || '–';
  const glLabel = String(request?.controll_gl || '').trim() || '–';
  return `Bestätigt durch PL: ${plLabel} | GL: ${glLabel}`;
}

function buildRejectedHolidayRequestContext() {
  return 'Abgelehnt und aus der aktuellen Liste entfernt';
}

function isMissingRpcFunctionError(error, functionName) {
  const message = String(error?.message || '');
  return error?.code === 'PGRST202' || message.includes(`Could not find the function public.${functionName}`);
}

function isMissingTableError(error, tableName) {
  const message = String(error?.message || '').toLowerCase();
  const normalizedTable = String(tableName || '').toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    message.includes(`could not find the table 'public.${normalizedTable}' in the schema cache`) ||
    message.includes(`could not find the table '${normalizedTable}' in the schema cache`)
  );
}

async function insertHolidayRequestHistoryEntry(request, context) {
  const { error } = await state.supabase.from('request_history').insert({
    profile_id: request.profile_id,
    request: buildHolidayRequestArchiveSummary(request),
    context,
  });

  if (error) {
    throw error;
  }
}

async function approveHolidayRequestWithoutRpc(request, fieldName, approvalName) {
  const updatePayload = { [fieldName]: approvalName };
  if (isHolidayRequestFullyApproved({ ...request, ...updatePayload })) {
    updatePayload.approval_status = 2;
  }
  const { data: updatedRequest, error: updateError } = await state.supabase
    .from('holiday_requests')
    .update(updatePayload)
    .eq('id', request.id)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  return updatedRequest;
}

async function rejectHolidayRequestWithoutRpc(request) {
  const { error } = await state.supabase
    .from('holiday_requests')
    .update({ approval_status: 0 })
    .eq('id', request.id);

  if (error) {
    throw error;
  }
}

function renderControllCell(report) {
  const controllValue = String(report.controll || '').trim();
  const isControlled = Boolean(controllValue);
  const titleText = isControlled ? `Kontrolliert von ${controllValue}` : 'Rapport kontrollieren';
  const ariaLabel = isControlled ? titleText : 'Rapport kontrollieren';

  return `
    <label class="control-checkbox-button ${isControlled ? 'is-controlled' : ''}" data-action="confirm-report" data-report-id="${escapeAttribute(report.id)}" title="${escapeAttribute(titleText)}">
      <input type="checkbox" ${isControlled ? 'checked' : ''} ${state.isSavingReport || isControlled ? 'disabled' : ''} aria-label="${escapeAttribute(ariaLabel)}" />
    </label>
  `;
}

function renderHolidayApprovalCell(request, fieldName, roleLabel) {
  const approvalValue = String(request?.[fieldName] || '').trim();
  const isApproved = Boolean(approvalValue);
  const titleText = isApproved ? `${roleLabel} bestätigt von ${approvalValue}` : roleLabel;
  const ariaLabel = isApproved ? titleText : roleLabel;

  return `
    <label class="control-checkbox-button ${isApproved ? 'is-controlled' : ''}" data-action="confirm-absence-${escapeAttribute(roleLabel.toLowerCase())}" data-request-id="${escapeAttribute(request.id)}" title="${escapeAttribute(titleText)}">
      <input type="checkbox" ${isApproved ? 'checked' : ''} ${state.isSavingAbsence || isApproved ? 'disabled' : ''} aria-label="${escapeAttribute(ariaLabel)}" />
    </label>
  `;
}

function renderHolidayRejectCell(request) {
  const rejectButton = isHolidayRequestFullyApproved(request)
    ? ''
    : `<button class="button button-small button-danger absence-icon-button" type="button" data-action="reject-absence-request" data-request-id="${escapeAttribute(request.id)}" title="Absenzgesuch ablehnen" aria-label="Absenzgesuch ablehnen" ${state.isSavingAbsence ? 'disabled' : ''}>${renderIconButtonContent('x', 'Absenzgesuch ablehnen')}</button>`;
  const absenceInfoButton = shouldShowAbsenceInfoButton(request)
    ? renderAbsenceInfoButton(request)
    : '';

  return `
    <div class="absence-action-buttons">
      ${absenceInfoButton}
      ${rejectButton || '<span class="subtle-text">—</span>'}
    </div>
  `;
}

function shouldShowAbsenceInfoButton(request) {
  return isVacationRequest(request) || isPartialIllnessOrAccidentRequest(request);
}

function renderAbsenceInfoButton(request) {
  const isPartialAbsence = isPartialIllnessOrAccidentRequest(request);
  const label = isPartialAbsence ? 'Teilzeitabwesenheit anzeigen' : 'Rapportierte Stunden anzeigen';
  const iconName = isPartialAbsence ? 'clock-3' : 'info';
  return `<button class="button button-small button-secondary absence-icon-button" type="button" data-action="show-absence-info" data-request-id="${escapeAttribute(request.id)}" title="${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}">${renderIconButtonContent(iconName, label)}</button>`;
}

function isVacationRequest(request) {
  return Number(getAbsenceTypeCode(request)) === 1;
}

function renderHolidayConfirmationCell(request) {
  if (!isHolidayRequestFullyApproved(request)) {
    const hasAnyApproval = Boolean(String(request?.controll_pl || '').trim() || String(request?.controll_gl || '').trim());
    if (hasAnyApproval) {
      return `
        <div class="status-stack compact">
          <span class="subtle-text">PDF verfügbar nach PL- und GL-Bestätigung</span>
          <button class="button button-small button-danger button-icon-only" type="button" data-action="reject-absence-request" data-request-id="${escapeAttribute(request.id)}" title="Gesuch ablehnen/löschen" aria-label="Gesuch ablehnen/löschen" ${state.isSavingAbsence ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Gesuch ablehnen/löschen')}</button>
        </div>
      `;
    }

    return `<button class="button button-small button-danger button-icon-only" type="button" data-action="reject-absence-request" data-request-id="${escapeAttribute(request.id)}" title="Gesuch ablehnen/löschen" aria-label="Gesuch ablehnen/löschen" ${state.isSavingAbsence ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Gesuch ablehnen/löschen')}</button>`;
  }

  return `<button class="button button-small button-secondary button-icon-only" type="button" data-action="download-absence-confirmation" data-request-id="${escapeAttribute(request.id)}" title="PDF herunterladen" aria-label="PDF herunterladen">${renderIconButtonContent('file-down', 'PDF herunterladen')}</button>`;
}

function openReportsColumnFilter(type) {
  if (!elements.reportsColumnFilterPopover) return;
  const reports = [...state.weeklyReports];
  let content = '';
  if (type === 'employee') {
    const options = getReportableProfiles().map((p) => ({ value: p.id, label: p.full_name || 'Unbekannt' }));
    content = buildMultiFilterMarkup(type, options, 'Mitarbeiter filtern');
  } else if (type === 'commission') {
    const values = getOpenCommissionFilterOptions(reports);
    content = buildMultiFilterMarkup(type, values.map((v) => ({ value: v, label: v })), 'Kommission filtern');
  } else if (type === 'expenses' || type === 'attachments') {
    const checked = state.reportColumnFilter.type === type;
    const label = type === 'expenses' ? 'Nur Rapporte mit Spesen anzeigen' : 'Nur Rapporte mit Anhängen anzeigen';
    content = `<strong>${label}</strong><label class="employee-filter-option"><input type="checkbox" id="singleFilterToggle" ${checked?'checked':''}/> <span>Aktivieren</span></label><button id="confirmColumnFilter" class="button button-primary" type="button">Bestätigen</button>`;
  }
  elements.reportsColumnFilterPopover.innerHTML = content;
  elements.reportsColumnFilterModal?.classList.remove('hidden');
  elements.reportsColumnFilterPopover.dataset.filterType = type;
  document.getElementById('confirmColumnFilter')?.addEventListener('click', applyColumnFilterFromPopover);
  document.getElementById('columnFilterSearchInput')?.addEventListener('input', handleColumnFilterSearchInput);
  document.getElementById('clearColumnFilterSelectionButton')?.addEventListener('click', clearColumnFilterSelection);
  renderLucideIcons();
}
function buildMultiFilterMarkup(type, options, title){
  return `<strong class="column-filter-title">${title}</strong><div class="column-filter-toolbar"><label class="column-filter-search-label"><input id="columnFilterSearchInput" type="search" placeholder="Kommission suchen" autocomplete="off" /></label><button id="clearColumnFilterSelectionButton" class="button button-secondary report-filter-icon-button" type="button" title="Alle abwählen" aria-label="Alle abwählen">${renderIconButtonContent('x', 'Alle abwählen')}</button></div><div class="column-filter-grid">${options.map((o)=>`<label class="column-filter-chip" data-filter-label="${escapeAttribute(String(o.label || '').toLowerCase())}"><input type="checkbox" value="${escapeAttribute(o.value)}" ${state.reportColumnFilter.type===type&&state.reportColumnFilter.values.includes(o.value)?'checked':''}/><span>${escapeHtml(o.label)}</span></label>`).join('')}</div><div class="column-filter-actions"><button id="confirmColumnFilter" class="button button-primary" type="button">Bestätigen</button></div>`;
}
function handleColumnFilterSearchInput(event) {
  const query = String(event?.target?.value || '').trim().toLowerCase();
  const chips = elements.reportsColumnFilterPopover?.querySelectorAll('.column-filter-chip') || [];
  chips.forEach((chip) => {
    const label = chip.dataset.filterLabel || '';
    chip.classList.toggle('hidden', Boolean(query) && !label.includes(query));
  });
}
function clearColumnFilterSelection() {
  const checkboxes = elements.reportsColumnFilterPopover?.querySelectorAll('.column-filter-chip input[type="checkbox"]') || [];
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
}
function applyColumnFilterFromPopover(){const t=elements.reportsColumnFilterPopover?.dataset.filterType;if(!t)return;let values=[];if(t==='expenses'||t==='attachments'){if(document.getElementById('singleFilterToggle')?.checked)values=['1'];}else{values=Array.from(elements.reportsColumnFilterPopover.querySelectorAll('input[type="checkbox"]:checked')).map((el)=>el.value);}state.reportColumnFilter={type:values.length?t:'none',values};state.reportsPage=1;elements.reportsColumnFilterModal?.classList.add('hidden');renderReportsTable();}
function handleGlobalColumnFilterDismiss(event){if(elements.reportsColumnFilterModal?.classList.contains('hidden')) return; if (elements.reportsColumnFilterPopover.contains(event.target) || event.target.closest('.modal-card')) return; if (event.target.closest('.report-column-filter-trigger')) return; if (event.target?.matches?.('[data-close-reports-filter-modal=\"true\"]')) { elements.reportsColumnFilterModal.classList.add('hidden'); return; } if (event.target === elements.reportsColumnFilterModal) elements.reportsColumnFilterModal.classList.add('hidden');}

function addDays(isoDate,days){const d=new Date(`${isoDate}T00:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
