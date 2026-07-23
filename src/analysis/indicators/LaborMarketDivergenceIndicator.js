class LaborMarketDivergenceIndicator {
  constructor() {
    this.name = 'LaborMarketDivergenceIndicator';
    this.LEADING_THRESHOLD = -0.025; // -2.5% drop from 12m high
  }

  _parseFredValue(val) {
    if (val === undefined || val === null || val === '.' || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  evaluate(timeline) {
    const defaultResponse = {
      indicator: this.name,
      status: "NEUTRAL",
      signals: [
        {
          type: "EARLY_WARNING",
          name: "Qualitative Arbeitsmarkt-Schere (Vollzeit vs. Teilzeit)",
          timeframe: "Frühindikator (6 - 18 Monate Vorlauf)",
          triggered: false,
          description: "Unternehmen wandeln signifikant Vollzeit- in Teilzeitstellen um. Die Qualität des Jobmarkts implodiert, während die Gesamt-Jobzahl noch stabil wirkt.",
          metrics: { ratioDrop: 0, fullTime: 0, partTime: 0 }
        },
        {
          type: "ACUTE_PANIC",
          name: "Quantitative Arbeitsmarkt-Schere (Household vs. Payrolls)",
          timeframe: "Akutindikator (0 - 3 Monate Vorlauf)",
          triggered: false,
          description: "Die offizielle Headline-Jobzahl (PAYEMS) steigt künstlich, während das reale Beschäftigungsniveau (CE16OV) bereits sinkt. Eine Rezession steht unmittelbar bevor.",
          metrics: { payemsDelta3M: 0, ce16ovDelta3M: 0, multJobDelta3M: 0 }
        }
      ]
    };

    if (!Array.isArray(timeline) || timeline.length === 0) return defaultResponse;

    const PAYEMS = [];
    const CE16OV = [];
    const LNS12500000 = [];
    const LNS12600000 = [];
    const LNS12026619 = [];

    // Brücke bauen: Extrahieren der Daten aus dem timeline Array
    for (const day of timeline) {
      if (!day || !day.date) continue;
      const labor = day.macroGroups?.LaborMarket;
      if (labor) {
        if (labor.PAYEMS !== undefined) PAYEMS.push({ date: day.date, value: labor.PAYEMS });
        if (labor.CE16OV !== undefined) CE16OV.push({ date: day.date, value: labor.CE16OV });
        if (labor.LNS12500000 !== undefined) LNS12500000.push({ date: day.date, value: labor.LNS12500000 });
        if (labor.LNS12600000 !== undefined) LNS12600000.push({ date: day.date, value: labor.LNS12600000 });
        if (labor.LNS12026619 !== undefined) LNS12026619.push({ date: day.date, value: labor.LNS12026619 });
      }
    }

    if (PAYEMS.length === 0 || CE16OV.length === 0 || LNS12500000.length === 0 || LNS12600000.length === 0 || LNS12026619.length === 0) {
      return defaultResponse;
    }

    // 1. Sicheres Datum-basiertes Alignment
    const buildMap = (arr) => {
      const map = new Map();
      if (!Array.isArray(arr)) return map;
      for (const item of arr) {
        if (item && item.date) {
          map.set(item.date, this._parseFredValue(item.value));
        }
      }
      return map;
    };

    const payMap = buildMap(PAYEMS);
    const ceMap = buildMap(CE16OV);
    const ftMap = buildMap(LNS12500000);
    const ptMap = buildMap(LNS12600000);
    const mjMap = buildMap(LNS12026619);

    // Finde alle gemeinsamen Daten
    const allDates = [...payMap.keys()].filter(d => 
      ceMap.has(d) && ftMap.has(d) && ptMap.has(d) && mjMap.has(d)
    ).sort((a, b) => new Date(a) - new Date(b));

    // Wir brauchen mindestens 13 Datenpunkte für den 12-Monats-Rückblick + aktuellen Monat
    if (allDates.length < 13) {
      return defaultResponse;
    }

    const currentDate = allDates[allDates.length - 1];
    const t3Date = allDates[allDates.length - 4]; // t-3

    if (!currentDate || !t3Date) return defaultResponse;

    // --- 1. Qualitative Schere (Frühindikator) ---
    const ratios = [];
    // Nimm die letzten 13 gemeinsamen Datenpunkte
    const lookbackDates = allDates.slice(-13); 
    
    for (const d of lookbackDates) {
      const ft = ftMap.get(d);
      const pt = ptMap.get(d);
      if (pt === null || ft === null || pt === 0) {
        ratios.push(0);
      } else {
        ratios.push(ft / pt);
      }
    }

    const currentRatio = ratios[ratios.length - 1];
    const previous12Ratios = ratios.slice(0, 12);
    const max12mRatio = Math.max(...previous12Ratios);

    let isLeadingSignal = false;
    let qualityDropPct = 0;

    if (max12mRatio > 0 && currentRatio > 0) {
      qualityDropPct = (currentRatio - max12mRatio) / max12mRatio;
      if (qualityDropPct <= this.LEADING_THRESHOLD) {
        isLeadingSignal = true;
      }
    }

    defaultResponse.signals[0].triggered = isLeadingSignal;
    defaultResponse.signals[0].metrics = {
      ratioDrop: qualityDropPct,
      fullTime: ftMap.get(currentDate) || 0,
      partTime: ptMap.get(currentDate) || 0
    };

    // --- 2. Quantitative Schere (Akutindikator) ---
    const payemsT = payMap.get(currentDate);
    const payemsT3 = payMap.get(t3Date);
    
    const ce16ovT = ceMap.get(currentDate);
    const ce16ovT3 = ceMap.get(t3Date);
    
    const multjobT = mjMap.get(currentDate);
    const multjobT3 = mjMap.get(t3Date);

    let isCoincidentSignal = false;
    let payemsDelta = 0;
    let ce16ovDelta = 0;
    let multJobDelta = 0;

    if (payemsT !== null && payemsT3 !== null && ce16ovT !== null && ce16ovT3 !== null) {
      payemsDelta = payemsT - payemsT3;
      ce16ovDelta = ce16ovT - ce16ovT3;
      if (payemsDelta > 0 && ce16ovDelta < 0) {
        isCoincidentSignal = true;
      }
    }

    if (multjobT !== null && multjobT3 !== null) {
      multJobDelta = multjobT - multjobT3;
    }

    defaultResponse.signals[1].triggered = isCoincidentSignal;
    defaultResponse.signals[1].metrics = {
      payemsDelta3M: payemsDelta,
      ce16ovDelta3M: ce16ovDelta,
      multJobDelta3M: multJobDelta
    };

    // --- Status Escalation ---
    if (isCoincidentSignal) {
      defaultResponse.status = "COINCIDENT_ALERT";
    } else if (isLeadingSignal) {
      defaultResponse.status = "LEADING_WARNING";
    }

    return defaultResponse;
  }
}

export default LaborMarketDivergenceIndicator;
