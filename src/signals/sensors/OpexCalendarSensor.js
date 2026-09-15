import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * OpexCalendarSensor (Atomarer Leaf-Sensor)
 * 
 * Berechnet deterministisch die Kalender-Phase im Derivate-Monatszyklus:
 * - PRE_OPEX_PRESSURE: Kompression / Stop-Fishing vor dem Verfall
 * - VIX_CRUSH: VIX-Settlement (Mittwoch vor dem 3. Freitag)
 * - WITCHING_PINNING: Max-Pain-Strikes & Dealer-Gamma-Bindung am 3. Freitag
 * - POST_OPEX_UNPINNING: Folgewoche nach Verfall (Gamma-Klammer gelöst)
 * - FUTURES_ROLL: Kontrakt-Rollen der Großanleger (Quartalsmonate)
 * - NEUTRAL_FLOW: Regulärer Markttrend
 */
export class OpexCalendarSensor extends SignalComponent {
  getId() {
    return 'OPEX_CALENDAR_SENSOR';
  }

  getName() {
    return 'OpEx & Hexensabbat Kalender Sensor';
  }

  /**
   * Berechnet den 3. Freitag eines Monats (UTC)
   */
  static getThirdFriday(year, monthIndex) {
    if (isNaN(year) || isNaN(monthIndex)) {
      const now = new Date();
      year = now.getUTCFullYear();
      monthIndex = now.getUTCMonth();
    }
    let date = new Date(Date.UTC(year, monthIndex, 1));
    if (isNaN(date.getTime())) return new Date();
    let fridays = 0;
    let guard = 0;
    while (fridays < 3 && guard < 35) {
      guard++;
      if (date.getUTCDay() === 5) fridays++;
      if (fridays < 3) date.setUTCDate(date.getUTCDate() + 1);
    }
    return date;
  }

  /**
   * Berechnet das VIX-Settlement-Datum (Mittwoch vor dem 3. Freitag)
   */
  static getVixSettlementDate(thirdFriday) {
    const vix = new Date(thirdFriday);
    vix.setUTCDate(thirdFriday.getUTCDate() - 2);
    return vix;
  }

  /**
   * Prüft, ob ein Monat ein Quartals-Hexensabbat ist (März, Juni, Sept, Dez)
   */
  static isQuadrupleWitching(monthIndex) {
    return [2, 5, 8, 11].includes(monthIndex);
  }

  /**
   * Ermittelt den aktuellen Status für ein beliebiges Datum (Standard: heute)
   */
  static evaluateDate(targetDate = new Date()) {
    let d = new Date(targetDate);
    if (isNaN(d.getTime())) {
      d = new Date();
    }
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();

    // 3. Freitag des aktuellen Monats
    const currentOpEx = OpexCalendarSensor.getThirdFriday(year, month);
    const currentVix = OpexCalendarSensor.getVixSettlementDate(currentOpEx);
    const isQuad = OpexCalendarSensor.isQuadrupleWitching(month);

    // Zeitstempel in Tagen (UTC Mitternacht)
    const curTimeMs = Date.UTC(year, month, day);
    const opExTimeMs = currentOpEx.getTime();
    const vixTimeMs = currentVix.getTime();

    // Montag der Verfallswoche
    const opexMonday = new Date(currentOpEx);
    opexMonday.setUTCDate(currentOpEx.getUTCDate() - 4);
    const opexMondayMs = opexMonday.getTime();

    // Mittwoch nach Verfall (Ende des Unpinning)
    const postOpexWednesday = new Date(currentOpEx);
    postOpexWednesday.setUTCDate(currentOpEx.getUTCDate() + 5);
    const postOpexWedMs = postOpexWednesday.getTime();

    // Futures Roll: Zweiter Donnerstag des Quartalsmonats (T-8 vor OpEx)
    const futuresRollStart = new Date(currentOpEx);
    futuresRollStart.setUTCDate(currentOpEx.getUTCDate() - 8);
    const futuresRollStartMs = futuresRollStart.getTime();

    let phase = 'NEUTRAL_FLOW';
    let phaseLabel = 'Regulärer Markttrend';
    let guidance = 'Der Markt folgt primär Makro- und Fundamentaldaten.';
    let isWitchingWeek = isQuad && (curTimeMs >= opexMondayMs && curTimeMs <= opExTimeMs);

    // Ziel-OpEx für den Countdown: Wenn aktueller Verfall vorbei ist, nächster Monat
    let targetOpEx = currentOpEx;
    let targetVix = currentVix;
    let isTargetQuad = isQuad;

    if (curTimeMs === vixTimeMs) {
      phase = 'VIX_CRUSH';
      phaseLabel = 'VIX-Settlement (Volatilitäts-Kollaps)';
      guidance = 'VIX-Futures verfallen heute. Typischer Wendepunkt durch schlagartig fallende implizite Volatilität.';
    } else if (curTimeMs === opExTimeMs) {
      phase = 'WITCHING_PINNING';
      phaseLabel = isQuad ? 'Großer Hexensabbat (Quadruple Witching)' : 'Monatlicher Optionsverfall (OpEx)';
      guidance = 'Maximales Options- und Futures-Volumen. Kurse gravitieren zu den Max-Pain-Strikes.';
    } else if (curTimeMs > vixTimeMs && curTimeMs < opExTimeMs) {
      phase = 'WITCHING_PINNING';
      phaseLabel = isQuad ? 'Hexensabbat-Pinning' : 'Pre-OpEx Pinning';
      guidance = 'Kurse werden von Market Makern vor dem Verfall an Schlüssel-Strikes gebunden.';
    } else if (curTimeMs >= opexMondayMs && curTimeMs < vixTimeMs) {
      phase = 'PRE_OPEX_PRESSURE';
      phaseLabel = isQuad ? 'Hexensabbat Pre-Pressure' : 'Pre-OpEx Kompression';
      guidance = 'Dealer in Short-Gamma. Stop-Fishing und künstliche Volatilität wahrscheinlich. Keine Panikverkäufe!';
    } else if (curTimeMs > opExTimeMs && curTimeMs <= postOpexWedMs) {
      phase = 'POST_OPEX_UNPINNING';
      phaseLabel = 'Post-OpEx Unpinning (Befreiungsschlag)';
      guidance = 'Gamma-Fessel gelöst. Gedeckelte oder künstlich gedrückte Aktien vollziehen oft einen sprunghaften Rebound.';
    } else if (isQuad && curTimeMs >= futuresRollStartMs && curTimeMs < opexMondayMs) {
      phase = 'FUTURES_ROLL';
      phaseLabel = 'Futures-Roll-Fenster';
      guidance = 'Großanleger rollen Kontrakte in den nächsten Frontmonat. Künstliche Kurssprünge durch Umschichtungen.';
    }

    if (curTimeMs > postOpexWedMs) {
      const nextMonth = (month + 1) % 12;
      const nextYear = month === 11 ? year + 1 : year;
      targetOpEx = OpexCalendarSensor.getThirdFriday(nextYear, nextMonth);
      targetVix = OpexCalendarSensor.getVixSettlementDate(targetOpEx);
      isTargetQuad = OpexCalendarSensor.isQuadrupleWitching(nextMonth);
    }

    const diffDaysToOpEx = Math.round((targetOpEx.getTime() - curTimeMs) / (1000 * 60 * 60 * 24));
    const diffDaysToVix = Math.round((targetVix.getTime() - curTimeMs) / (1000 * 60 * 60 * 24));

    return {
      targetDate: d.toISOString().split('T')[0],
      currentOpExDate: targetOpEx.toISOString().split('T')[0],
      currentVixSettlementDate: targetVix.toISOString().split('T')[0],
      isQuadrupleWitching: isTargetQuad,
      isWitchingWeek,
      daysToVixSettlement: diffDaysToVix,
      daysToOpEx: diffDaysToOpEx,
      phase,
      phaseLabel,
      guidance,
      calendarDetails: {
        futuresRollStartDate: isQuad ? futuresRollStart.toISOString().split('T')[0] : null,
        opexWeekStartDate: opexMonday.toISOString().split('T')[0],
        postOpexUnpinningEndDate: postOpexWednesday.toISOString().split('T')[0]
      }
    };
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        phase: 'UNKNOWN',
        daysToOpEx: null,
        daysToVixSettlement: null,
        isQuadrupleWitching: false,
        isWitchingWeek: false,
        message: 'Keine Timeline-Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const dateStr = currentDay.date;
    const evalRes = OpexCalendarSensor.evaluateDate(dateStr || new Date());

    let status = SignalStatus.OK;
    if (evalRes.phase === 'PRE_OPEX_PRESSURE' || evalRes.phase === 'VIX_CRUSH') {
      status = evalRes.isQuadrupleWitching ? SignalStatus.CRITICAL : SignalStatus.WARNING;
    } else if (evalRes.phase === 'WITCHING_PINNING') {
      status = SignalStatus.WARNING;
    }

    return {
      status,
      phase: evalRes.phase,
      phaseLabel: evalRes.phaseLabel,
      daysToOpEx: evalRes.daysToOpEx,
      daysToVixSettlement: evalRes.daysToVixSettlement,
      isQuadrupleWitching: evalRes.isQuadrupleWitching,
      isWitchingWeek: evalRes.isWitchingWeek,
      guidance: evalRes.guidance,
      details: evalRes.calendarDetails
    };
  }
}

// Alias für Abwärtskompatibilität in Analyse-Skripten
export const DerivativesCycleService = OpexCalendarSensor;
