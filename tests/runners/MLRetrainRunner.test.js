import { describe, it, expect, beforeEach, afterEach, vi as jest } from 'vitest';
import { run, getLabelForDate } from '../../src/runners/MLRetrainRunner.js';
import { MLRegimeService } from '../../src/services/MLRegimeService.js';

describe('MLRetrainRunner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLabelForDate', () => {
    it('returns the correct label if date falls within a cycle', () => {
      const cycles = [
        { start: '2020-01-01', end: '2020-12-31', label: 'UPTREND' },
        { start: '2021-01-01', end: '2021-12-31', label: 'DOWNTREND' }
      ];
      expect(getLabelForDate('2020-06-15', cycles)).toBe('UPTREND');
      expect(getLabelForDate('2021-01-01', cycles)).toBe('DOWNTREND');
      expect(getLabelForDate('2021-12-31', cycles)).toBe('DOWNTREND');
    });

    it('returns UNKNOWN if date is outside all cycles', () => {
      const cycles = [
        { start: '2020-01-01', end: '2020-12-31', label: 'UPTREND' }
      ];
      expect(getLabelForDate('2019-12-31', cycles)).toBe('UNKNOWN');
      expect(getLabelForDate('2021-01-01', cycles)).toBe('UNKNOWN');
    });
  });

  describe('run', () => {
    let spyRetrain;

    beforeEach(() => {
      spyRetrain = jest.spyOn(MLRegimeService.prototype, 'retrain').mockResolvedValue();
    });

    afterEach(() => {
      spyRetrain.mockRestore();
    });

    it('executes retraining pipeline successfully for configured assets', async () => {
      const mockRepo = {
        getAllRawData: jest.fn().mockResolvedValue({
          btc: [
            { date: '2020-01-01', close: 100 },
            { date: '2020-01-02', close: 105 }
          ],
          tiingo: [
            { symbol: 'QQQ', date: '2020-01-01', close: 200 },
            { symbol: 'PLTR', date: '2020-01-01', close: 10 }
          ]
        }),
        close: jest.fn()
      };

      const mockFs = {
        readFile: jest.fn().mockResolvedValue(JSON.stringify({
          cycles: {
            btc: [{ start: '2020-01-01', end: '2020-12-31', label: 'UPTREND' }],
            qqq: [{ start: '2020-01-01', end: '2020-12-31', label: 'UPTREND' }],
            pltr: [{ start: '2020-01-01', end: '2020-12-31', label: 'UPTREND' }]
          }
        }))
      };

      await run(mockRepo, mockFs);

      expect(mockRepo.getAllRawData).toHaveBeenCalledWith('1999-01-01');
      expect(spyRetrain).toHaveBeenCalledTimes(3);
      expect(mockRepo.close).toHaveBeenCalled();
    });

    it('handles errors gracefully and rethrows them', async () => {
      const mockRepo = {
        getAllRawData: jest.fn().mockRejectedValue(new Error('Database failed')),
        close: jest.fn()
      };

      const mockFs = {
        readFile: jest.fn().mockResolvedValue('{}')
      };

      await expect(run(mockRepo, mockFs)).rejects.toThrow('Database failed');
      expect(mockRepo.close).toHaveBeenCalled();
    });

    it('skips assets if missing in config or database', async () => {
      const mockRepo = {
        getAllRawData: jest.fn().mockResolvedValue({
          btc: [], // empty btc
          tiingo: [
            { symbol: 'QQQ', date: '2020-01-01', close: 200 }
            // Missing PLTR
          ]
        }),
        close: jest.fn()
      };

      const mockFs = {
        readFile: jest.fn().mockResolvedValue(JSON.stringify({
          cycles: {
            btc: [],
            qqq: [],
          }
        }))
      };

      await run(mockRepo, mockFs);

      expect(spyRetrain).toHaveBeenCalledTimes(1);
    });
  });
});
