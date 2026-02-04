# Lorus Musik Macher

**Professionelle Desktop-Anwendung zur Verwaltung von Musik- und Effekt-Bibliotheken, optimiert fuer den Einsatz mit Adobe Premiere Pro.**

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

---

## Was ist Lorus Musik Macher?

Lorus Musik Macher ist ein Feature-reiches Musikverwaltungs-Tool fuer Content Creator, Musiker und Video-Produzenten. Die App ermoeglicht es, Audio-Dateien zu organisieren, zu analysieren und direkt in Adobe Premiere Pro zu nutzen.

## Highlights

- **Mehrere Bibliotheken** — Organisiere deine Musik in eigene Kategorien (Songs, Effekte, eigene Bibliotheken)
- **Projekt-System** — Tracks einem Projekt zuordnen, beim Projektwechsel nur zugehoerige Tracks anzeigen
- **Automatische Analyse** — BPM- und Tonart-Erkennung per Web Audio API
- **Professioneller Player** — 3-Band EQ, Reverb, Kompressor, Pitch-Shift, Cue-Points, A-B Loop
- **Audio-Download** — YouTube, SoundCloud und Spotify direkt in der App herunterladen
- **Premiere Pro Integration** — `.prproj`-Dateien laden, Track-Nutzung verfolgen, EDL-Export
- **Lyrics-Anzeige** — Synchronisierte Lyrics mit LRC-Support (lyrics.ovh, Genius, LRCLIB)
- **Statistik-Dashboard** — BPM-Verteilung, Tonart-Verteilung, Wiedergabe-Statistiken
- **Rein offline** — Alle Daten lokal gespeichert (IndexedDB + Dateisystem)
- **Zweisprachig** — Deutsch und Englisch
- **Auto-Updates** — Automatische Update-Pruefung via GitHub Releases

## Unterstuetzte Formate

| Typ | Formate |
|-----|---------|
| Audio | MP3, WAV, M4A, OGG, FLAC, WebM |
| Projekte | Adobe Premiere Pro (`.prproj`) |
| Lyrics | LRC, Plain Text |
| Export | EDL (CMX3600), JSON (Einstellungen) |

## Schnellstart

1. [Installation](Installation) — App installieren oder aus dem Quellcode bauen
2. [Erste Schritte](Erste-Schritte) — Erste Bibliothek einrichten und Tracks importieren
3. [Audio-Player](Audio-Player) — Player-Funktionen kennenlernen
4. [Tastenkuerzel](Tastenkuerzel) — Effizientes Arbeiten mit Shortcuts

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | React 18 + TypeScript 5.6 |
| UI | Tailwind CSS 4 + Headless UI |
| State | Zustand 5.0 |
| Datenbank | Dexie (IndexedDB) |
| Desktop | Electron 33 |
| Build | Vite 6 + electron-builder |
| Audio-Analyse | Web Audio API |
| Downloads | yt-dlp + ffmpeg |
| Lyrics | lyrics.ovh, LRCLIB, Genius |

## Versionen

Die aktuelle Version ist **v1.3.0**. Siehe den vollstaendigen [[Changelog]] fuer alle Aenderungen.
