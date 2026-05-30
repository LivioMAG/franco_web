function renderProjectsTable() {
  if (!elements.projectsTableBody) return;
  const rows = getFilteredProjects();
  if (!rows.length) {
    elements.projectsTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">Keine Projekte vorhanden.</td></tr>';
    return;
  }
  elements.projectsTableBody.innerHTML = rows.map((project) => {
    return `<tr class="project-row-static">
      <td>${escapeHtml(project.commission_number || '')}</td>
      <td>${escapeHtml(project.name || '')}</td>
      <td>
        <div class="table-row-actions">
          <button class="button button-small button-secondary button-icon-only" type="button" data-action="edit-project" data-project-id="${escapeAttribute(project.id)}" title="Projekt bearbeiten" aria-label="Projekt bearbeiten">${renderIconButtonContent('pencil', 'Projekt bearbeiten')}</button>
          <button class="button button-small button-danger button-icon-only" type="button" data-action="delete-project" data-project-id="${escapeAttribute(project.id)}" title="Projekt löschen" aria-label="Projekt löschen">${renderIconButtonContent('trash-2', 'Projekt löschen')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  renderLucideIcons();
}

function handleProjectSearchInput(event) {
  state.projectSearchQuery = event.target.value || '';
  renderProjectsTable();
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  const commissionNumber = elements.projectCommissionInput.value.trim();
  const name = elements.projectNameInput.value.trim();
  if (!commissionNumber || !name) {
    showInlineAlert(elements.projectsAlert, 'Kommissionsnummer und Projektname sind Pflicht.', true);
    return;
  }
  await withLongTask('Projekt wird gespeichert …', async () => {
    const payload = {
      commission_number: commissionNumber,
      name,
    };
    let projectId = state.editingProjectId;
    if (projectId) {
      const { error } = await state.supabase.from('projects').update(payload).eq('id', projectId);
      if (error) throw error;
    } else {
      const { data, error } = await state.supabase.from('projects').insert(payload).select('id').single();
      if (error) throw error;
      projectId = data.id;
    }
    resetProjectForm();
    closeProjectModal();
    showInlineAlert(elements.projectsAlert, 'Projekt erfolgreich gespeichert.', false);
    await loadData();
  });
}

function resetProjectForm() {
  state.editingProjectId = null;
  elements.projectIdInput.value = '';
  elements.projectCommissionInput.value = '';
  elements.projectNameInput.value = '';
}

async function handleProjectsTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const action = button.dataset.action;
  const projectId = button.dataset.projectId;
  if (action === 'edit-project') {
    const project = state.projects.find((item) => String(item.id) === String(projectId));
    if (!project) return;
    state.editingProjectId = project.id;
    elements.projectIdInput.value = project.id;
    elements.projectCommissionInput.value = project.commission_number || '';
    elements.projectNameInput.value = project.name || '';
    openProjectModal();
    return;
  }
  if (action === 'delete-project') {
    if (!confirm('Projekt wirklich löschen?')) return;
    const { error } = await state.supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      showInlineAlert(elements.projectsAlert, error.message, true);
      return;
    }
    showInlineAlert(elements.projectsAlert, 'Projekt gelöscht.', false);
    await loadData();
  }
}

function openProjectModal() {
  if (!elements.projectModal) return;
  elements.projectModal.classList.remove('hidden');
}

function closeProjectModal() {
  if (!elements.projectModal) return;
  elements.projectModal.classList.add('hidden');
}
