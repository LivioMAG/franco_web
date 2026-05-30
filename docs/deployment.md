# Deployment

Die App kann als statische Website ausgeliefert werden.

## Lokale Konfiguration

1. `config/supabase-config.example.json` nach `config/supabase-config.json` kopieren.
2. Supabase-Projekt-URL und Anon-Key eintragen.
3. Einen statischen Webserver im Repository-Root starten, z. B. `python3 -m http.server 4173`.

## Produktive Umgebung

Die Datei `config/supabase-config.json` muss in der Zielumgebung vorhanden sein, darf aber keine geheimen Service-Role-Keys enthalten. Die Datenbankstruktur wird über das konsolidierte Stamm-SQL `supabase/schema.sql` gepflegt; separate SQL-Migrationen liegen nicht mehr im Repository.
