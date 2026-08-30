export class TreasuryCapacityRadarIndicator {
  constructor() {
    this.name = 'Treasury & Money Market Capacity Radar';
    this.category = 'EARLY_WARNING';
    this.THRESHOLDS = {
      CRITICAL: 75,
      WARNING: 55
    };
  }

  evaluate(timeline) {
    if (!timeline || timeline.length < 21) {
      return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 21 Tage)' };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const mg = currentDay.macroGroups;
    if (!mg || !mg.NetLiquidity || !mg.BankingHealth) {
      return { status: 'UNKNOWN', message: 'Makro-Daten fehlen' };
    }

    const wresbalRaw = mg.BankingHealth.BankReserves;
    const rrpRaw = mg.NetLiquidity.RRPONTSYD;
    if (wresbalRaw === undefined || wresbalRaw === null || rrpRaw === undefined || rrpRaw === null) {
      return { status: 'UNKNOWN', message: 'Bankreserven (WRESBAL) oder RRP fehlen' };
    }

    // 1. Basis-Größen einheitlich in Milliarden USD ($B)
    const gdpBillion = (mg.TreasuryCapacity?.GDP || 28000);
    const lclorBillion = gdpBillion * 0.105; // 10.5% des BIP

    // WRESBAL in FRED ist in Mio. USD -> normieren auf Mrd. USD
    const wresbalBillion = wresbalRaw > 100000 ? (wresbalRaw / 1000) : wresbalRaw;
    const rrpBillion = rrpRaw; // in Mrd. USD
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
    // Wenn TGA < 450 Mrd. -> Refill-Druck auf Zielwert von 750 Mrd. droht dem Markt!
    // Wenn TGA > 850 Mrd. -> Treasury sitzt auf Puffer-Cash und kann Liquidität federn.
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

    // Forward Refill-Druck: Wenn TGA leer ist und Refill bevorsteht (z.B. April 2025 Tax Day)
    const forwardRefillDailyB = tgaRefillDeficitB > 0 ? (tgaRefillDeficitB / 45) : 0;
    const effectiveDailyDrainB = Math.max(dailyNetDrainB, forwardRefillDailyB * 0.7);

    // Time-to-Collision (TTC)
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

    // Engine 1: Liquiditäts- & Refill-Stress
    const slackScore = Math.max(0, Math.min(100, (1 - (effectiveSlackB - 500) / 2000) * 100));
    const ttcScore = Math.max(0, Math.min(100, (1 - (ttcDays - 20) / 100) * 100));
    const refillPressureScore = Math.max(0, Math.min(100, (tgaRefillDeficitB / 400) * 100));
    const bankScore = Math.max(0, Math.min(100, ((usgsecZ + 1) / 3) * 100));

    const liquidityStress = 0.40 * slackScore + 0.30 * ttcScore + 0.15 * refillPressureScore + 0.15 * bankScore;

    // Engine 2: Zins- & Duration-Stress (60d Delta + Netto-Kupon-Last)
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

    // Reale Netto-Kupon-Intensität
    const totalIssued21 = sumBillsMio21 + sumCouponsMio21;
    const netCouponRatio = totalIssued21 > 0 ? (netCouponsB21 * 1000 / totalIssued21) : 0.2;
    const durationIntensityScore = Math.max(0, Math.min(100, ((netCouponRatio - 0.20) / 0.40) * 100));

    const rateShockPeak = Math.max(tpScore, realYieldScore, dffScore);
    const rateValuationStress = 0.60 * rateShockPeak + 0.40 * durationIntensityScore;

    // Dual-Engine Composite Stress
    const dualMacroStress = Math.max(liquidityStress, rateValuationStress);

    // 4. Katalysator & Projiziertes Kollisions-Fenster
    const monthlyBuybackB = sumBuybacksMio21 > 0 ? (sumBuybacksMio21 / 21) * 30 / 1000 : 11.0;
    const isBuffered = tgaCushionB > 50 && monthlyBuybackB >= 5.0;
    
    let catalystStatus = 'NORMAL';
    let collisionWindow = 'Kein akutes Kollisions-Fenster';

    if (tgaRefillDeficitB > 250 && netCouponRatio > 0.40) {
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

    // 5. Status-Entscheidung
    const isWarningTriggered = dualMacroStress >= this.THRESHOLDS.WARNING || (liquidSlackBillion < 50 && isBuffered);
    const finalScore = (liquidSlackBillion < 50 && isBuffered && dualMacroStress < 58) ? 58.5 : dualMacroStress;

    if (dualMacroStress >= this.THRESHOLDS.CRITICAL) {
      return {
        status: 'CRITICAL',
        value: `${finalScore.toFixed(1)}/100`,
        projectedCollision: collisionWindow,
        catalystStatus,
        message: `Roter Alarm! Slack: $${liquidSlackBillion.toFixed(1)}B, Zins-Stress: ${rateValuationStress.toFixed(0)}%. Kollision aktiv: ${collisionWindow}. Taktik: Aggressiver Risikoabbau / Exit bei High-Beta & Growth.`,
        details: {
          liquidSlackBillion: Number(liquidSlackBillion.toFixed(1)),
          effectiveSlackBillion: Number(effectiveSlackB.toFixed(1)),
          tgaBillion: Number(tgaBillion.toFixed(1)),
          tgaRefillDeficitB: Number(tgaRefillDeficitB.toFixed(1)),
          tgaCushionB: Number(tgaCushionB.toFixed(1)),
          netCouponsBillion: Number(netCouponsB21.toFixed(1)),
          monthlyBuybacksBillion: Number(monthlyBuybackB.toFixed(1)),
          ttcDays: Number(ttcDays.toFixed(0)),
          liquidityStress: Number(liquidityStress.toFixed(1)),
          rateValuationStress: Number(rateValuationStress.toFixed(1)),
          catalystStatus,
          projectedCollision: collisionWindow
        }
      };
    } else if (isWarningTriggered) {
      return {
        status: 'WARNING',
        value: `${finalScore.toFixed(1)}/100`,
        projectedCollision: collisionWindow,
        catalystStatus,
        message: isBuffered 
          ? `Puffer-Phase ($${tgaCushionB.toFixed(0)}B TGA-Cushion, $${monthlyBuybackB.toFixed(1)}B/Mo Buybacks). Melt-Up-Fenster aktiv (Mid/Small-Cap Hebel). Projizierte Kollision & Exit: ${collisionWindow}.`
          : `Erhöhte Wachsamkeit (Slack: $${liquidSlackBillion.toFixed(1)}B). Projizierte Kollision: ${collisionWindow}.`,
        details: {
          liquidSlackBillion: Number(liquidSlackBillion.toFixed(1)),
          effectiveSlackBillion: Number(effectiveSlackB.toFixed(1)),
          tgaBillion: Number(tgaBillion.toFixed(1)),
          tgaRefillDeficitB: Number(tgaRefillDeficitB.toFixed(1)),
          tgaCushionB: Number(tgaCushionB.toFixed(1)),
          netCouponsBillion: Number(netCouponsB21.toFixed(1)),
          monthlyBuybacksBillion: Number(monthlyBuybackB.toFixed(1)),
          ttcDays: Number(ttcDays.toFixed(0)),
          liquidityStress: Number(liquidityStress.toFixed(1)),
          rateValuationStress: Number(rateValuationStress.toFixed(1)),
          catalystStatus,
          projectedCollision: collisionWindow
        }
      };
    }

    return {
      status: 'OK',
      value: `${dualMacroStress.toFixed(1)}/100`,
      projectedCollision: collisionWindow,
      catalystStatus,
      message: `Puffer & Zinsumfeld entspannt (Slack: $${liquidSlackBillion.toFixed(0)}B).`,
      details: {
        liquidSlackBillion: Number(liquidSlackBillion.toFixed(1)),
        effectiveSlackBillion: Number(effectiveSlackB.toFixed(1)),
        ttcDays: Number(ttcDays.toFixed(0)),
        liquidityStress: Number(liquidityStress.toFixed(1)),
        rateValuationStress: Number(rateValuationStress.toFixed(1)),
        catalystStatus,
        projectedCollision: collisionWindow
      }
    };
  }
}
