import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('mysql2/promise', () => {
  return {
    default: {
      createPool: vi.fn()
    }
  };
});
import mysql from 'mysql2/promise';
import { MaturityWallBuilder } from '../../src/services/MaturityWallBuilder.js';

describe('MaturityWallBuilder', () => {
  let builder;
  let mockPool;

  beforeEach(() => {
    process.env.DATABASE_URL = 'mysql://dummy';
    mockPool = {
      query: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      end: vi.fn()
    };
    mysql.createPool.mockReturnValue(mockPool);
    
    builder = new MaturityWallBuilder();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sollte Fehler werfen wenn keine DATABASE_URL vorhanden ist', () => {
    delete process.env.DATABASE_URL;
    expect(() => new MaturityWallBuilder()).toThrow(/No database URL provided/i);
    process.env.DATABASE_URL = 'mysql://dummy';
  });

  it('sollte Maturity Wall korrekt via SQL aggregieren (Query ausgeführt)', async () => {
    await builder.build('2024-01-01');

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockPool.query.mock.calls[0];
    
    expect(sql).toContain('REPLACE INTO macro_maturity_wall');
    expect(sql).toContain('SELECT IFNULL(SUM(a.total_accepted), 0) / 1000000000.0');
    expect(sql).toContain("LIKE '%Bill%'");
    expect(sql).toContain('DATE_ADD(t.record_date, INTERVAL 90 DAY)');
    
    expect(params).toEqual(['2024-01-01']);
  });

  it('sollte die DB-Verbindung sauber schließen', async () => {
    await builder.close();
    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });
});
