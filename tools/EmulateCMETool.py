import datetime
import calendar
import yfinance as yf
"""
Ergebnis 17.9.26:
Aktueller Futures-Kurs: 96.1050

Implizite Durchschnittsrate des Monats: 3.8950%

Erwartete Rate nach Meeting: 3.6836%

Implizierte Wahrscheinlichkeit für 25 Bp Senkung: 100.0%

>> Problem des Skriptes:
Das Prinzip stimmt, aber der konkrete Wert wird nicht exakt mit dem übereinstimmen, was das CME FedWatch Tool live anzeigt.

Dafür gibt es vier konkrete Gründe:

Fest verdrahteter Meeting-Tag (meeting_day = 16, 30 Tage): Das Skript verwendet aktuell statische Beispielwerte für Kalendertage und Monatslänge. Wenn das anstehende FOMC-Meeting beispielsweise an Tag 18 eines 31-tägigen Monats stattfindet, verschiebt sich die Gewichtung der Tage vor und nach dem Entscheid spürbar.

Feste Ausgangsrate (current_rate = 4.08%): Im Skript ist ein fixer Platzhalter für die Effective Federal Funds Rate (EFFR) hinterlegt. Die CME zieht hierfür tagesaktuell die offizielle EFFR der Federal Reserve Bank of New York heran.

Front-Month vs. Spezifischer Kontrakt: ZQ=F liefert bei Yahoo Finance in der Regel den fortlaufenden Front-Month-Kontrakt (meist der aktuelle Monat). Für spätere Notenbanksitzungen benötigt man jedoch den Future des jeweiligen Sitzungsmonats (z. B. ZQV26 für Oktober oder ZQZ26 für Dezember).

Binomial-Modell der CME: Das CME FedWatch Tool rechnet nicht nur mit einem einfachen linearen Dreisatz, sondern wendet ein Wahrscheinlichkeitsmodell an, das auf die üblichen 25-Basispunkte-Zielkorridore der Fed (z. B. 4,25–4,50 %) kalibriert ist. Wenn der Markt mehr als 25 Basispunkte einpreist (also z. B. eine Wahrscheinlichkeit für einen 50-Bp-Schritt), fängt ein einfacher Deckel bei 100 % das nicht sauber ab.
"""
# 1. Kontrakt abrufen (Hinweis: Falls Yahoo ZQ=F nicht liefert,
#    können Daten via Interactive Brokers API, Barchart oder CME bezogen werden)
ticker = yf.Ticker("ZQ=F")
data = ticker.history(period="1d")

if not data.empty:
    future_price = data["Close"].iloc[-1]
else:
    # Beispielhafter Abrechnungskurs zur Illustration (z. B. 96.19)
    future_price = 96.19

# 2. Durchschnittliche implizite Rate für den Kontraktmonat berechnen
implied_average_rate = 100 - future_price
print(f"Aktueller Futures-Kurs: {future_price:.4f}")
print(f"Implizite Durchschnittsrate des Monats: {implied_average_rate:.4f}%")

# 3. Meeting-Gewichtung (Beispiel: FOMC-Meeting am Tag M im Monat)
# Da der Future den Monatsdurchschnitt abbildet:
# R_monat = (tage_vorher * R_alt + tage_nachher * R_neu) / tage_gesamt
#
# Umgestellt nach der erwarteten neuen Rate R_neu:
# R_neu = (R_monat * tage_gesamt - tage_vorher * R_alt) / tage_nachher

# Beispielhafte Parameter für eine Sitzung am 16. eines 30-tägigen Monats:
total_days = 30
meeting_day = 16
current_rate = 4.08  # Aktuelle Effective Federal Funds Rate (EFFR)

days_before = meeting_day
days_after = total_days - days_before

expected_new_rate = (implied_average_rate * total_days - days_before * current_rate) / days_after

# 4. Wahrscheinlichkeit für Zinsschritt berechnen (z. B. 25 Bp Senkung)
# Erwartete Änderung vs. 25-Bp-Schritt:
rate_change = current_rate - expected_new_rate
cut_probability = min(max(rate_change / 0.25, 0.0), 1.0) * 100

print(f"Erwartete Rate nach Meeting: {expected_new_rate:.4f}%")
print(f"Implizierte Wahrscheinlichkeit für 25 Bp Senkung: {cut_probability:.1f}%")