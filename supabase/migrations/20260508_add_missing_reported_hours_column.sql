-- Ensure legacy environments have the columns required by confirmation booking.
-- Fixes errors like: column "reported_hours" does not exist.

alter table public.app_profiles
add column if not exists reported_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists booked_vacation_hours numeric(10,2) not null default 0;
