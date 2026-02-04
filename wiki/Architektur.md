# Architektur

Diese Seite beschreibt die technische Architektur von Lorus Musik Macher fuer Entwickler und Interessierte.

## Ueberblick

```
┌─────────────────────────────────────────────┐
│                 Electron                     │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │  Main Process │◄──►│ Renderer Process  │  │
│  │  (Node.js)    │IPC │ (React + Vite)    │  │
│  │               │    │                   │  │
│  │  - Dateisystem│    │  - UI (Tailwind)  │  │
│  │  - Downloads  │    │  - State (Zustand)│  │
│  │  - Updates    │    │  - DB (Dexie)     │  │
│  │  - Clipboard  │    │  - Audio (WebAPI) │  │
│  └──────────────┘    └───────────────────┘  │
│         │                     │              │
│    ┌────▼────┐          ┌────▼────┐         │
│    │Dateisyst│          │IndexedDB│         │
│    │ Cache   │          │         │         │
│    └─────────┘          └─────────┘         │
└─────────────────────────────────────────────┘
```

## Projektstruktur

```
LorusMusikmacher/
├── src/                          # React Frontend
│   ├── App.tsx                   # Hauptkomponente
│   ├── main.tsx                  # React Entry Point
│   ├── index.css                 # Tailwind + Custom Styles
│   ├── components/               # UI-Komponenten
│   │   ├── Browse.tsx            # Track-Browser
│   │   ├── Player.tsx            # Audio-Player
│   │   ├── TrackGrid.tsx         # Track-Tabelle
│   │   ├── Waveform.tsx          # Waveform-Darstellung
│   │   ├── Settings.tsx          # Einstellungen
│   │   ├── Statistics.tsx        # Dashboard
│   │   ├── Import.tsx            # Import-Dialog
│   │   ├── PremiereLoader.tsx    # Premiere Integration
│   │   ├── QueuePanel.tsx        # Warteschlange
│   │   ├── LyricsPanel.tsx       # Lyrics-Anzeige
│   │   ├── DownloadPanel.tsx     # Download-Fortschritt
│   │   ├── TagSidebar.tsx        # Tag-Verwaltung
│   │   ├── TrackContextMenu.tsx  # Rechtsklick-Menue
│   │   ├── ClipboardToast.tsx    # Clipboard-Popup
│   │   ├── ConfirmDialog.tsx     # Bestaetigungs-Dialoge
│   │   └── LogViewer.tsx         # Log-Anzeige
│   ├── store/                    # Zustand State Management
│   │   ├── usePlayerStore.ts     # Player-State
│   │   ├── useTrackStore.ts      # Track-Daten
│   │   ├── useLibraryStore.ts    # Bibliotheken
│   │   ├── useSettingsStore.ts   # Einstellungen
│   │   ├── useProjectStore.ts    # Premiere-Projekte
│   │   └── useUndoStore.ts       # Undo/Redo
│   ├── db/                       # Datenbankschicht
│   │   └── database.ts           # Dexie Setup & Queries
│   ├── utils/                    # Hilfsfunktionen
│   │   ├── audioAnalysis.ts      # BPM, Tonart, Waveform
│   │   ├── premiereParser.ts     # .prproj Parsing
│   │   ├── lrcParser.ts          # LRC Parsing
│   │   ├── logger.ts             # Logging
│   │   └── formatTime.ts         # Zeitformatierung
│   ├── i18n/                     # Internationalisierung
│   │   ├── translations.ts       # Uebersetzungen (DE/EN)
│   │   └── useTranslation.ts     # Translation Hook
│   └── types/                    # TypeScript-Definitionen
│       ├── index.ts              # Domain-Typen
│       └── electron.d.ts         # Electron API Typen
├── electron/                     # Electron Hauptprozess
│   ├── main.cjs                  # Main Process (~50KB)
│   └── preload.cjs               # Context Bridge (~80 APIs)
├── build/                        # Build-Assets
│   └── icon.png                  # App-Icon
├── dist/                         # Vite Build Output
├── release/                      # Installer Output
├── CHANGELOG.md                  # Versionshistorie
├── package.json                  # Dependencies & Scripts
├── tsconfig.json                 # TypeScript Config
├── vite.config.ts                # Vite Build Config
└── index.html                    # HTML Entry Point
```

## Tech Stack

| Schicht | Technologie | Version |
|---------|------------|---------|
| Runtime | Electron | 33 |
| Frontend | React | 18 |
| Sprache | TypeScript | 5.6 |
| UI | Tailwind CSS | 4 |
| Komponenten | Headless UI | 2 |
| State | Zustand | 5.0 |
| Datenbank | Dexie (IndexedDB) | 4.0 |
| Icons | Heroicons | 2.1 |
| Build | Vite | 6 |
| Packaging | electron-builder | 25 |
| Updates | electron-updater | 6.3 |

## Electron-Architektur

### Main Process (`electron/main.cjs`)

Der Hauptprozess laeuft in Node.js und ist verantwortlich fuer:

- **Fenster-Verwaltung:** Erstellen und Konfigurieren des App-Fensters
- **Dateisystem:** Lesen, Schreiben, Scannen von Verzeichnissen
- **Audio-Cache:** `media-cache://` Protokoll fuer effizientes Audio-Streaming
- **Downloads:** yt-dlp/ffmpeg Steuerung fuer Audio-Downloads
- **Updates:** GitHub Releases prufen und installieren
- **Clipboard:** Zwischenablage ueberwachen auf Audio-URLs
- **Drag & Drop:** Nativer Drag zu externen Anwendungen (Premiere Pro)
- **Lyrics:** Genius-Scraping ohne CORS-Einschraenkungen
- **Fingerprinting:** fpcalc ausfuehren fuer AcoustID

### Preload Script (`electron/preload.cjs`)

Das Preload Script dient als sichere Bruecke zwischen Main und Renderer:

- Nutzt `contextBridge.exposeInMainWorld()`
- Stellt ~80 API-Methoden bereit
- Kein direkter Node.js-Zugriff aus dem Renderer
- Alle IPC-Aufrufe sind typisiert in `electron.d.ts`

### Sicherheit

| Einstellung | Wert |
|-------------|------|
| Node Integration | Deaktiviert |
| Context Isolation | Aktiviert |
| Web Security | Aktiviert |

## State Management

### Zustand Stores

Die App verwendet 6 Zustand-Stores:

```
┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐
│ usePlayerStore   │  │ useTrackStore   │  │ useLibraryStore│
│                  │  │                 │  │                │
│ - Playback       │  │ - Tracks        │  │ - Bibliotheken │
│ - Position       │  │ - Tags          │  │ - Reihenfolge  │
│ - Volume         │  │ - Search        │  │ - CRUD Ops     │
│ - Speed          │  │ - Filter        │  │                │
│ - EQ/FX          │  │ - CRUD Ops      │  └────────────────┘
│ - Queue          │  │                 │
│ - Cue Points     │  └─────────────────┘
│ - Pitch          │
└──────────────────┘
┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐
│ useSettingsStore │  │ useProjectStore │  │ useUndoStore   │
│                  │  │                 │  │                │
│ - Theme          │  │ - Projekte      │  │ - Undo Stack   │
│ - Language       │  │ - Selection     │  │ - Redo Stack   │
│ - Shortcuts      │  │ - Track-Zuordn. │  │ - Max 50 Ops   │
│ - Columns        │  │                 │  │                │
│ - Playback Cfg   │  └─────────────────┘  └────────────────┘
└──────────────────┘
```

### Datenfluss

1. **User Action** → React Component
2. Component → **Zustand Store** (Setter aufrufen)
3. Store → **Dexie** (Persistenz in IndexedDB)
4. Store → **IPC** (falls Electron-Funktionen benoetigt)
5. Store Update → **React Re-Render** (automatisch via Zustand)

## Datenbank

### Dexie (IndexedDB)

Datenbankname: `MusikMacherDB`

### Tabellen

| Tabelle | Beschreibung | Primaer-Index |
|---------|-------------|---------------|
| tracks | Audio-Tracks mit Metadaten | Auto-Increment ID |
| tags | Tag-Definitionen | Auto-Increment ID |
| audioFiles | Audio-Blob-Fallback | Track-ID |
| libraries | Benutzerdefinierte Bibliotheken | Auto-Increment ID |
| projects | Projekte (Track-Zuordnung) | Auto-Increment ID |
| importLocations | Gespeicherte Import-Ordner | Auto-Increment ID |
| smartTags | Regelbasierte Tags | Auto-Increment ID |
| settings | Key-Value Einstellungen | Key |

### Schema-Migrationen

Die Datenbank hat 9 Schema-Versionen mit Migrationen:

| Version | Aenderungen |
|---------|------------|
| v1 | Initiale Tracks, Tags, Settings |
| v2 | Audio-Files Tabelle |
| v3 | Import Locations |
| v4 | Custom Libraries (String → numerische IDs) |
| v5 | Premiere Pro Projects |
| v6 | Smart Tags, Rating-Index |
| v7 | Weitere Indizes |
| v8 | Favoriten-Index, Notizen-Feld |
| v9 | projectId-Index auf tracks |

## Audio-Pipeline

### Web Audio API Graph

```
HTMLAudioElement
  │
  ▼
MediaElementAudioSourceNode
  │
  ▼
BiquadFilterNode (Bass, Lowshelf, 200 Hz)
  │
  ▼
BiquadFilterNode (Mid, Peaking, 1 kHz)
  │
  ▼
BiquadFilterNode (Treble, Highshelf, 4 kHz)
  │
  ├──► DynamicsCompressorNode (optional)
  │
  ├──► ConvolverNode (Reverb, optional)
  │
  ▼
GainNode (Master Volume)
  │
  ▼
AudioDestination
```

### Audio-Caching

```
1. Track importieren
   └──► Audio-Datei nach %APPDATA%/audio/ kopieren (benannt nach Track-ID)

2. Track abspielen
   └──► media-cache:// Protokoll streamt Datei direkt vom Dateisystem
   └──► Kein IPC-Buffer-Transfer noetig (performant bei 500+ Tracks)

3. Waveform berechnen
   └──► Peaks als JSON nach %APPDATA%/waveforms/ speichern
   └──► Bei erneutem Laden: Cache verwenden statt neu berechnen
```

## Performance-Optimierungen

| Bereich | Optimierung |
|---------|------------|
| Track-Tabelle | Virtualisierte Rows (ROW_HEIGHT=41px, OVERSCAN=20) |
| Waveform | Peak-Daten auf Festplatte gecacht |
| Album-Cover | Blob-URLs mit Track-ID-Caching |
| Audio-Cache | Electron-native Dateizugriffe statt IndexedDB |
| Media-Protokoll | `media-cache://` streamt ohne Serialisierung |
| Bulk-Import | `setTimeout(0)` Yielding verhindert UI-Freezes |
| Canvas | High-DPI Rendering mit ResizeObserver |
| Analyse | BPM/Tonart erst beim ersten Abspielen (nicht beim Import) |

## Internationalisierung (i18n)

Die App unterstuetzt Deutsch und Englisch ueber ein eigenes i18n-System:

- Uebersetzungen in `src/i18n/translations.ts`
- React Hook `useTranslation()` fuer Zugriff in Komponenten
- Spracheinstellung wird in Zustand/Dexie persistiert
