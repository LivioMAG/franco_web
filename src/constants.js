const STORAGE_BUCKET = 'weekly-attachments';
const CONFIG_PATH = './config/supabase-config.json';
const HOLIDAY_TABLE = 'platform_holidays';
const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DISPO_ITEMS_PREFIX = 'dispo_items:';
const DISPO_ITEMS_LEGACY_PREFIX = '__dispo_items__:';
const DISPO_DEFAULT_START_TIME = '07:00';
const DISPO_DEFAULT_END_TIME = '16:30';
const DEFAULT_MISSING_REPORTS_CALL_WEBHOOK_URL = 'https://n8n.voltlog.cloud/webhook/voice-agent-retell';
const APP_ROLE_OPTIONS = ['Lehrling', 'Elektroinstallateur', 'Bauleiter', 'Projektleiter', 'Service'];
const SCHOOL_DAY_OPTIONS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
];
const SCHOOL_REPORT_NOTE_MARKER = 'Automatisch erstellter Berufsschultag';
const BLOCK_DAY_REPORT_NOTE_MARKER = 'Automatisch erstellter Blocktag';
const BLOCK_DAY_TYPE_CODE = 8;
const PAID_HOLIDAY_TYPE_CODE = 5;
const UNPAID_HOLIDAY_TYPE_CODE = 9;
const HOLIDAY_TYPE_CODES = new Set([PAID_HOLIDAY_TYPE_CODE, UNPAID_HOLIDAY_TYPE_CODE]);
const BLOCK_DAY_DEFAULT_START = '07:00';
const BLOCK_DAY_DEFAULT_END = '16:30';
const SCHOOL_VACATION_IMPORT_CANTONS = new Set(['LU', 'BE', 'SO', 'ZH']);
const SCHOOL_VACATION_IMPORT_YEARS = new Set(['2025/26', '2026/27', '2027/28', '2028/29', '2029/30']);
const SCHOOL_VACATION_IMPORT_STEPS = [
  'Import an Edge Function senden',
  'Ferienzeiten aus dem Kanton abrufen',
  'Lehrlings-Rapporte synchronisieren',
  'Ansicht aktualisieren',
];
const HOLIDAY_IMPORT_CANTONS = new Set(['LU', 'BE', 'SO', 'ZH']);
const HOLIDAY_IMPORT_YEARS = buildSupportedHolidayImportYears();
const HOLIDAY_IMPORT_STEPS = [
  'Import an Edge Function senden',
  'Feiertage Montag bis Freitag aufbereiten',
  'Feiertage in der Plattform speichern',
  'Ansicht aktualisieren',
];
const BLOCK_DAY_LEGACY_MODE_OPTIONS = {
  full: { label: 'Ganzer Tag', start: '07:00', end: '16:30' },
  am: { label: 'Vormittag', start: '07:00', end: '12:00' },
  pm: { label: 'Nachmittag', start: '13:00', end: '16:30' },
};
const HOLIDAY_TYPE_LABELS = {
  ferien: 'Ferien',
  fehlen: 'Ferien',
  militaer: 'Militär',
  zivildienst: 'Zivildienst',
  berufsschule: 'Berufsschule',
  uk: 'Berufsschule',
  'ük': 'Berufsschule',
  unfall: 'Unfall',
  krankheit: 'Krankheit',
  feiertag: 'Feiertag',
  blocktag: 'Blocktag',
};
const ABSENCE_TYPE_CODE_LABELS = {
  1: 'Ferien',
  2: 'Krankheit',
  3: 'Militär',
  4: 'Unfall',
  5: 'Feiertag',
  6: 'ÜK',
  7: 'Berufsschule',
  8: 'Blocktag',
  9: 'Feiertag (unbezahlt)',
};
const HOLIDAY_REQUEST_TYPE_TO_ABSENCE_TYPE_CODE = {
  ferien: 1,
  fehlen: 1,
  krankheit: 2,
  militaer: 3,
  militar: 3,
  zivildienst: 3,
  unfall: 4,
  feiertag: 5,
  uk: 6,
  'ük': 6,
  berufsschule: 7,
  blocktag: 8,
};
const ABSENCE_CATEGORY_CONFIG = [
  { typeCode: 1, label: 'Ferien' },
  { typeCode: 2, label: 'Krankheit' },
  { typeCode: 3, label: 'Militär' },
  { typeCode: 4, label: 'Unfall' },
  { typeCode: 5, label: 'Feiertag' },
  { typeCode: 6, label: 'ÜK' },
  { typeCode: 7, label: 'Berufsschule' },
  { typeCode: 8, label: 'Blocktag' },
  { typeCode: 9, label: 'Feiertag (unbezahlt)' },
];
const ABSENCE_TYPE_CODES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const MAX_VISIBLE_FILTER_OPTIONS = 5;
const BLOCK_SCHEDULE_SCHEMA_HINT =
  "Die Datenbankspalte 'app_profiles.block_schedule' fehlt. Bitte das aktuelle Supabase-Schema (ALTER TABLE app_profiles ADD COLUMN block_schedule ...) ausführen und danach die Seite neu laden.";
const ADMIN_SQL_SNIPPET = `-- Vollzugriff nur für Profile mit is_admin = true

alter table public.holiday_requests
add column if not exists controll_pl text;

alter table public.holiday_requests
add column if not exists controll_gl text;

alter table public.holiday_requests
add column if not exists approval_status smallint not null default 1;

alter table public.holiday_requests
add column if not exists special_request_hours jsonb not null default '{}'::jsonb;

alter table public.platform_holidays
add column if not exists is_paid boolean not null default true;

alter table public.app_profiles
add column if not exists vacation_allowance_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists booked_reported_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists booked_vacation_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists booked_vacations_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists booked_unpaid_holiday_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists reported_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists credited_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists weekly_hours numeric(10,2) not null default 40;

alter table public.app_profiles
alter column weekly_hours type numeric(10,2)
using weekly_hours::numeric(10,2);

alter table public.app_profiles
add column if not exists target_revenue numeric(12,2) not null default 0;

alter table public.app_profiles
add column if not exists school_day_1 smallint;

alter table public.app_profiles
add column if not exists school_day_2 smallint;

alter table public.app_profiles
add column if not exists block_schedule jsonb not null default '[]'::jsonb;

alter table public.app_profiles
add column if not exists is_active boolean not null default true;

alter table public.weekly_reports
add column if not exists project_name text;

alter table public.weekly_reports
add column if not exists total_adjusted_work_minutes integer not null default 0;

alter table public.weekly_reports
add column if not exists year integer;

alter table public.weekly_reports
add column if not exists kw integer;

alter table public.weekly_reports
add column if not exists abz_typ integer not null default 0;

alter table public.projects
add column if not exists project_lead_profile_id uuid references public.app_profiles(id) on delete set null;

alter table public.projects
add column if not exists construction_lead_profile_id uuid references public.app_profiles(id) on delete set null;

alter table public.projects
add column if not exists allow_expenses boolean not null default true;

create table if not exists public.project_kanban_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'todo' check (status in ('todo', 'planned', 'in_progress', 'review', 'done')),
  position integer not null default 0,
  note_type text not null default 'text' check (note_type in ('text', 'todo', 'counter')),
  content jsonb not null default '[]'::jsonb,
  todo_items jsonb not null default '[]'::jsonb,
  todo_description text not null default '',
  counter_value integer not null default 0,
  counter_start_value integer not null default 1,
  counter_log jsonb not null default '[]'::jsonb,
  counter_description text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  color text check (color in ('green', 'blue', 'yellow', 'red')),
  visible_from_date date,
  created_by_uid uuid references public.app_profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.project_kanban_notes
add column if not exists color text check (color in ('green', 'blue', 'yellow', 'red'));

alter table public.project_kanban_notes
add column if not exists visible_from_date date;

create index if not exists project_kanban_notes_project_status_position_idx
on public.project_kanban_notes (project_id, status, position);

create index if not exists project_kanban_notes_project_visible_from_date_idx
on public.project_kanban_notes (project_id, visible_from_date);



create table if not exists public.school_vacations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_vacations_range_check check (end_date >= start_date)
);

alter table public.app_profiles enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.platform_holidays enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

create table if not exists public.platform_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label text not null,
  is_paid boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.build_holiday_request_history_text(request_row public.holiday_requests)
returns text
language sql
stable
set search_path = public
as $$
  select trim(
    both ' | ' from concat_ws(
      ' | ',
      case
        when request_row.request_type is not null and request_row.request_type <> '' then
          initcap(replace(request_row.request_type, '_', ' '))
        else null
      end,
      case
        when request_row.start_date is not null and request_row.end_date is not null then
          request_row.start_date::text || ' bis ' || request_row.end_date::text
        else null
      end,
      nullif(trim(coalesce(request_row.notes, '')), '')
    )
  );
$$;

create or replace function public.approve_holiday_request(
  p_request_id uuid,
  p_field_name text,
  p_approval_name text
)
returns public.holiday_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.holiday_requests%rowtype;
  updated_request public.holiday_requests%rowtype;
  archive_context text;
begin
  if p_field_name not in ('controll_pl', 'controll_gl') then
    raise exception 'Ungültiges Freigabefeld: %', p_field_name;
  end if;

  select *
  into current_request
  from public.holiday_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Absenzgesuch % wurde nicht gefunden.', p_request_id;
  end if;

  if p_field_name = 'controll_pl' then
    update public.holiday_requests
    set controll_pl = p_approval_name
    where id = p_request_id
    returning * into updated_request;
  else
    update public.holiday_requests
    set controll_gl = p_approval_name
    where id = p_request_id
    returning * into updated_request;
  end if;

  if nullif(trim(coalesce(updated_request.controll_pl, '')), '') is not null
    and nullif(trim(coalesce(updated_request.controll_gl, '')), '') is not null then
    insert into public.weekly_reports (
      profile_id,
      work_date,
      year,
      kw,
      project_name,
      commission_number,
      abz_typ,
      start_time,
      end_time,
      lunch_break_minutes,
      additional_break_minutes,
      total_work_minutes,
      total_adjusted_work_minutes,
      expenses_amount,
      other_costs_amount,
      expense_note,
      notes,
      controll,
      attachments
    )
    select
      updated_request.profile_id,
      work_day::date,
      extract(isoyear from work_day)::integer,
      extract(week from work_day)::integer,
      initcap(replace(coalesce(updated_request.request_type, 'Absenz'), '_', ' ')),
      initcap(replace(coalesce(updated_request.request_type, 'Absenz'), '_', ' ')),
      case lower(coalesce(updated_request.request_type, ''))
        when 'ferien' then 1
        when 'fehlen' then 1
        when 'krankheit' then 2
        when 'militaer' then 3
        when 'zivildienst' then 3
        when 'unfall' then 4
        when 'feiertag' then 5
        when 'uk' then 6
        when 'ük' then 6
        when 'berufsschule' then 7
        else 0
      end,
      '07:00'::time,
      '16:30'::time,
      60,
      30,
      case
        when request_config.has_special_hours
          then round(greatest(0, request_hours.special_hours) * 60.0)::integer
        else greatest(480, round((coalesce(profile.weekly_hours, 40) / 5.0) * 60.0)::integer)
      end,
      case
        when request_config.has_special_hours
          then round(greatest(0, request_hours.special_hours) * 60.0)::integer
        else greatest(480, round((coalesce(profile.weekly_hours, 40) / 5.0) * 60.0)::integer)
      end,
      0,
      0,
      '',
      format('Automatisch aus bestätigter Absenz (%s).', initcap(replace(coalesce(updated_request.request_type, 'Absenz'), '_', ' '))),
      '',
      '[]'::jsonb
    from generate_series(updated_request.start_date, updated_request.end_date, interval '1 day') as work_day
    cross join lateral (
      select case
        when jsonb_typeof(coalesce(updated_request.special_request_hours, '{}'::jsonb)) = 'object'
          then coalesce(updated_request.special_request_hours, '{}'::jsonb) <> '{}'::jsonb
        else false
      end as has_special_hours
    ) request_config
    cross join lateral (
      select case extract(isodow from work_day)::integer
        when 1 then 'Montag'
        when 2 then 'Dienstag'
        when 3 then 'Mittwoch'
        when 4 then 'Donnerstag'
        when 5 then 'Freitag'
        when 6 then 'Samstag'
        when 7 then 'Sonntag'
      end as day_name
    ) day_config
    cross join lateral (
      select case
        when request_config.has_special_hours
          and coalesce(updated_request.special_request_hours ->> day_config.day_name, '') ~ '^\\s*[0-9]+(\\.[0-9]+)?\\s*$'
          then (updated_request.special_request_hours ->> day_config.day_name)::numeric
        else 0
      end as special_hours
    ) request_hours
    left join public.app_profiles profile
      on profile.id = updated_request.profile_id
    where extract(isodow from work_day) between 1 and 5
      and (
        not request_config.has_special_hours
        or request_hours.special_hours > 0
      )
      and not exists (
        select 1
        from public.weekly_reports existing
        where existing.profile_id = updated_request.profile_id
          and existing.work_date = work_day::date
      );

    archive_context := format(
      'Bestätigt durch PL: %s | GL: %s',
      updated_request.controll_pl,
      updated_request.controll_gl
    );

    update public.holiday_requests
    set approval_status = 2
    where id = updated_request.id
    returning * into updated_request;

  end if;

  return updated_request;
end;
$$;

create or replace function public.reject_holiday_request(
  p_request_id uuid,
  p_context text default 'Abgelehnt'
)
returns public.holiday_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.holiday_requests%rowtype;
begin
  update public.holiday_requests
  set approval_status = 0
  where id = p_request_id
  returning * into updated_request;

  if not found then
    raise exception 'Absenzgesuch % wurde nicht gefunden.', p_request_id;
  end if;

  return updated_request;
end;
$$;

drop policy if exists "authenticated full access app_profiles" on public.app_profiles;
drop policy if exists "authenticated full access weekly_reports" on public.weekly_reports;
drop policy if exists "authenticated full access holiday_requests" on public.holiday_requests;
drop policy if exists "authenticated attachment read" on storage.objects;
drop policy if exists "authenticated attachment write" on storage.objects;
drop policy if exists "app_profiles own or admin" on public.app_profiles;
drop policy if exists "app_profiles insert own or admin" on public.app_profiles;
drop policy if exists "app_profiles update own or admin" on public.app_profiles;
drop policy if exists "app_profiles delete own or admin" on public.app_profiles;
drop policy if exists "weekly_reports own or admin" on public.weekly_reports;
drop policy if exists "holiday_requests own or admin" on public.holiday_requests;
drop policy if exists "platform_holidays read authenticated" on public.platform_holidays;
drop policy if exists "platform_holidays write admin" on public.platform_holidays;
drop policy if exists "weekly attachment read own or admin" on storage.objects;
drop policy if exists "weekly attachment write own or admin" on storage.objects;

create policy "app_profiles own or admin"
on public.app_profiles
for select
using (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles insert own or admin"
on public.app_profiles
for insert
with check (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles update own or admin"
on public.app_profiles
for update
using (public.is_admin_user() or auth.uid() = id)
with check (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles delete own or admin"
on public.app_profiles
for delete
using (public.is_admin_user() or auth.uid() = id);

create policy "weekly_reports own or admin"
on public.weekly_reports
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "holiday_requests own or admin"
on public.holiday_requests
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "platform_holidays read authenticated"
on public.platform_holidays
for select
using (auth.role() = 'authenticated');

create policy "platform_holidays write admin"
on public.platform_holidays
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "weekly attachment read own or admin"
on storage.objects
for select
using (
  bucket_id = '${STORAGE_BUCKET}' and (
    public.is_admin_user() or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "weekly attachment write own or admin"
on storage.objects
for all
using (
  bucket_id = '${STORAGE_BUCKET}' and (
    public.is_admin_user() or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = '${STORAGE_BUCKET}' and (
    public.is_admin_user() or auth.uid()::text = split_part(name, '/', 1)
  )
);`;

const demoProfiles = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@maraschow.cn',
    full_name: 'Master Admin',
    role_label: 'Administration',
    is_admin: true,
    is_active: true,
    vacation_allowance_hours: 200,
    booked_vacation_hours: 0,
    reported_hours: 0,
    credited_hours: 0,
    weekly_hours: 40,
    target_revenue: 0,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'michael@example.com',
    full_name: 'Michael Gerber',
    role_label: 'Monteur',
    is_admin: false,
    is_active: true,
    vacation_allowance_hours: 200,
    booked_vacation_hours: 0,
    reported_hours: 0,
    credited_hours: 0,
    weekly_hours: 40,
    target_revenue: 0,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'sandra@example.com',
    full_name: 'Sandra Bühler',
    role_label: 'Monteurin',
    is_admin: false,
    is_active: true,
    vacation_allowance_hours: 200,
    booked_vacation_hours: 0,
    reported_hours: 0,
    credited_hours: 0,
    weekly_hours: 40,
    target_revenue: 0,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'pascal@example.com',
    full_name: 'Pascal Frei',
    role_label: 'Monteur',
    is_admin: false,
    is_active: true,
    target_revenue: 0,
  },
];

const demoWeeklyReports = [
  {
    id: crypto.randomUUID(),
    profile_id: '22222222-2222-2222-2222-222222222222',
    work_date: getDateForWeekOffset(0, 0),
    project_name: 'Neubau Bahnhof Bern',
    commission_number: 'K-1024',
    start_time: '07:00',
    end_time: '17:00',
    lunch_break_minutes: 60,
    additional_break_minutes: 15,
    total_work_minutes: 525,
    total_adjusted_work_minutes: 525,
    expenses_amount: 24.5,
    other_costs_amount: 0,
    expense_note: 'Mittag auf Baustelle',
    notes: 'Leitungen montiert',
    controll: '',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '22222222-2222-2222-2222-222222222222',
    work_date: getDateForWeekOffset(0, 1),
    project_name: 'Neubau Bahnhof Bern',
    commission_number: 'K-1024',
    start_time: '07:15',
    end_time: '16:45',
    lunch_break_minutes: 60,
    additional_break_minutes: 15,
    total_work_minutes: 495,
    total_adjusted_work_minutes: 495,
    expenses_amount: 18,
    other_costs_amount: 0,
    expense_note: 'Spesen',
    notes: 'Abschluss Elektroinstallationen',
    controll: 'Master',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '33333333-3333-3333-3333-333333333333',
    work_date: getDateForWeekOffset(0, 0),
    project_name: 'Sanierung Schulhaus Süd',
    commission_number: 'K-2001',
    start_time: '08:00',
    end_time: '16:30',
    lunch_break_minutes: 45,
    additional_break_minutes: 15,
    total_work_minutes: 450,
    total_adjusted_work_minutes: 450,
    expenses_amount: 12,
    other_costs_amount: 8,
    expense_note: 'Parkhaus',
    notes: 'Serviceeinsatz und Messung',
    controll: '',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '33333333-3333-3333-3333-333333333333',
    work_date: getDateForWeekOffset(0, 3),
    project_name: 'Berufsschule',
    commission_number: '',
    start_time: '00:00',
    end_time: '00:00',
    lunch_break_minutes: 0,
    additional_break_minutes: 0,
    total_work_minutes: 0,
    total_adjusted_work_minutes: 0,
    expenses_amount: 0,
    other_costs_amount: 0,
    expense_note: '',
    notes: 'Ferientag',
    controll: '',
    attachments: [],
  },
];

const demoHolidayRequests = [
  {
    id: crypto.randomUUID(),
    profile_id: '33333333-3333-3333-3333-333333333333',
    start_date: getDateForWeekOffset(0, 3),
    end_date: getDateForWeekOffset(0, 4),
    request_type: 'ferien',
    notes: 'Bereits mit Team abgestimmt.',
    approval_status: 1,
    controll_pl: '',
    controll_gl: '',
    attachments: [],
    created_at: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    profile_id: '22222222-2222-2222-2222-222222222222',
    start_date: getDateForWeekOffset(1, 0),
    end_date: getDateForWeekOffset(1, 2),
    request_type: 'militaer',
    notes: 'WK laut Aufgebot.',
    approval_status: 1,
    controll_pl: '',
    controll_gl: '',
    attachments: [],
    created_at: new Date().toISOString(),
  },
];

const demoRequestHistory = [];
const demoPlatformHolidays = [];

const state = {
  supabase: null,
  supabaseAnonKey: '',
  missingReportsCallWebhookUrl: DEFAULT_MISSING_REPORTS_CALL_WEBHOOK_URL,
  session: null,
  user: null,
  currentProfile: null,
  profiles: [],
  weeklyReports: [],
  futureVacationReports: [],
  projects: [],
  roleAssignments: [],
  dailyAssignments: [],
  holidayRequests: [],
  requestHistory: [],
  platformHolidays: [],
  schoolVacations: [],
  selectedWeek: getCurrentWeekValue(),
  currentPage: 'reports',
  projectSearchQuery: '',
  editingProjectId: null,
  isSavingProject: false,
  isSavingDispo: false,
  dispoAssignContext: null,
  dispoAllowMultiplePerDay: true,
  selectedProjectId: null,
  reportColumnFilter: { type: 'none', values: [] },
  reportsSortMode: 'date_desc',
  showControlledReports: false,
  absenceFilterQuery: '',
  selectedAbsenceEmployeeIds: [],
  absenceSelectionInitialized: false,
  absenceSelectionTouched: false,
  showControlledAbsences: false,
  includeConfirmationHistory: false,
  showPastAbsences: false,
  isAbsenceInfoModalOpen: false,
  absenceInfoRequestId: null,
  isAbsenceInfoLoading: false,
  absenceInfoError: '',
  absenceInfoSummary: null,
  isBulkConfirmModalOpen: false,
  bulkConfirmWeekdayFilter: '',
  bulkConfirmCommissionFilter: '',
  isBulkConfirmSaving: false,
  bulkConfirmResultMessage: '',
  bulkConfirmResultIsError: false,
  isMissingReportsCallModalOpen: false,
  isMissingReportsCallSubmitting: false,
  missingReportsCallResultMessage: '',
  missingReportsCallResultIsError: false,
  reportsPage: 1,
  reportsPerPage: 20,
  editingReportId: null,
  editingReportPauseMinutes: 0,
  isSavingReport: false,
  isDemoMode: false,
  hasAdminAccess: false,
  isAdminStatusResolved: false,
  configReady: false,
  authListenerBound: false,
  isLoadingData: false,
  isSavingAbsence: false,
  isSavingConfirmation: false,
  isSavingSettings: false,
  isSchoolVacationImportRunning: false,
  schoolVacationImportStepIndex: -1,
  isHolidayImportRunning: false,
  holidayImportStepIndex: -1,
  editingHolidayId: null,
  isLoadingOverlayVisible: false,
  loadingOverlayReason: '',
  loadingOverlayTimer: null,
  loadingTaskDepth: 0,
  editingAdjustedReportId: null,
  loadRequestId: 0,
  loadStartedAt: 0,
  tabHiddenAt: 0,
  loadRecoveryTimer: null,
  lastResumeRefreshAt: 0,
  pendingDataReload: false,
};

const elements = {};
const STALE_LOADING_TIMEOUT_MS = 4000;
const LOAD_WATCHDOG_TIMEOUT_MS = 10000;
const LONG_TASK_OVERLAY_DELAY_MS = 550;
const RESUME_REFRESH_COOLDOWN_MS = 1500;

function buildSupportedHolidayImportYears() {
  const currentYear = new Date().getUTCFullYear();
  return new Set(Array.from({ length: 5 }, (_, index) => String(currentYear + index)));
}

// Diese Funktionen werden für Top-Level-Demo- und Import-Defaults benötigt,
// bevor die restlichen Utility-Dateien geladen sind. Die vollständigen Helfer
// werden später in src/utils/date-utils.js erneut bereitgestellt.
function getCurrentWeekValue() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekRange(weekValue) {
  const [yearPart, weekPart] = weekValue.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const monday = new Date(simple);
  if (dayOfWeek <= 4) {
    monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getDateForWeekOffset(weekOffset, dayOffset) {
  const currentRange = getWeekRange(getCurrentWeekValue());
  const monday = new Date(`${currentRange.start}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + weekOffset * 7 + dayOffset);
  return monday.toISOString().slice(0, 10);
}
