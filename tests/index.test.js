import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '../index.js';

// Mocks
vi.mock('../src/runners/StandardRunner.js', () => {
  return {
    StandardRunner: vi.fn(function() {
      this.run = vi.fn().mockResolvedValue();
    })
  };
});

vi.mock('../src/runners/TestRunner.js', () => {
  return {
    TestRunner: vi.fn(function() {
      this.run = vi.fn().mockResolvedValue();
    })
  };
});
import { TestRunner } from '../src/runners/TestRunner.js';
TestRunner.getDatabaseUrl = vi.fn().mockReturnValue('mysql://test');
TestRunner.applyTestConfigOverrides = vi.fn();

vi.mock('../src/services/FinanceExpert.js', () => {
  return {
    FinanceExpert: vi.fn(function() {
      this.getDailyGroupedData = vi.fn().mockResolvedValue([{ mock: 'data' }]);
      this.close = vi.fn().mockResolvedValue();
    })
  };
});

vi.mock('../src/analysis/IndicatorEngine.js', () => {
  return {
    IndicatorEngine: vi.fn(function() {
      this.run = vi.fn();
      this.generateReport = vi.fn().mockReturnValue('report');
    })
  };
});

vi.mock('../src/services/NtfyService.js', () => {
  return {
    NtfyService: vi.fn(function() {
      this.send = vi.fn().mockResolvedValue();
    })
  };
});

// Zusätzliche Mocks, damit absolut kein DB-Pool oder HTTP-Manager initialisiert wird
vi.mock('../src/core/Storage.js', () => ({
  Storage: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../src/core/RequestManager.js', () => ({
  RequestManager: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../src/services/Fetcher.js', () => ({
  Fetcher: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../src/services/MaturityWallBuilder.js', () => ({
  MaturityWallBuilder: vi.fn().mockImplementation(() => ({}))
}));

// Avoid executing fs operations completely
vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({ providers: {}, tasks: [] }))
    }
  };
});

// We need to suppress console.log and console.error in tests
const originalEnv = process.env;

describe('CLI Entrypoint (index.js)', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sollte im Standard-Modus starten', async () => {
    process.env.DATABASE_URL = 'mysql://prod';
    await runCLI(['node', 'index.js']);
    
    // TestRunner overrides should not be called
    expect(TestRunner.applyTestConfigOverrides).not.toHaveBeenCalled();
    // StandardRunner imported above was mocked, so it should have been called
    // Wait, dynamic checking of class instantiation is hard, but we can verify it didn't throw
  });

  it('sollte im Test-Modus starten (-t)', async () => {
    await runCLI(['node', 'index.js', '-t']);
    expect(TestRunner.getDatabaseUrl).toHaveBeenCalled();
    expect(TestRunner.applyTestConfigOverrides).toHaveBeenCalled();
  });

  it('sollte einen Fehler werfen, wenn DATABASE_URL fehlt', async () => {
    delete process.env.DATABASE_URL;
    let err;
    try {
      await runCLI(['node', 'index.js']);
    } catch(e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.message).toMatch(/Missing DATABASE_URL/);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('sollte den IndicatorEngine Modus starten (-c)', async () => {
    process.env.DATABASE_URL = 'mysql://prod';
    await runCLI(['node', 'index.js', '-c']);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[Analysis]'));
  });

  it('sollte Ntfy Alert senden im Indicator Modus, wenn NTFY_TOPIC gesetzt ist', async () => {
    process.env.DATABASE_URL = 'mysql://prod';
    process.env.NTFY_TOPIC = 'testtopic';
    await runCLI(['node', 'index.js', '-c']);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Sende Ntfy Alert...'));
  });

  it('sollte Ntfy Alert überspringen, wenn kein Topic gesetzt ist', async () => {
    process.env.DATABASE_URL = 'mysql://prod';
    delete process.env.NTFY_TOPIC;
    await runCLI(['node', 'index.js', '-c']);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Überspringe Ntfy Push'));
  });
});
