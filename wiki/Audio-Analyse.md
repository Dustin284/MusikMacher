# Audio-Analyse

Lorus Musik Macher analysiert Audio-Dateien automatisch und extrahiert wichtige musikalische Informationen.

## Automatische Analyse

Die Analyse wird beim **ersten Abspielen** eines Tracks gestartet (nicht beim Import). Dadurch bleibt der Import schnell, und die Analyse laeuft im Hintergrund.

### Analysierte Werte

| Wert | Beschreibung |
|------|-------------|
| BPM | Beats per Minute (Tempo) |
| Tonart | Musikalische Tonart (Camelot-Notation) |
| Waveform | Visuelle Darstellung des Audio-Signals |
| Drops/Builds | Automatisch erkannte Energie-Spitzen |

## BPM-Erkennung

### Algorithmus

1. **Downsampling:** Audio wird auf 11.025 Hz heruntergerechnet (fuer Geschwindigkeit)
2. **Onset Envelope:** Spektrale Fluss-Analyse erkennt rhythmische Impulse
3. **Autokorrelation:** Findet die dominante Beat-Periode
4. **Oktav-Korrektur:** Erkennt und korrigiert Halb-Tempo-Fehler

### Bereich

- Erkennungsbereich: **60 bis 200 BPM**
- Analysiert die **ersten 30 Sekunden** des Tracks

### Manuelle Korrektur

Falls die automatische Erkennung nicht korrekt ist:

1. Rechtsklick auf den Track > **BPM bearbeiten**
2. Manuell den korrekten Wert eingeben
3. Oder: Rechtsklick > **BPM analysieren** fuer erneute Erkennung

## Tonart-Erkennung

### Algorithmus

1. **FFT-Analyse:** Frequenzspektrum des Tracks
2. **Chroma-Feature-Extraktion:** Energie pro Halbton (C, C#, D, ..., B)
3. **Krumhansl-Schmuckler Profil:** Vergleich mit theoretischen Tonart-Profilen
4. **Ergebnis:** Beste Uebereinstimmung wird als Tonart gesetzt

### Camelot-Notation

Die Tonart wird im Camelot-System angezeigt, das in der DJ-Welt verbreitet ist:

| Camelot | Dur | Moll |
|---------|-----|------|
| 1B | B | — |
| 1A | — | G#m |
| 2B | F# | — |
| 2A | — | Ebm |
| ... | ... | ... |
| 8B | C | — |
| 8A | — | Am |

### Manuelle Korrektur

Rechtsklick auf den Track > **Tonart bearbeiten** ermoeglicht die manuelle Eingabe.

## Waveform-Berechnung

### Algorithmus

1. Audio wird vollstaendig geladen
2. **2048 Peak-Werte** werden extrahiert
3. Werte werden auf den Bereich **0 bis 1** normalisiert
4. Ergebnis wird als JSON-Array im Waveform-Cache gespeichert

### Caching

Berechnete Waveforms werden gecacht:

- Speicherort: `%APPDATA%/Lorus Musik Macher/waveforms/`
- Format: JSON-Arrays mit Peak-Werten
- Beim naechsten Laden wird die gecachte Version verwendet

### Rendering

Die Waveform wird per HTML Canvas gerendert:

- Unterstuetzung fuer High-DPI-Displays (Retina)
- Automatische Anpassung per `ResizeObserver`
- Playhead-Animation in Echtzeit

## Drop/Build-Erkennung

### Algorithmus

1. **RMS-Energie-Analyse:** Audio wird in 0.5-Sekunden-Fenster unterteilt
2. **Energie-Berechnung:** RMS-Wert (Root Mean Square) pro Fenster
3. **Delta-Analyse:** Energieaenderung zwischen aufeinanderfolgenden Fenstern
4. **Peak-Finding:** Stellen mit Energieaenderung > 2 Standardabweichungen
5. **Filterung:** Mindestabstand von 2 Sekunden zwischen Detektionen

### Ergebnis

- Erkannte Drops/Builds werden als automatische Cue-Points gespeichert
- IDs ab 100 (um sie von manuellen Cue-Points 1-9 zu unterscheiden)
- Anzeige auf der Waveform als spezielle Marker

## Audio-Fingerprinting (AcoustID)

Mit AcoustID koennen Tracks anhand ihres Audio-Fingerprints identifiziert werden.

### Voraussetzungen

1. AcoustID API-Key in den [[Einstellungen]] eingeben
2. `fpcalc` wird automatisch installiert (Chromaprint)

### Nutzung

1. Rechtsklick auf einen Track > **Track identifizieren**
2. Die App erstellt einen Fingerprint mit `fpcalc`
3. Der Fingerprint wird an die AcoustID-API gesendet
4. Bei Treffer wird der Track automatisch umbenannt: **Kuenstler - Titel**

### Hinweis

AcoustID funktioniert nur mit Tracks, die in der MusicBrainz-Datenbank vorhanden sind. Seltene oder eigene Produktionen werden moeglicherweise nicht erkannt.

## Album-Cover

### Automatische Extraktion

Die App extrahiert Album-Cover aus den ID3-Tags (APIC-Frame) der Audio-Dateien:

- Unterstuetzte Formate: JPEG, PNG (eingebettet in MP3/M4A)
- Cover werden als Blob-URLs im Speicher gehalten
- Duplikat-Erstellung wird durch URL-Caching vermieden

### Anzeige

- Cover werden im Player neben dem Tracknamen angezeigt
- In der Track-Tabelle als kleine Vorschau (wenn Spalte sichtbar)
