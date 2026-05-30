document.addEventListener('DOMContentLoaded', init);
async function init() {
  cacheElements();
  populateHolidayImportYearOptions();
  bindEvents();
  elements.weekPicker.value = state.selectedWeek;
  if (elements.adminSqlPreview) {
    elements.adminSqlPreview.textContent = ADMIN_SQL_SNIPPET;
  }

  await initializeSupabase();
  await bootstrapSession();
  render();
}

function populateHolidayImportYearOptions() {
  if (!elements.holidayImportYearInput) return;
  const years = [...HOLIDAY_IMPORT_YEARS].sort((left, right) => Number(left) - Number(right));
  const selectedValue = years.includes(elements.holidayImportYearInput.value)
    ? elements.holidayImportYearInput.value
    : (years[0] || '');
  elements.holidayImportYearInput.innerHTML = years
    .map((year) => `<option value="${escapeAttribute(year)}">${escapeHtml(year)}</option>`)
    .join('');
  elements.holidayImportYearInput.value = selectedValue;
}

function cacheElements() {
  elements.loginView = document.getElementById('loginView');
  elements.appView = document.getElementById('appView');
  elements.accessDeniedView = document.getElementById('accessDeniedView');
  elements.accessDeniedLogoutButton = document.getElementById('accessDeniedLogoutButton');
  elements.loginForm = document.getElementById('loginForm');
  elements.emailInput = document.getElementById('emailInput');
  elements.passwordInput = document.getElementById('passwordInput');
  elements.loginAlert = document.getElementById('loginAlert');
  elements.userName = document.getElementById('userName');
  elements.userRole = document.getElementById('userRole');
  elements.userBadge = document.getElementById('userBadge');
  elements.weekPicker = document.getElementById('weekPicker');
  elements.weekLabel = document.getElementById('weekLabel');
  elements.weekDateRange = document.getElementById('weekDateRange');
  elements.previousWeekButton = document.getElementById('previousWeekButton');
  elements.nextWeekButton = document.getElementById('nextWeekButton');
  elements.exportPdfButton = document.getElementById('exportPdfButton');
  elements.exportPdfWithVisumButton = document.getElementById('exportPdfWithVisumButton');
  elements.reportStatusButton = document.getElementById('reportStatusButton');
  elements.reportStatusIcon = document.getElementById('reportStatusIcon');
  elements.reportStatusText = document.getElementById('reportStatusText');
  elements.logoutButton = document.getElementById('logoutButton');
  elements.reportsTableBody = document.getElementById('reportsTableBody');
  elements.absencesTableBody = document.getElementById('absencesTableBody');
  elements.absencesPanelTitle = document.getElementById('absencesPanelTitle');
  elements.missingReports = document.getElementById('missingReports');
  elements.submissionList = document.getElementById('submissionList');
  elements.missingList = document.getElementById('missingList');
  elements.reportsToolbarPlaceholderButton = document.getElementById('reportsToolbarPlaceholderButton');
  elements.showControlledReportsToggle = document.getElementById('showControlledReportsToggle');
  elements.showControlledReportsInput = document.getElementById('showControlledReportsInput');
  elements.reportsFilterEmployeeButton = document.getElementById('reportsFilterEmployeeButton');
  elements.reportsSortSelect = document.getElementById('reportsSortSelect');
  elements.reportsColumnFilterModal = document.getElementById('reportsColumnFilterModal');
  elements.reportsFilterCommissionButton = document.getElementById('reportsFilterCommissionButton');
  elements.reportsFilterExpensesButton = document.getElementById('reportsFilterExpensesButton');
  elements.reportsFilterAttachmentsButton = document.getElementById('reportsFilterAttachmentsButton');
  elements.reportsColumnFilterPopover = document.getElementById('reportsColumnFilterPopover');
  elements.selectedAbsenceEmployeesSummary = document.getElementById('selectedAbsenceEmployeesSummary');
  elements.absenceFilterInput = document.getElementById('absenceFilterInput');
  elements.absenceFilterList = document.getElementById('absenceFilterList');
  elements.selectAllAbsenceEmployeesButton = document.getElementById('selectAllAbsenceEmployeesButton');
  elements.clearAbsenceSelectionButton = document.getElementById('clearAbsenceSelectionButton');
  elements.showControlledAbsencesInput = document.getElementById('showControlledAbsencesInput');
  elements.togglePastAbsencesButton = document.getElementById('togglePastAbsencesButton');
  elements.absenceInfoModal = document.getElementById('absenceInfoModal');
  elements.absenceInfoModalContent = document.getElementById('absenceInfoModalContent');
  elements.closeAbsenceInfoModalButton = document.getElementById('closeAbsenceInfoModalButton');
  elements.bulkConfirmModal = document.getElementById('bulkConfirmModal');
  elements.closeBulkConfirmModalButton = document.getElementById('closeBulkConfirmModalButton');
  elements.bulkConfirmWeekdaySelect = document.getElementById('bulkConfirmWeekdaySelect');
  elements.bulkConfirmCommissionInput = document.getElementById('bulkConfirmCommissionInput');
  elements.bulkConfirmSearchButton = document.getElementById('bulkConfirmSearchButton');
  elements.bulkConfirmResultMessage = document.getElementById('bulkConfirmResultMessage');
  elements.openMissingReportsCallModalButton = document.getElementById('openMissingReportsCallModalButton');
  elements.missingReportsCallModal = document.getElementById('missingReportsCallModal');
  elements.closeMissingReportsCallModalButton = document.getElementById('closeMissingReportsCallModalButton');
  elements.cancelMissingReportsCallButton = document.getElementById('cancelMissingReportsCallButton');
  elements.submitMissingReportsCallButton = document.getElementById('submitMissingReportsCallButton');
  elements.missingReportsCallResult = document.getElementById('missingReportsCallResult');
  elements.reportsPrevPageButton = document.getElementById('reportsPrevPageButton');
  elements.reportsNextPageButton = document.getElementById('reportsNextPageButton');
  elements.reportsPaginationSummary = document.getElementById('reportsPaginationSummary');
  elements.reportEditModal = document.getElementById('reportEditModal');
  elements.reportEditForm = document.getElementById('reportEditForm');
  elements.closeReportEditModalButton = document.getElementById('closeReportEditModalButton');
  elements.cancelReportEditButton = document.getElementById('cancelReportEditButton');
  elements.editReportId = document.getElementById('editReportId');
  elements.editEmployeeName = document.getElementById('editEmployeeName');
  elements.editWorkDate = document.getElementById('editWorkDate');
  elements.editCommissionNumber = document.getElementById('editCommissionNumber');
  elements.editProjectName = document.getElementById('editProjectName');
  elements.editStartTime = document.getElementById('editStartTime');
  elements.editEndTime = document.getElementById('editEndTime');
  elements.editTotalMinutes = document.getElementById('editTotalMinutes');
  elements.editPauseMinutes = document.getElementById('editPauseMinutes');
  elements.editExpensesAmount = document.getElementById('editExpensesAmount');
  elements.editOtherCostsAmount = document.getElementById('editOtherCostsAmount');
  elements.editNotes = document.getElementById('editNotes');
  elements.reportEditAttachments = document.getElementById('reportEditAttachments');
  elements.adjustedMinutesModal = document.getElementById('adjustedMinutesModal');
  elements.adjustedMinutesForm = document.getElementById('adjustedMinutesForm');
  elements.adjustedReportId = document.getElementById('adjustedReportId');
  elements.adjustedMinutesInput = document.getElementById('adjustedMinutesInput');
  elements.closeAdjustedMinutesModalButton = document.getElementById('closeAdjustedMinutesModalButton');
  elements.cancelAdjustedMinutesButton = document.getElementById('cancelAdjustedMinutesButton');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
  elements.loadingOverlayText = document.getElementById('loadingOverlayText');
  elements.pages = {
    reports: document.getElementById('reportsPage'),
    absences: document.getElementById('absencesPage'),
    projects: document.getElementById('projectsPage'),
    dispo: document.getElementById('dispoPage'),
    settings: document.getElementById('settingsPage'),
    settingsSchoolVacations: document.getElementById('settingsSchoolVacationsPage'),
    settingsHolidays: document.getElementById('settingsHolidaysPage'),
  };
  elements.projectForm = document.getElementById('projectForm');
  elements.projectIdInput = document.getElementById('projectIdInput');
  elements.projectCommissionInput = document.getElementById('projectCommissionInput');
  elements.projectNameInput = document.getElementById('projectNameInput');
  elements.projectSearchInput = document.getElementById('projectSearchInput');
  elements.projectsTableBody = document.getElementById('projectsTableBody');
  elements.projectsAlert = document.getElementById('projectsAlert');
  elements.openProjectModalButton = document.getElementById('openProjectModalButton');
  elements.resetProjectFormButton = document.getElementById('resetProjectFormButton');
  elements.projectModal = document.getElementById('projectModal');
  elements.closeProjectModalButton = document.getElementById('closeProjectModalButton');
  elements.dispoAlert = document.getElementById('dispoAlert');
  elements.dispoPreviousWeekButton = document.getElementById('dispoPreviousWeekButton');
  elements.dispoNextWeekButton = document.getElementById('dispoNextWeekButton');
  elements.dispoWeekLabel = document.getElementById('dispoWeekLabel');
  elements.dispoWeekDateRange = document.getElementById('dispoWeekDateRange');
  elements.dispoTableHead = document.getElementById('dispoTableHead');
  elements.dispoTableBody = document.getElementById('dispoTableBody');
  elements.dispoExportPdfButton = document.getElementById('dispoExportPdfButton');
  elements.dispoGapSearchButton = document.getElementById('dispoGapSearchButton');
  elements.dispoGapResults = document.getElementById('dispoGapResults');
  elements.dispoGapSearchModal = document.getElementById('dispoGapSearchModal');
  elements.dispoGapSearchForm = document.getElementById('dispoGapSearchForm');
  elements.dispoGapWeekFromInput = document.getElementById('dispoGapWeekFromInput');
  elements.dispoGapWeekToInput = document.getElementById('dispoGapWeekToInput');
  elements.dispoGapMinimumHoursInput = document.getElementById('dispoGapMinimumHoursInput');
  elements.dispoGapServiceProfiles = document.getElementById('dispoGapServiceProfiles');
  elements.dispoGapModalResults = document.getElementById('dispoGapModalResults');
  elements.closeDispoGapSearchModalButton = document.getElementById('closeDispoGapSearchModalButton');
  elements.cancelDispoGapSearchButton = document.getElementById('cancelDispoGapSearchButton');
  elements.dispoMultiEntryInput = document.getElementById('dispoMultiEntryInput');
  elements.dispoAssignModal = document.getElementById('dispoAssignModal');
  elements.dispoAssignForm = document.getElementById('dispoAssignForm');
  elements.dispoAssignTargetLabel = document.getElementById('dispoAssignTargetLabel');
  elements.dispoAssignProjectsList = document.getElementById('dispoAssignProjectsList');
  elements.dispoAssignSpecialList = document.getElementById('dispoAssignSpecialList');
  elements.dispoAssignManualFields = document.getElementById('dispoAssignManualFields');
  elements.dispoAssignManualCommissionInput = document.getElementById('dispoAssignManualCommissionInput');
  elements.dispoAssignManualProjectNameInput = document.getElementById('dispoAssignManualProjectNameInput');
  elements.dispoAssignStartTime = document.getElementById('dispoAssignStartTime');
  elements.dispoAssignEndTime = document.getElementById('dispoAssignEndTime');
  elements.closeDispoAssignModalButton = document.getElementById('closeDispoAssignModalButton');
  elements.cancelDispoAssignButton = document.getElementById('cancelDispoAssignButton');
  elements.navTabs = Array.from(document.querySelectorAll('.nav-tab'));
  elements.adminSqlPreview = document.getElementById('adminSqlPreview');
  elements.settingsUsersTableBody = document.getElementById('settingsUsersTableBody');
  elements.openSettingsSchoolVacationsPageButton = document.getElementById('openSettingsSchoolVacationsPageButton');
  elements.openSettingsHolidaysPageButton = document.getElementById('openSettingsHolidaysPageButton');
  elements.backToSettingsFromVacationsButton = document.getElementById('backToSettingsFromVacationsButton');
  elements.backToSettingsFromHolidaysButton = document.getElementById('backToSettingsFromHolidaysButton');
  elements.settingsHolidaysTableBody = document.getElementById('settingsHolidaysTableBody');
  elements.settingsSchoolVacationsTableBody = document.getElementById('settingsSchoolVacationsTableBody');
  elements.holidayForm = document.getElementById('holidayForm');
  elements.holidayDateInput = document.getElementById('holidayDateInput');
  elements.holidayNameInput = document.getElementById('holidayNameInput');
  elements.holidayIsPaidInput = document.getElementById('holidayIsPaidInput');
  elements.saveHolidayButton = document.getElementById('saveHolidayButton');
  elements.openHolidayImportModalButton = document.getElementById('openHolidayImportModalButton');
  elements.schoolVacationForm = document.getElementById('schoolVacationForm');
  elements.schoolVacationStartInput = document.getElementById('schoolVacationStartInput');
  elements.schoolVacationEndInput = document.getElementById('schoolVacationEndInput');
  elements.openSchoolVacationImportModalButton = document.getElementById('openSchoolVacationImportModalButton');
  elements.schoolVacationImportModal = document.getElementById('schoolVacationImportModal');
  elements.schoolVacationImportForm = document.getElementById('schoolVacationImportForm');
  elements.schoolVacationImportCantonInput = document.getElementById('schoolVacationImportCantonInput');
  elements.schoolVacationImportSchoolYearInput = document.getElementById('schoolVacationImportSchoolYearInput');
  elements.schoolVacationImportProgress = document.getElementById('schoolVacationImportProgress');
  elements.schoolVacationImportProgressLabel = document.getElementById('schoolVacationImportProgressLabel');
  elements.schoolVacationImportProgressList = document.getElementById('schoolVacationImportProgressList');
  elements.confirmSchoolVacationImportButton = document.getElementById('confirmSchoolVacationImportButton');
  elements.closeSchoolVacationImportModalButton = document.getElementById('closeSchoolVacationImportModalButton');
  elements.cancelSchoolVacationImportButton = document.getElementById('cancelSchoolVacationImportButton');
  elements.holidayImportModal = document.getElementById('holidayImportModal');
  elements.holidayImportForm = document.getElementById('holidayImportForm');
  elements.holidayImportCantonInput = document.getElementById('holidayImportCantonInput');
  elements.holidayImportYearInput = document.getElementById('holidayImportYearInput');
  elements.holidayImportProgress = document.getElementById('holidayImportProgress');
  elements.holidayImportProgressLabel = document.getElementById('holidayImportProgressLabel');
  elements.holidayImportProgressList = document.getElementById('holidayImportProgressList');
  elements.confirmHolidayImportButton = document.getElementById('confirmHolidayImportButton');
  elements.closeHolidayImportModalButton = document.getElementById('closeHolidayImportModalButton');
  elements.cancelHolidayImportButton = document.getElementById('cancelHolidayImportButton');
  elements.blockDayModal = document.getElementById('blockDayModal');
  elements.blockDayForm = document.getElementById('blockDayForm');
  elements.blockDayProfileIdInput = document.getElementById('blockDayProfileIdInput');
  elements.blockDayYearInput = document.getElementById('blockDayYearInput');
  elements.blockDayOptionsBody = document.getElementById('blockDayOptionsBody');
  elements.closeBlockDayModalButton = document.getElementById('closeBlockDayModalButton');
  elements.cancelBlockDayButton = document.getElementById('cancelBlockDayButton');
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.accessDeniedLogoutButton.addEventListener('click', handleLogout);
  elements.weekPicker.addEventListener('change', async (event) => {
    state.selectedWeek = event.target.value;
    await loadData();
  });
  elements.previousWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, -1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  elements.nextWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, 1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  elements.exportPdfButton.addEventListener('click', exportWeekPdf);
  elements.exportPdfWithVisumButton?.addEventListener('click', exportWeekPdfWithVisum);
  elements.reportsFilterEmployeeButton?.addEventListener('click', () => openReportsColumnFilter('employee'));
  elements.reportsSortSelect?.addEventListener('change', handleReportsSortChange);
  elements.reportsFilterCommissionButton?.addEventListener('click', () => openReportsColumnFilter('commission'));
  elements.reportsFilterExpensesButton?.addEventListener('click', () => openReportsColumnFilter('expenses'));
  elements.reportsFilterAttachmentsButton?.addEventListener('click', () => openReportsColumnFilter('attachments'));
  if (elements.reportsToolbarPlaceholderButton) {
    elements.reportsToolbarPlaceholderButton.addEventListener('click', openBulkConfirmModal);
  }
  elements.showControlledReportsInput.addEventListener('change', handleShowControlledReportsToggle);
  document.addEventListener('click', handleGlobalColumnFilterDismiss);
  if (elements.absenceFilterInput) elements.absenceFilterInput.addEventListener('input', handleAbsenceFilterInput);
  if (elements.selectAllAbsenceEmployeesButton) elements.selectAllAbsenceEmployeesButton.addEventListener('click', selectAllAbsenceEmployees);
  if (elements.clearAbsenceSelectionButton) elements.clearAbsenceSelectionButton.addEventListener('click', clearAbsenceSelection);
  if (elements.showControlledAbsencesInput) elements.showControlledAbsencesInput.addEventListener('change', handleShowControlledAbsencesToggle);
  if (elements.absenceFilterList) elements.absenceFilterList.addEventListener('change', handleAbsenceSelectionChange);
  if (elements.togglePastAbsencesButton) elements.togglePastAbsencesButton.addEventListener('click', togglePastAbsencesView);
  if (elements.closeAbsenceInfoModalButton) elements.closeAbsenceInfoModalButton.addEventListener('click', closeAbsenceInfoModal);
  if (elements.closeBulkConfirmModalButton) {
    elements.closeBulkConfirmModalButton.addEventListener('click', closeBulkConfirmModal);
  }
  if (elements.bulkConfirmSearchButton) {
    elements.bulkConfirmSearchButton.addEventListener('click', handleBulkConfirmSearch);
  }
  if (elements.openMissingReportsCallModalButton) {
    elements.openMissingReportsCallModalButton.addEventListener('click', openMissingReportsCallModal);
  }
  if (elements.closeMissingReportsCallModalButton) {
    elements.closeMissingReportsCallModalButton.addEventListener('click', closeMissingReportsCallModal);
  }
  if (elements.cancelMissingReportsCallButton) {
    elements.cancelMissingReportsCallButton.addEventListener('click', closeMissingReportsCallModal);
  }
  if (elements.submitMissingReportsCallButton) {
    elements.submitMissingReportsCallButton.addEventListener('click', handleMissingReportsCallSubmit);
  }
  if (elements.missingList) {
    elements.missingList.addEventListener('click', handleMissingListClick);
  }
  elements.reportsTableBody.addEventListener('click', handleReportsTableClick);
  elements.absencesTableBody.addEventListener('click', handleAbsencesTableClick);
  elements.reportsPrevPageButton.addEventListener('click', goToPreviousReportsPage);
  elements.reportsNextPageButton.addEventListener('click', goToNextReportsPage);
  elements.closeReportEditModalButton.addEventListener('click', closeReportEditModal);
  elements.cancelReportEditButton.addEventListener('click', closeReportEditModal);
  elements.reportEditForm.addEventListener('submit', handleReportEditSubmit);
  elements.editStartTime.addEventListener('change', syncEditedWorkMinutesWithTimeRange);
  elements.editEndTime.addEventListener('change', syncEditedWorkMinutesWithTimeRange);
  elements.editStartTime.addEventListener('input', syncEditedWorkMinutesWithTimeRange);
  elements.editEndTime.addEventListener('input', syncEditedWorkMinutesWithTimeRange);
  elements.editPauseMinutes.addEventListener('change', syncEditedWorkMinutesWithTimeRange);
  elements.editPauseMinutes.addEventListener('input', syncEditedWorkMinutesWithTimeRange);
  elements.adjustedMinutesForm.addEventListener('submit', handleAdjustedMinutesSubmit);
  elements.reportEditModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeModal === 'true') {
      closeReportEditModal();
    }
  });
  elements.closeAdjustedMinutesModalButton.addEventListener('click', closeAdjustedMinutesModal);
  elements.cancelAdjustedMinutesButton.addEventListener('click', closeAdjustedMinutesModal);
  elements.adjustedMinutesModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeAdjustedModal === 'true') {
      closeAdjustedMinutesModal();
    }
  });
  elements.projectForm.addEventListener('submit', handleProjectSubmit);
  elements.projectSearchInput.addEventListener('input', handleProjectSearchInput);
  elements.projectsTableBody.addEventListener('click', handleProjectsTableClick);
  elements.resetProjectFormButton.addEventListener('click', resetProjectForm);
  elements.openProjectModalButton.addEventListener('click', () => openProjectModal());
  elements.closeProjectModalButton.addEventListener('click', closeProjectModal);
  elements.projectModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeProjectModal === 'true') {
      closeProjectModal();
    }
  });
  elements.dispoTableBody.addEventListener('click', handleDispoTableClick);
  elements.dispoTableHead.addEventListener('click', handleDispoTableClick);
  elements.dispoExportPdfButton.addEventListener('click', exportDispoPdf);
  elements.dispoGapSearchButton.addEventListener('click', openDispoGapSearchModal);
  if (elements.dispoGapSearchForm) {
    elements.dispoGapSearchForm.addEventListener('submit', handleDispoGapSearchSubmit);
  }
  if (elements.closeDispoGapSearchModalButton) {
    elements.closeDispoGapSearchModalButton.addEventListener('click', closeDispoGapSearchModal);
  }
  if (elements.cancelDispoGapSearchButton) {
    elements.cancelDispoGapSearchButton.addEventListener('click', closeDispoGapSearchModal);
  }
  if (elements.dispoGapSearchModal) {
    elements.dispoGapSearchModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeDispoGapSearchModal === 'true') {
        closeDispoGapSearchModal();
      }
    });
  }
  elements.dispoMultiEntryInput.addEventListener('change', handleDispoMultiEntryToggle);
  elements.dispoAssignForm.addEventListener('submit', handleDispoAssignSubmit);
  elements.dispoAssignForm.addEventListener('change', handleDispoAssignChoiceChange);
  elements.closeDispoAssignModalButton.addEventListener('click', closeDispoAssignModal);
  elements.cancelDispoAssignButton.addEventListener('click', closeDispoAssignModal);
  elements.dispoAssignModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeDispoAssignModal === 'true') {
      closeDispoAssignModal();
    }
  });
  if (elements.absenceInfoModal) {
    elements.absenceInfoModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeAbsenceInfoModal === 'true') {
        closeAbsenceInfoModal();
      }
    });
  }
  if (elements.bulkConfirmModal) {
    elements.bulkConfirmModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeBulkConfirmModal === 'true') {
        closeBulkConfirmModal();
      }
    });
  }
  if (elements.missingReportsCallModal) {
    elements.missingReportsCallModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeMissingReportsCallModal === 'true') {
        closeMissingReportsCallModal();
      }
    });
  }
  elements.dispoPreviousWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, -1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  elements.dispoNextWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, 1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  if (elements.settingsUsersTableBody) {
    elements.settingsUsersTableBody.addEventListener('click', handleSettingsUsersTableClick);
    elements.settingsUsersTableBody.addEventListener('change', handleSettingsUsersTableChange);
  }
  if (elements.settingsHolidaysTableBody) {
    elements.settingsHolidaysTableBody.addEventListener('click', handleSettingsHolidaysTableClick);
  }
  if (elements.holidayForm) {
    elements.holidayForm.addEventListener('submit', handleHolidayFormSubmit);
  }
  if (elements.openHolidayImportModalButton) {
    elements.openHolidayImportModalButton.addEventListener('click', openHolidayImportModal);
  }
  if (elements.closeHolidayImportModalButton) {
    elements.closeHolidayImportModalButton.addEventListener('click', closeHolidayImportModal);
  }
  if (elements.cancelHolidayImportButton) {
    elements.cancelHolidayImportButton.addEventListener('click', closeHolidayImportModal);
  }
  if (elements.holidayImportModal) {
    elements.holidayImportModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeHolidayImportModal === 'true') {
        if (state.isHolidayImportRunning) return;
        closeHolidayImportModal();
      }
    });
  }
  if (elements.holidayImportForm) {
    elements.holidayImportForm.addEventListener('submit', handleHolidayImportFormSubmit);
  }
  if (elements.settingsSchoolVacationsTableBody) {
    elements.settingsSchoolVacationsTableBody.addEventListener('click', handleSettingsSchoolVacationsTableClick);
  }
  if (elements.openSettingsSchoolVacationsPageButton) {
    elements.openSettingsSchoolVacationsPageButton.addEventListener('click', () => {
      state.currentPage = 'settingsSchoolVacations';
      render();
    });
  }
  if (elements.openSettingsHolidaysPageButton) {
    elements.openSettingsHolidaysPageButton.addEventListener('click', () => {
      state.currentPage = 'settingsHolidays';
      render();
    });
  }
  if (elements.backToSettingsFromVacationsButton) {
    elements.backToSettingsFromVacationsButton.addEventListener('click', () => {
      state.currentPage = 'settings';
      render();
    });
  }
  if (elements.backToSettingsFromHolidaysButton) {
    elements.backToSettingsFromHolidaysButton.addEventListener('click', () => {
      state.currentPage = 'settings';
      render();
    });
  }
  if (elements.schoolVacationForm) {
    elements.schoolVacationForm.addEventListener('submit', handleSchoolVacationFormSubmit);
  }
  if (elements.openSchoolVacationImportModalButton) {
    elements.openSchoolVacationImportModalButton.addEventListener('click', openSchoolVacationImportModal);
  }
  if (elements.closeSchoolVacationImportModalButton) {
    elements.closeSchoolVacationImportModalButton.addEventListener('click', closeSchoolVacationImportModal);
  }
  if (elements.cancelSchoolVacationImportButton) {
    elements.cancelSchoolVacationImportButton.addEventListener('click', closeSchoolVacationImportModal);
  }
  if (elements.schoolVacationImportModal) {
    elements.schoolVacationImportModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeSchoolVacationImportModal === 'true') {
        if (state.isSchoolVacationImportRunning) return;
        closeSchoolVacationImportModal();
      }
    });
  }
  if (elements.schoolVacationImportForm) {
    elements.schoolVacationImportForm.addEventListener('submit', handleSchoolVacationImportFormSubmit);
  }
  if (elements.blockDayForm) {
    elements.blockDayForm.addEventListener('submit', handleBlockDayFormSubmit);
  }
  if (elements.closeBlockDayModalButton) {
    elements.closeBlockDayModalButton.addEventListener('click', closeBlockDayModal);
  }
  if (elements.cancelBlockDayButton) {
    elements.cancelBlockDayButton.addEventListener('click', closeBlockDayModal);
  }
  if (elements.blockDayModal) {
    elements.blockDayModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeBlockDayModal === 'true') {
        closeBlockDayModal();
      }
    });
  }
  document.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('pageshow', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => setCurrentPage(tab.dataset.page));
  });
}
