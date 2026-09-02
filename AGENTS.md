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

## 4. Formatierung & Integrität
* **Kommentar-Treue:** Bestehende Kommentare bleiben unverändert an ihrer exakten Position (außer sie sind fachlich nachweisbar veraltet).
* **Prettify:** Code-Ausgaben müssen sauber formatiert und exakt eingerückt ausgegeben werden. Fokus liegt auf maximaler Lesbarkeit.