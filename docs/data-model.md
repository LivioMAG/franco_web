# Datenmodell

Das Referenzschema liegt in `supabase/schema.sql`. Chronologische Änderungen liegen unter `supabase/migrations/`.

## Wichtige Bereiche

- Supabase Auth und `app_profiles` für Benutzerprofile und Admin-Rechte.
- `weekly_reports` für Wochenrapport-Einträge.
- `holiday_requests`, `platform_holidays` und `school_vacations` für Ferien, Absenzen und automatische Kalendereinträge.
- Projekt- und Dispo-Tabellen für Auftragsverwaltung und Planung.

RLS- und Storage-Policies werden im Schema dokumentiert und müssen im Supabase-Projekt angewendet werden.
