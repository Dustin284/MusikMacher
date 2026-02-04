# Entwicklung

Diese Seite beschreibt die Einrichtung der Entwicklungsumgebung und den Build-Prozess.

## Voraussetzungen

| Tool | Version | Beschreibung |
|------|---------|-------------|
| Node.js | >= 18 | JavaScript Runtime |
| npm | (mitgeliefert) | Paketmanager |
| Git | Aktuell | Versionskontrolle |

## Projekt einrichten

```bash
# Repository klonen
git clone https://github.com/Dustin284/MusikMacher.git
cd MusikMacher

# Abhaengigkeiten installieren
npm install
```

## Entwicklungsserver

### Web-Entwicklung (ohne Electron)

```bash
npm run dev
```

Startet den Vite-Entwicklungsserver auf **Port 3000** mit Hot Module Replacement (HMR).

Nuetzlich fuer schnelle UI-Entwicklung, aber ohne Electron-APIs (Dateisystem, Downloads, etc.).

### Electron-Entwicklung

```bash
npm run electron:dev
```

Startet Vite und Electron parallel:
1. Vite-Server startet auf Port 3000
2. `wait-on` wartet, bis der Server bereit ist
3. Electron startet und laedt die Vite-URL

Aenderungen an React-Komponenten werden per HMR sofort aktualisiert. Aenderungen am Electron-Hauptprozess erfordern einen Neustart.

### Web Preview

```bash
npm run preview
```

Vorschau der gebauten Web-Version (nach `npm run build`).

## Build

### TypeScript kompilieren + Vite bauen

```bash
npm run build
```

1. TypeScript Compiler prueft Typen (`tsc -b`)
2. Vite baut das Frontend nach `dist/`

### Windows Installer

```bash
npm run electron:build:win
```

Erstellt einen NSIS-Installer fuer Windows (x64):

- Output: `release/`-Ordner
- Installer-Typ: NSIS (Non-Admin, per-User)
- Desktop- und Startmenue-Verknuepfungen
- Anpassbares Installationsverzeichnis

### Alle Plattformen

```bash
npm run electron:build
```

## Verfuegbare Scripts

| Script | Beschreibung |
|--------|-------------|
| `npm run dev` | Vite Dev-Server (Port 3000) |
| `npm run build` | TypeScript + Vite Production Build |
| `npm run preview` | Vorschau des Production Builds |
| `npm run electron:dev` | Electron + Vite Entwicklung |
| `npm run electron:build` | Electron-Builder (alle Plattformen) |
| `npm run electron:build:win` | Electron-Builder (nur Windows) |

## Konfigurationsdateien

### TypeScript (`tsconfig.json`)

| Einstellung | Wert |
|-------------|------|
| Target | ES2020 |
| Module | ESNext |
| Strict Mode | Aktiviert |
| Path Alias | `@/*` → `./src/*` |
| Libraries | DOM, DOM.Iterable, ESNext |

### Vite (`vite.config.ts`)

| Einstellung | Wert |
|-------------|------|
| Plugin | React (SWC) |
| CSS Plugin | Tailwind CSS Vite |
| Dev Port | 3000 |
| Output | `dist/` |
| Base Path | `./` (relativ) |

### Electron Builder (`package.json`)

| Einstellung | Wert |
|-------------|------|
| App ID | `com.lorus.musikmacher` |
| Produktname | Lorus Musik Macher |
| Ziel | Windows NSIS |
| Install-Modus | Per User (kein Admin) |
| Desktop-Shortcut | Ja |
| Startmenue-Shortcut | Ja |
| Daten bei Deinstallation | Werden nicht geloescht |

### Tailwind CSS

Das Design nutzt benutzerdefinierte Farben, die in `index.css` definiert sind:

- **Primary:** Gruen-Toene (fuer Buttons, Akzente)
- **Surface:** Grau-Toene (fuer Hintergruende)
- **Schriftart:** Segoe UI (Windows-Standard)
- **Scrollbar:** Benutzerdefiniertes Styling
- **Dark Mode:** Vollstaendig unterstuetzt

## Ordnerstruktur fuer neue Features

Beim Hinzufuegen neuer Features:

1. **Komponente:** `src/components/NeuesFeature.tsx`
2. **Store (falls noetig):** `src/store/useNeuesFeatureStore.ts`
3. **Utility (falls noetig):** `src/utils/neuesFeature.ts`
4. **Typen:** Typen in `src/types/index.ts` hinzufuegen
5. **Uebersetzungen:** Strings in `src/i18n/translations.ts` hinzufuegen
6. **IPC (falls noetig):** Handler in `electron/main.cjs` und Typen in `electron.d.ts`

## Debugging

### DevTools

In der Entwicklungsumgebung sind die Chrome DevTools verfuegbar:

- **Ctrl+Shift+I:** DevTools oeffnen
- **Application > IndexedDB:** Datenbank inspizieren
- **Console:** Log-Ausgaben sehen

### Log-Viewer

Die App hat einen integrierten Log-Viewer:

- Ring-Buffer mit 500 Eintraegen
- Logs werden auch nach `%APPDATA%/Lorus Musik Macher/app.log` geschrieben
- Nuetzlich fuer Debugging im Production-Build

### Haeufige Probleme

| Problem | Loesung |
|---------|--------|
| Electron startet nicht | `npm install` erneut ausfuehren |
| Port 3000 belegt | Anderen Prozess beenden oder Port in `vite.config.ts` aendern |
| Audio spielt nicht | Pruefen ob Audio-Cache Verzeichnis existiert |
| yt-dlp Fehler | `%APPDATA%/Lorus Musik Macher/bin/` pruefen |
