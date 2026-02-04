# Bibliothek-Verwaltung

Die Bibliothek-Verwaltung ist das Herzstück von Lorus Musik Macher. Hier organisierst du alle deine Audio-Dateien in uebersichtliche Kategorien.

## Bibliotheken

### Standard-Bibliotheken

Die App wird mit zwei Standard-Bibliotheken ausgeliefert:

| Bibliothek | Beschreibung | Loeschbar? |
|------------|-------------|------------|
| **Songs** | Fuer Musiktitel | Nein |
| **Effekte** | Fuer Sound-Effekte | Nein |

### Eigene Bibliotheken erstellen

1. Klicke auf das **+**-Icon neben "Bibliotheken" in der Seitenleiste
2. Vergib einen Namen
3. Waehle ein Icon aus der verfuegbaren Auswahl
4. Die Bibliothek erscheint in der Seitenleiste

### Bibliotheken verwalten

- **Umbenennen:** Rechtsklick auf die Bibliothek > Umbenennen
- **Loeschen:** Rechtsklick auf die Bibliothek > Loeschen (nur eigene Bibliotheken)
- **Reihenfolge aendern:** Bibliotheken per Drag & Drop neu anordnen
- **Auf-/Zuklappen:** Klick auf den Pfeil neben dem Bibliotheksnamen

## Projekte

Tracks koennen einem Projekt zugeordnet werden. So laesst sich die Bibliothek nach Projekten filtern.

### Projekt erstellen

1. Klicke auf **Neues Projekt** in der Seitenleiste unter "Projekte"
2. Vergib einen Projektnamen (und optional einen Kundennamen)
3. Das Projekt erscheint in der Seitenleiste

### Projekt auswaehlen

- Klicke auf ein Projekt in der Seitenleiste, um nur dessen Tracks zu sehen
- "Alle Projekte" zeigt alle Tracks (unabhaengig vom Projekt)

### Tracks einem Projekt zuweisen

- **Beim Import:** Neue Tracks werden automatisch dem aktuell ausgewaehlten Projekt zugeordnet (auch bei Ordner-Ueberwachung und Downloads)
- **Per Rechtsklick:** Kontextmenue > Bereich "Projekt" > Radio-Buttons waehlen
- **"Kein Projekt"** entfernt die Zuordnung — der Track bleibt unter "Alle Projekte" sichtbar

### Projekt-scoped Loeschen

Wenn ein Projekt ausgewaehlt ist, funktioniert "Loeschen" anders:

- **Im Projekt-Kontext:** "Aus Projekt entfernen" hebt nur die Zuordnung auf
- **In "Alle Projekte":** "Loeschen" entfernt den Track permanent
- Batch-Loeschen (Ctrl+Klick > Loeschen) verhaelt sich genauso

### Projekt loeschen

Beim Loeschen eines Projekts werden alle zugeordneten Tracks automatisch freigegeben (`projectId` entfernt). Die Tracks selbst bleiben erhalten und erscheinen weiterhin unter "Alle Projekte".

## Track-Tabelle

Die Track-Tabelle zeigt alle Tracks der ausgewaehlten Bibliothek an.

### Sichtbare Spalten

Ueber das Zahnrad-Icon in der Tabelle koennen Spalten ein- und ausgeblendet werden:

| Spalte | Beschreibung |
|--------|-------------|
| Name | Dateiname des Tracks |
| Dauer | Laenge in MM:SS |
| BPM | Beats per Minute (automatisch erkannt) |
| Tonart | Musikalische Tonart (Camelot-Notation) |
| Bewertung | 1-5 Sterne |
| Tags | Zugewiesene Tags |
| Kommentar | Freitextfeld |

### Sortierung

Klicke auf eine Spaltenüberschrift zum Sortieren:

- Name (A-Z / Z-A)
- BPM (aufsteigend / absteigend)
- Tonart
- Laenge
- Bewertung
- Erstelldatum

### Suche

- **Ctrl+F** oeffnet die Suchleiste
- Suche nach Trackname, Tags oder Kommentar
- Die Suche ist pro Bibliothek gespeichert

## Tags

Tags sind Schlagwoerter, mit denen Tracks kategorisiert werden koennen.

### Tags erstellen

1. Oeffne die Tag-Seitenleiste
2. Klicke auf **Tag erstellen**
3. Gib einen Namen ein

### Tags zuweisen

- **Einzeln:** Rechtsklick auf einen Track > Tags zuweisen
- **Mehrere Tracks:** Tracks mit Ctrl+Klick auswaehlen > Rechtsklick > Tags zuweisen
- **Beim Import:** Unterordner-Namen werden automatisch als Tags zugewiesen

### Tag-Eigenschaften

| Eigenschaft | Beschreibung |
|-------------|-------------|
| Favorit | Tag wird oben in der Seitenleiste hervorgehoben |
| Versteckt | Tag wird nicht in der Seitenleiste angezeigt |
| Sichtbar | Tag wird normal angezeigt |

### Smart Tags

Smart Tags sind regelbasierte Tags, die automatisch auf passende Tracks angewendet werden.

**Verfuegbare Regeln:**

| Feld | Operatoren |
|------|-----------|
| BPM | Gleich, Groesser als, Kleiner als, Zwischen |
| Tonart | Gleich, Enthaelt |
| Bewertung | Gleich, Groesser als, Kleiner als |
| Name | Enthaelt, Gleich |
| Kommentar | Enthaelt, Ist leer, Ist nicht leer |
| Dauer | Groesser als, Kleiner als, Zwischen |
| Tags | Enthaelt |

Regeln koennen mit **UND** oder **ODER** verknuepft werden.

## Favoriten

Tracks koennen als Favoriten markiert werden:

- **Herz-Icon:** Klick auf das Herz neben dem Tracknamen
- **Tastenkuerzel:** **F** druecken bei ausgewaehltem Track
- **Kontextmenue:** Rechtsklick > Als Favorit markieren

Ein gefuelltes rotes Herz zeigt einen Favoriten an. Der Filter-Button in der Toolbar ermoeglicht es, nur Favoriten bibliotheksuebergreifend anzuzeigen.

## Batch-Operationen

Mehrere Tracks gleichzeitig bearbeiten:

1. **Tracks auswaehlen:** Ctrl+Klick auf mehrere Tracks
2. **Batch-Leiste:** Erscheint automatisch mit folgenden Optionen:
   - Alle auswaehlen
   - Auswahl aufheben
   - Zur Warteschlange hinzufuegen
   - Bewertung setzen
   - Loeschen

Ausgewaehlte Tracks werden visuell hervorgehoben.

## Duplikat-Erkennung

Beim Import erkennt die App Duplikate automatisch:

- Vergleich basiert auf normalisiertem Dateinamen (ohne Endung, Gross-/Kleinschreibung ignoriert)
- Bereits vorhandene Tracks werden uebersprungen
- Duplikate in der Bibliothek werden gruppiert angezeigt

## Track-Kontextmenue (Rechtsklick)

| Option | Beschreibung |
|--------|-------------|
| Abspielen | Track starten |
| Zur Warteschlange | Track in die Queue einfuegen |
| Als Favorit markieren | Favorit-Status umschalten |
| Bewerten | 1-5 Sterne setzen |
| Tags zuweisen | Tag-Zuweisung oeffnen |
| Kommentar bearbeiten | Kommentar aendern |
| BPM analysieren | BPM neu erkennen lassen |
| Tonart analysieren | Tonart neu erkennen lassen |
| Track identifizieren | AcoustID-Fingerprinting starten |
| Projekt zuweisen | Track einem Projekt zuordnen oder Zuordnung aufheben |
| Verstecken | Track ausblenden (nicht loeschen) |
| Loeschen / Aus Projekt entfernen | Track permanent entfernen bzw. nur aus dem Projekt entfernen |

## Drag & Drop

Tracks koennen per Drag & Drop direkt in Adobe Premiere Pro gezogen werden. Die App nutzt den nativen Electron-Drag-Mechanismus fuer nahtlose Integration.

## Rückgaengig / Wiederherstellen

Die folgenden Aktionen koennen rueckgaengig gemacht werden (bis zu 50 Schritte):

- Track loeschen
- Bewertung aendern
- Kommentar aendern
- BPM aendern
- Tonart aendern
- Tags aendern
- Projekt-Zuweisung aendern
- Favorit-Status aendern
- Verstecken-Status aendern

| Aktion | Tastenkuerzel |
|--------|--------------|
| Rueckgaengig | Ctrl+Z |
| Wiederherstellen | Ctrl+Shift+Z |
