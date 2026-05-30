function renderDispoPlanner() {
  if (!elements.dispoTableBody) return;
  const weekRange = getWeekRange(state.selectedWeek);
  elements.dispoWeekLabel.textContent = getWeekLabel(state.selectedWeek);
  elements.dispoWeekDateRange.textContent = `${formatDate(weekRange.start)} – ${formatDate(weekRange.end)}`;
  const dates = getWeekDateList(state.selectedWeek);
  elements.dispoTableHead.innerHTML = `<tr><th>Mitarbeiter</th>${dates.map((date) => {
    const isWeekend = isWeekendDate(date);
    const hasEditableProfiles = getActiveProfiles().some((profile) => !isWeeklyReportLocked(profile.id, date));
    const bulkAssignButton = !isWeekend && hasEditableProfiles
      ? `<button class="button button-secondary button-icon-only" type="button" data-action="bulk-dispo-column" data-date="${escapeAttribute(date)}" title="Ganzer Tag disponieren" aria-label="Ganzer Tag disponieren">${renderIconButtonContent('calendar-plus', 'Ganzer Tag disponieren')}</button>`
      : '';
    return `<th><div class="dispo-header-cell">${escapeHtml(getWeekdayLabel(date))}<span class="subtle-text">${escapeHtml(formatDate(date))}</span>${bulkAssignButton}</div></th>`;
  }).join('')}</tr>`;
  const activeProfiles = getActiveProfiles();
  elements.dispoTableBody.innerHTML = activeProfiles.map((profile) => {
    const cells = dates.map((date) => renderDispoCell(profile.id, date)).join('');
    const hasEditableWeekdays = dates.some((date) => !isWeekendDate(date) && !isWeeklyReportLocked(profile.id, date));
    const bulkAssignRowButton = hasEditableWeekdays
      ? `<button class="button button-secondary button-icon-only" type="button" data-action="bulk-dispo-row" data-profile-id="${escapeAttribute(profile.id)}" title="Woche für Mitarbeiter disponieren" aria-label="Woche für Mitarbeiter disponieren">${renderIconButtonContent('calendar-plus', 'Woche für Mitarbeiter disponieren')}</button>`
      : '';
    return `<tr><td><div class="dispo-name-cell"><strong>${escapeHtml(profile.full_name || profile.email || 'Unbekannt')}</strong>${bulkAssignRowButton}</div></td>${cells}</tr>`;
  }).join('');
  renderLucideIcons();
}

function renderDispoCell(profileId, date) {
  if (isWeekendDate(date)) {
    return '<td><div class="dispo-plus-cell"><span class="subtle-text">–</span></div></td>';
  }
  const blockItems = getBlockDayDispoItems(profileId, date);
  const hasFullDayBlock = blockItems.some((item) => {
    const start = toDispoMinutes(item.start_time, BLOCK_DAY_DEFAULT_START);
    const end = toDispoMinutes(item.end_time, BLOCK_DAY_DEFAULT_END);
    return start <= parseClockToMinutes(BLOCK_DAY_DEFAULT_START) && end >= parseClockToMinutes(BLOCK_DAY_DEFAULT_END);
  });
  const isLocked = isWeeklyReportLocked(profileId, date);
  const entry = state.dailyAssignments.find((item) => item.profile_id === profileId && item.assignment_date === date);
  const assignmentItems = getDispoItemsForEntry(entry);
  const weeklyReportItems = getWeeklyReportItems(profileId, date);
  const weeklyAbsenceItems = weeklyReportItems.filter((item) => isAbsenceDispoItem(item?.label));
  const missingReportItem = [{ type: 'missing_report', label: 'Rapport fehlt', start_time: '', end_time: '' }];
  const shouldShowMissingReport = blockItems.length === 0;
  const fallbackItems = weeklyAbsenceItems.length ? weeklyAbsenceItems : (isLocked ? weeklyReportItems : []);
  const items = isLocked
    ? (weeklyReportItems.length ? weeklyReportItems : (shouldShowMissingReport ? missingReportItem : []))
    : (assignmentItems.length ? assignmentItems : fallbackItems);
  const hasAutoAbsenceFromWeeklyReport = !isLocked && !assignmentItems.length && weeklyAbsenceItems.length > 0;
  const addButton = (!hasFullDayBlock && !isLocked && !hasAutoAbsenceFromWeeklyReport)
    ? `<button class="button button-secondary button-icon-only" type="button" data-action="assign-dispo" data-profile-id="${escapeAttribute(profileId)}" data-date="${escapeAttribute(date)}" title="Dispo hinzufügen" aria-label="Dispo hinzufügen">${renderIconButtonContent('plus', 'Dispo hinzufügen')}</button>`
    : '';
  const blockTagBadges = blockItems.length
    ? `<div class="dispo-items">${blockItems.map((item) => `<div class="dispo-item-row"><span class="dispo-item-text">${escapeHtml(item.label)}</span></div>`).join('')}</div>`
    : '';
  if (!items.length) {
    if (!addButton) {
      return `<td><div class="dispo-cell dispo-cell-locked">${blockTagBadges}</div></td>`;
    }
    return `<td><div class="dispo-plus-cell">${blockTagBadges}${addButton}</div></td>`;
  }
  const cellKey = getDispoCellKey(profileId, date);
  const isExpanded = isDispoCellExpanded(cellKey);
  const visibleItems = isExpanded ? items : items.slice(0, 1);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  const expandToggle = items.length > 1
    ? `<button class="button button-ghost dispo-expand-button" type="button" data-action="toggle-dispo-cell" data-cell-key="${escapeAttribute(cellKey)}" aria-expanded="${isExpanded ? 'true' : 'false'}" title="${isExpanded ? 'Weitere Einträge ausblenden' : 'Alle Einträge anzeigen'}">${getIconMarkup(isExpanded ? 'chevron-up' : 'chevron-down')}${hiddenCount && !isExpanded ? `<span class="dispo-expand-count">+${hiddenCount}</span>` : ''}</button>`
    : '';
  return `<td><div class="dispo-cell">
    ${blockTagBadges}
    <div class="dispo-cell-content">
      <div class="dispo-items">${visibleItems.map((item, index) => renderDispoItemCard(item, entry?.id, index, !isLocked)).join('')}</div>
      <div class="dispo-cell-actions">${expandToggle}${addButton}</div>
    </div>
  </div></td>`;
}

function getDispoCellKey(profileId, date) {
  return `${profileId}:${date}`;
}

function isDispoCellExpanded(cellKey) {
  return Array.isArray(state.dispoExpandedCells) && state.dispoExpandedCells.includes(cellKey);
}

function toggleDispoCellExpansion(cellKey) {
  if (!cellKey) return;
  const expandedCells = Array.isArray(state.dispoExpandedCells) ? state.dispoExpandedCells : [];
  state.dispoExpandedCells = expandedCells.includes(cellKey)
    ? expandedCells.filter((item) => item !== cellKey)
    : [...expandedCells, cellKey];
  renderDispoPlanner();
}

function renderDispoItemCard(item, assignmentId, index, allowDelete = true) {
  const themeClass = getDispoCardThemeClass(item?.label);
  const lineLabel = getDispoItemLineLabel(item);
  const actions = allowDelete && assignmentId
    ? `<div class="dispo-item-actions">
      <button class="button button-icon-only dispo-delete-button" type="button" data-action="remove-dispo-item" data-assignment-id="${escapeAttribute(assignmentId)}" data-item-index="${escapeAttribute(index)}" title="Eintrag löschen" aria-label="Eintrag löschen">${renderIconButtonContent('x', 'Eintrag löschen')}</button>
    </div>`
    : '';
  return `<article class="dispo-item-card ${themeClass}">
    <div class="dispo-item-text">
      <span>${escapeHtml(lineLabel)}</span>
    </div>
    ${actions}
  </article>`;
}

function getDispoCardThemeClass(label) {
  const normalized = normalizeSearchValue(label || '');
  if (normalized.includes('divers')) return 'dispo-item-card-dark';
  if (normalized.includes('rapport fehlt')) return 'dispo-item-card-orange';
  if (normalized.includes('feiertag') || normalized.includes('ferien')) return 'dispo-item-card-red';
  if (normalized.includes('krankheit') || normalized.includes('unfall')) return 'dispo-item-card-orange';
  if (normalized.includes('militaer') || normalized.includes('zivildienst')) return 'dispo-item-card-green';
  return '';
}

function getDispoItemLineLabel(item) {
  return item?.label || '';
}

function normalizeDispoTimeValue(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.slice(0, 5);
}

function parseClockToMinutes(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw.split(':');
  const hours = Number(parts[0]);
  const minutes = parts.length > 1 ? Number(parts[1]) : 0;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}


function resolveProjectIdFromReportWithMap(report, projectMap) {
  const byCommission = [...projectMap.values()].find((project) => String(project.commission_number || '').trim() === String(report.commission_number || '').trim());
  if (byCommission) return byCommission.id;
  const byName = [...projectMap.values()].find((project) => String(project.name || '').trim().toLowerCase() === String(report.project_name || '').trim().toLowerCase());
  if (byName) return byName.id;
  return null;
}

function isAbsenceDispoItem(label) {
  const normalized = normalizeSearchValue(label || '');
  return ['ferien', 'feiertag', 'krankheit', 'unfall', 'militaer', 'zivildienst', 'berufsschule', 'blocktag', 'absenz'].some((term) => normalized.includes(term));
}

function getBlockDayDispoItems(profileId, date) {
  const profile = getProfileById(profileId);
  const schedule = parseBlockSchedule(profile);
  if (!schedule.length) return [];
  const weekday = getWeekdayIndex(date) + 1;
  return schedule
    .filter((entry) => entry.weekday === weekday)
    .map((entry) => ({
      start_time: normalizeDispoTimeValue(entry.start_time, BLOCK_DAY_DEFAULT_START),
      end_time: normalizeDispoTimeValue(entry.end_time, BLOCK_DAY_DEFAULT_END),
      label: `Blocktag (${normalizeDispoTimeValue(entry.start_time, BLOCK_DAY_DEFAULT_START)}–${normalizeDispoTimeValue(entry.end_time, BLOCK_DAY_DEFAULT_END)})`,
    }));
}

function toDispoMinutes(timeValue, fallback) {
  const value = normalizeDispoTimeValue(timeValue, fallback);
  const [hh, mm] = value.split(':').map((part) => Number(part));
  return (hh * 60) + mm;
}

function hasBlockDayOverlap(profileId, date, items = []) {
  const blockItems = getBlockDayDispoItems(profileId, date);
  if (!blockItems.length || !items.length) return false;
  return items.some((item) => {
    const itemStart = toDispoMinutes(item.start_time, DISPO_DEFAULT_START_TIME);
    const itemEnd = toDispoMinutes(item.end_time, DISPO_DEFAULT_END_TIME);
    if (itemEnd <= itemStart) return true;
    return blockItems.some((block) => {
      const blockStart = toDispoMinutes(block.start_time, BLOCK_DAY_DEFAULT_START);
      const blockEnd = toDispoMinutes(block.end_time, BLOCK_DAY_DEFAULT_END);
      return itemStart < blockEnd && itemEnd > blockStart;
    });
  });
}

function isPastDispoDate(date) {
  const todayIso = new Date().toISOString().slice(0, 10);
  return String(date || '') < todayIso;
}

function upsertLocalDailyAssignment(entry) {
  if (!entry) return;
  const index = state.dailyAssignments.findIndex((item) => item.profile_id === entry.profile_id && item.assignment_date === entry.assignment_date);
  if (index >= 0) {
    state.dailyAssignments[index] = entry;
    return;
  }
  state.dailyAssignments.push(entry);
}

function removeLocalDailyAssignment(profileId, date) {
  state.dailyAssignments = state.dailyAssignments.filter((item) => !(item.profile_id === profileId && item.assignment_date === date));
}

function serializeDispoItems(items = []) {
  const normalizedItems = items
    .filter((item) => item && typeof item.label === 'string' && item.label.trim())
    .map((item) => {
      const normalized = {
        label: item.label.trim(),
        start_time: normalizeDispoTimeValue(item.start_time, DISPO_DEFAULT_START_TIME),
        end_time: normalizeDispoTimeValue(item.end_time, DISPO_DEFAULT_END_TIME),
      };
      if (item.project_id) normalized.project_id = item.project_id;
      return normalized;
    });
  return `${DISPO_ITEMS_PREFIX}${JSON.stringify(normalizedItems)}`;
}

function getDispoItemsForEntry(entry) {
  if (!entry) return [];
  if (typeof entry.label === 'string' && (entry.label.startsWith(DISPO_ITEMS_PREFIX) || entry.label.startsWith(DISPO_ITEMS_LEGACY_PREFIX))) {
    const prefix = entry.label.startsWith(DISPO_ITEMS_PREFIX) ? DISPO_ITEMS_PREFIX : DISPO_ITEMS_LEGACY_PREFIX;
    try {
      const parsed = JSON.parse(entry.label.slice(prefix.length));
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.label === 'string' && item.label.trim())
          .map((item) => ({
            ...item,
            start_time: normalizeDispoTimeValue(item.start_time, DISPO_DEFAULT_START_TIME),
            end_time: normalizeDispoTimeValue(item.end_time, DISPO_DEFAULT_END_TIME),
          }));
      }
    } catch (error) {
      console.warn('Ungültige Dispo-Liste', error);
    }
  }
  const project = entry.project_id ? state.projects.find((item) => item.id === entry.project_id) : null;
  const label = project ? `${project.commission_number || ''} ${project.name || ''}`.trim() : (entry.label || '');
  return label ? [{
    type: project ? 'project' : 'special',
    project_id: project?.id || null,
    label,
    start_time: DISPO_DEFAULT_START_TIME,
    end_time: DISPO_DEFAULT_END_TIME,
  }] : [];
}

async function handleDispoTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'toggle-dispo-cell') {
    toggleDispoCellExpansion(button.dataset.cellKey);
    return;
  }
  if (button.dataset.action === 'assign-dispo') {
    if (isWeeklyReportLocked(button.dataset.profileId, button.dataset.date)) {
      showInlineAlert(elements.dispoAlert, 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.', true);
      return;
    }
    openDispoAssignModal({
      targets: [{ profileId: button.dataset.profileId, date: button.dataset.date }],
      label: `Mitarbeiter ${getProfileById(button.dataset.profileId)?.full_name || ''} · ${formatDate(button.dataset.date)}`,
    });
    return;
  }
  if (button.dataset.action === 'bulk-dispo-row') {
    const profileId = button.dataset.profileId;
    openDispoAssignModal({
      targets: getWeekDateList(state.selectedWeek)
        .filter((date) => !isWeekendDate(date))
        .filter((date) => !isWeeklyReportLocked(profileId, date))
        .map((date) => ({ profileId, date })),
      label: `Ganze Woche für ${getProfileById(profileId)?.full_name || ''}`,
    });
    return;
  }
  if (button.dataset.action === 'bulk-dispo-column') {
    const date = button.dataset.date;
    openDispoAssignModal({
      targets: getActiveProfiles()
        .filter((profile) => !isWeeklyReportLocked(profile.id, date))
        .map((profile) => ({ profileId: profile.id, date })),
      label: `Ganzer Tag ${getWeekdayLabel(date)} (${formatDate(date)})`,
    });
    return;
  }
  if (button.dataset.action === 'remove-dispo-item') {
    const entry = state.dailyAssignments.find((item) => String(item.id) === String(button.dataset.assignmentId));
    if (!entry) return;
    if (isWeeklyReportLocked(entry.profile_id, entry.assignment_date)) {
      showInlineAlert(elements.dispoAlert, 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.', true);
      return;
    }
    const index = Number(button.dataset.itemIndex);
    const items = getDispoItemsForEntry(entry).filter((_, itemIndex) => itemIndex !== index);
    await saveDispoAssignment({
      profileId: entry.profile_id,
      date: entry.assignment_date,
      items,
      source: 'manual',
      mode: 'replace',
    });
    return;
  }
}

async function saveDispoAssignment({ profileId, date, items = [], source = 'manual', suppressReload = false, silent = false, mode = 'replace' }) {
  if (isWeeklyReportLocked(profileId, date)) {
    const message = 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.';
    if (!silent) showInlineAlert(elements.dispoAlert, message, true);
    return { saved: false, error: message };
  }
  const existingEntry = state.dailyAssignments.find((item) => item.profile_id === profileId && item.assignment_date === date);
  const baseItems = mode === 'append' ? getDispoItemsForEntry(existingEntry) : [];
  const mergedItems = [...baseItems, ...items].filter((item) => item?.label);
  if (hasBlockDayOverlap(profileId, date, mergedItems)) {
    const message = 'Die Dispo-Zeit überschneidet sich mit einem Blocktag.';
    if (!silent) showInlineAlert(elements.dispoAlert, message, true);
    return { saved: false, error: message };
  }
  if (!mergedItems.length) {
    if (!state.isDemoMode && state.supabase) {
      const deleteQuery = state.supabase
        .from('daily_assignments')
        .delete()
        .eq('profile_id', profileId)
        .eq('assignment_date', date);
      const { error: deleteError } = await deleteQuery;
      if (deleteError && !isMissingTableError(deleteError, 'daily_assignments')) {
        if (!silent) showInlineAlert(elements.dispoAlert, `Dispo konnte nicht gelöscht werden: ${deleteError.message}`, true);
        return { saved: false, error: deleteError.message };
      }
    }
    removeLocalDailyAssignment(profileId, date);
    if (!silent || !suppressReload) renderDispoPlanner();
    return { saved: true, error: null };
  }
  const payload = {
    profile_id: profileId,
    assignment_date: date,
    project_id: mergedItems.find((item) => item?.project_id)?.project_id || null,
    label: serializeDispoItems(mergedItems),
    source,
  };
  if (!payload.project_id) {
    const message = 'Dispo braucht ein gültiges Projekt (project_id).';
    if (!silent) showInlineAlert(elements.dispoAlert, message, true);
    return { saved: false, error: message };
  }
  let entry = {
    id: existingEntry?.id || `local-${profileId}-${date}`,
    ...payload,
  };
  if (!state.isDemoMode && state.supabase) {
    const { data: savedEntry, error: upsertError } = await state.supabase
      .from('daily_assignments')
      .upsert(payload, { onConflict: 'profile_id,assignment_date' })
      .select()
      .single();
    if (upsertError) {
      if (!silent) showInlineAlert(elements.dispoAlert, `Beim Speichern ist ein Fehler aufgetreten: ${upsertError.message}`, true);
      return { saved: false, error: upsertError.message };
    }
    entry = savedEntry || entry;
  }
  upsertLocalDailyAssignment(entry);
  if (!silent || !suppressReload) renderDispoPlanner();
  if (!silent) showInlineAlert(elements.dispoAlert, 'Dispo gespeichert.', false);
  return { saved: true, error: null };
}

async function mergeWeeklyReportsIntoDispo(dailyAssignments) {
  const merged = [...dailyAssignments];
  const byKey = new Map(merged.map((entry) => [`${entry.profile_id}:${entry.assignment_date}`, entry]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const weeklyGrouped = new Map();
  for (const report of state.weeklyReports) {
    const key = `${report.profile_id}:${report.work_date}`;
    if (!weeklyGrouped.has(key)) weeklyGrouped.set(key, []);
    weeklyGrouped.get(key).push(report);
  }
  for (const [key, entries] of weeklyGrouped.entries()) {
    const [profileId, date] = key.split(':');
    const existing = byKey.get(key);
    const isPastOrToday = date <= todayIso;
    if (existing && !isPastOrToday) continue;
    if (existing?.source === 'manual') continue;
    const computed = mapWeeklyReportToDispoEntry(profileId, date, entries);
    if (!computed) continue;
    const computedSerialized = serializeDispoItems(computed.items || []);
    if (existing && (existing.label || '') === computedSerialized) continue;
    await saveDispoAssignment({ profileId, date, items: computed.items || [], source: 'weekly_report', suppressReload: true, silent: true });
    const nextEntry = {
      ...(existing || { id: `pending-${key}` }),
      profile_id: profileId,
      assignment_date: date,
      project_id: computed.items?.[0]?.project_id || null,
      label: computedSerialized,
      source: 'weekly_report',
    };
    byKey.set(key, nextEntry);
    if (existing) {
      const index = merged.findIndex((item) => item.profile_id === profileId && item.assignment_date === date);
      if (index >= 0) merged[index] = nextEntry;
    } else {
      merged.push(nextEntry);
    }
  }
  return merged;
}

function mapWeeklyReportToDispoEntry(profileId, date, reports) {
  if (!reports?.length) return null;
  const mappedItems = reports
    .map((report) => mapReportToDispoItem(report))
    .filter(Boolean);
  if (!mappedItems.length) return null;
  return { items: [mappedItems[0]] };
}

function mapReportToDispoItem(report) {
  const projectId = resolveProjectIdFromReport(report);
  if (!projectId) return null;
  const project = state.projects.find((item) => item.id === projectId);
  return {
    type: 'project',
    project_id: projectId,
    label: `${project?.commission_number || report.commission_number || ''} ${project?.name || report.project_name || ''}`.trim(),
    start_time: normalizeDispoTimeValue(report.start_time, DISPO_DEFAULT_START_TIME),
    end_time: normalizeDispoTimeValue(report.end_time, DISPO_DEFAULT_END_TIME),
  };
}

function resolveProjectIdFromReport(report) {
  const byCommission = state.projects.find((project) => String(project.commission_number || '').trim() === String(report.commission_number || '').trim());
  if (byCommission) return byCommission.id;
  const byName = state.projects.find((project) => String(project.name || '').trim().toLowerCase() === String(report.project_name || '').trim().toLowerCase());
  return byName?.id || null;
}

function getWeeklyReportItems(profileId, date) {
  const reports = state.weeklyReports.filter((report) => report.profile_id === profileId && report.work_date === date);
  return reports.map((report) => ({
    type: 'weekly_report',
    project_id: resolveProjectIdFromReport(report),
    label: `${report.commission_number || ''} ${report.project_name || ''}`.trim() || 'Ohne Projekt',
    start_time: normalizeDispoTimeValue(report.start_time, DISPO_DEFAULT_START_TIME),
    end_time: normalizeDispoTimeValue(report.end_time, DISPO_DEFAULT_END_TIME),
  }));
}

function isWeeklyReportLocked(profileId, date) {
  return isPastDispoDate(date);
}

function getWeekDateList(weekValue) {
  const weekRange = getWeekRange(weekValue);
  const cursor = new Date(`${weekRange.start}T00:00:00Z`);
  const result = [];
  for (let i = 0; i < 7; i += 1) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function isWeekendDate(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function openDispoAssignModal({ targets, label }) {
  const editableTargets = (targets || []).filter((target) => !isWeeklyReportLocked(target.profileId, target.date));
  if (!editableTargets.length) {
    showInlineAlert(elements.dispoAlert, 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.', true);
    return;
  }
  state.dispoAssignContext = { targets: editableTargets };
  elements.dispoAssignTargetLabel.textContent = label || 'Auswahl treffen.';
  const sortedProjects = [...state.projects].sort((left, right) => {
    const leftLabel = `${left.commission_number || ''} ${left.name || ''}`.trim().toLowerCase();
    const rightLabel = `${right.commission_number || ''} ${right.name || ''}`.trim().toLowerCase();
    return leftLabel.localeCompare(rightLabel, 'de');
  });
  elements.dispoAssignProjectsList.innerHTML = `<table class="dispo-select-table"><thead><tr><th>Projekte</th><th>Auswahl</th></tr></thead><tbody>${sortedProjects.map((project, index) => `<tr><td>${escapeHtml(`${project.commission_number || ''} ${project.name || ''}`.trim())}</td><td><input type="radio" name="dispoAssignChoice" value="project:${escapeAttribute(project.id)}" ${index === 0 ? 'checked' : ''} /></td></tr>`).join('')}</tbody></table>`;
  elements.dispoAssignSpecialList.innerHTML = '<label><input type="radio" name="dispoAssignChoice" value="manual" /> Eigene Kommissionsnummer + Projektname eingeben</label>';
  handleDispoAssignChoiceChange();
  if (!state.projects.length) {
    showInlineAlert(elements.dispoAlert, 'Keine Projekte vorhanden. Bitte zuerst ein Projekt erfassen.', true);
    return;
  }
  elements.dispoAssignModal.classList.remove('hidden');
}

function closeDispoAssignModal() {
  elements.dispoAssignModal.classList.add('hidden');
  state.dispoAssignContext = null;
  elements.dispoAssignForm.reset();
}

function handleDispoAssignChoiceChange() {
  const checked = elements.dispoAssignForm?.querySelector('input[name="dispoAssignChoice"]:checked');
  const isManual = checked?.value === 'manual';
  if (elements.dispoAssignManualCommissionInput) elements.dispoAssignManualCommissionInput.disabled = !isManual;
  if (elements.dispoAssignManualProjectNameInput) elements.dispoAssignManualProjectNameInput.disabled = !isManual;
}

async function handleDispoAssignSubmit(event) {
  event.preventDefault();
  const targets = state.dispoAssignContext?.targets || [];
  if (!targets.length) return;
  const checked = elements.dispoAssignForm.querySelector('input[name="dispoAssignChoice"]:checked');
  if (!checked) {
    showInlineAlert(elements.dispoAlert, 'Bitte zuerst eine Zuweisung auswählen.', true);
    return;
  }
  const startTime = DISPO_DEFAULT_START_TIME;
  const endTime = DISPO_DEFAULT_END_TIME;
  const [type, rawValue] = checked.value.split(':');
  let item = null;
  if (type === 'project') {
    const selectedProject = state.projects.find((project) => String(project.id) === String(rawValue));
    item = { type: 'project', project_id: rawValue, label: `${selectedProject?.commission_number || ''} ${selectedProject?.name || ''}`.trim(), start_time: startTime, end_time: endTime };
    if (!item.label) {
      showInlineAlert(elements.dispoAlert, 'Projekt konnte nicht zugeordnet werden. Bitte Auswahl neu öffnen.', true);
      return;
    }
  } else if (checked.value === 'manual') {
    const commission = String(elements.dispoAssignManualCommissionInput?.value || '').trim();
    const projectName = String(elements.dispoAssignManualProjectNameInput?.value || '').trim();
    const manualLabel = `${commission} ${projectName}`.trim();
    if (!manualLabel) {
      showInlineAlert(elements.dispoAlert, 'Bitte Kommissionsnummer und/oder Projektnamen erfassen.', true);
      return;
    }
    item = { type: 'manual_project', project_id: null, label: manualLabel, start_time: startTime, end_time: endTime };
  } else {
    showInlineAlert(elements.dispoAlert, 'Ungültige Auswahl. Bitte erneut versuchen.', true);
    return;
  }
  const mode = 'append';
  const errorMessages = [];
  for (const target of targets) {
    const result = await saveDispoAssignment({ profileId: target.profileId, date: target.date, items: [item], mode, suppressReload: true, silent: true, source: 'manual' });
    if (!result.saved) errorMessages.push(result.error || 'Unbekannter Fehler');
  }
  if (errorMessages.length) {
    const uniqueErrors = [...new Set(errorMessages)];
    const details = uniqueErrors.join(' | ');
    showInlineAlert(elements.dispoAlert, `Beim Speichern ist ein Fehler aufgetreten: ${details}`, true);
    await loadData();
    return;
  }
  closeDispoAssignModal();
  showInlineAlert(elements.dispoAlert, 'Dispo gespeichert.', false);
  await loadData();
}

async function exportDispoPdf() {
  await withLongTask('Dispo-PDF wird vorbereitet …', async () => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('PDF-Export ist aktuell nicht verfügbar.');
      return;
    }
    const dates = getWeekDateList(state.selectedWeek);
    const body = getActiveProfiles().map((profile) => {
      const row = [profile.full_name || profile.email || 'Unbekannt'];
      for (const date of dates) {
        const entry = state.dailyAssignments.find((item) => item.profile_id === profile.id && item.assignment_date === date);
        const labels = getDispoItemsForEntry(entry).map((item) => item.label);
        row.push(labels.join(' | '));
      }
      return row;
    });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const head = [['Mitarbeiter', ...dates.map((date) => `${getWeekdayLabel(date)} ${formatDate(date)}`)]];
    pdf.setFontSize(14);
    pdf.text(`Dispo ${getWeekLabel(state.selectedWeek)} (${formatDate(dates[0])} – ${formatDate(dates[6])})`, 14, 14);
    pdf.autoTable({
      startY: 20,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [39, 78, 183] },
    });
    pdf.save(`dispo-${state.selectedWeek}.pdf`);
  });
}
