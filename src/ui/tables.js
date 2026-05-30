function renderReportsPagination({ totalItems, totalPages, currentPage, startIndex, endIndex }) {
  if (!elements.reportsPaginationSummary) {
    return;
  }

  elements.reportsPaginationSummary.textContent = totalItems
    ? `Seite ${currentPage} von ${totalPages} · ${startIndex + 1}-${endIndex} von ${totalItems} Rapporten`
    : 'Seite 1 von 1 · 0 Rapporte';
  elements.reportsPrevPageButton.disabled = currentPage <= 1;
  elements.reportsNextPageButton.disabled = currentPage >= totalPages || totalItems === 0;
}

function goToPreviousReportsPage() {
  if (state.reportsPage <= 1) {
    return;
  }

  state.reportsPage -= 1;
  renderReportsTable();
}

function goToNextReportsPage() {
  const totalPages = Math.max(1, Math.ceil(getSortedFilteredReports().length / state.reportsPerPage));
  if (state.reportsPage >= totalPages) {
    return;
  }

  state.reportsPage += 1;
  renderReportsTable();
}
