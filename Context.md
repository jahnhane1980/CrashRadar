# CrashRadar: System Context

*(Diese Datei bündelt die essenziellen Erkenntnisse aus den quantitativen Backtests (2006 - 2026) zu Gold und GDX. Sie dient als mathematisches Fundament für die künftige TradeSetupEngine und MacroRegimeEngine).*


## 6. Aktueller Status & Nächste Schritte

* **TODO: Echtes Refactoring `IndicatorEngine.js`:** Den Sandbox-Prototyp (`GoldGDXEngine`) in das Hauptsystem portieren. Die reine Preis/Momentum-Logik von den Makro-Einflüssen trennen.
* **TODO: Anti-Overfitting Test (Noise Injection):** Nach dem Refactoring im echten System einen Testlauf mit künstlichem Rauschen auf den Schwellenwerten (z.B. DXY-Grenze variabel zwischen 0,8 % und 1,2 %) durchführen.