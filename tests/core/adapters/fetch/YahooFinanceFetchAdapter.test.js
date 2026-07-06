import { describe, it, expect, vi } from 'vitest';
import { YahooFinanceFetchAdapter } from '../../../../src/core/adapters/fetch/YahooFinanceFetchAdapter.js';

const mocks = vi.hoisted(() => ({
    chart: vi.fn().mockResolvedValue([{ date: '2023-01-01', close: 100 }]),
    options: vi.fn()
}));

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => {
  return {
    default: class MockYahooFinance {
      chart = mocks.chart;
      options = mocks.options;
    }
  };
});

describe('YahooFinanceFetchAdapter - Härtetests', () => {
  describe('Date Parsing Chaos (startValue)', () => {
    it('sollte ein valides Datum (Schaltjahr) fehlerfrei akzeptieren', async () => {
      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'chart', ticker: 'AAPL', options: {} }, { pagination: {} }, '2024-02-29');
      // Da es nicht in der Zukunft liegt, wird der Request abgesetzt. 
      expect(result).toBeDefined();
    });

    it('sollte den Unix Epoch (0) sicher verarbeiten ohne als falsey zu crashen', async () => {
      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'chart', ticker: 'AAPL', options: {} }, { pagination: {} }, 0);
      expect(result).toBeDefined();
    });

    it('sollte kompletten Müll-String überleben ohne zu crashen', async () => {
      const adapter = new YahooFinanceFetchAdapter();
      // "NICHT_EIN_DATUM" triggert isNaN und fällt durch alle parse-versuche, wird zu "Invalid Date"
      const result = await adapter.fetch({ method: 'chart', ticker: 'AAPL', options: {} }, { pagination: {} }, 'NICHT_EIN_DATUM');
      // Da "Invalid Date" via isNaN(startDate.getTime()) erkannt wird, überspringt der Code die Zukunft-Prüfung
      // und feuert den Request einfach an YahooFinance weiter. 
      expect(result).toBeDefined();
    });

    it('sollte ein leeres Array zurückgeben, wenn startValue in der fernen Zukunft liegt', async () => {
      const adapter = new YahooFinanceFetchAdapter();
      const futureDateMs = Date.now() + 86400000 * 365; // 1 Jahr in der Zukunft
      const result = await adapter.fetch({ method: 'chart', ticker: 'AAPL', options: {} }, { pagination: {} }, futureDateMs);
      expect(result).toEqual([]);
    });
  });

  describe('Options Aggregation Chaos (The Wall)', () => {
    it('sollte gigantische Datenmengen, Dezimal-Strikes und totes OI korrekt nach der Wall durchsuchen', async () => {
      const giantOptionsArray = [];
      
      // Erzeuge 10 Verfallsdaten
      for (let i = 0; i < 10; i++) {
        const calls = [];
        const puts = [];
        // Erzeuge 50 Strikes pro Verfallsdatum
        for (let j = 0; j < 50; j++) {
            // Normale Optionen mit wenig Volumen und Dezimal-Strikes
            calls.push({ strike: 100.5 + j, openInterest: Math.floor(Math.random() * 100) });
            // Tote Optionen
            puts.push({ strike: 200.5 + j, openInterest: 0 });
            puts.push({ strike: 300.5 + j, openInterest: undefined });
        }
        giantOptionsArray.push({ calls, puts });
      }

      // Verstecke die Call Wall tief im Array (Verfallsdatum Index 4, Call 27)
      giantOptionsArray[4].calls[27] = { strike: 412.5, openInterest: 999999 };
      // Verstecke die Put Wall tief im Array (Verfallsdatum Index 8, Put 13)
      giantOptionsArray[8].puts[13] = { strike: 388.5, openInterest: 888888 };

      mocks.options.mockResolvedValueOnce({ options: giantOptionsArray });

      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'options', ticker: 'SPY' }, {});
      
      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].call_wall_strike).toBe(412.5);
      expect(result.quotes[0].call_wall_oi).toBe(999999);
      expect(result.quotes[0].put_wall_strike).toBe(388.5);
      expect(result.quotes[0].put_wall_oi).toBe(888888);
    });

    it('sollte Gleichstände (Tie-Breaks) verarbeiten (nimmt den zuerst gefundenen)', async () => {
      mocks.options.mockResolvedValueOnce({
        options: [{
          calls: [
            { strike: 400, openInterest: 50000 }, // Zuerst gefunden
            { strike: 450, openInterest: 50000 }  // Identisches Volumen
          ],
          puts: [
            { strike: 300, open   : 50000 },
            { strike: 250, openInterest: 50000 }
          ]
        }]
      });

      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'options', ticker: 'SPY' }, {});
      
      // Da 'open' in put 300 ein Tippfehler im Test-Setup ist (absichtliche kaputte Daten),
      // greift hier || 0. Das zweite Element (250) hat 50000 und gewinnt somit haushoch.
      expect(result.quotes[0].call_wall_strike).toBe(400); 
      expect(result.quotes[0].put_wall_strike).toBe(250);
    });
  });

  describe('Weitere Edge Cases & Fallbacks (100% Branch Coverage)', () => {
    it('sollte leeres Array zurückgeben, wenn keine options existieren (Sicherheitsnetz)', async () => {
      mocks.options.mockResolvedValueOnce({});
      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'options', ticker: 'SPY' }, {});
      expect(result).toEqual({ quotes: [] });
      
      mocks.options.mockResolvedValueOnce({ options: [] });
      const result2 = await adapter.fetch({ method: 'options', ticker: 'SPY' }, {});
      expect(result2).toEqual({ quotes: [] });
    });

    it('sollte leere Optionen-Ketten (calls/puts undefined) mit || [] abfangen', async () => {
      mocks.options.mockResolvedValueOnce({
        options: [ { calls: undefined, puts: undefined } ]
      });
      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'options', ticker: 'SPY' }, {});
      expect(result).toEqual({ quotes: [] });
    });

    it('sollte method chart ohne startValue verarbeiten (if startValue überspringen)', async () => {
      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'chart', ticker: 'AAPL', options: {} }, {});
      expect(result).toBeDefined();
    });

    it('sollte fallback auf period1 und leeres options-Objekt nutzen', async () => {
      const adapter = new YahooFinanceFetchAdapter();
      const result = await adapter.fetch({ method: 'chart', ticker: 'AAPL' }, {}, '2023-01-01');
      expect(result).toBeDefined();
    });
  });
});
