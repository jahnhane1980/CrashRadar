import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelTrainer } from '../../src/ml/ModelTrainer.js';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn()
  }
}));

describe('ModelTrainer', () => {
  let mockConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      global: { snapshotDir: 'test/snapshots', modelDir: 'test/models' },
      default: {
        version: 'v1',
        epochs: 1, // extrem kurz für den Test
        batchSize: 2,
        timeSteps: 3,
        earlyStoppingPatience: 2
      }
    };
  });

  it('should throw an error if the input CSV does not exist', async () => {
    fs.existsSync.mockReturnValue(false);

    const trainer = new ModelTrainer('BTC', mockConfig);
    await expect(trainer.train()).rejects.toThrow(/Datensatz nicht gefunden:/);
  });

  it('should successfully parse CSV, compute weights, train LSTM, and save (Happy Path)', async () => {
    // existSync soll true fuer die CSV sein, aber false fuer den Model-Dir, damit mkdirSync aufgerufen wird
    fs.existsSync.mockImplementation((p) => String(p).endsWith('.csv'));

    // Mock CSV Content
    // Wir brauchen mindestens timeSteps (3) + 1 Zeilen, besser 10
    const csvLines = [
      'Date,Close,Volume,OBV,Label',
      '2026-01-01,100,1000,1000,BULL_MARKET',
      '2026-01-02,105,1200,2200,BULL_MARKET',
      '2026-01-03,110,1300,3500,BULL_CORRECTION',
      '2026-01-04,115,1100,4600,BULL_MARKET',
      '2026-01-05,100,2000,2600,BEAR_MARKET',
      '2026-01-06,90,2500,100,BEAR_MARKET',
      '2026-01-07,80,3000,-2900,BEAR_MARKET',
      '2026-01-08,85,1000,-1900,BEAR_RALLY'
    ];
    fs.readFileSync.mockReturnValue(csvLines.join('\n'));

    const trainer = new ModelTrainer('BTC', mockConfig);
    
    // Train the model natively using @tensorflow/tfjs in memory!
    await trainer.train();

    // 1. Verify Normalization Stats
    expect(trainer.globalStats).toHaveProperty('Close');
    expect(trainer.globalStats).toHaveProperty('Volume');
    expect(trainer.globalStats).toHaveProperty('OBV');

    // 2. Verify Output Paths
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('btc_regime_v1'), { recursive: true });
    
    // 3. Verify Weights & Stats Saved
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync.mock.calls[0][0]).toContain('weights.json');
    expect(fs.writeFileSync.mock.calls[1][0]).toContain('stats.json');

    // Stats sollten ein gueltiges JSON sein
    const savedStats = JSON.parse(fs.writeFileSync.mock.calls[1][1]);
    expect(savedStats).toHaveProperty('Close');
  }, 15000);

  it('should filter out UNKNOWN labels', async () => {
    fs.existsSync.mockImplementation((p) => String(p).endsWith('.csv'));

    const csvLines = [
      'Date,Close,Label',
      '2026-01-01,100,BULL_MARKET',
      '2026-01-02,105,UNKNOWN', // Should be ignored
      '2026-01-03,110,BULL_CORRECTION',
      '2026-01-04,115,BULL_MARKET',
      '2026-01-05,115,BULL_MARKET'
    ];
    fs.readFileSync.mockReturnValue(csvLines.join('\n'));

    // timeSteps = 2 -> 3 valid lines remaining = 1 sequence
    mockConfig.default.timeSteps = 2;
    const trainer = new ModelTrainer('BTC', mockConfig);
    
    await trainer.train();
    
    // Check if the UNKNOWN label was skipped during stat generation
    const savedStats = JSON.parse(fs.writeFileSync.mock.calls[1][1]);
    // mean von (100, 110, 115, 115) = 440 / 4 = 110
    expect(savedStats.Close.mean).toBe(110);
  }, 15000);
});
