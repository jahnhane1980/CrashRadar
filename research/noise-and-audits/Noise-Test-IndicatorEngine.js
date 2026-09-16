import 'dotenv/config';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { IndicatorEngine } from '../../src/analysis/IndicatorEngine.js';

async function runNoiseTest() {
  console.log("Starte Noise-Test (Stabilitätsprüfung) für SPY...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Missing DATABASE_URL");

  const expert = new FinanceExpert(dbUrl);
  // Hole Daten ab 2007 (inklusive 2008 und 2020 Crash)
  const originalData = await expert.getDailyGroupedData('2007-01-01');
  await expert.close();

  if (originalData.length === 0) {
    console.log("Keine Daten gefunden.");
    return;
  }

  const engine = new IndicatorEngine();

  // Funktion zum Auswerten aller historischen Tage
  function countCriticalSignals(data) {
    let criticalCount = 0;
    
    // Wir durchlaufen die Zeitachse und füttern die Engine mit dem jeweiligen "Bis-Hierhin"-Ausschnitt
    for (let i = 50; i < data.length; i++) {
       const slice = data.slice(0, i);
       for (const ind of engine.indicators) {
          const res = ind.evaluate(slice);
          if (res.status === 'CRITICAL') {
             criticalCount++;
          }
       }
    }
    return criticalCount;
  }

  console.log("\n--- Durchlauf 1: Originaldaten ---");
  console.log("Scanne historische Daten (dies dauert einen Moment)...");
  const origCriticals = countCriticalSignals(originalData);
  console.log(`Gefundene CRITICAL Signale im echten Chart: ${origCriticals}`);

  console.log("\n--- Durchlauf 2: Synthetische Daten (+/- 1% Noise auf SPY) ---");
  // Wir injizieren Rauschen
  const noisyData = originalData.map(d => {
      const cloned = JSON.parse(JSON.stringify(d));
      if (cloned.assets && cloned.assets.SPY) {
          // Zufälliges Rauschen zwischen -1% und +1%
          const noise = 1 + ((Math.random() * 0.02) - 0.01);
          cloned.assets.SPY = cloned.assets.SPY * noise;
      }
      return cloned;
  });

  console.log("Scanne verrauschte Daten...");
  const noisyCriticals = countCriticalSignals(noisyData);
  console.log(`Gefundene CRITICAL Signale im verrauschten Chart: ${noisyCriticals}`);

  console.log("\n--- Fazit ---");
  if (origCriticals === 0) {
      console.log("Keine Signale gefunden (möglicherweise DB noch leer?).");
      return;
  }
  
  const degradation = Math.abs(origCriticals - noisyCriticals) / origCriticals;
  if (degradation < 0.2) {
      console.log(`Die Degradation liegt bei nur ${(degradation*100).toFixed(1)}%. Das System ist extrem ROBUST.`);
  } else if (degradation < 0.5) {
      console.log(`Die Degradation liegt bei ${(degradation*100).toFixed(1)}%. Proportionale Degradation - System ist akzeptabel robust.`);
  } else {
      console.log(`Die Degradation liegt bei ${(degradation*100).toFixed(1)}%. Das System ist extrem fragil und überoptimiert (Overfitting)!`);
  }
}

runNoiseTest().catch(console.error);
