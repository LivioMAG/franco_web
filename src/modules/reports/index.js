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
    closeAdjustedMinutesModal();
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
    closeAdjustedMinutesModal();
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
  if (elements.showControlledReportsInput) elements.showControlledReportsInput.checked = state.showControlledReports;
  if (elements.reportsSortSelect) elements.reportsSortSelect.value = state.reportsSortMode;
  if (elements.showControlledReportsToggle) elements.showControlledReportsToggle.classList.toggle('is-active', state.showControlledReports);
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


function handleShowControlledReportsToggle() {
  state.showControlledReports = Boolean(elements.showControlledReportsInput?.checked);
  state.reportsPage = 1;
  renderReportsTable();
}

function handleReportsSortChange(event) {
  state.reportsSortMode = event.target?.value || 'date_desc';
  state.reportsPage = 1;
  renderReportsTable();
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

  return {
    typeLabel,
    periodLabel: periodMatch || '–',
    approvedByLabel: buildHistoryApprovedByLabel(entry),
  };
}

function buildHistoryApprovedByLabel(entry) {
  const contextValue = String(entry?.context || '').trim();
  if (!contextValue) {
    return '–';
  }

  const plMatch = contextValue.match(/PL:\s*([^|]+)/i);
  const glMatch = contextValue.match(/GL:\s*([^|]+)/i);
  const names = [plMatch?.[1], glMatch?.[1]]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== '–');

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

function openReportEditModal(reportId) {
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    return;
  }

  const profile = getProfileById(report.profile_id);
  state.editingReportId = report.id;
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
  state.editingReportPauseMinutes = 0;
  if (!elements.reportEditModal || !elements.reportEditForm) {
    return;
  }

  elements.reportEditModal.classList.add('hidden');
  elements.editStartTime.disabled = false;
  elements.editEndTime.disabled = false;
  elements.reportEditForm.reset();
  if (elements.reportEditAttachments) {
    elements.reportEditAttachments.innerHTML = '';
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
  if (!state.editingReportId || state.isSavingReport) {
    return;
  }

  const reportId = state.editingReportId;
  const existingReport = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!existingReport) {
    closeReportEditModal();
    return;
  }
  syncEditedWorkMinutesWithTimeRange();
  const totalWorkMinutes = Math.max(0, Number(elements.editTotalMinutes.value || 0));
  const pauseMinutes = Math.max(0, Number(elements.editPauseMinutes.value || 0));
  const baseAdjustedMinutes = shouldApplyHolidayDoubleMinutes(existingReport)
    ? Math.round(totalWorkMinutes / 2)
    : totalWorkMinutes;
  const updates = {
    work_date: elements.editWorkDate.value,
    ...getIsoYearAndWeekFromDateString(elements.editWorkDate.value),
    commission_number: elements.editCommissionNumber.value.trim(),
    start_time: elements.editStartTime.disabled ? (existingReport.start_time || '00:00:00') : elements.editStartTime.value,
    end_time: elements.editEndTime.disabled ? (existingReport.end_time || '00:00:00') : elements.editEndTime.value,
    lunch_break_minutes: pauseMinutes,
    additional_break_minutes: 0,
    total_work_minutes: totalWorkMinutes,
    ...buildAdjustedMinutesUpdatePayload(existingReport, baseAdjustedMinutes),
    expenses_amount: Number(elements.editExpensesAmount.value || 0),
    other_costs_amount: Number(elements.editOtherCostsAmount.value || 0),
    notes: elements.editNotes.value.trim(),
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
    closeReportEditModal();
  } catch (error) {
    console.error(error);
    alert(`Rapport konnte nicht aktualisiert werden: ${error.message}`);
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
  const absenceInfoButton = isVacationRequest(request)
    ? `<button class="button button-small button-secondary absence-icon-button" type="button" data-action="show-absence-info" data-request-id="${escapeAttribute(request.id)}" title="Rapportierte Stunden anzeigen" aria-label="Rapportierte Stunden anzeigen">${renderIconButtonContent('info', 'Rapportierte Stunden anzeigen')}</button>`
    : '';

  return `
    <div class="absence-action-buttons">
      ${absenceInfoButton}
      ${rejectButton || '<span class="subtle-text">—</span>'}
    </div>
  `;
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
    const values = [...new Set(reports.map((r) => String(r.commission_number || '')).filter(Boolean))].sort();
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
