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
  if (!state.holidayRequests.length) {
    elements.absencesTableBody.innerHTML = `<tr><td colspan="10">Keine Ferien- oder Absenzanträge gefunden.</td></tr>`;
    return;
  }

  const sorted = getFilteredHolidayRequests();
  if (!sorted.length) {
    elements.absencesTableBody.innerHTML = `<tr><td colspan="10">Keine Ferien- oder Absenzanträge gefunden.</td></tr>`;
    return;
  }

  elements.absencesTableBody.innerHTML = sorted
    .map((request) => {
      const profile = getProfileById(request.profile_id);
      return `
        <tr>
          <td>${escapeHtml(profile?.full_name ?? 'Unbekannt')}</td>
          <td>${escapeHtml(getAbsenceTypeLabel(request, request.request_type))}</td>
          <td>${escapeHtml(formatDateOnly(request.created_at))}</td>
          <td>${formatDate(request.start_date)}</td>
          <td>${formatDate(request.end_date)}</td>
          <td>${escapeHtml(request.notes || '–')}</td>
          <td>${renderAttachmentLinks(request.attachments)}</td>
          <td>${renderHolidayApprovalCell(request, 'controll_pl', 'PL')}</td>
          <td>${renderHolidayApprovalCell(request, 'controll_gl', 'GL')}</td>
          <td>${renderHolidayRejectCell(request)}</td>
        </tr>
      `;
    })
    .join('');
}


function renderConfirmationsModalState() {
  if (!elements.confirmationsModal) return;
  elements.confirmationsModal.classList.toggle('hidden', !state.isConfirmationsModalOpen);
}

function renderConfirmationsTable() {
  if (!elements.confirmationsTableBody) {
    return;
  }

  const approvedRequests = getHolidayRequestsByApprovalStatus(2);

  if (!approvedRequests.length) {
    elements.confirmationsTableBody.innerHTML = '<tr><td colspan="5">Keine bestätigten Absenzen vorhanden.</td></tr>';
    return;
  }

  elements.confirmationsTableBody.innerHTML = approvedRequests
    .map((request) => {
      const profile = getProfileById(request.profile_id);
      const personLabel = profile?.full_name || profile?.email || 'Unbekannt';
      return `
        <tr>
          <td>${escapeHtml(personLabel)}</td>
          <td>${escapeHtml(getAbsenceTypeLabel(request, request.request_type))}</td>
          <td>${escapeHtml(formatDateOnly(request.created_at))}</td>
          <td>${escapeHtml(formatDate(request.start_date))} bis ${escapeHtml(formatDate(request.end_date))}</td>
          <td>${escapeHtml(buildApprovalByLabel(request))}</td>
        </tr>
      `;
    })
    .join('');
}

function renderRejectedAbsencesModalState() {
  if (!elements.rejectedAbsencesModal) return;
  elements.rejectedAbsencesModal.classList.toggle('hidden', !state.isRejectedAbsencesModalOpen);
}

function renderRejectedAbsencesTable() {
  if (!elements.rejectedAbsencesTableBody) return;
  const rejectedRequests = getHolidayRequestsByApprovalStatus(0);
  if (!rejectedRequests.length) {
    elements.rejectedAbsencesTableBody.innerHTML = '<tr><td colspan="5">Keine abgelehnten Absenzen vorhanden.</td></tr>';
    return;
  }
  elements.rejectedAbsencesTableBody.innerHTML = rejectedRequests
    .map((request) => {
      const profile = getProfileById(request.profile_id);
      const personLabel = profile?.full_name || profile?.email || 'Unbekannt';
      return `
        <tr>
          <td>${escapeHtml(personLabel)}</td>
          <td>${escapeHtml(getAbsenceTypeLabel(request, request.request_type))}</td>
          <td>${escapeHtml(formatDateOnly(request.created_at))}</td>
          <td>${escapeHtml(formatDate(request.start_date))}</td>
          <td>${escapeHtml(formatDate(request.end_date))}</td>
        </tr>
      `;
    })
    .join('');
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

  if (trigger.dataset.action === 'reject-absence-request') {
    handleRejectHolidayRequest(requestId);
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
