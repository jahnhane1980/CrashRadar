import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus, GoldilocksRegime } from '../contracts/SignalTypes.js';
import { MathUtils } from '../../utils/MathUtils.js';

/**
 * GoldilocksSensorHub (Composite Hub)
 * 
 * Bewertet kontinuierlich, ob sich das US-Makroklima im idealen "Goldilocks"-Zustand
 * (Soft Landing: moderates Wachstum, abkühlende Inflation, stabile Beschäftigung, Zinspause/Cuts)
 * befindet oder in Stagflation, Rezession oder Überhitzung abdriftet.
 * 
 * 4 Kern-Säulen:
 * 1. Disinflations-Pfad (Core CPI, PPI, Breakeven, Rohöl)
 * 2. Arbeitsmarkt-Gesundheit (Sahm-Regel, Payrolls-Wachstum, JOLTS)
 * 3. Zins- & Realrendite-Klima (10Y Real Yield, Zinskurven-Spread, Fed-Pfad)
 * 4. Markt-Bestätigung (SPY vs. SMA 200, Trend-Intaktheit)
 */
export class GoldilocksSensorHub extends SignalComponent {
  constructor(config = {}) {
    super();
    this.config = config;
    this.smaPeriod = config.smaPeriod || 200;
  }

  getId() {
    return 'GOLDILOCKS_SENSOR_HUB';
  }

  getName() {
    return 'Goldilocks Macro Regime Sensor Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  /**
   * Wertet die Zeitreihe aus und liefert das standardisierte Goldilocks-Resultat.
   * @param {Array<Object>} timeline
   * @param {Object} [context={}]
   * @returns {Object}
   */
  evaluate(timeline, context = {}) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: GoldilocksRegime.UNKNOWN,
        score: null,
        message: 'Zu wenig Daten für Goldilocks-Auswertung',
        guidance: 'Warte auf vollständige Makro-Historie.',
        diagnostics: {}
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const n = timeline.length;

    // Hilfsfunktion: Letzten gültigen numerischen Wert rückwärts suchen
    const getLatestMetric = (extractor, maxLookback = 90) => {
      for (let i = n - 1; i >= Math.max(0, n - 1 - maxLookback); i--) {
        const val = extractor(timeline[i]);
        if (val !== null && val !== undefined && !isNaN(Number(val))) {
          return { value: Number(val), date: timeline[i].date, index: i };
        }
      }
      return null;
    };

    // 1. Säule: Disinflation & Preisdruck
    const rawCpi = getLatestMetric(d => d.macroGroups?.Leading?.CPI_Core ?? d.macro?.CPI_Core);
    const rawPpi = getLatestMetric(d => d.macroGroups?.Leading?.PPI ?? d.macro?.PPI);
    const breakeven = getLatestMetric(d => d.macroGroups?.Leading?.BreakevenInflation ?? d.macro?.BreakevenInflation);
    const oilPrice = currentDay.assets?.Oil ?? getLatestMetric(d => d.assets?.Oil)?.value ?? null;

    // Berechne YoY & MoM für CPI & PPI auf Basis des echten Berichtsmonats-Stichtags
    const calcYoYAndMoM = (extractor) => {
      let latestIdx = -1, latestVal = null, latestDate = null;
      for (let i = n - 1; i >= 0; i--) {
        const v = extractor(timeline[i]);
        if (v !== null && v !== undefined && !isNaN(Number(v))) {
          latestVal = Number(v);
          latestDate = timeline[i].date;
          latestIdx = i;
          break;
        }
      }
      if (latestVal === null) return { yoy: null, mom: null, latestVal: null };

      // Wenn der Wert bereits eine fertige %-Rate ist (z.B. < 20)
      if (latestVal < 20) {
        return { yoy: latestVal, mom: null, latestVal };
      }

      // Echten Berichtsmonats-Stichtag rückwärts ermitteln (Beginn des Plateaus)
      let observationDate = latestDate;
      for (let i = latestIdx; i >= 0; i--) {
        const v = extractor(timeline[i]);
        if (Number(v) === latestVal) {
          observationDate = timeline[i].date;
        } else {
          break;
        }
      }

      // Vormonat (MoM): Der erste abweichende Wert davor
      let prevVal = null;
      for (let i = latestIdx - 1; i >= 0; i--) {
        const v = extractor(timeline[i]);
        if (v !== null && v !== undefined && Number(v) !== latestVal) {
          prevVal = Number(v);
          break;
        }
      }

      // Vorjahr (YoY): Exakt 1 Kalenderjahr vor dem Stichtag
      const target1Y = new Date(observationDate);
      target1Y.setFullYear(target1Y.getFullYear() - 1);
      const target1YStr = target1Y.toISOString().split('T')[0];

      let past1YVal = null;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].date <= target1YStr) {
          const v = extractor(timeline[i]);
          if (v !== null && v !== undefined && !isNaN(Number(v))) {
            past1YVal = Number(v);
            break;
          }
        }
      }

      const yoy = (past1YVal !== null && past1YVal > 0) ? parseFloat((((latestVal - past1YVal) / past1YVal) * 100).toFixed(2)) : null;
      const mom = (prevVal !== null && prevVal > 0) ? parseFloat((((latestVal - prevVal) / prevVal) * 100).toFixed(2)) : null;
      return { yoy, mom, latestVal, observationDate, past1YVal, prevVal };
    };

    const cpiStats = calcYoYAndMoM(d => d.macroGroups?.Leading?.CPI_Core ?? d.macro?.CPI_Core);
    const ppiStats = calcYoYAndMoM(d => d.macroGroups?.Leading?.PPI ?? d.macro?.PPI);

    const cpiYoY = cpiStats?.yoy ?? null;
    const cpiMoM = cpiStats?.mom ?? null;
    const ppiYoY = ppiStats?.yoy ?? null;
    const ppiMoM = ppiStats?.mom ?? null;

    // 2. Säule: Arbeitsmarkt & Rezessionsrisiko
    const sahmRule = getLatestMetric(d => d.macroGroups?.Leading?.SahmRule ?? d.macro?.SahmRule);
    const payems = getLatestMetric(d => d.macroGroups?.LaborMarket?.PAYEMS ?? d.macro?.PAYEMS);
    const jolts = getLatestMetric(d => d.macroGroups?.LaborMarket?.JTSJOL ?? d.macro?.JTSJOL);

    let payemsDiff = null;
    if (payems && payems.index > 20) {
      // Monatliche Veränderung
      for (let i = payems.index - 1; i >= Math.max(0, payems.index - 40); i--) {
        const prev = timeline[i].macroGroups?.LaborMarket?.PAYEMS ?? timeline[i].macro?.PAYEMS;
        if (prev && prev !== payems.value) {
          payemsDiff = payems.value - prev;
          break;
        }
      }
    }

    // 3. Säule: Zinsen & Geldpolitik
    const realYield = getLatestMetric(d => d.macroGroups?.FinancialConditions?.RealYield10y ?? d.macro?.RealYield10y);
    const spread10y2y = getLatestMetric(d => d.macroGroups?.YieldCurve?.Spread10y2y ?? d.macro?.Spread10y2y);
    const fedFunds = getLatestMetric(d => d.macroGroups?.FinancialConditions?.FedFundsRate ?? d.macro?.FedFundsRate);

    // 4. Säule: Aktienmarkt-Trend (SPY vs SMA 200)
    const spyPrice = currentDay.assets?.SPY ?? null;
    const sma200 = MathUtils.getSma(timeline, d => d.assets?.SPY, this.smaPeriod, 0);
    const isAboveSma200 = (spyPrice !== null && sma200 !== null) ? (spyPrice >= sma200) : true;

    // ==========================================
    // SCORE-BERECHNUNG (0 bis 100 Punkte)
    // ==========================================
    let score = 0;
    const scoreBreakdown = {
      inflation: 0,
      labor: 0,
      yields: 0,
      trend: 0
    };

    // A. Inflation Scoring (Max 25 Punkte)
    // Ziel: Core CPI <= 3.0%, Breakeven <= 2.3%, Öl <= 85$
    if (cpiYoY !== null) {
      if (cpiYoY <= 2.8) scoreBreakdown.inflation += 12;
      else if (cpiYoY <= 3.5) scoreBreakdown.inflation += 8;
      else if (cpiYoY <= 4.0) scoreBreakdown.inflation += 4;
    } else {
      scoreBreakdown.inflation += 8; // Neutraler Fallback
    }

    if (breakeven !== null) {
      if (breakeven.value <= 2.30) scoreBreakdown.inflation += 7;
      else if (breakeven.value <= 2.50) scoreBreakdown.inflation += 4;
    } else {
      scoreBreakdown.inflation += 4;
    }

    if (oilPrice !== null) {
      if (oilPrice <= 80.0) scoreBreakdown.inflation += 6;
      else if (oilPrice <= 90.0) scoreBreakdown.inflation += 3;
      else if (oilPrice > 95.0) scoreBreakdown.inflation -= 3; // Öl-Druck
    } else {
      scoreBreakdown.inflation += 4;
    }

    // B. Labor Market Scoring (Max 25 Punkte)
    // Ziel: Sahm-Regel < 0.35, Stellenaufbau positiv (40k-150k), JOLTS stabil
    if (sahmRule !== null) {
      if (sahmRule.value < 0.20) scoreBreakdown.labor += 12;
      else if (sahmRule.value < 0.40) scoreBreakdown.labor += 8;
      else if (sahmRule.value < 0.50) scoreBreakdown.labor += 3;
      else scoreBreakdown.labor -= 10; // Rezessions-Trigger!
    } else {
      scoreBreakdown.labor += 8;
    }

    if (payemsDiff !== null) {
      if (payemsDiff >= 50 && payemsDiff <= 200) scoreBreakdown.labor += 8; // Idealer Soft-Landing Korridor
      else if (payemsDiff > 200) scoreBreakdown.labor += 5; // Heiß, aber Wachstum
      else if (payemsDiff >= 0) scoreBreakdown.labor += 3;
      else scoreBreakdown.labor -= 5; // Stellenabbau
    } else {
      scoreBreakdown.labor += 5;
    }

    if (jolts !== null) {
      if (jolts.value >= 6800 && jolts.value <= 8200) scoreBreakdown.labor += 5;
      else if (jolts.value > 8200) scoreBreakdown.labor += 3;
      else scoreBreakdown.labor += 1;
    } else {
      scoreBreakdown.labor += 3;
    }

    // C. Yields & Monetary Policy Scoring (Max 25 Punkte)
    // Ziel: RealYield10y <= 2.10%, Spread >= 0.0% (keine Inversion), Fed im Pause/Cut-Modus
    if (realYield !== null) {
      if (realYield.value <= 1.80) scoreBreakdown.yields += 12;
      else if (realYield.value <= 2.20) scoreBreakdown.yields += 8;
      else if (realYield.value <= 2.50) scoreBreakdown.yields += 4;
      else scoreBreakdown.yields -= 3; // Zins-Gegenwind (> 2.50%)
    } else {
      scoreBreakdown.yields += 6;
    }

    if (spread10y2y !== null) {
      if (spread10y2y.value >= 0.15) scoreBreakdown.yields += 8; // Gesunde Steilheit
      else if (spread10y2y.value >= 0.0) scoreBreakdown.yields += 5; // Un-invertiert
      else scoreBreakdown.yields += 1; // Noch leicht invertiert
    } else {
      scoreBreakdown.yields += 4;
    }

    if (fedFunds !== null) {
      if (fedFunds.value <= 4.0) scoreBreakdown.yields += 5;
      else scoreBreakdown.yields += 3;
    } else {
      scoreBreakdown.yields += 3;
    }

    // D. Trend & Market Scoring (Max 25 Punkte)
    if (isAboveSma200) {
      scoreBreakdown.trend += 20;
    } else {
      scoreBreakdown.trend -= 5; // Bärenmarkt-Gefahr
    }
    scoreBreakdown.trend += 5;

    // Begrenzungen
    scoreBreakdown.inflation = Math.max(0, Math.min(25, scoreBreakdown.inflation));
    scoreBreakdown.labor = Math.max(0, Math.min(25, scoreBreakdown.labor));
    scoreBreakdown.yields = Math.max(0, Math.min(25, scoreBreakdown.yields));
    scoreBreakdown.trend = Math.max(0, Math.min(25, scoreBreakdown.trend));

    score = scoreBreakdown.inflation + scoreBreakdown.labor + scoreBreakdown.yields + scoreBreakdown.trend;
    score = Math.max(0, Math.min(100, Math.round(score)));

    // ==========================================
    // REGIME- & STATUS-ABLEITUNG
    // ==========================================
    let regime = GoldilocksRegime.TRANSITIONAL;
    let status = SignalStatus.OK;
    let message = '';
    let guidance = '';

    const isRecessionThreat = (sahmRule && sahmRule.value >= 0.50) || (payemsDiff !== null && payemsDiff < -20);
    const isStagflationThreat = (oilPrice !== null && oilPrice > 95.0 && realYield && realYield.value > 2.40) ||
                                (cpiYoY !== null && cpiYoY > 3.8 && payemsDiff !== null && payemsDiff < 40);
    const isOverheating = (cpiYoY !== null && cpiYoY > 4.0 && payemsDiff !== null && payemsDiff > 250);

    // 1. Akute Rezession (Veto vor allen anderen)
    if (isRecessionThreat) {
      regime = GoldilocksRegime.RECESSION_CONTRACTION;
      status = SignalStatus.CRITICAL;
      message = `REZESSIONS-ALARM! Arbeitsmarkt schlägt an (Sahm: ${sahmRule?.value.toFixed(2) || 'N/A'}, Jobs: ${payemsDiff || 'N/A'}k).`;
      guidance = 'Soft Landing gescheitert. Risikopositionen absichern und Cash/Defensive bevorzugen.';
    }
    // 2. Stagflations-Druck (Öl/Inflation hoch bei restriktiven Zinsen)
    else if (isStagflationThreat) {
      regime = GoldilocksRegime.STAGFLATION_PRESSURE;
      status = SignalStatus.WARNING;
      message = `STAGFLATIONS-DRUCK: Hohe Energiekosten/Inflation (Öl: ${oilPrice ? oilPrice.toFixed(1) : 'N/A'}$) treffen auf restriktive Realzinsen (${realYield?.value.toFixed(2) || 'N/A'}%).`;
      guidance = 'Zinssenkungs-Fantasie gedämpft. Zykliker und High-Beta Tech vorsichtig agieren lassen.';
    }
    // 3. Überhitzungs-Boom
    else if (isOverheating) {
      regime = GoldilocksRegime.OVERHEATING_BOOM;
      status = SignalStatus.WARNING;
      message = `ÜBERHITZUNG: Wirtschaft & Stellenaufbau zu heiß, Zinsbremse der Fed muss länger anhalten.`;
      guidance = 'Keine unmittelbare Crash-Gefahr, aber Zinsdruck auf Bewertungsmultiplikatoren.';
    }
    // 4. Goldilocks Expansion (Soft Landing im Idealzustand)
    else if (score >= 65 && isAboveSma200) {
      regime = GoldilocksRegime.GOLDILOCKS_EXPANSION;
      status = SignalStatus.OK;
      message = `GOLDILOCKS-ZONE AKTIV (Score: ${score}/100): Disinflation intakt, Jobmarkt stabil und Aktien-Aufwärtstrend bestätigt.`;
      guidance = 'Ideales Marktumfeld für Aktien, Growth und Krypto. Dips vor großen Verfallsterminen bieten historisch exzellente Einstiegschancen.';
    }
    // 5. Übergangsphase / Gemischtes Bild
    else {
      regime = GoldilocksRegime.TRANSITIONAL;
      status = score < 50 ? SignalStatus.WARNING : SignalStatus.OK;
      message = `ÜBERGANGS-REGIME (Score: ${score}/100): Makro-Kräfte neutralisieren sich. Datenlage beobachten.`;
      guidance = 'Diszipliniertes Positionsmanagement. Weder übermäßige Hektik noch blinde Sorglosigkeit.';
    }

    return {
      status,
      regime,
      score,
      message,
      guidance,
      isAboveSma200,
      scoreBreakdown,
      diagnostics: {
        inflation: {
          coreCpiYoY: cpiYoY !== null ? Number(cpiYoY.toFixed(2)) : null,
          coreCpiMoM: cpiMoM !== null ? Number(cpiMoM.toFixed(2)) : null,
          ppiYoY: ppiYoY !== null ? Number(ppiYoY.toFixed(2)) : null,
          ppiMoM: ppiMoM !== null ? Number(ppiMoM.toFixed(2)) : null,
          breakevenInflation: breakeven?.value ?? null,
          oilPrice: oilPrice !== null ? Number(oilPrice.toFixed(2)) : null
        },
        labor: {
          sahmRule: sahmRule?.value ?? null,
          payemsDiff: payemsDiff,
          jolts: jolts?.value ?? null
        },
        monetary: {
          realYield10y: realYield?.value ?? null,
          spread10y2y: spread10y2y?.value ?? null,
          fedFundsRate: fedFunds?.value ?? null
        },
        market: {
          spyPrice: spyPrice !== null ? Number(spyPrice.toFixed(2)) : null,
          spySma200: sma200 !== null ? Number(sma200.toFixed(2)) : null,
          isAboveSma200
        }
      }
    };
  }
}
