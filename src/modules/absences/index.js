function renderAbsenceFilters() {
  if (!elements.absenceFilterInput || !elements.absenceFilterList || !elements.selectedAbsenceEmployeesSummary) {
    return;
  }
  elements.absenceFilterInput.value = state.absenceFilterQuery;
  if (elements.showControlledAbsencesInput) {
    elements.showControlledAbsencesInput.checked = state.showControlledAbsences;
  }
  const profiles = getAbsenceFilterProfiles();
  const visibleProfiles = getMatchingProfiles(profiles, state.absenceFilterQuery).slice(0, MAX_VISIBLE_FILTER_OPTIONS);

  elements.selectedAbsenceEmployeesSummary.textContent = `${state.selectedAbsenceEmployeeIds.length} von ${profiles.length} Mitarbeitenden ausgewählt`;

  if (!profiles.length) {
    elements.absenceFilterList.innerHTML = '<div class="empty-state">Keine Mitarbeitenden vorhanden.</div>';
    return;
  }

  elements.absenceFilterList.innerHTML = visibleProfiles.length
    ? visibleProfiles
        .map((profile) => `
          <label class="employee-filter-option">
            <input type="checkbox" value="${escapeAttribute(profile.id)}" ${state.selectedAbsenceEmployeeIds.includes(profile.id) ? 'checked' : ''} />
            <span>${escapeHtml(profile.full_name)}</span>
          </label>
        `)
        .join('')
    : '<div class="empty-state">Keine Mitarbeitenden für diesen Suchbegriff gefunden.</div>';
}

function renderAbsenceTable() {
  if (!elements.absencesTableBody) {
    return;
  }

  renderAbsencesViewState();

  const rows = state.showPastAbsences ? getPastHolidayRequests() : getFilteredHolidayRequests();
  const emptyLabel = state.showPastAbsences
    ? 'Keine vergangenen Ferien- oder Absenzanträge gefunden.'
    : 'Keine Ferien- oder Absenzanträge gefunden.';

  if (!rows.length) {
    elements.absencesTableBody.innerHTML = `<tr><td colspan="10">${emptyLabel}</td></tr>`;
    renderLucideIcons();
    return;
  }

  elements.absencesTableBody.innerHTML = rows
    .map((request) => renderAbsenceTableRow(request))
    .join('');
  renderLucideIcons();
}

function renderAbsencesViewState() {
  const isPastView = Boolean(state.showPastAbsences);
  if (elements.absencesPanelTitle) {
    elements.absencesPanelTitle.textContent = isPastView
      ? 'Vergangene Ferien- und Absenzanträge'
      : 'Ferien- und Absenzanträge';
  }
  if (elements.togglePastAbsencesButton) {
    elements.togglePastAbsencesButton.innerHTML = isPastView
      ? renderIconButtonContent('calendar-clock', 'Aktuelle Absenzen')
      : renderIconButtonContent('history', 'Vergangene Absenzen');
    const title = isPastView
      ? 'Aktuelle Ferien- und Absenzanträge anzeigen'
      : 'Vergangene Ferien- und Absenzanträge anzeigen';
    elements.togglePastAbsencesButton.setAttribute('aria-label', title);
    elements.togglePastAbsencesButton.setAttribute('title', title);
  }
}

function renderAbsenceTableRow(request) {
  const profile = getProfileById(request.profile_id);
  const isRejectedPastRequest = state.showPastAbsences && getHolidayRequestApprovalStatus(request) === 0;
  const rejectedTextClass = isRejectedPastRequest ? ' class="absence-rejected-text"' : '';
  return `
    <tr${isRejectedPastRequest ? ' class="absence-row-rejected"' : ''}>
      <td${rejectedTextClass}>${escapeHtml(profile?.full_name ?? 'Unbekannt')}</td>
      <td${rejectedTextClass}>${escapeHtml(getAbsenceTypeLabel(request, request.request_type))}</td>
      <td${rejectedTextClass}>${escapeHtml(formatDateOnly(request.created_at))}</td>
      <td${rejectedTextClass}>${formatDate(request.start_date)}</td>
      <td${rejectedTextClass}>${formatDate(request.end_date)}</td>
      <td>${escapeHtml(request.notes || '–')}</td>
      <td>${renderAttachmentLinks(request.attachments)}</td>
      <td>${state.showPastAbsences ? escapeHtml(String(request.controll_pl || '').trim() || '–') : renderHolidayApprovalCell(request, 'controll_pl', 'PL')}</td>
      <td>${state.showPastAbsences ? escapeHtml(String(request.controll_gl || '').trim() || '–') : renderHolidayApprovalCell(request, 'controll_gl', 'GL')}</td>
      <td>${state.showPastAbsences ? renderPastHolidayActionsCell(request) : renderHolidayRejectCell(request)}</td>
    </tr>
  `;
}

function togglePastAbsencesView() {
  state.showPastAbsences = !state.showPastAbsences;
  renderAbsenceTable();
}

function getPastHolidayRequests() {
  const today = getTodayIsoDate();
  return [...state.holidayRequests]
    .filter((request) => {
      const status = getHolidayRequestApprovalStatus(request);
      return (status === 0 || status === 2) && String(request.end_date || '') < today;
    })
    .sort((a, b) => {
      const endCompare = String(b.end_date || '').localeCompare(String(a.end_date || ''));
      if (endCompare !== 0) return endCompare;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
}

function renderPastHolidayActionsCell(request) {
  return `
    <div class="absence-action-buttons">
      <button class="button button-small button-secondary button-icon-only" type="button" data-action="download-absence-confirmation" data-request-id="${escapeAttribute(request.id)}" title="PDF herunterladen" aria-label="PDF herunterladen">${renderIconButtonContent('file-down', 'PDF herunterladen')}</button>
      <button class="button button-small button-danger button-icon-only" type="button" data-action="delete-absence-request" data-request-id="${escapeAttribute(request.id)}" title="Absenz entfernen" aria-label="Absenz entfernen" ${state.isSavingAbsence ? 'disabled' : ''}>${renderIconButtonContent('trash-2', 'Absenz entfernen')}</button>
    </div>
  `;
}


function handleAbsenceFilterInput(event) {
  state.absenceFilterQuery = event.target.value;
  renderAbsenceFilters();
}

function handleShowControlledAbsencesToggle() {
  state.showControlledAbsences = Boolean(elements.showControlledAbsencesInput?.checked);
  renderAbsenceTable();
}

function handleAbsenceSelectionChange(event) {
  if (event.target?.type !== 'checkbox') {
    return;
  }

  const profileId = event.target.value;
  if (event.target.checked) {
    if (!state.selectedAbsenceEmployeeIds.includes(profileId)) {
      state.selectedAbsenceEmployeeIds = [...state.selectedAbsenceEmployeeIds, profileId];
    }
  } else {
    state.selectedAbsenceEmployeeIds = state.selectedAbsenceEmployeeIds.filter((id) => id !== profileId);
  }

  state.absenceSelectionInitialized = true;
  state.absenceSelectionTouched = true;
  render();
}


function selectAllAbsenceEmployees() {
  state.selectedAbsenceEmployeeIds = getAvailableAbsenceProfileIds();
  state.absenceSelectionInitialized = true;
  state.absenceSelectionTouched = true;
  render();
}

function clearAbsenceSelection() {
  state.selectedAbsenceEmployeeIds = [];
  state.absenceSelectionInitialized = true;
  state.absenceSelectionTouched = true;
  render();
}


function syncAbsenceSelection() {
  const validIds = getAvailableAbsenceProfileIds();
  const validIdSet = new Set(validIds);
  const selected = state.selectedAbsenceEmployeeIds.filter((id) => validIdSet.has(id));

  if (!state.absenceSelectionInitialized) {
    state.selectedAbsenceEmployeeIds = [...validIds];
    state.absenceSelectionInitialized = true;
    return;
  }

  if (!state.absenceSelectionTouched) {
    state.selectedAbsenceEmployeeIds = [...validIds];
    return;
  }

  state.selectedAbsenceEmployeeIds = validIds.length ? selected : [];
}

function getFilteredRequestHistory() {
  const today = getTodayIsoDate();
  return [...state.requestHistory]
    .filter((entry) => {
      if (state.includeConfirmationHistory) return true;
      const details = parseRequestHistoryEntry(entry);
      const period = parseHistoryPeriod(details.periodLabel);
      if (!period) return true;
      return period.endDate >= today;
    })
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function handleAbsencesTableClick(event) {
  if (event.target.closest('a')) {
    return;
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const requestId = trigger.dataset.requestId;
  if (!requestId) {
    return;
  }

  if (trigger.dataset.action === 'confirm-absence-pl') {
    handleConfirmHolidayRequest(requestId, 'controll_pl', 'PL');
    return;
  }

  if (trigger.dataset.action === 'confirm-absence-gl') {
    handleConfirmHolidayRequest(requestId, 'controll_gl', 'GL');
    return;
  }

  if (trigger.dataset.action === 'show-absence-info') {
    openAbsenceInfoModal(requestId);
    return;
  }

  if (trigger.dataset.action === 'reject-absence-request') {
    handleRejectHolidayRequest(requestId);
    return;
  }

  if (trigger.dataset.action === 'delete-absence-request') {
    handleDeleteHolidayRequest(requestId);
    return;
  }

  if (trigger.dataset.action === 'download-absence-confirmation') {
    exportHolidayConfirmationPdf(requestId);
  }
}

function handleConfirmationsTableClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const historyEntryId = trigger.dataset.historyEntryId;
  if (!historyEntryId) {
    return;
  }

  if (trigger.dataset.action === 'download-history-confirmation') {
    exportRequestHistoryPdf(historyEntryId);
    return;
  }

  if (trigger.dataset.action === 'delete-history-entry') {
    handleDeleteHistoryEntry(historyEntryId);
  }
}

function renderAbsenceInfoModalState() {
  if (!elements.absenceInfoModal || !elements.absenceInfoModalContent) return;
  elements.absenceInfoModal.classList.toggle('hidden', !state.isAbsenceInfoModalOpen);

  const summary = state.absenceInfoSummary;
  if (!state.isAbsenceInfoModalOpen) {
    return;
  }

  if (state.isAbsenceInfoLoading) {
    elements.absenceInfoModalContent.innerHTML = '<p class="subtle-text">Rapporte werden geladen …</p>';
    return;
  }

  if (state.absenceInfoError) {
    elements.absenceInfoModalContent.innerHTML = `<p class="alert">${escapeHtml(state.absenceInfoError)}</p>`;
    return;
  }

  if (!summary) {
    elements.absenceInfoModalContent.innerHTML = '<p class="subtle-text">Keine Auswertung ausgewählt.</p>';
    return;
  }

  const balanceClass = summary.remainingMinutes >= 0 ? 'positive' : 'negative';
  const balancePrefix = summary.remainingMinutes >= 0 ? '+' : '−';
  const pastRange = `01.01.${String(summary.year)} bis ${formatDate(summary.today)}`;
  const futureRange = `${formatDate(summary.futureStartDate)} bis 31.12.${String(summary.year)}`;

  elements.absenceInfoModalContent.innerHTML = `
    <section class="absence-invoice" aria-label="Berechnung rapportierte Absenzstunden">
      <header class="absence-invoice-person">
        <strong>${escapeHtml(summary.employeeName)}</strong>
        <span>${escapeHtml(summary.typeLabel)} · ${escapeHtml(String(summary.year))}</span>
      </header>

      <div class="absence-invoice-lines">
        <div class="absence-invoice-line allowance">
          <div>
            <span>Kontingent</span>
          </div>
          <strong>${escapeHtml(formatMinutes(summary.allowanceMinutes))}</strong>
        </div>

        <div class="absence-invoice-line deduction">
          <div>
            <span>Rapportierte Stunden</span>
            <small>${escapeHtml(pastRange)}</small>
          </div>
          <strong>− ${escapeHtml(formatMinutes(summary.pastMinutes))}</strong>
        </div>

        <div class="absence-invoice-line deduction">
          <div>
            <span>Zukünftige Stunden</span>
            <small>${escapeHtml(futureRange)}</small>
          </div>
          <strong>− ${escapeHtml(formatMinutes(summary.futureMinutes))}</strong>
        </div>

        <div class="absence-invoice-line result ${escapeAttribute(balanceClass)}">
          <div>
            <span>Ergebnis</span>
          </div>
          <strong>${escapeHtml(balancePrefix)} ${escapeHtml(formatMinutes(Math.abs(summary.remainingMinutes)))}</strong>
        </div>
      </div>
    </section>
  `;
}

function closeAbsenceInfoModal() {
  state.isAbsenceInfoModalOpen = false;
  state.absenceInfoRequestId = null;
  state.isAbsenceInfoLoading = false;
  state.absenceInfoError = '';
  renderAbsenceInfoModalState();
}

async function openAbsenceInfoModal(requestId) {
  const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
  if (!request) {
    alert('Das ausgewählte Absenzgesuch wurde nicht gefunden.');
    return;
  }

  state.isAbsenceInfoModalOpen = true;
  state.absenceInfoRequestId = requestId;
  state.isAbsenceInfoLoading = true;
  state.absenceInfoError = '';
  state.absenceInfoSummary = buildEmptyAbsenceInfoSummary(request);
  renderAbsenceInfoModalState();

  try {
    const reports = await fetchAbsenceInfoReports(request);
    if (String(state.absenceInfoRequestId) !== String(requestId)) {
      return;
    }
    state.absenceInfoSummary = buildAbsenceInfoSummary(request, reports);
  } catch (error) {
    console.error(error);
    state.absenceInfoError = `Rapportierte Stunden konnten nicht geladen werden: ${error.message}`;
  } finally {
    if (String(state.absenceInfoRequestId) === String(requestId)) {
      state.isAbsenceInfoLoading = false;
      renderAbsenceInfoModalState();
    }
  }
}

function buildEmptyAbsenceInfoSummary(request) {
  const today = getTodayIsoDate();
  const year = Number(today.slice(0, 4));
  const profile = getProfileById(request.profile_id);
  return {
    employeeName: profile?.full_name || profile?.email || 'Unbekannt',
    typeCode: getAbsenceTypeCode(request),
    typeLabel: getAbsenceTypeLabel(request, request.request_type),
    year,
    today,
    futureStartDate: getNextDateIsoDate(today),
    pastMinutes: 0,
    futureMinutes: 0,
    totalMinutes: 0,
    allowanceMinutes: getVacationAllowanceMinutes(profile),
    remainingMinutes: getVacationAllowanceMinutes(profile),
    reportCount: 0,
  };
}

function buildAbsenceInfoSummary(request, reports) {
  const summary = buildEmptyAbsenceInfoSummary(request);
  reports.forEach((report) => {
    const minutes = getBaseAdjustedWorkMinutes(report) || Number(report.total_work_minutes || 0) || 0;
    if (String(report.work_date || '') <= summary.today) {
      summary.pastMinutes += minutes;
    } else {
      summary.futureMinutes += minutes;
    }
  });
  summary.totalMinutes = summary.pastMinutes + summary.futureMinutes;
  summary.remainingMinutes = summary.allowanceMinutes - summary.totalMinutes;
  summary.reportCount = reports.length;
  return summary;
}

function getVacationAllowanceMinutes(profile) {
  const allowanceHours = Number(profile?.vacation_allowance_hours || 0);
  return Number.isFinite(allowanceHours) && allowanceHours > 0 ? allowanceHours * 60 : 0;
}

async function fetchAbsenceInfoReports(request) {
  const summary = buildEmptyAbsenceInfoSummary(request);
  if (!summary.typeCode) {
    return [];
  }

  const yearStart = `${summary.year}-01-01`;
  const yearEnd = `${summary.year}-12-31`;

  if (state.isDemoMode) {
    return demoWeeklyReports.filter((report) =>
      String(report.profile_id) === String(request.profile_id)
      && Number(getAbsenceTypeCode(report)) === Number(summary.typeCode)
      && String(report.work_date || '') >= yearStart
      && String(report.work_date || '') <= yearEnd
    );
  }

  const { data, error } = await state.supabase
    .from('weekly_reports')
    .select('id, profile_id, work_date, total_work_minutes, total_adjusted_work_minutes, abz_typ')
    .eq('profile_id', request.profile_id)
    .eq('abz_typ', summary.typeCode)
    .gte('work_date', yearStart)
    .lte('work_date', yearEnd)
    .order('work_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

function getNextDateIsoDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}


async function handleConfirmHolidayRequest(requestId, fieldName, roleLabel) {
  if (!requestId || state.isSavingAbsence) {
    return;
  }

  const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
  if (!request || String(request[fieldName] || '').trim()) {
    return;
  }

  const approvalName = getApprovalDisplayName();
  if (!approvalName) {
    alert(`Der Name für die Bestätigung ${roleLabel} konnte nicht ermittelt werden.`);
    return;
  }

  const previousApprovalValue = request[fieldName];
  request[fieldName] = approvalName;

  state.isSavingAbsence = true;
  renderAbsenceTable();

  try {
    await withLongTask('Absenzbestätigung wird verarbeitet …', async () => {
      const updates = { [fieldName]: approvalName };

      if (state.isDemoMode) {
        updateDemoHolidayRequest(requestId, updates);
        const updatedRequest = demoHolidayRequests.find((item) => String(item.id) === String(requestId));
        if (isHolidayRequestFullyApproved(updatedRequest)) {
          updateDemoHolidayRequest(requestId, { approval_status: 2 });
          await createAutoReportsForApprovedHolidayRequest(updatedRequest);
        }
      } else {
        let updatedRequest = request ? { ...request, ...updates } : null;
        const { error } = await state.supabase.rpc('approve_holiday_request', {
          p_request_id: requestId,
          p_field_name: fieldName,
          p_approval_name: approvalName,
        });

        if (error) {
          if (!request || !isMissingRpcFunctionError(error, 'approve_holiday_request')) {
            throw error;
          }

          updatedRequest = await approveHolidayRequestWithoutRpc(request, fieldName, approvalName);
        }

        if (request && isHolidayRequestFullyApproved(updatedRequest)) {
          await createAutoReportsForApprovedHolidayRequest(updatedRequest);
        }
      }

      await loadData();
    });
  } catch (error) {
    if (request) {
      request[fieldName] = previousApprovalValue;
    }
    console.error(error);
    alert(`Bestätigung ${roleLabel} konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingAbsence = false;
    render();
  }
}

async function handleRejectHolidayRequest(requestId) {
  if (!requestId || state.isSavingAbsence) {
    return;
  }

  const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
  if (!request) {
    alert('Das ausgewählte Absenzgesuch wurde nicht gefunden.');
    return;
  }

  const shouldReject = window.confirm('Soll dieses Absenzgesuch wirklich abgelehnt werden?');
  if (!shouldReject) {
    return;
  }

  state.isSavingAbsence = true;
  try {
    if (state.isDemoMode) {
      updateDemoHolidayRequest(requestId, { approval_status: 0 });
    } else {
      const { error } = await state.supabase.rpc('reject_holiday_request', {
        p_request_id: requestId,
      });

      if (error) {
        if (!isMissingRpcFunctionError(error, 'reject_holiday_request')) {
          throw error;
        }

        await rejectHolidayRequestWithoutRpc(request);
      }
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Absenzgesuch konnte nicht abgelehnt werden: ${error.message}`);
  } finally {
    state.isSavingAbsence = false;
    render();
  }
}


async function handleDeleteHolidayRequest(requestId) {
  if (!requestId || state.isSavingAbsence) {
    return;
  }

  const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
  if (!request) {
    alert('Das ausgewählte Absenzgesuch wurde nicht gefunden.');
    return;
  }

  const shouldDelete = window.confirm('Soll dieses vergangene Absenzgesuch wirklich entfernt werden?');
  if (!shouldDelete) {
    return;
  }

  state.isSavingAbsence = true;
  try {
    if (state.isDemoMode) {
      deleteDemoHolidayRequest(requestId);
    } else {
      const { error } = await state.supabase.from('holiday_requests').delete().eq('id', requestId);
      if (error) {
        throw error;
      }
      await deleteHolidayRequestAttachmentsSafely(request.attachments);
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Absenzgesuch konnte nicht entfernt werden: ${error.message}`);
  } finally {
    state.isSavingAbsence = false;
    render();
  }
}
