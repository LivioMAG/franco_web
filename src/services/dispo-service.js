async function fetchDispoAssignmentsForRange(startDate, endDate) {
  if (!state.supabase) return [];
  const [dailyAssignmentsResponse, weeklyReportsResponse] = await Promise.all([
    state.supabase
      .from('daily_assignments')
      .select('*')
      .gte('assignment_date', startDate)
      .lte('assignment_date', endDate)
      .order('assignment_date', { ascending: true }),
    state.supabase
      .from('weekly_reports')
      .select('*')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true }),
  ]);
  const { data: dailyAssignments, error: dailyAssignmentsError } = dailyAssignmentsResponse;
  const { data: weeklyReports, error: weeklyReportsError } = weeklyReportsResponse;
  if (dailyAssignmentsError && !isMissingTableError(dailyAssignmentsError, 'daily_assignments')) {
    throw dailyAssignmentsError;
  }
  if (weeklyReportsError) {
    throw weeklyReportsError;
  }
  const profileMap = new Map(state.profiles.map((profile) => [String(profile.id), profile]));
  const projectMap = new Map(state.projects.map((project) => [String(project.id), project]));
  const merged = [...(dailyAssignments || [])];
  const byKey = new Map(merged.map((entry) => [`${entry.profile_id}:${entry.assignment_date}`, entry]));
  for (const report of weeklyReports || []) {
    const key = `${report.profile_id}:${report.work_date}`;
    if (byKey.has(key)) continue;
    const projectId = resolveProjectIdFromReportWithMap(report, projectMap);
    if (!projectId) continue;
    const project = projectMap.get(String(projectId));
    const serialized = serializeDispoItems([{
      type: 'project',
      project_id: projectId,
      label: `${project?.commission_number || report.commission_number || ''} ${project?.name || report.project_name || ''}`.trim(),
      start_time: normalizeDispoTimeValue(report.start_time, DISPO_DEFAULT_START_TIME),
      end_time: normalizeDispoTimeValue(report.end_time, DISPO_DEFAULT_END_TIME),
    }]);
    const profile = profileMap.get(String(report.profile_id));
    if (profile?.is_active === false) continue;
    const entry = { id: `weekly-${key}`, profile_id: report.profile_id, assignment_date: report.work_date, label: serialized, source: 'weekly_report' };
    byKey.set(key, entry);
    merged.push(entry);
  }
  return merged;
}
