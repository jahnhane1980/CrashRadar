import fs from 'fs';
import path from 'path';
import { RSI, MACD } from 'technicalindicators';
import { RegimeLabeler } from '../../analysis/RegimeLabeler.js';

export class DefaultFeatureBuilder {
  constructor(ticker, repo, config) {
    this.ticker = ticker;
    this.repo = repo;
    this.config = config;
    this.featuresToExtract = this._getFeatureList();
  }

  _getFeatureList() {
    if (this.config.tickers && this.config.tickers[this.ticker] && this.config.tickers[this.ticker].features) {
      return this.config.tickers[this.ticker].features;
    }
    return this.config.default.features;
  }

  async build() {
    console.log(`[FeatureBuilder] Erstelle Datensatz für ${this.ticker}...`);

    // 1. Raw-Daten holen (OHLCV)
    const rawData = await this.repo.getOhlcvForTicker(this.ticker, '2015-01-01');
    if (!rawData || rawData.length === 0) {
      throw new Error(`Keine OHLCV-Daten für ${this.ticker} gefunden!`);
    }
    console.log(`[FeatureBuilder] ${rawData.length} Rohdaten-Zeilen geladen.`);

    // 2. Formatieren und Labels generieren (Dow-Theory Ground Truth)
    // RegimeLabeler erwartet das Format: { date, assets: { [ticker]: close } }
    const labelerData = rawData.map(r => ({
      date: typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0],
      assets: { [this.ticker]: Number(r.close) }
    }));

    const labeler = new RegimeLabeler(labelerData, this.ticker);
    const labeledData = labeler.generateLabels();
    
    const labelsMap = {};
    for (const c of labeledData) {
      labelsMap[c.date] = c.label || 'UNKNOWN';
    }

    // Zurueck zu den Standard-Candles für technische Indikatoren
    const candles = rawData.map(r => ({
      date: typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0],
      close: Number(r.close),
      high: Number(r.high),
      low: Number(r.low),
      volume: Number(r.volume)
    }));

    // 3. Basis-Features berechnen (OBV, TR)
    let obv = 0;
    let prevClose = null;
    const baseFeatures = [];
    const closePrices = [];

    for (const c of candles) {
      const { date, close, volume, high, low } = c;
      closePrices.push(close);

      // OBV (On-Balance Volume)
      if (prevClose !== null) {
        if (close > prevClose) obv += volume;
        else if (close < prevClose) obv -= volume;
      }

      // True Range (TR)
      let tr = high - low;
      if (prevClose !== null) {
        tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      }

      baseFeatures.push({ date, close, volume, obv, tr });
      prevClose = close;
    }

    // 4. Externe Indikatoren berechnen (RSI, MACD)
    const rsiOutput = RSI.calculate({ values: closePrices, period: 14 });
    const macdOutput = MACD.calculate({ 
        values: closePrices, 
        fastPeriod: 12, 
        slowPeriod: 26, 
        signalPeriod: 9, 
        SimpleMAOscillator: false, 
        SimpleMASignal: false 
    });

    const rsiPadded = Array(closePrices.length - rsiOutput.length).fill(null).concat(rsiOutput);
    const macdPadded = Array(closePrices.length - macdOutput.length).fill(null).concat(macdOutput);

    // 5. Finales Dataset zusammenbauen
    const finalDataset = [];
    let daysBelowSma200 = 0;
    
    for (let i = 0; i < baseFeatures.length; i++) {
      const bf = baseFeatures[i];
      
      // ATR-14 (Average True Range)
      let atr = null;
      if (i >= 13) {
        let sum = 0;
        for (let j = i - 13; j <= i; j++) sum += baseFeatures[j].tr;
        atr = sum / 14;
      }

      const rsi = rsiPadded[i];
      const macd = macdPadded[i] ? macdPadded[i].histogram : null;
      const label = labelsMap[bf.date] || 'UNKNOWN';

      let distSma200 = null;
      let sma200Slope = null;
      if (i >= 199) {
        let sum = 0;
        for (let j = i - 199; j <= i; j++) sum += baseFeatures[j].close;
        const sma200 = sum / 200;
        distSma200 = (bf.close / sma200) - 1;

        if (bf.close < sma200) {
            daysBelowSma200++;
        } else {
            daysBelowSma200 = 0;
        }

        if (i >= 209) {
            let sum10 = 0;
            for (let j = i - 209; j <= i - 10; j++) sum10 += baseFeatures[j].close;
            const sma200_10 = sum10 / 200;
            sma200Slope = (sma200 / sma200_10) - 1;
        }
      }

      let volZScore = null;
      if (i >= 49) {
        let sumVol = 0;
        for (let j = i - 49; j <= i; j++) sumVol += baseFeatures[j].volume;
        const sma50Vol = sumVol / 50;
        
        let varianceSum = 0;
        for (let j = i - 49; j <= i; j++) {
            varianceSum += Math.pow(baseFeatures[j].volume - sma50Vol, 2);
        }
        const stdDev50Vol = Math.sqrt(varianceSum / 50);
        volZScore = stdDev50Vol === 0 ? 0 : (bf.volume - sma50Vol) / stdDev50Vol;
      }

      let dist52wHigh = null;
      let dist52wLow = null;
      if (i >= 251) {
        let maxHigh = -Infinity;
        let minLow = Infinity;
        for (let j = i - 251; j <= i; j++) {
            if (candles[j].high > maxHigh) maxHigh = candles[j].high;
            if (candles[j].low < minLow) minLow = candles[j].low;
        }
        dist52wHigh = (bf.close / maxHigh) - 1;
        dist52wLow = (bf.close / minLow) - 1;
      }

      let logReturnEma3 = null;
      if (i >= 1) {
         let logReturn = Math.log(bf.close / baseFeatures[i-1].close);
         if (i === 1) {
             baseFeatures[i].logReturnEma3 = logReturn;
             logReturnEma3 = logReturn;
         } else {
             // EMA3 = (LogReturn * 0.5) + (PreviousEMA3 * 0.5)
             logReturnEma3 = (logReturn * 0.5) + (baseFeatures[i-1].logReturnEma3 * 0.5);
             baseFeatures[i].logReturnEma3 = logReturnEma3;
         }
      }

      // Dynamisches Mapping auf Basis der Config
      const rowData = {
        Date: bf.date,
        Close: bf.close !== null ? bf.close.toFixed(2) : null,
        Volume: bf.volume !== null ? bf.volume.toFixed(2) : null,
        OBV: bf.obv !== null ? bf.obv.toFixed(2) : null,
        ATR_14: atr !== null ? atr.toFixed(2) : null,
        RSI_14: rsi !== null ? rsi.toFixed(2) : null,
        MACD_Hist: macd !== null && macd !== undefined ? macd.toFixed(2) : null,
        Dist_SMA200: distSma200 !== null ? distSma200.toFixed(4) : null,
        SMA200_Slope: sma200Slope !== null ? sma200Slope.toFixed(6) : null,
        Days_Below_SMA200: distSma200 !== null ? daysBelowSma200 : null,
        Volume_Z_Score: volZScore !== null ? volZScore.toFixed(4) : null,
        Dist_52W_High: dist52wHigh !== null ? dist52wHigh.toFixed(4) : null,
        Dist_52W_Low: dist52wLow !== null ? dist52wLow.toFixed(4) : null,
        Log_Return_EMA3: logReturnEma3 !== null ? logReturnEma3.toFixed(6) : null
      };

      // Check ob alle in der Config geforderten Features existieren (überspringt Warmup-Phase)
      let isValid = true;
      for (const feat of this.featuresToExtract) {
        if (rowData[feat] === null || rowData[feat] === undefined) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        const outRow = [rowData.Date];
        for (const feat of this.featuresToExtract) {
          outRow.push(rowData[feat]);
        }
        outRow.push(label); // Label immer ans Ende
        finalDataset.push(outRow.join(','));
      }
    }

    // 6. CSV abspeichern
    const version = (this.config.tickers && this.config.tickers[this.ticker] && this.config.tickers[this.ticker].version) || this.config.default.version;
    const snapshotDir = this.config.global.snapshotDir || 'data/ml/snapshots';
    const outPath = path.join(process.cwd(), snapshotDir, `${this.ticker.toLowerCase()}_${version}.csv`);
    
    const header = ["Date", ...this.featuresToExtract, "Label"].join(',');
    const body = finalDataset.length > 0 ? '\n' + finalDataset.join('\n') : '';
    fs.writeFileSync(outPath, header + body);

    console.log(`[FeatureBuilder] ✅ Datensatz für ${this.ticker} erfolgreich erstellt!`);
    console.log(`[FeatureBuilder] Exportiert nach: ${outPath} (${finalDataset.length} Datensätze)`);
    
    return outPath;
  }
}
