# Import und Download

Lorus Musik Macher bietet vielfaeltige Moeglichkeiten, Audio-Dateien in die Bibliothek aufzunehmen.

## Datei-Import

### Unterstuetzte Formate

| Format | Beschreibung |
|--------|-------------|
| MP3 | MPEG Audio Layer 3 |
| WAV | Waveform Audio |
| M4A | MPEG-4 Audio (AAC) |
| OGG | Ogg Vorbis |
| FLAC | Free Lossless Audio Codec |
| WebM | WebM Audio |

### Einzelne Dateien importieren

1. Wechsle zum **Import**-Tab
2. Klicke auf **Dateien auswaehlen**
3. Waehle eine oder mehrere Audio-Dateien
4. Waehle die Ziel-Bibliothek
5. Klicke auf **Importieren**

### Ordner importieren

1. Wechsle zum **Import**-Tab
2. Klicke auf **Ordner auswaehlen**
3. Der Ordner wird rekursiv nach Audio-Dateien durchsucht
4. **Unterordner-Namen werden automatisch als Tags zugewiesen**

### Duplikat-Erkennung

Beim Import werden Duplikate automatisch erkannt:

- Vergleich basiert auf dem normalisierten Dateinamen
- Dateiendung und Gross-/Kleinschreibung werden ignoriert
- Bereits vorhandene Tracks werden uebersprungen
- Eine Meldung zeigt an, wie viele Duplikate gefunden wurden

## Import-Orte speichern

Haeufig genutzte Import-Ordner koennen gespeichert werden:

1. Importiere einen Ordner
2. Der Ordner wird automatisch als Import-Ort gespeichert
3. Gespeicherte Orte erscheinen im Import-Tab fuer schnellen Zugriff
4. Jeder Ort merkt sich die zugewiesene Bibliothek

### Ordner-Ueberwachung (Auto-Import)

Gespeicherte Import-Ordner koennen ueberwacht werden:

1. Klicke auf das **Auge-Icon** neben einem gespeicherten Import-Ort
2. Die Ueberwachung startet — neue Audio-Dateien werden automatisch erkannt
3. Erkannte Dateien werden in die richtige Bibliothek importiert
4. Das Auge-Icon zeigt den Ueberwachungsstatus an

> **Hinweis:** Die Kategorie des gespeicherten Import-Ordners wird fuer den Auto-Import verwendet, nicht die aktuelle Dropdown-Auswahl.

> **Projekt-Zuordnung:** Ist ein Projekt ausgewaehlt, werden alle importierten Tracks (manueller Import, Ordner-Import, Downloads und Auto-Import per Ordner-Ueberwachung) automatisch dem aktiven Projekt zugeordnet.

## Audio-Download

### Voraussetzungen

Die App installiert automatisch die benoetigten Tools:

| Tool | Zweck | Installation |
|------|-------|-------------|
| yt-dlp | Audio-Download von YouTube, SoundCloud | Automatisch von GitHub Releases |
| ffmpeg | Audio-Konvertierung | Automatisch installiert |
| ffprobe | Audio-Metadata-Analyse | Mitgeliefert mit ffmpeg |

Alle Tools werden in `%APPDATA%/Lorus Musik Macher/bin/` gespeichert.

### YouTube

1. Kopiere einen YouTube-Link
2. Fuege ihn im Import-Tab ein
3. Klicke auf **Herunterladen**
4. Der Track wird als MP3/M4A heruntergeladen

**Oder:** Kopiere den Link in die Zwischenablage — die App erkennt dies automatisch und zeigt ein Desktop-Popup an.

### SoundCloud

1. Kopiere einen SoundCloud-Link
2. Fuege ihn im Import-Tab ein
3. Klicke auf **Herunterladen**

### Spotify

Der Spotify-Download funktioniert ueber einen Umweg:

1. Kopiere einen Spotify-Link (Track, Album oder Playlist)
2. Die App nutzt die Spotify oEmbed API fuer Titel-Informationen
3. Der Titel wird ueber YouTube gesucht und heruntergeladen

Unterstuetzte Spotify-Links:
- `open.spotify.com/track/...`
- `open.spotify.com/album/...`
- `open.spotify.com/playlist/...`
- `open.spotify.com/intl-.../...`

### Fortschrittsanzeige

Waehrend des Downloads zeigt die App den Fortschritt in Phasen an:

1. **Download** — Audio wird heruntergeladen
2. **Konvertierung** — Umwandlung ins Zielformat
3. **Metadata** — Metadaten werden extrahiert
4. **Thumbnail** — Cover-Bild wird geladen

### Plattform-Erkennung

Die App erkennt automatisch die Plattform anhand des Links:

| Plattform | Farbe | Icon |
|-----------|-------|------|
| YouTube | Rot | YouTube-Logo |
| SoundCloud | Orange | SoundCloud-Logo |
| Spotify | Gruen | Spotify-Logo |

## Clipboard-Erkennung

Die App ueberwacht die Zwischenablage auf Audio-Links:

1. Kopiere einen YouTube-, SoundCloud- oder Spotify-Link
2. Ein **Desktop-Popup** erscheint (unten rechts) mit:
   - Vorschaubild des Tracks
   - Titel
   - Plattform-Icon mit farbigem Akzent
   - Fortschrittsbalken (20 Sekunden sichtbar)
3. Klicke auf **Herunterladen**
4. Die App wechselt zum Import-Tab und startet den Download automatisch

Das Popup hat eine Slide-in-Animation und bleibt 20 Sekunden sichtbar.
