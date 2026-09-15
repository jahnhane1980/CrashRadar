import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * LiquidityCollisionSensor (Atomarer Leaf-Sensor)
 * 
 * Berechnet die physikalische Liquiditäts-Kollision (Time-to-Collision TTC)
 * im US-Geldmarkt & Staatsanleihen-System:
 * - Liquid Slack ($B) = RRP + Excess Reserves (WRESBAL über LCLOR 10.5% BIP)
 * - TGA-Refill-Defizit ($B) vs. TGA-Puffer
 * - Netto-Drain-Geschwindigkeit der letzten 21 Tage
 * - Time-to-Collision (TTC in Tagen bis zum Puffer-Kollaps)
 * - Erkennt 'IMMINENT_DRAIN', 'BUFFERED_CUSHION' und 'COLLISION_IMMINENT' (< 30 Tage)
 */
export class LiquidityCollisionSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.collisionThresholdDays = config.collisionThresholdDays ?? 30;
    this.tgaTargetBillion = config.tgaTargetBillion ?? 750;
    this.lclorGdpRatio = config.lclorGdpRatio ?? 0.105;
  }

  getId() {
    return 'LIQUIDITY_COLLISION_SENSOR';
  }

  getName() {
    return 'Geldmarkt Time-to-Collision (TTC) & Puffer-Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < 21) {
      return {
        status: SignalStatus.UNKNOWN,
        ttcDays: null,
        liquidSlackBillion: null,
        effectiveSlackBillion: null,
        tgaRefillDeficitB: null,
        tgaCushionB: null,
        isCollisionImminent: false,
        isBuffered: false,
        catalystStatus: 'UNKNOWN',
        collisionWindow: 'Zu wenig Daten (< 21 Tage)',
        message: 'Zu wenig Daten (< 21 Tage)'
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const mg = currentDay?.macroGroups;

    if (!mg || !mg.NetLiquidity || !mg.BankingHealth) {
      return {
        status: SignalStatus.UNKNOWN,
        ttcDays: null,
        liquidSlackBillion: null,
        effectiveSlackBillion: null,
        tgaRefillDeficitB: null,
        tgaCushionB: null,
        isCollisionImminent: false,
        isBuffered: false,
        catalystStatus: 'UNKNOWN',
        collisionWindow: 'Makro-Daten fehlen',
        message: 'Makro-Daten fehlen'
      };
    }

    const wresbalRaw = mg.BankingHealth.BankReserves;
    const rrpRaw = mg.NetLiquidity.RRPONTSYD;
    if (wresbalRaw === undefined || wresbalRaw === null || rrpRaw === undefined || rrpRaw === null) {
      return {
        status: SignalStatus.UNKNOWN,
        ttcDays: null,
        liquidSlackBillion: null,
        effectiveSlackBillion: null,
        tgaRefillDeficitB: null,
        tgaCushionB: null,
        isCollisionImminent: false,
        isBuffered: false,
        catalystStatus: 'UNKNOWN',
        collisionWindow: 'Bankreserven (WRESBAL) oder RRP fehlen',
        message: 'Bankreserven (WRESBAL) oder RRP fehlen'
      };
    }

    // 1. Basis-Größen in Milliarden USD ($B)
    const gdpBillion = (mg.TreasuryCapacity?.GDP || 28000);
    const lclorBillion = gdpBillion * this.lclorGdpRatio;

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
    const totalIssued21 = sumBillsMio21 + sumCouponsMio21;
    const netCouponRatio = totalIssued21 > 0 ? (netCouponsB21 * 1000 / totalIssued21) : 0.2;

    // 3. TGA-Puffer vs. TGA-Refill-Druck
    const tgaRefillDeficitB = Math.max(0, this.tgaTargetBillion - tgaBillion);
    const tgaCushionB = Math.max(0, tgaBillion - this.tgaTargetBillion);

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

    // Time-to-Collision (TTC)
    const effectiveSlackB = liquidSlackBillion + (tgaCushionB * 0.35);
    const ttcDays = (effectiveDailyDrainB > 0 && effectiveSlackB > 0)
      ? Math.min(365, effectiveSlackB / effectiveDailyDrainB)
      : (effectiveSlackB <= 0.5 ? 0 : 365);

    const monthlyBuybackB = buybacksB21 * (30 / 21);
    const isBuffered = tgaCushionB > 50 && monthlyBuybackB >= 5.0 && ttcDays >= 90;

    let catalystStatus = 'NORMAL';
    let collisionWindow = 'Kein akutes Kollisions-Fenster';

    // IMMINENT_DRAIN: Nur wenn Refill-Druck hoch UND Slack erschöpft oder knapp (< 500B)
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

    const isBelowLclor = wresbalBillion < lclorBillion;
    const isSevereLclorBreach = wresbalBillion < (gdpBillion * 0.08);
    const isCollisionImminent = !isBuffered && (
      (ttcDays !== null && ttcDays < this.collisionThresholdDays) ||
      (catalystStatus === 'IMMINENT_DRAIN' && effectiveSlackB < 300) ||
      isSevereLclorBreach
    );

    let status = SignalStatus.OK;
    let message = `Geldmarkt stabil (Slack: $${liquidSlackBillion.toFixed(1)}B, TTC: ${Math.round(ttcDays)}d)`;

    if (isCollisionImminent) {
      status = SignalStatus.CRITICAL;
      message = `Akute Geldmarkt-Kollision! TTC: ${Math.round(ttcDays)} Tage. Fenster: ${collisionWindow}.`;
    } else if (ttcDays < 90 || liquidSlackBillion < 100) {
      status = SignalStatus.WARNING;
      message = isBuffered
        ? `Puffer-Phase ($${tgaCushionB.toFixed(0)}B TGA-Cushion). Kollisions-Fenster: ${collisionWindow}.`
        : `Geldmarkt-Puffer schmilzt (Slack: $${liquidSlackBillion.toFixed(1)}B, TTC: ${Math.round(ttcDays)}d).`;
    }

    return {
      status,
      ttcDays: Number(ttcDays.toFixed(0)),
      liquidSlackBillion: Number(liquidSlackBillion.toFixed(1)),
      effectiveSlackBillion: Number(effectiveSlackB.toFixed(1)),
      tgaBillion: Number(tgaBillion.toFixed(1)),
      tgaRefillDeficitB: Number(tgaRefillDeficitB.toFixed(1)),
      tgaCushionB: Number(tgaCushionB.toFixed(1)),
      monthlyBuybacksBillion: Number(monthlyBuybackB.toFixed(1)),
      netCouponRatio: Number(netCouponRatio.toFixed(2)),
      isCollisionImminent,
      isBuffered,
      isBelowLclor,
      catalystStatus,
      collisionWindow,
      message
    };
  }
}
