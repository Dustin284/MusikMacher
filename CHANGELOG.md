# Changelog

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
