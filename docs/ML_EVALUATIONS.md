# CrashRadar: ML Model Evaluations & Historisches Labor-Tagebuch

Dieses Dokument dient als historisches Labor-Tagebuch für Trainingsläufe und Evaluierungen der Machine-Learning-Modelle. Da neuronale Netze als Blackbox operieren, ist es entscheidend festzuhalten, welche Features funktioniert haben, welche Biases entstanden sind und wo die Modelle von der starren Dow-Theorie-Mathematik abweichen.

---

## 1. Ergebnisse des initialen V2-Runs (BTC)
Beim Übergang zur V2-Architektur (Behebung von Look-Ahead Bias und Whipsawing) wurde das Bitcoin-Modell auf Basis einer strikten Dow-Theorie-Marktstruktur (Höhere Hochs, Tiefere Tiefs) trainiert.

* **Gesamt-Genauigkeit (Accuracy):** 73,7 % (auf komplett ungesehenen Test-Daten).
* **Der "Puffer"-Effekt (RSI & MACD):** In der V1-Architektur basierten Vorhersagen fast ausschließlich auf dem rohen Preis, was zu extremem Flimmern (Whipsawing) an gleitenden Durchschnitten führte. Durch die explizite Integration von RSI und MACD als Features nutzt das Netz diese nun erfolgreich als weiche "Puffer". Es gerät bei kurzfristigen Price-Action-Ausreißern nicht mehr sofort in Panik.
* **Early Stopping bewährt sich:** Das Modell stoppte das Training selbstständig nach 41 Epochen (Val-Loss Stagnation), wodurch Overfitting nachweislich verhindert wurde.

---

## 2. Palantir (PLTR) - ML Model Evaluation (Juli 2026)
Beim Trainieren und Testen des 7-Klassen-Modells für Palantir (`Log_Return_EMA3`, `Volume_Z_Score` als Features) zeigte sich im Test auf den Zeitraum Juni/Juli 2026 eine hochinteressante Divergenz zwischen sturer Mathematik und ML-Generalisierung:

* Der sture **Dow-Theorie RegimeLabeler** wertete den Absturz von $136 auf $107 (Bruch SMA-50) aufgrund der starren Drawdown-Mathematik sofort als `BEAR_MARKET`.
* Das **ML-Modell** verweigerte dieses harte Label und wertete die Situation souverän als `BULL_CORRECTION`.

**Erkenntnis:** Bei massiv volatilen Growth-Aktien wie PLTR (die aus einer extremen `BASE` von $6 kamen) ist nach einem 1.5-jährigen Bull-Run mathematisch oft nicht sofort klar, ob ein drastischer Rücksetzer der Start eines echten Bärenmarkts oder nur eine scharfe Korrektur ist. Das ML-Modell hat die Volatilität der Aktie ("Persönlichkeit") generalisiert und warnt hier erfolgreich vor vorzeitigen Bärenmarkt-Signalen, die der starre Algorithmus fälschlicherweise ausgeben würde.

---

## 3. Einzelaktien-Konfiguration (Growth: SOFI, ZETA, NVTS)
Die Champion-Konfiguration von PLTR (7 Klassen inkl. `BASE`, Nutzung von `Log_Return_EMA3`, `Volume_Z_Score`, `Dist_52w_High/Low`) wurde universell auf weitere Growth-Ticker angewendet. Die anschließende Evaluierung an historischen Wendepunkten brachte massive, aktienspezifische Bias-Muster zutage:

* **SOFI (25.0% Trefferquote):** Hat einen extremen **Bull-Bias** erlernt. Das Netz stuft selbst harte Bärenmärkte oft verharmlosend als `BULL_CORRECTION` ein. Klassische Bullenmärkte werden jedoch mit 99% Konfidenz sauber erkannt. (Hintergrund: Aktie hat extreme Short-Volumen-Resilienz).
* **ZETA (50.0% Trefferquote):** Das ausbalancierteste Modell dieser Gruppe. Erkannte historische Bullen- sowie tiefe Bärenmärkte exakt richtig (jeweils >99% Konfidenz). Schwächelt lediglich bei der präzisen Identifikation der feinen `BASE`-Übergänge.
* **NVTS (28.6% Trefferquote):** Ist durch massive historische Leerverkäufe "traumatisiert" und zeigt einen extremen **Bear-Bias** (prognostizierte in 6 von 7 Fällen `BEAR_MARKET`). Es überraschte jedoch positiv, indem es den aktuellen Stand (Juli 2026) isoliert als `BULL_CORRECTION` rettete.

**Fazit & Lösungsansatz:**
LSTMs neigen bei hochvolatilen, stark geshorteten Einzelwerten dazu, die primäre historische Stimmung der Aktie (Dauer-Bullish bei SOFI, Dauer-Bearish bei NVTS) stur zu "memorieren" (Rauschen statt Kausalität). 
Um dieses Rauschen zu durchbrechen, müssen die Modelle künftig zwingend mit **FINRA Short-Volume Daten** als dediziertem Feature neu trainiert werden.

**Empirische Erkenntnisse zu FINRA Short-Volume Daten:**
Eine empirische Auswertung extremer FINRA-Leerverkaufsdaten (Short Volume Ratio > 70-80%) offenbarte gravierende Verhaltensunterschiede bei diesen Einzelaktien:
* **ZETA:** Fungiert als Kontra-Indikator (60% Wahrscheinlichkeit für massive Short-Squeezes bis +20%).
* **NVTS:** Wirkt als reiner Volatilitäts-Verstärker (Aktie crasht entweder extrem weiter oder explodiert).
* **SOFI:** Zeigt sich als absolute Support-Wand (absorbiert Verkaufsdruck, crasht fast nie).
