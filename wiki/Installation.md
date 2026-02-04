# Installation

## Voraussetzungen

- [Node.js](https://nodejs.org/) >= 18
- npm (wird mit Node.js mitgeliefert)
- Git (optional, fuer die Entwicklung)

## Option 1: Installer (empfohlen)

Lade die neueste Version von der [GitHub Releases-Seite](https://github.com/Dustin284/MusikMacher/releases) herunter.

1. Die `.exe`-Datei herunterladen
2. Installer ausfuehren
3. Installations-Verzeichnis waehlen (Standard: Benutzer-Verzeichnis, kein Admin noetig)
4. Desktop- und Startmenue-Verknuepfung werden automatisch erstellt

> **Hinweis:** Der Installer ist ein NSIS-Installer fuer Windows (x64). Eine Installation pro Benutzer ist moeglich — kein Administrator-Zugriff erforderlich.

## Option 2: Aus dem Quellcode bauen

```bash
# Repository klonen
git clone https://github.com/Dustin284/MusikMacher.git
cd MusikMacher

# Abhaengigkeiten installieren
npm install

# Windows Installer erstellen
npm run electron:build:win
```

Der Installer wird im `release/`-Ordner erstellt.

### Alle Plattformen

```bash
npm run electron:build
```

## Option 3: Entwicklungsumgebung

Siehe [[Entwicklung]] fuer die vollstaendige Anleitung zur lokalen Entwicklung.

```bash
git clone https://github.com/Dustin284/MusikMacher.git
cd MusikMacher
npm install
npm run electron:dev
```

## Automatische Updates

Die App prueft beim Start automatisch auf neue Versionen via GitHub Releases API. Wenn ein Update verfuegbar ist:

1. Ein Update-Banner erscheint mit der neuen Versionsnummer
2. Klick auf "Herunterladen" startet den Download im Hintergrund
3. Nach dem Download kann das Update direkt in der App installiert werden
4. Die App startet automatisch neu

Das GitHub-Repository fuer die Update-Pruefung kann in den [[Einstellungen]] konfiguriert werden.

## Daten & Speicherorte

Nach der Installation speichert die App Daten an folgenden Orten:

| Daten | Speicherort |
|-------|-------------|
| Tracks, Tags, Einstellungen | IndexedDB (`MusikMacherDB`) im Browser-Profil |
| Audio-Dateien Cache | `%APPDATA%/Lorus Musik Macher/audio/` |
| Waveform Cache | `%APPDATA%/Lorus Musik Macher/waveforms/` |
| yt-dlp, ffmpeg, fpcalc Binaries | `%APPDATA%/Lorus Musik Macher/bin/` |
| Log-Datei | `%APPDATA%/Lorus Musik Macher/app.log` |

## App zuruecksetzen

Falls Probleme auftreten, kann die App vollstaendig zurueckgesetzt werden:

1. **IndexedDB loeschen:** DevTools oeffnen (Ctrl+Shift+I) > Application > IndexedDB > `MusikMacherDB` > Delete database
2. **Cache loeschen:** Den Ordner `%APPDATA%/Lorus Musik Macher/` loeschen

> **Achtung:** Beim Zuruecksetzen gehen alle importierten Tracks, Tags, Einstellungen und gecachte Audio-Dateien verloren. Die Originaldateien auf der Festplatte bleiben unberuehrt.

## Deinstallation

Bei der Deinstallation ueber den Windows-Installer werden die App-Daten (`%APPDATA%/Lorus Musik Macher/`) **nicht** automatisch geloescht. Diese koennen manuell entfernt werden.
