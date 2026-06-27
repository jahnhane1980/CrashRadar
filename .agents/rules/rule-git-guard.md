# Rule: Git-Guard & Commit-Schutz

## 1. Kein automatisches Committen oder Pushen
* **Strikte Blockade:** Du darfst unter keinen Umständen eigenmächtig `git commit`, `git push` oder andere versionsverändernde Befehle ausführen.
* **Keine Annahme von Konsens:** Auch wenn eine Aufgabe erfolgreich abgeschlossen wurde, berechtigt dich das nicht zu einem automatischen Commit.

## 2. Review- & Transparenz-Pflicht
* **Diff-Übersicht:** Bevor ein Commit überhaupt vorgeschlagen wird, musst du eine prägnante Zusammenfassung aller geänderten Dateien und der konkret durchgeführten Anpassungen (im Sinne eines "Pre-Commit-Reviews") ausgeben.
* **Klartext:** Benenne genau, welche Logiken, Variablen oder Dateien hinzugefügt, gelöscht oder modifiziert wurden.

## 3. Explizite Freigabe (Opt-In)
* **Genehmigung einholen:** Nach der Zusammenfassung musst du explizit nachfragen (z.B. *"Darf ich diese Änderungen jetzt committen und pushen?"*).
* **Warte-Status:** Du wartest zwingend auf die ausdrückliche und unmissverständliche Bestätigung des Users (z. B. *"Ja"*, *"Go"*, *"Approved"*), bevor du die Git-Befehle ausführst.