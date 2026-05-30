# Datenmodell

Das Referenzschema liegt als konsolidiertes Stamm-SQL in `supabase/schema.sql`. Chronologische SQL-Migrationen wurden in dieses eine Schema zusammengeführt.

## Wichtige Bereiche

- Supabase Auth und `app_profiles` für Benutzerprofile und Admin-Rechte.
- `weekly_reports` für Wochenrapport-Einträge.
- `holiday_requests`, `platform_holidays` und `school_vacations` für Ferien, Absenzen und automatische Kalendereinträge.
- Projekt- und Dispo-Tabellen für Auftragsverwaltung und Planung.

RLS- und Storage-Policies werden im Schema dokumentiert und müssen im Supabase-Projekt angewendet werden.
