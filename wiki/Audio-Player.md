# Audio-Player

Der Audio-Player ist das zentrale Element fuer die Wiedergabe und Bearbeitung von Tracks.

## Grundfunktionen

| Funktion | Bedienung | Tastenkuerzel |
|----------|-----------|---------------|
| Play / Pause | Play-Button oder Doppelklick auf Track | `Space` |
| Vorspulen | Klick auf Waveform oder Slider | `ArrowRight` |
| Zurueckspulen | Klick auf Waveform oder Slider | `ArrowLeft` |
| Lauter | Lautstaerke-Slider | `ArrowUp` |
| Leiser | Lautstaerke-Slider | `ArrowDown` |
| Zufaelliger Track | — | `R` |

Der Skip-Wert (Standard: 10% der Tracklaenge) kann in den [[Einstellungen]] konfiguriert werden.

## Waveform

Die Waveform zeigt das Audio-Signal des aktuellen Tracks grafisch an.

### Navigation

- **Klick:** Springt zu der angeklickten Position
- **Playhead:** Zeigt die aktuelle Wiedergabeposition als Linie an

### Waveform-Notizen

Per **Alt+Klick** auf die Waveform koennen zeitgestempelte Notizen hinzugefuegt werden:

- Eine orangefarbene gestrichelte Linie markiert die Position
- Ein Sprechblasen-Icon zeigt an, dass eine Notiz vorhanden ist
- **Hover** ueber das Icon zeigt den Notiztext
- **Rechtsklick** auf die Notiz loescht sie

Waveform-Notizen eignen sich z.B. fuer:
- Markierung von interessanten Stellen
- Anmerkungen zu Uebergaengen
- Hinweise fuer den Schnitt in Premiere Pro

## Cue-Points

Cue-Points sind Positionsmarker, mit denen du schnell zu bestimmten Stellen im Track springen kannst. Jeder Track hat 9 Cue-Point-Slots.

### Cue-Points setzen

| Methode | Beschreibung |
|---------|-------------|
| Tastenkuerzel | `Shift+1` bis `Shift+9` setzt einen Cue-Point an der aktuellen Position |
| Klick | Klick auf einen leeren Cue-Button setzt ihn an der aktuellen Position |

### Cue-Points nutzen

| Methode | Beschreibung |
|---------|-------------|
| Tastenkuerzel | `1` bis `9` springt zum entsprechenden Cue-Point |
| Klick | Klick auf einen gesetzten Cue-Button springt zu dieser Position |

### Cue-Points loeschen

- **Rechtsklick** auf einen gesetzten Cue-Button entfernt ihn

### Cue-Point-Anzeige

- Gesetzte Cue-Points werden farbkodiert mit Glow-Effekt angezeigt
- Leere Slots zeigen einen gestrichelten Rand in der Slot-Farbe
- Auf der Waveform erscheinen Cue-Marker als 3px breite farbige Linien mit Schatten

### Automatische Cue-Points

Die App kann automatisch Drops und Builds im Track erkennen:

- **Drops:** Stellen mit plötzlichem Energie-Anstieg
- **Builds:** Stellen mit zunehmendem Aufbau

Automatische Cue-Points werden separat von den manuellen Cue-Points (1-9) gespeichert und auf der Waveform angezeigt.

## Wiedergabe-Geschwindigkeit

Die Geschwindigkeit kann zwischen **0.25x** und **3.0x** eingestellt werden:

| Aktion | Tastenkuerzel |
|--------|--------------|
| Schneller | `Ctrl+ArrowUp` |
| Langsamer | `Ctrl+ArrowDown` |
| Normalgeschwindigkeit (1.0x) | `Ctrl+0` |

Die aktuelle Geschwindigkeit wird im Player angezeigt.

## A-B Loop

Mit dem A-B Loop kannst du einen bestimmten Abschnitt des Tracks in Dauerschleife abspielen:

1. Druecke **B** um Punkt A zu setzen (Startpunkt)
2. Druecke **B** erneut um Punkt B zu setzen (Endpunkt)
3. Der Abschnitt zwischen A und B wird automatisch wiederholt
4. Druecke **B** nochmal um den Loop zu deaktivieren

Der Loop-Bereich wird auf der Waveform visuell hervorgehoben.

## Warteschlange (Queue)

Die Warteschlange ermoeglicht es, Tracks nacheinander abzuspielen:

- **Q** oeffnet/schliesst das Queue-Panel
- Tracks per Rechtsklick > "Zur Warteschlange" hinzufuegen
- Nach Ablauf eines Tracks startet der naechste automatisch

### Queue-Funktionen

- Tracks in der Queue neu anordnen
- Einzelne Tracks aus der Queue entfernen
- Gesamte Queue leeren

## Crossfade

Beim Wechsel zwischen Tracks kann ein sanfter Uebergang (Crossfade) aktiviert werden:

- Konfigurierbare Dauer: **0 bis 10 Sekunden**
- Einstellung unter [[Einstellungen]] > Wiedergabe
- Bei Dauer 0 ist Crossfade deaktiviert

## Pitch-Shift

Die Tonhoehe kann in Halbtonschritten angepasst werden, ohne die Geschwindigkeit zu veraendern:

| Aktion | Tastenkuerzel |
|--------|--------------|
| Tonhoehe hoch | `Shift+ArrowUp` |
| Tonhoehe runter | `Shift+ArrowDown` |
| Zuruecksetzen | `Shift+0` |

Bereich: **-6 bis +6 Halbtöne**

Die Berechnung erfolgt ueber: `playbackRate * 2^(semitones/12)`

## Wiedergabe-Statistiken

Die App trackt automatisch:

- **Wiedergabe-Anzahl** pro Track
- **Zuletzt gespielt** Zeitstempel

Diese Daten werden im [[Statistik-Dashboard]] ausgewertet.
