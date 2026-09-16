import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function runKombiAnalysis() {
  console.log('====================================================================================================');
  console.log('   SIMULATION: KATASTROPHEN-MATRIX / TOP-KOMBI ➔ WECHSEL IN GOLD ➔ EXIT BEI -18%/-19% DRAWDOWN');
  console.log('====================================================================================================\n');

  // 1. Lade GLD, SPY, QQQ, VIX
  const cacheDir = path.resolve(ROOT_DIR, 'data/cache/historical_prices');
  const gldRaw = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_tiingo_full.json'), 'utf8'));
  const gldMap = new Map(gldRaw.map(d => [d.date, d.close]));

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [spyRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
  const [qqqRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
  const [vixRows] = await conn.query(`SELECT record_date as date, close FROM market_data_yahoo WHERE symbol = '^VIX' ORDER BY record_date ASC`);
  await conn.end();

  const spyMap = new Map(spyRows.map(d => [d.date, d.close]));
  const qqqMap = new Map(qqqRows.map(d => [d.date, d.close]));
  const vixMap = new Map(vixRows.map(d => [d.date, d.close]));

  // 2. Lade Makro-Daten via FinanceExpert für Katastrophen-Matrix
  console.log('Lade historische Makro-Timeline ab 2004 via FinanceExpert...');
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
  await fe.close();

  const timelineMap = new Map();
  timeline.forEach(t => timelineMap.set(t.date, t));

  // SMA 200 für SPY berechnen
  const allTradingDays = spyRows.map(r => r.date).filter(d => gldMap.has(d) && vixMap.has(d)).sort();
  const spySma200 = new Map();
  for (let i = 0; i < allTradingDays.length; i++) {
    const d = allTradingDays[i];
    if (i >= 199) {
      let sum = 0;
      for (let j = 0; j < 200; j++) sum += spyMap.get(allTradingDays[i - j]);
      spySma200.set(d, sum / 200);
    }
  }

  // Net Liquidity 8W Delta & Margin Debt DD
  const weeklyNetLiq = [];
  const netLiqDeltaMap = new Map();
  for (let i = 0; i < timeline.length; i++) {
    const day = timeline[i];
    const nl = day.macroGroups?.NetLiquidity;
    if (nl && nl.WALCL !== undefined) {
      const dObj = new Date(day.date);
      const val = nl.WALCL - (nl.TGA || 0) - (nl.RRPONTSYD || 0);
      if (dObj.getDay() === 4 || weeklyNetLiq.length === 0) {
        weeklyNetLiq.push({ date: day.date, netLiq: val });
      }
    }
  }
  for (let i = 8; i < weeklyNetLiq.length; i++) {
    const cur = weeklyNetLiq[i].netLiq;
    const past8 = weeklyNetLiq[i - 8].netLiq;
    const deltaPct = past8 !== 0 ? ((cur - past8) / Math.abs(past8)) * 100 : 0;
    netLiqDeltaMap.set(weeklyNetLiq[i].date, deltaPct);
  }

  let runningMarginMax = 0;
  const marginDebtDdMap = new Map();
  for (let i = 0; i < timeline.length; i++) {
    const md = timeline[i].macroGroups?.Leading?.MarginDebt;
    if (md) {
      if (md > runningMarginMax) runningMarginMax = md;
      const dd = ((md - runningMarginMax) / runningMarginMax) * 100;
      marginDebtDdMap.set(timeline[i].date, dd);
    }
  }

  // Krisen-Episoden zur detaillierten Untersuchung:
  const CRISES = [
    {
      name: '2020 Corona Shock',
      peakDate: '2020-02-19',
      searchWindowStart: '2020-02-19',
      searchWindowEnd: '2020-04-15'
    },
    {
      name: '2008 Lehman Brothers & GFC',
      peakDate: '2007-10-09', // Allzeit-Hoch vor der Finanzkrise
      subPeakDate: '2008-08-11', // Sommer 2008 Pre-Lehman Hoch
      searchWindowStart: '2007-10-09',
      searchWindowEnd: '2008-12-31'
    },
    {
      name: '2018 Q4 Fed Hike Crash',
      peakDate: '2018-10-03',
      searchWindowStart: '2018-10-03',
      searchWindowEnd: '2019-01-15'
    },
    {
      name: '2022 Fed Rate Hike (Bärenmarkt Welle 1)',
      peakDate: '2022-01-04',
      searchWindowStart: '2022-01-04',
      searchWindowEnd: '2022-07-01'
    },
    {
      name: '2011 US Debt Downgrade & Eurokrise',
      peakDate: '2011-05-02',
      searchWindowStart: '2011-05-02',
      searchWindowEnd: '2011-10-31'
    }
  ];

  for (const cr of CRISES) {
    console.log(`\n----------------------------------------------------------------------------------------------------`);
    console.log(`📌 KRISE: ${cr.name.toUpperCase()}`);
    console.log(`----------------------------------------------------------------------------------------------------`);

    const spyPeak = spyMap.get(cr.peakDate);
    const qqqPeak = qqqMap.get(cr.peakDate);
    const gldPeak = gldMap.get(cr.peakDate);

    console.log(`Ausgangslage am Aktien-Peak (${cr.peakDate}):`);
    console.log(`  • SPY: $${spyPeak.toFixed(2)} | QQQ: $${qqqPeak ? qqqPeak.toFixed(2) : '-'} | GLD: $${gldPeak.toFixed(2)}`);

    // Suche den ersten Tag im Suchfenster, an dem die Katastrophen-Matrix triggert:
    let triggerDate = null;
    let triggerReason = '';
    let lastNetLiq = 0;
    let lastMarginDd = 0;

    const daysInWindow = allTradingDays.filter(d => d >= cr.searchWindowStart && d <= cr.searchWindowEnd);

    for (const d of daysInWindow) {
      if (netLiqDeltaMap.has(d)) lastNetLiq = netLiqDeltaMap.get(d);
      if (marginDebtDdMap.has(d)) lastMarginDd = marginDebtDdMap.get(d);

      const s = spyMap.get(d);
      const s200 = spySma200.get(d);
      const vix = vixMap.get(d);
      const tDay = timelineMap.get(d);
      const cfi = tDay?.macroGroups?.FinancialConditions?.ChicagoFedIndex ?? -0.5;

      const spyDD = ((s - spyPeak) / spyPeak) * 100;
      const chartBreak = s200 && s < s200 && spyDD <= -8.0;

      const reasons = [];
      if (vix >= 28.0) reasons.push(`VIX (${vix.toFixed(1)} >= 28)`);
      if (cfi > -0.20) reasons.push(`Kreditstress CFI (${cfi.toFixed(2)} > -0.20)`);
      if (lastNetLiq < -5.0) reasons.push(`NetLiq-Entzug (${lastNetLiq.toFixed(1)}% < -5%)`);
      if (lastMarginDd <= -5.0) reasons.push(`Deleveraging MarginDebt (${lastMarginDd.toFixed(1)}%)`);

      if (chartBreak && reasons.length > 0) {
        triggerDate = d;
        triggerReason = `Chart (SPY < SMA200 & DD ${spyDD.toFixed(1)}%) + ` + reasons.join(' + ');
        break;
      }
    }

    if (!triggerDate) {
      console.log(`  ⚠️ Die Katastrophen-Matrix hat in diesem Fenster KEINEN Notfall-Ausstieg ausgelöst (Normale Korrektur).`);
      continue;
    }

    // Analysiere Trigger-Tag:
    const spyAtTrigger = spyMap.get(triggerDate);
    const qqqAtTrigger = qqqMap.get(triggerDate);
    const gldAtTrigger = gldMap.get(triggerDate);
    const vixAtTrigger = vixMap.get(triggerDate);

    const spyDDAtTrigger = ((spyAtTrigger - spyPeak) / spyPeak) * 100;
    const qqqDDAtTrigger = qqqPeak ? ((qqqAtTrigger - qqqPeak) / qqqPeak) * 100 : null;
    const gldChgAtTrigger = ((gldAtTrigger - gldPeak) / gldPeak) * 100;

    console.log(`\n1. Die Kombi schlägt Alarm am: ${triggerDate}`);
    console.log(`   • Auslöser: ${triggerReason}`);
    console.log(`   • SPY am Trigger: $${spyAtTrigger.toFixed(2)} (Drawdown vom Peak: ${spyDDAtTrigger.toFixed(1)} %)`);
    if (qqqDDAtTrigger) console.log(`   • QQQ am Trigger: $${qqqAtTrigger.toFixed(2)} (Drawdown vom Peak: ${qqqDDAtTrigger.toFixed(1)} %)`);
    console.log(`   • VIX am Trigger: ${vixAtTrigger ? vixAtTrigger.toFixed(1) : '-'}`);
    console.log(`   • GLD am Trigger: $${gldAtTrigger.toFixed(2)}`);
    console.log(`   👉 "Wie viel war Gold da schon unterwegs?":`);
    console.log(`      Gold hatte sich seit dem Aktien-Peak um ${gldChgAtTrigger >= 0 ? '+' : ''}${gldChgAtTrigger.toFixed(2)} % bewegt.`);

    // 2. Was passierte ab dem Trigger bis zum Erreichen der -18% / -19% Schwelle?
    let target18Date = null;
    for (const d of daysInWindow) {
      if (d < triggerDate) continue;
      const s = spyMap.get(d);
      const dd = ((s - spyPeak) / spyPeak) * 100;
      if (dd <= -18.0) {
        target18Date = d;
        break;
      }
    }

    if (!target18Date) {
      console.log(`\n2. Erreichen der -18% Schwelle:`);
      console.log(`   • Der S&P 500 hat in dieser Krise die -18% Marke NACH dem Trigger NICHT mehr erreicht (Boden lag vorher)!`);
      // Finde stattdessen den Tiefpunkt
      let troughDate = triggerDate;
      let minSpy = spyAtTrigger;
      for (const d of daysInWindow) {
        if (d < triggerDate) continue;
        if (spyMap.get(d) < minSpy) { minSpy = spyMap.get(d); troughDate = d; }
      }
      const gldAtTrough = gldMap.get(troughDate);
      const gldProfit = ((gldAtTrough - gldAtTrigger) / gldAtTrigger) * 100;
      console.log(`   • Markt-Boden am: ${troughDate} (SPY Max DD: ${(((minSpy - spyPeak)/spyPeak)*100).toFixed(1)} %)`);
      console.log(`   • Gold-Gewinn von Kombi-Trigger bis Boden: ${gldProfit >= 0 ? '+' : ''}${gldProfit.toFixed(2)} % (GLD $${gldAtTrigger.toFixed(2)} ➔ $${gldAtTrough.toFixed(2)})`);
      continue;
    }

    const spyAt18 = spyMap.get(target18Date);
    const qqqAt18 = qqqMap.get(target18Date);
    const gldAt18 = gldMap.get(target18Date);

    const spyDropSinceTrigger = ((spyAt18 - spyAtTrigger) / spyAtTrigger) * 100;
    const qqqDropSinceTrigger = qqqAtTrigger ? ((qqqAt18 - qqqAtTrigger) / qqqAtTrigger) * 100 : null;
    const gldProfitSinceTrigger = ((gldAt18 - gldAtTrigger) / gldAtTrigger) * 100;
    const diffDays = Math.round((new Date(target18Date) - new Date(triggerDate)) / (1000 * 60 * 60 * 24));

    console.log(`\n2. Erreichen der -18%/-19% Schwelle am: ${target18Date} (${diffDays} Kalendertage nach dem Trigger)`);
    console.log(`   • SPY fiel weiter von $${spyAtTrigger.toFixed(2)} auf $${spyAt18.toFixed(2)} (${spyDropSinceTrigger.toFixed(1)} % weiterer Verlust)`);
    if (qqqDropSinceTrigger) {
      console.log(`   • QQQ fiel weiter von $${qqqAtTrigger.toFixed(2)} auf $${qqqAt18.toFixed(2)} (${qqqDropSinceTrigger.toFixed(1)} % weiterer Verlust)`);
    }
    console.log(`   • GLD stieg von $${gldAtTrigger.toFixed(2)} auf $${gldAt18.toFixed(2)}`);

    console.log(`\n3. 🎯 FAZIT & GEWINN MIT GOLD:`);
    console.log(`   • Reingewinn mit Gold von Kombi-Einstieg bis zum -18%-Exit:`);
    console.log(`     👉 +${gldProfitSinceTrigger.toFixed(2)} % GEWINN IN GOLD!`);
    console.log(`   • Vermiedener Aktienverlust (während man in Gold saß):`);
    console.log(`     👉 ${spyDropSinceTrigger.toFixed(1)} % beim SPY vermieden!`);
    if (qqqDropSinceTrigger) {
      console.log(`     👉 ${qqqDropSinceTrigger.toFixed(1)} % beim QQQ (Tech) vermieden!`);
    }
  }
}

runKombiAnalysis().catch(console.error);
