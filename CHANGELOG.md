# Changelog

## v1.8.0

### Neue Features

- **macOS Sonoma/Sequoia UI-Redesign** — Komplett ueberarbeitetes Design im Stil von macOS Sonoma/Sequoia (Apple Music, Finder). Neues Design-Token-System mit Apple Button Blue (`#0071e3`), sanftere Farben, grosszuegigere Abstande, konsistente `rounded-xl` Buttons. 26+ Komponenten ueberarbeitet.
- **Einklappbare Sidebar** — Sidebar kann per Toggle-Button in der Title Bar eingeklappt werden (`w-[56px]`, nur Icons mit Tooltips) oder ausgeklappt (`w-[220px]`). Smooth CSS-Transition. Einstellung wird gespeichert.
- **Kompakter Mini-Player** — Umschaltbar in den Einstellungen. Einzelne Zeile (`h-16`) mit Cover, Titel, Play-Controls, Progress-Bar und Volume. Apple Music-Stil mit gefuelltem Play-Button.
- **Twitch Chatbot-Integration** — Twitch-Zuschauer koennen per Chat-Befehlen mit der App interagieren (`!sr <URL>`, `!song`, `!skip`, `!voteskip`). Automatischer Download und Queue-Einfuegung bei Song Requests. Duplikat-Erkennung mit 60-Sekunden-Cooldown. Konfigurierbar in den Einstellungen.
- **2-Stem Separation (Vocal/Instrumental)** — Neues Demucs-Modell neben 4-Stem und 6-Stem: Trennung in nur Vocals und Instrumental per `--two-stems vocals`. Schneller als 4/6-Stem und ideal fuer Karaoke oder Acapella-Extraktion.

### Verbesserungen

- **Vollbreite-Layouts** — Settings (2-Spalten Grid), Import (2-Spalten: Datei-Import + Download-Panel) und Statistiken (3-Spalten auf XL) nutzen jetzt die volle Fensterbreite statt max-width Container.
- **Neue CSS Utilities** — `.sonoma-surface` (macOS-Fenster-Chrom), `.shadow-sonoma` (subtiler macOS-Schatten), `.separator-sonoma` (dezente Trennlinien) fuer konsistentes Apple-Styling.
- **Modernisierte Modals** — Alle Modals mit `bg-black/20 backdrop-blur-lg` Backdrop, `bg-white/98 dark:bg-surface-850/98 backdrop-blur-xl` Panel und `shadow-[0_24px_80px_rgba(0,0,0,0.12)]`.
- **Ueberarbeiteter Player** — Groesserer Player (`h-[152px]`), `sonoma-surface` Hintergrund, Apple-Stil Play-Button (`bg-surface-900 dark:bg-surface-100`), abgerundetes Artwork mit `shadow-sonoma`.
- **TrackGrid** — Groessere Zeilenhoehe (44px), `rounded-xl` Search-Bar, sanfterer Hover-Effekt, subtilerer Playing-State (`bg-primary-500/6`).
- **Settings Tags-Section in Language-Section integriert** — Kompakteres Layout in der 2-Spalten-Ansicht.
- **Twitch SR Duplikat-Erkennung** — Existierende Songs werden direkt aus der Bibliothek in die Warteschlange eingefuegt statt erneut heruntergeladen.
- macOS-Style Scrollbars (6px, overlay), kleinerer Range-Slider Thumb (12px), duennerer Track (3px)

### Technische Aenderungen

- Design-Tokens: Primary `#0071e3`, Surface-150 `#ececee`, CSS Custom Properties via `@theme`
- Neues Modul `electron/twitchBot.cjs` — Twitch IRC Client (tmi.js)
- Neuer Zustand-Store `useTwitchStore` fuer Twitch-Verbindungsstatus
- Neuer Hook `useTwitchEventHandler` — IPC-Event-Bridge zwischen Main Process und Renderer
- `AppSettings` Interface um `compactPlayer` und `sidebarCollapsed` erweitert
- Dependency: `tmi.js` hinzugefuegt
- Alle `rounded-full` Buttons zu `rounded-xl` migriert (Phase 8 Button-Audit)

---

## v1.7.1

### Neue Features

- **KI-basierte LRC-Generierung (Whisper)** — Lokale Lyrics-Transkription mit Zeitstempeln per Rechtsklick → "LRC generieren". Nutzt faster-whisper mit dem `large-v3` Model (beste Qualitaet, mehrsprachig). Automatische Installation bei Erstnutzung. GPU-Beschleunigung (NVIDIA CUDA) wird erkannt und genutzt. Generierte LRC-Lyrics werden im Lyrics-Panel mit Timestamps angezeigt. Unterstuetzt 99+ Sprachen inkl. Deutsch, Englisch und mehrsprachige Songs.

### Verbesserungen

- **Hardware-Beschleunigung (GPU)** — GPU-Rasterization, Zero-Copy, Vulkan-Rendering, Accelerated 2D Canvas und Background-Throttling deaktiviert fuer deutlich fluessigeres Scrollen und weniger UI-Lag.
- **CSS GPU-Hints** — `will-change` und `contain` Properties fuer GPU-beschleunigtes Compositing bei scrollbaren Listen.

### Bugfixes

- **Spotify Album-Download brach nach 1 Song ab** — Die alte `"name":"..."`-Regex auf der Embed-Seite extrahierte keine Tracks mehr (Spotify HTML-Aenderung). Neuer Parser nutzt das `trackList`-JSON-Array mit `"title"`-Feldern, inklusive Kuenstlernamen fuer bessere YouTube-Suche. Zudem zeigt die Playlist-Info jetzt die korrekte Track-Anzahl an.
- **Spotify URLs mit `/intl-XX/` wurden nicht als Album/Playlist erkannt** — URLs wie `open.spotify.com/intl-de/album/...` umgingen die Playlist-Erkennung und luden nur 1 Song. Regex in Frontend und Backend erlaubt jetzt optionales `/intl-XX/`-Segment.
- **LRC-Generierung schlug fehl wegen fehlender CUDA-DLLs** — `cublas64_12.dll not found` Fehler bei NVIDIA-GPUs. CUDA-Bibliotheken (`nvidia-cublas-cu12`, `nvidia-cudnn-cu12`) werden jetzt bei der Whisper-Installation automatisch mit installiert. DLL-Verzeichnisse werden zur Laufzeit automatisch zum PATH hinzugefuegt. Falls CUDA trotzdem fehlschlaegt, wird automatisch auf CPU zurueckgefallen.
- **LRC-Umlaute wurden nicht korrekt dargestellt** — Windows-Encoding (cp1252) verursachte `UnicodeEncodeError` bei Umlauten. LRC-Output wird jetzt ueber eine UTF-8 Temp-Datei statt stdout uebertragen.
- **AI: Instrumental Tag war zu aggressiv** — Songs mit leisem oder ruhigem Gesang wurden faelschlicherweise als Instrumental getaggt. Schwellenwerte deutlich verschaerft (ZCR < 0.02 statt 0.05, Centroid < 2000 statt 3000), sodass nur noch wirklich gesangsfreie Tracks erkannt werden.
- **Tabellen-Scrollen funktionierte nicht** — Durch den neuen View-Toggle-Wrapper fehlte `min-h-0` auf dem TrackGrid-Container, wodurch die Tabelle ueber den sichtbaren Bereich hinauswuchs statt zu scrollen. Gleiches Problem im Media Browser behoben.

---

## v1.7.0

### Neue Features

- **KI-Stimmungserkennung** — Automatische Erkennung der Stimmung eines Tracks bei der Audio-Analyse. 8 Stimmungen: Froehlich, Melancholisch, Aggressiv, Entspannt, Episch, Mysterioes, Romantisch, Duester. Basiert auf gewichtetem Scoring aus Spectral-Features (Centroid, Rolloff, ZCR, RMS), BPM, Energie und Tonart (Dur/Moll via Camelot-Wheel). Neue farbkodierte Spalte "Stimmung" in der Track-Tabelle mit Pill-Badges.
- **Media Browser** — Medienansicht mit Kuenstler- und Album-Karten. Umschaltbar zwischen Listen- und Grid-Ansicht per Toggle-Buttons. Navigation: Kuenstler → Kuenstler-Detail (Alben + Tracks) → Album-Detail, oder Alben → Album-Detail. Album-Detail zeigt grosses Cover, Track-Liste mit BPM, Tonart, Stimmung, Energie und "Alle abspielen"-Button.
- **Cover-Art bearbeiten** — Kuenstler-, Album- und Track-Cover koennen direkt im Media Browser geaendert werden. Kamera-Overlay erscheint bei Hover ueber Karten und Thumbnails. Kuenstler-Cover-Aenderung aktualisiert alle Tracks des Kuenstlers, Album-Cover alle Tracks des Albums.
- **Spotify Album-Download** — Komplette Spotify-Alben koennen jetzt heruntergeladen werden. Album-URL einfuegen, Tracks werden automatisch erkannt und einzeln via YouTube heruntergeladen.
- **Spotify Kuenstler-Download** — Spotify-Kuenstler-URLs werden erkannt und die Top-20-Tracks des Kuenstlers automatisch via YouTube-Suche heruntergeladen.

### Verbesserungen

- Smart Playlists unterstuetzen "Stimmung" als Regelfeld (String-Vergleich)
- Stimmungs-Spalte ist sortierbar und in den Spalten-Einstellungen ein-/ausblendbar
- Tracks ohne Kuenstler/Album werden unter "Unbekannter Kuenstler" / "Unbekanntes Album" gruppiert
- Artwork-URL-Cache wird bei Cover-Aenderung korrekt invalidiert (kein Stale-Cover mehr)
- Cover-Aenderung aktualisiert auch den aktuell spielenden Track im Player

---

## v1.6.1

### Verbesserungen

- **Dateiendung aus Tracknamen entfernt** — Beim Download wird die Dateiendung (.mp3, .wav, .m4a, .ogg, .flac, .webm, .opus, .aac, .wma) automatisch aus dem Tracknamen entfernt. Zusammen mit der Kuenstler-Bereinigung wird z.B. "Sean Paul - Get Busy.mp3" zu "Get Busy".
- **Crossfade funktioniert jetzt** — Crossfade wird automatisch ausgeloest wenn ein Song von alleine endet (Position-Timer startet naechsten Track vor Songende). Manuelles Skippen wechselt sofort ohne Fade. Alte Audio wird ueber Web Audio API direkt an den Output geroutet, damit der Fade-Out hoerbar bleibt waehrend der neue Track startet.

### Bugfixes

- **App fror beim Start ein** — GPU/CUDA-Erkennung nutzte `execSync` (blockierend, bis zu 30s Timeout), wodurch der Electron-Main-Process komplett eingefroren war. Auf asynchrones `execFile` umgestellt — App startet jetzt sofort.
- **Crossfade bei Auto-Next funktionierte nicht** — `audio.onended` feuert erst nach Songende, da gibt es nichts zum Ueberblenden. Crossfade wird jetzt per Position-Timer ausgeloest wenn die Restzeit unter die Crossfade-Dauer faellt.
- **Crossfade machte alten Track sofort stumm** — `connectAudioGraph()` hat die alte Web-Audio-Source disconnected bevor der Fade-Out hoerbar war. Alte Source wird jetzt direkt an `AudioContext.destination` geroutet fuer den Fade.

---

## v1.6.0

### Neue Features

- **Wiedergabe-Modi (Spotify-Style)** — Drei Wiedergabe-Modi im Player, umschaltbar per Button neben den Play-Controls:
  - **Reihenfolge**: Spielt die Trackliste sequentiell ab
  - **Shuffle**: Zufaellige Wiedergabe (kein Track wird direkt wiederholt)
  - **Smart DJ**: Waehlt automatisch den besten naechsten Track basierend auf BPM-Naehe (bis 40 Punkte), Camelot-Key-Kompatibilitaet (bis 30 Punkte), Audio-Feature-Aehnlichkeit per Cosine Similarity (bis 20 Punkte) und Energy-Level-Naehe (bis 10 Punkte). Kleiner Zufallsfaktor verhindert Wiederholungen.
- **Playlist-Download** — Ganze Playlists von YouTube, Spotify und SoundCloud herunterladen:
  - Automatische Erkennung von Playlist-URLs im Download-Panel
  - Playlist-Info wird vorab abgerufen (Titel, Anzahl Tracks)
  - Fortschrittsanzeige pro Track ("Track 3/15 — Downloading: Song Name...")
  - Abbruch-Funktion waehrend des Downloads
  - Automatische BPM/Tonart-Analyse nach Download jedes Tracks
  - Spotify-Tracks werden ueber YouTube-Suche (`ytsearch1:`) aufgeloest
  - **Live-Import** — Tracks erscheinen sofort in der Bibliothek waehrend des Downloads (nicht erst nach Abschluss aller Tracks)
- **OBS / Streaming-Integration** — Aktuellen Track in OBS als Browser Source anzeigen:
  - Eingebauter HTTP + SSE-Server (Standard-Port 7878, konfigurierbar)
  - 4 Overlay-Themes: **Modern** (Karte mit Cover, Titel, BPM, Tonart), **Minimal** (kompakte Leiste), **Ticker** (Laufschrift am unteren Rand), **Banner (Streaming)** (Spotify/Apple Music-Stil mit unscharfem Cover-Hintergrund)
  - Echtzeit-Updates per Server-Sent Events (Track-Wechsel, Fortschritt, Zeitanzeige)
  - Zeitanzeige: Abgelaufene Zeit / Gesamtdauer / Restzeit im Overlay
  - Konfigurierbare Overlay-Groesse (Breite und Hoehe in Pixeln)
  - Transparenter Hintergrund fuer OBS Browser Source
  - CSS-Animationen bei Track-Wechsel (Slide-in, Marquee, Fade-in)
  - Text-Datei Export mit konfigurierbarem Format (`{artist}`, `{title}`, `{bpm}`, `{key}`)
  - Konfigurierbar: Cover, BPM, Tonart, Fortschrittsbalken, Zeitanzeige einzeln ein-/ausblendbar
  - Vorschau-Button oeffnet Overlay im Browser
  - Automatischer Server-Start beim App-Start (wenn aktiviert)
  - Eingebautes Setup-Tutorial mit kopierbarer URL
- **Auto-Next / Wiedergabe fortsetzen** — Naechster Track wird automatisch abgespielt wenn ein Song endet. Funktioniert mit allen drei Wiedergabe-Modi.
- **Globale Media-Keys** — Play/Pause, Naechster Track, Vorheriger Track und Stop funktionieren auch wenn die App im Hintergrund laeuft (MediaPlayPause, MediaNextTrack, MediaPreviousTrack, MediaStop)
- **Track umbenennen** — Per Doppelklick auf den Tracknamen in der Tabelle kann der Name direkt bearbeitet werden (Enter zum Speichern, Escape zum Abbrechen)
- **Automatische Titel-Bereinigung** — Beim Download wird der Kuenstlername automatisch aus dem Dateinamen entfernt, wenn er in den ID3-Metadaten vorhanden ist (z.B. "Sean Paul - Get Busy.mp3" wird zu "Get Busy.mp3"). Unterstuetzte Trennzeichen: ` - `, ` – `, ` — `, ` _ `
- **Hotkeys: Naechster/Vorheriger Track** — Neue Tastenkuerzel N (naechster Track) und P (vorheriger Track) zum Ueberspringen von Songs

### Bugfixes

- **Cover-Art fehlte im OBS-Overlay** — `blobToBase64()` konnte ArrayBuffer aus der Datenbank nicht verarbeiten. Ausserdem ueberschrieben Positions-Updates das Cover mit `null`. Beides behoben.
- **Auto-Next funktionierte nicht** — War hinter der `continuePlayback`-Einstellung versteckt, die standardmaessig deaktiviert war. Gate entfernt, Auto-Next funktioniert jetzt immer wenn eine Trackliste vorhanden ist.

### Technische Aenderungen

- Neuer Zustand-Store `usePlaylistProgress` fuer Playlist-Download-Fortschritt (vermeidet IPC/useState-Rerender-Bug)
- Neues Modul `electron/obsServer.cjs` — HTTP + SSE-Server (Server-Sent Events statt WebSocket fuer maximale Kompatibilitaet)
- `usePlayerStore` erweitert um `playbackMode`, `trackList`, `setTrackList`, `setPlaybackMode`
- `TrackGrid.tsx` setzt automatisch die `trackList` beim Abspielen, Track-Name per Doppelklick editierbar
- `pickSmartNext()` Algorithmus mit gewichtetem Multi-Faktor-Scoring
- OBS-Einstellungen werden live per SSE an verbundene Overlays gepusht
- Positions-Update-Intervall von 3s auf 1s reduziert fuer fluessigere Fortschrittsanzeige
- Electron `globalShortcut` fuer systemweite Media-Key-Registrierung
- Neue Preload-APIs: `fetchPlaylistInfo`, `downloadPlaylist`, `cancelPlaylistDownload`, `onPlaylistProgress`, `onPlaylistTrackReady`, `onMediaKey`, `obsStartServer`, `obsStopServer`, `obsUpdateNowPlaying`, `obsUpdateSettings`, `obsSelectTextFilePath`
- `blobToBase64()` verarbeitet jetzt sowohl Blob als auch ArrayBuffer (Legacy-Daten)

---

## v1.5.0

### Neue Features

- **Song-Suche im Download-Panel** — Neuer Tab "Suche" neben der URL-Eingabe ermoeglicht die direkte Suche nach Songs auf YouTube und SoundCloud. Suchergebnisse zeigen Thumbnail, Titel, Kanal und Dauer. Per Klick wird der Download gestartet.
- **KI-Drop-Erkennung** — Automatische Erkennung von Drops und Builds per Rechtsklick → "Track analysieren". Nutzt Multi-Band-Spektralanalyse (Sub-Bass, Bass, Mid, High) mit adaptiven Schwellwerten. Maximal 8 Marker pro Track, mindestens 8 Sekunden Abstand. Drops erscheinen als rote, Builds als gelbe Cue-Marker auf der Waveform. Manuelle Cue-Points bleiben bei Re-Analyse erhalten.
- **KI-Energie-Erkennung** — Automatische Berechnung eines Energie-Levels (1-10) basierend auf RMS, Spectral Rolloff und BPM. Neue farbkodierte Spalte in der Track-Tabelle (rot/amber/blau).
- **KI-Auto-Tagging** — Automatische Klassifikation nach Analyse mit Tags wie "AI: Energetic", "AI: Chill", "AI: Dark", "AI: Bright", "AI: Vocal", "AI: Instrumental", "AI: Acoustic", "AI: Electronic", "AI: Melancholic".
- **AI: Melancholic Tag** — Neuer Auto-Tag fuer melancholische Tracks: Moll-Tonart (Camelot A) + Energie ≤ 4 + BPM < 120 + dunkles Timbre (Centroid < 3000 Hz).
- **Intro/Outro-Erkennung** — Automatische Erkennung von Intro-Ende und Outro-Start als gruene/lila Cue-Marker.
- **Passende Tracks (Harmonic Mixing)** — Rechtsklick → "Passende Tracks finden" zeigt harmonisch kompatible Tracks basierend auf Camelot-Wheel (gleiche, ±1, parallele Tonart) und BPM-Naehe. Scoring mit farbigem Balken.
- **Aehnliche Tracks** — Rechtsklick → "Aehnliche Tracks" findet akustisch aehnliche Tracks per Kosinus-Aehnlichkeit der Spectral-Feature-Vektoren (Centroid, Rolloff, ZCR, RMS, Chroma).
- **Kuenstler-Spalte (Artist)** — Neue sortierbare, durchsuchbare und editierbare Spalte fuer den Kuenstler. Wird automatisch aus ID3v2 TPE1-Tag beim Import extrahiert. Per Doppelklick bearbeitbar.
- **Album, Jahr & Titelnummer aus ID3** — Automatische Extraktion von Album (TALB), Jahr (TDRC/TYER) und Titelnummer (TRCK) aus ID3v2-Tags. Album und Jahr als eigene sortierbare Spalten sichtbar.
- **Auto-Analyse nach Download** — Heruntergeladene Tracks werden sofort nach dem Import automatisch analysiert (BPM, Tonart, Energie, Drops, Auto-Tags).

### Verbesserungen

- **Batch-Analyse aller Tracks** — Neuer Toolbar-Button "Alle analysieren" startet die sequentielle Analyse aller sichtbaren/gefilterten Tracks. Fortschrittsbalken mit aktuellem Trackname, Zaehler, Prozentanzeige und geschaetzter Restzeit. Jederzeit abbrechbar.
- **BPM-Erkennung komplett neu (Ellis 2007 / librosa)** — Spectral-Flux Onset-Erkennung per STFT statt einfacher Energie-Huelle, globale Autokorrelation des Onset-Signals, log-normale Tempo-Gewichtung zentriert auf 120 BPM (loest Oktav-Fehler zuverlaessig), parabolische Interpolation fuer sub-frame Genauigkeit. Ergebnisse entsprechen jetzt vocalremover.org BPM-Finder.
- **Tonart-Erkennung verbessert** — 50% Overlap bei FFT-Frames, laengeres Analyse-Fenster (60s statt 30s), breiterer Frequenzbereich (50-4000 Hz) und Fix fuer negativen Modulo in der Chroma-Berechnung
- **Nicht-blockierende Analyse (Web Worker)** — Track-Analyse (BPM, Tonart, Drops, Energie) laeuft jetzt in einem Web Worker und blockiert die UI nicht mehr
- **Instrumental-Erkennung verbessert** — AI: Instrumental Tag wird jetzt bei ZCR < 0.05 und Centroid < 3000 Hz vergeben (vorher ZCR < 0.02, zu restriktiv)
- Kuenstler, Album, Jahr und Titelnummer werden bei manuellem Import aus ID3-Tags ausgelesen
- Smart Playlists unterstuetzen "Energie" als Regelfeld
- DB-Migration v11: Artist-Index

---

## v1.4.1

### Verbesserungen

- **Echtzeit-Fortschrittsanzeige beim Import** — Beim Importieren von Dateien oder Ordnern wird jetzt eine Progress-Bar mit aktuellem Dateinamen und Zaehler angezeigt (z.B. "Importiere 5 / 120 — songname.mp3"). Prozentanzeige und animierter Fortschrittsbalken geben visuelles Feedback, besonders bei grossen Ordnern.
- **Scan-Phase Feedback** — Beim Ordner-Import wird vor dem eigentlichen Import "Ordner wird gescannt..." angezeigt, damit der User weiss, dass die App arbeitet.

---

## v1.4.0

### Neue Features

- **Stem-Separation (Demucs)** — Tracks können per Rechtsklick in ihre Einzelspuren zerlegt werden (Vocals, Drums, Bass, Other). Wahlweise 4-Stem- oder 6-Stem-Modell (+ Guitar, Piano). Automatische Installation von Python, PyTorch und Demucs. GPU-Beschleunigung (NVIDIA CUDA) wird erkannt und genutzt.
- **Audio-Visualizer** — Echtzeit-Frequenzspektrum als Overlay auf der Waveform. 64-Band-Equalizer-Darstellung mit Farbverlauf. Per Toggle-Button im Player ein-/ausschaltbar.
- **Smart Playlists** — Dynamische Playlists basierend auf konfigurierbaren Regeln (BPM, Tonart, Bewertung, Name, Kommentar, Dauer, Tags, Wiedergaben, Favorit, Zuletzt gespielt). Regeln mit AND/OR-Logik kombinierbar. Echtzeit-Vorschau der passenden Tracks. Erstellen, bearbeiten und löschen direkt in der Sidebar.

### Verbesserungen

- GPU/CUDA-Erkennung wird beim App-Start im Hintergrund gecacht — kein Warten mehr beim Öffnen der Stem-Separation
- Stem-Auswahl nach Separation mit individueller Umbenennung vor dem Import
- Fortschrittsanzeige für Installation, Separation und Import
- Lyrics-Panel: Verbesserte Auto-Scroll-Logik für präzisere Synchronisation
- Layout-Stabilität: Overflow-Fix in der Browse-Ansicht

---

## v1.3.0

### Neue Features

- **Projekt-System für Tracks** — Tracks können einem Projekt zugeordnet werden. Beim Wechsel des Projekts in der Sidebar werden nur die zugehörigen Tracks angezeigt. "Alle Projekte" zeigt weiterhin alle Tracks.
- **Projekt-Zuweisung per Rechtsklick** — Im Kontextmenü erscheint ein neuer Bereich "Projekt" mit Radio-Buttons, um einen Track einem Projekt zuzuweisen oder die Zuordnung zu entfernen ("Kein Projekt").
- **Auto-Zuordnung beim Import** — Neue Tracks werden automatisch dem aktuell ausgewählten Projekt zugeordnet — gilt für manuellen Import, Ordner-Import, Downloads und Ordner-Überwachung.
- **Projekt-scoped Löschen** — Wenn ein Projekt ausgewählt ist, entfernt "Löschen" / Batch-Löschen den Track nur aus dem Projekt (Zuordnung aufheben). Der Track bleibt in "Alle Projekte" erhalten. Im Kontextmenü wird "Aus Projekt entfernen" statt "Löschen" angezeigt.

### Verbesserungen

- Tracks werden beim Projekt-Löschen automatisch freigegeben (projectId entfernt), sodass sie unter "Alle Projekte" sichtbar bleiben
- Undo/Redo unterstützt Projekt-Zuweisung (`setProject`-Aktion)
- Gelöschte Tracks werden beim Undo inkl. projectId wiederhergestellt
- DB-Migration v9: `projectId`-Index auf der tracks-Tabelle

---

## v1.2.0

### Neue Features

- **Favoriten / Quick-Access** — Tracks können per Herz-Icon oder Tastenkürzel (F) als Favorit markiert werden. Gefülltes rotes Herz = Favorit. Neuer Filter-Button in der Toolbar zeigt nur Favoriten an (bibliotheksübergreifend). Auch im Rechtsklick-Kontextmenü verfügbar.
- **Konfigurierbare Spalten** — Zahnrad-Icon in der Track-Tabelle öffnet ein Dropdown mit Checkboxen zum Ein-/Ausblenden einzelner Spalten (Dauer, BPM, Tonart, Bewertung, Tags, Kommentar). Die Einstellung wird dauerhaft gespeichert.
- **Notizen auf der Waveform** — Per Alt+Klick auf die Waveform können zeitgestempelte Notizen hinzugefügt werden. Notizen erscheinen als orangefarbene gestrichelte Linie mit Sprechblasen-Icon. Hover zeigt den Text, Rechtsklick löscht die Notiz.
- **Rückgängig / Wiederherstellen (Undo/Redo)** — Ctrl+Z / Ctrl+Shift+Z macht Änderungen rückgängig: Track löschen, Bewertung, Kommentar, BPM, Tonart, Tags, Favorit, Verstecken. Bis zu 50 Aktionen im Verlauf.
- **Ordner-Überwachung mit Auto-Import** — Gespeicherte Import-Ordner können per Auge-Icon überwacht werden. Neue Audio-Dateien werden automatisch in die richtige Bibliothek importiert.
- **Reverb & Kompressor (FX-Panel)** — Neuer FX-Button im Player öffnet ein Panel mit Reverb (Ein/Aus, Mix-Regler, Raumgröße klein/mittel/groß) und Kompressor (Threshold, Ratio, Attack, Release, Knee). Reset-Button setzt alles zurück.
- **Audio-Fingerprinting (AcoustID)** — Rechtsklick auf einen Track → "Track identifizieren" erkennt den Song per Chromaprint-Fingerprint und benennt ihn automatisch um (Künstler - Titel). Erfordert einen AcoustID API-Key in den Einstellungen.
- **Zufälliger Track (R)** — Tastenkürzel R spielt einen zufälligen Track aus der aktuell gefilterten Liste.
- **Verbesserte Duplikat-Erkennung beim Import** — Normalisierter Dateiname-Vergleich (ohne Endung, Groß-/Kleinschreibung) verhindert doppelte Imports zuverlässiger.

### Verbesserungen

- Ordner-Überwachung nutzt die Kategorie des gespeicherten Import-Ordners statt der Dropdown-Auswahl
- Neue Tastenkürzel in den Standard-Shortcuts: Zufälliger Track (R), Favorit (F), Rückgängig (Ctrl+Z), Wiederherstellen (Ctrl+Shift+Z)
- AcoustID API-Key Eingabefeld in den Einstellungen
- DB-Migration v8: Favoriten-Index und Notizen-Feld auf bestehende Tracks

### Bugfixes

- **Reverb/Kompressor ging im Browser nicht** — `connectAudioGraph` versuchte bei jedem Toggle einen neuen `MediaElementAudioSourceNode` für dasselbe Audio-Element zu erstellen, was die Web Audio API verbietet. Jetzt wird der bestehende Source-Node wiederverwendet.
- **Tastenkürzel R, F, Q, L, B, E funktionierten nicht** — Groß-/Kleinschreibung wurde beim Vergleich nicht berücksichtigt (`'r' !== 'R'`). Matching ist jetzt case-insensitive.
- **Waveform-Notizen wurden nicht angezeigt** — Nach dem Speichern einer Notiz wurde der Player-Store nicht aktualisiert, sodass die Waveform die alten (leeren) Notizen anzeigte.
- **Notiz-Tooltip war nicht sichtbar** — Der Waveform-Container hat `overflow-hidden`, wodurch das Tooltip abgeschnitten wurde. Tooltip wird jetzt per Portal außerhalb des Containers gerendert.

---

## v1.1.2

### Neue Features

- **Clipboard-Erkennung mit Desktop-Popup** — Wenn ein YouTube-, SoundCloud- oder Spotify-Link kopiert wird, erscheint ein eigenes Desktop-Popup (unten rechts) mit Vorschaubild, Titel und Plattform-Icon. Klick auf "Herunterladen" wechselt zum Import-Tab und startet den Download automatisch.
- **Cue-Points per Klick setzen** — Leere Cue-Buttons koennen jetzt direkt angeklickt werden, um einen Cue-Point an der aktuellen Position zu setzen
- **Cue-Points per Rechtsklick loeschen** — Rechtsklick auf einen gesetzten Cue-Button entfernt ihn

### Verbesserungen

- Clipboard-Popup zeigt Vorschaubild und Titel (YouTube, Spotify, SoundCloud)
- Clipboard-Popup mit farbigem Plattform-Akzent, Fortschrittsbalken und Slide-in-Animation
- Clipboard-Popup bleibt 20 Sekunden sichtbar statt 10
- Cue-Points farbkodiert mit Glow-Effekt — leere Slots zeigen gestrichelten Rand in Slot-Farbe
- Cue-Marker auf der Waveform groesser und besser sichtbar (3px breit, farbiger Schatten)
- README aktualisiert (EQ, Pitch, Statistik, Settings Export)

### Bugfixes

- **Cue-Points verschwanden beim Trackwechsel** — Der TrackStore wurde nicht synchronisiert, sodass beim Zurueckwechseln die alten Track-Daten ohne Cue-Points geladen wurden
- **Spotify-Links wurden nicht erkannt** — Regex war zu restriktiv (nur `/track`), jetzt werden auch Album-, Playlist- und intl-Links erkannt
