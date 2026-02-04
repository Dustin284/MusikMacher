# Statistik-Dashboard

Das Statistik-Dashboard bietet einen umfassenden Ueberblick ueber deine Musikbibliothek.

## Zugriff

Wechsle zum **Statistik**-Tab in der Hauptnavigation.

## Uebersichtskarten

Am oberen Rand werden Kennzahlen angezeigt:

| Kennzahl | Beschreibung |
|----------|-------------|
| Tracks gesamt | Gesamtanzahl aller Tracks in allen Bibliotheken |
| Gesamtdauer | Gesamtlaenge aller Tracks (HH:MM:SS) |
| Wiedergaben | Summe aller Wiedergaben ueber alle Tracks |
| Durchschnittsbewertung | Mittlere Bewertung aller bewerteten Tracks |

## Diagramme

### BPM-Verteilung

Balkendiagramm, das zeigt, wie viele Tracks in welchen BPM-Bereichen liegen:

- Gruppierung in sinnvolle Bereiche (z.B. 60-80, 80-100, 100-120, etc.)
- Hilft bei der Einschaetzung des musikalischen Spektrums

### Tonart-Verteilung

Balkendiagramm mit der Verteilung der musikalischen Tonarten:

- Zeigt alle erkannten Tonarten (Camelot-Notation)
- Hilfreich fuer harmonisches Mixing und DJ-Sets

### Bewertungsverteilung

Balkendiagramm der Sterne-Bewertungen:

- Verteilung von 1 bis 5 Sternen
- Unbewertete Tracks werden separat gezaehlt

## Listen

### Meistgespielte Tracks

Die am haeufigsten abgespielten Tracks mit:

- Trackname
- Play-Count-Badge (Anzahl der Wiedergaben)
- Sortiert nach Wiedergabeanzahl (absteigend)

### Tag-Nutzung (Top 15)

Die 15 am haeufigsten verwendeten Tags:

- Tag-Name
- Anzahl der zugewiesenen Tracks
- Sortiert nach Haeufigkeit

### Premiere-Pro-Nutzung

Zeigt die Nutzung von Tracks in Premiere-Projekten:

- Projektname
- Anzahl genutzter Tracks
- Am haeufigsten genutzte Tracks

### Zuletzt hinzugefuegt

Die neuesten Tracks in der Bibliothek:

- Sortiert nach Import-Datum (neueste zuerst)
- Zeigt Name und Erstelldatum

### Bibliotheken-Aufschluesselung

Verteilung der Tracks auf die verschiedenen Bibliotheken:

- Bibliotheksname
- Anzahl der Tracks
- Prozentualer Anteil

## Wiedergabe-Tracking

Die App trackt automatisch fuer jeden Track:

- **Wiedergabe-Anzahl:** Wird bei jedem Abspielen erhoeht
- **Zuletzt gespielt:** Zeitstempel der letzten Wiedergabe

Diese Daten werden in der Datenbank gespeichert und im Dashboard ausgewertet.
