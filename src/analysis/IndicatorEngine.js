import fs from 'fs';
import path from 'path';

export class IndicatorEngine {
  constructor() {
    const configPath = path.resolve(process.cwd(), 'config/Notification-Config.json');
    this.notificationConfig = { topics: {}, indicators: {} };
    try {
      if (fs.existsSync(configPath)) {
        this.notificationConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        console.warn(`[IndicatorEngine] Config nicht gefunden: ${configPath}`);
      }
    } catch (e) {
      console.error("[IndicatorEngine] Fehler beim Laden der Notification-Config:", e.message);
    }

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
      ARCC_INTEREST_GROWTH_WARNING: 5.0,
      GOLD_CLIMAX_VOL_MULTIPLIER: 5.0,
      GOLD_CLIMAX_PRICE_DROP: -2.0,
      GOLD_CLIMAX_PRICE_RISE: 2.0,
      GDX_CLIMAX_VOL_MULTIPLIER: 3.0,
      GDX_CLIMAX_PRICE_DROP: -5.0,
      GDX_CLIMAX_PRICE_RISE: 5.0
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
      {
        name: 'Bitcoin Divergenz (Makro-Liquidität)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          
          const currentSpy = timeline[timeline.length - 1].assets.SPY;
          const currentBtc = timeline[timeline.length - 1].assets.BTC;
          if (!currentSpy || !currentBtc) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          let spyMax30 = 0, btcMax30 = 0;
          for (let i = timeline.length - 30; i < timeline.length; i++) {
            if (timeline[i].assets.SPY > spyMax30) spyMax30 = timeline[i].assets.SPY;
            if (timeline[i].assets.BTC > btcMax30) btcMax30 = timeline[i].assets.BTC;
          }
          
          const spyDrawdown = ((currentSpy - spyMax30) / spyMax30) * 100;
          const btcDrawdown = ((currentBtc - btcMax30) / btcMax30) * 100;
          
          if (spyDrawdown >= -2.0 && btcDrawdown <= -10.0) {
            return { status: 'WARNING', value: `SPY ${spyDrawdown.toFixed(1)}%, BTC ${btcDrawdown.toFixed(1)}%`, message: 'Liquiditäts-Staubsauger aktiv! SPY nahe Allzeithoch, aber BTC stürzt ab (TGA-Sog).' };
          }
          return { status: 'OK', value: '-', message: 'Keine gefährliche Liquiditäts-Divergenz.' };
        }
      },
      {
        name: 'Krypto Zyklus-Divergenz (MSTR/COIN)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          
          const currentBtc = timeline[timeline.length - 1].assets.BTC;
          const currentMstr = timeline[timeline.length - 1].assets.MSTR;
          const currentCoin = timeline[timeline.length - 1].assets.COIN;
          
          if (!currentBtc || (!currentMstr && !currentCoin)) return { status: 'UNKNOWN', message: 'Keine Proxy-Daten' };
          
          let btcMax30 = 0, mstrMax30 = 0, coinMax30 = 0;
          for (let i = timeline.length - 30; i < timeline.length; i++) {
            if (timeline[i].assets.BTC > btcMax30) btcMax30 = timeline[i].assets.BTC;
            if (timeline[i].assets.MSTR && timeline[i].assets.MSTR > mstrMax30) mstrMax30 = timeline[i].assets.MSTR;
            if (timeline[i].assets.COIN && timeline[i].assets.COIN > coinMax30) coinMax30 = timeline[i].assets.COIN;
          }
          
          const btcDrawdown = ((currentBtc - btcMax30) / btcMax30) * 100;
          const mstrDrawdown = mstrMax30 > 0 ? ((currentMstr - mstrMax30) / mstrMax30) * 100 : 0;
          const coinDrawdown = coinMax30 > 0 ? ((currentCoin - coinMax30) / coinMax30) * 100 : 0;
          
          const proxyDrawdown = Math.min(mstrMax30 > 0 ? mstrDrawdown : 0, coinMax30 > 0 ? coinDrawdown : 0);
          
          if (btcDrawdown >= -2.0 && proxyDrawdown <= -15.0) {
            return { status: 'WARNING', value: `BTC ${btcDrawdown.toFixed(1)}%, Proxy ${proxyDrawdown.toFixed(1)}%`, message: 'Zyklus-Warnung! BTC stark, aber MSTR/COIN bluten aus (Liquidität fehlt).' };
          }
          return { status: 'OK', value: '-', message: 'Krypto-Proxies intakt.' };
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
      {
        name: 'Gold Volume Climax (Panik/FOMO)',
        category: 'CONTEMPORANEOUS',
        evaluate: (timeline) => {
          if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 50 Tage)' };
          
          const currentDay = timeline[timeline.length - 1];
          const prevDay = timeline[timeline.length - 2];
          
          const currentVol = currentDay.assets.Gold_Volume;
          const currentPrice = currentDay.assets.Gold;
          const prevPrice = prevDay.assets.Gold;
          
          if (!currentVol || !currentPrice || !prevPrice) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für Gold' };
          
          // 50-Tage Durchschnittsvolumen
          let sumVol = 0;
          let count = 0;
          for (let i = timeline.length - 50; i < timeline.length; i++) {
            const v = timeline[i].assets.Gold_Volume;
            if (v && v > 0) {
              sumVol += v;
              count++;
            }
          }
          
          if (count === 0) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
          const avgVol = sumVol / count;
          const volRatio = currentVol / avgVol;
          const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;
          
          if (volRatio >= THRESHOLDS.GOLD_CLIMAX_VOL_MULTIPLIER) {
            if (priceChangePct <= THRESHOLDS.GOLD_CLIMAX_PRICE_DROP) {
              return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, ${priceChangePct.toFixed(1)}%`, message: 'SELLING CLIMAX! Gold crasht unter extremem Volumen (Margin Call Liquidations!).' };
            } else if (priceChangePct >= THRESHOLDS.GOLD_CLIMAX_PRICE_RISE) {
              return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, +${priceChangePct.toFixed(1)}%`, message: 'BUYING CLIMAX! Gold explodiert unter extremem Volumen (Panik-Flucht in Sicherheit!).' };
            }
          }
          
          return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Normales Gold-Handelsvolumen.' };
        }
      },
      {
        name: 'GDX Selling Climax (Boden-Suche)',
        category: 'CONTEMPORANEOUS',
        evaluate: (timeline) => {
          if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 50 Tage)' };
          
          const currentDay = timeline[timeline.length - 1];
          const prevDay = timeline[timeline.length - 2];
          
          const currentVol = currentDay.assets.GDX_Volume;
          const currentPrice = currentDay.assets.GDX;
          const prevPrice = prevDay.assets.GDX;
          
          if (!currentVol || !currentPrice || !prevPrice) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für GDX' };
          
          // 50-Tage Durchschnittsvolumen
          let sumVol = 0;
          let count = 0;
          for (let i = timeline.length - 50; i < timeline.length; i++) {
            const v = timeline[i].assets.GDX_Volume;
            if (v && v > 0) {
              sumVol += v;
              count++;
            }
          }
          
          if (count === 0) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
          const avgVol = sumVol / count;
          const volRatio = currentVol / avgVol;
          const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;
          
          if (volRatio >= THRESHOLDS.GDX_CLIMAX_VOL_MULTIPLIER && priceChangePct <= THRESHOLDS.GDX_CLIMAX_PRICE_DROP) {
            return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, ${priceChangePct.toFixed(1)}%`, message: 'GDX SELLING CLIMAX! Miner-Kapitulation. Smart Money sammelt ein (V-Shape Boden).' };
          }
          
          return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Kein Selling Climax.' };
        }
      },
      {
        name: 'GDX Buying Climax (Top-Gefahr)',
        category: 'CONTEMPORANEOUS',
        evaluate: (timeline) => {
          if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 50 Tage)' };
          
          const currentDay = timeline[timeline.length - 1];
          const prevDay = timeline[timeline.length - 2];
          
          const currentVol = currentDay.assets.GDX_Volume;
          const currentPrice = currentDay.assets.GDX;
          const prevPrice = prevDay.assets.GDX;
          
          if (!currentVol || !currentPrice || !prevPrice) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für GDX' };
          
          let sumVol = 0, count = 0;
          for (let i = timeline.length - 50; i < timeline.length; i++) {
            const v = timeline[i].assets.GDX_Volume;
            if (v && v > 0) { sumVol += v; count++; }
          }
          
          if (count === 0) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
          const avgVol = sumVol / count;
          const volRatio = currentVol / avgVol;
          const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;
          
          if (volRatio >= THRESHOLDS.GDX_CLIMAX_VOL_MULTIPLIER && priceChangePct >= THRESHOLDS.GDX_CLIMAX_PRICE_RISE) {
            return { status: 'WARNING', value: `${volRatio.toFixed(1)}x Vol, +${priceChangePct.toFixed(1)}%`, message: 'GDX BUYING CLIMAX! Extreme FOMO bei den Minern. Smart Money verkauft in Liquidität (Bullenfalle).' };
          }
          
          return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Kein Buying Climax.' };
        }
      },
      {
        name: 'GDX vs Gold Divergenz',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
          
          const currentGold = timeline[timeline.length - 1].assets.Gold;
          const currentGdx = timeline[timeline.length - 1].assets.GDX;
          
          if (!currentGold || !currentGdx) return { status: 'UNKNOWN', message: 'Keine Daten' };
          
          // Finde Hochpunkte der letzten 30 Tage für Gold und GDX
          let goldMax30 = 0, goldMaxIdx = 0;
          let gdxMax30 = 0, gdxMaxIdx = 0;
          
          for (let i = timeline.length - 30; i < timeline.length; i++) {
            const g = timeline[i].assets.Gold;
            if (g && g > goldMax30) { goldMax30 = g; goldMaxIdx = i; }
            
            const gdx = timeline[i].assets.GDX;
            if (gdx && gdx > gdxMax30) { gdxMax30 = gdx; gdxMaxIdx = i; }
          }
          
          // Wenn Gold in den letzten 5 Tagen sein 30-Tage-Hoch gemacht hat
          const isGoldAtTop = goldMaxIdx >= (timeline.length - 5);
          
          // Aber GDX schon vor mehr als 10 Tagen sein Hoch hatte und seitdem fällt
          const isGdxDiverging = gdxMaxIdx <= (timeline.length - 10);
          
          // Prüfen, ob GDX signifikant vom 30-Tage Hoch abgefallen ist (z.B. > 3% gefallen)
          const gdxDrawdown = ((currentGdx - gdxMax30) / gdxMax30) * 100;
          
          if (isGoldAtTop && isGdxDiverging && gdxDrawdown <= -3.0) {
            return { status: 'WARNING', value: `GDX ${gdxDrawdown.toFixed(1)}% vom Hoch`, message: 'GDX toppt vor Gold! Smart Money nimmt bei Minen bereits Gewinne mit, während Gold noch steigt. Gold-Top steht unmittelbar bevor.' };
          }
          
          return { status: 'OK', value: '-', message: 'Keine GDX/Gold Divergenz.' };
        }
      },

      // 🔴 TRIGGER (Verkaufssignale)
      {
        name: 'Red Alert (Bullenmarkt-Stirbt-Signal)',
        category: 'TRIGGER',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          
          const currentDay = timeline[timeline.length - 1];
          const skew = currentDay.assets?.SKEW;
          const shortRatio = currentDay.SPY_ShortVolumeRatio;
          const pcr = currentDay.TotalPCR;
          
          if (skew === undefined || shortRatio === undefined) {
             return { status: 'UNKNOWN', message: 'Keine SKEW oder Short-Ratio Daten' };
          }
          
          // Fallback für PCR, wenn die lokale Datei (noch) fehlt
          const pcrVal = pcr !== undefined ? pcr : 1.0; 
          const hasPcr = pcr !== undefined;
          
          if (skew > 145 && shortRatio < 0.45) {
             if (pcrVal < 0.75) {
                return { 
                  status: 'CRITICAL', 
                  value: `SKEW:${skew.toFixed(1)}|Short:${(shortRatio*100).toFixed(1)}%|PCR:${pcrVal.toFixed(2)}`, 
                  message: `MAXIMALER ALARM! Institutionelle Panik-Absicherung (SKEW) trifft auf extreme Retail-Gier (Short-Capitulation & PCR < 0.75). Der Markt steht vor dem Crash.`
                };
             } else {
                return { 
                  status: 'WARNING', 
                  value: `SKEW:${skew.toFixed(1)}|Short:${(shortRatio*100).toFixed(1)}%${hasPcr ? '|PCR:'+pcrVal.toFixed(2) : ' (Kein PCR)'}`, 
                  message: `Bären-Kapitulation + Smart-Money Hedging! ABER: Melt-Up Phase ist noch aktiv (PCR > 0.75). Weiterer Anstieg möglich, bis Euphorie komplettiert.` 
                };
             }
          } else if (skew > 140 && shortRatio < 0.50) {
             return { status: 'WARNING', value: `SKEW:${skew.toFixed(1)}|Short:${(shortRatio*100).toFixed(1)}%`, message: 'Spannung baut sich auf. Bären sterben langsam aus.' };
          }
          
          return { status: 'OK', value: '-', message: 'Kein Crash-Setup aktiv.' };
        }
      },
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
      {
        name: 'Central Bank Policy Error (DFF vs T10YIE vs DXY)',
        category: 'TRIGGER',
        evaluate: (timeline) => {
          // Wir brauchen 60 Handelstage (~3 Monate)
          if (timeline.length < 60) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 60 Tage)' };
          
          const current = timeline[timeline.length - 1];
          const past = timeline[timeline.length - 60];
          
          const currentDFF = current.macroGroups?.FinancialConditions?.FedFundsRate;
          const pastDFF = past.macroGroups?.FinancialConditions?.FedFundsRate;
          
          const currentT10YIE = current.macroGroups?.Leading?.BreakevenInflation;
          const pastT10YIE = past.macroGroups?.Leading?.BreakevenInflation;

          const currentDXY = current.macroGroups?.FinancialConditions?.DXY;
          const pastDXY = past.macroGroups?.FinancialConditions?.DXY;

          if (currentDFF === undefined || pastDFF === undefined || currentDFF === null || pastDFF === null ||
              currentT10YIE === undefined || pastT10YIE === undefined || currentT10YIE === null || pastT10YIE === null ||
              currentDXY === undefined || pastDXY === undefined || currentDXY === null || pastDXY === null) {
            return { status: 'UNKNOWN', message: 'Keine Daten für FED Funds Rate, Inflation oder DXY' };
          }

          const dffChange = currentDFF - pastDFF;
          const t10yieChange = currentT10YIE - pastT10YIE;
          const dxyReturn = ((currentDXY - pastDXY) / pastDXY) * 100;

          // THRESHOLD: Leitzins sinkt um > 0.25%, Inflation steigt um > 0.10%
          if (dffChange < -0.25 && t10yieChange > 0.10) {
            // FILTER: Ein starker Dollar (> +2%) erstickt die Gold-Rallye
            if (dxyReturn > 2.0) {
                return { 
                  status: 'WARNING', 
                  value: `DFF ${dffChange.toFixed(2)}% / T10YIE +${t10yieChange.toFixed(2)}% / DXY +${dxyReturn.toFixed(1)}%`, 
                  message: `Policy Error erkannt, ABER starker US-Dollar blockiert Gold-Ausbruch.` 
                };
            }
            return { 
              status: 'CRITICAL', 
              value: `DFF ${dffChange.toFixed(2)}% / T10YIE +${t10yieChange.toFixed(2)}% / DXY ${dxyReturn.toFixed(1)}%`, 
              message: `SYSTEM-ALARM: FED senkt Zinsen panisch, aber Markt erwartet wieder Inflation! Schwacher Dollar befeuert Fiat-Flucht in Gold.` 
            };
          } else if (dffChange < -0.10 && t10yieChange > 0.05) {
            return { 
              status: 'WARNING', 
              value: `DFF ${dffChange.toFixed(2)}% / T10YIE +${t10yieChange.toFixed(2)}%`, 
              message: 'FED Zinsen sinken, während Inflationserwartung leicht steigt. Vertrauensverlust droht.' 
            };
          }
          
          return { status: 'OK', value: `DFF ${dffChange.toFixed(2)}%`, message: 'Geldpolitik im Einklang mit Inflationserwartungen.' };
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
      },
      {
        name: 'Bitcoin Selling Climax (Panik/Boden)',
        category: 'TROUGH',
        evaluate: (timeline) => {
          if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          
          const currentDay = timeline[timeline.length - 1];
          const prevDay = timeline[timeline.length - 2];
          
          const currentBtc = currentDay.assets.BTC;
          const prevBtc = prevDay.assets.BTC;
          const currentBtcVol = currentDay.assets.BTC_Volume;
          
          if (!currentBtc || !prevBtc || !currentBtcVol) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für BTC' };
          
          let sumVol = 0, count = 0;
          for (let i = timeline.length - 30; i < timeline.length; i++) {
            const v = timeline[i].assets.BTC_Volume;
            if (v && v > 0) { sumVol += v; count++; }
          }
          
          if (count === 0) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
          const avgVol = sumVol / count;
          const volRatio = currentBtcVol / avgVol;
          const priceChangePct = ((currentBtc - prevBtc) / prevBtc) * 100;
          
          if (volRatio >= 4.0 && priceChangePct <= -5.0) {
             return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, ${priceChangePct.toFixed(1)}%`, message: 'BTC SELLING CLIMAX! Gigantischer Flush-Out. Makro-Liquiditäts-Tiefpunkt erreicht!' };
          }
          return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Kein Krypto-Ausverkauf.' };
        }
      },
      {
        name: 'Tech-Zyklus Radar (SMH vs IGV)',
        category: 'CYCLE',
        evaluate: (timeline) => {
          // Wir brauchen mindestens 10 Wochen (~50 Tage) Daten für einen sinnvollen 10-Wochen-MA,
          // besser noch mehr (z.B. 100 Tage)
          if (timeline.length < 100) return { status: 'UNKNOWN', message: 'Zu wenig Daten für Moving Averages' };

          const SHORT_MA_DAYS = 15; // ca. 3 Wochen
          const LONG_MA_DAYS = 50;  // ca. 10 Wochen

          // Helper-Funktion für MA des Ratios
          const getRatioMa = (days, offsetIndex = 0) => {
            let sum = 0, count = 0;
            const startIndex = timeline.length - 1 - offsetIndex - days;
            const endIndex = timeline.length - 1 - offsetIndex;
            for (let i = startIndex; i < endIndex; i++) {
              if (timeline[i] && timeline[i].assets.SMH && timeline[i].assets.IGV) {
                sum += (timeline[i].assets.SMH / timeline[i].assets.IGV);
                count++;
              }
            }
            return count > 0 ? sum / count : null;
          };

          const currentShortMa = getRatioMa(SHORT_MA_DAYS, 0);
          const currentLongMa = getRatioMa(LONG_MA_DAYS, 0);
          
          const prevShortMa = getRatioMa(SHORT_MA_DAYS, 5); // MA vor einer Woche
          const prevLongMa = getRatioMa(LONG_MA_DAYS, 5);

          if (!currentShortMa || !currentLongMa || !prevShortMa || !prevLongMa) {
            return { status: 'UNKNOWN', message: 'Keine SMH oder IGV Daten verfügbar' };
          }

          // Ratio Momentum (Steigt der schnelle MA noch oder flacht er ab?)
          const shortMaMomentum = currentShortMa - prevShortMa;
          
          // CIBR Check (Gibt es defensive Flucht?)
          // Berechne kurzes Momentum von CIBR vs SPY
          let cibrFleeing = false;
          let cibrStr = "";
          const today = timeline[timeline.length - 1];
          const past = timeline[timeline.length - 15];
          if (today.assets.CIBR && today.assets.SPY && past.assets.CIBR && past.assets.SPY) {
            const currentCibrRs = today.assets.CIBR / today.assets.SPY;
            const pastCibrRs = past.assets.CIBR / past.assets.SPY;
            const cibrMomentum = ((currentCibrRs - pastCibrRs) / pastCibrRs) * 100;
            if (cibrMomentum > 2.0) {
              cibrFleeing = true;
              cibrStr = `Defensives Geld flüchtet massiv in Cybersecurity (CIBR Momentum: +${cibrMomentum.toFixed(1)}%).`;
            }
          }

          // Status-Erkennung
          const isHardwareDominant = currentShortMa > currentLongMa;
          const wasHardwareDominant = prevShortMa > prevLongMa;

          if (isHardwareDominant && !wasHardwareDominant) {
            return { status: 'CRITICAL', value: 'HARDWARE START', message: 'TECH-ZYKLUS BESTÄTIGUNG: Hardware (SMH) hat offiziell die Führung übernommen (Golden Cross des Ratios). Der neue KI/Infrastruktur-Zyklus ist aktiv.' };
          }
          if (!isHardwareDominant && wasHardwareDominant) {
            return { status: 'CRITICAL', value: 'SOFTWARE START', message: 'TECH-ZYKLUS BESTÄTIGUNG: Software (IGV) hat offiziell die Führung übernommen (Death Cross des Ratios). Das Geld wandert in SaaS/Monetarisierung.' };
          }
          
          if (isHardwareDominant) {
            if (shortMaMomentum < 0) {
              // Distribution!
              const msg = `Hardware wackelt (Distribution). Das Ratio flacht ab, Gewinnmitnahmen wahrscheinlich. ${cibrStr}`;
              return { status: 'WARNING', value: 'DISTRIBUTION', message: msg.trim() };
            } else {
              return { status: 'OK', value: 'HARDWARE DOMINANZ', message: 'Hardware-Zyklus (SMH) ist intakt und baut Momentum auf.' };
            }
          } else {
            if (shortMaMomentum > 0) {
              // Accumulation!
              return { status: 'WARNING', value: 'ACCUMULATION', message: 'Vorwarnung: Software (IGV) ist noch dominant, aber Hardware (SMH) sammelt bereits massiv Momentum. Ein Wechsel steht an.' };
            } else {
              return { status: 'OK', value: 'SOFTWARE DOMINANZ', message: 'Software-Zyklus (IGV) ist intakt und baut Momentum auf.' };
            }
          }
        }
      },
      {
        name: 'ML Regime Radar (Makro)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          const mlRegime = timeline[timeline.length - 1].mlRegime;
          if (!mlRegime) return { status: 'UNKNOWN', message: 'Keine ML Prognose vorhanden' };
          
          const { phase, confidence } = mlRegime;
          const confPct = (confidence * 100).toFixed(1) + '%';
          
          if (phase === 'MACRO_TOP' || phase === 'CYCLE_TOP') {
            return { status: 'CRITICAL', value: `TOP (${confPct})`, message: 'KI-ALARM! Absolute Makro-Euphorie erkannt. Extremes Absturzrisiko für alle Risiko-Assets.' };
          } else if ((phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6) {
             return { status: 'WARNING', value: `BEAR (${confPct})`, message: 'KI-Warnung! Bärenmarkt-Struktur aktiv. Liquidität sinkt.' };
          } else if (phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM') {
            return { status: 'CRITICAL', value: `BOTTOM (${confPct})`, message: 'KI-SIGNAL! Das makroökonomische Tal der Tränen (Kapitulation) ist erreicht.' };
          } else if (phase === 'UPTREND' || phase === 'BULL_MARKET') {
            return { status: 'OK', value: `BULL (${confPct})`, message: 'Gesunde Bullenmarkt-Struktur (Higher Highs).' };
          }
          return { status: 'OK', value: `${phase} (${confPct})`, message: 'Neutrales Regime.' };
        }
      },
      {
        name: 'ML Regime Radar (Krypto)',
        category: 'LEADING',
        evaluate: (timeline) => {
          if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
          const mlRegime = timeline[timeline.length - 1].mlRegime;
          if (!mlRegime) return { status: 'UNKNOWN', message: 'Keine ML Prognose vorhanden' };
          
          const { phase, confidence } = mlRegime;
          const confPct = (confidence * 100).toFixed(1) + '%';
          
          if (phase === 'MACRO_TOP' || phase === 'CYCLE_TOP') {
            return { status: 'CRITICAL', value: `TOP (${confPct})`, message: 'KRYPTO-ZYKLUSENDE! Verteilungsphase (Distribution) im vollen Gange. Gewinne sichern!' };
          } else if ((phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6) {
             return { status: 'WARNING', value: `BEAR (${confPct})`, message: 'KRYPTO-WINTER: Bärenmarkt aktiv. Jeder Pump ist eine Bullenfalle (Dead Cat Bounce).' };
          } else if (phase === 'BEAR_RALLY') {
             return { status: 'WARNING', value: `BEAR RALLY (${confPct})`, message: 'Trügerischer Pump im Bärenmarkt (Dead Cat Bounce).' };
          } else if (phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM') {
            return { status: 'CRITICAL', value: `BOTTOM (${confPct})`, message: 'KRYPTO-BODEN! Historische Kaufgelegenheit im Bitcoin.' };
          } else if (phase === 'UPTREND' || phase === 'BULL_MARKET') {
            return { status: 'OK', value: `BULL (${confPct})`, message: 'Bitcoin im stabilen Aufwärtstrend (Höhere Hochs).' };
          } else if (phase === 'BULL_CORRECTION') {
            return { status: 'OK', value: `CORRECTION (${confPct})`, message: 'Normale Korrektur im intakten Bullenmarkt (Buy the dip).' };
          }
          return { status: 'OK', value: `${phase} (${confPct})`, message: 'Neutrales Krypto-Regime.' };
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
    
    const now = Date.now();
    const debounceMs = debounceDays * 24 * 60 * 60 * 1000;
    
    // Gruppierung der Alarme nach Topic (Asset Class)
    const groupedAlerts = {};

    this.indicators.forEach(ind => {
      const result = ind.evaluate(groupedData);
      if (result.status === 'CRITICAL' || result.status === 'WARNING') {
        
        // Debounce-Check: Wurde für diesen Indikator (mit diesem Status) in letzter Zeit schon gewarnt?
        const historyKey = `${ind.name}_${result.status}`;
        const lastSent = alertHistory[historyKey];
        if (lastSent && (now - lastSent) < debounceMs) {
            return; // Zu früh, überspringen (Spam-Schutz)
        }

        alertHistory[historyKey] = now;
        
        // Topic ermitteln (Fallback: MACRO)
        const topicKey = this.notificationConfig.indicators[ind.name] || 'MACRO';
        
        if (!groupedAlerts[topicKey]) {
            groupedAlerts[topicKey] = {
                highestPriority: 'default',
                messages: []
            };
        }

        if (result.status === 'CRITICAL') {
          groupedAlerts[topicKey].highestPriority = 'urgent'; 
          groupedAlerts[topicKey].messages.push(`🚨 CRITICAL: ${ind.name} - ${result.message} (${result.value})`);
        } else if (result.status === 'WARNING') {
          if (groupedAlerts[topicKey].highestPriority === 'default') {
              groupedAlerts[topicKey].highestPriority = 'high';
          }
          groupedAlerts[topicKey].messages.push(`⚠️ WARNING: ${ind.name} - ${result.message} (${result.value})`);
        }
      }
    });

    const notifications = [];
    
    for (const [topicKey, data] of Object.entries(groupedAlerts)) {
        const topicConfig = this.notificationConfig.topics[topicKey] || { title: `CrashRadar: ${topicKey}`, icon: 'warning', priority: 'high' };
        
        // Bei 'urgent' (Critical) überschreiben wir die Standard-Topic-Priority. 
        // Bei 'high' (Warning) überschreiben wir nur, wenn der Topic-Standard 'default' ist.
        const finalPriority = data.highestPriority === 'urgent' ? 'urgent' : 
                             (data.highestPriority === 'high' && topicConfig.priority === 'default' ? 'high' : topicConfig.priority);
        
        notifications.push({
            title: topicConfig.title,
            priority: finalPriority,
            tags: topicConfig.icon,
            message: data.messages.join('\n\n')
        });
    }

    return {
      notifications: notifications.length > 0 ? notifications : null,
      updatedHistory: alertHistory
    };
  }

  getDailyStatusReport(groupedData) {
    if (!groupedData || groupedData.length === 0) return null;
    
    let summary = '';
    const categories = ['LEADING', 'TRIGGER', 'CONTEMPORANEOUS', 'TROUGH'];
    let overallStatus = 'OK';
    
    categories.forEach(cat => {
      const catIndicators = this.indicators.filter(i => i.category === cat);
      let catErrors = 0;
      let catWarns = 0;
      
      catIndicators.forEach(ind => {
          const res = ind.evaluate(groupedData);
          if (res.status === 'CRITICAL') catErrors++;
          else if (res.status === 'WARNING') catWarns++;
      });
      
      if (catErrors > 0) overallStatus = 'CRITICAL';
      else if (catWarns > 0 && overallStatus !== 'CRITICAL') overallStatus = 'WARNING';
      
      let catStatusStr = catErrors > 0 ? '🚨 Kritisch' : (catWarns > 0 ? '⚠️ Warnung' : '✅ OK');
      summary += `${cat}: ${catStatusStr}\n`;
    });
    
    return {
        title: `CrashRadar: Daily Status (${overallStatus})`,
        priority: 'default',
        tags: 'chart_with_upwards_trend',
        message: summary.trim()
    };
  }
}
