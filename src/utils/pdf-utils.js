async function exportWeekPdf() {
  await exportWeekPdfInternal({ includeVisumStamp: false });
}

async function exportWeekPdfWithVisum() {
  await exportWeekPdfInternal({ includeVisumStamp: true });
}

function getVisumTimestampLabel(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

function drawVisumStamp(pdf, { approverName, approvedAt }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const stampColor = [22, 163, 74];
  const stampCenterX = pageWidth - 47;
  const stampCenterY = pageHeight - 23;
  const stampAngle = -12;

  const drawStampText = (text, yOffset, { fontSize, fontStyle = 'normal', opacityOffset = 0 } = {}) => {
    pdf.setFont('helvetica', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.text(text, stampCenterX + opacityOffset, stampCenterY + yOffset + opacityOffset, {
      align: 'center',
      angle: stampAngle,
    });
  };

  pdf.setTextColor(...stampColor);
  drawStampText('VISIERT & GEPRÜFT', -3.6, { fontSize: 13.2, fontStyle: 'bold', opacityOffset: 0.1 });
  drawStampText('VISIERT & GEPRÜFT', -3.6, { fontSize: 13.2, fontStyle: 'bold' });
  drawStampText(`durch: ${approverName}`, 1.5, { fontSize: 8.2, fontStyle: 'bold', opacityOffset: 0.07 });
  drawStampText(`durch: ${approverName}`, 1.5, { fontSize: 8.2, fontStyle: 'bold' });
  drawStampText(approvedAt, 5.7, { fontSize: 7.8, opacityOffset: 0.07 });
  drawStampText(approvedAt, 5.7, { fontSize: 7.8 });
  pdf.setTextColor(0, 0, 0);
}

async function exportWeekPdfInternal({ includeVisumStamp = false } = {}) {
  await withLongTask('PDF-Export wird vorbereitet …', async () => {
    const filteredReports = getSortedFilteredReports();
    if (!filteredReports.length) {
      alert('Für die gewählte Woche sind keine Rapporte vorhanden.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const grouped = groupReportsByProfile(filteredReports);
    const weekRange = getWeekRange(state.selectedWeek);
    const approverName = String(state.currentProfile?.full_name || state.currentProfile?.email || 'Unbekannt').trim();
    const approvedAt = getVisumTimestampLabel();
    let firstSection = true;

    for (const profile of getReportableProfiles().filter((item) => grouped.has(item.id))) {
      const reports = grouped.get(profile.id) ?? [];
      if (!firstSection) pdf.addPage();
      firstSection = false;

      const reportLayout = buildWeeklyReportLayout(reports);
      drawWeeklyReportPage(pdf, {
        profile,
        weekRange,
        calendarWeek: getWeekLabel(state.selectedWeek),
        layout: reportLayout,
      });
      if (includeVisumStamp) {
        drawVisumStamp(pdf, { approverName, approvedAt });
      }

      const imageAttachments = reports
        .flatMap((report) => {
          const commissionNumber = String(report.commission_number || '').trim();
          return (Array.isArray(report.attachments) ? report.attachments : []).map((attachment) => ({
            ...attachment,
            commissionNumber,
          }));
        })
        .filter((attachment) => isImageAttachment(attachment) && getAttachmentUrl(attachment));
      for (let index = 0; index < imageAttachments.length; index += 2) {
        pdf.addPage();
        await drawAttachmentGalleryPage(pdf, imageAttachments.slice(index, index + 2), {
          profileName: profile.full_name || 'Unbekannt',
          calendarWeek: getWeekLabel(state.selectedWeek),
        });
      }
    }

    pdf.addPage();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Fehlende/Unvollständige Wochenrapporte', 14, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(getWeekLabel(state.selectedWeek), 14, 24);
    const missingRows = getIncompleteSubmissionProfiles({ selectedOnly: true }).map((entry) => [
      entry.profile.full_name,
      entry.profile.email,
      entry.statusLabel,
    ]);
    pdf.autoTable({
      startY: 30,
      head: [['Mitarbeiter', 'E-Mail', 'Status']],
      body: missingRows.length ? missingRows : [['Alle Mitarbeiter haben vollständig abgegeben.', '', '']],
      styles: { fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
    });

    pdf.save(`wochenrapport-${state.selectedWeek}.pdf`);
  });
}

async function exportHolidayConfirmationPdf(requestId) {
  await withLongTask('Absenzbestätigung als PDF wird erstellt …', async () => {
    const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
    if (!request) {
      alert('Die ausgewählte Absenz wurde nicht gefunden.');
      return;
    }

    const requestStatus = getHolidayRequestApprovalStatus(request);
    if (requestStatus !== 0 && requestStatus !== 2) {
      alert('Das Dokument kann erst für angenommene oder abgelehnte Absenzgesuche heruntergeladen werden.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const profile = getProfileById(request.profile_id);

    drawHolidayConfirmationPage(pdf, { request, profile });

    const attachments = Array.isArray(request.attachments) ? request.attachments : [];
    const imageAttachments = attachments.filter((attachment) => isImageAttachment(attachment) && getAttachmentUrl(attachment));
    const otherAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

    if (otherAttachments.length) {
      pdf.addPage();
      drawHolidayAttachmentListPage(pdf, { attachments: otherAttachments, request, profile });
    }

    for (let index = 0; index < imageAttachments.length; index += 2) {
      pdf.addPage();
      await drawAttachmentGalleryPage(pdf, imageAttachments.slice(index, index + 2), {
        profileName: profile?.full_name || 'Unbekannt',
        calendarWeek: 'Absenz-Bestätigung',
      });
    }

    pdf.save(buildHolidayConfirmationFileName(request, profile));
  });
}

function buildRequestHistoryConfirmationFileName(entry, profile) {
  const createdDate = String(entry?.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const safeName = String(profile?.full_name || profile?.email || 'mitarbeiter')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `bestaetigung-${safeName || 'mitarbeiter'}-${createdDate}.pdf`;
}

function getApprovalPersonLabel(value) {
  const label = String(value || '').trim();
  return label || 'Noch nicht bestätigt';
}

function getHistoryApprovalNames(entry) {
  const contextValue = String(entry?.context || '').trim();
  const plMatch = contextValue.match(/PL:\s*([^|]+)/i);
  const glMatch = contextValue.match(/GL:\s*([^|]+)/i);
  return {
    pl: getApprovalPersonLabel(plMatch?.[1]),
    gl: getApprovalPersonLabel(glMatch?.[1]),
  };
}

function buildHistoryPdfDetailRows(entry, details, profile) {
  const approvalNames = getHistoryApprovalNames(entry);
  return [
    ['Mitarbeiter', profile?.full_name || profile?.email || 'Unbekannt'],
    ['Typ', details.typeLabel],
    ['Von / Bis', details.periodLabel],
    ['PL Bestätigung', details.plApprovalLabel || approvalNames.pl],
    ['GL Bestätigung', details.glApprovalLabel || approvalNames.gl],
    ['Ausgelöst am', formatDateTime(entry.created_at)],
  ];
}

function drawPdfHeader(pdf, { title, subtitle, statusLabel, statusColor = [22, 163, 74] }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, pageWidth, 42, 'F');
  pdf.setFillColor(...statusColor);
  pdf.rect(0, 0, 6, 42, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, margin, 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text(subtitle, margin, 27, { maxWidth: pageWidth - margin * 2 - 44, lineHeightFactor: 1.3 });

  const badgeWidth = Math.max(32, pdf.getTextWidth(statusLabel) + 12);
  pdf.setFillColor(...statusColor);
  pdf.roundedRect(pageWidth - margin - badgeWidth, 13, badgeWidth, 10, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(statusLabel, pageWidth - margin - badgeWidth / 2, 19.7, { align: 'center' });

  pdf.setTextColor(0, 0, 0);
}

function drawModernDetailTable(pdf, { startY, margin, contentWidth, rows, accentColor = [215, 0, 21] }) {
  pdf.autoTable({
    startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 3.2, right: 4, bottom: 3.2, left: 4 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold', textColor: accentColor, fillColor: [241, 245, 249] },
      1: { cellWidth: contentWidth - 48 },
    },
  });
}

function drawModernTextPanel(pdf, { title, text, y, margin, contentWidth }) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.8);
  const lines = pdf.splitTextToSize(String(text || ''), contentWidth - 8);
  const lineHeight = 5;
  const panelHeight = Math.max(38, 19 + lines.length * lineHeight);

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, contentWidth, panelHeight, 3, 3, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, margin + 4, y + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.8);
  pdf.setTextColor(51, 65, 85);
  pdf.text(lines, margin + 4, y + 16, {
    lineHeightFactor: 1.35,
  });
  pdf.setTextColor(0, 0, 0);
}

function drawRequestHistoryConfirmationPage(pdf, { entry, details, profile }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const detailRows = buildHistoryPdfDetailRows(entry, details, profile);
  const requestText = String(entry?.request || '').trim() || '–';

  drawPdfHeader(pdf, {
    title: 'Bestätigung Absenz',
    subtitle: 'Archivierter Export aus den bestätigten Absenzanträgen.',
    statusLabel: 'Bestätigt',
    statusColor: [22, 163, 74],
  });

  drawModernDetailTable(pdf, {
    startY: 52,
    margin,
    contentWidth,
    rows: detailRows,
    accentColor: [22, 163, 74],
  });

  const notesY = (pdf.lastAutoTable?.finalY || 96) + 10;
  drawModernTextPanel(pdf, {
    title: 'Gesuch',
    text: requestText,
    y: notesY,
    margin,
    contentWidth,
  });
}

async function exportRequestHistoryPdf(historyEntryId) {
  await withLongTask('Bestätigung als PDF wird erstellt …', async () => {
    const entry = state.requestHistory.find((item) => String(item.id) === String(historyEntryId));
    if (!entry) {
      alert('Der ausgewählte Bestätigungseintrag wurde nicht gefunden.');
      return;
    }

    const details = parseRequestHistoryEntry(entry);
    const profile = getProfileById(entry.profile_id);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

    drawRequestHistoryConfirmationPage(pdf, { entry, details, profile });
    pdf.save(buildRequestHistoryConfirmationFileName(entry, profile));
  });
}

function drawHolidayConfirmationPage(pdf, { request, profile }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const exportDate = new Date().toLocaleDateString('de-CH');
  const typeLabel = getAbsenceTypeLabel(request, request.request_type);
  const status = getHolidayRequestApprovalStatus(request);
  const statusLabel = status === 0 ? 'Abgelehnt' : 'Angenommen';
  const personLabel = profile?.full_name || 'den Mitarbeiter';
  const statusColor = status === 0 ? [220, 38, 38] : [22, 163, 74];
  const introText = status === 0
    ? `Der Absenzantrag "${typeLabel}" für ${personLabel} im Zeitraum vom ${formatDate(request.start_date)} bis ${formatDate(request.end_date)} wurde abgelehnt.`
    : `Die Absenz "${typeLabel}" für ${personLabel} im Zeitraum vom ${formatDate(request.start_date)} bis ${formatDate(request.end_date)} wurde durch PL und GL bestätigt.`;
  const detailRows = [
    ['Mitarbeiter', profile?.full_name || 'Unbekannt'],
    ['Absenzart', typeLabel],
    ['Status', statusLabel],
    ['Einreichung', formatDateOnly(request.created_at)],
    ['Von / Bis', `${formatDate(request.start_date)} bis ${formatDate(request.end_date)}`],
    ['Dauer', getHolidayRequestDurationLabel(request)],
    ['PL Bestätigung', getApprovalPersonLabel(request.controll_pl)],
    ['GL Bestätigung', getApprovalPersonLabel(request.controll_gl)],
    ['PDF erstellt am', exportDate],
  ];

  drawPdfHeader(pdf, {
    title: 'Absenzentscheid',
    subtitle: introText,
    statusLabel,
    statusColor,
  });

  drawModernDetailTable(pdf, {
    startY: 52,
    margin,
    contentWidth,
    rows: detailRows,
    accentColor: statusColor,
  });

  const notesY = (pdf.lastAutoTable?.finalY || 102) + 10;
  drawModernTextPanel(pdf, {
    title: 'Bemerkung',
    text: request.notes || 'Keine zusätzliche Bemerkung vorhanden.',
    y: notesY,
    margin,
    contentWidth,
  });
}

async function deleteHolidayRequestAttachments(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length || state.isDemoMode || !state.supabase) {
    return;
  }

  const paths = attachments
    .map((attachment) => String(attachment?.path || '').trim())
    .filter(Boolean);

  if (!paths.length) {
    return;
  }

  const { error } = await state.supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) {
    throw error;
  }
}

async function deleteHolidayRequestAttachmentsSafely(attachments = []) {
  try {
    await deleteHolidayRequestAttachments(attachments);
  } catch (error) {
    console.warn('Absenz-Anhänge konnten nach der Archivierung nicht gelöscht werden.', error);
  }
}

async function deleteWeeklyReportAttachments(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length || state.isDemoMode || !state.supabase) {
    return;
  }

  const paths = attachments
    .map((attachment) => String(attachment?.path || '').trim())
    .filter(Boolean);

  if (!paths.length) {
    return;
  }

  const { error } = await state.supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) {
    throw error;
  }
}

async function deleteWeeklyReportAttachmentsSafely(attachments = []) {
  try {
    await deleteWeeklyReportAttachments(attachments);
  } catch (error) {
    console.warn('Rapport-Anhänge konnten nach dem Löschen nicht entfernt werden.', error);
  }
}

function drawHolidayAttachmentListPage(pdf, { attachments, request, profile }) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Anhangsverzeichnis', 15, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`${profile?.full_name || 'Unbekannt'} · ${getAbsenceTypeLabel(request, request.request_type)}`, 15, 25);

  const body = attachments.map((attachment) => [
    attachment.name || 'Anhang',
    attachment.mimeType || 'Datei',
    getAttachmentUrl(attachment) || 'Kein Link verfügbar',
  ]);

  pdf.autoTable({
    startY: 32,
    margin: { left: 15, right: 15 },
    head: [['Datei', 'Typ', 'Quelle']],
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 34 },
      2: { cellWidth: 98 },
    },
  });
}

function buildHolidayConfirmationFileName(request, profile) {
  const safeName = String(profile?.full_name || 'mitarbeiter')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `absenzentscheid-${safeName || 'mitarbeiter'}-${request.start_date}-${request.end_date}.pdf`;
}

function buildWeeklyReportLayout(reports) {
  const regularRows = buildWeeklyMatrixRows(
    reports.filter((report) => !isAbsenceReport(report) || isSchoolOrUkReport(report)),
  );
  const absenceRows = buildAbsenceMatrixRows(reports);
  const notes = buildWeeklyRemarkLines(reports);
  const totals = regularRows.reduce(
    (summary, row) => {
      row.dailyMinutes.forEach((minutes, index) => {
        summary.dailyMinutes[index] += minutes;
      });
      summary.totalMinutes += row.totalMinutes;
      summary.expenses += row.expenses;
      return summary;
    },
    {
      dailyMinutes: Array(6).fill(0),
      totalMinutes: 0,
      expenses: 0,
    },
  );

  return {
    regularRows,
    absenceRows,
    notes,
    totals,
  };
}

function drawWeeklyReportPage(pdf, { profile, weekRange, calendarWeek, layout }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = 8;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const nameBoxY = 24;
  const nameBoxHeight = 10;
  const mainTableY = 40;

  drawReportHeader(pdf, {
    profile,
    weekRange,
    calendarWeek,
    marginLeft,
    contentWidth,
    nameBoxY,
    nameBoxHeight,
  });

  const regularBody = layout.regularRows.length
    ? layout.regularRows.map((row) => [
        row.projectName,
        row.commission,
        ...row.days,
        formatHours(row.totalMinutes),
        formatCurrency(row.expenses),
        row.notes.join(' | '),
      ])
    : [];
  while (regularBody.length < 10) {
    regularBody.push(['', '', '', '', '', '', '', '', '', '', '']);
  }

  pdf.autoTable({
    startY: mainTableY,
    margin: { left: marginLeft, right: marginRight },
    tableWidth: contentWidth,
    head: [['Projektname', 'Kom. Nr.', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'Total', 'Spesen', 'Bemerkungen']],
    body: regularBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 5.3,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 26 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 14, halign: 'center' },
      9: { cellWidth: 16, halign: 'center' },
      10: { cellWidth: 77 },
    },
  });

  const totalsY = (pdf.lastAutoTable?.finalY || mainTableY) + 3;
  const absencesY = totalsY + 10;

  drawWeeklyTotalRow(pdf, { margin: marginLeft, totalsY, contentWidth, totals: layout.totals });
  drawAbsenceTable(pdf, { margin: marginLeft, y: absencesY, width: contentWidth, rows: layout.absenceRows });
}

function drawReportHeader(pdf, { profile, weekRange, calendarWeek, marginLeft, contentWidth, nameBoxY, nameBoxHeight }) {
  const isTemporary = String(profile?.role_label || '').trim().toLowerCase() === 'temporär';
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isTemporary ? 18 : 24);
  pdf.setTextColor(isTemporary ? 0 : 215, 0, isTemporary ? 0 : 21);
  pdf.text(isTemporary ? 'Temporär' : 'MARÉCHAUX', marginLeft, 14);
  if (!isTemporary) {
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text('elektrisch gut.', marginLeft + 20, 18);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Wochenrapport', marginLeft + contentWidth / 2, 14, { align: 'center' });

  pdf.rect(marginLeft, nameBoxY, contentWidth, nameBoxHeight);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text(profile.full_name || '–', marginLeft + 1, nameBoxY + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.text(`${formatDate(weekRange.start)} - ${formatDate(weekRange.end)}`, marginLeft + contentWidth / 2, nameBoxY + 6.8, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(calendarWeek), marginLeft + contentWidth - 2, nameBoxY + 6.8, { align: 'right' });
}

function drawWeeklyTotalRow(pdf, { margin, totalsY, contentWidth, totals }) {
  const projectWidth = 70;
  const commissionWidth = 26;
  const dayWidth = 12;
  const totalWidth = 14;
  const expensesWidth = 16;
  const notesWidth = contentWidth - projectWidth - commissionWidth - dayWidth * 6 - totalWidth - expensesWidth;
  let x = margin;

  pdf.setLineWidth(0.2);
  pdf.rect(margin, totalsY, contentWidth, 8);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('Wochentotal', x + 1, totalsY + 5.3);
  x += projectWidth;
  pdf.line(x, totalsY, x, totalsY + 8);
  x += commissionWidth;
  pdf.line(x, totalsY, x, totalsY + 8);

  totals.dailyMinutes.forEach((minutes) => {
    pdf.line(x, totalsY, x, totalsY + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatHours(minutes), x + dayWidth / 2, totalsY + 5.3, { align: 'center' });
    x += dayWidth;
  });

  pdf.line(x, totalsY, x, totalsY + 8);
  pdf.text(formatHours(totals.totalMinutes), x + totalWidth / 2, totalsY + 5.3, { align: 'center' });
  x += totalWidth;

  pdf.line(x, totalsY, x, totalsY + 8);
  pdf.text(formatCurrency(totals.expenses), x + expensesWidth / 2, totalsY + 5.3, { align: 'center' });
  x += expensesWidth;

  pdf.line(x, totalsY, x, totalsY + 8);
  x += notesWidth;
  pdf.line(x, totalsY, x, totalsY + 8);
}

function drawAbsenceTable(pdf, { margin, y, width, rows }) {
  const labelWidth = 96;
  const dayWidth = 12;
  const totalWidth = 14;
  const notesWidth = width - labelWidth - dayWidth * 6 - totalWidth;
  const rowHeight = 6;
  const absenceRows = rows.length ? rows : buildEmptyAbsenceRows();
  const height = rowHeight * absenceRows.length;

  pdf.rect(margin, y, width, height);
  let currentY = y;
  absenceRows.forEach((row, index) => {
    if (index > 0) {
      pdf.line(margin, currentY, margin + width, currentY);
    }
    pdf.line(margin + labelWidth, currentY, margin + labelWidth, currentY + rowHeight);

    let x = margin + labelWidth;
    row.days.forEach(() => {
      pdf.line(x + dayWidth, currentY, x + dayWidth, currentY + rowHeight);
      x += dayWidth;
    });
    pdf.line(x + totalWidth, currentY, x + totalWidth, currentY + rowHeight);

    pdf.setFont('helvetica', index === absenceRows.length - 1 ? 'bold' : 'normal');
    pdf.setFontSize(8.5);
    pdf.text(row.label, margin + 1, currentY + 4.2);
    row.days.forEach((value, dayIndex) => {
      pdf.text(value, margin + labelWidth + dayWidth * dayIndex + dayWidth / 2, currentY + 4.2, { align: 'center' });
    });
    pdf.text(row.total, margin + labelWidth + dayWidth * 6 + totalWidth / 2, currentY + 4.2, { align: 'center' });
    if (row.notes) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.2);
      pdf.text(row.notes, margin + width - notesWidth + 1, currentY + 4.2, { maxWidth: notesWidth - 2 });
    }
    currentY += rowHeight;
  });
}

async function drawAttachmentGalleryPage(pdf, attachments, { profileName, calendarWeek }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const slotGap = 8;
  const titleY = 18;
  const contentTopY = 24;
  const slotCount = 2;
  const slotWidth = (pageWidth - margin * 2 - slotGap) / slotCount;
  const footerSpace = 12;
  const slotHeight = pageHeight - contentTopY - margin - footerSpace;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Anhänge · ${profileName} · ${calendarWeek}`, margin, titleY);

  for (const [index, attachment] of attachments.entries()) {
    const slotX = margin + index * (slotWidth + slotGap);
    const slotY = contentTopY;
    try {
      const dataUrl = await fileToDataUrl(getAttachmentUrl(attachment));
      const imageProps = pdf.getImageProperties(dataUrl);
      const scale = Math.min(slotWidth / imageProps.width, slotHeight / imageProps.height);
      const renderWidth = imageProps.width * scale;
      const renderHeight = imageProps.height * scale;
      const renderX = slotX + (slotWidth - renderWidth) / 2;
      const renderY = slotY + (slotHeight - renderHeight) / 2;
      pdf.addImage(dataUrl, imageProps.fileType || 'JPEG', renderX, renderY, renderWidth, renderHeight);
    } catch (error) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('Bild konnte nicht geladen werden.', slotX, slotY + 10);
    }

    const commissionNumber = String(attachment?.commissionNumber || '').trim();
    const caption = commissionNumber
      ? `Kommissionsnummer: ${commissionNumber}`
      : 'Kommissionsnummer: –';
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(caption, slotX, pageHeight - margin + 2);
  }
}

function buildWeeklyMatrixRows(reports) {
  const groups = new Map();

  reports.forEach((report) => {
    const projectName = String(report.project_name || '').trim();
    const isSchoolLikeEntry = isSchoolOrUkReport(report);
    const commission = isSchoolLikeEntry ? '' : String(report.commission_number || '').trim();
    const key = commission
      ? `commission__${commission.toLowerCase()}`
      : `project__${projectName.toLowerCase()}__${isSchoolLikeEntry ? 'school' : 'no-commission'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        projectName: isSchoolReport(report) ? 'Berufsschule' : (projectName || 'Ohne Projektname'),
        commission: commission || (isSchoolLikeEntry ? '' : '–'),
        days: Array(6).fill(''),
        dailyMinutes: Array(6).fill(0),
        totalMinutes: 0,
        expenses: 0,
        lunchExpenses: new Map(),
        otherCosts: 0,
        notes: [],
      });
    }

    const dayIndex = getWeekdayIndex(report.work_date);
    if (dayIndex < 0 || dayIndex > 5) {
      return;
    }

    const current = groups.get(key);
    const workedHours = report.total_work_minutes > 0 ? formatHours(report.total_work_minutes) : '–';
    current.days[dayIndex] = current.days[dayIndex]
      ? `${current.days[dayIndex]} / ${workedHours}`
      : workedHours;
    current.dailyMinutes[dayIndex] += Number(report.total_work_minutes || 0);
    current.totalMinutes += Number(report.total_work_minutes || 0);
    const lunchExpenseAmount = Number(report.expenses_amount || 0);
    const otherCostsAmount = Number(report.other_costs_amount || 0);
    current.expenses += lunchExpenseAmount + otherCostsAmount;
    current.otherCosts += otherCostsAmount;
    if (lunchExpenseAmount > 0) {
      const amountKey = lunchExpenseAmount.toFixed(2);
      const lunchExpense = current.lunchExpenses.get(amountKey) || { amount: lunchExpenseAmount, count: 0 };
      lunchExpense.count += 1;
      current.lunchExpenses.set(amountKey, lunchExpense);
    }
    if (report.notes) current.notes.push(report.notes);
  });

  groups.forEach((row) => {
    const lunchExpenseRemark = buildLunchExpenseRemark(row.lunchExpenses);
    if (lunchExpenseRemark) {
      row.notes.push(lunchExpenseRemark);
    }
    if (row.otherCosts > 0) {
      row.notes.push(`Sonstige Auslagen: ${formatCurrency(row.otherCosts)}`);
    }
  });

  return [...groups.values()];
}

function buildLunchExpenseRemark(lunchExpenses) {
  const entries = [...(lunchExpenses?.values() || [])];
  if (!entries.length) {
    return '';
  }

  return entries
    .sort((left, right) => left.amount - right.amount)
    .map((entry) => `${entry.count}× ${formatFrancAmount(entry.amount)} Franken Mittagsspesen`)
    .join(' + ');
}

function formatFrancAmount(value) {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildAbsenceMatrixRows(reports) {
  const rows = ABSENCE_CATEGORY_CONFIG
    .filter((category) => ![6, 7, 9, BLOCK_DAY_TYPE_CODE].includes(category.typeCode))
    .map((category) => ({
    typeCode: category.typeCode,
    label: category.label,
    days: Array(6).fill(0),
    totalMinutes: 0,
    notes: [],
  }));

  reports.forEach((report) => {
    const absenceTypeCode = getAbsenceTypeCode(report);
    if (!absenceTypeCode || [6, 7, 9, BLOCK_DAY_TYPE_CODE].includes(absenceTypeCode)) {
      return;
    }

    const row = rows.find((item) => item.typeCode === absenceTypeCode);
    const dayIndex = getWeekdayIndex(report.work_date);
    if (!row || dayIndex < 0 || dayIndex > 5) {
      return;
    }

    const absenceMinutes = getAbsenceMinutes(report);
    row.days[dayIndex] += absenceMinutes;
    row.totalMinutes += absenceMinutes;
    const projectName = String(report.project_name || '').trim();
    const commissionNumber = String(report.commission_number || '').trim();
    if (projectName) row.notes.push(projectName);
    if (!projectName && commissionNumber) row.notes.push(commissionNumber);
    if (report.notes) row.notes.push(report.notes);
  });

  const normalizedRows = rows.map((row) => ({
    label: row.label,
    days: row.days.map((minutes) => (minutes ? formatHours(minutes) : '')),
    total: row.totalMinutes ? formatHours(row.totalMinutes) : '',
    notes: dedupeStrings(row.notes).join(' | '),
  }));

  const totalAbsenceMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  normalizedRows.push({
    label: 'Total Absenzen',
    days: Array(6).fill(''),
    total: totalAbsenceMinutes ? formatHours(totalAbsenceMinutes) : '',
    notes: '',
  });

  return normalizedRows;
}

function getAbsenceMinutes(report) {
  const recordedMinutes = getAdjustedWorkMinutes(report);
  if (recordedMinutes > 0) {
    return recordedMinutes;
  }

  return 8 * 60;
}
