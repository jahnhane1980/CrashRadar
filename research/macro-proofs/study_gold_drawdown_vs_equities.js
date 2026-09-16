import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Lade gecachte historische Zeitreihen
const gldData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/cache/historical_prices/GLD_2004-11-18_2026-09-08.json'), 'utf-8'));
const spyData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/cache/historical_prices/SPY_2004-11-18_2026-09-08.json'), 'utf-8'));
const qqqData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/cache/historical_prices/QQQ_2014-10-01_2026-09-06.json'), 'utf-8'));

// Maps erstellen für O(1) Lookup nach Datum
const gldMap = new Map(gldData.map(d => [d.date, d.close]));
const spyMap = new Map(spyData.map(d => [d.date, d.close]));
const qqqMap = new Map(qqqData.map(d => [d.date, d.close]));

// Definierte historische Schock- und Korrektur-Perioden (15 % bis 35 %+ Drawdown):
const CRISIS_EPISODES = [
  {
    name: '2020 Corona Liquidity Shock',
    start: '2020-02-14',
    end: '2020-04-15',
    peakDate: '2020-02-19', // SPY Peak
  },
  {
    name: '2018 Q4 Fed Hike & Trade War Crash',
    start: '2018-09-25',
    end: '2019-01-15',
    peakDate: '2018-10-03', // SPY Peak
  },
  {
    name: '2015/2016 China Devaluation / Flash Crash',
    start: '2015-08-01',
    end: '2016-02-28',
    peakDate: '2015-08-17',
  },
  {
    name: '2022 Fed Rate Hike Bear Market (Welle 1 & Zins-Schock)',
    start: '2022-01-03',
    end: '2022-07-01',
    peakDate: '2022-01-04',
  },
  {
    name: '2008 Lehman Brothers Liquidity Black Hole',
    start: '2008-07-15',
    end: '2008-12-15',
    peakDate: '2008-08-11',
  }
];

console.log('========================================================================================');
console.log('   EMPIRISCHE ANALYSE: GOLD-VERHALTEN BEI 15-20%+ MARKTKORREKTUREN & MARGIN CALLS');
console.log('========================================================================================\n');

for (const ep of CRISIS_EPISODES) {
  console.log(`\n----------------------------------------------------------------------------------------`);
  console.log(`📌 KRISE: ${ep.name.toUpperCase()}`);
  console.log(`----------------------------------------------------------------------------------------`);

  // Relevante Handelstage filtern
  const tradingDays = spyData
    .map(d => d.date)
    .filter(d => d >= ep.start && d <= ep.end && gldMap.has(d));

  if (tradingDays.length === 0) continue;

  // 1. SPY & QQQ Peaks & Bottoms finden
  let spyPeak = 0, spyPeakDate = '';
  let spyTrough = Infinity, spyTroughDate = '';
  let qqqPeak = 0, qqqPeakDate = '';
  let qqqTrough = Infinity, qqqTroughDate = '';
  let gldPeak = 0, gldPeakDate = '';
  let gldTrough = Infinity, gldTroughDate = '';

  for (const d of tradingDays) {
    const s = spyMap.get(d);
    const q = qqqMap.get(d);
    const g = gldMap.get(d);

    if (s > spyPeak) { spyPeak = s; spyPeakDate = d; }
    if (s < spyTrough) { spyTrough = s; spyTroughDate = d; }

    if (q && q > qqqPeak) { qqqPeak = q; qqqPeakDate = d; }
    if (q && q < qqqTrough) { qqqTrough = q; qqqTroughDate = d; }

    if (g > gldPeak) { gldPeak = g; gldPeakDate = d; }
    if (g < gldTrough) { gldTrough = g; gldTroughDate = d; }
  }

  const spyMaxDD = ((spyTrough - spyPeak) / spyPeak) * 100;
  const qqqMaxDD = qqqPeak > 0 ? ((qqqTrough - qqqPeak) / qqqPeak) * 100 : null;
  const gldMaxDD = ((gldTrough - gldPeak) / gldPeak) * 100;

  console.log(`Aktien-Crash Gesamtausmaß:`);
  console.log(`  • SPY: Peak am ${spyPeakDate} ($${spyPeak.toFixed(2)}) ➔ Tief am ${spyTroughDate} ($${spyTrough.toFixed(2)}) | Drawdown: ${spyMaxDD.toFixed(1)} %`);
  if (qqqMaxDD) {
    console.log(`  • QQQ: Peak am ${qqqPeakDate} ($${qqqPeak.toFixed(2)}) ➔ Tief am ${qqqTroughDate} ($${qqqTrough.toFixed(2)}) | Drawdown: ${qqqMaxDD.toFixed(1)} %`);
  }
  console.log(`  • Gold (GLD/IGLN): Peak am ${gldPeakDate} ($${gldPeak.toFixed(2)}) ➔ Tief am ${gldTroughDate} ($${gldTrough.toFixed(2)}) | Drawdown: ${gldMaxDD.toFixed(1)} %`);

  // 2. Timeline-Verlauf: Wie tief war SPY gefallen, ALS Gold sein Tief (Margin-Call-Tief) erreichte?
  const spyAtGldBottom = spyMap.get(gldTroughDate);
  const spyDropAtGldBottom = ((spyAtGldBottom - spyPeak) / spyPeak) * 100;
  const qqqAtGldBottom = qqqMap.get(gldTroughDate);
  const qqqDropAtGldBottom = qqqPeak > 0 && qqqAtGldBottom ? ((qqqAtGldBottom - qqqPeak) / qqqPeak) * 100 : null;

  console.log(`\nMargin-Call-Dynamik (Der Zeitpunkt, an dem Gold kapitulierte):`);
  console.log(`  • Gold erreichte sein absolutes Tief am: ${gldTroughDate}`);
  console.log(`  • Zu diesem Zeitpunkt war der SPY bereits um: ${spyDropAtGldBottom.toFixed(1)} % eingebrochen (von Peak)`);
  if (qqqDropAtGldBottom) {
    console.log(`  • Zu diesem Zeitpunkt war der QQQ bereits um: ${qqqDropAtGldBottom.toFixed(1)} % eingebrochen`);
  }

  // 3. Vorlauf / Entkopplung: Wie viele Tage vor dem Aktien-Boden drehte Gold nach oben?
  const gldBottomTime = new Date(gldTroughDate).getTime();
  const spyBottomTime = new Date(spyTroughDate).getTime();
  const diffDays = Math.round((spyBottomTime - gldBottomTime) / (1000 * 60 * 60 * 24));

  console.log(`\nEntkopplung & Timing:`);
  if (diffDays > 0) {
    console.log(`  🚀 GOLD BÖDETE ${diffDays} TAGE VOR DEM S&P 500!`);
    console.log(`     Während der S&P 500 noch die verbleibenden ${(spyMaxDD - spyDropAtGldBottom).toFixed(1)} % weiter abstürzte, stieg Gold bereits wieder rasant an!`);
  } else if (diffDays === 0) {
    console.log(`  ⚡ Gold und Aktien böteten am exakt gleichen Tag.`);
  } else {
    console.log(`  ⚠️ S&P 500 bödete ${Math.abs(diffDays)} Tage vor Gold.`);
  }

  // 4. Gold-Rebound während der Rest-Panik der Aktien:
  const gldAtSpyBottom = gldMap.get(spyTroughDate);
  const gldReboundUntilSpyBottom = ((gldAtSpyBottom - gldTrough) / gldTrough) * 100;
  console.log(`  📈 Gold-Rebound vom Tief bis zum Aktientief: +${gldReboundUntilSpyBottom.toFixed(1)} % (während Aktien am Tiefpunkt panikten)`);

  // 5. Wöchentliche Meilensteine: Was machte Gold, als SPY -5%, -10%, -15%, -20% erreichte?
  console.log(`\nVerhalten von Gold bei SPY-Schwellenwerten (vom SPY Peak):`);
  const thresholds = [-5, -10, -15, -20, -25, -30];
  const hitThresholds = new Set();

  for (const d of tradingDays) {
    if (d < spyPeakDate) continue;
    const s = spyMap.get(d);
    const g = gldMap.get(d);
    const currentSpyDrop = ((s - spyPeak) / spyPeak) * 100;

    for (const th of thresholds) {
      if (!hitThresholds.has(th) && currentSpyDrop <= th) {
        hitThresholds.add(th);
        const gldChangeSinceSpyPeak = ((g - gldMap.get(spyPeakDate)) / gldMap.get(spyPeakDate)) * 100;
        console.log(`  [${d}] SPY fiel auf ${currentSpyDrop.toFixed(1)} %  ➔  Gold stand bei: ${gldChangeSinceSpyPeak >= 0 ? '+' : ''}${gldChangeSinceSpyPeak.toFixed(1)} % (vs. SPY Peak)`);
      }
    }
  }
}
