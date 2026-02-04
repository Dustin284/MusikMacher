# Equalizer und Effekte

Der Player bietet einen 3-Band Equalizer sowie Reverb und Kompressor fuer die Klangbearbeitung in Echtzeit.

## Audio-Signal-Kette

Das Audio-Signal durchlaeuft folgende Stationen:

```
Audio-Element
  → Bass-Filter (Lowshelf, 200 Hz)
  → Mid-Filter (Peaking, 1 kHz)
  → Treble-Filter (Highshelf, 4 kHz)
  → [optional] Kompressor
  → [optional] Reverb
  → Master-Volume
  → Ausgabe
```

Alle Effekte werden ueber die Web Audio API realisiert und laufen in Echtzeit.

## 3-Band Equalizer

Der EQ kann mit **E** ein-/ausgeschaltet werden.

### Baender

| Band | Frequenz | Filtertyp | Bereich |
|------|----------|-----------|---------|
| Bass | 200 Hz | Lowshelf | -12 bis +12 dB |
| Mid | 1.000 Hz | Peaking | -12 bis +12 dB |
| Treble | 4.000 Hz | Highshelf | -12 bis +12 dB |

### Bedienung

- Slider fuer jedes Band bewegen
- Bei 0 dB ist das Band neutral (keine Verstaerkung/Daempfung)
- Positive Werte verstaerken, negative daempfen
- EQ-Einstellungen bleiben beim Trackwechsel erhalten

### Typische Einsatzgebiete

| Situation | Empfehlung |
|-----------|-----------|
| Dumpfer Sound | Treble anheben (+3 bis +6 dB) |
| Zu viel Bass | Bass absenken (-3 bis -6 dB) |
| Stimme hervorheben | Mid anheben (+2 bis +4 dB) |
| Mehr Punch | Bass leicht anheben (+2 bis +4 dB) |

## Reverb

Der Reverb simuliert Raumklang mit einer synthetisch generierten Impulsantwort.

### Parameter

| Parameter | Beschreibung | Optionen |
|-----------|-------------|----------|
| Ein/Aus | Reverb aktivieren/deaktivieren | Toggle |
| Mix | Anteil des Reverb-Signals | 0% (trocken) bis 100% (nass) |
| Raumgroesse | Simulierte Raumgroesse | Klein, Mittel, Gross |

### Raumgroessen

| Groesse | Beschreibung |
|---------|-------------|
| Klein | Kurzer Nachhall, fuer Vocals und Dialoge |
| Mittel | Mittlerer Raum, fuer allgemeine Nutzung |
| Gross | Langer Nachhall, Halle/Kirche-Effekt |

Die Impulsantwort wird parametrisch generiert — keine externen Samples noetig.

## Kompressor

Der Dynamik-Kompressor reduziert den Dynamikumfang des Audio-Signals.

### Parameter

| Parameter | Beschreibung | Bereich |
|-----------|-------------|---------|
| Threshold | Ab welchem Pegel die Kompression einsetzt | -100 bis 0 dB |
| Ratio | Verhaeltnis der Kompression | 1:1 bis 20:1 |
| Attack | Wie schnell die Kompression einsetzt | 0 bis 1 Sekunde |
| Release | Wie schnell die Kompression nachlässt | 0 bis 1 Sekunde |
| Knee | Uebergang zwischen unkomprimiert und komprimiert | 0 bis 40 dB |

### Typische Einstellungen

| Einsatz | Threshold | Ratio | Attack | Release |
|---------|-----------|-------|--------|---------|
| Leichte Kompression | -20 dB | 2:1 | 0.01s | 0.1s |
| Moderate Kompression | -30 dB | 4:1 | 0.005s | 0.05s |
| Starke Kompression | -40 dB | 8:1 | 0.001s | 0.03s |

### Hinweis

Der Kompressor nutzt den nativen `DynamicsCompressorNode` der Web Audio API.

## FX-Panel

Das FX-Panel wird ueber den **FX**-Button im Player geoeffnet und bietet eine uebersichtliche Steuerung fuer Reverb und Kompressor.

### Bedienung

1. Klicke auf den **FX**-Button im Player
2. Das Panel oeffnet sich mit Reverb- und Kompressor-Sektionen
3. Aktiviere/deaktiviere Effekte einzeln
4. Passe Parameter per Slider an
5. Der **Reset**-Button setzt alle Werte auf Standard zurueck

### Tastenkuerzel

| Aktion | Taste |
|--------|-------|
| EQ ein/aus | `E` |
