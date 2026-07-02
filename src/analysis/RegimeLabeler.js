import fs from 'fs';
import path from 'path';

export const Regimes = Object.freeze({
  CYCLE_BOTTOM: 'CYCLE_BOTTOM',
  BULL_MARKET: 'BULL_MARKET',
  BULL_CORRECTION: 'BULL_CORRECTION',
  CYCLE_TOP: 'CYCLE_TOP',
  BEAR_MARKET: 'BEAR_MARKET',
  BEAR_RALLY: 'BEAR_RALLY',
  BASE: 'BASE',
  UNKNOWN: 'UNKNOWN'
});

export const Strategies = Object.freeze({
  ABSOLUTE_WINDOW: 'absolute_window',
  DRAWDOWN: 'drawdown'
});

export class RegimeLabeler {
  constructor(data, assetKey = 'BTC') {
    this.data = data;
    this.assetKey = assetKey;
    this.config = this._loadConfig();
    
    const assetConfig = this.config[assetKey] || this.config['DEFAULT'];
    
    if (typeof assetConfig === 'number') {
      this.strategy = Strategies.ABSOLUTE_WINDOW;
      this.baseCycleDays = assetConfig;
      this.threshold = 0.20;
    } else {
      this.strategy = assetConfig.strategy || Strategies.ABSOLUTE_WINDOW;
      this.baseCycleDays = assetConfig.windowDays || 1460;
      this.threshold = assetConfig.threshold || 0.20;
    }
  }

  _loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'Cycle-Base-Config.json');
      if (fs.existsSync(configPath)) {
         return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.warn("Konnte Cycle-Base-Config.json nicht laden, nutze Defaults.", e);
    }
    return { 
        BTC: { strategy: Strategies.ABSOLUTE_WINDOW, windowDays: 1460 },
        QQQ: { strategy: Strategies.DRAWDOWN, threshold: 0.20 },
        SPY: { strategy: Strategies.DRAWDOWN, threshold: 0.20 },
        TLT: { strategy: Strategies.ABSOLUTE_WINDOW, windowDays: 2920 },
        DEFAULT: { strategy: Strategies.ABSOLUTE_WINDOW, windowDays: 1460 }
    };
  }

  generateLabels() {
    const metrics = this._calculateMetrics();
    let labels;
    
    if (this.strategy === Strategies.DRAWDOWN) {
        labels = this._identifyDrawdownExtremes(metrics, this.threshold);
    } else {
        // Pass 1: Finde Zyklen mit der Start-Annahme aus der Config
        let extremes = this._identifyMacroExtremes(metrics, this.baseCycleDays);
        
        // Messe den tatsächlichen Abstand zwischen den Zyklen
        this.measuredWindow = this._measureCycleLength(extremes, this.baseCycleDays);
        
        // Pass 2: Finde die perfekten Tops/Bottoms mit dem exakt gemessenen Fenster
        labels = this._identifyMacroExtremes(metrics, this.measuredWindow);
    }
    
    // Pass 3: Dow-Theorie (Swing Highs/Lows) für die Zwischenphasen
    this._fillDowTheoryRegimes(labels, metrics);
    
    return labels;
  }

  _calculateMetrics() {
    const metrics = [];
    let prevClose = null;
    const absChanges = [];
    const closes = [];

    for (let i = 0; i < this.data.length; i++) {
      const row = this.data[i];
      const close = row.assets[this.assetKey];
      
      let absChange = 0;
      if (prevClose !== null && close !== null) {
        absChange = Math.abs(close - prevClose);
      }
      if (prevClose !== null) absChanges.push(absChange);
      if (close !== null) closes.push(close);
      
      prevClose = close !== null ? close : prevClose;

      // SMA 50
      let sma50 = null;
      if (closes.length >= 50) {
        let sum = 0;
        for (let j = closes.length - 50; j < closes.length; j++) sum += closes[j];
        sma50 = sum / 50;
      }

      // Pseudo-ATR (Volatilität über 14 Tage)
      let pseudoAtr = null;
      if (absChanges.length >= 14) {
        let sum = 0;
        for (let j = absChanges.length - 14; j < absChanges.length; j++) sum += absChanges[j];
        pseudoAtr = sum / 14;
      }

      metrics.push({
        date: row.date,
        close: close,
        sma50: sma50,
        atr: pseudoAtr
      });
    }
    return metrics;
  }

  _identifyMacroExtremes(metrics, windowRows) {
    const labels = metrics.map(m => ({ date: m.date, close: m.close, label: null }));
    const w = Math.floor(windowRows / 2);

    for (let i = w; i < metrics.length - w; i++) {
      if (metrics[i].close === null) continue;
      
      let isTop = true;
      let isBottom = true;
      const currentClose = metrics[i].close;

      for (let j = i - w; j <= i + w; j++) {
        if (i === j || metrics[j].close === null) continue;
        if (metrics[j].close > currentClose) isTop = false;
        if (metrics[j].close < currentClose) isBottom = false;
      }

      if (isTop) {
        for (let j = Math.max(0, i - 3); j <= Math.min(metrics.length - 1, i + 3); j++) {
          labels[j].label = Regimes.CYCLE_TOP;
        }
      } else if (isBottom) {
        for (let j = Math.max(0, i - 3); j <= Math.min(metrics.length - 1, i + 3); j++) {
          labels[j].label = Regimes.CYCLE_BOTTOM;
        }
      }
    }
    return labels;
  }

  _identifyDrawdownExtremes(metrics, threshold) {
    const labels = metrics.map(m => ({ date: m.date, close: m.close, label: null }));
    
    let isSeekingTop = true;
    let extremeValue = null;
    let extremeIndex = -1;
    
    for (let i = 0; i < metrics.length; i++) {
        const m = metrics[i];
        if (m.close === null) continue;
        
        if (extremeValue === null) {
            extremeValue = m.close;
            extremeIndex = i;
        }

        if (isSeekingTop) {
            if (m.close > extremeValue) {
                extremeValue = m.close;
                extremeIndex = i;
            } else if (m.close <= extremeValue * (1 - threshold)) {
                // Drop von X% -> Top gefunden
                for (let j = Math.max(0, extremeIndex - 3); j <= Math.min(metrics.length - 1, extremeIndex + 3); j++) {
                    labels[j].label = Regimes.CYCLE_TOP;
                }
                isSeekingTop = false;
                extremeValue = m.close;
                extremeIndex = i;
            }
        } else {
            if (m.close < extremeValue) {
                extremeValue = m.close;
                extremeIndex = i;
            } else if (m.close >= extremeValue * (1 + threshold)) {
                // Rally von X% -> Bottom gefunden
                for (let j = Math.max(0, extremeIndex - 3); j <= Math.min(metrics.length - 1, extremeIndex + 3); j++) {
                    labels[j].label = Regimes.CYCLE_BOTTOM;
                }
                isSeekingTop = true;
                extremeValue = m.close;
                extremeIndex = i;
            }
        }
    }
    return labels;
  }

  _measureCycleLength(labels, baseDays) {
    let bottomIndices = [];
    for(let i=0; i<labels.length; i++) {
       if(labels[i].label === Regimes.CYCLE_BOTTOM) {
          if(bottomIndices.length === 0 || i - bottomIndices[bottomIndices.length-1] > 10) {
              bottomIndices.push(i);
          }
       }
    }
    
    let topIndices = [];
    for(let i=0; i<labels.length; i++) {
       if(labels[i].label === Regimes.CYCLE_TOP) {
          if(topIndices.length === 0 || i - topIndices[topIndices.length-1] > 10) {
              topIndices.push(i);
          }
       }
    }

    let distances = [];
    for(let i=1; i<bottomIndices.length; i++) distances.push(bottomIndices[i] - bottomIndices[i-1]);
    for(let i=1; i<topIndices.length; i++) distances.push(topIndices[i] - topIndices[i-1]);

    if(distances.length === 0) return baseDays;
    
    const avgDist = distances.reduce((a,b)=>a+b, 0) / distances.length;
    return Math.floor(avgDist * 1.05); // 5% Sicherheitszuschlag
  }

  _fillDowTheoryRegimes(labels, metrics) {
    let currentState = Regimes.UNKNOWN;
    let lastSwingHigh = null;
    let lastSwingLow = null;
    let isSeekingHigh = true;
    let currentExtr = null;
    
    for (let i = 0; i < labels.length; i++) {
      const m = metrics[i];
      if (m.close === null || m.sma50 === null || m.atr === null) {
        labels[i].label = Regimes.UNKNOWN;
        continue;
      }
      
      const close = m.close;
      const atr = m.atr;
      
      // Mindestens 5% Bewegung für einen gültigen Makro-Swing (verhindert Rauschen bei SPY/QQQ)
      const minSwing = Math.max(close * 0.05, 3 * atr);
      
      // ZigZag Logik (Swing Erkennung)
      if (currentExtr === null) currentExtr = close;
      
      if (isSeekingHigh) {
         if (close > currentExtr) {
            currentExtr = close; 
         } else if (close < currentExtr - minSwing) {
            lastSwingHigh = currentExtr; // Neues Swing High gelockt
            isSeekingHigh = false;
            currentExtr = close; 
         }
      } else {
         if (close < currentExtr) {
            currentExtr = close; 
         } else if (close > currentExtr + minSwing) {
            lastSwingLow = currentExtr; // Neues Swing Low gelockt
            isSeekingHigh = true;
            currentExtr = close; 
         }
      }
      
      // Harte Makro-Labels beibehalten
      if (labels[i].label === Regimes.CYCLE_TOP || labels[i].label === Regimes.CYCLE_BOTTOM) {
        currentState = labels[i].label;
        continue;
      }

      if (currentState === Regimes.UNKNOWN) {
        currentState = close > m.sma50 ? Regimes.BULL_MARKET : Regimes.BEAR_MARKET;
      }

      // Dow-Theorie State Machine
      if (lastSwingHigh !== null && lastSwingLow !== null) {
          switch (currentState) {
            case Regimes.BULL_MARKET:
            case Regimes.CYCLE_BOTTOM:
              if (close < lastSwingLow) {
                 currentState = Regimes.BEAR_MARKET; // Struktur gebrochen -> LL
              } else if (close < m.sma50) {
                 currentState = Regimes.BULL_CORRECTION; // Pullback, aber HL intakt
              } else {
                 currentState = Regimes.BULL_MARKET; // Trend intakt
              }
              break;
              
            case Regimes.BULL_CORRECTION:
              if (close > lastSwingHigh) {
                 currentState = Regimes.BULL_MARKET; // Neues HH bestätigt
              } else if (close < lastSwingLow) {
                 currentState = Regimes.BEAR_MARKET; // Support bricht -> Bear Market
              } else if (close > m.sma50) {
                 currentState = Regimes.BULL_MARKET; // Schnelle Erholung
              }
              break;
              
            case Regimes.BEAR_MARKET:
            case Regimes.CYCLE_TOP:
              if (close > lastSwingHigh) {
                 currentState = Regimes.BULL_MARKET; // Struktur gebrochen -> HH
              } else if (close > m.sma50) {
                 currentState = Regimes.BEAR_RALLY; // Erholung, aber LH intakt
              } else {
                 currentState = Regimes.BEAR_MARKET; // Trend intakt
              }
              break;
              
            case Regimes.BEAR_RALLY:
              if (close < lastSwingLow) {
                 currentState = Regimes.BEAR_MARKET; // Neues LL bestätigt
              } else if (close > lastSwingHigh) {
                 currentState = Regimes.BULL_MARKET; // Widerstand bricht -> Bull Market
              } else if (close < m.sma50) {
                 currentState = Regimes.BASE; // Konsolidierung über dem letzten Tief -> Accumulation Base
              }
              break;
              
            case Regimes.BASE:
              if (close > lastSwingHigh) {
                 currentState = Regimes.BULL_MARKET; // Breakout aus der Base nach oben
              } else if (close < lastSwingLow) {
                 currentState = Regimes.BEAR_MARKET; // Base bricht nach unten -> Downtrend geht weiter
              }
              break;
          }
      } else {
         // Fallback bevor erste Swings erkannt wurden
         if (close > m.sma50) currentState = Regimes.BULL_MARKET;
         else currentState = Regimes.BEAR_MARKET;
      }

      labels[i].label = currentState;
    }
  }
}
