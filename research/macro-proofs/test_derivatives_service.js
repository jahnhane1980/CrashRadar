import { DerivativesCycleService } from '../../src/services/DerivativesCycleService.js';

console.log('=== TEST DERIVATIVES CYCLE SERVICE (SEPTEMBER 2026) ===\n');

// Test today
const todayEval = DerivativesCycleService.evaluateDate('2026-09-14');
console.log('Evaluation for Today (2026-09-14):', todayEval);

// Test across entire September 2026
console.log('\n--- ZYKLEN-VERLAUF SEPTEMBER 2026 ---');
const dates = [
  '2026-09-01',
  '2026-09-09',
  '2026-09-10', // Futures roll
  '2026-09-11',
  '2026-09-14', // Today (Pre-OpEx Pressure)
  '2026-09-15',
  '2026-09-16', // VIX Settlement & FOMC
  '2026-09-17',
  '2026-09-18', // Quadruple Witching
  '2026-09-21', // Post-OpEx Unpinning Monday
  '2026-09-22',
  '2026-09-23',
  '2026-09-24'
];

for (const d of dates) {
  const res = DerivativesCycleService.evaluateDate(d);
  console.log(`${res.targetDate} | ${res.phase.padEnd(20)} | ${res.phaseLabel.padEnd(35)} | Tage zu VIX: ${res.daysToVixSettlement.toString().padStart(2)} | Tage zu OpEx: ${res.daysToOpEx.toString().padStart(2)}`);
}
