function getFilteredProjects() {
  const query = state.projectSearchQuery.trim().toLowerCase();
  if (!query) return [...state.projects];
  return state.projects.filter((project) => String(project.commission_number || '').toLowerCase().includes(query) || String(project.name || '').toLowerCase().includes(query));
}
