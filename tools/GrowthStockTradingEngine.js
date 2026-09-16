import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * GrowthStockTradingEngine.js
 * 
 * Umfassende Trading- & Radar-Engine für explosive Growth-Aktien (NVTS, IBRX, etc.).
 * 
 * Ausgabe:
 *  # Growth Trading
 *  ## Algorithmus Performance (Historische Trade-Chronologie & Phasen-Detektion)
 *  ## Gesamtdashboard Ist-Zustand Datum (Aktuelle Marktmetriken & Status)
 */
export async function runGrowthStockTradingEngine(targetSymbol = null) {
  const pool = mysql.createPool(process.env.DATABASE_URL);

  try {
    const symbolsToScan = targetSymbol 
      ? [targetSymbol.toUpperCase()] 
      : ['IBRX', 'NVTS', 'PLTR'];

    console.log(`\n# Growth Trading\n`);

    // =========================================================================
    // ABSCHNITT 1: ALGORITHMUS PERFORMANCE & PHASEN-DETEKTION
    // =========================================================================
    console.log(`## Algorithmus Performance\n`);

    const allStockTrades = [];

    for (const symbol of symbolsToScan) {
      const [candles] = await pool.query(`
        SELECT 
          record_time,
          DATE_FORMAT(record_time, '%Y-%m-%d') as date_str,
          DATE_FORMAT(record_time, '%H:%i') as time_str,
          open, high, low, close, volume
        FROM market_data_m5
        WHERE symbol = ?
        ORDER BY record_time ASC
      `, [symbol]);

      if (!candles || candles.length === 0) continue;

      // Group into days
      const daysMap = {};
      for (const c of candles) {
        const d = c.date_str;
        if (!daysMap[d]) daysMap[d] = [];
        daysMap[d].push({
          time: c.time_str,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume)
        });
      }

      const dayKeys = Object.keys(daysMap).sort();
      const dayStats = [];

      for (const d of dayKeys) {
        const dayCandles = daysMap[d];
        const dOpen = dayCandles[0].open;
        const dClose = dayCandles[dayCandles.length - 1].close;
        const dHigh = Math.max(...dayCandles.map(c => c.high));
        const dLow = Math.min(...dayCandles.map(c => c.low));
        const totalVol = dayCandles.reduce((acc, c) => acc + c.volume, 0);

        let cumVol = 0;
        let cumDollar = 0;
        for (const c of dayCandles) {
          const typ = (c.high + c.low + c.close) / 3;
          cumVol += c.volume;
          cumDollar += typ * c.volume;
        }
        const finalVwap = cumVol > 0 ? cumDollar / cumVol : (dHigh + dLow + dClose) / 3;
        const dRange = dHigh - dLow;
        const closeLoc = dRange > 0 ? (dClose - dLow) / dRange : 0.5;
        const upperWick = dRange > 0 ? (dHigh - Math.max(dOpen, dClose)) / dRange : 0;
        const closeVsVwap = ((dClose - finalVwap) / finalVwap) * 100;

        dayStats.push({
          date: d,
          open: dOpen,
          high: dHigh,
          low: dLow,
          close: dClose,
          volume: totalVol,
          vwap: finalVwap,
          closeLoc,
          upperWick,
          closeVsVwap
        });
      }

      let ema20 = dayStats[0].close;
      let ema50 = dayStats[0].close;
      const k20 = 2 / (20 + 1);
      const k50 = 2 / (50 + 1);

      for (let i = 0; i < dayStats.length; i++) {
        const d = dayStats[i];
        ema20 = (d.close * k20) + (ema20 * (1 - k20));
        ema50 = (d.close * k50) + (ema50 * (1 - k50));
        d.ema20 = ema20;
        d.ema50 = ema50;
        d.distEma20 = ((d.close - ema20) / ema20) * 100;
        d.distEma50 = ((d.close - ema50) / ema50) * 100;

        if (i >= 19) {
          const slice20 = dayStats.slice(i - 19, i + 1);
          d.sma20 = slice20.reduce((acc, x) => acc + x.close, 0) / 20;
          const mean = d.sma20;
          const variance = slice20.reduce((acc, x) => acc + Math.pow(x.close - mean, 2), 0) / 20;
          const std = Math.sqrt(variance);
          d.bbw = mean > 0 ? ((4 * std) / mean) * 100 : 0;
          d.avgVol20 = slice20.reduce((acc, x) => acc + x.volume, 0) / 20;

          let sumMfv = 0;
          let sumVol = 0;
          for (const dj of slice20) {
            const range = dj.high - dj.low;
            const mfm = range > 0 ? ((dj.close - dj.low) - (dj.high - dj.close)) / range : 0;
            sumMfv += (mfm * dj.volume);
            sumVol += dj.volume;
          }
          d.cmf20 = sumVol > 0 ? sumMfv / sumVol : 0;
        } else {
          d.sma20 = d.close;
          d.bbw = 0;
          d.avgVol20 = d.volume;
          d.cmf20 = 0;
        }

        if (i >= 10) {
          const slice10 = dayStats.slice(i - 10, i);
          d.high10d = Math.max(...slice10.map(x => x.high));
          d.low5d = Math.min(...dayStats.slice(i - 5, i).map(x => x.low));
        } else {
          d.high10d = d.high;
          d.low5d = d.low;
        }

        if (i >= 14) {
          let gains = 0;
          let losses = 0;
          for (let j = i - 13; j <= i; j++) {
            const change = dayStats[j].close - dayStats[j - 1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
          }
          const avgGain = gains / 14;
          const avgLoss = losses / 14;
          d.rsi14 = avgLoss === 0 ? 100 : (100 - (100 / (1 + (avgGain / avgLoss))));
        } else {
          d.rsi14 = 50;
        }
      }

      // Execute Algorithm Simulation
      let position = null;
      const trades = [];

      for (let i = 25; i < dayStats.length; i++) {
        const d = dayStats[i];
        const prev = dayStats[i - 1];

        if (!position) {
          // Bottom / Base Detection & Entry
          const isNotOverextended = (prev.distEma20 <= 25.0);
          const isSqueezedOrAccumulating = (prev.bbw <= 40.0 || prev.cmf20 >= 0.08);
          const isVolumeSpike = (d.volume >= 1.8 * prev.avgVol20) || d.volume >= 15000000;
          const isPriceBreakout = d.close > prev.high10d || (d.close > prev.close * 1.05);
          const isM5Quality = (d.closeVsVwap >= 0.5) && (d.closeLoc >= 0.60) && (d.upperWick <= 0.35);

          if (isNotOverextended && isSqueezedOrAccumulating && isVolumeSpike && isPriceBreakout && isM5Quality) {
            position = {
              symbol,
              buyDate: d.date,
              buyPrice: d.close,
              highestPrice: d.close,
              highestRsi: d.rsi14,
              highestDistEma20: d.distEma20
            };
          }
        } else {
          if (d.high > position.highestPrice) {
            position.highestPrice = d.high;
          }
          if (d.rsi14 > position.highestRsi) {
            position.highestRsi = d.rsi14;
          }
          if (d.distEma20 > position.highestDistEma20) {
            position.highestDistEma20 = d.distEma20;
          }

          const profitPct = ((d.close - position.buyPrice) / position.buyPrice) * 100;

          // Parabolic Hysterie & Climax Top Detection
          const isParabolic = (d.distEma20 >= 30.0) || (profitPct >= 30.0) || (d.rsi14 >= 85.0);
          const isM5TopReversal = (d.upperWick >= 0.45 && d.closeVsVwap <= -0.5) || (d.closeVsVwap <= -2.5 && d.closeLoc <= 0.35);

          // Trend-Break or Stop-Loss
          const isTrendBroken = (d.close < d.ema20 && profitPct > 8) || (d.close < prev.low5d && d.closeLoc <= 0.20);
          const isStopLoss = profitPct <= -8.0;

          let phaseStatus = 'RIDE_TREND';
          let sellReason = null;

          if (isParabolic && isM5TopReversal) {
            phaseStatus = '🚨 TOP_CLIMAX_EXIT';
            sellReason = `Parabolic Climax (Peak $${position.highestPrice.toFixed(2)}, Schluss unter VWAP)`;
          } else if (isTrendBroken) {
            phaseStatus = '📉 TREND_BREAK_EXIT';
            sellReason = `Trend-Bruch (Schluss unter 20er EMA)`;
          } else if (isStopLoss) {
            phaseStatus = '🛑 STOP_LOSS_EXIT';
            sellReason = `Stop-Loss (-8% Schutz)`;
          }

          if (sellReason) {
            trades.push({
              Symbol: symbol,
              Einstieg: position.buyDate,
              Kaufpreis: `$${position.buyPrice.toFixed(2)}`,
              Ausstieg: d.date,
              Verkaufspreis: `$${d.close.toFixed(2)}`,
              Peak: `$${position.highestPrice.toFixed(2)}`,
              MaxRSI: position.highestRsi.toFixed(0),
              MaxDistEMA: `+${position.highestDistEma20.toFixed(0)}%`,
              Rendite: `${profitPct > 0 ? '+' : ''}${profitPct.toFixed(1)}%`,
              Dauer: `${Math.round((new Date(d.date) - new Date(position.buyDate)) / (1000 * 60 * 60 * 24))}d`,
              ExitSignal: sellReason
            });
            position = null;
          }
        }
      }

      let capital = 10000;
      let winTrades = 0;
      for (const t of trades) {
        const pnl = parseFloat(t.Rendite.replace('%', '').replace('+', ''));
        capital = capital * (1 + (pnl / 100));
        if (pnl > 0) winTrades++;
      }
      const totalRet = ((capital - 10000) / 10000) * 100;
      const winRate = trades.length > 0 ? ((winTrades / trades.length) * 100).toFixed(0) : 0;

      console.log(`📌 ${symbol} — Performance-Überblick:`);
      console.log(`   Gesamtrendite: ${totalRet > 0 ? '+' : ''}${totalRet.toFixed(1)}% (Endkapital: $${capital.toFixed(0)} aus $10.000)`);
      console.log(`   Trades gesamt: ${trades.length} | Win-Rate: ${winRate}% (${winTrades} Gewinner / ${trades.length - winTrades} Verlierer)\n`);

      allStockTrades.push(...trades);
    }

    console.log(`--- Detaillierte Trade- & Phasen-Tabelle ---`);
    console.table(allStockTrades);

    // =========================================================================
    // ABSCHNITT 2: GESAMTDASHBOARD IST-ZUSTAND
    // =========================================================================
    let latestReportDate = '31.08.2026';
    const dashboardRows = [];

    for (const symbol of symbolsToScan) {
      const [dRows] = await pool.query(`
        SELECT 
          DATE_FORMAT(record_time, '%Y-%m-%d') as date,
          SUBSTRING_INDEX(GROUP_CONCAT(open ORDER BY record_time ASC), ',', 1) as open,
          MAX(high) as high,
          MIN(low) as low,
          SUBSTRING_INDEX(GROUP_CONCAT(close ORDER BY record_time DESC), ',', 1) as close,
          SUM(volume) as volume
        FROM market_data_m5
        WHERE symbol = ? AND record_time >= '2026-04-01'
        GROUP BY DATE_FORMAT(record_time, '%Y-%m-%d')
        ORDER BY date ASC
      `, [symbol]);

      if (dRows.length < 20) continue;

      const days = dRows.map(r => ({
        date: r.date,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume)
      }));

      let ema20 = days[0].close;
      let ema50 = days[0].close;
      const k20 = 2 / (20 + 1);
      const k50 = 2 / (50 + 1);

      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        ema20 = (d.close * k20) + (ema20 * (1 - k20));
        ema50 = (d.close * k50) + (ema50 * (1 - k50));
        d.ema20 = ema20;
        d.ema50 = ema50;
        d.distEma20 = ((d.close - ema20) / ema20) * 100;
        d.distEma50 = ((d.close - ema50) / ema50) * 100;

        if (i >= 19) {
          const slice20 = days.slice(i - 19, i + 1);
          d.sma20 = slice20.reduce((acc, x) => acc + x.close, 0) / 20;
          const mean = d.sma20;
          const variance = slice20.reduce((acc, x) => acc + Math.pow(x.close - mean, 2), 0) / 20;
          const std = Math.sqrt(variance);
          d.bbw = mean > 0 ? ((4 * std) / mean) * 100 : 0;
          d.avgVol20 = slice20.reduce((acc, x) => acc + x.volume, 0) / 20;

          let sumMfv = 0;
          let sumVol = 0;
          for (const dj of slice20) {
            const range = dj.high - dj.low;
            const mfm = range > 0 ? ((dj.close - dj.low) - (dj.high - dj.close)) / range : 0;
            sumMfv += (mfm * dj.volume);
            sumVol += dj.volume;
          }
          d.cmf20 = sumVol > 0 ? sumMfv / sumVol : 0;
        } else {
          d.sma20 = d.close;
          d.bbw = 0;
          d.avgVol20 = d.volume;
          d.cmf20 = 0;
        }

        if (i >= 10) {
          const slice10 = days.slice(i - 10, i);
          d.high10d = Math.max(...slice10.map(x => x.high));
        } else {
          d.high10d = d.high;
        }

        if (i >= 14) {
          let gains = 0;
          let losses = 0;
          for (let j = i - 13; j <= i; j++) {
            const change = days[j].close - days[j - 1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
          }
          const avgGain = gains / 14;
          const avgLoss = losses / 14;
          d.rsi14 = avgLoss === 0 ? 100 : (100 - (100 / (1 + (avgGain / avgLoss))));
        } else {
          d.rsi14 = 50;
        }
      }

      const latestDay = days[days.length - 1];
      const prevDay = days[days.length - 2];
      latestReportDate = latestDay.date;

      // RTH Candles
      const [rthCandles] = await pool.query(`
        SELECT 
          DATE_FORMAT(record_time, '%H:%i') as time_str,
          open, high, low, close, volume
        FROM market_data_m5
        WHERE symbol = ? 
          AND DATE(record_time) = ?
          AND DATE_FORMAT(record_time, '%H:%i') >= '13:30'
          AND DATE_FORMAT(record_time, '%H:%i') <= '20:00'
        ORDER BY record_time ASC
      `, [symbol, latestDay.date]);

      let rthVol = 0;
      let rthDollar = 0;
      let openVol = 0, openUpVol = 0, openDownVol = 0;
      let openStartPrice = 0, openEndPrice = 0;
      let closeVol = 0, closeUpVol = 0, closeDownVol = 0;
      let closeStartPrice = 0, closeEndPrice = 0;

      for (const c of rthCandles) {
        const v = Number(c.volume);
        const o = Number(c.open);
        const cl = Number(c.close);
        const typ = (Number(c.high) + Number(c.low) + cl) / 3;

        rthVol += v;
        rthDollar += typ * v;

        // Opening 1.5h: 13:30 - 15:00 UTC
        if (c.time_str >= '13:30' && c.time_str <= '15:00') {
          openVol += v;
          if (openStartPrice === 0) openStartPrice = o;
          openEndPrice = cl;
          if (cl >= o) openUpVol += v;
          else openDownVol += v;
        }

        // Power Hour 1.5h: 18:30 - 20:00 UTC
        if (c.time_str >= '18:30' && c.time_str <= '20:00') {
          closeVol += v;
          if (closeStartPrice === 0) closeStartPrice = o;
          closeEndPrice = cl;
          if (cl >= o) closeUpVol += v;
          else closeDownVol += v;
        }
      }

      const rthVwap = rthVol > 0 ? rthDollar / rthVol : latestDay.close;
      const closeVsVwap = ((latestDay.close - rthVwap) / rthVwap) * 100;
      const range = latestDay.high - latestDay.low;
      const closeLoc = range > 0 ? (latestDay.close - latestDay.low) / range : 0.5;
      const upperWick = range > 0 ? (latestDay.high - Math.max(latestDay.open, latestDay.close)) / range : 0;
      const openTrendPct = openStartPrice > 0 ? ((openEndPrice - openStartPrice) / openStartPrice) * 100 : 0;
      const closeTrendPct = closeStartPrice > 0 ? ((closeEndPrice - closeStartPrice) / closeStartPrice) * 100 : 0;

      // Status
      let status = '🌀 BASE_BUILDING';
      const isM5TopReversal = (upperWick >= 0.45 && closeVsVwap <= -0.5) || (closeVsVwap <= -2.5 && closeLoc <= 0.35);

      if (latestDay.distEma20 >= 45.0 && (isM5TopReversal || latestDay.rsi14 >= 85.0)) {
        status = '🚨 TOP_CLIMAX_ALERT';
      } else if (latestDay.distEma20 > 25.0) {
        status = '⚠️ EXTENDED_NO_CHASE';
      } else if (latestDay.close > prevDay.high10d && latestDay.volume > 15000000 && closeVsVwap > 0) {
        status = '🚀 BREAKOUT_ACTIVE';
      } else if (latestDay.bbw <= 20.0 && latestDay.cmf20 >= 0.08) {
        status = '🔥 READY_TO_FIRE';
      }

      dashboardRows.push({
        Symbol: symbol,
        Kurs: `$${latestDay.close.toFixed(2)}`,
        Status: status,
        BBW: `${latestDay.bbw.toFixed(1)}%`,
        CMF: `${latestDay.cmf20 > 0 ? '+' : ''}${latestDay.cmf20.toFixed(2)}`,
        DistEMA20: `${latestDay.distEma20 > 0 ? '+' : ''}${latestDay.distEma20.toFixed(1)}%`,
        DistEMA50: `${latestDay.distEma50 > 0 ? '+' : ''}${latestDay.distEma50.toFixed(1)}%`,
        RSI14: latestDay.rsi14.toFixed(1),
        VsVWAP: `${closeVsVwap > 0 ? '+' : ''}${closeVsVwap.toFixed(1)}%`,
        Erste1_5h: `${openTrendPct > 0 ? '+' : ''}${openTrendPct.toFixed(1)}% (${rthVol > 0 ? ((openVol/rthVol)*100).toFixed(0) : 0}%Vol)`,
        PowerHour: `${closeTrendPct > 0 ? '+' : ''}${closeTrendPct.toFixed(1)}% (${rthVol > 0 ? ((closeVol/rthVol)*100).toFixed(0) : 0}%Vol)`,
        CloseLoc: `${(closeLoc * 100).toFixed(0)}%`,
        Trigger10d: `$${prevDay.high10d.toFixed(2)}`
      });
    }

    console.log(`\n## Gesamtdashboard Ist-Zustand (${latestReportDate})\n`);
    console.table(dashboardRows);

  } catch (err) {
    console.error('Engine Error:', err);
  } finally {
    await pool.end();
  }
}

const argSymbol = process.argv[2];
runGrowthStockTradingEngine(argSymbol);
