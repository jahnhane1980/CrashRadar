import os
import json
import datetime

def load_json(filename):
    path = os.path.join('scratch/test_data', filename)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# Load data
sp500 = load_json('sp500_daily_1970_2026.json')
recession = load_json('recession_usrec.json')
tb3ms = load_json('yield_curve_tb3ms.json')
gs10 = load_json('yield_curve_gs10.json')
fedfunds = load_json('fed_funds_rate.json')
baa10y = load_json('credit_spread_baa10y.json')
m2 = load_json('money_supply_m2.json')
tax = load_json('gov_tax_receipts.json')
interest = load_json('gov_interest_payments.json')

# Create monthly maps
sp_map = {item['date'][:7]: item['close'] for item in sp500}
rec_map = {item['date'][:7]: int(item['value']) for item in recession}
tb3_map = {item['date'][:7]: item['value'] for item in tb3ms}
gs10_map = {item['date'][:7]: item['value'] for item in gs10}
ff_map = {item['date'][:7]: item['value'] for item in fedfunds}
baa_map = {item['date'][:7]: item['value'] for item in baa10y}
m2_map = {item['date'][:7]: item['value'] for item in m2}
tax_map = {item['date'][:7]: item['value'] for item in tax}
int_map = {item['date'][:7]: item['value'] for item in interest}

# Calculate M2 YoY Growth per month
m2_yoy = {}
all_m2_months = sorted(list(m2_map.keys()))
for i, m in enumerate(all_m2_months):
    if i >= 12:
        prev_m = all_m2_months[i-12]
        if m2_map[prev_m] > 0:
            m2_yoy[m] = ((m2_map[m] - m2_map[prev_m]) / m2_map[prev_m]) * 100

# Get common months for backtest (1970 - 2026)
months = [m for m in sorted(list(sp_map.keys())) if m >= '1970-01' and m <= '2026-07']

print("==========================================================================")
print("   HISTORISCHER BACKTEST: '3 VON 4 CRASH-BEDINGUNGEN ROT' (1970 - 2026)   ")
print("==========================================================================")

# Evaluate 4 Signals for every month:
# 1. Rate Stress: FEDFUNDS > 4.5% OR GS10 > 5.0%
# 2. Yield Curve Inversion: (GS10 - TB3MS) < 0
# 3. Credit Spread Stress: BAA10Y > 2.3% (Corporate Credit Risk)
# 4. Liquidity / Monetary Drain: M2 YoY < 3.0% OR Interest Expense % Tax Receipts > 30%

monthly_signals = []

for m in months:
    ff = ff_map.get(m, 0)
    g10 = gs10_map.get(m, 0)
    tb3 = tb3_map.get(m, 0)
    baa = baa_map.get(m, 0)
    m2g = m2_yoy.get(m, 10.0)
    tx = tax_map.get(m, 1)
    it = int_map.get(m, 0)
    interest_ratio = (it / tx) * 100 if tx > 0 else 0
    
    # Check 4 condition rules
    c1 = (ff > 4.5 or g10 > 5.0)                       # High Rate Stress
    c2 = ((g10 - tb3) < 0) if (g10 and tb3) else False # Inversion
    c3 = (baa > 2.30) if baa > 0 else (c1 and c2)      # Credit Spread Stress (fallback to macro stress if baa missing pre-1986)
    c4 = (m2g < 3.0 or interest_ratio > 30.0)          # Liquidity Drain / High Debt Burden
    
    red_count = sum([c1, c2, c3, c4])
    
    monthly_signals.append({
        'month': m,
        'sp500': sp_map[m],
        'rec': rec_map.get(m, 0),
        'c1': c1, 'c2': c2, 'c3': c3, 'c4': c4,
        'red_count': red_count
    })

# Group consecutive 3/4 RED triggers into distinct historical Clusters/Events
events = []
in_trigger = False
curr_event = None

for s in monthly_signals:
    if s['red_count'] >= 3:
        if not in_trigger:
            in_trigger = True
            curr_event = {
                'start_month': s['month'],
                'start_sp500': s['sp500'],
                'max_red': s['red_count'],
                'months': [s['month']]
            }
        else:
            curr_event['months'].append(s['month'])
            curr_event['max_red'] = max(curr_event['max_red'], s['red_count'])
    else:
        if in_trigger:
            in_trigger = False
            curr_event['end_month'] = curr_event['months'][-1]
            events.append(curr_event)

if in_trigger and curr_event:
    curr_event['end_month'] = curr_event['months'][-1]
    events.append(curr_event)

# For each 3/4 RED Cluster, measure subsequent S&P 500 Peak, Trough & Recession Lag
print(f"\nIDENTIFIZIERTE HISTORISCHE PHASEN MIT '3 VON 4 BEDINGUNGEN ROT': {len(events)} Phasen")
print("-" * 115)
print(f"{'Phase / Trigger-Start':<25} | {'Initial S&P':<11} | {'Dauer (Monate)':<14} | {'S&P Tiefststand':<15} | {'Max Drawdown':<14} | {'Lag bis Trough':<14}")
print("-" * 115)

def get_future_m(start_ym, add_m):
    y, m = map(int, start_ym.split('-'))
    mn = m + add_m
    yn = y + (mn - 1) // 12
    mf = (mn - 1) % 12 + 1
    return f"{yn:04d}-{mf:02d}"

def m_diff(ym1, ym2):
    y1, m1 = map(int, ym1.split('-'))
    y2, m2 = map(int, ym2.split('-'))
    return (y2 - y1) * 12 + (m2 - m1)

results_summary = []

for ev in events:
    sm = ev['start_month']
    initial_sp = ev['start_sp500']
    
    # Look ahead 36 months from trigger start to find absolute S&P 500 Trough & Peak
    min_sp = initial_sp
    min_m = sm
    max_sp = initial_sp
    max_m = sm
    
    for offset in range(0, 37):
        fm = get_future_m(sm, offset)
        val = sp_map.get(fm)
        if val:
            if val > max_sp:
                max_sp = val
                max_m = fm
            if val < min_sp:
                min_sp = val
                min_m = fm
                
    dd = ((min_sp - max_sp) / max_sp) * 100
    lag_trough = m_diff(sm, min_m)
    
    results_summary.append({
        'start_m': sm,
        'duration': len(ev['months']),
        'initial_sp': initial_sp,
        'min_m': min_m,
        'min_sp': min_sp,
        'drawdown': dd,
        'lag_trough': lag_trough
    })
    
    print(f"{sm + ' bis ' + ev['end_month']:<25} | {initial_sp:>11.2f} | {len(ev['months']):>14} | {min_m + ' (' + str(round(min_sp,1)) + ')':<15} | {dd:>12.1f}% | {lag_trough:>12} M")

print("-" * 115)

avg_lag = sum(r['lag_trough'] for r in results_summary) / len(results_summary)
avg_dd = sum(r['drawdown'] for r in results_summary) / len(results_summary)

print(f"\nSTATISTISCHE BILANZ:")
print(f"  * Durchschnittliche Zeit ab Trigger '3/4 ROT' bis zum S&P 500 Tiefpunkt: {avg_lag:.1f} Monate (~3 bis 12 Monate nach Trigger)")
print(f"  * Durchschnittlicher Kurseinbruch (Drawdown) nach Trigger: {avg_dd:.1f}%")
