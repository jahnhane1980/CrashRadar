import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * BlueChipAndEtfTrader.js
 * 
 * Handels- & Radar-Engine für Sektor- & Themen-ETFs sowie Blue-Chips (IGV, CIBR, SPY, QQQ).
 * 
 * Optimierte Architektur:
 *  - 1. Übergeordneter Wochen-MACD (12,26,9) & Trend-Regime (> 50 EMA)
 *  - 2. Relative Stärke (RS vs. SPY): Outperformance-Filter (> 20d-SMA)
 *  - 3. EMA20-Slope Filter: Nur Einstieg bei ansteigendem 20er EMA
 *  - 4. M5 Intraday-Mikrostruktur: Tages-VWAP, Eröffnungsphase (1.5h), Power Hour (1.5h), Close Location
 *  - 5. Trend-Runner Exit: Lässt starke Gewinner (> +10%) entlang des 20er EMA laufen
 * 
 * Ausgabe:
 *  # Blue-Chip & ETF Trading
 *  ## Algorithmus Performance (Historische Trade-Chronologie & Trendphasen)
 *  ## Gesamtdashboard Ist-Zustand Datum (Aktuelle Marktmetriken & Status)
 */
export async function runBlueChipAndEtfTrader(targetSymbol = null) {
  const pool = mysql.createPool(process.env.DATABASE_URL);

  try {
    const symbolsToScan = targetSymbol 
      ? [targetSymbol.toUpperCase()] 
      : ['IGV', 'CIBR'];

    console.log(`\n# Blue-Chip & ETF Trading\n`);

    // =========================================================================
    // LADE SPY TAGESDATEN FÜR RELATIVE STÄRKE (RS-FILTER)
    // =========================================================================
    const [spyRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(record_time, '%Y-%m-%d') as date,
        SUBSTRING_INDEX(GROUP_CONCAT(close ORDER BY record_time DESC), ',', 1) as close
      FROM market_data_m5
      WHERE symbol = 'SPY'
      GROUP BY DATE_FORMAT(record_time, '%Y-%m-%d')
      ORDER BY date ASC
    `);
    const spyMap = {};
    for (const r of spyRows) spyMap[r.date] = Number(r.close);

    // =========================================================================
    // ABSCHNITT 1: ALGORITHMUS PERFORMANCE & TRADE-CHRONOLOGIE
    // =========================================================================
    console.log(`## Algorithmus Performance\n`);

    const allEtfTrades = [];

    for (const symbol of symbolsToScan) {
      const [dailyRows] = await pool.query(`
        SELECT 
          DATE_FORMAT(record_time, '%Y-%m-%d') as date,
          SUBSTRING_INDEX(GROUP_CONCAT(open ORDER BY record_time ASC), ',', 1) as open,
          MAX(high) as high,
          MIN(low) as low,
          SUBSTRING_INDEX(GROUP_CONCAT(close ORDER BY record_time DESC), ',', 1) as close,
          SUM(volume) as volume
        FROM market_data_m5
        WHERE symbol = ?
        GROUP BY DATE_FORMAT(record_time, '%Y-%m-%d')
        ORDER BY date ASC
      `, [symbol]);

      if (!dailyRows || dailyRows.length < 25) {
        console.log(`Zu wenig Daten für ${symbol}.`);
        continue;
      }

      const days = dailyRows.map(r => ({
        date: r.date,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume),
        spyClose: spyMap[r.date] || null
      }));

      // Rolling Indicators (EMA12, EMA26, MACD 12/26/9, EMA20, EMA50, BBW, CMF, RSI14, RS vs SPY)
      let ema12 = days[0].close;
      let ema26 = days[0].close;
      let ema20 = days[0].close;
      let ema50 = days[0].close;
      const k12 = 2 / (12 + 1);
      const k26 = 2 / (26 + 1);
      const k20 = 2 / (20 + 1);
      const k50 = 2 / (50 + 1);
      const k9 = 2 / (9 + 1);
      let signalLine = 0;

      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        ema12 = (d.close * k12) + (ema12 * (1 - k12));
        ema26 = (d.close * k26) + (ema26 * (1 - k26));
        ema20 = (d.close * k20) + (ema20 * (1 - k20));
        ema50 = (d.close * k50) + (ema50 * (1 - k50));

        d.ema12 = ema12;
        d.ema26 = ema26;
        d.ema20 = ema20;
        d.ema50 = ema50;
        d.macdLine = ema12 - ema26;

        if (i === 0) signalLine = d.macdLine;
        else signalLine = (d.macdLine * k9) + (signalLine * (1 - k9));
        d.signalLine = signalLine;
        d.macdHist = d.macdLine - d.signalLine;

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

          // RS vs SPY
          const rsSlice = slice20.filter(x => x.spyClose > 0).map(x => (x.close / x.spyClose) * 100);
          d.rs = d.spyClose > 0 ? (d.close / d.spyClose) * 100 : 100;
          d.rsSma20 = rsSlice.length > 0 ? rsSlice.reduce((acc, x) => acc + x, 0) / rsSlice.length : d.rs;
          d.isRsBullish = d.rs >= d.rsSma20;
        } else {
          d.sma20 = d.close;
          d.bbw = 0;
          d.avgVol20 = d.volume;
          d.cmf20 = 0;
          d.rs = 100;
          d.rsSma20 = 100;
          d.isRsBullish = true;
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

      // Simulation mit Trend-Runner Exit & RS-Filter
      let position = null;
      const trades = [];

      for (let i = 25; i < days.length; i++) {
        const d = days[i];
        const prev = days[i - 1];
        const prev3 = days[i - 3];

        if (!position) {
          // Optimierte ETF Entry-Bedingungen:
          // 1. MACD Bullish Crossover oder 10d-Ausbruch
          // 2. Trend: Kurs >= 50er EMA
          // 3. EMA20-Slope: 20er EMA steigt an
          // 4. Relative Stärke: Sektor ist stärker als SPY (RS >= RS_SMA20)
          // 5. Nicht extrem überdehnt (DistEMA20 <= 10%)
          const isMacdCross = (d.macdHist > 0 && prev.macdHist <= 0) || (d.macdHist > 0 && d.close > prev.high10d);
          const isTrendBullish = d.close >= d.ema50;
          const isSqueezeOk = prev.bbw <= 15.0 || prev.cmf20 >= 0.05;
          const isSlopeOk = d.ema20 >= prev3.ema20;
          const isRsOk = d.isRsBullish;

          if (isMacdCross && isTrendBullish && isSqueezeOk && prev.distEma20 <= 10.0 && isSlopeOk && isRsOk) {
            position = {
              symbol,
              buyDate: d.date,
              buyPrice: d.close,
              highestPrice: d.close,
              highestProfitPct: 0
            };
          }
        } else {
          if (d.high > position.highestPrice) position.highestPrice = d.high;
          const curProfit = ((position.highestPrice - position.buyPrice) / position.buyPrice) * 100;
          if (curProfit > position.highestProfitPct) position.highestProfitPct = curProfit;

          const profitPct = ((d.close - position.buyPrice) / position.buyPrice) * 100;

          // Optimierte ETF Exit-Bedingungen (Trend-Runner):
          let isMacdBearish = false;
          if (position.highestProfitPct >= 10.0) {
            // Große Gewinner (>10%): Trend laufen lassen, Exit erst bei Bruch des 20er EMA oder starkem MACD-Knick (Hist < -0.50)
            isMacdBearish = (d.close < d.ema20) || (d.macdHist < -0.50);
          } else {
            // Normale Positionen: Standard MACD-Exit
            isMacdBearish = (d.macdHist < -0.20 && profitPct > 4.0);
          }

          const isTrendBroken = (d.close < d.ema20 && profitPct > 2.0) || (d.close < d.ema50);
          const isStopLoss = profitPct <= -5.5;

          let sellReason = null;
          if (isMacdBearish) {
            sellReason = `MACD Bearish / Trend-Ride (Hist ${d.macdHist.toFixed(2)})`;
          } else if (isTrendBroken) {
            sellReason = `Trend-Bruch (Schluss unter 20/50 EMA)`;
          } else if (isStopLoss) {
            sellReason = `Stop-Loss (-5.5% Schutz)`;
          }

          if (sellReason) {
            trades.push({
              Symbol: symbol,
              Einstieg: position.buyDate,
              Kaufpreis: `$${position.buyPrice.toFixed(2)}`,
              Ausstieg: d.date,
              Verkaufspreis: `$${d.close.toFixed(2)}`,
              Peak: `$${position.highestPrice.toFixed(2)}`,
              Rendite: `${profitPct > 0 ? '+' : ''}${profitPct.toFixed(1)}%`,
              Dauer: `${Math.round((new Date(d.date) - new Date(position.buyDate)) / (1000 * 60 * 60 * 24))}d`,
              ExitSignal: sellReason
            });
            position = null;
          }
        }
      }

      if (position) {
        const lastDay = days[days.length - 1];
        const profitPct = ((lastDay.close - position.buyPrice) / position.buyPrice) * 100;
        trades.push({
          Symbol: symbol,
          Einstieg: position.buyDate,
          Kaufpreis: `$${position.buyPrice.toFixed(2)}`,
          Ausstieg: lastDay.date,
          Verkaufspreis: `$${lastDay.close.toFixed(2)}`,
          Peak: `$${position.highestPrice.toFixed(2)}`,
          Rendite: `${profitPct > 0 ? '+' : ''}${profitPct.toFixed(1)}%`,
          Dauer: `${Math.round((new Date(lastDay.date) - new Date(position.buyDate)) / (1000 * 60 * 60 * 24))}d`,
          ExitSignal: 'Still Open (Investiert)'
        });
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

      console.log(`📌 ${symbol} — ETF Performance-Überblick:`);
      console.log(`   Gesamtrendite: ${totalRet > 0 ? '+' : ''}${totalRet.toFixed(1)}% (Endkapital: $${capital.toFixed(0)} aus $10.000)`);
      console.log(`   Trades gesamt: ${trades.length} | Win-Rate: ${winRate}% (${winTrades} Gewinner / ${trades.length - winTrades} Verlierer)\n`);

      allEtfTrades.push(...trades);
    }

    console.log(`--- Detaillierte ETF Trade-Tabelle ---`);
    console.table(allEtfTrades);

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
        WHERE symbol = ? AND record_time >= '2026-03-01'
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
        volume: Number(r.volume),
        spyClose: spyMap[r.date] || null
      }));

      let ema12 = days[0].close;
      let ema26 = days[0].close;
      let ema20 = days[0].close;
      let ema50 = days[0].close;
      const k12 = 2 / (12 + 1);
      const k26 = 2 / (26 + 1);
      const k20 = 2 / (20 + 1);
      const k50 = 2 / (50 + 1);
      const k9 = 2 / (9 + 1);
      let signalLine = 0;

      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        ema12 = (d.close * k12) + (ema12 * (1 - k12));
        ema26 = (d.close * k26) + (ema26 * (1 - k26));
        ema20 = (d.close * k20) + (ema20 * (1 - k20));
        ema50 = (d.close * k50) + (ema50 * (1 - k50));

        d.ema12 = ema12;
        d.ema26 = ema26;
        d.ema20 = ema20;
        d.ema50 = ema50;
        d.macdLine = ema12 - ema26;

        if (i === 0) signalLine = d.macdLine;
        else signalLine = (d.macdLine * k9) + (signalLine * (1 - k9));
        d.signalLine = signalLine;
        d.macdHist = d.macdLine - d.signalLine;

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

          // RS vs SPY
          const rsSlice = slice20.filter(x => x.spyClose > 0).map(x => (x.close / x.spyClose) * 100);
          d.rs = d.spyClose > 0 ? (d.close / d.spyClose) * 100 : 100;
          d.rsSma20 = rsSlice.length > 0 ? rsSlice.reduce((acc, x) => acc + x, 0) / rsSlice.length : d.rs;
          d.isRsBullish = d.rs >= d.rsSma20;
          d.rsDelta = ((d.rs - d.rsSma20) / d.rsSma20) * 100;
        } else {
          d.sma20 = d.close;
          d.bbw = 0;
          d.avgVol20 = d.volume;
          d.cmf20 = 0;
          d.rs = 100;
          d.rsSma20 = 100;
          d.isRsBullish = true;
          d.rsDelta = 0;
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

      // Weekly MACD Calculation
      const weeklyMap = {};
      for (const d of days) {
        const dateObj = new Date(d.date);
        const dayNr = (dateObj.getDay() + 6) % 7;
        dateObj.setDate(dateObj.getDate() - dayNr + 3);
        const firstThursday = dateObj.valueOf();
        dateObj.setMonth(0, 1);
        if (dateObj.getDay() !== 4) {
          dateObj.setMonth(0, 1 + ((4 - dateObj.getDay()) + 7) % 7);
        }
        const weekNr = 1 + Math.ceil((firstThursday - dateObj.valueOf()) / 604800000);
        const weekKey = `${dateObj.getFullYear()}-W${weekNr.toString().padStart(2, '0')}`;

        if (!weeklyMap[weekKey]) weeklyMap[weekKey] = [];
        weeklyMap[weekKey].push(d);
      }

      const weekKeys = Object.keys(weeklyMap).sort();
      const weeks = [];
      for (const wk of weekKeys) {
        const wDays = weeklyMap[wk];
        weeks.push({
          week: wk,
          open: wDays[0].open,
          high: Math.max(...wDays.map(x => x.high)),
          low: Math.min(...wDays.map(x => x.low)),
          close: wDays[wDays.length - 1].close,
          volume: wDays.reduce((acc, x) => acc + x.volume, 0)
        });
      }

      let wEma12 = weeks[0].close;
      let wEma26 = weeks[0].close;
      let wSignal = 0;
      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        wEma12 = (w.close * k12) + (wEma12 * (1 - k12));
        wEma26 = (w.close * k26) + (wEma26 * (1 - k26));
        w.macdLine = wEma12 - wEma26;
        if (i === 0) wSignal = w.macdLine;
        else wSignal = (w.macdLine * k9) + (wSignal * (1 - k9));
        w.signalLine = wSignal;
        w.macdHist = w.macdLine - w.signalLine;
      }

      const latestDay = days[days.length - 1];
      const latestWeek = weeks[weeks.length - 1];
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
      const openTrendPct = openStartPrice > 0 ? ((openEndPrice - openStartPrice) / openStartPrice) * 100 : 0;
      const closeTrendPct = closeStartPrice > 0 ? ((closeEndPrice - closeStartPrice) / closeStartPrice) * 100 : 0;

      // Status for ETF
      let status = '🌀 TREND_CONSOLIDATION';
      if (latestDay.macdHist > 0 && latestWeek.macdHist > 0 && latestDay.close > latestDay.ema20 && latestDay.isRsBullish) {
        status = '🚀 BULLISH_TREND_RIDE';
      } else if (latestDay.macdHist > 0 && latestDay.bbw <= 12.0) {
        status = '🔥 READY_TO_EXPAND';
      } else if (latestDay.macdHist < 0 && latestDay.close < latestDay.ema20) {
        status = '⚠️ BEARISH_MOMENTUM_DRAIN';
      }

      dashboardRows.push({
        Symbol: symbol,
        Kurs: `$${latestDay.close.toFixed(2)}`,
        Status: status,
        DailyMACD: `${latestDay.macdHist > 0 ? '+' : ''}${latestDay.macdHist.toFixed(2)} (${latestDay.macdHist > 0 ? '🟢 Bull' : '🔴 Bear'})`,
        WeeklyMACD: `${latestWeek.macdHist > 0 ? '+' : ''}${latestWeek.macdHist.toFixed(2)} (${latestWeek.macdHist > 0 ? '🟢 Bull' : '🔴 Bear'})`,
        RS_SPY: `${latestDay.rsDelta > 0 ? '+' : ''}${latestDay.rsDelta.toFixed(1)}% (${latestDay.isRsBullish ? '🟢 Outperform' : '🔴 Underperform'})`,
        BBW: `${latestDay.bbw.toFixed(1)}%`,
        CMF: `${latestDay.cmf20 > 0 ? '+' : ''}${latestDay.cmf20.toFixed(2)}`,
        DistEMA20: `${latestDay.distEma20 > 0 ? '+' : ''}${latestDay.distEma20.toFixed(1)}%`,
        DistEMA50: `${latestDay.distEma50 > 0 ? '+' : ''}${latestDay.distEma50.toFixed(1)}%`,
        RSI14: latestDay.rsi14.toFixed(1),
        VsVWAP: `${closeVsVwap > 0 ? '+' : ''}${closeVsVwap.toFixed(1)}%`,
        Erste1_5h: `${openTrendPct > 0 ? '+' : ''}${openTrendPct.toFixed(1)}%`,
        PowerHour: `${closeTrendPct > 0 ? '+' : ''}${closeTrendPct.toFixed(1)}%`,
        CloseLoc: `${(closeLoc * 100).toFixed(0)}%`
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
runBlueChipAndEtfTrader(argSymbol);
