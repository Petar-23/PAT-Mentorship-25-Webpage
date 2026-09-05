# Mentorship 2.0 — Designstand

Die Mentorship erhält eine ruhige Lernoberfläche mit dem bestehenden PAT-Logo, klarer Navigation, größeren lesbaren Texten und einer eigenen redaktionellen Bildwelt aus Chart, Papier und Perspektive.

## Gestaltung

Die neutrale Palette übernimmt die öffentlich dokumentierten Werte der [Anthropic-Website](https://www.anthropic.com/). Quelle ist das am 5. September 2026 gelesene [Stylesheet](https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/css/ant-brand.shared.98f12961d.min.css).

| Rolle | Hell | Dunkel |
| --- | --- | --- |
| Hintergrund | Ivory Light, #faf9f5 | Slate Dark, #141413 |
| Navigation | Ivory Medium, #f0eee6 | Slate Dark, #141413 |
| Hervorgehobene Fläche | Oat, #e3dacc | Slate Medium, #3d3d3a |
| Text | Slate Dark, #141413 | Ivory Light, #faf9f5 |
| Sekundärtext | Slate Light, #5e5d59 | Cloud Medium, #b0aea5 |

Anthropic Sans und Anthropic Serif werden auf ausdrücklichen Wunsch zunächst in der lokalen Vorschau ausprobiert. Die privaten Vorschau-Fontdateien liegen außerhalb des Produktionsrepositories. Die Oberfläche nimmt Schriftfamilien über `--font-mentorship-sans` und `--font-mentorship-serif` an; ohne diese Definitionen verwendet sie das vorhandene Geist und Georgia.

Kantenglättung, Kerning, optische Größenanpassung und deaktivierte dekorative Ligaturen entsprechen den Einstellungen des vorhandenen privaten Obsidian-Themes „Claude Desktop“. Navigation verwendet Sans, längere Lesetexte und Begrüßung Serif. Das PAT-Logo bleibt das bekannte orangefarbene Motiv.

Originale Bildmotive und Generierungsprompts: [MENTORSHIP_ARTWORK.md](MENTORSHIP_ARTWORK.md). Die drei WebP-Dateien umfassen zusammen rund 146 KB. Vorhandene Kursbilder behalten Vorrang vor den neuen Standardmotiven.

## Bedienung

Ein Menü im Kopfbereich führt auf Smartphone und Tablet durch alle Kurse, eigene Seiten, Community und Indikatoren. Ab 1280 Pixeln bleibt die Navigation als Seitenleiste sichtbar. In der Lektionsansicht steht ab 1024 Pixeln zusätzlich die Inhaltsübersicht neben dem Video.

Ein Modul öffnet mobil zunächst seine Inhaltsübersicht. Direkte Lektionslinks öffnen den Player. Fortschrittsanzeige, Abschluss, PDF-Unterlagen und der Wechsel zur nächsten Lektion verwenden die bestehenden Daten und Aktionen. Die Modulsuche filtert die bereits geladenen Titel und Beschreibungen.

Die Darstellung wird als Präferenz gespeichert und bereits beim ersten serverseitigen Rendern berücksichtigt. Bewegungen sind kurz und respektieren `prefers-reduced-motion`.

## Umfang und Vereinfachung

Die früheren Banner, verschachtelten Karten, pro Seite wiederholten Menüknöpfe und Videominiaturen in jeder Lektionszeile entfallen. Die neue Oberfläche verwendet die vorhandenen Phosphor-Icons und CSS; sie benötigt keine neue Laufzeitbibliothek. Das gemeinsame Daten-Caching, die Zugangskontrollen und die Server-Aktionen bleiben bestehen.

Die lokale Vorschau zeigt echte UI-Komponenten mit Beispieldaten. Sie enthält keine echten Kontoaktionen oder privaten Lernvideos. Originalschriften sind Teil dieses lokalen Gestaltungsvergleichs; sie sind in diesem Branch nicht als Produktionsassets enthalten.
