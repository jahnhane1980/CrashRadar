# Modus: Code-Buddy (Dauerhaft aktiv)

## 1. Wahrheit, Konsens & Keine Annahmen
* **Absolute Transparenz:** Nenne nur Bestätigtes als Fakt.
* **Keine Annahmen:** Wenn du eine Datei oder Struktur nicht genau kennst, triff niemals Annahmen. Du musst explizit nach der Datei fragen oder sie einlesen.
* **Receipt-Pflicht:** Belege jede Kontext-Suche in deiner Antwort (z.B. "Searching for 'X'... [Found in Y / Not found]").
* **Empirischer Proof-First:** Bei unklaren API-Antworten, Datenstrukturen, Rechenmodellen oder Grenzwerten immer zuerst einen schnellen Live-Check via `scratch/` ausführen, bevor Annahmen getroffen oder Entwürfe finalisiert werden.
* **Autonome Ausführung:** Vor großen Umbauten holst du dir eine Freigabe für deinen Fahrplan ein. Die eigentliche Umsetzung (Code, TDD, Dateianpassungen) führst du danach jedoch komplett autonom und fließend aus, ohne bei jeder Datei auf eine Freigabe zu warten. Du hältst den User durch prägnante Status-Updates auf dem Laufenden.

## 2. Struktur-Erhalt & Modifikations-Grenzen
* **Fokus-Garantie:** Ändere ausschließlich den Code, der explizit besprochen wurde. Bestehende Variablen, Konstanten und Logiken bleiben absolut unangetastet und werden nicht eigenmächtig ersetzt.
* **Keine ungefragten Optimierungen:** Code wird ohne vorherige Absprache nicht zusammengefasst, aufgeräumt oder refactored.
* **Hinweis-Pflicht:** Fallen dir Sicherheitsrisiken oder Design-Fehler auf, ändere sie nicht, sondern gib mir einen prägnanten Hinweis zur Entscheidung.

## 3. Workflow & Atomic-Change
* **Limitierung:** Verändere nur so viele Dateien auf einmal, wie du sicher im Kontext behalten kannst. Behalte deinen kontinuierlichen Fluss bei.
* **Fahrplan:** Erstelle bei größeren, komplexeren Aufgaben zuerst einen Step-by-Step-Fahrplan zur Freigabe.
* **2-Säulen-Doku & Spiegel-Disziplin (docs/ & scratch/):**
  * **Keine losen Root-Dateien:** Weder in `docs/` noch in `scratch/` dürfen Dateien direkt im Wurzelordner abgelegt werden (Ausnahme: `docs/README.md`).
  * **Strikte 2-Säulen-Trennung:** Jede neue Dokumentation gehört entweder in `docs/architecture/<bereich>/` (technische Spezifikationen, APIs, Schemas, Trading-Regeln) oder in `docs/research/<bereich>/` (empirische Analysen, Backtest-Beweise, Zyklen-Studien).
  * **Spiegelung in `scratch/`:** Experimentier- und Analyse-Code muss im exakt gleichnamigen gespiegelten Unterordner unter `scratch/architecture/<bereich>/` bzw. `scratch/research/<bereich>/` liegen.
  * **Tools vs. Trash:** Operative Prototypen/CLI-Hilfsmittel gehören nach `scratch/tools/`. Temporäre Einmal-Prüfungen oder Wegwerf-Skripte wandern nach `scratch/trash/`.
  * **Index-Pflege:** Jedes neu erstellte oder umbenannte Dokument in `docs/` wird unverzüglich in [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md) mit kurzer Kurzbeschreibung verlinkt.
* **Roadmap-Disziplin & Single Source of Truth (ROADMAP.md):**
  * **Dual-View-Prinzip:** [`ROADMAP.md`](file:///D:/GitHub/CrashRadar/ROADMAP.md) im Projekt-Root ist die alleinige operative Steuerzentrale. Sie trennt strikt zwischen statischer Architektur/Scope-Cuts (Kapitel 1.1–1.3) und dynamischer Zeitachse/Sprints (Kapitel 1.4), gefolgt von V2-Backlog (Kapitel 2) und Done-Archiv (Kapitel 3).
  * **Verbindliche Task-Tags:** Jede operative Aufgabe in den Sprints erhält zwingend ein einheitliches Präfix-Tag in eckigen Klammern:
    * `[Adapter]` (Datenbeschaffung & Broker-Schnittstellen wie Polygon, IBKR)
    * `[Radar]` (Signal-Radare wie BaseStockRadar, GrowthStockRadar, CryptoRegime)
    * `[Strategie]` (Portfolio-Strategien wie Kamikaze, Satellite, Gold-SPY, MCW, SevenSlot)
    * `[Engine]` (Kern-Engines & Orchestratoren wie PortfolioStrategyEngine)
    * `[SensorHub]` (Makro-, Liquiditäts- und Bottom-SensorHubs)
    * `[Broadcast]` (Discord-Webhooks, NotificationManager, 4-Fälle-Matrix)
    * `[DB]` (Datenbank-Tabellen, Schemas, Migrationen, z.B. macro_calendar_events)
    * `[Research]` (Backtests, Studien, Hypothesen-Validierung)
    * `[Quality]` (Chaos-Tests, CI/CD, Workflows, Fixtures, Code-Hygiene)
  * **Pflege-Regeln:**
    * Nach erfolgreichem Abschluss eines Tasks wird die Checkbox auf `[x]` gesetzt.
    * Werden während der Entwicklung Abweichungen oder Prüfbedarfe im Code entdeckt, werden sie als `🔍 ZU PRÜFEN / CODE-BEFUND` direkt im jeweiligen Sprint der Roadmap verankert.
    * Neue Ideen oder Scope-Diskussionen wandern entweder in den passenden Sprint oder in das V2-Backlog – keine losen „Schatten-Roadmaps“ im Chat.

## 4. Formatierung & Integrität
* **Kommentar-Treue:** Bestehende Kommentare bleiben unverändert an ihrer exakten Position (außer sie sind fachlich nachweisbar veraltet).
* **Prettify:** Code-Ausgaben müssen sauber formatiert und exakt eingerückt ausgegeben werden. Fokus liegt auf maximaler Lesbarkeit.

## 5. Testing-Philosophie & Chaos-Engineering (Indikatoren & Engines)
* **Keine reinen Schönwetter-Tests:** Indikatoren, Signal-Hubs und Strategien dürfen niemals nur auf glatten Standard-Daten getestet werden.
* **Deterministisches Chaos:** Tests müssen Zyklen, synthetisches Rauschen und extreme Kurssprünge (Gaps) abdecken. Wichtig: Verwende feste Fixtures oder deterministische Seeds – niemals ungesteuertes `Math.random()`, um Flaky Tests in der CI zu verhindern.
* **Struktur-Chaos & API-Ausfälle:** Teste aktiv das Fehlen von Schlüssel-Properties (z. B. unvollständige `macroGroups`, leere `assets`-Objekte, `null`-Werte), um Fallbacks (`UNKNOWN`, Default-Zustände) abzusichern.
* **Mathematische Singularitäten:** Erzwinge gezielt Division-by-Zero (z. B. Volumen = 0, Delta = 0, Zeitspanne = 0) und `NaN`-Eingaben, um unkontrollierte Abstürze abzufangen.
* **Anti-Overfitting-Prüfung:** Bei Backtest- und Logik-Validierungen im `scratch/`-Bereich immer synthetisches Rauschen beimischen, um Scheinkorrelationen von echten Makro-Kausalitäten zu trennen.