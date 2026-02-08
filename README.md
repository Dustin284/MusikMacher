# Lorus Musik Macher

Desktop-Anwendung zur Verwaltung von Musik- und Effekt-Bibliotheken, optimiert fuer den Einsatz mit Adobe Premiere Pro und Live-Streaming.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
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
- Audio-Fingerprinting via AcoustID / Chromaprint
- Sortierung nach Name, BPM, Tonart, Laenge, Bewertung, Erstelldatum
- Projekt-System: Tracks einem Projekt zuordnen, Filter nach Projekt, Auto-Zuordnung beim Import
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
- Reverb-Effekt (3 Raumgroessen: Klein, Mittel, Gross)
- Kompressor (Threshold, Ratio, Attack, Release, Knee)
- Audio-Visualizer (FFT-Spektrum)
- Lyrics-Anzeige (lyrics.ovh, Genius, LRCLIB) mit LRC Sync-Modus
- KI-basierte LRC-Generierung via faster-whisper (lokale Lyrics-Transkription mit Zeitstempeln, GPU-beschleunigt)

### Wiedergabe-Modi

- **Reihenfolge**: Spielt die Trackliste sequentiell ab
- **Shuffle**: Zufaellige Wiedergabe
- **Smart DJ**: Waehlt automatisch den naechsten Track basierend auf:
  - BPM-Naehe (sanfte Uebergaenge)
  - Camelot Key Kompatibilitaet (harmonisches Mixing)
  - Audio-Feature-Aehnlichkeit (Klangcharakter)
  - Energy-Level-Naehe

### Playlist-Download

- YouTube-, Spotify- und SoundCloud-Playlist-URLs automatisch erkennen
- Playlist-Info abrufen (Titel, Anzahl Tracks)
- Alle Tracks einer Playlist herunterladen
- Fortschrittsanzeige pro Track mit Abbruch-Funktion
- Automatische BPM/Tonart-Analyse nach Download

### OBS / Streaming-Integration

- Eingebauter HTTP + SSE-Server (konfigurierbar, Standard-Port 7878)
- Browser Source Overlay fuer OBS mit 4 Themes:
  - **Modern**: Karte mit Cover, Titel, Artist, BPM, Tonart
  - **Minimal**: Kompakte einzeilige Leiste
  - **Ticker**: Laufschrift am unteren Bildschirmrand
  - **Banner (Streaming)**: Spotify/Apple Music-Stil mit unscharfem Cover-Hintergrund, Kuenstler in Grossbuchstaben, grosser Titel
- Echtzeit-Updates per Server-Sent Events (Track-Wechsel, Fortschritt, Zeit)
- Zeitanzeige: Abgelaufene Zeit / Gesamtdauer / Restzeit
- Konfigurierbare Overlay-Groesse (Breite und Hoehe)
- Text-Datei Export mit konfigurierbarem Format (z.B. `{artist} - {title}`)
- Konfigurierbare Anzeige (Cover, BPM, Tonart, Fortschrittsbalken, Zeit)
- Eingebautes Setup-Tutorial mit kopierbarer URL
- Automatischer Server-Start beim App-Start
- Globale Media-Keys (Play/Pause, Next, Previous, Stop) — funktionieren auch im Hintergrund

### Suche & Discovery

- Song-Suche auf YouTube, Spotify, SoundCloud
- KI-gestuetzte Musikanalyse
- Harmonisches Mixing (kompatible Tracks per Camelot Wheel finden)
- Aehnliche Tracks finden (Audio-Feature-Vergleich via Cosine Similarity)

### Stem Separation

- Demucs-Integration (GPU-beschleunigt via CUDA)
- Trennung in Vocals, Drums, Bass, Other
- Stems als separate Tracks importierbar

### Smart Playlists

- Regelbasierte Playlists (BPM-Range, Tonart, Rating, Energy, Tags, ...)
- AND/OR-Verknuepfung von Regeln
- Dynamische Aktualisierung

### Statistik-Dashboard

- Tracks gesamt, Gesamtdauer, Wiedergaben, Durchschnittsbewertung
- Meistgespielte Tracks mit Play-Count-Badges
- BPM-Verteilung, Tonart-Verteilung, Bewertungsverteilung als Balkendiagramme
- Tag-Nutzung (Top 15) und Premiere-Pro-Projekt-Nutzung
- Zuletzt hinzugefuegte Tracks und Bibliotheken-Aufschluesselung

### Premiere Pro Integration

- `.prproj` Projekt-Dateien laden und analysieren
- YouTube-Timestamps generieren (mit Clip-Include/Exclude)
- EDL Export im CMX3600 Format
- Track-Nutzung pro Projekt verfolgen
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
- Projekt-Verwaltung (Tracks zuordnen, Projekt-Filter, scoped Delete)
- Deutsch / English
- Dark / Light / System Theme
- Konfigurierbarer Fenstertitel
- Konfigurierbarer Skip-Wert (Vor-/Zurueckspulen)
- Einstellungen Export / Import als JSON-Datei

### Auto-Update

- Automatischer Update-Check beim Start via GitHub Releases API
- Update-Banner mit Versions-Anzeige
- In-App Download und Installation (kein Browser noetig)
- Changelog-Modal mit Markdown-Rendering
- Zwischenablage-Erkennung (kopierte URLs werden automatisch erkannt)

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
| Naechster Track | `N` |
| Vorheriger Track | `P` |
| Warteschlange | `Q` |
| Lyrics | `L` |
| Suchen | `Ctrl+F` |
| Tastenkuerzel-Uebersicht | `Shift+?` |

Alle Tastenkuerzel koennen in den Einstellungen angepasst werden.

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **UI:** Tailwind CSS 4 + Headless UI
- **State:** Zustand
- **Datenbank:** Dexie (IndexedDB) + Disk Cache
- **Desktop:** Electron 33
- **Build:** Vite 6 + electron-builder
- **Audio:** Web Audio API (BPM, Tonart, EQ, Reverb, Kompressor, Waveform)
- **Download:** yt-dlp + ffmpeg (automatisch installiert)
- **Lyrics:** lyrics.ovh, LRCLIB, Genius (Scraping), faster-whisper (LRC-Generierung)
- **Stem Separation:** Demucs (Python, optional GPU/CUDA)
- **LRC-Generierung:** faster-whisper (CTranslate2, optional GPU/CUDA)
- **Streaming:** Eingebauter HTTP + SSE-Server (Node built-ins, Server-Sent Events)

## Daten & Cache

| Daten | Speicherort |
|---|---|
| Tracks, Tags, Einstellungen | IndexedDB (`LorusMusikmacherDB`) |
| Audio-Dateien Cache | `%APPDATA%/Lorus Musik Macher/audio/` |
| Waveform Cache | `%APPDATA%/Lorus Musik Macher/waveforms/` |
| yt-dlp, ffmpeg Binaries | `%APPDATA%/Lorus Musik Macher/bin/` |
| Logs | `%APPDATA%/Lorus Musik Macher/app.log` |

**App zuruecksetzen:** IndexedDB loeschen (DevTools > Application > IndexedDB) und den `%APPDATA%/Lorus Musik Macher/` Ordner entfernen.

## Changelog

### v1.7.1
- KI-basierte LRC-Generierung (Whisper `large-v3`) — lokale Lyrics-Transkription mit Zeitstempeln, 99+ Sprachen, mehrsprachige Songs
- Hardware-Beschleunigung (GPU-Rasterization, Vulkan, Zero-Copy)
- Spotify URLs mit `/intl-XX/` werden korrekt erkannt
- CUDA-DLL Auto-Install und Runtime-PATH fuer Whisper
- UTF-8 LRC-Output (Umlaute korrekt)
- Strengere Instrumental-Erkennung (ZCR < 0.02, Centroid < 2000)
- Tabellen-Scrollen behoben

### v1.7.0
- KI-Stimmungserkennung (8 Stimmungen)
- Media Browser (Kuenstler- und Album-Karten)
- Cover-Art bearbeiten
- Spotify Album- und Kuenstler-Download

### v1.6.0
- Playlist-Download (YouTube, Spotify, SoundCloud Playlists) mit Live-Import
- OBS / Streaming-Integration mit 4 Overlay-Themes (Modern, Minimal, Ticker, Banner)
- Banner-Theme: Spotify/Apple Music-Stil mit unscharfem Cover-Hintergrund
- Wiedergabe-Modi: Reihenfolge, Shuffle, Smart DJ (BPM + Key + Stil-Matching)
- Globale Media-Keys (funktionieren im Hintergrund)
- Track umbenennen per Doppelklick
- Automatische Titel-Bereinigung beim Download (Kuenstler aus Dateiname entfernen)
- Zeitanzeige und konfigurierbare Overlay-Groesse
- Auto-Next: Naechster Track wird automatisch abgespielt

### v1.5.0
- Song-Suche auf YouTube, Spotify, SoundCloud
- KI-gestuetzte Musikanalyse
- Harmonisches Mixing
- Aehnliche Tracks finden
- ID3-Metadaten-Auslese

### v1.4.1
- Echtzeit-Import-Fortschrittsbalken

### v1.4.0
- Stem Separation (Demucs)
- Audio-Visualizer
- Smart Playlists
- GPU-Caching

### v1.3.0
- Projektbasierte Track-Verwaltung
- Auto-Assign bei Import
- Soft-Delete

### v1.2.0
- Favoriten, Undo/Redo
- Waveform-Notizen
- FX-Panel (Reverb, Kompressor)
- Ordner-Watching

## Lizenz

Privat - Alle Rechte vorbehalten.
