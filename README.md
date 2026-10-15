# ISLAND DROP — 3D Battle Royale Shooter

## Projektaufbau

Alle aktuellen Dateien liegen direkt im Projekt-Hauptverzeichnis. Diese ZIP enthält absichtlich **keine Unterordner**. `project-paths.js` dokumentiert bereits die später geplanten Speicherorte `Models/` sowie `Welten/<Gebiet>/`; sie werden erst in einer späteren Version angelegt. `model-cache.js` enthält das vorbereitete GLB-Caching/Instancing-System für wiederverwendbare Modelle. Solange keine GLB-Assets mitgeliefert werden, werden Welt, Waffen und Hände prozedural erzeugt.

## Lokal starten

Node.js 18 oder neuer ist erforderlich.

```bash
npm install
npm start
```

Dann `http://localhost:10000` im Browser öffnen. Three.js wird über ein CDN geladen; eine Internetverbindung ist beim ersten Start erforderlich. Texturen werden direkt aus URLs geladen. Wenn eine Texturquelle nicht erreichbar ist, nutzt das Spiel eine generierte Ersatztextur.

## Render: echtes Online-Matchmaking

Diese Version nutzt `server.js` gleichzeitig als Datei-Server und kleinen WebSocket-Matchmaking-/Relay-Server. `package.json` installiert dafür `ws`.

1. Alle ZIP-Dateien in ein GitHub-Repository hochladen – Dateien bleiben direkt im Hauptverzeichnis.
2. Auf Render einen **Web Service** aus diesem Repository anlegen.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Nach dem erfolgreichen Deploy dieselbe Render-URL auf zwei verschiedenen PCs öffnen. Beide drücken **SPIELEN**. Der Server wartet auf zwei getrennte Internet-Verbindungen und startet für das Paar ein Match.

`server.js` liest den Render-Port aus `PORT` und verarbeitet WebSocket-Verbindungen auf `/ws`. Der Server koppelt Spieler paarweise und leitet Positionen sowie erlaubte Gameplay-Aktionen an den jeweiligen Mitspieler weiter. Die Räume liegen im Arbeitsspeicher des Render-Prozesses; starte daher zunächst genau eine laufende Web-Service-Instanz. Nach einem Server-Neustart gehen Warteschlange und laufende Matches verloren. Das ist echtes Online-Verbinden und Synchronisieren der zwei Spieler, aber noch kein voll autoritatives Anti-Cheat-/dediziertes Simulationssystem.

## Steuerung

- **SPIELEN** — online mit einem zweiten Spieler über Render verbinden
- **W/A/S/D** — bewegen, in der Luft mit Fallschirm steuern
- **Maus** — First-Person-Kamera drehen; ins Spielfenster klicken, um Pointer-Lock zu aktivieren
- **Leertaste im Flugzeug** — Absprungsequenz starten; wenn nicht abgesprungen wird, erfolgt nach etwa 48 Sekunden ein automatischer Absprung
- **Leertaste am Boden** — springen
- **M** — große Karte öffnen/schließen; Markierung per Klick setzen, auswählen und löschen
- **Shift** — sprinten; Ausdauer verbraucht sich und lädt sich wieder auf
- **1–5 / Mausrad** — Inventar-Slot wechseln
- **Linksklick** — Spitzhacke schwingen, Waffe abfeuern oder Healing benutzen (abhängig vom Slot)
- **Rechtsklick halten** — mit Schrotflinte/Pistole zielen
- **R** — nachladen
- **E gedrückt halten** — Truhe öffnen oder Munition aufnehmen; an Türen kurz E drücken
- **Esc** — Pointer-Lock freigeben bzw. Karte verlassen

## Enthaltene Systeme

- Fortnite-inspirierte Lobby mit gelbem SPIELEN-Button und kräftigem synthetischem Klick-Sound
- Vorgegebene KI-Inselkarte als bildschirmfüllende Karte/Minimap und als Layout-Vorlage für die prozedurale 3D-Insel
- 16 benannte Regionen, mehrere Landschaftsbiome, 8×8 Terrain-Chunks, nahe/mittlere/ferne Terrain-LOD, über 2.000 mögliche instanzierte Bäume, hunderte Felsen, dichter bebaute Städte, Straßen, Wasser und Brücken
- Militärtransportflugzeug, offene Heckklappe, First-Person-Absprungsequenz, automatischer Absprung nach langem Warten und erzwungene Entfernung der Flugzeugansicht beim Fall, mit Roll-Neuausrichtung gegen den kopfüber-Startfehler
- Freier Fall, automatischer Fallschirm nach ungefähr drei Sekunden, Kamera-Ruck und First-Person-Hände
- HUD wird erst nach Fallschirmöffnung mit einem Glitch-Effekt sichtbar; 100 Leben, 50 Schild, private Kartenmarkierungen, Minimap und Sprintleiste
- Inventar-Slots 1–5, prozedurale Pump-Schrotflinte (5 Schuss), Pistole (10 Schuss), Healing (bis zu drei Spritzen) und Munitions-Pickups
- Schussrückstoß, Iron-Sight-Ansicht, Patronenhülsen, Nachladeabläufe und Einschlagmarken
- 46 Loot-Truhen mit ein bis zwei Gegenständen und fünf Seltenheitsstufen, E-Halten mit Fortschrittskreis, synchronisierte Türen und zerbrechbare Fenster mit fallenden und verblassenden Glassplittern
- Schrumpfender Sturm mit sichtbarer Begrenzung und Schaden außerhalb der sicheren Zone
- Zentraler Pfadplan für die späteren `Models/`- und `Welten/`-Ordner, GLB-Cache und Instanced Rendering für wiederholte statische Modelle

## Online-Synchronisierung und Grenzen

`network.js` verbindet per `ws:` oder `wss:` über die laufende Render-Adresse. Zwei getrennte Geräte/Browser können dadurch ein gemeinsames Zwei-Spieler-Match finden. Der Server leitet Spielerpositionen, Truhen-/Loot-Aktionen, Munition-Pickups, Türen, Glasbruch und Schadensereignisse an den jeweiligen Mitspieler weiter. Die Karte und roten Zielmarkierungen bleiben lokal/pro Spieler privat.

Die Spielphysik, Sturmphase, Loot-Auflösung und Waffenlogik laufen weiterhin auf den Clients; der Server leitet Nachrichten weiter, statt jeden Spielschritt serverseitig zu berechnen. Das ist eine spielbare Online-Grundlage für zwei Freunde, aber für ein öffentliches kompetitives Spiel wären anschließend serverautoritative Bewegungs-/Trefferprüfung, Reconnects und Persistenz sinnvoll.

## Technischer Hinweis

Dies ist ein umfangreiches Browser-Spielprojekt mit prozedural erzeugten Assets und spielbaren Systemen, aber keine fertige AAA-Produktion. Die 3D-Regionen werden passend zur Karte prozedural angenähert; sie sind keine detailgetreue manuelle Nachbildung jedes Pixels. Waffen, Animationen und Hände werden vorerst aus Geometrie im Code erzeugt. Später können passende, lizenzierte GLB-Modelle und Animationsdateien nach `Models/` ergänzt werden.

## Loot-System

Truhen sind echte Loot-Quellen. Beim Öffnen spawnen ein oder zwei Items direkt an der Truhe. Der Zufallswurf ist an die Truhen-ID gebunden, damit beide Online-Spieler für dieselbe Truhe dieselbe Beute sehen. Die Ausrüstung muss dadurch aus Truhen gefunden werden; Schrotflinte, Pistole und Healing starten nicht als frei verfügbare Beute.

Loot hat fünf Seltenheitsstufen: **Gewöhnlich, Ungewöhnlich, Selten, Episch, Legendär**. Die höheren Stufen erscheinen seltener. Bei Waffen erhöhen höhere Stufen die Schadenswerte; bei Munition erhöhen sie die gefundene Menge. Healing bleibt auf die festgelegte Heilwirkung von 100 Leben begrenzt und kann bis zu drei Stück im Slot stapeln.

## Später geplante Ordner

Diese Version bleibt absichtlich ohne Unterordner. Wenn die nächste Asset-Version kommt, können die geplanten Ordner direkt angelegt werden:

```text
Models/
  <GLB-Modelle und später gemeinsame Animations-Assets>

Welten/
  FrostyPeaks.js
  VerdantValley.js
  SnowfallRidge.js
  TheForge.js
  StormyShores.js
  RavenCove.js
  ShadowWoods.js
  LostIsle.js
  RiftRocks.js
  WillowHeights.js
  SunflowerFields.js
  DustyDunes.js
  NeonHeights.js
  IronHarbor.js
  IronWoods.js
  CrownsRest.js
```

`project-paths.js` und `model-cache.js` sind bereits auf diese spätere Struktur vorbereitet. Wiederholte statische GLB-Assets können einmal geladen und anschließend per Instancing wiederverwendet werden.

## Planned folder migration

This release is intentionally flat. No `Models/` or `Welten/` folders are included yet.
`project-paths.js` centralizes the future paths, and `model-cache.js` already loads a GLB once and reuses it for repeated instances. When the planned folders are introduced, the files can be moved there without redesigning the systems.

### First-person weapon handling

Shotgun and pistol first-person poses now place both hands around the actual grip/support points instead of leaving the hands beside the weapon. Reload states expose progress to the hand rig so the hands animate together with the weapon.
