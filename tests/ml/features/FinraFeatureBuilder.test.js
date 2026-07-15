import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinraFeatureBuilder } from '../../../src/ml/features/FinraFeatureBuilder.js';
import { DefaultFeatureBuilder } from '../../../src/ml/features/DefaultFeatureBuilder.js';
import fs from 'fs';

vi.mock('fs', async () => {
  const actualFs = await vi.importActual('fs');
  return {
    ...actualFs,
    default: {
      ...actualFs.default,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn()
    }
  };
});

describe('FinraFeatureBuilder', () => {
  let mockRepo;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getOhlcvForTicker: vi.fn().mockResolvedValue([{ date: '2023-01-01', close: 10 }]),
      getFinraShortVolumeForTicker: vi.fn().mockResolvedValue([
        { date: '2023-01-01', short_volume_ratio: '0.65' },
        { date: '2023-01-02', short_volume_ratio: '0.70' }
      ]),
      getFundamentalsForTicker: vi.fn().mockResolvedValue([
        { date: '2022-01-01', shareIssued: 100, freeCashFlow: 50, totalRevenue: 100, netIncome: 20, institutional_ownership: 0.80 },
        { date: '2023-01-01', shareIssued: 110, freeCashFlow: 55, totalRevenue: 110, netIncome: 22, institutional_ownership: 0.81 }
      ])
    };
    
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((path) => {
        if (path.includes('Cycle-Base-Config.json')) return JSON.stringify({ DEFAULT: { windowDays: 1460, threshold: 0.20 }});
        if (path.includes('.json')) return JSON.stringify({ version: 'v2', ML_FEATURES: { ZETA: ['FINRA_Short_Ratio'] }});
        return 'Date,Close,Label\n2023-01-01,10,0\n2023-01-02,11,1';
    });
  });

  it('sollte Daten korrekt über das Repository laden und das CSV schreiben', async () => {
    const validConfig = { default: { features: ['FINRA_Short_Ratio'] }, tickers: { ZETA: {} }, global: {} };
    const builder = new FinraFeatureBuilder('ZETA', mockRepo, validConfig);
    
    // Parent build() mocken, damit wir nicht den ganzen DefaultBuilder-Stack triggern
    vi.spyOn(DefaultFeatureBuilder.prototype, 'build').mockResolvedValue('dummy_path.csv');
    
    await builder.build();
    
    expect(mockRepo.getFinraShortVolumeForTicker).toHaveBeenCalledWith('ZETA', '2015-01-01');
    expect(mockRepo.getFundamentalsForTicker).toHaveBeenCalledWith('ZETA');
    expect(fs.writeFileSync).toHaveBeenCalled();

    // CSV structure verify
    const writtenCsv = fs.writeFileSync.mock.calls[0][1];
    expect(writtenCsv).toContain('FINRA_Short_Ratio,Inst_Ownership,Share_Change_YoY,FCF_Change_QoQ,Revenue_Change_QoQ');
    expect(writtenCsv).toContain('1.1000'); // YoY change: 110/100
  });
  
  it('sollte Chaos-Modus mit Zero-Padding (0.0000) anstelle von UNKNOWN simulieren', async () => {
    process.env.CHAOS_TEST = 'true';
    const validConfig = { default: { features: ['FINRA_Short_Ratio'] }, tickers: { ZETA: {} }, global: {} };
    const builder = new FinraFeatureBuilder('ZETA', mockRepo, validConfig);
    vi.spyOn(DefaultFeatureBuilder.prototype, 'build').mockResolvedValue('dummy_path.csv');
    
    // Force random to always trigger chaos
    const originalRandom = Math.random;
    Math.random = () => 0.01; // < 0.05 triggers UNKNOWN internally, which then becomes 0.0000
    
    await builder.build();
    
    // CSV output content sent to writeFileSync
    const writtenCsv = fs.writeFileSync.mock.calls[0][1];
    expect(writtenCsv).toContain('0.0000');
    
    Math.random = originalRandom;
    process.env.CHAOS_TEST = 'false';
  });
});
