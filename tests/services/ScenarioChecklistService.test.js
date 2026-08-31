import { describe, it, expect } from 'vitest';
import { ScenarioChecklistService } from '../../src/services/ScenarioChecklistService.js';

describe('ScenarioChecklistService', () => {
  const mockConfig = {
    activeScenario: 'goldilocks_september_2026',
    scenarios: {
      goldilocks_september_2026: {
        id: 'goldilocks_september_2026',
        title: 'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
        timeframe: '01.09.2026 - 30.09.2026',
        tgaTargetCollision: '26.10.2026 - 10.11.2026',
        events: [
          {
            id: 'jolts_july',
            title: 'US JOLTS Report (Juli)',
            date: '2026-09-01',
            time: '16:00 MESZ',
            metric: 'JTSJOL',
            rule: { type: 'RANGE', min: 7000, max: 8200 },
            passMessage: 'Offene Stellen kühlen sich moderat ab',
            failMessage: 'Abrupter Einbruch der offenen Stellen!'
          },
          {
            id: 'nfp_august',
            title: 'US-Arbeitsmarktbericht (August)',
            date: '2026-09-04',
            time: '14:30 MESZ',
            rules: [
              { metric: 'PAYEMS_DIFF', type: 'MIN', min: 100, passMsg: 'Solider Stellenzuwachs (>=100k)', failMsg: 'Stellenaufbau zu schwach (<100k)' },
              { metric: 'SAHMREALTIME', type: 'MAX', max: 0.50, passMsg: 'Sahm-Regel ruhig (<0.50)', failMsg: 'Sahm-Regel getriggert (>0.50)' }
            ]
          },
          {
            id: 'cpi_core_august',
            title: 'US Core CPI Inflation (August)',
            date: '2026-09-11',
            time: '14:30 MESZ',
            metric: 'CPILFESL_YOY',
            rule: { type: 'MAX', max: 3.4 },
            passMessage: 'Kerninflation im Rahmen (Disinflation intakt)',
            failMessage: 'Kerninflation klebt zäh fest (>3.4%)'
          }
        ]
      }
    }
  };

  const sampleTimeline = [
    {
      date: '2026-08-31',
      macroGroups: {
        LaborMarket: { JTSJOL: 7600, PAYEMS: 158000 },
        Leading: { SahmRule: 0.40, CPI_Core: 3.2 },
        FinancialConditions: { FedFundsRate: 3.63 }
      }
    },
    {
      date: '2026-09-01',
      macroGroups: {
        LaborMarket: { JTSJOL: 7650, PAYEMS: 158000 },
        Leading: { SahmRule: 0.40, CPI_Core: 3.2 },
        FinancialConditions: { FedFundsRate: 3.63 }
      }
    },
    {
      date: '2026-09-04',
      macroGroups: {
        LaborMarket: { JTSJOL: 7650, PAYEMS: 158125 }, // +125k Delta
        Leading: { SahmRule: 0.42, CPI_Core: 3.2 },
        FinancialConditions: { FedFundsRate: 3.63 }
      }
    },
    {
      date: '2026-09-11',
      macroGroups: {
        LaborMarket: { JTSJOL: 7650, PAYEMS: 158125 },
        Leading: { SahmRule: 0.42, CPI_Core: 3.65 }, // Fail: 3.65 > 3.4
        FinancialConditions: { FedFundsRate: 3.63 }
      }
    }
  ];

  it('gibt shouldNotify: false zurück an Tagen ohne Event', () => {
    const service = new ScenarioChecklistService(mockConfig);
    const result = service.evaluate('2026-09-02', sampleTimeline);
    expect(result.shouldNotify).toBe(false);
  });

  it('wertet das 1. Event (01.09. JOLTS) erfolgreich aus (PASS 1/1)', () => {
    const service = new ScenarioChecklistService(mockConfig);
    const result = service.evaluate('2026-09-01', sampleTimeline);

    expect(result.shouldNotify).toBe(true);
    expect(result.title).toBe('SEPTEMBER 2026: GOLDILOCKS-SCORECARD');
    expect(result.priority).toBe('default');
    expect(result.tags).toBe('trophy');
    expect(result.evaluation.passedCount).toBe(1);
    expect(result.evaluation.totalEvaluated).toBe(1);
    expect(result.message).toContain('1 / 1 Kriterien ERFÜLLT');
    expect(result.message).toContain('01.09. US JOLTS Report (Juli): 🟢 PASS');
    expect(result.message).toContain('⏳ NÄCHSTE PRÜFUNG:');
    expect(result.message).toContain('04.09. 14:30 MESZ: US-Arbeitsmarktbericht (August)');
  });

  it('schleift am 2. Event (04.09. NFP) das vorherige JOLTS-Event kumulativ mit (PASS 2/2)', () => {
    const service = new ScenarioChecklistService(mockConfig);
    const result = service.evaluate('2026-09-04', sampleTimeline);

    expect(result.shouldNotify).toBe(true);
    expect(result.evaluation.passedCount).toBe(2);
    expect(result.evaluation.totalEvaluated).toBe(2);
    expect(result.message).toContain('2 / 2 Kriterien ERFÜLLT');
    expect(result.message).toContain('01.09. US JOLTS Report (Juli): 🟢 PASS');
    expect(result.message).toContain('04.09. US-Arbeitsmarktbericht (August): 🟢 PASS');
  });

  it('formatiert eine rote FAIL-Zeile mit Grund bei Kriterien-Verletzung (z.B. CPI)', () => {
    const service = new ScenarioChecklistService(mockConfig);
    const result = service.evaluate('2026-09-11', sampleTimeline);

    expect(result.shouldNotify).toBe(true);
    expect(result.priority).toBe('high');
    expect(result.tags).toBe('warning');
    expect(result.evaluation.passedCount).toBe(2);
    expect(result.evaluation.totalEvaluated).toBe(3);
    expect(result.message).toContain('2 / 3 Kriterien ERFÜLLT (Achtung: Dämpfer!)');
    expect(result.message).toContain('11.09. US Core CPI Inflation (August): 🔴 FAIL');
    expect(result.message).toContain('↳ Grund: Kerninflation klebt zäh fest (>3.4%)');
  });

  it('behandelt inaktives Szenario gracefully (shouldNotify: false)', () => {
    const inactiveConfig = { activeScenario: null, scenarios: {} };
    const service = new ScenarioChecklistService(inactiveConfig);
    const result = service.evaluate('2026-09-01', sampleTimeline);
    expect(result.shouldNotify).toBe(false);
  });
});