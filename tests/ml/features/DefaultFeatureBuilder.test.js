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

describe('DefaultFeatureBuilder - Härtetests & ML Features', () => {
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
        // Wir fordern ALLE Features an, um das gesamte Skript (SMA200, 52W High, Z-Score) zu durchlaufen
        features: [
          'Close', 'Volume', 'OBV', 'ATR_14', 'RSI_14', 'MACD_Hist',
          'Dist_SMA200', 'SMA200_Slope', 'Days_Below_SMA200',
          'Volume_Z_Score', 'Dist_52W_High', 'Dist_52W_Low', 'Log_Return_EMA3'
        ]
      },
      tickers: {
        TEST: { version: 'v2', features: ['Close', 'Volume'] }
      }
    };
  });

  const generateComplexDummyData = (count) => {
    const data = [];
    const startDate = new Date('2020-01-01T00:00:00Z');
    let prevClose = 100;

    for (let i = 0; i < count; i++) {
      let open = prevClose;
      
      // 1. Gaps (Kurssprünge über Nacht) simulieren: 
      // Zwingt die True Range (ATR) Logik in die 'Math.abs(high - prevClose)' Ausweichzweige.
      if (i > 0 && i % 20 === 0) {
        open = prevClose + (Math.random() > 0.5 ? 40 : -40); // 40 Punkte Gap
      }

      // 2. Markt-Zyklen: Sinus-Welle + hartes Rauschen
      const noise = (Math.random() - 0.5) * 20;
      let close = open + (Math.sin(i / 10) * 10) + noise;
      if (close <= 1) close = 1; // Kurse können nicht negativ werden

      // 3. Intraday-Schwankungen
      const high = Math.max(open, close) + Math.random() * 15 + 1;
      const low = Math.max(0.1, Math.min(open, close) - (Math.random() * 15 + 1));

      // 4. Volumen-Manipulation:
      // Erste 60 Tage sind absolut konstant (Zwingt Z-Score in die Math.sqrt(0) Division-by-Zero Exception)
      // Danach zufällig, mit massiven Climax-Spikes an jedem 15. Tag
      let volume = i < 60 ? 5000 : 5000 + (Math.random() * 2000);
      if (i >= 60 && i % 15 === 0) volume *= 15; // 15-facher Volumen-Climax!

      data.push({
        date: new Date(startDate.getTime() + (i * 86400000)).toISOString().split('T')[0],
        close: close,
        high: high,
        low: low,
        volume: volume
      });
      prevClose = close;
    }
    return data;
  };

  it('sollte einen Fehler werfen, wenn keine Daten gefunden werden', async () => {
    mockRepo.getOhlcvForTicker.mockResolvedValue([]);
    const builder = new DefaultFeatureBuilder('BTC', mockRepo, mockConfig);

    await expect(builder.build()).rejects.toThrow('Keine OHLCV-Daten für BTC gefunden!');
  });

  it('sollte auf Default-Config zurückfallen, wenn der Ticker nicht explizit konfiguriert ist', () => {
    const builder = new DefaultFeatureBuilder('UNKNOWN', mockRepo, mockConfig);
    expect(builder.featuresToExtract).toEqual(mockConfig.default.features);
  });

  it('sollte Ticker-spezifische Config priorisieren', () => {
    const builder = new DefaultFeatureBuilder('TEST', mockRepo, mockConfig);
    expect(builder.featuresToExtract).toEqual(['Close', 'Volume']);
  });

  it('sollte riesige Arrays für SMA200, 52W High und Z-Scores fehlerfrei auswerten', async () => {
    // Um Dist_52W_High (251 Tage) zu testen, brauchen wir min. 260 Tage
    // Um SMA200 (200), SMA200Slope (209) zu testen, brauchen wir > 209 Tage
    const dummyData = generateComplexDummyData(300);
    mockRepo.getOhlcvForTicker.mockResolvedValue(dummyData);

    const builder = new DefaultFeatureBuilder('BTC', mockRepo, mockConfig);
    const outPath = await builder.build();

    expect(outPath).toContain('btc_v1.csv');
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    const callArgs = fs.writeFileSync.mock.calls[0];
    const csvContent = callArgs[1];
    const lines = csvContent.split('\n').filter(l => l.trim() !== '');
    
    // Check Header (13 Features + Date + Label = 15 Spalten)
    expect(lines[0]).toBe('Date,Close,Volume,OBV,ATR_14,RSI_14,MACD_Hist,Dist_SMA200,SMA200_Slope,Days_Below_SMA200,Volume_Z_Score,Dist_52W_High,Dist_52W_Low,Log_Return_EMA3,Label');
    
    // Da wir 300 Tage Daten haben und das Maximum Warmup (Dist_52W_High) 251 Tage braucht,
    // bleiben am Ende etwa 49 gültige Zeilen übrig.
    expect(lines.length).toBeGreaterThan(40); 
    
    // Teste die allerletzte Zeile, ob alle berechneten Features enthalten sind
    const lastDataLine = lines[lines.length - 1].split(',');
    expect(lastDataLine.length).toBe(15);
    
    // Tage unter SMA200 sollte eine saubere Zahl sein (nicht null)
    const daysBelowSma = Number(lastDataLine[9]); 
    expect(isNaN(daysBelowSma)).toBe(false);

    // Z-Score und LogReturnEma3 sollten berechnet sein
    const zScore = Number(lastDataLine[10]);
    expect(isNaN(zScore)).toBe(false);

    const logReturn = Number(lastDataLine[13]);
    expect(isNaN(logReturn)).toBe(false);
  });

  it('sollte unvollständige Zeilen während der Warmup-Phase (z.B. erste 200 Tage) rigoros herausfiltern', async () => {
    // 200 Tage reichen für SMA200, ABER SMA200_Slope braucht 209 Tage,
    // und Dist_52W_High braucht 251 Tage.
    // D.h. mit 200 Tagen Daten bleibt NICHTS übrig, das alle Features besitzt!
    const dummyData = generateComplexDummyData(200);
    mockRepo.getOhlcvForTicker.mockResolvedValue(dummyData);

    const builder = new DefaultFeatureBuilder('BTC', mockRepo, mockConfig);
    await builder.build();

    const csvContent = fs.writeFileSync.mock.calls[0][1];
    const lines = csvContent.split('\n').filter(l => l.trim() !== '');
    
    // Es sollte nur der Header geschrieben werden, keine Daten, da isValid false war
    expect(lines.length).toBe(1);
    expect(lines[0].startsWith('Date')).toBe(true);
  });
});
