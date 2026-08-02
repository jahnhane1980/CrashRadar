import os
import json
import datetime
import math

def load_json(filename):
    path = os.path.join('scratch/test_data', filename)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# 1. Load Datasets
sp500 = load_json('sp500_daily_1970_2026.json')
recession = load_json('recession_usrec.json')
tb3ms = load_json('yield_curve_tb3ms.json')
gs10 = load_json('yield_curve_gs10.json')
yc_10y3m = load_json('yield_curve_10y_3m.json')
gov_tax = load_json('gov_tax_receipts.json')
gov_interest = load_json('gov_interest_payments.json')
debt_gdp = load_json('us_public_debt_gdp.json')

# Convert S&P 500 to date-indexed dict and sorted date list
sp_map = {item['date']: item['close'] for item in sp500}
sp_dates = sorted(list(sp_map.keys()))

# Monthly S&P 500 prices (first trading day of month)
sp_monthly = {}
for d in sp_dates:
    month_key = d[:7]
    if month_key not in sp_monthly:
        sp_monthly[month_key] = sp_map[d]

# Convert Recessions to month-indexed dict (YYYY-MM)
rec_map = {}
for item in recession:
    rec_map[item['date'][:7]] = int(item['value'])

# Convert Rates & Spreads to month-indexed dicts
tb3_map = {item['date'][:7]: item['value'] for item in tb3ms}
gs10_map = {item['date'][:7]: item['value'] for item in gs10}

# Calculate 10Y-3M spread per month
spread_monthly = {}
all_months = sorted(list(set(tb3_map.keys()).intersection(gs10_map.keys())))
for m in all_months:
    spread_monthly[m] = gs10_map[m] - tb3_map[m]

# 2. Historical Major Fed Hiking / Yield Curve Inversion Cycles since 1970
# Define major peak inversion / hiking cycle turning points
cycles = [
    {"name": "1973-1974 Stagflation Cycle", "inversion_month": "1973-06", "peak_rate_month": "1974-07"},
    {"name": "1979-1982 Volcker Cycle", "inversion_month": "1978-11", "peak_rate_month": "1981-05"},
    {"name": "1989-1990 Golf War Cycle", "inversion_month": "1989-05", "peak_rate_month": "1989-04"},
    {"name": "2000 Dot-Com Bubble Cycle", "inversion_month": "2000-07", "peak_rate_month": "2000-11"},
    {"name": "2006-2008 Subprime Crisis Cycle", "inversion_month": "2006-07", "peak_rate_month": "2006-07"},
    {"name": "2019 Pre-Covid Inversion", "inversion_month": "2019-05", "peak_rate_month": "2019-04"},
    {"name": "2022-2024 Fed Tightening Cycle", "inversion_month": "2022-10", "peak_rate_month": "2023-07"}
]

print("==========================================================================")
print("   EMPIRISCHE EVALUIERUNG DER DALIO-THESE: FED-ZINSSCHOCK & CRASH-LAGS   ")
print("==========================================================================")

cycle_results = []

def get_future_month(start_ym, add_months):
    y, m = map(int, start_ym.split('-'))
    m_new = m + add_months
    y_new = y + (m_new - 1) // 12
    m_final = (m_new - 1) % 12 + 1
    return f"{y_new:04d}-{m_final:02d}"

def get_month_diff(ym1, ym2):
    y1, m1 = map(int, ym1.split('-'))
    y2, m2 = map(int, ym2.split('-'))
    return (y2 - y1) * 12 + (m2 - m1)

for c in cycles:
    inv_m = c["inversion_month"]
    
    # Find recession start within 36 months of inversion
    rec_start = None
    for offset in range(0, 36):
        test_m = get_future_month(inv_m, offset)
        if rec_map.get(test_m, 0) == 1:
            rec_start = test_m
            break
            
    # Track S&P 500 performance in the 36 months following inversion
    sp_start_val = sp_monthly.get(inv_m)
    sp_min_val = sp_start_val
    sp_min_month = inv_m
    sp_max_val = sp_start_val
    sp_max_month = inv_m
    
    if sp_start_val:
        for offset in range(0, 37):
            curr_m = get_future_month(inv_m, offset)
            val = sp_monthly.get(curr_m)
            if val:
                if val > sp_max_val:
                    sp_max_val = val
                    sp_max_month = curr_m
                if val < sp_min_val:
                    sp_min_val = val
                    sp_min_month = curr_m
                    
        # Max drawdown from peak to trough in window
        drawdown_pct = ((sp_min_val - sp_max_val) / sp_max_val) * 100
        lag_to_rec = get_month_diff(inv_m, rec_start) if rec_start else None
        lag_to_trough = get_month_diff(inv_m, sp_min_month)
        lag_peak_to_trough = get_month_diff(sp_max_month, sp_min_month)
        
        cycle_results.append({
            "name": c["name"],
            "inversion_month": inv_m,
            "rec_start": rec_start,
            "lag_to_rec": lag_to_rec,
            "sp_max_month": sp_max_month,
            "sp_min_month": sp_min_month,
            "drawdown_pct": round(drawdown_pct, 2),
            "lag_inversion_to_trough": lag_to_trough,
            "lag_peak_to_trough": lag_peak_to_trough
        })

# Output Event Study Table
print("\n1. ERGEBNISSE DER EVENT-STUDIE (Inversions-Zyklen vs. S&P 500 Crashs & Rezessionen):")
print("-" * 105)
print(f"{'Zyklus':<32} | {'Inversion':<9} | {'Rezession':<9} | {'Lag Rec':<7} | {'S&P Peak':<8} | {'S&P Trough':<10} | {'Max Drawdown':<12} | {'Lag Trough':<10}")
print("-" * 105)

lags_rec = []
lags_trough = []
drawdowns = []

for r in cycle_results:
    rec_str = r['rec_start'] if r['rec_start'] else 'Keine'
    rec_lag_str = f"{r['lag_to_rec']} M" if r['lag_to_rec'] is not None else "N/A"
    print(f"{r['name']:<32} | {r['inversion_month']:<9} | {rec_str:<9} | {rec_lag_str:<7} | {r['sp_max_month']:<8} | {r['sp_min_month']:<10} | {r['drawdown_pct']:>10.1f}% | {r['lag_inversion_to_trough']:>8} M")
    if r['lag_to_rec'] is not None:
        lags_rec.append(r['lag_to_rec'])
    if r['drawdown_pct'] < -10:
        lags_trough.append(r['lag_inversion_to_trough'])
        drawdowns.append(r['drawdown_pct'])

print("-" * 105)

avg_rec_lag = sum(lags_rec) / len(lags_rec) if lags_rec else 0
avg_trough_lag = sum(lags_trough) / len(lags_trough) if lags_trough else 0
avg_dd = sum(drawdowns) / len(drawdowns) if drawdowns else 0

print(f"\nSTATISTISCHE ZUSAMMENFASSUNG (1970-2026):")
print(f"  * Durchschnittliche Verzögerung Inversion -> Rezessionsbeginn: {avg_rec_lag:.1f} Monate")
print(f"  * Durchschnittliche Verzögerung Inversion -> S&P 500 Tiefpunkt:  {avg_trough_lag:.1f} Monate (~1.5 bis 2 Jahre)")
print(f"  * Durchschnittlicher S&P 500 Max Drawdown in Inversions-Phasen: {avg_dd:.1f}%")

# 3. Analysis of Stage 5: Government Debt Service Burden
tax_map = {item['date'][:7]: item['value'] for item in gov_tax}
int_map = {item['date'][:7]: item['value'] for item in gov_interest}
common_tax_int = sorted(list(set(tax_map.keys()).intersection(int_map.keys())))

print("\n2. ANALYSE VON STAGE 5 (Langfristiger Schuldenzyklus - Staatliche Zinsbelastung):")
print("-" * 80)
print(f"{'Jahr/Monat':<12} | {'Zinsausgaben ($B)':<18} | {'Steuereinnahmen ($B)':<20} | {'Zinslast-Quote (%)':<18}")
print("-" * 80)

selected_periods = ['1970-01', '1980-01', '1990-01', '2000-01', '2010-01', '2020-01', '2023-01', '2024-01', '2025-01', '2026-01']
for m in selected_periods:
    if m in tax_map and m in int_map:
        t_val = tax_map[m]
        i_val = int_map[m]
        ratio = (i_val / t_val) * 100 if t_val > 0 else 0
        print(f"{m:<12} | ${i_val:>16.1f}B | ${t_val:>18.1f}B | {ratio:>16.1f}%")

print("-" * 80)
