# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Aktueller Fokus: FINRA Short-Volume & ML Veto-Wachhund
* **Status-Update (Juli 2026):** Das dreistufige Error- & Logging-Framework (inkl. Admin-Wachhund via Ntfy) wurde vollständig implementiert. Der gesamte Code nutzt nun den neuen Logger.
* **Architektur-Plan (ROADMAP Punkt 4):**
  1. **Integration der ML-Modelle:** Die überarbeiteten ML-Modelle (die nun auch Short-Volume und fundamentale Daten nutzen) müssen in die Pipeline.
  2. **Veto-Wachhund:** Erstellung einer `config/Fundamental-Veto-Config.json` und Implementierung eines harten Vetos, um Signale des neuronalen Netzes bei strukturellen Bilanz-Zusammenbrüchen zu blockieren.
* **Relevante Dokumentation:**
  * [ROADMAP.md](file:///C:/GitHub/CrashRadar/ROADMAP.md) (Siehe Punkt 4)