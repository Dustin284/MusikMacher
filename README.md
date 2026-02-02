# Lorus Musik Macher

Desktop-Anwendung zur Verwaltung von Musik- und Effekt-Bibliotheken, optimiert fuer den Einsatz mit Adobe Premiere Pro.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## Features

### Bibliothek-Verwaltung

- Mehrere Bibliotheken (Songs, Effekte + eigene erstellen)
- Standard-Bibliotheken "Songs" und "Effekte" sind geschuetzt (nicht loeschbar)
- Import von MP3, WAV, M4A, OGG, FLAC, WebM
- Automatische BPM- und Tonart-Erkennung via Web Audio API
- Album-Cover-Extraktion aus ID3-Tags
- Waveform-Visualisierung pro Track
- 5-Sterne Bewertungssystem (inline in der Trackliste + Kontextmenue)
- Kommentare und Tags pro Track
- Smart Tags mit konfigurierbaren Regeln
- Duplikat-Erkennung (gruppiert nach normalisiertem Tracknamen)
- Sortierung nach Name, BPM, Tonart, Laenge, Bewertung, Erstelldatum
- Drag & Drop in Adobe Premiere Pro (nativer Electron-Drag)

### Player

- Waveform-basiertes Seeking
- 9 Cue-Points pro Track (Shift+1-9 setzen, 1-9 springen) mit farbkodierten Markern
- Playback-Geschwindigkeit (0.25x - 3.0x) mit +/- Steuerung
- A-B Loop (Punkt A setzen, Punkt B setzen, Loop laeuft automatisch)
- Warteschlange mit Auto-Play (naechster Track startet automatisch)
- Crossfade zwischen Tracks (konfigurierbare Dauer 0-10s)
- 3-Band Equalizer (Bass 200 Hz, Mid 1 kHz, Treble 4 kHz, -12 bis +12 dB)
- Pitch-Shift in Halbtonschritten (-6 bis +6)
- Lyrics-Anzeige (lyrics.ovh, Genius, LRCLIB)
- LRC Sync-Modus
- Genius-Lyrics via Scraping (3 Extraktions-Strategien)

### Statistik-Dashboard

- Tracks gesamt, Gesamtdauer, Wiedergaben, Durchschnittsbewertung
- Meistgespielte Tracks mit Play-Count-Badges
- BPM-Verteilung, Tonart-Verteilung, Bewertungsverteilung als Balkendiagramme
- Tag-Nutzung (Top 15) und Premiere-Pro-Projekt-Nutzung
- Zuletzt hinzugefuegte Tracks und Bibliotheken-Aufschluesselung
- Automatisches Tracking der Wiedergabe-Anzahl pro Track

### Premiere Pro Integration

- `.prproj` Projekt-Dateien laden und analysieren
- YouTube-Timestamps generieren (mit Clip-Include/Exclude)
- EDL Export im CMX3600 Format
- Track-Nutzung pro Projekt verfolgen
- Filter: nur Track 1 / nur Bibliothek-Tracks
- Abgleich mit Bibliothek (gruener Punkt fuer vorhandene Tracks)

### Import & Download

- Dateien und Ordner importieren
- Unterordner-Namen als Tags importieren
- Gespeicherte Import-Orte mit Sync
- YouTube-Download via yt-dlp
- SoundCloud-Download via yt-dlp
- Spotify-Download (Spotify oEmbed API + yt-dlp YouTube-Suche)
- Automatische yt-dlp-Installation von GitHub Releases
- Automatische ffmpeg/ffprobe-Installation
- Fortschrittsanzeige mit Phasen (Download, Konvertierung, Metadata, Thumbnail)
- Plattform-Erkennung mit Icons (YouTube rot, SoundCloud orange, Spotify gruen)

### Batch-Operationen

- Mehrfachauswahl via Ctrl+Klick
- Batch-Leiste: Alle auswaehlen, Abwaehlen, Zur Warteschlange hinzufuegen, Bewerten, Loeschen
- Visuelle Hervorhebung ausgewaehlter Tracks

### Anpassbarkeit

- Eigene Tastenkuerzel mit Recording-Modus (Taste druecken zum Zuweisen)
- Tastenkuerzel-Uebersicht (Shift+?)
- Zuruecksetzen auf Standard-Shortcuts
- Projekt-Verwaltung (mehrere Projekte, Projekt-Filter)
- Deutsch / English
- Dark / Light / System Theme
- Konfigurierbarer Fenstertitel
- Konfigurierbarer Skip-Wert (Vor-/Zurueckspulen)
- Einstellungen Export / Import als JSON-Datei

### Auto-Update

- Automatischer Update-Check beim Start via GitHub Releases API
- Update-Banner mit Versions-Anzeige
- In-App Download und Installation (kein Browser noetig)
- Changelog-Modal mit Markdown-Rendering (Ueberschriften, Listen, Code, Trennlinien)
- Konfigurierbares GitHub-Repository in den Einstellungen

## Installation

### Voraussetzungen

- [Node.js](https://nodejs.org/) >= 18
- npm

### Setup

```bash
git clone https://github.com/Dustin284/MusikMacher.git
cd MusikMacher
npm install
```

### Entwicklung

```bash
# Web-Entwicklung (ohne Electron)
npm run dev

# Electron-Entwicklung
npm run electron:dev
```

### Build

```bash
# Windows Installer (.exe)
npm run electron:build:win

# Alle Plattformen
npm run electron:build
```

Der Installer wird im `release/` Ordner erstellt.

## Tastenkuerzel

| Aktion | Taste |
|---|---|
| Play / Pause | `Space` |
| Vorspulen | `ArrowRight` |
| Zurueckspulen | `ArrowLeft` |
| Lauter / Leiser | `ArrowUp` / `ArrowDown` |
| Cue-Point springen | `1` - `9` |
| Cue-Point setzen | `Shift+1` - `Shift+9` |
| Schneller / Langsamer | `Ctrl+ArrowUp` / `Ctrl+ArrowDown` |
| Normalgeschwindigkeit | `Ctrl+0` |
| A-B Loop | `B` |
| Equalizer | `E` |
| Pitch hoch / runter | `Shift+ArrowUp` / `Shift+ArrowDown` |
| Pitch zuruecksetzen | `Shift+0` |
| Warteschlange | `Q` |
| Lyrics | `L` |
| Suchen | `Ctrl+F` |
| Tastenkuerzel-Uebersicht | `Shift+?` |

Alle Tastenkuerzel koennen in den Einstellungen angepasst werden.

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **UI:** Tailwind CSS 4 + Headless UI
- **State:** Zustand
- **Datenbank:** Dexie (IndexedDB)
- **Desktop:** Electron 33
- **Build:** Vite 6 + electron-builder
- **Audio:** Web Audio API (BPM, Tonart, Waveform)
- **Download:** yt-dlp + ffmpeg (automatisch installiert)
- **Lyrics:** lyrics.ovh, LRCLIB, Genius (Scraping)

## Daten & Cache

Die App speichert Daten an folgenden Orten:

| Daten | Speicherort |
|---|---|
| Tracks, Tags, Einstellungen | IndexedDB (`LorusMusikmacherDB`) |
| Audio-Dateien Cache | `%APPDATA%/Lorus Musik Macher/audio/` |
| Waveform Cache | `%APPDATA%/Lorus Musik Macher/waveforms/` |
| yt-dlp, ffmpeg Binaries | `%APPDATA%/Lorus Musik Macher/bin/` |
| Logs | `%APPDATA%/Lorus Musik Macher/app.log` |

**App zuruecksetzen:** IndexedDB loeschen (DevTools > Application > IndexedDB) und den `%APPDATA%/Lorus Musik Macher/` Ordner entfernen.

## Lizenz

Privat - Alle Rechte vorbehalten.
