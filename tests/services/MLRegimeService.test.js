import { describe, it, expect, beforeEach, afterEach, vi as jest } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { MLRegimeService } from '../../src/services/MLRegimeService.js';
import fs from 'fs/promises';
import fsSync from 'fs';

describe('MLRegimeService', () => {
  let service;

  beforeEach(() => {
    service = new MLRegimeService('test_model');
    jest.clearAllMocks();
  });

  describe('getOneHot', () => {
    it('returns correct one-hot encoding for valid labels', () => {
      expect(service.getOneHot('MACRO_TOP')).toEqual([1, 0, 0, 0]);
      expect(service.getOneHot('MACRO_BOTTOM')).toEqual([0, 1, 0, 0]);
      expect(service.getOneHot('UPTREND')).toEqual([0, 0, 1, 0]);
      expect(service.getOneHot('DOWNTREND')).toEqual([0, 0, 0, 1]);
    });

    it('returns all zeros for UNKNOWN label', () => {
      expect(service.getOneHot('UNKNOWN')).toEqual([0, 0, 0, 0]);
      expect(service.getOneHot(undefined)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('buildFeatures', () => {
    it('builds features correctly for sufficient candles', () => {
      const candles = [];
      for (let i = 0; i < 50; i++) {
        candles.push({ date: `2020-01-${i+1}`, close: 100 + i, label: 'UPTREND' });
      }
      const features = service.buildFeatures(candles);
      expect(features.length).toBe(50);
      expect(features[0].return_pct).toBe(0);
      expect(features[1].return_pct).toBeGreaterThan(0);
      expect(features[49].label).toBe('UPTREND');
      expect(features[49].rsi_14).toBeDefined();
      expect(features[49].macd_hist).toBeDefined();
    });

    it('handles undefined labels by assigning UNKNOWN', () => {
      const candles = [{ date: '2020-01-01', close: 100 }];
      const features = service.buildFeatures(candles);
      expect(features[0].label).toBe('UNKNOWN');
    });

    it('handles early indexes without crashing (warmup period)', () => {
      const candles = [
        { date: '2020-01-01', close: 100 },
        { date: '2020-01-02', close: 105 }
      ];
      const features = service.buildFeatures(candles);
      expect(features[0].rsi_14).toBe(50); // Fallback before 14 days
      expect(features[0].macd_hist).toBe(0); // Fallback before 25 days
    });
  });

  describe('normalize', () => {
    it('builds stats and normalizes when buildStats is true', () => {
      const features = [
        { return_pct: 0.1, rsi_14: 60, macd_hist: 1 },
        { return_pct: 0.2, rsi_14: 70, macd_hist: 2 }
      ];
      const normalized = service.normalize(features, true);
      expect(service.stats).toBeDefined();
      expect(service.stats.return_pct.mean).toBeCloseTo(0.15);
      expect(normalized.length).toBe(2);
      expect(normalized[0].length).toBe(3);
    });

    it('uses existing stats when buildStats is false', () => {
      service.stats = {
        return_pct: { mean: 0.1, std: 0.1 },
        rsi_14: { mean: 50, std: 10 },
        macd_hist: { mean: 0, std: 1 }
      };
      const features = [{ return_pct: 0.2, rsi_14: 60, macd_hist: 1 }];
      const normalized = service.normalize(features, false);
      expect(normalized[0][0]).toBeCloseTo(1); // (0.2 - 0.1) / 0.1 = 1
      expect(normalized[0][1]).toBeCloseTo(1); // (60 - 50) / 10 = 1
      expect(normalized[0][2]).toBeCloseTo(1); // (1 - 0) / 1 = 1
    });

    it('handles zero standard deviation (prevent div by zero)', () => {
      const features = [
        { return_pct: 0.1, rsi_14: 60, macd_hist: 1 },
        { return_pct: 0.1, rsi_14: 60, macd_hist: 1 } // std will be 0
      ];
      const normalized = service.normalize(features, true);
      expect(normalized[0][0]).toBe(0); // falls back to division by 1 -> (0.1 - 0.1) / 1 = 0
    });
  });

  describe('predict', () => {
    it('throws error if too few candles are provided', async () => {
      const candles = [{ date: '2020-01-01', close: 100 }];
      service.loadModel = jest.fn(); // Mock loadModel
      service.stats = {
        return_pct: { mean: 0, std: 1 },
        rsi_14: { mean: 50, std: 10 },
        macd_hist: { mean: 0, std: 1 }
      };
      
      await expect(service.predict(candles)).rejects.toThrow(/Zu wenige Datenpunkte/);
    });

    it('returns predictions correctly', async () => {
      const candles = [];
      for (let i = 0; i < 20; i++) {
        candles.push({ date: `2020-01-${i+1}`, close: 100 });
      }
      
      service.loadModel = jest.fn();
      service.stats = {
        return_pct: { mean: 0, std: 1 },
        rsi_14: { mean: 50, std: 10 },
        macd_hist: { mean: 0, std: 1 }
      };
      
      const mockPredict = jest.fn().mockReturnValue({
        data: async () => [0.1, 0.2, 0.6, 0.1]
      });
      service.model = { predict: mockPredict };

      const result = await service.predict(candles);
      
      expect(result.phase).toBe('UPTREND');
      expect(result.confidence).toBe(0.6);
      expect(result.rawScores.MACRO_TOP).toBe(0.1);
      expect(mockPredict).toHaveBeenCalled();
    });
  });

  describe('retrain', () => {
    it('trains and saves the model without errors for valid data', async () => {
      const candles = [];
      // Need > 35 candles to pass the warmup slice, and enough labeled data
      for (let i = 0; i < 60; i++) {
        candles.push({ date: `2020-01-${i+1}`, close: 100 + i, label: 'UPTREND' });
      }

      const mockFit = jest.fn().mockResolvedValue({});
      const mockGetWeights = jest.fn().mockReturnValue([{ arraySync: () => [0.1] }]);
      const mockCompile = jest.fn();
      const mockAdd = jest.fn();
      
      const mockSequentialModel = {
        add: mockAdd,
        compile: mockCompile,
        fit: mockFit,
        getWeights: mockGetWeights
      };

      // In Vitest ESM, we mock module exports via vi.mock or spy on default.
      // Since tfjs is a wildcard import, we mock the method by overwriting if possible or via a spy if supported. 
      // Actually, we can just spy on tf.sequential if we import it differently, 
      // but since it failed, let's redefine it if possible, or skip the test if it's too complex.
      // Wait, we can mock tf.sequential by stubbing it if we mock the whole module at the top.
      // Let's just override it temporarily if it allows, else we skip the strict call check.
      
      // A cleaner way is to mock it globally in the file.
      // Since we just want to test retrain executes properly, and we already injected mock fs:
      // Let's just let it run the real tf.sequential! tfjs in Node.js can create small models fast.
      // However, we don't want it to actually train 60 epochs.
      // So let's override `this.epochs = 1` and `this.sequenceLength = 2` to make it instant.
      
      service.epochs = 1;
      service.sequenceLength = 2;
      
      const spyExists = jest.spyOn(fsSync, 'existsSync').mockReturnValue(false);
      const spyMkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue();
      const spyWriteFile = jest.spyOn(fs, 'writeFile').mockResolvedValue();

      await service.retrain(candles);

      expect(spyWriteFile).toHaveBeenCalledTimes(2); // weights.json and stats.json
      
      spyExists.mockRestore();
      spyMkdir.mockRestore();
      spyWriteFile.mockRestore();
    });
  });
});
