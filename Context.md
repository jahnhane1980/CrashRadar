# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Aktueller Fokus: Signal-vs-Execution Hypothese (Fraktales Trading)
* **Ziel:** Mathematischer Beweis der Theorie, dass Makro-Signale (Daily) nicht sofort am gleichen Tag, sondern zwingend auf tieferen Timeframes (M5/Intraday) exekutiert werden müssen, um Slippage zu vermeiden und den Edge zu erhalten.
* **Besonderer Fokus (Intraday-Zyklen):** Wir wollen auswerten, was uns spezifische Tageszeiten über die Marktstruktur verraten, z.B. das Verhalten direkt nach Markteröffnung (Open) und während der Power Hour (letzte Handelsstunde).
* **Datengrundlage:** Der Backtest greift auf unsere neu importierte `market_data_m5` Tabelle (über 840.000 5-Minuten-Kerzen) in der lokalen MySQL Datenbank zu.
* **Relevante Dokumentation:**
  * [docs/Signal-vs-Execution-Hypothese.md](file:///C:/GitHub/CrashRadar/docs/Signal-vs-Execution-Hypothese.md) (Die ausformulierte Kernhypothese)
  * [docs/Analyse.md](file:///C:/GitHub/CrashRadar/docs/Analyse.md) (Eingliederung im großen Makro-Bild)
  * [ROADMAP.md](file:///C:/GitHub/CrashRadar/ROADMAP.md) (Siehe Punkt 8 bzgl. der M5-Datensynchronisation und Tabellen-Struktur)