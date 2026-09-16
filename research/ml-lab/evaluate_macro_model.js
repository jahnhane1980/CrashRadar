/**
 * Evaluierungs- & Backtest-Skript für das Makro-ML-Modell
 * Führt Inferenz über alle historischen Crash-Phasen in Node.js aus.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { MacroMlService } from '../../src/services/MacroMlService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEvaluation() {
  const service = new MacroMlService('macro_regime');
  await service.loadModel();

  const csvPath = path.join(__dirname, '..', '..', 'data', 'historical_events_raw_indicators.csv');
  const csvData = fs.readFileSync(csvPath, 'utf8');
  const records = parse(csvData, { columns: true, skip_empty_lines: true });

  console.log(`\n============================================================`);
  console.log(`MAKRO-ML BACKTEST EVALUATION (Node.js Engine)`);
  console.log(`Auswertung über ${records.length} Handelstage & 8 Crash-Epochen`);
  console.log(`============================================================\n`);

  // Event-Gruppierung
  const events = {};
  for (const r of records) {
    const ev = r.Event_Name;
    if (!events[ev]) events[ev] = [];
    events[ev].push(r);
  }

  const results = [];

  for (const [eventName, eventRows] of Object.entries(events)) {
    let maxRisk = 0;
    let minRisk = 100;
    let prePeakRisk = 0;
    let peakRow = null;
    let bottomRow = null;
    let elevatedCount = 0;
    let acuteCount = 0;

    for (const row of eventRows) {
      const pred = service.predict(row);
      const risk = pred.riskPct;

      if (risk > maxRisk) maxRisk = risk;
      if (risk < minRisk) minRisk = risk;

      if (row.Event_Phase === 'PRE_PEAK_3M' && Math.abs(Number(row.Days_To_Peak)) <= 15) {
        prePeakRisk = risk;
      }
      if (row.Event_Phase === 'PEAK_ZONE') peakRow = { ...row, risk };
      if (row.Event_Phase === 'BOTTOM_ZONE') bottomRow = { ...row, risk };

      if (pred.regime === 'ELEVATED_RISK') elevatedCount++;
      if (pred.regime === 'ACUTE_CRASH_RISK') acuteCount++;
    }

    results.push({
      event: eventName,
      totalDays: eventRows.length,
      maxRiskPct: maxRisk,
      minRiskPct: minRisk,
      prePeak15dRiskPct: prePeakRisk,
      peakRiskPct: peakRow?.risk || 0,
      bottomRiskPct: bottomRow?.risk || 0,
      elevatedDays: elevatedCount,
      acuteDays: acuteCount
    });
  }

  console.table(results);

  // Test mit Live-Daten Stand 22.08.2026
  console.log(`\n------------------------------------------------------------`);
  console.log(`LIVE-TEST: Berechne Risiko-Score für aktuellen Markt (22.08.2026)`);
  console.log(`------------------------------------------------------------`);

  const liveSample = {
    Spread_10Y_2Y_Current: 0.50,
    Spread_10Y_2Y_Delta30d: 0.16,
    Spread_10Y_3M_Current: 0.50,
    FedFundsRate_DFF: 4.33,
    BankReserves_TOTRESNS_B: 3018.8,
    WRESBAL_Delta56d_B: -50.0,
    TGA_Balance_B: 935.1,
    TGA_Delta90d_B: 109.5,
    ReverseRepo_RRPONTSYD_B: 0.2,
    ReverseRepo_Delta30d_B: -5.0,
    FedBalance_WALCL_B: 6745.7,
    MarginDebt_Amount_M: 1417225,
    MarginDebt_Drawdown180d_Pct: 0.0,
    ChicagoFed_NFCI: -0.559,
    SKEW_Index: 143.9,
    AAII_BullBear_Spread_Pct: -4.4,
    DIX_DarkPool_Pct: 46.3,
    SPY_ShortVolumeRatio_Pct: 55.7,
    Total_PutCall_Ratio_PCR: 1.16,
    Gold_Close: 4661.6,
    DXY_Close: 98.84
  };

  const livePred = service.predict(liveSample);
  console.log(`Aktueller Makro-ML Crash-Risiko-Score : ${livePred.riskPct} %`);
  console.log(`Aktuelles Regime                     : ${livePred.regime}`);
  console.log(`Top Risiko-Treiber im Modell         :`, livePred.topDrivers.map(d => `${d.feature} (${d.importance_pct}%)`).join(', '));
}

runEvaluation();
