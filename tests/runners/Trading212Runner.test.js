import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Trading212Runner } from '../../src/runners/Trading212Runner.js';
import { Trading212Fetcher } from '../../src/services/Trading212Fetcher.js';
import { Logger } from '../../src/core/Logger.js';

describe('Trading212Runner & Trading212Fetcher', () => {
  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Trading212Fetcher.cleanTicker', () => {
    it('bereinigt Börsenkürzel wie _US_EQ oder _DE_EQ', () => {
      expect(Trading212Fetcher.cleanTicker('PLTR_US_EQ')).toBe('PLTR');
      expect(Trading212Fetcher.cleanTicker('AIRO_US_EQ')).toBe('AIRO');
      expect(Trading212Fetcher.cleanTicker('S_US_EQ')).toBe('S');
      expect(Trading212Fetcher.cleanTicker('SAP_DE_EQ')).toBe('SAP');
      expect(Trading212Fetcher.cleanTicker('NVTS')).toBe('NVTS');
    });
  });

  describe('Trading212Runner Snapshot & Delta Detection', () => {
    it('berechnet relative Allokation und erkennt Transaktionen (Kauf, Aufstockung, Verkauf)', () => {
      const runner = new Trading212Runner({ test: true });

      const prevSnapshot = {
        cashPct: 15.0,
        positions: [
          { ticker: 'PLTR', quantity: 100, weightPct: 50.0 },
          { ticker: 'NVTS', quantity: 50, weightPct: 35.0 },
        ],
      };

      const curSnapshot = {
        cashPct: 20.0,
        positions: [
          { ticker: 'PLTR', quantity: 120, weightPct: 60.0 }, // Aufstockung
          { ticker: 'S', quantity: 40, weightPct: 20.0 },      // Neukauf
          // NVTS verkauft
        ],
      };

      const deltas = runner.detectDeltas(prevSnapshot, curSnapshot);

      expect(deltas.hasChanges).toBe(true);
      expect(deltas.added.length).toBe(1);
      expect(deltas.added[0].ticker).toBe('S');

      expect(deltas.removed.length).toBe(1);
      expect(deltas.removed[0].ticker).toBe('NVTS');

      expect(deltas.modified.length).toBe(1);
      expect(deltas.modified[0].ticker).toBe('PLTR');
      expect(deltas.modified[0].type).toBe('AUFSTOCKUNG');
      expect(deltas.cashDeltaPct).toBe(5.0);
    });

    it('formatiert Report rein prozentual ohne absolute Kontobeträge', () => {
      const runner = new Trading212Runner({ test: true });

      const current = {
        timestamp: '2026-09-13T10:00:00.000Z',
        cashPct: 12.5,
        investedPct: 87.5,
        positionsCount: 2,
        positions: [
          { ticker: 'PLTR', weightPct: 50.0, pnlPct: 25.4 },
          { ticker: 'S', weightPct: 37.5, pnlPct: -3.2 },
        ],
      };

      const deltas = {
        isInitial: false,
        hasChanges: true,
        added: [{ ticker: 'S', weightPct: 37.5 }],
        modified: [],
        removed: [],
      };

      const report = runner.formatWeeklyReport(current);

      expect(report).toContain('**Cash-Quote:** 12.5 %');
      expect(report).toContain('**Investiert:** 87.5 %');
      expect(report).not.toContain('NEUKAUF:'); // Wöchentlicher Report enthält keine Transaktionen
      expect(report).toContain('PLTR');
      expect(report).toContain('50.0 %');
      expect(report).toContain('+25.4%');
      expect(report).toContain('S');
      expect(report).toContain('37.5 %');
      expect(report).toContain('-3.2%');
      // Sicherheits-Check: Absolut keine Währungsbeträge wie $ oder € bei Gesamtvermögen
      expect(report).not.toContain('Gesamtvermögen:');
      expect(report).not.toContain('Kontostand:');
    });

    it('erkennt Deltas bei offenen Limit-Orders und formatiert Trades- und Weekly-Report', () => {
      const runner = new Trading212Runner({ test: true });

      const prevSnapshot = {
        cashPct: 15.0,
        freeCashPct: 10.0,
        blockedCashPct: 5.0,
        positions: [{ ticker: 'PLTR', quantity: 100, weightPct: 85.0 }],
        pendingOrders: [
          { id: '1', ticker: 'S', quantity: 200, limitPrice: 18.80, currency: 'USD', targetWeightPct: 3.5 },
          { id: '2', ticker: 'NVTS', quantity: 100, limitPrice: 9.91, currency: 'USD', targetWeightPct: 1.5 },
        ],
      };

      const curSnapshot = {
        timestamp: '2026-09-13T10:00:00.000Z',
        cashPct: 16.0,
        freeCashPct: 11.0,
        blockedCashPct: 5.0,
        allTimeReturnPct: 185.6,
        openReturnPct: 5.8,
        positions: [
          { ticker: 'PLTR', quantity: 100, weightPct: 80.0 },
          { ticker: 'S', quantity: 200, weightPct: 4.0 }, // Ausführung von Order 1!
        ],
        pendingOrders: [
          // Order 1 (S) ausgeführt, Order 2 (NVTS) noch da
          { id: '2', ticker: 'NVTS', quantity: 100, limitPrice: 9.91, currency: 'USD', targetWeightPct: 1.5 },
          // Order 3 neu erstellt
          { id: '3', ticker: 'PGY', quantity: 50, limitPrice: 19.80, currency: 'USD', targetWeightPct: 1.0 },
        ],
      };

      const deltas = runner.detectDeltas(prevSnapshot, curSnapshot);

      expect(deltas.hasChanges).toBe(true);
      expect(deltas.ordersAdded.length).toBe(1);
      expect(deltas.ordersAdded[0].ticker).toBe('PGY');
      expect(deltas.ordersRemoved.length).toBe(1);
      expect(deltas.ordersRemoved[0].ticker).toBe('S');

      // 1. Trades Report
      const tradesReport = runner.formatTradesReport(curSnapshot, deltas);
      expect(tradesReport).toContain('ORDER AUSGEFÜHRT:** S (200 Stk. @ 18.80 USD)');
      expect(tradesReport).toContain('LIMIT-ORDER ERSTELLT:** PGY (50 Stk. @ 19.80 USD)');
      expect(tradesReport).toContain('Aktuelle Cash-Quote:** 16.0 %');

      // 2. Weekly Report
      const weeklyReport = runner.formatWeeklyReport(curSnapshot);
      expect(weeklyReport).toContain('**Cash-Quote:** 16.0 % (Bar: 11.0 %, In Limit-Orders: 5.0 %)');
      expect(weeklyReport).toContain('🚀 **Gesamtrendite:** +185.6 % (Offen: +5.8 %)');
      expect(weeklyReport).toContain('⏳ **Offene Limit-Orders (2):**');
      expect(weeklyReport).toContain('• **NVTS:** 100 Stk. @ 9.91 USD (~1.5 % Ziel-Allokation)');
      expect(weeklyReport).toContain('• **PGY:** 50 Stk. @ 19.80 USD (~1.0 % Ziel-Allokation)');
      expect(weeklyReport).toContain('CASH');
      expect(weeklyReport).toContain('16.0 %');
    });

    it('behandelt IB01 als Geldmarkt-Cash und subsumiert es unter CASH', () => {
      const runner = new Trading212Runner({ test: true });

      const current = {
        timestamp: '2026-09-13T10:00:00.000Z',
        cashPct: 30.0,
        freeCashPct: 10.0,
        blockedCashPct: 5.0,
        ib01CashPct: 15.0,
        investedPct: 70.0,
        positionsCount: 2,
        positions: [
          { ticker: 'AIRO', weightPct: 40.0, pnlPct: 10.0 },
          { ticker: 'LUMN', weightPct: 30.0, pnlPct: 5.0 },
        ],
      };

      const deltas = { isInitial: true, hasChanges: false, added: [], modified: [], removed: [] };
      const report = runner.formatReport(current, deltas);

      expect(report).toContain('**Cash-Quote:** 30.0 % (Bar: 10.0 %, In Limit-Orders: 5.0 %, Geldmarkt (IB01): 15.0 %)');
      expect(report).toContain('**Investiert:** 70.0 % (2 Positionen)');
      expect(report).toContain('CASH');
      expect(report).toContain('30.0 %');
      // IB01 darf nicht als Einzelaktie in der Liste auftauchen
      expect(report).not.toContain('IB01 ');
    });
  });

  describe('Trading212Runner.run', () => {
    it('bricht sauber ab, wenn kein API-Key konfiguriert ist', async () => {
      const origKey = process.env.TRADING212_API_KEY;
      delete process.env.TRADING212_API_KEY;

      const runner = new Trading212Runner();
      await runner.run();

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('TRADING212_API_KEY fehlt in der .env!')
      );

      process.env.TRADING212_API_KEY = origKey;
    });

    it('führt lokalen Test-Lauf erfolgreich aus (ohne Ntfy-Versand)', async () => {
      const origKey = process.env.TRADING212_API_KEY;
      process.env.TRADING212_API_KEY = 'mock_key';

      const mockFetcher = {
        getPortfolioSnapshot: vi.fn().mockResolvedValue({
          timestamp: '2026-09-13T10:00:00.000Z',
          cashPct: 15.0,
          investedPct: 85.0,
          positionsCount: 1,
          positions: [{ ticker: 'AIRO', weightPct: 85.0, pnlPct: 12.0 }],
        }),
      };

      const mockNtfy = {
        send: vi.fn().mockResolvedValue(),
      };

      const runner = new Trading212Runner(
        { sendNtfy: false },
        { fetcher: mockFetcher, ntfyService: mockNtfy }
      );

      vi.spyOn(runner, 'saveSnapshot').mockImplementation(() => {});
      vi.spyOn(runner, 'loadPreviousSnapshot').mockReturnValue(null);

      await runner.run();

      expect(mockFetcher.getPortfolioSnapshot).toHaveBeenCalled();
      expect(mockNtfy.send).not.toHaveBeenCalled(); // Ntfy darf im Test-Modus nicht senden
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Lokaler Test-Modus aktiv: Ntfy-Versand übersprungen')
      );

      process.env.TRADING212_API_KEY = origKey;
    });

    it('sendet Ntfy-Alert nur wenn options.sendNtfy aktiv ist', async () => {
      const origKey = process.env.TRADING212_API_KEY;
      process.env.TRADING212_API_KEY = 'mock_key';

      const mockFetcher = {
        getPortfolioSnapshot: vi.fn().mockResolvedValue({
          timestamp: '2026-09-13T10:00:00.000Z',
          cashPct: 15.0,
          investedPct: 85.0,
          positionsCount: 1,
          positions: [{ ticker: 'AIRO', weightPct: 85.0, pnlPct: 12.0 }],
        }),
      };

      const mockNtfy = {
        send: vi.fn().mockResolvedValue(),
      };

      const runner = new Trading212Runner(
        { sendNtfy: true },
        { fetcher: mockFetcher, ntfyService: mockNtfy }
      );

      vi.spyOn(runner, 'saveSnapshot').mockImplementation(() => {});
      vi.spyOn(runner, 'loadPreviousSnapshot').mockReturnValue(null);

      await runner.run();

      expect(mockNtfy.send).toHaveBeenCalledWith(
        'Kamikaze Portfolio Update',
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );

      process.env.TRADING212_API_KEY = origKey;
    });

    it('bleibt im Modus "trades" stumm, wenn keine Transaktionen stattfanden', async () => {
      const origKey = process.env.TRADING212_API_KEY;
      process.env.TRADING212_API_KEY = 'mock_key';

      const snapshot = {
        timestamp: '2026-09-13T10:00:00.000Z',
        cashPct: 15.0,
        investedPct: 85.0,
        positionsCount: 1,
        positions: [{ ticker: 'AIRO', quantity: 100, weightPct: 85.0 }],
        pendingOrders: [],
      };

      const mockFetcher = {
        getPortfolioSnapshot: vi.fn().mockResolvedValue(snapshot),
      };

      const mockNtfy = { send: vi.fn().mockResolvedValue() };

      const runner = new Trading212Runner(
        { mode: 'trades', sendNtfy: true },
        { fetcher: mockFetcher, ntfyService: mockNtfy }
      );

      vi.spyOn(runner, 'saveSnapshot').mockImplementation(() => {});
      vi.spyOn(runner, 'loadPreviousSnapshot').mockReturnValue(snapshot); // Identischer Snapshot -> keine Änderungen

      await runner.run();

      expect(mockNtfy.send).not.toHaveBeenCalled(); // Silent Mode!
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Keine Transaktionen seit dem letzten Lauf festgestellt. Ntfy bleibt stumm.')
      );

      process.env.TRADING212_API_KEY = origKey;
    });

    it('sendet im Modus "trades" einen kompakten Transaktions-Alert, wenn Änderungen vorliegen', async () => {
      const origKey = process.env.TRADING212_API_KEY;
      process.env.TRADING212_API_KEY = 'mock_key';

      const prevSnapshot = {
        timestamp: '2026-09-13T10:00:00.000Z',
        cashPct: 20.0,
        investedPct: 80.0,
        positionsCount: 1,
        positions: [{ ticker: 'AIRO', quantity: 100, weightPct: 80.0 }],
        pendingOrders: [],
      };

      const curSnapshot = {
        timestamp: '2026-09-13T12:00:00.000Z',
        cashPct: 15.0,
        investedPct: 85.0,
        positionsCount: 2,
        positions: [
          { ticker: 'AIRO', quantity: 100, weightPct: 75.0 },
          { ticker: 'S', quantity: 200, weightPct: 10.0 }, // Neukauf!
        ],
        pendingOrders: [],
      };

      const mockFetcher = {
        getPortfolioSnapshot: vi.fn().mockResolvedValue(curSnapshot),
      };

      const mockNtfy = { send: vi.fn().mockResolvedValue() };

      const runner = new Trading212Runner(
        { mode: 'trades', sendNtfy: true },
        { fetcher: mockFetcher, ntfyService: mockNtfy }
      );

      vi.spyOn(runner, 'saveSnapshot').mockImplementation(() => {});
      vi.spyOn(runner, 'loadPreviousSnapshot').mockReturnValue(prevSnapshot);

      await runner.run();

      expect(mockNtfy.send).toHaveBeenCalledWith(
        'Kamikaze Transaktions-Alert',
        expect.stringContaining('NEUKAUF:** S (+10.0 % Allokation, 200 Stk.)'),
        'high',
        expect.any(String)
      );

      process.env.TRADING212_API_KEY = origKey;
    });
  });
});
