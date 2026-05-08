-- Fix confirmation booking on instances where legacy singular vacation column is missing.
-- Trigger function updates both `booked_vacations_hours` and `booked_vacation_hours`.

alter table public.app_profiles
add column if not exists booked_vacation_hours numeric(10,2) not null default 0;
