import { AnalysisRepository } from '../../../src/core/repositories/AnalysisRepository.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const repo = new AnalysisRepository(process.env.DATABASE_URL);

  console.log("=== SIMULATION DER DYNAMISCHEN REGELN (SEPTEMBER 2026) ===");

  // Helper to fetch series
  async function getSeries(seriesId, limitNum = 24) {
    const [rows] = await repo.pool.query(
      `SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = ? ORDER BY observation_date DESC LIMIT ${parseInt(limitNum, 10)}`,
      [seriesId]
    );
    return rows.reverse(); // Chronological
  }

  // Helper YoY
  function calcYoY(series) {
    const result = [];
    for (let i = 12; i < series.length; i++) {
      const current = series[i];
      const prevYear = series[i - 12];
      const yoy = ((current.value - prevYear.value) / prevYear.value) * 100;
      result.push({ date: current.date, yoy: parseFloat(yoy.toFixed(2)), value: current.value });
    }
    return result;
  }

  // 1. JTSJOL (Offene Stellen)
  const jolts = await getSeries('JTSJOL', 12);
  const joltsRecent = jolts.slice(-3);
  const jolts3mAvg = joltsRecent.reduce((acc, r) => acc + r.value, 0) / joltsRecent.length;
  console.log("\n1. JTSJOL (Offene Stellen):");
  console.log("   Letzte 3 Monate:", joltsRecent.map(r => `${r.date}: ${r.value}k`));
  console.log(`   3M Moving Average: ${jolts3mAvg.toFixed(0)}k`);
  console.log(`   Dynamischer Korridor (3M Avg ± 500k): [${(jolts3mAvg - 500).toFixed(0)}k - ${(jolts3mAvg + 500).toFixed(0)}k]`);
  console.log(`   Statischer JSON-Wert: [7000k - 8200k]`);

  // 2. NFP / PAYEMS (Stellenaufbau) & SAHM
  const payems = await getSeries('PAYEMS', 12);
  const payemsDiff = [];
  for (let i = 1; i < payems.length; i++) {
    payemsDiff.push({ date: payems[i].date, diff: payems[i].value - payems[i - 1].value });
  }
  const sahm = await getSeries('SAHMREALTIME', 6);
  console.log("\n2. NFP & SAHM:");
  console.log("   Payems Diff (letzte 3 Monate):", payemsDiff.slice(-3).map(r => `${r.date}: ${r.diff}k`));
  console.log("   Sahm Realtime (letzte 3 Monate):", sahm.slice(-3).map(r => `${r.date}: ${r.value}`));
  console.log(`   Dynamische NFP-Regel: Breakeven Employment (>=100k) & SAHM < 0.50`);
  console.log(`   Statischer JSON-Wert: PAYEMS_DIFF >= 100k & SAHM < 0.50`);

  // 3. PPIACO (Erzeugerpreise YoY)
  const ppiRaw = await getSeries('PPIACO', 36);
  const ppiYoY = calcYoY(ppiRaw);
  const ppiRecentYoY = ppiYoY.slice(-3);
  const ppi3mAvg = ppiRecentYoY.reduce((acc, r) => acc + r.yoy, 0) / ppiRecentYoY.length;
  console.log("\n3. PPI (Erzeugerpreise YoY):");
  console.log("   Letzte 3 Monate YoY:", ppiRecentYoY.map(r => `${r.date}: ${r.yoy}%`));
  console.log(`   3M Moving Average YoY: ${ppi3mAvg.toFixed(2)}%`);
  console.log(`   Dynamische Regel (3M-Avg + 0.3% Puffer): Max ${(ppi3mAvg + 0.3).toFixed(2)}%`);
  console.log(`   Statischer JSON-Wert: Max 3.0%`);

  // 4. CPILFESL (Core CPI YoY)
  const cpiRaw = await getSeries('CPILFESL', 36);
  const cpiYoY = calcYoY(cpiRaw);
  const cpiRecentYoY = cpiYoY.slice(-3);
  const cpi3mAvg = cpiRecentYoY.reduce((acc, r) => acc + r.yoy, 0) / cpiRecentYoY.length;
  const dff = await getSeries('DFF', 5);
  const currentDff = dff[dff.length - 1].value;
  console.log("\n4. Core CPI Inflation (YoY):");
  console.log("   Letzte 3 Monate YoY:", cpiRecentYoY.map(r => `${r.date}: ${r.yoy}%`));
  console.log(`   3M Moving Average YoY: ${cpi3mAvg.toFixed(2)}%`);
  console.log(`   Aktueller Leitzins DFF: ${currentDff}%`);
  console.log(`   Dynamische Regel A (3M-Avg + 0.10% Disinflations-Pfad): Max ${(cpi3mAvg + 0.10).toFixed(2)}%`);
  console.log(`   Dynamische Regel B (Realzins-Schutz: Core CPI < DFF - 0.25%): Max ${(currentDff - 0.25).toFixed(2)}%`);
  console.log(`   Statischer JSON-Wert: Max 3.4%`);

  // 5. FOMC (DFF Action)
  console.log("\n5. FOMC Zinsentscheid:");
  console.log(`   Aktueller Zins: ${currentDff}%`);
  console.log(`   Dynamische Regel: ALLOWED_VALUES ['PAUSE', 'CUT_25', 'CUT_50']`);
  console.log(`   Statischer JSON-Wert: ['PAUSE', 'CUT_25', 'CUT']`);

  // 6. PCEPILFE (Core PCE YoY)
  const pceRaw = await getSeries('PCEPILFE', 36);
  const pceYoY = calcYoY(pceRaw);
  const pceRecentYoY = pceYoY.slice(-3);
  const pce3mAvg = pceRecentYoY.reduce((acc, r) => acc + r.yoy, 0) / pceRecentYoY.length;
  console.log("\n6. Core PCE Preisindex (YoY):");
  console.log("   Letzte 3 Monate YoY:", pceRecentYoY.map(r => `${r.date}: ${r.yoy}%`));
  console.log(`   3M Moving Average YoY: ${pce3mAvg.toFixed(2)}%`);
  console.log(`   Dynamische Regel (3M-Avg + 0.10% Disinflations-Pfad): Max ${(pce3mAvg + 0.10).toFixed(2)}%`);
  console.log(`   Statischer JSON-Wert: Max 3.3%`);

  await repo.close();
}

main().catch(console.error);
