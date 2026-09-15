import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { DerivativesCycleService } from '../../../src/services/DerivativesCycleService.js';
import { DerivativesSensorHub } from '../../../src/signals/hubs/DerivativesSensorHub.js';

dotenv.config();

async function runLcdBacktest() {
  console.log('================================================================================');
  console.log('   KLEINSTER GEMEINSAMER NENNER (LCD) BACKTEST: 2020 - 2026');
  console.log('   ALLE 5 SENSOREN (SPY, VIX, SKEW, TOTAL PCR, SHORT-VOLUMEN) VOLLSTÄNDIG AKTIV');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  // Lade ab 2019-01-01 damit der SMA 200 für Anfang 2020 berechnet werden kann
  const timeline = await fe.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (Von ${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})\n`);

  // Ermittle den kleinsten gemeinsamen Nenner ab 2019
  let firstSpy = null, firstVix = null, firstSkew = null, firstPcr = null, firstShort = null;
  let firstLcdDate = null;
  let lastLcdDate = null;

  for (const day of timeline) {
    const hasSpy = day.assets?.SPY != null;
    const hasVix = (day.assets?.VIX != null) || (day.macro?.VIX != null);
    const hasSkew = day.assets?.SKEW != null;
    const hasPcr = day.assets?.TotalPCR != null;
    const hasShort = day.assets?.SPY_ShortVolumeRatio != null;

    if (hasSpy && !firstSpy) firstSpy = day.date;
    if (hasVix && !firstVix) firstVix = day.date;
    if (hasSkew && !firstSkew) firstSkew = day.date;
    if (hasPcr && !firstPcr) firstPcr = day.date;
    if (hasShort && !firstShort) firstShort = day.date;

    if (hasSpy && hasVix && hasSkew && hasPcr && hasShort) {
      if (!firstLcdDate) firstLcdDate = day.date;
      lastLcdDate = day.date;
    }
  }

  console.log(`Daten-Verfügbarkeit in der DB:`);
  console.log(`  - SPY:                  ab ${firstSpy}`);
  console.log(`  - VIX:                  ab ${firstVix}`);
  console.log(`  - SKEW:                 ab ${firstSkew}`);
  console.log(`  - TotalPCR:             ab ${firstPcr}`);
  console.log(`  - SPY_ShortVolumeRatio: ab ${firstShort}`);
  console.log(`\n=> KLEINSTER GEMEINSAMER NENNER (LCD): ${firstLcdDate} bis ${lastLcdDate}`);

  // Generiere alle OpEx-Termine in diesem Zeitfenster
  const opexEvents = [];
  const startYear = parseInt(firstLcdDate.split('-')[0], 10);
  const endYear = parseInt(lastLcdDate.split('-')[0], 10);

  for (let y = startYear; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      if (y === 2026 && m > 8) break;
      const thirdFriday = DerivativesCycleService.getThirdFriday(y, m);
      const dStr = thirdFriday.toISOString().split('T')[0];
      if (dStr >= firstLcdDate && dStr <= lastLcdDate) {
        opexEvents.push({
          date: dStr,
          year: y,
          month: m + 1,
          isQuad: DerivativesCycleService.isQuadrupleWitching(m)
        });
      }
    }
  }

  console.log(`Gefundene OpEx-Events im LCD-Zeitfenster: ${opexEvents.length} (davon ${opexEvents.filter(e => e.isQuad).length} Hexensabbat-Events)\n`);

  const hub = new DerivativesSensorHub();
  const evaluationResults = [];

  for (const event of opexEvents) {
    const opexIdx = timeline.findIndex(t => t.date >= event.date);
    if (opexIdx === -1 || opexIdx < 5 || opexIdx + 40 >= timeline.length) continue;

    const opexDay = timeline[opexIdx];
    const pre5Day = timeline[opexIdx - 5];
    const post5Day = timeline[opexIdx + 5];
    const post20Day = timeline[opexIdx + 20];
    const post40Day = timeline[opexIdx + 40];

    const spyOpex = opexDay.assets?.SPY;
    const spyPre = pre5Day?.assets?.SPY;
    const spyPost5 = post5Day?.assets?.SPY;
    const spyPost20 = post20Day?.assets?.SPY;
    const spyPost40 = post40Day?.assets?.SPY;

    if (!spyOpex || !spyPre || !spyPost5 || !spyPost20) continue;

    // Prüfe Datenvollständigkeit am OpEx-Tag
    const vix = opexDay.assets?.VIX || opexDay.macro?.VIX;
    const skew = opexDay.assets?.SKEW;
    const pcr = opexDay.assets?.TotalPCR;
    const shortVol = opexDay.assets?.SPY_ShortVolumeRatio;

    // Berechne SMA 200
    let spySum200 = 0, spyCount200 = 0;
    for (let k = Math.max(0, opexIdx - 199); k <= opexIdx; k++) {
      if (timeline[k].assets?.SPY) {
        spySum200 += timeline[k].assets.SPY;
        spyCount200++;
      }
    }
    const sma200 = spyCount200 >= 100 ? (spySum200 / spyCount200) : null;
    const isAboveSma200 = sma200 ? (spyOpex >= sma200) : false;

    // Werte den DerivativesSensorHub live an diesem Tag aus
    const sliceTimeline = timeline.slice(0, opexIdx + 1);
    const hubEval = hub.evaluate(sliceTimeline);

    // Performance-Metriken
    const preReturnPct = ((spyOpex - spyPre) / spyPre) * 100;
    const post5ReturnPct = ((spyPost5 - spyOpex) / spyOpex) * 100;
    const post20ReturnPct = ((spyPost20 - spyOpex) / spyOpex) * 100;
    const post40ReturnPct = spyPost40 ? ((spyPost40 - spyOpex) / spyOpex) * 100 : null;

    // Max Drawdowns nach OpEx
    let minSpy20 = spyOpex;
    for (let j = opexIdx; j <= opexIdx + 20; j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minSpy20) minSpy20 = p;
    }
    const maxDd20 = ((minSpy20 - spyOpex) / spyOpex) * 100;

    let minSpy40 = spyOpex;
    for (let j = opexIdx; j <= Math.min(timeline.length - 1, opexIdx + 40); j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minSpy40) minSpy40 = p;
    }
    const maxDd40 = ((minSpy40 - spyOpex) / spyOpex) * 100;

    // Definition Bull Trap: Markt reboundet/stabilisiert initial (post5 > -1%), stürzt aber danach ab (maxDd20 <= -5% oder maxDd40 <= -9%)
    const isBullTrap = (post5ReturnPct > -1.0 && maxDd20 <= -5.0) || (maxDd40 <= -9.0);
    const isSuccessfulRebound = post5ReturnPct > 0 && maxDd20 > -3.5 && post20ReturnPct > 0;

    evaluationResults.push({
      date: event.date,
      year: event.year,
      month: event.month,
      isQuad: event.isQuad,
      type: event.isQuad ? 'HEXENSABBAT' : 'MONATS-OPEX',
      regime: hubEval.regime,
      preReturnPct,
      post5ReturnPct,
      post20ReturnPct,
      post40ReturnPct,
      maxDd20,
      maxDd40,
      vix,
      skew,
      pcr,
      shortVol,
      isAboveSma200,
      isBullTrap,
      isSuccessfulRebound
    });
  }

  console.log(`Auswertbare Events mit 40-Tage Forward-Fenster: ${evaluationResults.length}\n`);

  // 1. Gesamtübersicht LCD-5 (2023-2026)
  const total = evaluationResults.length;
  const bullTraps = evaluationResults.filter(e => e.isBullTrap);
  const rebounds = evaluationResults.filter(e => e.isSuccessfulRebound);
  const quads = evaluationResults.filter(e => e.isQuad);
  const quadBullTraps = quads.filter(e => e.isBullTrap);

  console.log('--------------------------------------------------------------------------------');
  console.log('1. GESAMTSTATISTIK LCD-5 (2023 - 2026, INKL. SHORT-VOLUMEN)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Analysierte OpEx-Events:            ${total}`);
  console.log(`Erfolgreiche Rebounds:              ${rebounds.length} (${((rebounds.length / total) * 100).toFixed(1)} %)`);
  console.log(`Bull Traps (Absturz > 5-9%):        ${bullTraps.length} (${((bullTraps.length / total) * 100).toFixed(1)} %)`);
  console.log(`Quadruple Witching Events:          ${quads.length}`);
  console.log(`Quadruple Witching Bull Traps:      ${quadBullTraps.length} (${((quadBullTraps.length / quads.length) * 100).toFixed(1)} %)\n`);

  // 2. Tabelle aller Bull Traps
  console.log('--------------------------------------------------------------------------------');
  console.log('2. ALLE AUFGETRETENEN BULL TRAPS (2023 - 2026)');
  console.log('--------------------------------------------------------------------------------');
  const trapTable = bullTraps.map(t => ({
    Datum: t.date,
    Typ: t.type,
    Regime: t.regime,
    'Post 5d': `${t.post5ReturnPct > 0 ? '+' : ''}${t.post5ReturnPct.toFixed(2)}%`,
    'Max DD 20d': `${t.maxDd20.toFixed(2)}%`,
    'Max DD 40d': `${t.maxDd40.toFixed(2)}%`,
    VIX: t.vix != null ? Number(t.vix).toFixed(1) : 'N/A',
    SKEW: t.skew != null ? Number(t.skew).toFixed(1) : 'N/A',
    PCR: t.pcr != null ? Number(t.pcr).toFixed(2) : 'N/A',
    'ShortVol %': t.shortVol != null ? `${(Number(t.shortVol) * 100).toFixed(1)}%` : 'N/A',
    'SMA 200': t.isAboveSma200 ? 'DRÜBER' : 'DRUNTER'
  }));
  console.table(trapTable);

  // 3. Aufschlüsselung nach Sensor-Kriterien
  console.log('\n--------------------------------------------------------------------------------');
  console.log('3. SENSOR-DIAGNOSE IM LCD-5-FENSTER (2023 - 2026)');
  console.log('--------------------------------------------------------------------------------');

  const aboveSma = evaluationResults.filter(e => e.isAboveSma200);
  const belowSma = evaluationResults.filter(e => !e.isAboveSma200);
  console.log(`• SMA 200 FILTER:`);
  console.log(`  - Wenn SPY > SMA 200: ${aboveSma.filter(e => e.isBullTrap).length} / ${aboveSma.length} Bull Traps (${((aboveSma.filter(e => e.isBullTrap).length / aboveSma.length) * 100).toFixed(1)} %)`);
  console.log(`  - Wenn SPY < SMA 200: ${belowSma.filter(e => e.isBullTrap).length} / ${belowSma.length} Bull Traps (${((belowSma.filter(e => e.isBullTrap).length / belowSma.length) * 100).toFixed(1)} %)\n`);

  const highShort = evaluationResults.filter(e => e.shortVol != null && Number(e.shortVol) >= 0.50);
  const lowShort = evaluationResults.filter(e => e.shortVol != null && Number(e.shortVol) < 0.50);
  console.log(`• FINRA SHORT VOLUME FILTER (Schwelle: 50%):`);
  console.log(`  - ShortVol >= 50% (Hohe Leerverkäufe / Coiling): ${highShort.filter(e => e.isBullTrap).length} / ${highShort.length} Bull Traps (${((highShort.filter(e => e.isBullTrap).length / highShort.length) * 100).toFixed(1)} %)`);
  console.log(`  - ShortVol < 50% (Wenig Leerverkäufe):           ${lowShort.filter(e => e.isBullTrap).length} / ${lowShort.length} Bull Traps (${((lowShort.filter(e => e.isBullTrap).length / lowShort.length) * 100).toFixed(1)} %)\n`);

  const highPcr = evaluationResults.filter(e => e.pcr != null && Number(e.pcr) >= 1.0);
  const lowPcr = evaluationResults.filter(e => e.pcr != null && Number(e.pcr) < 1.0);
  console.log(`• TOTAL PUT/CALL RATIO (Schwelle: 1.0):`);
  console.log(`  - PCR >= 1.0 (Bärische Absicherung / Puts dominieren): ${highPcr.filter(e => e.isBullTrap).length} / ${highPcr.length} Bull Traps (${((highPcr.filter(e => e.isBullTrap).length / highPcr.length) * 100).toFixed(1)} %)`);
  console.log(`  - PCR < 1.0 (Call-Euphorie / Keine Absicherung):       ${lowPcr.filter(e => e.isBullTrap).length} / ${lowPcr.length} Bull Traps (${((lowPcr.filter(e => e.isBullTrap).length / lowPcr.length) * 100).toFixed(1)} %)\n`);

  // 4. JETZT DER 4-SENSOREN LCD (2020 - 2026: INKL. CORONA & 2022 BÄRENMARKT)
  console.log('================================================================================');
  console.log('4. ERWEITERTER LCD-4: 2020 - 2026 (SPY, VIX, SKEW, TOTAL PCR - OHNE SHORTVOL)');
  console.log('   UMFASST CORONA-CRASH 2020 & DEN GESAMTEN 2022ER BÄRENMARKT!');
  console.log('================================================================================\n');

  const opex2020Events = [];
  for (let y = 2020; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      if (y === 2026 && m > 8) break;
      const thirdFriday = DerivativesCycleService.getThirdFriday(y, m);
      const dStr = thirdFriday.toISOString().split('T')[0];
      opex2020Events.push({
        date: dStr,
        year: y,
        month: m + 1,
        isQuad: DerivativesCycleService.isQuadrupleWitching(m)
      });
    }
  }

  const results2020 = [];
  for (const event of opex2020Events) {
    const opexIdx = timeline.findIndex(t => t.date >= event.date);
    if (opexIdx === -1 || opexIdx < 5 || opexIdx + 40 >= timeline.length) continue;

    const opexDay = timeline[opexIdx];
    const pre5Day = timeline[opexIdx - 5];
    const post5Day = timeline[opexIdx + 5];
    const post20Day = timeline[opexIdx + 20];
    const post40Day = timeline[opexIdx + 40];

    const spyOpex = opexDay.assets?.SPY;
    const spyPre = pre5Day?.assets?.SPY;
    const spyPost5 = post5Day?.assets?.SPY;
    const spyPost20 = post20Day?.assets?.SPY;
    const spyPost40 = post40Day?.assets?.SPY;

    if (!spyOpex || !spyPre || !spyPost5 || !spyPost20) continue;

    const vix = opexDay.assets?.VIX || opexDay.macro?.VIX;
    const skew = opexDay.assets?.SKEW;
    const pcr = opexDay.assets?.TotalPCR;

    let spySum200 = 0, spyCount200 = 0;
    for (let k = Math.max(0, opexIdx - 199); k <= opexIdx; k++) {
      if (timeline[k].assets?.SPY) {
        spySum200 += timeline[k].assets.SPY;
        spyCount200++;
      }
    }
    const sma200 = spyCount200 >= 100 ? (spySum200 / spyCount200) : null;
    const isAboveSma200 = sma200 ? (spyOpex >= sma200) : false;

    const post5ReturnPct = ((spyPost5 - spyOpex) / spyOpex) * 100;
    const post20ReturnPct = ((spyPost20 - spyOpex) / spyOpex) * 100;

    let minSpy20 = spyOpex;
    for (let j = opexIdx; j <= opexIdx + 20; j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minSpy20) minSpy20 = p;
    }
    const maxDd20 = ((minSpy20 - spyOpex) / spyOpex) * 100;

    let minSpy40 = spyOpex;
    for (let j = opexIdx; j <= Math.min(timeline.length - 1, opexIdx + 40); j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minSpy40) minSpy40 = p;
    }
    const maxDd40 = ((minSpy40 - spyOpex) / spyOpex) * 100;

    const isBullTrap = (post5ReturnPct > -1.0 && maxDd20 <= -5.0) || (maxDd40 <= -9.0);
    const isSuccessfulRebound = post5ReturnPct > 0 && maxDd20 > -3.5 && post20ReturnPct > 0;

    results2020.push({
      date: event.date,
      type: event.isQuad ? 'HEXENSABBAT' : 'MONATS-OPEX',
      post5ReturnPct,
      maxDd20,
      maxDd40,
      vix,
      skew,
      pcr,
      isAboveSma200,
      isBullTrap,
      isSuccessfulRebound
    });
  }

  const traps2020 = results2020.filter(e => e.isBullTrap);
  console.log(`Gesamt-Events (2020-2026):          ${results2020.length}`);
  console.log(`Erfolgreiche Rebounds:              ${results2020.filter(e => e.isSuccessfulRebound).length} (${((results2020.filter(e => e.isSuccessfulRebound).length / results2020.length) * 100).toFixed(1)} %)`);
  console.log(`Bull Traps:                         ${traps2020.length} (${((traps2020.length / results2020.length) * 100).toFixed(1)} %)\n`);

  const traps2020Table = traps2020.map(t => ({
    Datum: t.date,
    Typ: t.type,
    'Post 5d': `${t.post5ReturnPct > 0 ? '+' : ''}${t.post5ReturnPct.toFixed(2)}%`,
    'Max DD 20d': `${t.maxDd20.toFixed(2)}%`,
    'Max DD 40d': `${t.maxDd40.toFixed(2)}%`,
    VIX: t.vix != null ? Number(t.vix).toFixed(1) : 'N/A',
    SKEW: t.skew != null ? Number(t.skew).toFixed(1) : 'N/A',
    PCR: t.pcr != null ? Number(t.pcr).toFixed(2) : 'N/A',
    'SMA 200': t.isAboveSma200 ? 'DRÜBER' : 'DRUNTER'
  }));
  console.table(traps2020Table);

  const above2020 = results2020.filter(e => e.isAboveSma200);
  const below2020 = results2020.filter(e => !e.isAboveSma200);
  console.log(`\n• SMA 200 FILTER (2020 - 2026):`);
  console.log(`  - Wenn SPY > SMA 200: ${above2020.filter(e => e.isBullTrap).length} / ${above2020.length} Bull Traps (${((above2020.filter(e => e.isBullTrap).length / above2020.length) * 100).toFixed(1)} %)`);
  console.log(`  - Wenn SPY < SMA 200: ${below2020.filter(e => e.isBullTrap).length} / ${below2020.length} Bull Traps (${((below2020.filter(e => e.isBullTrap).length / below2020.length) * 100).toFixed(1)} %)`);

  const highPcr2020 = results2020.filter(e => e.pcr != null && Number(e.pcr) >= 1.0);
  const lowPcr2020 = results2020.filter(e => e.pcr != null && Number(e.pcr) < 1.0);
  console.log(`\n• TOTAL PUT/CALL RATIO FILTER (2020 - 2026):`);
  console.log(`  - Wenn PCR >= 1.0 (Absicherung aktiv): ${highPcr2020.filter(e => e.isBullTrap).length} / ${highPcr2020.length} Bull Traps (${((highPcr2020.filter(e => e.isBullTrap).length / highPcr2020.length) * 100).toFixed(1)} %)`);
  console.log(`  - Wenn PCR < 1.0 (Euphorie / Keine Hedges): ${lowPcr2020.filter(e => e.isBullTrap).length} / ${lowPcr2020.length} Bull Traps (${((lowPcr2020.filter(e => e.isBullTrap).length / lowPcr2020.length) * 100).toFixed(1)} %)`);
}

runLcdBacktest().catch(console.error);
