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

  describe('getEventForDate', () => {
    it('gibt das Event für ein passendes Datum zurück', () => {
      const service = new ScenarioChecklistService(mockConfig);
      const event = service.getEventForDate('2026-09-01');
      expect(event).toBeDefined();
      expect(event.id).toBe('jolts_july');
    });

    it('gibt null zurück, wenn für das Datum kein Event existiert', () => {
      const service = new ScenarioChecklistService(mockConfig);
      expect(service.getEventForDate('2026-09-02')).toBeNull();
    });
  });

  describe('getRequiredTaskIdsForEvent', () => {
    it('ermittelt Task-IDs für Single-Rule Event (z.B. JOLTS -> fred_jtsjol)', () => {
      const service = new ScenarioChecklistService(mockConfig);
      const event = service.getEventForDate('2026-09-01');
      const taskIds = service.getRequiredTaskIdsForEvent(event);
      expect(taskIds).toEqual(['fred_jtsjol']);
    });

    it('ermittelt Task-IDs für Multi-Rule Event (z.B. NFP -> fred_payems, fred_sahmrealtime)', () => {
      const service = new ScenarioChecklistService(mockConfig);
      const event = service.getEventForDate('2026-09-04');
      const taskIds = service.getRequiredTaskIdsForEvent(event);
      expect(taskIds).toContain('fred_payems');
      expect(taskIds).toContain('fred_sahmrealtime');
      expect(taskIds.length).toBe(2);
    });

    it('gibt leeres Array bei null/undefined zurück', () => {
      const service = new ScenarioChecklistService(mockConfig);
      expect(service.getRequiredTaskIdsForEvent(null)).toEqual([]);
    });
  });

  describe('Freshness-Guard & targetObservationDate', () => {
    const configWithObservationDates = {
      activeScenario: 'goldilocks_september_2026',
      scenarios: {
        goldilocks_september_2026: {
          id: 'goldilocks_september_2026',
          title: 'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
          events: [
            {
              id: 'jolts_july',
              title: 'US JOLTS Report (Berichtsmonat: Juli)',
              date: '2026-09-01',
              metric: 'JTSJOL',
              targetObservationDate: '2026-07-01',
              rule: { type: 'RANGE', min: 7000, max: 8200 }
            }
          ]
        }
      }
    };

    it('gibt shouldNotify: false und isPending: true zurück, wenn FRED-Daten noch den Vormonat haben', () => {
      const service = new ScenarioChecklistService(configWithObservationDates);
      const staleTimeline = [
        {
          date: '2026-09-01',
          macroGroups: { LaborMarket: { JTSJOL: 7359 } },
          observationDates: { JTSJOL: '2026-06-01' } // Nur Juni vorhanden!
        }
      ];

      const result = service.evaluate('2026-09-01', staleTimeline);
      expect(result.shouldNotify).toBe(false);
      expect(result.isPending).toBe(true);
      expect(result.pendingEvent.isPending).toBe(true);
      expect(result.pendingEvent.reason).toContain('2026-07-01 noch nicht publiziert');
    });

    it('wertet erfolgreich aus und gibt shouldNotify: true zurück, wenn Juli-Daten vorliegen', () => {
      const service = new ScenarioChecklistService(configWithObservationDates);
      const freshTimeline = [
        {
          date: '2026-09-01',
          macroGroups: { LaborMarket: { JTSJOL: 7650 } },
          observationDates: { JTSJOL: '2026-07-01' } // Juli vorhanden!
        }
      ];

      const result = service.evaluate('2026-09-01', freshTimeline);
      expect(result.shouldNotify).toBe(true);
      expect(result.evaluation.passedCount).toBe(1);
      expect(result.evaluation.totalEvaluated).toBe(1);
    });
  });

  describe('MoM und YoY Transformationen bei täglichem Forward-Fill', () => {
    const fullScenarioConfig = {
      activeScenario: 'goldilocks_september_2026',
      scenarios: {
        goldilocks_september_2026: {
          id: 'goldilocks_september_2026',
          title: 'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
          events: [
            {
              id: 'nfp_august',
              title: 'US-Arbeitsmarktbericht / NFP (Berichtsmonat: August)',
              date: '2026-09-04',
              time: '14:30 MESZ',
              targetObservationDate: '2026-08-01',
              rules: [
                { metric: 'PAYEMS_DIFF', type: 'MIN', min: 40, passMsg: 'Stellenaufbau stabil (>=40k)', failMsg: 'Stellenaufbau bricht ein (<40k)' },
                { metric: 'SAHMREALTIME', type: 'MAX', max: 0.5, passMsg: 'Sahm ruhig (<0.50)', failMsg: 'Sahm Alarm (>0.50)' }
              ]
            },
            {
              id: 'ppi_august',
              title: 'US Erzeugerpreisindex / PPI (Berichtsmonat: August)',
              date: '2026-09-10',
              time: '14:30 MESZ',
              metric: 'PPIACO_YOY',
              targetObservationDate: '2026-08-01',
              rule: { type: 'MAX', max: 9.0, unit: '%' }
            },
            {
              id: 'cpi_core_august',
              title: 'US Core CPI Inflation (Berichtsmonat: August)',
              date: '2026-09-11',
              time: '14:30 MESZ',
              metric: 'CPILFESL_YOY',
              targetObservationDate: '2026-08-01',
              rule: { type: 'MAX', max: 2.7, unit: '%' }
            },
            {
              id: 'fomc_september',
              title: 'FOMC Zinsentscheid',
              date: '2026-09-16',
              time: '20:00 MESZ',
              metric: 'DFF_ACTION',
              targetObservationDate: '2026-09-16',
              rule: { type: 'ALLOWED_VALUES', allowed: ['PAUSE', 'CUT_25', 'CUT_50'] }
            },
            {
              id: 'pce_core_august',
              title: 'Core PCE Preisindex (Berichtsmonat: August)',
              date: '2026-09-30',
              time: '14:30 MESZ',
              metric: 'PCEPILFE_YOY',
              targetObservationDate: '2026-08-01',
              rule: { type: 'MAX', max: 3.5, unit: '%' }
            }
          ]
        }
      }
    };

    const dailyTimelineWithHistory = [
      {
        date: '2025-08-01',
        macroGroups: {
          LaborMarket: { PAYEMS: 156000 },
          Leading: { PPI: 250.0, CPI_Core: 317.0, PCE_Core: 120.0 }
        },
        observationDates: { PAYEMS: '2025-08-01', PPIACO: '2025-08-01', CPILFESL: '2025-08-01', PCEPILFE: '2025-08-01' }
      },
      {
        date: '2026-07-31',
        macroGroups: {
          LaborMarket: { PAYEMS: 158800 },
          Leading: { SahmRule: 0.40, PPI: 254.0, CPI_Core: 324.0, PCE_Core: 123.0 },
          FinancialConditions: { FedFundsRate: 5.33 }
        },
        observationDates: { PAYEMS: '2026-07-01', SAHMREALTIME: '2026-07-01', PPIACO: '2026-07-01', CPILFESL: '2026-07-01', PCEPILFE: '2026-07-01' }
      },
      {
        date: '2026-08-01',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.33 }
        },
        observationDates: { PAYEMS: '2026-08-01', SAHMREALTIME: '2026-08-01', PPIACO: '2026-08-01', CPILFESL: '2026-08-01', PCEPILFE: '2026-08-01' }
      },
      {
        date: '2026-09-03',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.33 }
        },
        observationDates: { PAYEMS: '2026-08-01', SAHMREALTIME: '2026-08-01', PPIACO: '2026-08-01', CPILFESL: '2026-08-01', PCEPILFE: '2026-08-01' }
      },
      {
        date: '2026-09-04',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.33 }
        },
        observationDates: { PAYEMS: '2026-08-01', SAHMREALTIME: '2026-08-01', PPIACO: '2026-08-01', CPILFESL: '2026-08-01', PCEPILFE: '2026-08-01' }
      },
      {
        date: '2026-09-10',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.33 }
        },
        observationDates: { PAYEMS: '2026-08-01', SAHMREALTIME: '2026-08-01', PPIACO: '2026-08-01', CPILFESL: '2026-08-01', PCEPILFE: '2026-08-01' }
      },
      {
        date: '2026-09-11',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.33 }
        },
        observationDates: { PAYEMS: '2026-08-01', SAHMREALTIME: '2026-08-01', PPIACO: '2026-08-01', CPILFESL: '2026-08-01', PCEPILFE: '2026-08-01' }
      },
      {
        date: '2026-09-16',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.08 } // 25 bps Cut!
        },
        observationDates: { DFF: '2026-09-16' }
      },
      {
        date: '2026-09-30',
        macroGroups: {
          LaborMarket: { PAYEMS: 158942 },
          Leading: { SahmRule: 0.42, PPI: 255.0, CPI_Core: 325.4, PCE_Core: 123.6 },
          FinancialConditions: { FedFundsRate: 5.08 }
        },
        observationDates: { PAYEMS: '2026-08-01', PPIACO: '2026-08-01', CPILFESL: '2026-08-01', PCEPILFE: '2026-08-01' }
      }
    ];

    it('berechnet PAYEMS_DIFF am 04.09. korrekt als Monats-Delta (+142k) statt 0k', () => {
      const service = new ScenarioChecklistService(fullScenarioConfig);
      const result = service.evaluate('2026-09-04', dailyTimelineWithHistory);

      expect(result.shouldNotify).toBe(true);
      expect(result.evaluation.passedCount).toBe(1);
      const nfpEvent = result.evaluation.evaluatedEvents.find(e => e.id === 'nfp_august');
      expect(nfpEvent.passed).toBe(true);
      expect(nfpEvent.details[0].value).toBe(142);
      expect(nfpEvent.details[0].passed).toBe(true);
    });

    it('berechnet PPI YoY (255 vs 250 -> 2.0%) korrekt und besteht <= 9.0%', () => {
      const service = new ScenarioChecklistService(fullScenarioConfig);
      const result = service.evaluate('2026-09-10', dailyTimelineWithHistory);

      const ppiEvent = result.evaluation.evaluatedEvents.find(e => e.id === 'ppi_august');
      expect(ppiEvent.passed).toBe(true);
      expect(ppiEvent.value).toBe(2.0);
    });

    it('berechnet Core CPI YoY (325.4 vs 317.0 -> 2.65%) korrekt und besteht <= 2.7%', () => {
      const service = new ScenarioChecklistService(fullScenarioConfig);
      const result = service.evaluate('2026-09-11', dailyTimelineWithHistory);

      const cpiEvent = result.evaluation.evaluatedEvents.find(e => e.id === 'cpi_core_august');
      expect(cpiEvent.passed).toBe(true);
      expect(cpiEvent.value).toBe(2.65);
    });

    it('erkennt Zinssenkung um 25 bps als CUT_25 am FOMC-Tag', () => {
      const service = new ScenarioChecklistService(fullScenarioConfig);
      const result = service.evaluate('2026-09-16', dailyTimelineWithHistory);

      const fomcEvent = result.evaluation.evaluatedEvents.find(e => e.id === 'fomc_september');
      expect(fomcEvent.passed).toBe(true);
      expect(fomcEvent.value).toBe('CUT_25');
    });

    it('berechnet Core PCE YoY (123.6 vs 120.0 -> 3.0%) korrekt und besteht <= 3.5%', () => {
      const service = new ScenarioChecklistService(fullScenarioConfig);
      const result = service.evaluate('2026-09-30', dailyTimelineWithHistory);

      const pceEvent = result.evaluation.evaluatedEvents.find(e => e.id === 'pce_core_august');
      expect(pceEvent.passed).toBe(true);
      expect(pceEvent.value).toBe(3.0);
    });
  });
});