import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';

async function extractQQQCycles() {
  console.log("Lade QQQ Daten ab 1999...");
  const repo = new AnalysisRepository(process.env.DATABASE_URL);
  const data = await repo.getAllRawData('1999-01-01');
  
  const qqqData = data.tiingo
    .filter(d => d.symbol === 'QQQ' && d.close !== null && d.close !== undefined)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(d => ({
      date: d.date,
      price: d.close
    }));
  
  console.log(`Gefundene Handelstage für QQQ: ${qqqData.length}`);
  
  let cycles = [];
  let currentMax = { price: 0, date: null, index: -1 };
  let currentDrawdown = null;
  
  for (let i = 0; i < qqqData.length; i++) {
    const d = qqqData[i];
    
    // Neues Allzeithoch (oder lokales Hoch nach Recovery)
    if (d.price > currentMax.price) {
      // Wenn wir in einem Drawdown waren, ist dieser nun offiziell recovered
      if (currentDrawdown && currentDrawdown.maxDropPct <= -15) {
        currentDrawdown.recoveryDate = d.date;
        cycles.push(currentDrawdown);
      }
      currentDrawdown = null; // Reset
      currentMax = { price: d.price, date: d.date, index: i };
    } else {
      // Wir sind unter dem Max
      const dropPct = ((d.price - currentMax.price) / currentMax.price) * 100;
      
      if (!currentDrawdown) {
        currentDrawdown = {
          peakDate: currentMax.date,
          peakPrice: currentMax.price,
          peakIndex: currentMax.index,
          troughDate: d.date,
          troughPrice: d.price,
          troughIndex: i,
          maxDropPct: dropPct
        };
      } else {
        if (d.price < currentDrawdown.troughPrice) {
          currentDrawdown.troughPrice = d.price;
          currentDrawdown.troughDate = d.date;
          currentDrawdown.troughIndex = i;
        }
        if (dropPct < currentDrawdown.maxDropPct) {
          currentDrawdown.maxDropPct = dropPct;
        }
      }
    }
  }
  
  // Falls der letzte Drawdown noch aktiv ist (z.B. aktueller Markt)
  if (currentDrawdown && currentDrawdown.maxDropPct <= -15) {
      cycles.push(currentDrawdown);
  }

  console.log("\nGefundene Drawdowns (>= 15%):");
  
  const formatDate = (dateStr, offsetDays = 0) => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
  };

  const outputCycles = [];

  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i];
    console.log(`- Peak: ${c.peakDate} | Trough: ${c.troughDate} | Drop: ${c.maxDropPct.toFixed(2)}%`);
    
    // Uptrend vom letzten Trough bis zu diesem Peak
    if (i === 0) {
        // Erster Uptrend vom Start der Daten bis zum ersten Peak
        outputCycles.push({
            phase: "UPTREND",
            start: formatDate(qqqData[0].date),
            end: formatDate(c.peakDate, -15)
        });
    } else {
        outputCycles.push({
            phase: "UPTREND",
            start: formatDate(cycles[i-1].troughDate, 15),
            end: formatDate(c.peakDate, -15)
        });
    }

    // TOP Range (+/- 14 Tage um den Peak)
    outputCycles.push({
        phase: "MACRO_TOP",
        start: formatDate(c.peakDate, -14),
        end: formatDate(c.peakDate, 14)
    });

    // DOWNTREND (vom Top bis zum Bottom)
    outputCycles.push({
        phase: "DOWNTREND",
        start: formatDate(c.peakDate, 15),
        end: formatDate(c.troughDate, -15)
    });

    // BOTTOM Range (+/- 14 Tage um das Trough)
    outputCycles.push({
        phase: "MACRO_BOTTOM",
        start: formatDate(c.troughDate, -14),
        end: formatDate(c.troughDate, 14)
    });
  }
  
  // Uptrend vom letzten Bottom bis "heute" (falls recovered)
  if (cycles.length > 0) {
      const last = cycles[cycles.length - 1];
      if (last.recoveryDate) {
          outputCycles.push({
              phase: "UPTREND",
              start: formatDate(last.troughDate, 15),
              end: formatDate(qqqData[qqqData.length - 1].date)
          });
      } else {
          // Noch im Downtrend, wir hängen nichts mehr an, 
          // MACRO_BOTTOM und DOWNTREND wurden schon eingefügt.
          // Wait, wenn wir noch nicht recovered sind, könnte das Bottom noch gar keins sein.
          // Aber wir nehmen das aktuelle Trough als Bottom.
      }
  }

  console.log("\n[Vorschlag] Generiertes CYCLES_QQQ Array für die JSON:");
  console.log(JSON.stringify(outputCycles, null, 2));
  
  process.exit(0);
}

extractQQQCycles().catch(console.error);
