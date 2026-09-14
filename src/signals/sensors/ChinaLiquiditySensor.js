import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * ChinaLiquiditySensor (Atomarer Leaf-Sensor)
 * 
 * Überwacht Währungs- und Liquiditätsstress aus China:
 * - USD/CNY (DEXCHUS) Wechselkurs-Druck (Yuan-Abwertung entzieht globale Dollar-Liquidität)
 * - Chinas M2 Kreditimpuls
 */
export class ChinaLiquiditySensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.cnyDevaluationWarningPct = config.cnyDevaluationWarningPct ?? 2.5; // +2.5% USD/CNY Anstieg in 30d
    this.cnyDevaluationCriticalPct = config.cnyDevaluationCriticalPct ?? 4.5; // +4.5% Yuan-Abwertungs-Schock
    this.cnyStressLevel = config.cnyStressLevel ?? 7.30;
  }

  getId() {
    return 'CHINA_LIQUIDITY_SENSOR';
  }

  getName() {
    return 'China FX & Kredit-Liquiditäts-Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < 30) {
      return {
        status: SignalStatus.UNKNOWN,
        usdCny: null,
        usdCnyRoc30d: null,
        message: 'Zu wenig Daten für China-Liquiditäts Auswertung'
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const past30 = timeline[Math.max(0, n - 30)];

    const curCny = currentDay.macroGroups?.GlobalMacro?.UsdCny ?? null;
    const pastCny = past30.macroGroups?.GlobalMacro?.UsdCny ?? curCny;

    const usdCnyRoc30d = (curCny && pastCny) ? ((curCny - pastCny) / pastCny) * 100 : 0;
    const isLevelStressed = curCny !== null && curCny >= this.cnyStressLevel;
    const isDevaluationWarning = usdCnyRoc30d >= this.cnyDevaluationWarningPct;
    const isDevaluationCritical = usdCnyRoc30d >= this.cnyDevaluationCriticalPct;

    let status = SignalStatus.OK;
    let message = 'Chinesische Währungs- und Liquiditätsbedingungen stabil.';

    if (isDevaluationCritical || (isLevelStressed && isDevaluationWarning)) {
      status = SignalStatus.CRITICAL;
      message = `China-Liquiditätsabzug! USD/CNY: ${curCny?.toFixed(4)}, 30d-Sprung: +${usdCnyRoc30d.toFixed(1)}%`;
    } else if (isDevaluationWarning || isLevelStressed) {
      status = SignalStatus.WARNING;
      message = `Erhöhter Abwertungsdruck in China: USD/CNY: ${curCny?.toFixed(4)} (+${usdCnyRoc30d.toFixed(1)}% in 30d)`;
    }

    return {
      status,
      usdCny: curCny !== null ? Number(curCny.toFixed(4)) : null,
      usdCnyRoc30d: Number(usdCnyRoc30d.toFixed(1)),
      message,
      diagnostics: {
        curCny,
        isLevelStressed,
        isDevaluationWarning,
        isDevaluationCritical
      }
    };
  }
}
