import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { MathUtils } from '../../../src/utils/MathUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runEmpiricalBottomCheck() {
  const fe = new FinanceExpert();
  console.log('Lade historische Timeline ab 2005...');
  const timeline = await fe.getDailyGroupedData('2005-01-01', { bypassMemoryGuard: true });
  await fe.close();

  // Lade GLD und GDX direkt aus market_data_tiingo für saubere ETF-Volumina
  import('mysql2/promise').then(async mysql => {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [gldRows] = await conn.query("SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close, volume FROM market_data_tiingo WHERE symbol = 'GLD' ORDER BY record_date ASC");
    const [gdxRows] = await conn.query("SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close, volume FROM market_data_tiingo WHERE symbol = 'GDX' ORDER BY record_date ASC");
    await conn.end();

    const gldMap = new Map(gldRows.map(r => [r.date, r]));
    const gdxMap = new Map(gdxRows.map(r => [r.date, r]));

    timeline.forEach(d => {
      const g = gldMap.get(d.date);
      if (g) {
        d.assets.GLD = g.close;
        d.assets.GLD_Volume = g.volume;
      }
      const gx = gdxMap.get(d.date);
      if (gx) {
        d.assets.GDX = gx.close;
        d.assets.GDX_Volume = gx.volume;
      }
    });
    
    continueEmpiricalAnalysis(timeline);
  });
}

function continueEmpiricalAnalysis(timeline) {

  // Prüfe Datenverfügbarkeit der einzelnen Serien
  const firstDates = {};
  ['SPY', 'VIX', 'CBOE_SPY', 'DIX', 'AAII_Spread', 'GLD', 'GLD_Volume', 'GDX', 'GDX_Volume', 'TotalPCR'].forEach(asset => {
    const firstDay = timeline.find(t => t.assets?.[asset] !== null && t.assets?.[asset] !== undefined && !isNaN(Number(t.assets[asset])));
    firstDates[asset] = firstDay ? firstDay.date : 'NICHT VORHANDEN';
  });

  console.log('--- DATENVERFÜGBARKEIT DER INDIKATOREN ---');
  console.table(firstDates);

  // Relevante Korrekturen >= 15%
  const corrections = [
    { name: '2008 Lehman / GFC', peakDate: '2007-10-09', troughDate: '2009-03-09' },
    { name: '2011 US Downgrade / Euro-Krise', peakDate: '2011-04-29', troughDate: '2011-10-03' },
    { name: '2015/16 China / Energy Crash', peakDate: '2015-05-21', troughDate: '2016-02-11' },
    { name: '2018 Q4 Zins-Crash (-20%)', peakDate: '2018-09-20', troughDate: '2018-12-24' },
    { name: '2020 Corona Flash-Crash (-34%)', peakDate: '2020-02-19', troughDate: '2020-03-23' },
    { name: '2022 Fed Bärenmarkt (-27%)', peakDate: '2022-01-04', troughDate: '2022-10-12' },
    { name: '2024 Sommer Tech-Dip / Carry', peakDate: '2024-07-16', troughDate: '2024-08-05' },
    { name: '2025 April Tax-Day Crash', peakDate: '2025-02-19', troughDate: '2025-04-08' }
  ];

  // Vorberechnung rollierender Durchschnitte
  // 1. CBOE 90d SMA Volume
  // 2. GLD 50d SMA Volume
  // 3. GDX 50d SMA Volume
  // 4. VIX 30d Max
  const enriched = timeline.map((d, idx) => {
    const cboe = d.assets?.CBOE_SPY != null ? Number(d.assets.CBOE_SPY) : null;
    const gldVol = d.assets?.GLD_Volume != null ? Number(d.assets.GLD_Volume) : null;
    const gdxVol = d.assets?.GDX_Volume != null ? Number(d.assets.GDX_Volume) : null;
    const vix = d.assets?.VIX != null ? Number(d.assets.VIX) : null;
    let dix = d.assets?.DIX != null ? Number(d.assets.DIX) : null;
    if (dix != null && dix > 0 && dix <= 1) dix = dix * 100;
    const aaii = d.assets?.AAII_Spread != null ? Number(d.assets.AAII_Spread) : null;

    // CBOE SMA 90
    let cboeRatio = null;
    if (idx >= 89 && cboe != null) {
      let sum = 0, count = 0;
      for (let j = idx - 89; j <= idx; j++) {
        const val = timeline[j].assets?.CBOE_SPY;
        if (val != null && !isNaN(Number(val))) { sum += Number(val); count++; }
      }
      if (count > 0) {
        const avg = sum / count;
        cboeRatio = avg > 0 ? cboe / avg : null;
      }
    }

    // GLD Vol SMA 50
    let gldVolRatio = null;
    if (idx >= 49 && gldVol != null) {
      let sum = 0, count = 0;
      for (let j = idx - 49; j <= idx; j++) {
        const val = timeline[j].assets?.GLD_Volume;
        if (val != null && !isNaN(Number(val))) { sum += Number(val); count++; }
      }
      if (count > 0) {
        const avg = sum / count;
        gldVolRatio = avg > 0 ? gldVol / avg : null;
      }
    }

    // GDX Vol SMA 50
    let gdxVolRatio = null;
    if (idx >= 49 && gdxVol != null) {
      let sum = 0, count = 0;
      for (let j = idx - 49; j <= idx; j++) {
        const val = timeline[j].assets?.GDX_Volume;
        if (val != null && !isNaN(Number(val))) { sum += Number(val); count++; }
      }
      if (count > 0) {
        const avg = sum / count;
        gdxVolRatio = avg > 0 ? gdxVol / avg : null;
      }
    }

    // VIX 30d Max
    let maxVix30 = 0;
    if (idx >= 29) {
      for (let j = idx - 29; j <= idx; j++) {
        const v = timeline[j].assets?.VIX;
        if (v != null && !isNaN(Number(v)) && Number(v) > maxVix30) maxVix30 = Number(v);
      }
    }
    const isVixCrush = maxVix30 >= 40 && vix != null && vix < maxVix30 * 0.8;

    return {
      date: d.date,
      spy: Number(d.assets?.SPY),
      vix,
      maxVix30,
      isVixCrush,
      cboe,
      cboeRatio,
      dix,
      aaii,
      isSmartDumbCrit: vix != null && vix > 40 && aaii != null && aaii < -25 && dix != null && dix > 45,
      gldVol,
      gldVolRatio,
      gdxVol,
      gdxVolRatio
    };
  });

  console.log('========================================================================================');
  console.log('EMPIRISCHE ANALYSE: TRIGGER-VERHALTEN IN ALLEN KORREKTUREN >= 15%');
  console.log('========================================================================================\n');

  for (const c of corrections) {
    const peakIdx = enriched.findIndex(d => d.date >= c.peakDate);
    const troughIdx = enriched.findIndex(d => d.date >= c.troughDate);
    if (peakIdx === -1 || troughIdx === -1) continue;

    const peakSpy = enriched[peakIdx].spy;
    const troughSpy = enriched[troughIdx].spy;
    const maxDd = ((troughSpy - peakSpy) / peakSpy) * 100;

    // Untersuche das Fenster von Peak bis Trough + 20 Tage danach
    const postWindowEnd = Math.min(enriched.length - 1, troughIdx + 20);
    const windowSlice = enriched.slice(peakIdx, postWindowEnd + 1);

    // Finde Triggers
    const cboeSpikes = windowSlice.filter(d => d.cboeRatio != null && d.cboeRatio >= 1.5 && d.vix >= 35);
    const dixWhales = windowSlice.filter(d => d.dix != null && d.dix > 45);
    const smartDumbCrits = windowSlice.filter(d => d.isSmartDumbCrit);
    const gldVolSpikes = windowSlice.filter(d => d.gldVolRatio != null && d.gldVolRatio >= 2.0);
    const gdxVolSpikes = windowSlice.filter(d => d.gdxVolRatio != null && d.gdxVolRatio >= 2.0);
    const vixCrushDays = windowSlice.filter(d => d.isVixCrush);

    console.log(`📌 KRISE: ${c.name}`);
    console.log(`   Peak: ${c.peakDate} ($${peakSpy.toFixed(2)}) ➔ Trough: ${c.troughDate} ($${troughSpy.toFixed(2)}) | Max DD: ${maxDd.toFixed(1)}%`);
    
    // 1. DIX / Smart Dumb
    if (smartDumbCrits.length > 0) {
      console.log(`   🟢 SmartDumbBottom (VIX>40 & AAII<-25 & DIX>45): TRIGGERED an ${smartDumbCrits.length} Tagen! Erstes Signal: ${smartDumbCrits[0].date} (VIX: ${smartDumbCrits[0].vix}, DIX: ${smartDumbCrits[0].dix.toFixed(1)}%, AAII: ${smartDumbCrits[0].aaii.toFixed(1)}%)`);
    } else if (dixWhales.length > 0) {
      const bestDix = dixWhales.reduce((prev, cur) => cur.dix > prev.dix ? cur : prev, dixWhales[0]);
      console.log(`   🟡 DIX > 45% (Dark Pool Kauf-Druck): ${dixWhales.length} Tage über 45% (Max: ${bestDix.dix.toFixed(1)}% am ${bestDix.date}). Voll-Kombi feuerte nicht (AAII/VIX Filter).`);
    } else {
      console.log(`   ⚪ DIX / SmartDumbBottom: Keine DIX-Daten oder kein Trigger.`);
    }

    // 2. CBOE Options-Volumen
    if (cboeSpikes.length > 0) {
      console.log(`   🟢 CBOE Options-Spike (Ratio >= 1.5x & VIX >= 35): TRIGGERED an ${cboeSpikes.length} Tagen! Erstes Signal: ${cboeSpikes[0].date} (Ratio: ${cboeSpikes[0].cboeRatio.toFixed(1)}x, VIX: ${cboeSpikes[0].vix.toFixed(1)})`);
    } else {
      const maxCboeRatio = windowSlice.filter(d => d.cboeRatio != null).reduce((prev, cur) => cur.cboeRatio > prev.cboeRatio ? cur : prev, { cboeRatio: 0 });
      console.log(`   ⚪ CBOE Options-Spike: Kein Trigger (Max Ratio: ${maxCboeRatio.cboeRatio ? maxCboeRatio.cboeRatio.toFixed(2) + 'x' : 'N/A'}).`);
    }

    // 3. Gold- & Minen-Volumen
    if (gldVolSpikes.length > 0) {
      console.log(`   🟢 GLD ETF Volume Climax (>= 2.0x): TRIGGERED an ${gldVolSpikes.length} Tagen! Erstes Signal: ${gldVolSpikes[0].date} (Ratio: ${gldVolSpikes[0].gldVolRatio.toFixed(1)}x)`);
    } else {
      const maxGold = windowSlice.filter(d => d.gldVolRatio != null).reduce((prev, cur) => cur.gldVolRatio > prev.gldVolRatio ? cur : prev, { gldVolRatio: 0 });
      console.log(`   ⚪ GLD Volume: Kein Climax >= 2x (Max: ${maxGold.gldVolRatio ? maxGold.gldVolRatio.toFixed(1) + 'x' : 'N/A'}).`);
    }

    if (gdxVolSpikes.length > 0) {
      console.log(`   🟢 GDX Miner Climax (>= 2.0x): TRIGGERED an ${gdxVolSpikes.length} Tagen! Erstes Signal: ${gdxVolSpikes[0].date} (Ratio: ${gdxVolSpikes[0].gdxVolRatio.toFixed(1)}x)`);
    } else {
      const maxGdx = windowSlice.filter(d => d.gdxVolRatio != null).reduce((prev, cur) => cur.gdxVolRatio > prev.gdxVolRatio ? cur : prev, { gdxVolRatio: 0 });
      console.log(`   ⚪ GDX Volume: Kein Climax >= 2x (Max: ${maxGdx.gdxVolRatio ? maxGdx.gdxVolRatio.toFixed(1) + 'x' : 'N/A'}).`);
    }

    // 4. VIX Spike & Crush
    if (vixCrushDays.length > 0) {
      console.log(`   🟢 VIX Spike & Crush (Peak >= 40 ➔ -20% Abkühlung): TRIGGERED an ${vixCrushDays.length} Tagen! Erstes Signal: ${vixCrushDays[0].date} (VIX: ${vixCrushDays[0].vix.toFixed(1)}, Peak war: ${vixCrushDays[0].maxVix30.toFixed(1)})`);
    } else {
      const maxV = windowSlice.reduce((p, c) => (c.vix || 0) > (p.vix || 0) ? c : p, { vix: 0 });
      console.log(`   ⚪ VIX Spike & Crush: Kein Peak >= 40 erreicht (Max VIX: ${maxV.vix ? maxV.vix.toFixed(1) : 'N/A'}).`);
    }

    console.log('----------------------------------------------------------------------------------------\n');
  }
}

runEmpiricalBottomCheck().catch(console.error);
