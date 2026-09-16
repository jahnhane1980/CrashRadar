import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function runVolumeAndMarginThresholdAnalysis() {
  console.log('========================================================================================');
  console.log('   EMPIRISCHE ANALYSE: DIE -20% MARGIN-CALL SCHWELLE & DAS VOLUMEN-MUSTER BEI GOLD');
  console.log('========================================================================================\n');

  // 1. Lade GLD (Tiingo Full mit Volume)
  const gldRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/cache/historical_prices/GLD_tiingo_full.json'), 'utf-8'));
  
  // Berechne rollierenden 50-Tage-Volumendurchschnitt für GLD
  const gldData = [];
  for (let i = 0; i < gldRaw.length; i++) {
    const item = { ...gldRaw[i] };
    if (i >= 49) {
      const slice = gldRaw.slice(i - 49, i + 1);
      const sumVol = slice.reduce((acc, c) => acc + (c.volume || 0), 0);
      item.sma50Vol = sumVol / 50;
      item.volRatio = item.sma50Vol > 0 ? item.volume / item.sma50Vol : 1;
    } else {
      item.sma50Vol = item.volume;
      item.volRatio = 1;
    }
    gldData.push(item);
  }

  const gldMap = new Map(gldData.map(d => [d.date, d]));

  // 2. Lade SPY aus MySQL
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [spyRows] = await conn.query(`
    SELECT record_date as date, close, volume
    FROM market_data_tiingo
    WHERE symbol = 'SPY'
    ORDER BY record_date ASC
  `);
  await conn.end();

  const spyMap = new Map(spyRows.map(d => [d.date, d]));

  // Krisen-Episoden mit GLD (ab 2004)
  const EPISODES = [
    {
      name: '2020 Corona Crash & Liquidity Freeze',
      start: '2020-02-10',
      end: '2020-04-15',
      spyPeakDate: '2020-02-19'
    },
    {
      name: '2008 Lehman Brothers & GFC Liquidity Black Hole',
      start: '2008-08-01',
      end: '2008-12-31',
      spyPeakDate: '2008-08-11'
    },
    {
      name: '2018 Q4 Fed Hike Crash (Korrektur bis -19.8%)',
      start: '2018-09-20',
      end: '2019-01-15',
      spyPeakDate: '2018-10-03'
    },
    {
      name: '2015/2016 China Devaluation / Flash Crash (-14.2%)',
      start: '2015-08-01',
      end: '2016-02-28',
      spyPeakDate: '2015-08-17'
    },
    {
      name: '2022 Fed Rate Hike Bear Market (Welle 1 bis -24.5%)',
      start: '2022-01-03',
      end: '2022-07-01',
      spyPeakDate: '2022-01-04'
    }
  ];

  for (const ep of EPISODES) {
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`📌 KRISE: ${ep.name.toUpperCase()}`);
    console.log(`----------------------------------------------------------------------------------------`);

    const tradingDays = spyRows
      .map(r => r.date)
      .filter(d => d >= ep.start && d <= ep.end && gldMap.has(d) && spyMap.has(d));

    if (tradingDays.length === 0) continue;

    const spyPeakPrice = spyMap.get(ep.spyPeakDate)?.close || 0;
    const gldAtSpyPeak = gldMap.get(ep.spyPeakDate)?.close || 0;

    let spyTroughPrice = Infinity, spyTroughDate = '';
    let gldTroughPrice = Infinity, gldTroughDate = '';
    let gldPeakPrice = 0, gldPeakDate = '';

    for (const d of tradingDays) {
      if (d < ep.spyPeakDate) continue;
      const s = spyMap.get(d).close;
      const g = gldMap.get(d).close;

      if (s < spyTroughPrice) { spyTroughPrice = s; spyTroughDate = d; }
      if (g < gldTroughPrice) { gldTroughPrice = g; gldTroughDate = d; }
      if (g > gldPeakPrice) { gldPeakPrice = g; gldPeakDate = d; }
    }

    const spyMaxDD = ((spyTroughPrice - spyPeakPrice) / spyPeakPrice) * 100;
    const gldMaxDD = ((gldTroughPrice - gldPeakPrice) / gldPeakPrice) * 100;

    console.log(`Gesamtdaten:`);
    console.log(`  • SPY Peak:   ${ep.spyPeakDate} ($${spyPeakPrice.toFixed(2)}) ➔ Trough: ${spyTroughDate} ($${spyTroughPrice.toFixed(2)}) | Max DD: ${spyMaxDD.toFixed(1)} %`);
    console.log(`  • GLD Peak:   ${gldPeakDate} ($${gldPeakPrice.toFixed(2)}) ➔ Trough: ${gldTroughDate} ($${gldTroughPrice.toFixed(2)}) | Max DD: ${gldMaxDD.toFixed(1)} %`);

    // Analyse der SPY Drawdown Schwellen und des Gold-Verhaltens
    console.log(`\nDetail-Verlauf nach SPY-Drawdown-Schwellen (ab SPY Peak):`);
    console.log(`| Datum      | SPY Kurs | SPY DD %  | GLD Kurs | GLD vs Peak | GLD Vol (Mio) | Vol / 50d MA | Phase / Marktverhalten |`);
    console.log(`|:-----------|:---------|:----------|:---------|:------------|:--------------|:-------------|:-----------------------|`);

    const thresholds = [-5, -10, -15, -18, -20, -25, -30, -35, -40];
    const loggedDates = new Set();

    // Wichtige Tage: SPY Peak, GLD Peak, Schwellen, GLD Trough, SPY Trough
    const keyDates = [ep.spyPeakDate, gldPeakDate, gldTroughDate, spyTroughDate];

    for (const d of tradingDays) {
      if (d < ep.spyPeakDate) continue;
      const s = spyMap.get(d);
      const g = gldMap.get(d);
      const currentSpyDD = ((s.close - spyPeakPrice) / spyPeakPrice) * 100;
      const currentGldChg = ((g.close - gldAtSpyPeak) / gldAtSpyPeak) * 100;
      const volMio = (g.volume / 1_000_000).toFixed(1);
      const volRatio = g.volRatio.toFixed(1);

      let isThreshold = false;
      for (const th of thresholds) {
        if (!loggedDates.has(`th_${th}`) && currentSpyDD <= th) {
          loggedDates.add(`th_${th}`);
          isThreshold = true;
          break;
        }
      }

      const isKey = keyDates.includes(d) && !loggedDates.has(d);
      if (isKey) loggedDates.add(d);

      if (isThreshold || isKey) {
        let label = '';
        if (d === ep.spyPeakDate) label = '📌 SPY Peak (Start)';
        else if (d === gldPeakDate) label = '🏆 GLD Peak (Safe Haven Top)';
        else if (d === gldTroughDate) label = '🩸 GLD Boden (Margin Call Ende)';
        else if (d === spyTroughDate) label = '🏁 SPY Boden (Aktien-Tief)';
        else if (currentSpyDD <= -20) label = '⚠️ Margin-Call Zone (< -20%)';
        else label = '🛡️ Safe Haven Zone (0 bis -18%)';

        console.log(`| ${d} | $${s.close.toFixed(2).padEnd(6)} | ${currentSpyDD.toFixed(1).padStart(5)} %   | $${g.close.toFixed(2).padEnd(6)} | ${(currentGldChg >= 0 ? '+' : '') + currentGldChg.toFixed(1).padStart(5)} %    | ${volMio.padStart(6)} Mio   | ${volRatio.padStart(5)}x        | ${label} |`);
      }
    }

    // Tägliche Detailtabelle rund um den Margin-Call Selloff (Peak GLD bis Trough GLD)
    if (gldPeakDate !== gldTroughDate) {
      console.log(`\nDetail-Chronologie der Gold-Liquidation (GLD Peak ${gldPeakDate} bis Boden ${gldTroughDate}):`);
      console.log(`| Datum      | SPY Kurs | SPY DD %  | GLD Kurs | Tag %   | GLD Vol (Mio) | Vol Ratio | Interpretation |`);
      console.log(`|:-----------|:---------|:----------|:---------|:--------|:--------------|:----------|:---------------|`);

      const liqDays = tradingDays.filter(d => d >= gldPeakDate && d <= gldTroughDate);
      for (let i = 0; i < liqDays.length; i++) {
        const d = liqDays[i];
        const s = spyMap.get(d);
        const g = gldMap.get(d);
        const prevG = i > 0 ? gldMap.get(liqDays[i - 1]) : g;
        const dayChg = ((g.close - prevG.close) / prevG.close) * 100;
        const spyDD = ((s.close - spyPeakPrice) / spyPeakPrice) * 100;
        const volMio = (g.volume / 1_000_000).toFixed(1);
        const volRatio = g.volRatio.toFixed(1);

        let interp = '';
        if (i === 0) interp = 'Gold Top / Safe Haven Peak';
        else if (i === liqDays.length - 1) interp = '🔥 Selling Climax / Letzte Panik';
        else if (g.volRatio >= 2.0) interp = '⚡ Starker Margin Call Druck';
        else interp = 'Zwangsliquidation';

        console.log(`| ${d} | $${s.close.toFixed(2).padEnd(6)} | ${spyDD.toFixed(1).padStart(5)} %   | $${g.close.toFixed(2).padEnd(6)} | ${(dayChg >= 0 ? '+' : '') + dayChg.toFixed(1).padStart(5)} % | ${volMio.padStart(6)} Mio   | ${volRatio.padStart(5)}x     | ${interp} |`);
      }
    }

    // Volumen am Tiefpunkt vs Erholung
    const gldBottom = gldMap.get(gldTroughDate);
    const spyBottom = spyMap.get(spyTroughDate);
    const gldAtSpyBottom = gldMap.get(spyTroughDate);
    const gldRebound = ((gldAtSpyBottom.close - gldBottom.close) / gldBottom.close) * 100;

    console.log(`\nKern-Erkenntnis für ${ep.name}:`);
    console.log(`  • Gold-Tief lag am: ${gldTroughDate} (SPY stand zu diesem Zeitpunkt bei ${(((spyMap.get(gldTroughDate).close - spyPeakPrice) / spyPeakPrice) * 100).toFixed(1)} %)`);
    console.log(`  • SPY-Tief lag am:  ${spyTroughDate} (SPY End-Drawdown: ${spyMaxDD.toFixed(1)} %)`);
    console.log(`  • Gold Rebound vom Tief bis zum SPY-Boden: +${gldRebound.toFixed(1)} %`);
    console.log(`  • Maximales GLD-Volumen im Liquidations-Fenster: ${(Math.max(...tradingDays.filter(d => d >= gldPeakDate && d <= gldTroughDate).map(d => gldMap.get(d).volRatio))).toFixed(1)}x des 50d Schnitts!`);
  }
}

runVolumeAndMarginThresholdAnalysis();
