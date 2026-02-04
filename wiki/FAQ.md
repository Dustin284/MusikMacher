# FAQ

Haeufig gestellte Fragen zu Lorus Musik Macher.

---

## Allgemein

### Was ist Lorus Musik Macher?

Eine Desktop-Anwendung zur Verwaltung von Musik- und Effekt-Bibliotheken, speziell optimiert fuer den Einsatz mit Adobe Premiere Pro. Gebaut mit Electron, React und TypeScript.

### Welche Betriebssysteme werden unterstuetzt?

Aktuell wird **Windows (x64)** offiziell unterstuetzt. Der Build-Prozess kann theoretisch auch fuer macOS und Linux konfiguriert werden.

### Ist die App kostenlos?

Die App ist privat lizenziert. Alle Rechte vorbehalten.

### Wo werden meine Daten gespeichert?

Alle Daten werden **lokal** auf deinem Computer gespeichert:

| Daten | Speicherort |
|-------|-------------|
| Tracks, Tags, Einstellungen | IndexedDB im Browser-Profil |
| Audio-Cache | `%APPDATA%/Lorus Musik Macher/audio/` |
| Waveform-Cache | `%APPDATA%/Lorus Musik Macher/waveforms/` |
| Tools (yt-dlp, ffmpeg) | `%APPDATA%/Lorus Musik Macher/bin/` |
| Logs | `%APPDATA%/Lorus Musik Macher/app.log` |

Es werden **keine** Daten an externe Server gesendet (ausser bei Downloads und Lyrics-Abfragen).

---

## Bibliothek

### Welche Audio-Formate werden unterstuetzt?

MP3, WAV, M4A, OGG, FLAC und WebM.

### Kann ich die Standard-Bibliotheken loeschen?

Nein, die Bibliotheken "Songs" und "Effekte" sind geschuetzt und koennen nicht geloescht werden. Du kannst aber eigene Bibliotheken erstellen.

### Was passiert mit meinen Originaldateien beim Import?

Die Originaldateien bleiben unberuehrt. Die App erstellt eine Kopie im Audio-Cache (`%APPDATA%/Lorus Musik Macher/audio/`). Wenn du einen Track in der App loeschst, wird nur die Cache-Kopie entfernt.

### Wie funktioniert die Duplikat-Erkennung?

Die App vergleicht den normalisierten Dateinamen (ohne Endung, Gross-/Kleinschreibung ignoriert). Tracks mit identischem normalisierten Namen werden als Duplikate erkannt und beim Import uebersprungen.

### Was passiert, wenn ich einen Track in einem Projekt loesche?

Wenn ein Projekt ausgewaehlt ist, entfernt "Loeschen" den Track nur aus dem Projekt (die Zuordnung wird aufgehoben). Der Track selbst bleibt erhalten und ist weiterhin unter "Alle Projekte" sichtbar. Um einen Track permanent zu loeschen, wechsle zu "Alle Projekte" und loesche ihn dort.

### Was passiert mit den Tracks, wenn ich ein Projekt loesche?

Die Tracks werden automatisch freigegeben — die Projekt-Zuordnung wird entfernt, aber die Tracks selbst bleiben in der Bibliothek erhalten und erscheinen unter "Alle Projekte".

---

## Player

### Warum wird kein BPM/Tonart angezeigt?

BPM und Tonart werden erst beim **ersten Abspielen** eines Tracks analysiert, nicht beim Import. Spiele den Track einmal ab, und die Werte werden automatisch erkannt und gespeichert.

### Kann ich die BPM/Tonart manuell aendern?

Ja, per Rechtsklick auf den Track > BPM bearbeiten / Tonart bearbeiten.

### Was ist der A-B Loop?

Der A-B Loop ermoeglicht das wiederholte Abspielen eines bestimmten Abschnitts:
1. **B** druecken → Punkt A wird gesetzt
2. **B** erneut → Punkt B wird gesetzt → Loop startet
3. **B** nochmal → Loop wird deaktiviert

### Wie funktioniert Pitch-Shift?

Die Tonhoehe wird in Halbtonschritten (-6 bis +6) angepasst, ohne die Geschwindigkeit zu veraendern. Die Berechnung erfolgt ueber `playbackRate * 2^(semitones/12)`.

---

## Downloads

### Brauche ich yt-dlp manuell installieren?

Nein, die App installiert yt-dlp und ffmpeg automatisch bei Bedarf. Die Tools werden in `%APPDATA%/Lorus Musik Macher/bin/` gespeichert.

### Warum funktioniert der Spotify-Download nicht?

Der Spotify-Download nutzt die oEmbed API fuer Titel-Informationen und sucht dann auf YouTube. Moegliche Probleme:

- Der Spotify-Link ist ungueltig oder nicht oeffentlich
- Der Track wurde auf YouTube nicht gefunden
- yt-dlp ist nicht installiert (pruefe die Einstellungen)

### Warum wird mein Clipboard-Link nicht erkannt?

Die Clipboard-Erkennung unterstuetzt:
- YouTube: `youtube.com/watch?v=...`, `youtu.be/...`
- SoundCloud: `soundcloud.com/...`
- Spotify: `open.spotify.com/track/...`, `/album/...`, `/playlist/...`

---

## Premiere Pro

### Welche Premiere-Versionen werden unterstuetzt?

Die App kann `.prproj`-Dateien lesen, die als gzip-komprimiertes XML gespeichert sind. Dies umfasst die gaengigen Premiere Pro Versionen.

### Kann ich Tracks direkt in Premiere ziehen?

Ja, per Drag & Drop aus der Track-Tabelle direkt in die Premiere Pro Timeline. Die App nutzt den nativen Electron-Drag-Mechanismus.

### Was sind YouTube-Timestamps?

Aus den Clips eines Premiere-Projekts generierte Zeitmarken im YouTube-Format (`0:00 Titel`). Nuetzlich fuer Video-Beschreibungen.

---

## Problembehebung

### Die App startet nicht

1. Stelle sicher, dass die App korrekt installiert ist
2. Pruefe, ob eine neuere Version verfuegbar ist
3. Loesche den Cache: `%APPDATA%/Lorus Musik Macher/` entfernen
4. Deinstalliere und installiere die App neu

### Audio spielt nicht ab

1. Pruefe, ob der Audio-Cache existiert: `%APPDATA%/Lorus Musik Macher/audio/`
2. Importiere den Track erneut
3. Pruefe die Log-Datei: `%APPDATA%/Lorus Musik Macher/app.log`

### Die Waveform wird nicht angezeigt

1. Spiele den Track einmal ab (Waveform wird beim ersten Abspielen berechnet)
2. Loesche den Waveform-Cache: `%APPDATA%/Lorus Musik Macher/waveforms/`
3. Spiele den Track erneut ab

### Downloads schlagen fehl

1. Pruefe die Internetverbindung
2. Pruefe, ob yt-dlp installiert ist: `%APPDATA%/Lorus Musik Macher/bin/`
3. Aktualisiere yt-dlp ueber die Einstellungen
4. Pruefe die Log-Datei fuer Details

### Wie setze ich die App komplett zurueck?

1. IndexedDB loeschen: DevTools (Ctrl+Shift+I) > Application > IndexedDB > `MusikMacherDB` > Delete
2. Cache loeschen: `%APPDATA%/Lorus Musik Macher/` Ordner loeschen
3. App neu starten
