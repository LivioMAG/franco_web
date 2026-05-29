-- Fix absence approval on PostgreSQL versions that do not provide jsonb_object_length(jsonb).
-- Recreate the approval RPC with a portable non-empty JSONB object check.

alter table public.holiday_requests
add column if not exists special_request_hours jsonb not null default '{}'::jsonb;

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
