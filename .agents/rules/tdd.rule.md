# Rule: Test-Driven Development (Strict)

Wenn du den Auftrag erhältst, neue Logik zu schreiben oder bestehende zu ändern, musst du zwingend diesen Zyklus einhalten:

1. **Test First:** Erstelle oder modifiziere IMMER zuerst die zugehörige Test-Datei (z.B. `*.test.js` oder `*.spec.ts`).
2. **Fail State (Red):** Der Test muss die Anforderungen prüfen, bevor die eigentliche Logik existiert.
3. **Implementation (Green):** Erst NACHDEM die Test-Datei geschrieben wurde, erstellst oder modifizierst du die eigentliche Implementierungs-Datei.
4. **Keine Ausnahmen:** Schreibe niemals Produktionscode ohne einen vorherigen Test-Entwurf.