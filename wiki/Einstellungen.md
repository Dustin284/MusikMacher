# Einstellungen

Die Einstellungen ermoeglichen die vollstaendige Anpassung der App an deine Beduerfnisse.

## Zugriff

Wechsle zum **Einstellungen**-Tab in der Hauptnavigation.

## Allgemein

### Sprache

| Option | Beschreibung |
|--------|-------------|
| Deutsch (de-DE) | Deutsche Benutzeroberflaeche |
| English (en-US) | Englische Benutzeroberflaeche |

Die Sprachaenderung wirkt sich sofort auf die gesamte App aus.

### Theme

| Option | Beschreibung |
|--------|-------------|
| Dark | Dunkles Farbschema |
| Light | Helles Farbschema |
| System | Passt sich der Systemeinstellung an |

### Fenstertitel

Der Titel des App-Fensters kann frei konfiguriert werden.

## Wiedergabe

### Skip-Wert

Der Wert, um den beim Vor-/Zurueckspulen (Pfeiltasten) gesprungen wird:

- Standard: 10% der Tracklaenge
- Konfigurierbar in den Einstellungen

### Crossfade

Die Dauer des Uebergangs zwischen zwei Tracks:

| Wert | Beschreibung |
|------|-------------|
| 0 Sekunden | Kein Crossfade (sofortiger Wechsel) |
| 1-10 Sekunden | Sanfter Uebergang |

### Effekt-Verhalten

Konfiguriert, wie sich Effekte beim Trackwechsel verhalten.

## Tastenkuerzel

Siehe [[Tastenkuerzel]] fuer die vollstaendige Dokumentation.

- Alle Shortcuts koennen per Recording-Modus angepasst werden
- Reset-Button stellt Standard-Shortcuts wieder her

## Sichtbare Spalten

Konfiguriert, welche Spalten in der Track-Tabelle angezeigt werden:

| Spalte | Standard |
|--------|---------|
| Dauer | Sichtbar |
| BPM | Sichtbar |
| Tonart | Sichtbar |
| Bewertung | Sichtbar |
| Tags | Sichtbar |
| Kommentar | Sichtbar |

## Lyrics

### Bevorzugte Quelle

| Quelle | Beschreibung |
|--------|-------------|
| lyrics.ovh | Kostenlose API, keine Konfiguration noetig |
| LRCLIB | Synchronisierte Lyrics (LRC-Format) |
| Genius | Umfangreiche Datenbank, optional mit API-Key |

### Genius API-Key

Fuer erweiterte Genius-Funktionen kann ein API-Key eingegeben werden.

## AcoustID

### API-Key

Fuer die Audio-Fingerprinting-Funktion wird ein AcoustID API-Key benoetigt:

1. Erstelle einen kostenlosen Account auf [acoustid.org](https://acoustid.org)
2. Generiere einen API-Key
3. Trage den Key in den Einstellungen ein

## Auto-Update

### GitHub Repository

Das Repository fuer die Update-Pruefung kann konfiguriert werden:

- Standard: `Dustin284/MusikMacher`
- Format: `Benutzername/Repository`

Die App prueft beim Start automatisch auf neue Versionen.

## Export / Import

### Einstellungen exportieren

1. Klicke auf **Einstellungen exportieren**
2. Waehle einen Speicherort
3. Die Einstellungen werden als JSON-Datei gespeichert

Exportierte Daten umfassen:
- Theme und Sprache
- Tastenkuerzel
- Wiedergabe-Einstellungen
- Sichtbare Spalten
- Lyrics-Konfiguration

### Einstellungen importieren

1. Klicke auf **Einstellungen importieren**
2. Waehle eine zuvor exportierte JSON-Datei
3. Die Einstellungen werden uebernommen

> **Hinweis:** Der Import ueberschreibt die aktuellen Einstellungen. Es wird empfohlen, vorher einen Export als Backup zu erstellen.

## Log-Viewer

Die App bietet einen integrierten Log-Viewer fuer die Fehlersuche:

- Zeigt die letzten 500 Log-Eintraege
- Log-Eintraege werden im Speicher gehalten (Ring-Buffer)
- Logs werden auch in `%APPDATA%/Lorus Musik Macher/app.log` geschrieben

### Log oeffnen

Der Log-Viewer ist ueber die Einstellungen oder per Rechtsklick auf die Titelleiste erreichbar.
