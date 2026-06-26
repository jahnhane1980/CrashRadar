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
    const data = await repo.getAllRawData('2023-01-01');
    expect(data.btc).toBeDefined();
    
    const state = await repo.getInitialState('2023-01-01');
    expect(state.BTC).toBe(100);
    
    await repo.close();
  });

  it('sollte Fehler werfen ohne DB URL', () => {
    const originalEnv = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => new AnalysisRepository()).toThrow('No database URL provided for AnalysisRepository.');
    process.env.DATABASE_URL = originalEnv;
  });
});
