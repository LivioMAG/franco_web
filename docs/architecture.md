# Architektur

Die Anwendung bleibt eine statische Vanilla-JavaScript-Web-App ohne Frontend-Framework.

## Aktueller Schnitt

- `index.html` enthält die unveränderte statische Oberfläche.
- `styles/` enthält das bisherige Styling in der ursprünglichen Cascade-Reihenfolge, aufgeteilt in Basis-, Komponenten-, Layout- und Seitendateien.
- `src/app.js` enthält nur noch Bootstrap, DOM-Caching und Event-Bindings. Die übrige Laufzeitlogik ist in Konstanten, Services, Modulen, UI-Helfern und Utilities abgelegt.

## Zielmodule

Die Dateien unter `src/services/`, `src/modules/`, `src/ui/` und `src/utils/` übernehmen die zuvor zentrale Logik aus `script.js`, ohne die DOM-Struktur oder das sichtbare Verhalten zu ändern. Weitere Extraktionen können auf dieser Struktur aufbauen.
