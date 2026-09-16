import 'dotenv/config';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { TreasuryCapacityRadarIndicator } from '../../src/analysis/indicators/TreasuryCapacityRadarIndicator.js';

async function runCapacityCheck() {
  console.log('====================================================================================================');
  console.log('   TREASURY CAPACITY RADAR: EVALUATION VON DEZEMBER 2024 BIS MAI 2025');
  console.log('====================================================================================================\n');

  const fe = new FinanceExpert();
  // Lade ab 2024-06-01 damit der 60-Tage-Lookback für Dez 2024 vollständig ist
  const timeline = await fe.getDailyGroupedData('2024-06-01', { bypassMemoryGuard: true });
  await fe.close();

  const indicator = new TreasuryCapacityRadarIndicator();

  console.log(`Geladene Handelstage: ${timeline.length}`);

  // Filtere Zeitraum 2024-12-01 bis 2025-05-31
  const dates = timeline.map(t => t.date).filter(d => d >= '2024-12-01' && d <= '2025-05-31');

  let prevStatus = '';
  let prevCollision = '';
  let prevCatalyst = '';

  console.log('\nChronologie der Status- und Datumsbereich-Meldungen:');
  console.log('| Datum      | Status   | Score    | Liquid Slack | Katalysator         | Projiziertes Crash-/Kollisions-Fenster               |');
  console.log('|:-----------|:---------|:---------|:-------------|:--------------------|:-----------------------------------------------------|');

  for (let i = 0; i < timeline.length; i++) {
    const d = timeline[i].date;
    if (d < '2024-12-01' || d > '2025-05-31') continue;

    const subTimeline = timeline.slice(0, i + 1);
    const result = indicator.evaluate(subTimeline);

    const isStatusChange = result.status !== prevStatus;
    const isCollisionChange = result.projectedCollision !== prevCollision;
    const isCatalystChange = result.catalystStatus !== prevCatalyst;
    const isFirstOrLast = d === dates[0] || d === dates[dates.length - 1];
    const isWeekly = d.endsWith('-01') || d.endsWith('-15');

    if (isStatusChange || isCollisionChange || isCatalystChange || isFirstOrLast || isWeekly) {
      const slack = result.details?.liquidSlackBillion !== undefined ? `$${result.details.liquidSlackBillion}B` : '-';
      console.log(`| ${d} | ${result.status.padEnd(8)} | ${(result.value || '-').padEnd(8)} | ${slack.padEnd(12)} | ${(result.catalystStatus || '-').padEnd(19)} | ${(result.projectedCollision || '-').padEnd(52)} |`);
      
      prevStatus = result.status;
      prevCollision = result.projectedCollision;
      prevCatalyst = result.catalystStatus;
    }
  }

  // Detaillierte Prüfung wichtiger Meilensteine:
  // 1. Peak am 19.02.2025
  // 2. Crash-Start Anfang März 2025
  // 3. Tax-Day 15.04.2025 / Boden 08.04.2025
  const keyCheckDates = ['2024-12-02', '2025-01-06', '2025-02-19', '2025-03-03', '2025-03-10', '2025-04-01', '2025-04-08', '2025-04-15', '2025-05-01'];
  console.log('\n\nDetail-Meldungen an Schlüssel-Tagen:');
  for (const kd of keyCheckDates) {
    const idx = timeline.findIndex(t => t.date === kd);
    if (idx >= 0) {
      const res = indicator.evaluate(timeline.slice(0, idx + 1));
      console.log(`\n📅 [${kd}] Status: ${res.status} (${res.value})`);
      console.log(`   • Katalysator: ${res.catalystStatus}`);
      console.log(`   • Kollision / Crash-Fenster: "${res.projectedCollision}"`);
      console.log(`   • Message: ${res.message}`);
      if (res.details) {
        console.log(`   • Details: Slack: $${res.details.liquidSlackBillion}B, TGA: $${res.details.tgaBillion}B, Refill-Defizit: $${res.details.tgaRefillDeficitB}B, NetCoupons: $${res.details.netCouponsBillion}B, TTC: ${res.details.ttcDays} Tage`);
      }
    }
  }
}

runCapacityCheck().catch(console.error);
