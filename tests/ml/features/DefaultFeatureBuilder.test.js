import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { DefaultFeatureBuilder } from '../../../src/ml/features/DefaultFeatureBuilder.js';

// Mock file system to avoid writing real CSVs
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn()
  }
}));

describe('DefaultFeatureBuilder', () => {
  let mockRepo;
  let mockConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      getOhlcvForTicker: vi.fn()
    };

    mockConfig = {
      global: { snapshotDir: 'test/snapshots' },
      default: {
        version: 'v1',
        features: ['Close', 'Volume', 'OBV', 'ATR_14', 'RSI_14', 'MACD_Hist']
      },
      tickers: {
        TEST: { version: 'v2', features: ['Close', 'Volume'] }
      }
    };
  });

  const generateDummyData = (count) => {
    const data = [];
    let price = 100;
    for (let i = 0; i < count; i++) {
      // Create a slight uptrend to avoid zeros
      price += 1;
      data.push({
        date: new Date(`2026-01-${String((i % 30) + 1).padStart(2, '0')}`),
        close: price,
        high: price + 5,
        low: price - 5,
        volume: 1000 + (i * 10)
      });
    }
    return data;
  };

  it('should throw an error if no raw data is returned from repo', async () => {
    mockRepo.getOhlcvForTicker.mockResolvedValue([]);
    const builder = new DefaultFeatureBuilder('BTC', mockRepo, mockConfig);

    await expect(builder.build()).rejects.toThrow('Keine OHLCV-Daten für BTC gefunden!');
  });

  it('should fallback to default config if ticker is not specifically configured', () => {
    const builder = new DefaultFeatureBuilder('UNKNOWN_TICKER', mockRepo, mockConfig);
    expect(builder.featuresToExtract).toEqual(mockConfig.default.features);
  });

  it('should use ticker-specific config if available', () => {
    const builder = new DefaultFeatureBuilder('TEST', mockRepo, mockConfig);
    expect(builder.featuresToExtract).toEqual(['Close', 'Volume']);
  });

  it('should successfully build features and write to CSV (Happy Path)', async () => {
    // Generate 40 days of data to overcome 14-day warmups for ATR/RSI/MACD
    const dummyData = generateDummyData(40);
    mockRepo.getOhlcvForTicker.mockResolvedValue(dummyData);

    const builder = new DefaultFeatureBuilder('BTC', mockRepo, mockConfig);
    const outPath = await builder.build();

    expect(outPath).toContain('btc_v1.csv');
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    const callArgs = fs.writeFileSync.mock.calls[0];
    expect(callArgs[0]).toContain('btc_v1.csv'); // Filepath
    
    const csvContent = callArgs[1];
    const lines = csvContent.split('\n');
    
    // Check Header
    expect(lines[0]).toBe('Date,Close,Volume,OBV,ATR_14,RSI_14,MACD_Hist,Label');
    
    // Since warmup takes ~33 days for MACD (slow period 26 + signal 9), we should have some lines left
    expect(lines.length).toBeGreaterThan(2); 
    
    // Check if the lines contain valid values (no nulls)
    const dataLine = lines[lines.length - 1].split(',');
    expect(dataLine.length).toBe(8);
    expect(dataLine[dataLine.length - 1]).toBeDefined(); // Label column
  });

  it('should filter out rows during indicator warmup phase', async () => {
    // Only 10 days of data - not enough for RSI_14 or MACD
    const dummyData = generateDummyData(10);
    mockRepo.getOhlcvForTicker.mockResolvedValue(dummyData);

    const builder = new DefaultFeatureBuilder('BTC', mockRepo, mockConfig);
    await builder.build();

    const csvContent = fs.writeFileSync.mock.calls[0][1];
    const lines = csvContent.split('\n');
    
    // Should only contain the header, no data rows because of warmup filtering
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('Date,Close,Volume,OBV,ATR_14,RSI_14,MACD_Hist,Label');
  });
});
