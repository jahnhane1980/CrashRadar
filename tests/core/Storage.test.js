import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('mysql2/promise', () => {
  return {
    default: {
      createPool: vi.fn()
    }
  };
});

import mysql from 'mysql2/promise';
import { Storage } from '../../src/core/Storage.js';

describe('Storage Class (MySQL)', () => {
  let mockConnection;
  let mockPool;

  beforeEach(() => {
    mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    
    mockPool = {
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConnection),
      end: vi.fn()
    };

    mysql.createPool.mockReturnValue(mockPool);
    process.env.DATABASE_URL = 'mysql://dummy:password@localhost/test';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sollte Fehler werfen wenn keine DATABASE_URL vorhanden ist', () => {
    delete process.env.DATABASE_URL;
    expect(() => new Storage({})).toThrow(/No database URL provided/i);
  });

  it('sollte den Pool mit der URL initialisieren', () => {
    new Storage({ databaseUrl: 'mysql://custom' });
    expect(mysql.createPool).toHaveBeenCalledWith('mysql://custom');
  });

  it('sollte mit getSyncState() undefined zurückgeben, wenn der Job nicht existiert', async () => {
    mockPool.query.mockResolvedValueOnce([[]]);
    const storage = new Storage({});
    const state = await storage.getSyncState('nicht.existent');
    expect(state).toBeUndefined();
  });

  it('sollte mit getSyncState() die cursor_data zurückgeben', async () => {
    mockPool.query.mockResolvedValueOnce([[{ cursor_data: '{"last":1}' }]]);
    const storage = new Storage({});
    const state = await storage.getSyncState('job_1');
    expect(state.cursor_data).toBe('{"last":1}');
  });

  it('sollte leere Datensätze in insertDataAndState() ignorieren', async () => {
    const storage = new Storage({});
    await storage.insertDataAndState({ provider: 'Binance' }, [], null);
    expect(mockPool.getConnection).not.toHaveBeenCalled();
  });

  it('sollte Daten für Binance mappen und State aktualisieren (insertDataAndState)', async () => {
    const storage = new Storage({});
    const task = {
      id: 'binance_btc',
      provider: 'Binance',
      params: { symbol: 'BTCUSDT', interval: '1d' }
    };
    const mockData = [
      [1600000000, 10, 12, 9, 11, 100, 1600086400, 1100, 50, 40, 440, 0]
    ];
    
    await storage.insertDataAndState(task, mockData, mockData[0]);
    
    expect(mockConnection.beginTransaction).toHaveBeenCalled();
    expect(mockConnection.query).toHaveBeenCalledTimes(2); // 1x Data, 1x State
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO market_data_binance');
    expect(mockConnection.query.mock.calls[0][1][0][0][2]).toBe(1600000000); // open_time
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });

  it('sollte Daten für Tiingo mappen', async () => {
    const storage = new Storage({});
    const task = { id: 'tiingo_spy', provider: 'Tiingo', ticker: 'SPY', resolution: 'daily' };
    const mockData = [{ date: '2020-01-01T00:00:00.000Z', open: 100, high: 110, low: 90, close: 105, volume: 1000 }];
    
    await storage.insertDataAndState(task, mockData, mockData[0]);
    
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO market_data_tiingo');
    expect(mockConnection.query.mock.calls[0][1][0][0][1]).toBe('2020-01-01'); // parsed date
  });

  it('sollte FRED Daten speichern', async () => {
    const storage = new Storage({});
    const task = { id: 'fred_woral', provider: 'FRED', params: { series_id: 'WORAL' } };
    const mockData = [{ date: '2021-01-01', value: '.' }, { date: '2021-01-02', value: 42 }];
    
    await storage.insertDataAndState(task, mockData, mockData[1]);
    
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO econ_fred');
    expect(mockConnection.query.mock.calls[0][1][0][0][2]).toBeNull(); // '.' is mapped to null
    expect(mockConnection.query.mock.calls[0][1][0][1][2]).toBe(42);
  });

  it('sollte FiscalData TGA speichern', async () => {
    const storage = new Storage({});
    const task = { id: 'fiscaldata_tga', provider: 'FiscalData' };
    const mockData = [{ record_date: '2021-01-01', open_today_bal: 100, close_today_bal: 110, account_type: 'Federal Reserve Account' }];
    
    await storage.insertDataAndState(task, mockData, mockData[0]);
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO fiscal_tga');
    expect(mockConnection.query.mock.calls[0][1][0].length).toBe(1);
  });

  it('sollte FiscalData TGA leeres Array ignorieren falls kein valider account_type', async () => {
    const storage = new Storage({});
    const task = { id: 'fiscaldata_tga', provider: 'FiscalData' };
    const mockData = [{ record_date: '2021-01-01', open_today_bal: 100, close_today_bal: 110, account_type: 'Some Other Account' }];
    
    await storage.insertDataAndState(task, mockData, mockData[0]);
    // Nur der State Query wird ausgeführt, nicht der Data Query
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO sync_states');
  });

  it('sollte FiscalData Auctions speichern', async () => {
    const storage = new Storage({});
    const task = { id: 'fiscaldata_auctions', provider: 'FiscalData' };
    const mockData = [{ record_date: '2021-01-01', cusip: 'C123', security_type: 'Bill', total_accepted: 1000, high_yield: 1.5 }];
    
    await storage.insertDataAndState(task, mockData, mockData[0]);
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO fiscal_auctions');
  });

  it('sollte YahooFinance speichern', async () => {
    const storage = new Storage({});
    const task = { id: 'yahoo_dxy', provider: 'YahooFinance', ticker: 'DX-Y.NYB' };
    const mockData = [{ date: new Date('2021-01-01T15:00:00Z'), open: 90, high: 91, low: 89, close: 90.5, volume: 100 }];
    
    await storage.insertDataAndState(task, mockData, mockData[0]);
    expect(mockConnection.query.mock.calls[0][0]).toContain('INSERT INTO market_data_yahoo');
    expect(mockConnection.query.mock.calls[0][1][0][0][1]).toBe('2021-01-01');
  });

  it('sollte bei fehlendem dbKey für Tiingo einen Fehler werfen', async () => {
    const storage = new Storage({});
    const task = { id: 'tiingo_fail', provider: 'Tiingo' };
    await expect(storage.insertDataAndState(task, [{}], {})).rejects.toThrow(/Invalid or missing ticker/i);
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  it('sollte bei fehlerhaftem dbKey für Tiingo einen Fehler werfen', async () => {
    const storage = new Storage({});
    const task = { id: 'tiingo_fail2', provider: 'Tiingo', ticker: 123 };
    await expect(storage.insertDataAndState(task, [{}], {})).rejects.toThrow(/Invalid or missing ticker/i);
  });

  it('sollte bei fehlendem series_id für FRED einen Fehler werfen', async () => {
    const storage = new Storage({});
    const task = { id: 'fred_fail', provider: 'FRED', params: {} };
    await expect(storage.insertDataAndState(task, [{}], {})).rejects.toThrow(/Missing series_id in params/i);
  });

  it('sollte bei ungültigem Datum für YahooFinance einen Fehler werfen', async () => {
    const storage = new Storage({});
    const task = { id: 'yahoo_fail', provider: 'YahooFinance', ticker: 'AAPL' };
    const mockData = [{ date: new Date('not-a-date'), open: 90 }];
    await expect(storage.insertDataAndState(task, mockData, mockData[0])).rejects.toThrow(/Invalid date in YahooFinance/i);
  });
  
  it('sollte bei fehlendem Datum für YahooFinance einen Fehler werfen', async () => {
    const storage = new Storage({});
    const task = { id: 'yahoo_fail2', provider: 'YahooFinance', ticker: 'AAPL' };
    const mockData = [{ open: 90 }];
    await expect(storage.insertDataAndState(task, mockData, mockData[0])).rejects.toThrow(/Missing date in YahooFinance/i);
  });

  it('sollte YahooFinance Datum-String verarbeiten können', async () => {
    const storage = new Storage({});
    const task = { id: 'yahoo_dxy', provider: 'YahooFinance', ticker: 'DX-Y.NYB' };
    const mockData = [{ date: '2021-01-02T00:00:00Z', open: 90 }];
    await storage.insertDataAndState(task, mockData, mockData[0]);
    expect(mockConnection.query.mock.calls[0][1][0][0][1]).toBe('2021-01-02');
  });
  
  it('sollte bei Tiingo daily als Fallback-Resolution verwenden', async () => {
    const storage = new Storage({});
    const task = { id: 'tiingo_spy', provider: 'Tiingo', ticker: 'SPY' }; // Ohne resolution
    const mockData = [{ date: '2020-01-01T00:00:00.000Z', open: 1 }];
    await storage.insertDataAndState(task, mockData, mockData[0]);
    expect(mockConnection.query.mock.calls[0][1][0][0][2]).toBe('daily');
  });

  it('sollte die DB-Verbindung sauber schließen', async () => {
    const storage = new Storage({});
    await storage.close();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it('sollte einen Fehler werfen und Rollback durchführen, wenn der Provider unbekannt ist', async () => {
    const storage = new Storage({});
    const task = { id: 'unknown_task', provider: 'GhostProvider' };
    await expect(storage.insertDataAndState(task, [{ id: 1 }], { id: 1 })).rejects.toThrow(/No storage adapter found/);
    expect(mockConnection.rollback).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });

  it('sollte Rollback durchführen, wenn der SyncState-Insert fehlschlägt', async () => {
    const storage = new Storage({});
    const task = { id: 'binance_btc', provider: 'Binance', params: { symbol: 'BTCUSDT', interval: '1d' } };
    const mockData = [ [1600000000, 10, 12, 9, 11, 100, 1600086400, 1100, 50, 40, 440, 0] ];
    
    // Die erste Query (Daten-Insert) geht durch, die zweite (State-Insert) schlägt fehl
    mockConnection.query.mockResolvedValueOnce().mockRejectedValueOnce(new Error('State Insert Failed'));
    
    await expect(storage.insertDataAndState(task, mockData, mockData[0])).rejects.toThrow('State Insert Failed');
    expect(mockConnection.rollback).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });
});
