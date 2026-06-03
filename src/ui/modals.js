function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }
  if (elements.adjustedMinutesModal && !elements.adjustedMinutesModal.classList.contains('hidden')) {
    closeAdjustedMinutesModal();
    return;
  }
  if (elements.dispoAssignModal && !elements.dispoAssignModal.classList.contains('hidden')) {
    closeDispoAssignModal();
    return;
  }
  if (elements.projectModal && !elements.projectModal.classList.contains('hidden')) {
    closeProjectModal();
    return;
  }
  if (elements.absenceControlModal && !elements.absenceControlModal.classList.contains('hidden')) {
    closeAbsenceControlModal();
    return;
  }
  if (elements.holidayControlModal && !elements.holidayControlModal.classList.contains('hidden')) {
    closeHolidayControlModal();
    return;
  }
  if (elements.bulkConfirmModal && !elements.bulkConfirmModal.classList.contains('hidden')) {
    closeBulkConfirmModal();
    return;
  }
  if (elements.specialReportEditModal && !elements.specialReportEditModal.classList.contains('hidden')) {
    closeSpecialReportEditModal();
    return;
  }
  if (!elements.reportEditModal.classList.contains('hidden')) {
    closeReportEditModal();
  }
}

function getProjectLeadProjects() {
  const currentProfileId = String(state.currentProfile?.id || '');
  if (!currentProfileId) {
    return [];
  }
  return state.projects
    .filter((project) => String(project.project_lead_profile_id || '') === currentProfileId)
    .sort((left, right) => `${left.commission_number || ''} ${left.name || ''}`.localeCompare(`${right.commission_number || ''} ${right.name || ''}`, 'de'));
}

function getBulkConfirmFilteredReports({ onlyOpenReports = false } = {}) {
  const leadProjects = getProjectLeadProjects();
  const allowedCommissionNumbers = new Set(
    leadProjects.map((project) => String(project.commission_number || '').trim()).filter(Boolean),
  );
  const selectedWeekRange = getWeekRange(state.selectedWeek);
  const commissionFilter = String(state.bulkConfirmCommissionFilter || '').trim().toLowerCase();
  return state.weeklyReports.filter((report) => {
    const reportDate = String(report.work_date || '').trim();
    if (!reportDate || reportDate < selectedWeekRange.start || reportDate > selectedWeekRange.end) return false;
    const reportCommission = String(report.commission_number || '').trim();
    if (!allowedCommissionNumbers.has(reportCommission)) return false;
    if (commissionFilter && !reportCommission.toLowerCase().includes(commissionFilter)) return false;
    if (state.bulkConfirmWeekdayFilter && String(getIsoWeekdayFromDate(report.work_date)) !== String(state.bulkConfirmWeekdayFilter)) return false;
    if (onlyOpenReports && String(report.controll || '').trim()) return false;
    return true;
  });
}

function openBulkConfirmModal() {
  const leadProjects = getProjectLeadProjects();
  if (!leadProjects.length) {
    alert('Für dein Profil sind keine Projekte als Projektleiter hinterlegt.');
    return;
  }
  state.isBulkConfirmModalOpen = true;
  state.bulkConfirmResultMessage = '';
  state.bulkConfirmResultIsError = false;
  render();
}

function closeBulkConfirmModal() {
  state.isBulkConfirmModalOpen = false;
  state.isBulkConfirmSaving = false;
  state.bulkConfirmResultMessage = '';
  state.bulkConfirmResultIsError = false;
  renderBulkConfirmModalState();
}

function openMissingReportsCallModal() {
  const missingProfiles = getIncompleteSubmissionProfiles();
  if (!missingProfiles.length) {
    alert('Es gibt keine fehlenden oder unvollständigen Rapporte für die aktuelle Auswahl.');
    return;
  }
  state.isMissingReportsCallModalOpen = true;
  state.missingReportsCallResultMessage = '';
  state.missingReportsCallResultIsError = false;
  renderMissingReportsCallModalState();
}

function closeMissingReportsCallModal() {
  state.isMissingReportsCallModalOpen = false;
  state.isMissingReportsCallSubmitting = false;
  state.missingReportsCallResultMessage = '';
  state.missingReportsCallResultIsError = false;
  renderMissingReportsCallModalState();
}

function renderMissingReportsCallModalState() {
  if (!elements.missingReportsCallModal) {
    return;
  }

  elements.missingReportsCallModal.classList.toggle('hidden', !state.isMissingReportsCallModalOpen);
  if (elements.submitMissingReportsCallButton) {
    elements.submitMissingReportsCallButton.disabled = state.isMissingReportsCallSubmitting;
    elements.submitMissingReportsCallButton.textContent = state.isMissingReportsCallSubmitting ? 'Sende …' : 'Jawohl, delegieren';
  }
  if (elements.missingReportsCallResult) {
    elements.missingReportsCallResult.textContent = state.missingReportsCallResultMessage || '';
    elements.missingReportsCallResult.classList.toggle('bulk-confirm-error', Boolean(state.missingReportsCallResultIsError));
    elements.missingReportsCallResult.classList.toggle('bulk-confirm-success', Boolean(state.missingReportsCallResultMessage) && !state.missingReportsCallResultIsError);
  }
}

function handleBulkConfirmSearch() {
  state.bulkConfirmCommissionFilter = String(elements.bulkConfirmCommissionInput?.value || '').trim();
  state.bulkConfirmWeekdayFilter = String(elements.bulkConfirmWeekdaySelect?.value || '').trim();
  state.bulkConfirmResultMessage = '';
  state.bulkConfirmResultIsError = false;
  renderBulkConfirmModalState();
  handleBulkConfirmSubmit();
}

function getIsoWeekdayFromDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function renderBulkConfirmModalState() {
  if (!elements.bulkConfirmModal) {
    return;
  }

  elements.bulkConfirmModal.classList.toggle('hidden', !state.isBulkConfirmModalOpen);
  const leadProjects = getProjectLeadProjects();
  if (elements.bulkConfirmWeekdaySelect) {
    elements.bulkConfirmWeekdaySelect.value = state.bulkConfirmWeekdayFilter || '';
    elements.bulkConfirmWeekdaySelect.disabled = state.isBulkConfirmSaving;
  }
  if (elements.bulkConfirmCommissionInput) {
    elements.bulkConfirmCommissionInput.value = state.bulkConfirmCommissionFilter || '';
    elements.bulkConfirmCommissionInput.disabled = state.isBulkConfirmSaving;
  }
  if (elements.bulkConfirmSearchButton) {
    elements.bulkConfirmSearchButton.disabled = state.isBulkConfirmSaving || !leadProjects.length;
    elements.bulkConfirmSearchButton.textContent = state.isBulkConfirmSaving ? 'Bestätige …' : 'Suchen & bestätigen';
  }

  if (elements.bulkConfirmResultMessage) {
    elements.bulkConfirmResultMessage.textContent = state.bulkConfirmResultMessage || '';
    elements.bulkConfirmResultMessage.classList.toggle('bulk-confirm-error', Boolean(state.bulkConfirmResultIsError));
    elements.bulkConfirmResultMessage.classList.toggle('bulk-confirm-success', Boolean(state.bulkConfirmResultMessage) && !state.bulkConfirmResultIsError);
  }
}

function splitNameParts(fullName) {
  const normalized = String(fullName || '').trim();
  if (!normalized) {
    return { vorname: '', name: '' };
  }
  const [vorname, ...rest] = normalized.split(/\s+/);
  return { vorname: vorname || '', name: rest.join(' ') || '' };
}

function getMissingReportsCallPayload(entry, weekValue, delegatorPhone) {
  const profile = entry?.profile;
  const fullName = String(profile?.full_name || '').trim();
  const phone = resolveProfilePhoneNumber(profile);
  if (!phone) {
    return { error: fullName || profile?.email || 'Unbekannt' };
  }
  const names = splitNameParts(fullName);
  return {
    payload: {
      name: names.name || fullName,
      vorname: names.vorname,
      full_name: fullName,
      phone,
      week: weekValue,
      delegator_phone: delegatorPhone,
    },
    fullName: fullName || 'Unbekannt',
  };
}

async function sendMissingReportsCallPayload(payload) {
  const response = await fetch(state.missingReportsCallWebhookUrl || DEFAULT_MISSING_REPORTS_CALL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function handleMissingListClick(event) {
  const callButton = event.target.closest('[data-action="call-missing-profile"]');
  if (!callButton) {
    return;
  }
  if (state.isMissingReportsCallSubmitting) {
    return;
  }

  const profileId = String(callButton.dataset.profileId || '').trim();
  const weekValue = String(state.selectedWeek || getCurrentWeekValue() || '').trim();
  const delegatorPhone = resolveProfilePhoneNumber(state.currentProfile);
  if (!weekValue) return;
  if (!delegatorPhone) {
    alert('In deinem Profil ist keine Telefonnummer hinterlegt.');
    return;
  }

  const entry = getIncompleteSubmissionProfiles().find((item) => String(item.profile?.id || '') === profileId);
  if (!entry) {
    alert('Die ausgewählte Person hat aktuell keinen fehlenden/unvollständigen Rapport.');
    return;
  }

  const callInfo = getMissingReportsCallPayload(entry, weekValue, delegatorPhone);
  if (callInfo.error) {
    alert(`Kein Telefon hinterlegt bei: ${callInfo.error}.`);
    return;
  }

  callButton.disabled = true;
  try {
    await sendMissingReportsCallPayload(callInfo.payload);
    alert(`Telefon-Webhook für ${callInfo.fullName} wurde gesendet.`);
  } catch (error) {
    alert(`Webhook für ${callInfo.fullName} fehlgeschlagen: ${error.message}`);
  } finally {
    callButton.disabled = false;
  }
}

function resolveProfilePhoneNumber(profile) {
  if (!profile) return '';
  return String(
    profile.phone
    || profile.mobile_phone
    || profile.mobile
    || profile.telephone
    || profile.tel
    || profile.phone_number
    || '',
  ).trim();
}

async function handleMissingReportsCallSubmit() {
  if (state.isMissingReportsCallSubmitting) {
    return;
  }

  const weekValue = String(state.selectedWeek || getCurrentWeekValue() || '').trim();
  const delegatorPhone = resolveProfilePhoneNumber(state.currentProfile);
  if (!weekValue) {
    state.missingReportsCallResultMessage = 'Bitte eine Kalenderwoche angeben.';
    state.missingReportsCallResultIsError = true;
    renderMissingReportsCallModalState();
    return;
  }
  if (!delegatorPhone) {
    state.missingReportsCallResultMessage = 'In deinem Profil ist keine Telefonnummer hinterlegt.';
    state.missingReportsCallResultIsError = true;
    renderMissingReportsCallModalState();
    return;
  }

  const entries = getIncompleteSubmissionProfiles();
  if (!entries.length) {
    state.missingReportsCallResultMessage = 'Keine fehlenden oder unvollständigen Rapporte gefunden.';
    state.missingReportsCallResultIsError = true;
    renderMissingReportsCallModalState();
    return;
  }

  const unreachableNames = [];
  const sendErrors = [];
  state.isMissingReportsCallSubmitting = true;
  state.missingReportsCallResultMessage = '';
  state.missingReportsCallResultIsError = false;
  renderMissingReportsCallModalState();

  for (const entry of entries) {
    const callInfo = getMissingReportsCallPayload(entry, weekValue, delegatorPhone);
    if (callInfo.error) {
      unreachableNames.push(callInfo.error);
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMissingReportsCallPayload(callInfo.payload);
    } catch (error) {
      sendErrors.push(`${callInfo.fullName} (${error.message})`);
    }
  }

  state.isMissingReportsCallSubmitting = false;
  const parts = [];
  const sentCount = entries.length - unreachableNames.length - sendErrors.length;
  parts.push(`${Math.max(0, sentCount)} Webhook(s) gesendet.`);
  if (unreachableNames.length) {
    parts.push(`Kein Telefon hinterlegt bei: ${unreachableNames.join(', ')}.`);
  }
  if (sendErrors.length) {
    parts.push(`Fehler bei: ${sendErrors.join(', ')}.`);
  }
  state.missingReportsCallResultMessage = parts.join(' ');
  state.missingReportsCallResultIsError = Boolean(unreachableNames.length || sendErrors.length);
  renderMissingReportsCallModalState();
}

async function exportFilteredConfirmationsPdf() {
  const entries = getFilteredRequestHistory();
  if (!entries.length) {
    alert('Keine bestätigten Absenzen für den aktuellen Filter vorhanden.');
    return;
  }
  for (const entry of entries) {
    // eslint-disable-next-line no-await-in-loop
    await exportRequestHistoryPdf(entry.id, true);
  }
}
