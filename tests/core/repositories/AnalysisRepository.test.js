import { describe, it, expect, vi } from 'vitest';
import { AnalysisRepository } from '../../../src/core/repositories/AnalysisRepository.js';

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn().mockReturnValue({
      query: vi.fn().mockResolvedValue([[{ val: 100 }]]),
      end: vi.fn()
    })
  }
}));

describe('AnalysisRepository', () => {
  it('sollte initialisiert werden und getAllRawData abrufen können', async () => {
    const repo = new AnalysisRepository('mysql://dummy');
    
    repo.pool.query = vi.fn().mockImplementation(async (sql) => {
        if (sql.includes('econ_challenger')) {
            if (sql.includes('LIMIT 1')) {
                // getInitialState query
                return [[{ val: 40000 }]];
            }
            // getAllRawData query
            return [[{ date: '2023-01-01', Challenger: 45000 }]];
        }
        if (sql.includes('market_data_aaii')) {
            if (sql.includes('LIMIT 1')) return [[{ val: 20 }]];
            return [[{ date: '2023-01-01', AAII_Spread: 25 }]];
        }
        if (sql.includes('market_data_dix')) {
            if (sql.includes('LIMIT 1')) return [[{ val: 40 }]];
            return [[{ date: '2023-01-01', DIX: 45 }]];
        }
        // Fallback for all other queries
        return [[{ val: 100 }]];
    });

    const data = await repo.getAllRawData('2023-01-01');
    expect(data.btc).toBeDefined();
    expect(data.challenger).toBeDefined();
    expect(data.challenger[0].Challenger).toBe(45000);
    expect(data.aaii).toBeDefined();
    expect(data.aaii[0].AAII_Spread).toBe(25);
    expect(data.dix).toBeDefined();
    
    const state = await repo.getInitialState('2023-01-01');
    expect(state.BTC).toBe(100);
    expect(state.Challenger).toBe(40000);
    expect(state.AAII_Spread).toBe(20);
    expect(state.DIX).toBe(40);
    
    await repo.close();
  });

  it('sollte Fehler werfen ohne DB URL', () => {
    const originalEnv = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => new AnalysisRepository()).toThrow('No database URL provided for AnalysisRepository.');
    process.env.DATABASE_URL = originalEnv;
  });

  it('sollte close() mehrfach aufrufen können (pool is null)', async () => {
    const repo = new AnalysisRepository('mysql://dummy');
    await repo.close();
    await expect(repo.close()).resolves.not.toThrow();
  });

  it('sollte TGA korrekt verarbeiten wenn close_balance "null" ist', async () => {
    // Override mock just for this test
    const mockQuery = vi.fn().mockImplementation(async (sql) => {
        if (sql.includes('fiscal_tga')) {
            return [[{ open_balance: '1234000', close_balance: 'null' }]];
        }
        return [[{ val: null }]];
    });
    
    const mockPool = { query: mockQuery, end: vi.fn() };
    const mysql = (await import('mysql2/promise')).default;
    mysql.createPool.mockReturnValueOnce(mockPool);
    
    const repo = new AnalysisRepository('mysql://dummy');
    const state = await repo.getInitialState('2023-01-01');
    
    expect(state.TGA).toBe(1234); // 1234000 / 1000
    await repo.close();
  });
});
