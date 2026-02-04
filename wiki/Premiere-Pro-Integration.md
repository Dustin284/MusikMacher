# Premiere Pro Integration

Lorus Musik Macher ist speziell fuer die Zusammenarbeit mit Adobe Premiere Pro optimiert. Die Integration ermoeglicht es, Tracks direkt in Premiere-Projekte zu ziehen und die Nutzung zu verfolgen.

## Drag & Drop

Tracks koennen per nativen Electron-Drag direkt aus der App in Adobe Premiere Pro gezogen werden:

1. Waehle einen Track in der Bibliothek
2. Starte einen Drag auf der Track-Zeile
3. Ziehe den Track in die Premiere Pro Timeline
4. Die Audio-Datei wird automatisch eingefuegt

> **Technischer Hintergrund:** Die App nutzt `electron.startDrag()` fuer den nativen Drag-Mechanismus, der auch ausserhalb des App-Fensters funktioniert.

## Premiere-Projekte laden

### Unterstuetzte Formate

| Format | Beschreibung |
|--------|-------------|
| `.prproj` | Adobe Premiere Pro Projektdatei |

### Projekt laden

1. Wechsle zum **Premiere Pro**-Tab
2. Klicke auf **Projekt laden**
3. Waehle eine `.prproj`-Datei
4. Die App analysiert die Projektstruktur

### Projektanalyse

Die App extrahiert aus dem Premiere-Projekt:

- **Sequenzen** mit Clips
- **Audio-Clips** mit In/Out-Punkten
- **Clip-Position** in der Timeline (Sequenzposition)
- **Clip-Dauer** und Timing

### Technische Details

- `.prproj`-Dateien sind gzip-komprimierte XML-Dokumente
- Die App dekomprimiert die Datei ueber die `DecompressionStream` API
- XML wird geparst um Sequenzen, Tracks und Clips zu extrahieren
- Timing wird aus Premiere's Tick-System berechnet (254.016.000.000 Ticks pro Sekunde)

## Track-Nutzung verfolgen

Die App zeigt an, welche Tracks in welchen Premiere-Projekten verwendet werden:

- **Gruener Punkt:** Track ist in der Bibliothek vorhanden und wird im Projekt verwendet
- **Nutzungs-Popover:** Hover ueber den gruenen Punkt zeigt alle Projekte, die den Track nutzen

### Filter-Optionen

| Filter | Beschreibung |
|--------|-------------|
| Nur Track 1 | Zeigt nur Clips auf Audio Track 1 |
| Nur Bibliothek-Tracks | Zeigt nur Clips, die auch in der Bibliothek sind |
| Alle Clips | Zeigt alle Audio-Clips des Projekts |

## YouTube-Timestamps

Die App kann aus Premiere-Projekten YouTube-Timestamps generieren:

### Nutzung

1. Lade ein Premiere-Projekt
2. Klicke auf **YouTube-Timestamps generieren**
3. Waehle, welche Clips einbezogen werden sollen (Include/Exclude)
4. Die Timestamps werden im YouTube-Format generiert:

```
0:00 Intro
0:45 Erster Song
2:30 Zweiter Song
5:15 Dritter Song
```

### Clip-Filtering

- **Include:** Nur ausgewaehlte Clips in die Timestamps aufnehmen
- **Exclude:** Bestimmte Clips aus den Timestamps ausschliessen

## EDL Export

Die App kann Premiere-Projekt-Daten als EDL (Edit Decision List) exportieren:

### Format

Der Export erfolgt im **CMX3600**-Format, einem Industriestandard fuer den Austausch von Schnittlisten.

### Nutzung

1. Lade ein Premiere-Projekt
2. Klicke auf **EDL exportieren**
3. Waehle einen Speicherort
4. Die `.edl`-Datei wird erstellt

### EDL-Inhalt

Die exportierte EDL enthaelt:
- Clip-Nummer
- Reel-Name (aus dem Dateinamen)
- Edit-Typ (Cut)
- Source In/Out
- Record In/Out

## Projekt-Verwaltung

### Mehrere Projekte

Die App unterstuetzt das Laden und Verwalten mehrerer Premiere-Projekte gleichzeitig:

- Projekte werden in der Datenbank gespeichert
- Projekt-Filter ermoeglicht das Filtern der Track-Nutzung nach Projekt

### Projekt-Statistiken

Im [[Statistik-Dashboard]] werden Premiere-Pro-Projekte ausgewertet:

- Anzahl genutzter Tracks pro Projekt
- Am haeufigsten genutzte Tracks ueber alle Projekte
