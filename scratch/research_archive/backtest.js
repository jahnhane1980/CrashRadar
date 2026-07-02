import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { IndicatorEngine } from '../src/analysis/IndicatorEngine.js';

const expert = new FinanceExpert('data/Liquidity.sqlite');
const groupedData = expert.getDailyGroupedData('2015-01-01');
const engine = new IndicatorEngine();

const crashes = [
  { name: '2018 Zins-Crash', peak: '2018-09-20' },
  { name: '2020 Corona-Crash', peak: '2020-02-19' },
  { name: '2022 Inflations-Crash', peak: '2022-01-03' },
  { name: '2025 Crash', peak: '2025-02-19' }
];

let state = {};
engine.indicators.forEach(i => state[i.name] = 'OK');

const alerts = [];

// For every day, evaluate
for (let i = 60; i < groupedData.length; i++) {
  const slice = groupedData.slice(0, i + 1);
  const currentDate = groupedData[i].date;
  
  let hasCriticalLeading = false;
  let hasCriticalTrigger = false;
  let activeWarnings = [];

  engine.indicators.forEach(ind => {
    const res = ind.evaluate(slice);
    
    if (res.status === 'CRITICAL') {
      if (ind.category === 'LEADING') hasCriticalLeading = true;
      if (ind.category === 'TRIGGER') hasCriticalTrigger = true;
      
      if (state[ind.name] !== 'CRITICAL') {
        alerts.push({ date: currentDate, name: ind.name, type: 'CRITICAL', val: res.value });
        state[ind.name] = 'CRITICAL';
      }
    } else if (res.status !== 'CRITICAL' && state[ind.name] === 'CRITICAL') {
      state[ind.name] = res.status;
    }
  });

  // LOGIC FOR ACTUAL "EXIT" SIGNAL:
  // 1. A TRIGGER fires (Rate Shock or HYG Crash) -> Always a strong signal, especially if Leading is red.
  // 2. OR: We have a CRITICAL Leading AND a CRITICAL Trigger.
  // We'll define a pure exit if a Trigger hits CRITICAL.
  if (hasCriticalTrigger && !state['PORTFOLIO_EXIT']) {
    alerts.push({ date: currentDate, name: 'PORTFOLIO_EXIT', type: 'ACTION', val: 'SELL ALL' });
    state['PORTFOLIO_EXIT'] = true;
  } else if (!hasCriticalTrigger && state['PORTFOLIO_EXIT']) {
    // Reset if triggers calm down
    state['PORTFOLIO_EXIT'] = false;
  }
}

// Print results relative to crashes
for (const crash of crashes) {
  console.log(`\n--- CRASH: ${crash.name} (Peak: ${crash.peak}) ---`);
  // Find alerts in the 12 months prior AND up to 30 days AFTER the peak (to see late triggers)
  const crashDate = new Date(crash.peak);
  const oneYearPrior = new Date(crashDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  const postCrash = new Date(crashDate.getTime() + 60 * 24 * 60 * 60 * 1000);
  
  const relevantAlerts = alerts.filter(a => {
    const aDate = new Date(a.date);
    return aDate >= oneYearPrior && aDate <= postCrash;
  });
  
  if (relevantAlerts.length === 0) {
    console.log('Keine Vorwarnungen in diesem Zeitraum.');
  } else {
    relevantAlerts.forEach(a => {
      const daysPrior = Math.floor((crashDate - new Date(a.date)) / (1000 * 60 * 60 * 24));
      const timingStr = daysPrior >= 0 ? `${daysPrior} Tage vorher` : `${Math.abs(daysPrior)} Tage DANACH`;
      console.log(`- ${timingStr} (${a.date}): [${a.type}] ${a.name} -> ${a.val}`);
    });
  }
}
