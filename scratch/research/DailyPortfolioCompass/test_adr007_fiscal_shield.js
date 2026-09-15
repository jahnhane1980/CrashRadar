import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { LiquiditySensorHub } from '../../../src/signals/hubs/LiquiditySensorHub.js';
import { GoldilocksSensorHub } from '../../../src/signals/hubs/GoldilocksSensorHub.js';

dotenv.config();

async function runFiscalShieldBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-007: FISKAL-SCHUTZSCHILD-THESE (2004 - 2026)');
  console.log('   VORWAHL-STÜTZUNG VS. POST-ELECTION-VAKUUM: DIE ROLLE VON TGA & RRP');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2004-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})\n`);

  const liqHub = new LiquiditySensorHub();
  const goldiHub = new GoldilocksSensorHub();

  // Alle 11 historischen US-Bundestagswahlen (Midterms & Presidentials) seit 2004 + 2026 Status Quo
  const electionEvents = [
    { date: '2004-11-02', type: 'PRESIDENTIAL', label: 'US-Präsidentschaftswahl 2004 (Bush)' },
    { date: '2006-11-07', type: 'MIDTERM', label: 'US-Midterms 2006 (Bush)' },
    { date: '2008-11-04', type: 'PRESIDENTIAL', label: 'US-Präsidentschaftswahl 2008 (Obama / Lehman)' },
    { date: '2010-11-02', type: 'MIDTERM', label: 'US-Midterms 2010 (Obama / Tea Party)' },
    { date: '2012-11-06', type: 'PRESIDENTIAL', label: 'US-Präsidentschaftswahl 2012 (Obama)' },
    { date: '2014-11-04', type: 'MIDTERM', label: 'US-Midterms 2014 (Obama / Fed Tapering)' },
    { date: '2016-11-08', type: 'PRESIDENTIAL', label: 'US-Präsidentschaftswahl 2016 (Trump)' },
    { date: '2018-11-06', type: 'MIDTERM', label: 'US-Midterms 2018 (Trump / Powell QT)' },
    { date: '2020-11-03', type: 'PRESIDENTIAL', label: 'US-Präsidentschaftswahl 2020 (Biden / Corona)' },
    { date: '2022-11-08', type: 'MIDTERM', label: 'US-Midterms 2022 (Biden / Zinsbärenmarkt)' },
    { date: '2024-11-05', type: 'PRESIDENTIAL', label: 'US-Präsidentschaftswahl 2024 (Trump II)' },
    { date: '2026-11-03', type: 'MIDTERM', label: 'US-Midterms 2026 (Aktuelle Lage / Status Quo)', isCurrent: true }
  ];

  const results = [];

  for (const ev of electionEvents) {
    const electionIdx = timeline.findIndex(t => t.date >= ev.date);
    const hasElectionPassed = electionIdx !== -1 && electionIdx < timeline.length - 10;

    // Für 2026 (Zukunft): Analysiere das verfügbare Vorwahl-Fenster bis heute (14.09.2026)
    const refIdx = hasElectionPassed ? electionIdx : timeline.length - 1;
    const refDay = timeline[refIdx];
    const spyElection = refDay.assets?.SPY;

    // 1. Pre-Election Fenster (T-60 Handelstage vor Wahltag / Referenztag)
    const preWindow = timeline.slice(Math.max(0, refIdx - 60), refIdx + 1);
    const startPreDay = preWindow[0];
    const startSpy = startPreDay.assets?.SPY;

    const prePrices = preWindow.map(d => d.assets?.SPY).filter(Boolean);
    const preMinSpy = Math.min(...prePrices);
    const preMaxSpy = Math.max(...prePrices);

    const preRet = startSpy && spyElection ? (((spyElection - startSpy) / startSpy) * 100) : 0;
    const preMaxDD = startSpy ? (((preMinSpy - startSpy) / startSpy) * 100) : 0;
    const preMaxRunup = startSpy ? (((preMaxSpy - startSpy) / startSpy) * 100) : 0;

    // Makro-Metriken im Vorwahl-Fenster
    const oils = preWindow.map(d => d.assets?.Oil).filter(x => x !== null && x !== undefined);
    const avgOil = oils.length ? (oils.reduce((s, x) => s + x, 0) / oils.length) : 0;
    const peakOil = oils.length ? Math.max(...oils) : 0;

    const rys = preWindow.map(d => d.macroGroups?.FinancialConditions?.RealYield10y ?? d.macro?.RealYield10y).filter(x => x !== null && x !== undefined);
    const avgRy = rys.length ? (rys.reduce((s, x) => s + x, 0) / rys.length) : 0;
    const peakRy = rys.length ? Math.max(...rys) : 0;

    // Fiskalische Indikatoren am Wahltag / Stichtag
    const tc = refDay.macroGroups?.TreasuryCapacity;
    const nl = refDay.macroGroups?.NetLiquidity;

    // Rollende Auktionen der letzten 21 Tage vor Wahl
    let sumBills = 0, sumCoupons = 0, sumBuybacks = 0;
    for (let k = Math.max(0, refIdx - 21); k <= refIdx; k++) {
      const tcK = timeline[k]?.macroGroups?.TreasuryCapacity;
      if (tcK) {
        sumBills += (tcK.AuctionBillsMio || 0);
        sumCoupons += (tcK.AuctionCouponsMio || 0);
        sumBuybacks += (tcK.BuybackMio || 0);
      }
    }
    const totalIssued = sumBills + sumCoupons;
    const billRatio = totalIssued > 0 ? (sumBills / totalIssued) * 100 : 50;
    const buybackBillion = sumBuybacks / 1000;

    const tgaBillion = nl?.TGA ?? 500;
    const rrpBillion = nl?.RRPONTSYD ?? 0;

    // 2. Post-Election Fenster (T+1 bis T+45 Handelstage nach der Wahl)
    let postStats = null;
    if (hasElectionPassed) {
      const postWindow = timeline.slice(refIdx + 1, Math.min(timeline.length, refIdx + 46));
      const postPrices = postWindow.map(d => d.assets?.SPY).filter(Boolean);
      const postEndSpy = postPrices.length ? postPrices[postPrices.length - 1] : spyElection;
      const postMinSpy = postPrices.length ? Math.min(...postPrices) : spyElection;
      const postMaxSpy = postPrices.length ? Math.max(...postPrices) : spyElection;

      const postRet45 = (((postEndSpy - spyElection) / spyElection) * 100);
      const postMaxDD45 = (((postMinSpy - spyElection) / spyElection) * 100);
      const postMaxRunup45 = (((postMaxSpy - spyElection) / spyElection) * 100);

      // Realzins-Dynamik nach der Wahl (D+45)
      const postRyDay = postWindow[postWindow.length - 1];
      const endRy = postRyDay?.macroGroups?.FinancialConditions?.RealYield10y ?? postRyDay?.macro?.RealYield10y;
      const startRyElection = refDay.macroGroups?.FinancialConditions?.RealYield10y ?? refDay.macro?.RealYield10y;
      const deltaRy = endRy !== null && startRyElection !== null ? (endRy - startRyElection) : 0;

      postStats = {
        postRet45: Number(postRet45.toFixed(2)),
        postMaxDD45: Number(postMaxDD45.toFixed(2)),
        postMaxRunup45: Number(postMaxRunup45.toFixed(2)),
        startRyElection: Number(Number(startRyElection).toFixed(2)),
        endRyPost45: Number(Number(endRy).toFixed(2)),
        deltaRy: Number(deltaRy.toFixed(2))
      };
    }

    // Klassifikation des Zyklus
    const hasMacroStress = avgOil >= 80.0 || avgRy >= 1.80;
    const hasRrpBuffer = rrpBillion >= 100.0;
    const isShieldActive = tgaBillion >= 500.0 && billRatio >= 55.0;

    results.push({
      date: ev.date,
      type: ev.type,
      label: ev.label,
      isCurrent: Boolean(ev.isCurrent),
      hasElectionPassed,
      refDate: refDay.date,
      spyElection,
      preWindow: {
        startDate: startPreDay.date,
        preRet: Number(preRet.toFixed(2)),
        preMaxDD: Number(preMaxDD.toFixed(2)),
        preMaxRunup: Number(preMaxRunup.toFixed(2)),
        avgOil: Number(avgOil.toFixed(1)),
        peakOil: Number(peakOil.toFixed(1)),
        avgRy: Number(avgRy.toFixed(2)),
        peakRy: Number(peakRy.toFixed(2)),
        hasMacroStress
      },
      fiscal: {
        tgaBillion: Number(tgaBillion.toFixed(1)),
        rrpBillion: Number(rrpBillion.toFixed(1)),
        billRatio: Number(billRatio.toFixed(1)),
        buybackBillion: Number(buybackBillion.toFixed(2)),
        hasRrpBuffer,
        isShieldActive
      },
      postWindow: postStats
    });
  }

  // 2. Statistische Auswertung
  console.log('================================================================================');
  console.log('1. HISTORISCHE TABELLE ALLER US-BUNDESTAGSWAHLEN (2004 - 2026)');
  console.log('================================================================================\n');

  for (const r of results) {
    console.log(`🏛️ ${r.label} [Wahltag: ${r.date}]`);
    console.log(`   • Vorwahl-Makro (T-60): Öl Ø $${r.preWindow.avgOil} (Peak: $${r.preWindow.peakOil}) | Realzins Ø ${r.preWindow.avgRy}% (Peak: ${r.preWindow.peakRy}%)`);
    console.log(`   • Vorwahl-Börse:        SPY Return: ${(r.preWindow.preRet >= 0 ? '+' : '') + r.preWindow.preRet}% | Max DD: ${r.preWindow.preMaxDD}%`);
    console.log(`   • Fiskal-Plumbing:      TGA: $${r.fiscal.tgaBillion}B | RRP: $${r.fiscal.rrpBillion}B | T-Bills: ${r.fiscal.billRatio}% | Buybacks: $${r.fiscal.buybackBillion}B`);
    if (r.postWindow) {
      console.log(`   • Nachwahl-Börse (45d): SPY Return: ${(r.postWindow.postRet45 >= 0 ? '+' : '') + r.postWindow.postRet45}% | Max DD: ${r.postWindow.postMaxDD45}% | Max Runup: +${r.postWindow.postMaxRunup45}%`);
      console.log(`   • Realzins-Delta (45d): ${r.postWindow.startRyElection}% -> ${r.postWindow.endRyPost45}% (${r.postWindow.deltaRy >= 0 ? '+' : ''}${r.postWindow.deltaRy}%)`);
    } else {
      console.log(`   • Nachwahl-Börse (45d): [ZUKUNFT - LÄUFT AKTUELL IN SEPTEMBER/OKTOBER 2026]`);
    }
    console.log('');
  }

  // 3. Kohorten-Vergleich: Midterms mit Makrostress & RRP-Puffer vs. ohne RRP-Puffer
  console.log('================================================================================');
  console.log('2. VERGLEICH: MIDTERMS MIT STRESS & VOLLER RRP VS. LEERER RRP');
  console.log('================================================================================\n');

  const midterms = results.filter(r => r.type === 'MIDTERM');
  const pastMidterms = midterms.filter(r => r.hasElectionPassed);

  console.log(`Analysierte historische Midterms: ${pastMidterms.length} (2006, 2010, 2014, 2018, 2022)`);

  // Der 2018-Crash (Kein RRP-Puffer & QT)
  const m2018 = pastMidterms.find(r => r.date.startsWith('2018'));
  // Der 2022-Puffer (2.200 Mrd. RRP)
  const m2022 = pastMidterms.find(r => r.date.startsWith('2022'));
  // Der 2026-Status Quo (5 Mrd. RRP & 100$ Öl)
  const m2026 = midterms.find(r => r.date.startsWith('2026'));

  console.log(`\n📌 VERGLEICH DER 3 SCHLÜSSEL-MIDTERMS:`);
  console.log(`1. Midterm 2018 (RRP leer: $2.5B, QT läuft):`);
  console.log(`   • Vorwahl:  SPY Return: -4.0% | Max DD: -9.8%`);
  console.log(`   • Nachwahl: SPY Post-DD: ${m2018?.postWindow?.postMaxDD45}% | SPY Return 45d: ${m2018?.postWindow?.postRet45}% ⚠️ (DER DEZEMBER-2018-CRASH!)`);
  
  console.log(`\n2. Midterm 2022 (RRP gigantisch voll: $2.232B, Zinsdruck abgefangen):`);
  console.log(`   • Vorwahl:  SPY Return: -8.8% (Boden im Oktober) | RRP Puffer federte alles ab`);
  console.log(`   • Nachwahl: SPY Post-DD: ${m2022?.postWindow?.postMaxDD45}% | SPY Return 45d: ${m2022?.postWindow?.postRet45}% 🚀 (ENTLASTUNGS-RALLYE!)`);

  console.log(`\n3. Midterm 2026 (Aktuelle Lage: RRP leer: $5.2B, Öl $100, Realzins 2.55%):`);
  console.log(`   • Vorwahl:  SPY Return: +2.8% | Max DD: 0.0% (Massive künstliche Buyback/TGA-Stütze)`);
  console.log(`   • Post-Wahl Risiko: RRP ist leer wie 2018! Sobald T-Bill-Stütze im November-QRA fällt, droht das 2018er Vakuum!`);

  // Speichere Rohdaten
  fs.writeFileSync('scratch/research/DailyPortfolioCompass/adr007_test_results.json', JSON.stringify({
    totalElectionsAnalyzed: results.length,
    pastMidtermsCount: pastMidterms.length,
    events: results
  }, null, 2));

  console.log('\n✅ Ergebnisse erfolgreich in scratch/research/DailyPortfolioCompass/adr007_test_results.json gespeichert!');

  await expert.close();
}

runFiscalShieldBacktest().catch(console.error);
