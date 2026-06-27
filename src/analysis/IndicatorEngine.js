export class IndicatorEngine {
  constructor() {
    const THRESHOLDS = {
      TOTRESNS_CRITICAL: 2800,
      TOTRESNS_WARNING: 3000,
      MW_CRITICAL: 21,
      MW_WARNING: 15,
      TGA_DIFF: 100,
      SAHM_CRITICAL: 0.50,
      NFCI_CRITICAL: 0,
      RATE_SHOCK_CRITICAL: 0.50,
      RATE_SHOCK_WARNING: 0.30,
      HYG_CRITICAL: -3.0,
      HYG_WARNING: -1.5,
      VIX_SPIKE: 40,
      VIX_WARNING: 35,
      VIX_CRUSH_PCT: 0.8,
      VIX_CRUSH_WARNING_PCT: 0.85,
      GOLD_BREAKOUT_PCT: 1.02,
      BIZD_CRITICAL: -5.0,
      BIZD_WARNING: -2.5,
      BKLN_CRITICAL: -2.0,
      BKLN_WARNING: -1.0,
      ARCC_INTEREST_GROWTH_CRITICAL: 15.0,
      ARCC_INTEREST_GROWTH_WARNING: 5.0
    };

    this.indicators = [
      // 🟢 LEADING (Frühindikatoren)
      {
        name: 'Bankreserven (TOTRESNS)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          const current = timeline[timeline.length - 1].macroGroups.BankingHealth.TotalReserves;
          if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          if (current < THRESHOLDS.TOTRESNS_CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(0) + 'B', message: `Unter ${THRESHOLDS.TOTRESNS_CRITICAL / 1000}T Limit! Akute Crash-Warnung (Repo-Krise).` };
          } else if (current < THRESHOLDS.TOTRESNS_WARNING) {
            return { status: 'WARNING', value: current.toFixed(0) + 'B', message: `Nähert sich der ${THRESHOLDS.TOTRESNS_CRITICAL / 1000}T Grenze.` };
          }
          return { status: 'OK', value: current.toFixed(0) + 'B', message: 'Reserven im sicheren Bereich.' };
        }
      },
      {
        name: 'Maturity Wall (T-Bill Rollover)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          const current = timeline[timeline.length - 1].macroGroups.Leading.MaturityWallPct;
          if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          if (current > THRESHOLDS.MW_CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2) + '%', message: `Roter Alarm! Extreme Refinancing Cliff (>${THRESHOLDS.MW_CRITICAL}%).` };
          } else if (current > THRESHOLDS.MW_WARNING) {
            return { status: 'WARNING', value: current.toFixed(2) + '%', message: `Warn-Zone. System beginnt zu ächzen (>${THRESHOLDS.MW_WARNING}%).` };
          }
          return { status: 'OK', value: current.toFixed(2) + '%', message: 'Normale Baseline (<10-15%).' };
        }
      },
      {
        name: 'Treasury General Account (TGA)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          const currentDay = timeline[timeline.length - 1];
          const pastDay = timeline[timeline.length - 30];
          
          const currentTGA = currentDay.macroGroups.NetLiquidity.TGA;
          const pastTGA = pastDay.macroGroups.NetLiquidity.TGA;
          
          if (currentTGA === null || pastTGA === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          const diff = currentTGA - pastTGA;
          if (diff > THRESHOLDS.TGA_DIFF) {
            return { status: 'WARNING', value: currentTGA.toFixed(0) + 'B', message: `Starker Anstieg (+${diff.toFixed(0)}B in 30d). Entzieht Liquidität.` };
          } else if (diff < -THRESHOLDS.TGA_DIFF) {
            return { status: 'OK', value: currentTGA.toFixed(0) + 'B', message: `Rasanter Fall (${diff.toFixed(0)}B in 30d). Stealth-Stimulus / Kaufsignal.` };
          }
          return { status: 'OK', value: currentTGA.toFixed(0) + 'B', message: 'Neutrale Seitwärtsbewegung.' };
        }
      },
      {
        name: 'Yield Curve (T10Y2Y)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          const current = timeline[timeline.length - 1].macroGroups.YieldCurve.Spread10y2y;
          const past30 = timeline[timeline.length - 30].macroGroups.YieldCurve.Spread10y2y;
          
          if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          if (past30 < 0 && current >= 0) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: 'UN-INVERTING! Kurve ist in den letzten 30 Tagen positiv geworden. Startschuss für den Crash.' };
          } else if (current < 0) {
            return { status: 'WARNING', value: current.toFixed(2), message: 'Invertiert (Late Cycle). Noch keine Panik, bis sie un-invertiert.' };
          }
          return { status: 'OK', value: current.toFixed(2), message: 'Normale Kurve (positiv).' };
        }
      },
      {
        name: 'Sahm Rule (Rezession)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          const current = timeline[timeline.length - 1].macroGroups.Leading.SahmRule;
          if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          if (current >= THRESHOLDS.SAHM_CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: `Lupenreine Rezessionswarnung (>=${THRESHOLDS.SAHM_CRITICAL}).` };
          }
          return { status: 'OK', value: current.toFixed(2), message: 'Keine Rezession im Gange.' };
        }
      },
      {
        name: 'Margin Debt (Gier & Hebel)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 180) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 180 Tage)' };
          
          const current = timeline[timeline.length - 1].macroGroups.Leading.MarginDebt;
          if (current === null || current === undefined) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          let maxDebt = 0;
          for (let i = timeline.length - 180; i < timeline.length; i++) {
            const debt = timeline[i].macroGroups.Leading.MarginDebt;
            if (debt && debt > maxDebt) {
              maxDebt = debt;
            }
          }
          
          if (maxDebt === 0) return { status: 'UNKNOWN', message: 'Max Debt ist 0' };
          
          const drawdownPct = ((current - maxDebt) / maxDebt) * 100;
          
          if (drawdownPct <= -5.0) {
            return { status: 'WARNING', value: drawdownPct.toFixed(1) + '%', message: `Margin Debt ist um ${Math.abs(drawdownPct).toFixed(1)}% von seinem Hoch gefallen. Das Smart Money baut rasant Hebel ab!` };
          } else if (drawdownPct <= -2.0) {
            return { status: 'WARNING', value: drawdownPct.toFixed(1) + '%', message: `Margin Debt fällt (${drawdownPct.toFixed(1)}% vom Hoch). Erste Anzeichen ausgetrockneter Kreditlinien.` };
          }
          return { status: 'OK', value: current.toFixed(0) + 'M', message: 'Hebel (Margin Debt) steigt / ist intakt.' };
        }
      },
      {
        name: 'Schattenbanken Zinslast (ARCC)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 90) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 90 Tage)' };
          const currentDay = timeline[timeline.length - 1];
          const pastDay = timeline[timeline.length - 90];
          
          const currentInterest = currentDay.macroGroups.Fundamentals?.ARCC_InterestExpense;
          const pastInterest = pastDay.macroGroups.Fundamentals?.ARCC_InterestExpense;
          
          if (!currentInterest || !pastInterest) return { status: 'UNKNOWN', message: 'Keine Fundamentaldaten' };
          
          const growth = ((currentInterest - pastInterest) / pastInterest) * 100;
          if (growth >= THRESHOLDS.ARCC_INTEREST_GROWTH_CRITICAL) {
            return { status: 'CRITICAL', value: `+${growth.toFixed(1)}%`, message: `Zinslast der BDCs explodiert! (>=${THRESHOLDS.ARCC_INTEREST_GROWTH_CRITICAL}% QoQ). Kreditausfälle drohen.` };
          } else if (growth >= THRESHOLDS.ARCC_INTEREST_GROWTH_WARNING) {
            return { status: 'WARNING', value: `+${growth.toFixed(1)}%`, message: 'Zinsbelastung der Schattenbanken steigt deutlich.' };
          }
          return { status: 'OK', value: (growth > 0 ? '+' : '') + growth.toFixed(1) + '%', message: 'Zinslast unter Kontrolle.' };
        }
      },

      // 🟡 CONTEMPORANEOUS (Akut)
      {
        name: 'Chicago Fed Stress Index (NFCI)',
        category: 'CONTEMPORANEOUS',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          const current = timeline[timeline.length - 1].macroGroups.FinancialConditions.ChicagoFedIndex;
          if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          if (current > THRESHOLDS.NFCI_CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: `Akuter Stress im Finanzsystem (>${THRESHOLDS.NFCI_CRITICAL}).` };
          }
          return { status: 'OK', value: current.toFixed(2), message: `Kein Systemstress (<=${THRESHOLDS.NFCI_CRITICAL}).` };
        }
      },

      // 🔴 TRIGGER (Verkaufssignale)
      {
        name: 'Rate Shock (Real Yield Velocity)',
        category: 'TRIGGER',
        evaluate: (timeline) => {
          if (timeline.length < 60) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 60 Tage)' };
          const currentDay = timeline[timeline.length - 1];
          const pastDay = timeline[timeline.length - 60];
          
          const currentYield = currentDay.macroGroups.FinancialConditions.RealYield10y;
          const pastYield = pastDay.macroGroups.FinancialConditions.RealYield10y;
          
          if (currentYield === null || pastYield === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          const diff = currentYield - pastYield;
          if (diff >= THRESHOLDS.RATE_SHOCK_CRITICAL) {
            return { status: 'CRITICAL', value: `+${diff.toFixed(2)}%`, message: `Zins-Schock! Realzinsen steigen zu schnell (>=${THRESHOLDS.RATE_SHOCK_CRITICAL}% in 60d).` };
          } else if (diff >= THRESHOLDS.RATE_SHOCK_WARNING) {
            return { status: 'WARNING', value: `+${diff.toFixed(2)}%`, message: 'Realzinsen steigen rasant.' };
          }
          return { status: 'OK', value: (diff > 0 ? '+' : '') + diff.toFixed(2) + '%', message: 'Zinsumfeld stabil.' };
        }
      },
      {
        name: 'High Yield Divergenz (HYG)',
        category: 'TRIGGER',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          const current = timeline[timeline.length - 1].assets.HYG;
          const past30 = timeline[timeline.length - 30].assets.HYG;
          if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          const perf = ((current - past30) / past30) * 100;
          if (perf <= THRESHOLDS.HYG_CRITICAL) {
            return { status: 'CRITICAL', value: `${perf.toFixed(1)}%`, message: `HYG bricht ein! Der Kreditmarkt trocknet aus (<=${THRESHOLDS.HYG_CRITICAL}% in 30d).` };
          } else if (perf <= THRESHOLDS.HYG_WARNING) {
            return { status: 'WARNING', value: `${perf.toFixed(1)}%`, message: 'Kreditmarkt zeigt Schwäche.' };
          }
          return { status: 'OK', value: `${perf.toFixed(1)}%`, message: 'Kreditmarkt gesund.' };
        }
      },
      {
        name: 'Private Credit Stress (BIZD)',
        category: 'TRIGGER',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          const current = timeline[timeline.length - 1].assets.BIZD;
          const past30 = timeline[timeline.length - 30].assets.BIZD;
          if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          const perf = ((current - past30) / past30) * 100;
          if (perf <= THRESHOLDS.BIZD_CRITICAL) {
            return { status: 'CRITICAL', value: `${perf.toFixed(1)}%`, message: `Smart Money Exit! BDC Sektor bricht ein (<=${THRESHOLDS.BIZD_CRITICAL}% in 30d).` };
          } else if (perf <= THRESHOLDS.BIZD_WARNING) {
            return { status: 'WARNING', value: `${perf.toFixed(1)}%`, message: 'Schattenbanken unter Druck.' };
          }
          return { status: 'OK', value: `${perf.toFixed(1)}%`, message: 'Private Credit Sektor stabil.' };
        }
      },
      {
        name: 'Floating Rate Stress (BKLN)',
        category: 'TRIGGER',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          const current = timeline[timeline.length - 1].assets.BKLN;
          const past30 = timeline[timeline.length - 30].assets.BKLN;
          if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          const perf = ((current - past30) / past30) * 100;
          if (perf <= THRESHOLDS.BKLN_CRITICAL) {
            return { status: 'CRITICAL', value: `${perf.toFixed(1)}%`, message: `Leveraged Loans crashen (<=${THRESHOLDS.BKLN_CRITICAL}% in 30d). Zinslast erdrückt Kreditnehmer!` };
          } else if (perf <= THRESHOLDS.BKLN_WARNING) {
            return { status: 'WARNING', value: `${perf.toFixed(1)}%`, message: 'Schwäche bei variabel verzinslichen Firmenkrediten.' };
          }
          return { status: 'OK', value: `${perf.toFixed(1)}%`, message: 'Leveraged Loans stabil.' };
        }
      },

      // 🔵 TROUGH (Boden-Suche / Kaufsignale nach Crash)
      {
        name: 'Panik-Kapitulation (VIX + CBOE + RSI)',
        category: 'TROUGH',
        evaluate: (timeline) => {
          if (timeline.length < 90) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 90 Tage)' };
          
          const currentDay = timeline[timeline.length - 1];
          const currentPrice = currentDay.assets.SPY;
          const currentVix = currentDay.assets.VIX;
          const currentCboe = currentDay.assets.CBOE_SPY;
          
          if (!currentPrice || !currentVix || !currentCboe) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          const prices = timeline.map(t => t.assets.SPY).filter(p => p !== null);
          if (prices.length < 40) return { status: 'UNKNOWN', message: 'Zu wenig Preisdaten für RSI' };
          
          let gains = 0, losses = 0;
          for (let i = 1; i <= 14; i++) {
              const diff = prices[i] - prices[i - 1];
              if (diff >= 0) gains += diff; else losses -= diff;
          }
          let avgGain = gains / 14;
          let avgLoss = losses / 14;
          let rsiArr = new Array(prices.length).fill(0);
          rsiArr[14] = 100 - (100 / (1 + (avgGain / avgLoss)));
          
          for (let i = 15; i < prices.length; i++) {
              const diff = prices[i] - prices[i - 1];
              const gain = diff >= 0 ? diff : 0;
              const loss = diff < 0 ? -diff : 0;
              avgGain = ((avgGain * 13) + gain) / 14;
              avgLoss = ((avgLoss * 13) + loss) / 14;
              rsiArr[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
          }
          const currentRsi = rsiArr[prices.length - 1];
          
          let sumVol = 0, countVol = 0;
          for (let j = 1; j <= 90; j++) {
             const vol = timeline[timeline.length - 1 - j]?.assets.CBOE_SPY;
             if (vol) { sumVol += vol; countVol++; }
          }
          const sma90Vol = countVol > 0 ? sumVol / countVol : 0;
          const isCboeSpike = sma90Vol > 0 && currentCboe >= sma90Vol * 1.5;
          const cboeMult = sma90Vol > 0 ? (currentCboe / sma90Vol) : 0;
          
          let prevLowPrice = Infinity, prevLowRsi = 0;
          for (let j = 5; j <= 40; j++) {
              const idx = prices.length - 1 - j;
              if (idx >= 0 && prices[idx] < prevLowPrice) {
                  prevLowPrice = prices[idx];
                  prevLowRsi = rsiArr[idx];
              }
          }
          
          const isNewLow = currentPrice <= prevLowPrice * 1.02;
          const isRsiHigher = currentRsi > prevLowRsi + 2;
          
          if (currentVix >= 35 && isCboeSpike && isNewLow && isRsiHigher) {
             return { status: 'CRITICAL', value: `VIX:${currentVix.toFixed(1)}|CBOE:${cboeMult.toFixed(1)}x`, message: `GENERATIONEN-KAUFSIGNAL! Extremer Panik-Climax bestätigt durch Bullish Divergence (RSI ${currentRsi.toFixed(1)} > ${prevLowRsi.toFixed(1)}).` };
          } else if (currentVix >= 35 && isCboeSpike) {
             return { status: 'WARNING', value: `VIX:${currentVix.toFixed(1)}|CBOE:${cboeMult.toFixed(1)}x`, message: `Massiver Panik-Spike im Optionsvolumen. Setup formiert sich.` };
          }
          
          return { status: 'OK', value: '-', message: 'Kein Panik-Climax aktiv.' };
        }
      },
      {
        name: 'VIX (Spike & Crush)',
        category: 'TROUGH',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          
          const currentVix = timeline[timeline.length - 1].assets.VIX;
          if (currentVix === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          // Finde das Maximum der letzten 30 Tage
          let maxVix30 = 0;
          for (let i = timeline.length - 30; i < timeline.length; i++) {
            const v = timeline[i].assets.VIX;
            if (v !== null && v > maxVix30) maxVix30 = v;
          }
          
          if (maxVix30 >= THRESHOLDS.VIX_SPIKE && currentVix < maxVix30 * THRESHOLDS.VIX_CRUSH_PCT) {
            return { status: 'CRITICAL', value: currentVix.toFixed(1), message: `KAUFSIGNAL! VIX ist gespiket (>=${THRESHOLDS.VIX_SPIKE}) und crasht jetzt (-20% vom Peak).` };
          } else if (maxVix30 >= THRESHOLDS.VIX_WARNING && currentVix < maxVix30 * THRESHOLDS.VIX_CRUSH_WARNING_PCT) {
            return { status: 'WARNING', value: currentVix.toFixed(1), message: 'VIX baut Panik ab. Bodenbildung läuft.' };
          } else if (maxVix30 >= THRESHOLDS.VIX_WARNING) {
            return { status: 'WARNING', value: currentVix.toFixed(1), message: 'Extreme Panik am Markt (VIX extrem hoch).' };
          }
          return { status: 'OK', value: currentVix.toFixed(1), message: 'Keine Panik-Extreme. Normaler Markt.' };
        }
      },
      {
        name: 'Gold (SMA 50 Ausbruch)',
        category: 'TROUGH',
        evaluate: (timeline) => {
          if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          
          const current = timeline[timeline.length - 1].assets.Gold;
          if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          // Berechne SMA 50
          let sum = 0;
          let count = 0;
          for (let i = timeline.length - 50; i < timeline.length; i++) {
            const v = timeline[i].assets.Gold;
            if (v !== null) {
              sum += v;
              count++;
            }
          }
          
          if (count === 0) return { status: 'UNKNOWN', message: 'Keine Daten für SMA' };
          const sma50 = sum / count;
          
          if (current > sma50 * THRESHOLDS.GOLD_BREAKOUT_PCT) {
            return { status: 'CRITICAL', value: current.toFixed(0), message: 'KAUFSIGNAL! Gold bricht nach oben aus (Flucht in Sicherheit beendet, Trend dreht).' };
          } else if (current > sma50) {
            return { status: 'WARNING', value: current.toFixed(0), message: 'Gold kämpft am SMA 50. Beobachten.' };
          }
          return { status: 'OK', value: current.toFixed(0), message: 'Gold im Abwärtstrend (unter SMA 50).' };
        }
      }
    ];
  }

  generateReport(groupedData, cleanText = false) {
    if (!groupedData || groupedData.length === 0) {
      throw new Error("Keine Daten für die Analyse vorhanden.");
    }
    
    let report = '';
    const addLine = (str) => report += str + '\n';

    addLine(`======================================================`);
    addLine(`📊 MAKRO-FINANZ ANALYSE (Stichtag: ${groupedData[groupedData.length - 1].date})`);
    addLine(`======================================================\n`);

    const categories = ['LEADING', 'TRIGGER', 'CONTEMPORANEOUS', 'TROUGH'];
    const icons = {
      'LEADING': '🟢 FRÜHINDIKATOREN (LEADING)',
      'TRIGGER': '🔴 TRIGGER-INDIKATOREN (SIGNAL)',
      'CONTEMPORANEOUS': '🟡 AKUT-INDIKATOREN (CONTEMPORANEOUS)',
      'TROUGH': '🔵 BODEN-INDIKATOREN (TROUGH)'
    };

    const statusColor = {
      'CRITICAL': cleanText ? '[CRITICAL]' : '\x1b[31m[CRITICAL]\x1b[0m', // Rot
      'WARNING': cleanText ? '[WARNING]' : '\x1b[33m[WARNING]\x1b[0m',  // Gelb
      'OK': cleanText ? '[OK]' : '\x1b[32m[OK]\x1b[0m',       // Grün
      'UNKNOWN': cleanText ? '[UNKNOWN]' : '\x1b[90m[UNKNOWN]\x1b[0m'   // Grau
    };

    categories.forEach(cat => {
      const header = cleanText ? icons[cat] : `\x1b[1m${icons[cat]}\x1b[0m`;
      addLine(header);
      const catIndicators = this.indicators.filter(i => i.category === cat);
      
      catIndicators.forEach(ind => {
        const result = ind.evaluate(groupedData);
        const colorStat = statusColor[result.status] || result.status;
        addLine(`  ${colorStat} ${ind.name}: ${result.value} -> ${result.message}`);
      });
      addLine('');
    });

    return report;
  }

  run(groupedData) {
    // Console Log für die CLI mit Farben
    const report = this.generateReport(groupedData, false);
    // Wir entfernen das letzte \n vom report, da console.log eh eins anhängt
    console.log('\n' + report.trimEnd());
  }

  getAlerts(groupedData, alertHistory = {}, debounceDays = 14) {
    if (!groupedData || groupedData.length === 0) return null;
    
    let highestPriority = 'default';
    const alerts = [];
    const now = Date.now();
    const debounceMs = debounceDays * 24 * 60 * 60 * 1000;

    this.indicators.forEach(ind => {
      const result = ind.evaluate(groupedData);
      if (result.status === 'CRITICAL' || result.status === 'WARNING') {
        
        // Debounce-Check: Wurde für diesen Indikator (mit diesem Status) in letzter Zeit schon gewarnt?
        const historyKey = `${ind.name}_${result.status}`;
        const lastSent = alertHistory[historyKey];
        if (lastSent && (now - lastSent) < debounceMs) {
            return; // Zu früh, überspringen (Spam-Schutz)
        }

        // Wir merken uns, dass wir ihn jetzt (bzw. gleich) senden
        alertHistory[historyKey] = now;

        if (result.status === 'CRITICAL') {
          highestPriority = 'urgent'; // Ntfy max priority
          alerts.push(`🚨 CRITICAL: ${ind.name} - ${result.message} (${result.value})`);
        } else if (result.status === 'WARNING') {
          if (highestPriority === 'default') highestPriority = 'high';
          alerts.push(`⚠️ WARNING: ${ind.name} - ${result.message} (${result.value})`);
        }
      }
    });

    if (alerts.length === 0) return null;

    return {
      priority: highestPriority,
      message: alerts.join('\n\n'),
      updatedHistory: alertHistory
    };
  }
}
