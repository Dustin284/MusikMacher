# Lyrics

Lorus Musik Macher bietet eine integrierte Lyrics-Anzeige mit Synchronisierungsfunktion und mehreren Datenquellen.

## Lyrics-Panel

Das Lyrics-Panel wird mit **L** oder dem Lyrics-Button im Player geoeffnet.

### Funktionen

- Anzeige der Lyrics zum aktuellen Track
- Automatisches Scrollen zur aktuellen Zeile (bei synchronisierten Lyrics)
- Manuelle Bearbeitung der Lyrics
- LRC-Import und -Export

## Lyrics-Quellen

Die App kann Lyrics aus drei Quellen beziehen:

| Quelle | Beschreibung | Konfiguration |
|--------|-------------|---------------|
| [lyrics.ovh](https://lyrics.ovh) | Kostenlose Lyrics-API | Standard, keine Konfiguration noetig |
| [LRCLIB](https://lrclib.net) | Synchronisierte LRC-Lyrics | Keine Konfiguration noetig |
| [Genius](https://genius.com) | Umfangreiche Lyrics-Datenbank | Optional: API-Key in Einstellungen |

Die bevorzugte Quelle kann in den [[Einstellungen]] konfiguriert werden.

### Genius-Scraping

Fuer Genius nutzt die App 3 verschiedene Extraktionsstrategien:

1. Strukturierte Extraktion ueber CSS-Selektoren
2. Fallback-Extraktion ueber alternative Selektoren
3. Text-basierte Extraktion als letzter Fallback

Die Lyrics werden ueber den Electron-Hauptprozess abgerufen, um CORS-Einschraenkungen zu umgehen.

## LRC-Format

LRC (Lyrics) ist ein Format fuer zeitgestempelte Liedtexte. Beispiel:

```
[00:12.50]Erste Zeile des Songs
[00:15.30]Zweite Zeile
[00:18.80]Dritte Zeile
```

### Unterstuetzte Formate

Der LRC-Parser unterstuetzt verschiedene Zeitstempel-Formate:

| Format | Beispiel |
|--------|---------|
| mm:ss.xx | `[01:23.45]` |
| mm:ss.xxx | `[01:23.456]` |
| mm:ss | `[01:23]` |

Mehrere Zeitstempel pro Zeile werden ebenfalls unterstuetzt.

### LRC importieren

1. Oeffne das Lyrics-Panel (**L**)
2. Klicke auf **LRC importieren**
3. Waehle eine `.lrc`-Datei
4. Die synchronisierten Lyrics werden geladen

### LRC exportieren

1. Oeffne das Lyrics-Panel (**L**)
2. Klicke auf **LRC exportieren**
3. Waehle einen Speicherort
4. Die Lyrics werden als `.lrc`-Datei gespeichert

## Sync-Modus

Der Sync-Modus ermoeglicht es, Lyrics manuell mit der Musik zu synchronisieren:

1. Oeffne das Lyrics-Panel (**L**)
2. Gib die Lyrics ein (eine Zeile pro Textzeile)
3. Aktiviere den **Sync-Modus**
4. Starte die Wiedergabe
5. Druecke fuer jede Zeile die Sync-Taste, wenn die Zeile gesungen wird
6. Die Zeitstempel werden automatisch zugewiesen

## Automatisches Scrollen

Bei synchronisierten Lyrics (LRC) scrollt das Lyrics-Panel automatisch zur aktuellen Zeile:

- Die aktuelle Zeile wird hervorgehoben
- Das Panel scrollt sanft mit
- Manuelles Scrollen pausiert das Auto-Scrolling voruebergehend
