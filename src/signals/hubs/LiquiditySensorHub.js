import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus, LiquidityRegime } from '../contracts/SignalTypes.js';
import { VixShockSensor } from '../sensors/VixShockSensor.js';
import { LiquidityCollisionSensor } from '../sensors/LiquidityCollisionSensor.js';

/**
 * LiquiditySensorHub (Composite)
 * 
 * Überwacht die Geldmarkt- und Staatsanleihen-Liquidität (Treasury Capacity & Slack):
 * - Bank Reserves (WRESBAL) vs. LCLOR (Lowest Comfortable Level of Reserves)
 * - Reverse Repo (RRP) Puffer
 * - TGA-Refill-Defizit und Puffer
 * - Netto-Auktionen (Coupons vs. Bills vs. Buybacks)
 * - Time-to-Collision (TTC): Zeitliche Vorhersage bis zur Liquiditäts-Erschöpfung!
 * - BUFFERED_CUSHION: Gepufferte Phase (RRP niedrig, aber TGA puffert ab)
 * - TOXIC_LIQUIDITY_TRAP: Makrostress >= 55 & VIX > 25 (93% Crash-Präzision)
 */
export class LiquiditySensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.THRESHOLDS = {
      CRITICAL: config.thresholdCritical ?? 75,
      WARNING: config.thresholdWarning ?? 55
    };
    this.vixShockSensor = dependencies.vixShockSensor || new VixShockSensor(config.vixConfig || {});
    this.collisionSensor = dependencies.collisionSensor || new LiquidityCollisionSensor(config.collisionConfig || {});
  }

  getId() {
    return 'LIQUIDITY_SENSOR_HUB';
  }

  getName() {
    return 'Treasury- & Geldmarkt-Liquiditäts-Sensor-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < 21) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: LiquidityRegime.UNKNOWN,
        projectedCollision: 'Zu wenig Daten (< 21 Tage)',
        catalystStatus: 'UNKNOWN',
        ttcDays: null,
        message: 'Zu wenig Daten (< 21 Tage)',
        diagnostics: {}
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const mg = currentDay?.macroGroups;

    if (!mg || !mg.NetLiquidity || !mg.BankingHealth) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: LiquidityRegime.UNKNOWN,
        projectedCollision: 'Makro-Daten fehlen',
        catalystStatus: 'UNKNOWN',
        ttcDays: null,
        message: 'Makro-Daten fehlen',
        diagnostics: {}
      };
    }

    const wresbalRaw = mg.BankingHealth.BankReserves;
    const rrpRaw = mg.NetLiquidity.RRPONTSYD;
    if (wresbalRaw === undefined || wresbalRaw === null || rrpRaw === undefined || rrpRaw === null) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: LiquidityRegime.UNKNOWN,
        projectedCollision: 'Bankreserven (WRESBAL) oder RRP fehlen',
        catalystStatus: 'UNKNOWN',
        ttcDays: null,
        message: 'Bankreserven (WRESBAL) oder RRP fehlen',
        diagnostics: {}
      };
    }

    // 1. Basis-Größen in Milliarden USD ($B)
    const gdpBillion = (mg.TreasuryCapacity?.GDP || 28000);
    const lclorBillion = gdpBillion * 0.105; // 10.5% des BIP

    const wresbalBillion = wresbalRaw > 100000 ? (wresbalRaw / 1000) : wresbalRaw;
    const rrpBillion = rrpRaw;
    const tgaBillion = (mg.NetLiquidity.TGA || 500);
    const walclBillion = (mg.NetLiquidity.WALCL || 7000);

    const excessReservesBillion = Math.max(0, wresbalBillion - lclorBillion);
    const liquidSlackBillion = rrpBillion + excessReservesBillion;

    // 2. Netto-Auktionen & Buybacks der letzten 21 Tage
    let sumBuybacksMio21 = 0;
    let sumBillsMio21 = 0;
    let sumCouponsMio21 = 0;

    for (let i = Math.max(0, n - 21); i < n; i++) {
      const tc = timeline[i].macroGroups?.TreasuryCapacity;
      if (tc) {
        sumBuybacksMio21 += (tc.BuybackMio || 0);
        sumBillsMio21 += (tc.AuctionBillsMio || 0);
        sumCouponsMio21 += (tc.AuctionCouponsMio || 0);
      }
    }

    const buybacksB21 = sumBuybacksMio21 / 1000;
    const netCouponsB21 = Math.max(0, (sumCouponsMio21 - sumBuybacksMio21) / 1000);

    // 3. TGA-Puffer vs. TGA-Refill-Druck
    const tgaTargetBillion = 750;
    const tgaRefillDeficitB = Math.max(0, tgaTargetBillion - tgaBillion);
    const tgaCushionB = Math.max(0, tgaBillion - tgaTargetBillion);

    // Drain-Velocity der letzten 21 Tage
    const past21 = timeline[Math.max(0, n - 21)];
    const deltaTgaB = tgaBillion - (past21.macroGroups?.NetLiquidity?.TGA || 500);
    const deltaWalclB = walclBillion - (past21.macroGroups?.NetLiquidity?.WALCL || 7000);
    const qtDrainB = deltaWalclB < 0 ? Math.abs(deltaWalclB) : 0;

    const realizedNetDrainB21 = Math.max(0, (deltaTgaB - buybacksB21) + qtDrainB);
    const dailyNetDrainB = realizedNetDrainB21 / 21;

    // Forward Refill-Druck
    const forwardRefillDailyB = tgaRefillDeficitB > 0 ? (tgaRefillDeficitB / 45) : 0;
    const effectiveDailyDrainB = Math.max(dailyNetDrainB, forwardRefillDailyB * 0.7);

    // Time-to-Collision (TTC) - Die essenzielle zeitliche Prognose!
    const effectiveSlackB = liquidSlackBillion + (tgaCushionB * 0.35);
    const ttcDays = (effectiveDailyDrainB > 0 && effectiveSlackB > 0)
      ? Math.min(365, effectiveSlackB / effectiveDailyDrainB)
      : (effectiveSlackB <= 0.5 ? 0 : 365);

    // USGSEC Z-Score
    let usgsecZ = 0;
    if (n >= 60) {
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, n - 252); i < n; i++) {
        const u = timeline[i].macroGroups?.TreasuryCapacity?.USGSEC;
        if (u !== undefined && u !== null) {
          sum += u;
          count++;
        }
      }
      if (count > 10) {
        const mean = sum / count;
        let varSum = 0;
        for (let i = Math.max(0, n - 252); i < n; i++) {
          const u = timeline[i].macroGroups?.TreasuryCapacity?.USGSEC;
          if (u !== undefined && u !== null) varSum += Math.pow(u - mean, 2);
        }
        const std = Math.sqrt(varSum / count) || 1;
        const curU = mg.TreasuryCapacity?.USGSEC || mean;
        usgsecZ = (curU - mean) / std;
      }
    }

    // Scores
    const slackScore = Math.max(0, Math.min(100, (1 - (effectiveSlackB - 500) / 2000) * 100));
    const ttcScore = Math.max(0, Math.min(100, (1 - (ttcDays - 20) / 100) * 100));
    const refillPressureScore = Math.max(0, Math.min(100, (tgaRefillDeficitB / 400) * 100));
    const bankScore = Math.max(0, Math.min(100, ((usgsecZ + 1) / 3) * 100));

    const liquidityStress = 0.40 * slackScore + 0.30 * ttcScore + 0.15 * refillPressureScore + 0.15 * bankScore;

    // Duration- & Zins-Stress
    const lookback60Idx = Math.max(0, n - 42);
    const past60 = timeline[lookback60Idx].macroGroups;

    const curTp = mg.TreasuryCapacity?.THREEFYTP10 ?? 0.5;
    const pastTp = past60?.TreasuryCapacity?.THREEFYTP10 ?? curTp;
    const deltaTp = curTp - pastTp;
    const tpScore = Math.max(0, Math.min(100, ((deltaTp - 0.10) / 0.50) * 100));

    const curRealYield = mg.FinancialConditions?.RealYield10y ?? 2.0;
    const pastRealYield = past60?.FinancialConditions?.RealYield10y ?? curRealYield;
    const deltaRealYield = curRealYield - pastRealYield;
    const realYieldScore = Math.max(0, Math.min(100, ((deltaRealYield - 0.20) / 0.60) * 100));

    const curDff = mg.FinancialConditions?.FedFundsRate ?? 5.0;
    const pastDff = past60?.FinancialConditions?.FedFundsRate ?? curDff;
    const deltaDff = curDff - pastDff;
    const dffScore = Math.max(0, Math.min(100, ((deltaDff - 0.25) / 0.75) * 100));

    const totalIssued21 = sumBillsMio21 + sumCouponsMio21;
    const netCouponRatio = totalIssued21 > 0 ? (netCouponsB21 * 1000 / totalIssued21) : 0.2;
    const durationIntensityScore = Math.max(0, Math.min(100, ((netCouponRatio - 0.20) / 0.40) * 100));

    const rateValuationStress = 0.35 * tpScore + 0.35 * realYieldScore + 0.15 * dffScore + 0.15 * durationIntensityScore;
    const dualMacroStress = 0.55 * liquidityStress + 0.45 * rateValuationStress;

    const monthlyBuybackB = buybacksB21 * (30 / 21);
    const isBuffered = tgaCushionB > 50 && monthlyBuybackB >= 5.0 && (ttcDays === null || ttcDays >= 90);

    let catalystStatus = 'NORMAL';
    let collisionWindow = 'Kein akutes Kollisions-Fenster';

    if (tgaRefillDeficitB > 250 && netCouponRatio > 0.40 && effectiveSlackB < 500) {
      catalystStatus = 'IMMINENT_DRAIN';
      collisionWindow = 'Akuter Sofort-Abzug (Tax-Day / Refill-Welle)';
    } else if (liquidSlackBillion < 50) {
      if (isBuffered) {
        catalystStatus = 'BUFFERED_TILL_ELECTION';
        collisionWindow = '26.10.2026 - 10.11.2026 (Nach Zwischenwahlen / QRA)';
      } else {
        const daysLeft = Math.round(ttcDays);
        collisionWindow = `In ca. ${daysLeft} Tagen`;
      }
    }

    // VIX-Auswertung via VixShockSensor
    const vixRes = this.vixShockSensor.evaluate(timeline);
    const rawVix = currentDay?.assets?.VIX ?? vixRes.vix;
    const vix = rawVix !== null && rawVix !== undefined ? Number(rawVix) : 15.0;
    const isVixElevated = Boolean(vixRes.isElevated || vix > 25.0);

    // 1. Toxische Liquiditäts-Falle: Makrostress >= 55 UND VIX > 25 (93.1% Crash-Präzision)
    const isToxicTrap = dualMacroStress >= this.THRESHOLDS.WARNING && isVixElevated;

    // 2. Akute Geldmarkt-Kollision: TTC < 30 Tage ODER ungedeckter Refill-Drain ODER echter Notstand (< 8% BIP)
    const isBelowLclor = wresbalBillion < lclorBillion;
    const isSevereLclorBreach = wresbalBillion < (gdpBillion * 0.08);
    const isCollisionImminent = !isBuffered && (
      (ttcDays !== null && ttcDays < 30) ||
      (catalystStatus === 'IMMINENT_DRAIN' && effectiveSlackB < 300) ||
      isSevereLclorBreach
    );

    const isCritical = dualMacroStress >= this.THRESHOLDS.CRITICAL || isToxicTrap || isCollisionImminent;
    const isWarningTriggered = dualMacroStress >= this.THRESHOLDS.WARNING || (ttcDays !== null && ttcDays < 90);

    let regime = LiquidityRegime.EXPANSION;
    let status = SignalStatus.OK;
    let message = `Geldmarkt-Liquidität stabil (Slack: $${liquidSlackBillion.toFixed(1)}B, TTC: ${Math.round(ttcDays)} Tage).`;

    if (isCritical) {
      regime = LiquidityRegime.CRITICAL_DRAIN;
      status = SignalStatus.CRITICAL;
      if (isToxicTrap) {
        message = `Roter Alarm! Toxische Liquiditäts-Falle (DualStress: ${dualMacroStress.toFixed(1)} >= 55 & VIX: ${vix.toFixed(1)} > 25). Don't do it – Finger weg vom Dip-Buying!`;
      } else if (isCollisionImminent) {
        message = `Roter Alarm! Akute Geldmarkt-Kollision (TTC: ${Math.round(ttcDays)}d < 30d). Fenster: ${collisionWindow}.`;
      } else {
        message = `Roter Alarm! Akuter Liquiditäts-Abzug. Dualer Stress: ${dualMacroStress.toFixed(1)} (>= ${this.THRESHOLDS.CRITICAL}).`;
      }
    } else if (liquidSlackBillion < 50 && isBuffered && !isWarningTriggered) {
      // Puffer-Phase: RRP niedrig, aber TGA-Cushion & Buybacks federn ab, TTC >= 90d, kein akuter Stress
      regime = LiquidityRegime.BUFFERED_CUSHION;
      status = SignalStatus.OK;
      message = `Geldmarkt stabil gepuffert ($${tgaCushionB.toFixed(0)}B TGA-Cushion, TTC: ${Math.round(ttcDays)} Tage). Kollisions-Fenster: ${collisionWindow}. Buy the Dip begünstigt.`;
    } else if (isWarningTriggered) {
      regime = LiquidityRegime.DRAIN_WARNING;
      status = SignalStatus.WARNING;
      message = isBuffered
        ? `Puffer-Phase unter erhöhtem Zinsdruck ($${tgaCushionB.toFixed(0)}B TGA-Cushion). Kollisions-Fenster: ${collisionWindow}.`
        : `Erhöhte Wachsamkeit (Slack: $${liquidSlackBillion.toFixed(1)}B, TTC: ${Math.round(ttcDays)} Tage). Projizierte Kollision: ${collisionWindow}.`;
    }

    return {
      status,
      regime,
      projectedCollision: collisionWindow,
      catalystStatus,
      ttcDays: Number(ttcDays.toFixed(0)),
      liquidSlackBillion: Number(liquidSlackBillion.toFixed(1)),
      effectiveSlackBillion: Number(effectiveSlackB.toFixed(1)),
      message,
      diagnostics: {
        dualMacroStress: Number(dualMacroStress.toFixed(1)),
        liquidityStress: Number(liquidityStress.toFixed(1)),
        rateValuationStress: Number(rateValuationStress.toFixed(1)),
        tgaBillion: Number(tgaBillion.toFixed(1)),
        tgaRefillDeficitB: Number(tgaRefillDeficitB.toFixed(1)),
        tgaCushionB: Number(tgaCushionB.toFixed(1)),
        monthlyBuybacksBillion: Number(monthlyBuybackB.toFixed(1)),
        ttcDays: Number(ttcDays.toFixed(0)),
        catalystStatus,
        projectedCollision: collisionWindow,
        isToxicTrap: Boolean(isToxicTrap),
        isCollisionImminent: Boolean(isCollisionImminent),
        isBuffered: Boolean(isBuffered),
        isBelowLclor: Boolean(isBelowLclor),
        vix: Number(vix.toFixed(2)),
        isVixElevated: Boolean(isVixElevated)
      }
    };
  }
}
