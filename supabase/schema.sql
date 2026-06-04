create extension if not exists pgcrypto;

-- Consolidated Supabase schema for a freshly provisioned Supabase database.
-- Run this file once in the Supabase SQL editor after creating a new project.
-- The file intentionally contains only the current target schema and no legacy
-- migration/cleanup steps for previously used database structures.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role_label text not null default 'Monteur',
  is_admin boolean not null default false,
  is_active boolean not null default true,
  vacation_allowance_hours numeric(10,2) not null default 0,
  booked_reported_hours numeric(10,2) not null default 0,
  booked_vacation_hours numeric(10,2) not null default 0,
  booked_vacations_hours numeric(10,2) not null default 0,
  booked_unpaid_holiday_hours numeric(10,2) not null default 0,
  reported_hours numeric(10,2) not null default 0,
  credited_hours numeric(10,2) not null default 0,
  weekly_hours numeric(10,2) not null default 40,
  target_revenue numeric(12,2) not null default 0,
  school_day_1 smallint,
  school_day_2 smallint,
  block_schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  commission_number text not null,
  name text not null,
  allow_expenses boolean not null default true,
  project_lead_profile_id uuid references public.app_profiles(id) on delete set null,
  construction_lead_profile_id uuid references public.app_profiles(id) on delete set null,
  street text,
  postal_code text,
  city text,
  has_barrack boolean not null default false,
  has_lunch_break boolean not null default false,
  workday_start_time time,
  workday_end_time time,
  project_contacts jsonb not null default '[]'::jsonb,
  project_documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  work_date date not null,
  year integer,
  kw integer,
  abz_typ integer not null default 0,
  project_name text,
  commission_number text not null,
  start_time time not null default '07:00',
  end_time time not null default '16:30',
  lunch_break_minutes integer not null default 60,
  additional_break_minutes integer not null default 30,
  total_work_minutes integer not null default 0,
  total_adjusted_work_minutes integer not null default 0,
  expenses_amount numeric(10,2) not null default 0,
  other_costs_amount numeric(10,2) not null default 0,
  expense_note text,
  notes text,
  controll text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  request_type text not null check (request_type in ('ferien', 'militaer', 'zivildienst', 'unfall', 'krankheit', 'feiertag')),
  notes text,
  controll_pl text,
  controll_gl text,
  approval_status smallint not null default 1 check (approval_status in (0, 1, 2)),
  special_request_hours jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint holiday_requests_range_check check (end_date >= start_date)
);

create table if not exists public.request_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  request text not null,
  context text not null,
  linked_weekly_report_ids jsonb not null default '[]'::jsonb
);

create table if not exists public.daily_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  assignment_date date not null,
  project_id uuid references public.projects(id) on delete set null,
  label text not null,
  source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_assignments_unique_profile_day unique (profile_id, assignment_date)
);

create table if not exists public.platform_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label text not null,
  is_paid boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.school_vacations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_vacations_range_check check (end_date >= start_date)
);

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

create or replace function public.build_holiday_request_history_text(request_row public.holiday_requests)
returns text
language sql
stable
set search_path = public
as $$
  select trim(
    both ' | ' from concat_ws(
      ' | ',
      coalesce(request_row.request_type, 'Absenzantrag'),
      case
        when request_row.start_date is not null and request_row.end_date is not null
          then request_row.start_date::text || ' bis ' || request_row.end_date::text
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
            and coalesce(updated_request.special_request_hours ->> day_config.day_name, '') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
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

create or replace function public.purge_user_account(
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  if p_profile_id is null then
    raise exception 'Profil-ID fehlt.';
  end if;
  if not public.is_admin_user() then
    raise exception 'Nur Admin darf Benutzer restlos entfernen.';
  end if;
  if auth.uid() = p_profile_id then
    raise exception 'Eigenes Profil kann nicht gelöscht werden.';
  end if;

  delete from public.request_history where profile_id = p_profile_id;
  delete from public.holiday_requests where profile_id = p_profile_id;
  delete from public.weekly_reports where profile_id = p_profile_id;
  delete from public.daily_assignments where profile_id = p_profile_id;

  -- Storage files must be deleted through the Storage API (client-side/admin flow).
  delete from auth.users
  where id = p_profile_id;
end;
$$;

create or replace function public.report_is_confirmed(p_controll text)
returns boolean
language sql
immutable
as $$
  select nullif(trim(coalesce(p_controll, '')), '') is not null
$$;

create or replace function public.weekly_report_confirmation_value(p_report public.weekly_reports)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(p_report.controll, '')), '')
$$;

create or replace function public.cleanup_confirmed_request_history_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked_ids uuid[];
begin
  if old.profile_id is null then
    return old;
  end if;

  select array_agg(value::uuid)
  into v_linked_ids
  from jsonb_array_elements_text(coalesce(old.linked_weekly_report_ids, '[]'::jsonb));

  if coalesce(array_length(v_linked_ids, 1), 0) > 0 then
    delete from public.weekly_reports
    where profile_id = old.profile_id
      and id = any(v_linked_ids);
  end if;

  return old;
end;
$$;

create or replace function public.prevent_confirmed_weekly_report_changes()
returns trigger
language plpgsql
as $$
declare
  v_old_payload jsonb;
  v_new_payload jsonb;
begin
  if not public.report_is_confirmed(old.controll) then
    return new;
  end if;

  v_old_payload := to_jsonb(old) - 'updated_at';
  v_new_payload := to_jsonb(new) - 'updated_at';

  if v_old_payload = v_new_payload then
    return new;
  end if;

  raise exception 'Bestätigte Wochenrapporte sind gesperrt und dürfen nicht mehr bearbeitet werden.';
end;
$$;

create unique index if not exists projects_commission_number_idx on public.projects (commission_number);
create index if not exists weekly_reports_profile_work_date_idx on public.weekly_reports (profile_id, work_date);
create index if not exists weekly_reports_year_kw_idx on public.weekly_reports (year, kw);
create index if not exists holiday_requests_profile_dates_idx on public.holiday_requests (profile_id, start_date, end_date);
create index if not exists request_history_profile_created_at_idx on public.request_history (profile_id, created_at desc);
create index if not exists daily_assignments_profile_date_idx on public.daily_assignments (profile_id, assignment_date);

alter table public.app_profiles enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.request_history enable row level security;
alter table public.daily_assignments enable row level security;
alter table public.platform_holidays enable row level security;
alter table public.school_vacations enable row level security;
alter table public.projects enable row level security;

drop policy if exists "app_profiles own or admin" on public.app_profiles;
drop policy if exists "app_profiles insert own or admin" on public.app_profiles;
drop policy if exists "app_profiles update own or admin" on public.app_profiles;
drop policy if exists "app_profiles delete own or admin" on public.app_profiles;
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

drop policy if exists "weekly_reports own or admin" on public.weekly_reports;
create policy "weekly_reports own or admin"
on public.weekly_reports
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

drop policy if exists "holiday_requests own or admin" on public.holiday_requests;
create policy "holiday_requests own or admin"
on public.holiday_requests
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

drop policy if exists "request_history own or admin" on public.request_history;
create policy "request_history own or admin"
on public.request_history
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

drop policy if exists "daily_assignments own or admin" on public.daily_assignments;
create policy "daily_assignments own or admin"
on public.daily_assignments
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

drop policy if exists "platform_holidays read authenticated" on public.platform_holidays;
drop policy if exists "platform_holidays write admin" on public.platform_holidays;
create policy "platform_holidays read authenticated"
on public.platform_holidays
for select
using (auth.role() = 'authenticated');
create policy "platform_holidays write admin"
on public.platform_holidays
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "school_vacations admin access" on public.school_vacations;
create policy "school_vacations admin access"
on public.school_vacations
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "projects own or admin" on public.projects;
create policy "projects own or admin"
on public.projects
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop trigger if exists set_updated_at_app_profiles on public.app_profiles;
create trigger set_updated_at_app_profiles
before update on public.app_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_weekly_reports on public.weekly_reports;
create trigger set_updated_at_weekly_reports
before update on public.weekly_reports
for each row execute function public.set_updated_at();

drop trigger if exists prevent_confirmed_weekly_report_changes on public.weekly_reports;
create trigger prevent_confirmed_weekly_report_changes
before update on public.weekly_reports
for each row execute function public.prevent_confirmed_weekly_report_changes();

drop trigger if exists cleanup_confirmed_request_history_booking on public.request_history;
create trigger cleanup_confirmed_request_history_booking
after delete on public.request_history
for each row execute function public.cleanup_confirmed_request_history_booking();

drop trigger if exists set_updated_at_holiday_requests on public.holiday_requests;
create trigger set_updated_at_holiday_requests
before update on public.holiday_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_daily_assignments on public.daily_assignments;
create trigger set_updated_at_daily_assignments
before update on public.daily_assignments
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_school_vacations on public.school_vacations;
create trigger set_updated_at_school_vacations
before update on public.school_vacations
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('weekly-attachments', 'weekly-attachments', true)
on conflict (id) do nothing;
drop policy if exists "weekly attachment read own or admin" on storage.objects;
drop policy if exists "weekly attachment write own or admin" on storage.objects;

create policy "weekly attachment read own or admin"
on storage.objects
for select
using (
  bucket_id = 'weekly-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "weekly attachment write own or admin"
on storage.objects
for all
using (
  bucket_id = 'weekly-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'weekly-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);
