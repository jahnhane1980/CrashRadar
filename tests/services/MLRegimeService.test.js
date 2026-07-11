import { describe, it, expect, beforeEach, afterEach, vi as jest } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { MLRegimeService } from '../../src/services/MLRegimeService.js';
import fs from 'fs/promises';
import fsSync from 'fs';

describe('MLRegimeService', () => {
  let service;

  beforeEach(() => {
    service = new MLRegimeService('btc_regime_v2');
    jest.clearAllMocks();
  });

  describe('getOneHot', () => {
    it('returns correct one-hot encoding for valid labels', () => {
      // ['CYCLE_BOTTOM', 'BULL_MARKET', 'BULL_CORRECTION', 'CYCLE_TOP', 'BEAR_MARKET', 'BEAR_RALLY']
      expect(service.getOneHot('CYCLE_BOTTOM')).toEqual([1, 0, 0, 0, 0, 0]);
      expect(service.getOneHot('BULL_MARKET')).toEqual([0, 1, 0, 0, 0, 0]);
      expect(service.getOneHot('CYCLE_TOP')).toEqual([0, 0, 0, 1, 0, 0]);
    });

    it('returns all zeros for UNKNOWN label', () => {
      expect(service.getOneHot('UNKNOWN')).toEqual([0, 0, 0, 0, 0, 0]);
      expect(service.getOneHot(undefined)).toEqual([0, 0, 0, 0, 0, 0]);
    });
  });

  describe('buildFeatures', () => {
    it('builds 6 features correctly for sufficient candles', () => {
      const candles = [];
      for (let i = 0; i < 50; i++) {
        candles.push({ date: `2020-01-${i+1}`, close: 100 + i, volume: 100, high: 102+i, low: 98+i, label: 'BULL_MARKET' });
      }
      const features = service.buildFeatures(candles);
      expect(features.length).toBe(50);
      // It should calculate OBV
      expect(features[1].OBV).toBeDefined();
      expect(features[49].label).toBe('BULL_MARKET');
      expect(features[49].RSI_14).toBeDefined();
      expect(features[49].MACD_Hist).toBeDefined();
      expect(features[49].ATR_14).toBeDefined();
    });

    it('handles early indexes without crashing (warmup period fallback)', () => {
      const candles = [
        { date: '2020-01-01', close: 100, volume: 100, high: 105, low: 95 },
        { date: '2020-01-02', close: 105, volume: 100, high: 110, low: 100 }
      ];
      const features = service.buildFeatures(candles);
      expect(features[0].RSI_14).toBe(50); // Fallback before 14 days
      expect(features[0].MACD_Hist).toBe(0); // Fallback before 25 days
      expect(features[0].ATR_14).toBeDefined();
      expect(features[0].OBV).toBe(0); // Erster Tag startet bei 0
    });

    it('handles undefined labels by assigning UNKNOWN', () => {
      const candles = [{ date: '2020-01-01', close: 100, volume: 10, high: 105, low: 95 }];
      const features = service.buildFeatures(candles);
      expect(features[0].label).toBe('UNKNOWN');
    });

    it('calculates long-term features (SMA200, 52W High/Low) correctly with chaos data', () => {
      const candles = [];
      let basePrice = 1000;
      for (let i = 0; i < 260; i++) {
        // Sinus-Welle mit starkem Rauschen
        const sine = Math.sin(i / 15.9) * 200;
        const noise = (Math.random() - 0.5) * 40;
        
        // Gaps (extreme Preis-Schocks einbauen)
        if (i === 150) basePrice -= 300; // Harter Crash
        if (i === 220) basePrice += 200; // Harter Pump
        
        let close = basePrice + sine + noise;
        let high = close + Math.random() * 20 + 5; 
        let low = close - Math.random() * 20 - 5;  
        let volume = 1000 + Math.random() * 500;
        
        // Volume Climax
        if (i === 100) volume *= 15;

        candles.push({
          date: `2020-01-${i+1}`,
          close: close,
          high: high,
          low: low,
          volume: volume,
          label: 'BULL_MARKET'
        });
      }

      const features = service.buildFeatures(candles);
      
      const f = features[259];
      expect(f.Dist_SMA200).toBeDefined();
      expect(f.SMA200_Slope).toBeDefined();
      expect(f.Dist_52W_High).toBeDefined();
      expect(f.Dist_52W_Low).toBeDefined();
      expect(typeof f.Days_Below_SMA200).toBe('number');
      
      // Logik-Prüfungen
      expect(f.Dist_52W_High <= 0).toBe(true); // Preis kann nie höher als das Max-High sein
      expect(f.Dist_52W_Low >= 0).toBe(true);  // Preis kann nie tiefer als das Min-Low sein
    });

    it('handles Zero-Variance Edge-Cases (Volume Z-Score DivByZero)', () => {
      const candles = [];
      for (let i = 0; i < 60; i++) {
        // Konstantes Volumen über 60 Tage erzwingt Standardabweichung = 0
        candles.push({ date: `2020-01-${i+1}`, close: 100, volume: 1000, high: 105, low: 95 }); 
      }
      const features = service.buildFeatures(candles);
      
      // Volume_Z_Score muss 0 sein, da StdDev = 0 abgefangen wird
      expect(features[59].Volume_Z_Score).toBe(0);
    });
  });

  describe('loadModel', () => {
    it('returns early if model is already loaded', async () => {
      service.model = {};
      const spyReadFile = jest.spyOn(fs, 'readFile');
      await service.loadModel();
      expect(spyReadFile).not.toHaveBeenCalled();
      spyReadFile.mockRestore();
    });

    it('loads stats and executes model building, avoiding tfjs timeout', async () => {
      const mockStats = { Close: { mean: 0, std: 1 }, Volume: { mean: 0, std: 1 }, OBV: { mean: 0, std: 1 }, ATR_14: { mean: 0, std: 1 }, RSI_14: { mean: 0, std: 1 }, MACD_Hist: { mean: 0, std: 1 } };
      
      const spyReadFile = jest.spyOn(fs, 'readFile').mockImplementation((path) => {
        if (path.includes('stats.json')) return Promise.resolve(JSON.stringify(mockStats));
        if (path.includes('weights.json')) return Promise.reject(new Error('Simulate weights failure'));
        return Promise.resolve('{}');
      });

      try { await service.loadModel(); } catch (e) { /* ignore */ }
      
      expect(service.stats).toEqual(mockStats);
      spyReadFile.mockRestore();
    });

    it('throws error if reading files fails', async () => {
      const spyReadFile = jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File missing'));
      await expect(service.loadModel()).rejects.toThrow('File missing');
      spyReadFile.mockRestore();
    });

    it('successfully loads model and sets weights (6 classes)', async () => {
      const mockStats = { Close: {}, Volume: {}, OBV: {}, ATR_14: {}, RSI_14: {}, MACD_Hist: {} }; // 6 Features
      
      const makeArray = (shape) => {
        if (shape.length === 1) return Array(shape[0]).fill(0);
        if (shape.length === 2) return Array(shape[0]).fill(0).map(() => Array(shape[1]).fill(0));
      };

      const mockWeights = [
        makeArray([6, 256]),  // lstm kernel
        makeArray([64, 256]), // lstm rec_kernel
        makeArray([256]),     // lstm bias
        makeArray([64, 32]),  // dense1 kernel
        makeArray([32]),      // dense1 bias
        makeArray([32, 6]),   // dense2 kernel
        makeArray([6])        // dense2 bias
      ];
      
      const spyReadFile = jest.spyOn(fs, 'readFile').mockImplementation((path) => {
        if (path.includes('stats.json')) return Promise.resolve(JSON.stringify(mockStats));
        if (path.includes('weights.json')) return Promise.resolve(JSON.stringify(mockWeights));
        return Promise.resolve('{}');
      });

      await service.loadModel();
      expect(service.labels.length).toBe(6);
      expect(service.model).toBeDefined();

      spyReadFile.mockRestore();
    }, 30000);

    it('successfully loads model and sets weights (7 classes)', async () => {
      const mockStats = { Close: {}, Volume: {}, OBV: {}, ATR_14: {}, RSI_14: {}, MACD_Hist: {} }; // 6 Features
      
      const makeArray = (shape) => {
        if (shape.length === 1) return Array(shape[0]).fill(0);
        if (shape.length === 2) return Array(shape[0]).fill(0).map(() => Array(shape[1]).fill(0));
      };

      const mockWeights = [
        makeArray([6, 256]),  // lstm kernel
        makeArray([64, 256]), // lstm rec_kernel
        makeArray([256]),     // lstm bias
        makeArray([64, 32]),  // dense1 kernel
        makeArray([32]),      // dense1 bias
        makeArray([32, 7]),   // dense2 kernel
        makeArray([7])        // dense2 bias
      ];
      
      const spyReadFile = jest.spyOn(fs, 'readFile').mockImplementation((path) => {
        if (path.includes('stats.json')) return Promise.resolve(JSON.stringify(mockStats));
        if (path.includes('weights.json')) return Promise.resolve(JSON.stringify(mockWeights));
        return Promise.resolve('{}');
      });

      await service.loadModel();
      expect(service.labels.length).toBe(7);
      expect(service.model).toBeDefined();

      spyReadFile.mockRestore();
    }, 60000);
  });

  describe('normalize', () => {
    it('builds stats and normalizes when buildStats is true', () => {
      const features = [
        { Close: 100, Volume: 10, OBV: 10, ATR_14: 5, RSI_14: 60, MACD_Hist: 1 },
        { Close: 110, Volume: 20, OBV: 30, ATR_14: 6, RSI_14: 70, MACD_Hist: 2 }
      ];
      const normalized = service.normalize(features, true);
      expect(service.stats).toBeDefined();
      expect(service.stats.Close.mean).toBeCloseTo(105);
      expect(normalized.length).toBe(2);
      expect(normalized[0].length).toBe(6); // 6 Features!
    });

    it('uses existing stats when buildStats is false', () => {
      service.stats = {
        Close: { mean: 100, std: 10 },
        Volume: { mean: 10, std: 1 },
        OBV: { mean: 10, std: 1 },
        ATR_14: { mean: 5, std: 1 },
        RSI_14: { mean: 50, std: 10 },
        MACD_Hist: { mean: 0, std: 1 }
      };
      const features = [{ Close: 110, Volume: 11, OBV: 11, ATR_14: 6, RSI_14: 60, MACD_Hist: 1 }];
      const normalized = service.normalize(features, false);
      expect(normalized[0][0]).toBeCloseTo(1); // (110 - 100) / 10 = 1
      expect(normalized[0][1]).toBeCloseTo(1);
    });

    it('handles zero standard deviation (prevent div by zero)', () => {
      const features = [
        { Close: 100, Volume: 10, OBV: 10, ATR_14: 5, RSI_14: 60, MACD_Hist: 1 },
        { Close: 100, Volume: 10, OBV: 10, ATR_14: 5, RSI_14: 60, MACD_Hist: 1 } // std will be 0
      ];
      const normalized = service.normalize(features, true);
      expect(normalized[0][0]).toBe(0); // falls back to division by 1 -> (100 - 100) / 1 = 0
    });

    it('returns empty array if stats are not loaded', () => {
      service.stats = null;
      expect(service.normalize([{ Close: 100 }], false)).toEqual([]);
    });

    it('handles undefined feature values by falling back to 0', () => {
      const features = [
        { Close: undefined, Volume: null, OBV: 'invalid', ATR_14: 5, RSI_14: 60, MACD_Hist: 1 },
        { Close: 110, Volume: 20, OBV: 30, ATR_14: 6, RSI_14: 70, MACD_Hist: 2 }
      ];
      const normalized = service.normalize(features, true);
      expect(service.stats.Close.mean).toBe(55); // (0 + 110) / 2
    });
  });

  describe('predict', () => {
    it('throws error if too few candles are provided', async () => {
      const candles = [{ date: '2020-01-01', close: 100, volume: 10, high: 105, low: 95 }];
      service.loadModel = jest.fn(); // Mock loadModel
      service.stats = {
        Close: { mean: 100, std: 10 }, Volume: { mean: 10, std: 1 }, OBV: { mean: 10, std: 1 },
        ATR_14: { mean: 5, std: 1 }, RSI_14: { mean: 50, std: 10 }, MACD_Hist: { mean: 0, std: 1 }
      };
      
      await expect(service.predict(candles)).rejects.toThrow(/Zu wenige Datenpunkte/);
    });

    it('returns predictions correctly', async () => {
      const candles = [];
      for (let i = 0; i < 20; i++) {
        candles.push({ date: `2020-01-${i+1}`, close: 100, volume: 10, high: 105, low: 95 });
      }
      
      service.loadModel = jest.fn();
      service.stats = {
        Close: { mean: 100, std: 10 }, Volume: { mean: 10, std: 1 }, OBV: { mean: 10, std: 1 },
        ATR_14: { mean: 5, std: 1 }, RSI_14: { mean: 50, std: 10 }, MACD_Hist: { mean: 0, std: 1 }
      };
      
      const mockPredict = jest.fn().mockReturnValue({
        data: async () => [0.1, 0.6, 0.1, 0.0, 0.1, 0.1]
      });
      service.model = { predict: mockPredict };

      const result = await service.predict(candles);
      
      expect(result.phase).toBe('BULL_MARKET');
      expect(result.confidence).toBe(0.6);
      expect(result.rawScores.CYCLE_BOTTOM).toBe(0.1);
      expect(mockPredict).toHaveBeenCalled();
    });
  });

  describe('retrain', () => {
    it('returns early with a warning instead of training V2 models', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await service.retrain([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[MLRegimeService] Retraining über Service'));
      consoleSpy.mockRestore();
    });

  });
});
