import { Logger } from '../../Logger.js';

export class CalendarFetchAdapter {
  constructor() {}

  /**
   * Generiert den 1. Mittwoch eines bestimmten Monats
   * @param {number} year 
   * @param {number} monthIndex (0 = Jan, 1 = Feb, etc.)
   * @returns {string} YYYY-MM-DD
   */
  static getFirstWednesdayOfMonth(year, monthIndex) {
    const d = new Date(Date.UTC(year, monthIndex, 1));
    const dayOfWeek = d.getUTCDay();
    const daysUntilWednesday = (3 - dayOfWeek + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysUntilWednesday);
    return d.toISOString().split('T')[0];
  }

  /**
   * Berechnet den Berichtsmonats-Stichtag (targetObservationDate) anhand des Veröffentlichungstages.
   * @param {string} releaseDateStr - 'YYYY-MM-DD'
   * @param {number} lookbackMonths - Standard: 1 Monat
   * @returns {string} 'YYYY-MM-01'
   */
  static calculateTargetObservationDate(releaseDateStr, lookbackMonths = 1) {
    const [y, m] = releaseDateStr.split('-').map(Number);
    let targetYear = y;
    let targetMonth = m - lookbackMonths;
    while (targetMonth < 1) {
      targetMonth += 12;
      targetYear -= 1;
    }
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  }

  /**
   * Definitionen der offiziellen Makro-Releases von BLS und BEA
   */
  static getMacroReleaseConfigs() {
    return [
      {
        id: 50,
        eventCode: 'PAYEMS',
        category: 'MACRO_RELEASE',
        subcategory: 'LABOR',
        title: 'US-Arbeitsmarktbericht / Nonfarm Payrolls (NFP)',
        time: '14:30 MESZ',
        criticality: 'CRITICAL',
        lookbackMonths: 1,
        passMessage: 'Arbeitsmarkt stabil im neutralen Korridor',
        failMessage: 'Arbeitsmarktdaten schlagen Alarm (Rezessionssorgen oder Sahm-Trigger)',
        rules: [
          { metric: 'PAYEMS_DIFF', type: 'MIN', min: 40, passMsg: 'Stellenaufbau stabil im Erwartungskorridor (>=40k / Konsens 55k)', failMsg: 'Stellenaufbau bricht ein (<40k / Rezessionsgefahr)' },
          { metric: 'SAHMREALTIME', type: 'MAX', max: 0.5, passMsg: 'Sahm-Regel ruhig (<0.50)', failMsg: 'Sahm-Regel getriggert (>0.50 / Rezessions-Alarm)' }
        ]
      },
      {
        id: 192,
        eventCode: 'JTSJOL',
        category: 'MACRO_RELEASE',
        subcategory: 'LABOR',
        title: 'US JOLTS Report (Offene Stellen)',
        time: '16:00 MESZ',
        criticality: 'HIGH',
        lookbackMonths: 2,
        passMessage: 'Offene Stellen kühlen sich moderat ab (6.9M - 7.8M / kein abrupter Einbruch)',
        failMessage: 'Offene Stellen außerhalb des Zielkorridors (<6.9M oder >7.8M)!',
        rules: [
          { metric: 'JTSJOL', type: 'RANGE', min: 6900, max: 7800, passMsg: 'Offene Stellen moderat (6.9M - 7.8M)', failMsg: 'Offene Stellen außerhalb Korridor' }
        ]
      },
      {
        id: 10,
        eventCode: 'CPI_CORE',
        category: 'MACRO_RELEASE',
        subcategory: 'INFLATION',
        title: 'US Core CPI Inflation (Verbraucherpreise)',
        time: '14:30 MESZ',
        criticality: 'CRITICAL',
        lookbackMonths: 1,
        passMessage: 'Kerninflation bestätigt Disinflationspfad (<=2.7% / Nowcast: 2.38%)',
        failMessage: 'Kerninflation klebt zäh fest (>2.7%) – Zinsangst steigt!',
        rules: [
          { metric: 'CPILFESL_YOY', type: 'MAX', max: 2.7, passMsg: 'Kerninflation im Disinflationspfad (<=2.7%)', failMsg: 'Kerninflation zäh (>2.7%)' }
        ]
      },
      {
        id: 46,
        eventCode: 'PPI',
        category: 'MACRO_RELEASE',
        subcategory: 'PRODUCER_PRICES',
        title: 'US Erzeugerpreisindex (PPI)',
        time: '14:30 MESZ',
        criticality: 'HIGH',
        lookbackMonths: 1,
        passMessage: 'Rohstoff-Erzeugerpreise bestätigen Abkühlungspfad (<=9.0%)',
        failMessage: 'Erzeugerpreise ziehen unerwartet stark an (>9.0%)',
        rules: [
          { metric: 'PPIACO_YOY', type: 'MAX', max: 9.0, passMsg: 'Rohstoff-Erzeugerpreise bestätigen Abkühlungspfad (<=9.0%)', failMsg: 'Erzeugerpreise ziehen unerwartet stark an (>9.0%)' }
        ]
      },
      {
        id: 54,
        eventCode: 'PCE_CORE',
        category: 'MACRO_RELEASE',
        subcategory: 'INFLATION',
        title: 'Core PCE Preisindex (Fed-Preismaß)',
        time: '14:30 MESZ',
        criticality: 'CRITICAL',
        lookbackMonths: 1,
        passMessage: 'Offizielles Fed-Preismaß im Rahmen der Erwartungen (<=3.5% / Nowcast: 3.40%)',
        failMessage: 'Core PCE über Erwartung (>3.5%)',
        rules: [
          { metric: 'PCEPILFE_YOY', type: 'MAX', max: 3.5, passMsg: 'Core PCE im Rahmen (<=3.5%)', failMsg: 'Core PCE überhitzt (>3.5%)' }
        ]
      }
    ];
  }

  /**
   * Generiert die deterministischen QRA-Termine für ein Jahr
   * @param {number} year 
   * @returns {Array}
   */
  static generateQraEventsForYear(year, todayStr) {
    const quarters = [
      { q: 1, month: 1, targetRefunding: `Q2 ${year}` }, // Feb
      { q: 2, month: 4, targetRefunding: `Q3 ${year}` }, // Mai
      { q: 3, month: 7, targetRefunding: `Q4 ${year}` }, // Aug
      { q: 4, month: 10, targetRefunding: `Q1 ${year + 1}` } // Nov
    ];

    const events = [];
    for (const qInfo of quarters) {
      const dateStr = CalendarFetchAdapter.getFirstWednesdayOfMonth(year, qInfo.month);
      const isPast = dateStr < todayStr;
      events.push({
        id: `qra_${year}_q${qInfo.q}`,
        category: 'FISCAL',
        subcategory: 'QRA',
        title: `Treasury Quarterly Refunding Announcement (QRA Q${qInfo.q} ${year})`,
        event_date: dateStr,
        event_time: '14:30 MESZ',
        status: isPast ? 'COMPLETED' : 'CONFIRMED',
        criticality: 'HIGH',
        metadata_json: {
          quarter: `Q${qInfo.q}`,
          fiscalYear: `FY${year + (qInfo.month >= 9 ? 1 : 0)}`,
          targetRefundingQuarter: qInfo.targetRefunding,
          description: 'Festlegung der Auktionsvolumina für T-Bills vs. Nominal-Coupons'
        },
        source: 'TREASURY_QRA_SCHEDULE'
      });
    }
    return events;
  }

  async fetch(task, provider, startDate, requestManager) {
    Logger.info(`[CalendarFetchAdapter] Starte Ermittlung und Synchronisation aller Makro- und Fiskal-Events...`);
    const todayStr = new Date().toISOString().split('T')[0];
    const events = [];

    // 1. Fiscal Data API: Debt Subject to Limit (Table IIIC)
    let debtLimitData = null;
    try {
      const urlDebt = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/debt_subject_to_limit?sort=-record_date&page[size]=15';
      const json = await requestManager.fetch(urlDebt, task.provider, { responseType: 'json' });
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        debtLimitData = json.data;
      }
    } catch (e) {
      Logger.warn(`[CalendarFetchAdapter] Konnte FiscalData debt_subject_to_limit nicht abrufen: ${e.message}`);
    }

    // 2. Fiscal Data API: TGA Cash Balance
    let tgaCashMillion = 800000; // Konservativer Fallback
    try {
      const urlTga = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=5';
      const json = await requestManager.fetch(urlTga, task.provider, { responseType: 'json' });
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const item = json.data.find(d => d.open_today_bal && d.open_today_bal !== 'null');
        if (item) {
          tgaCashMillion = parseFloat(item.open_today_bal);
        }
      }
    } catch (e) {
      Logger.warn(`[CalendarFetchAdapter] Konnte FiscalData operating_cash_balance nicht abrufen: ${e.message}`);
    }

    // 3. Schuldenstand, Headroom und dynamisches X-Date kalkulieren
    if (debtLimitData && debtLimitData.length > 0) {
      const latestDate = debtLimitData[0].record_date;
      const recordsForDate = debtLimitData.filter(d => d.record_date === latestDate);
      
      let statutoryLimitMillion = null;
      let debtHeldByPublic = null;
      let intragovHoldings = null;

      for (const r of recordsForDate) {
        const catg = (r.debt_catg || '').toLowerCase();
        const bal = parseFloat(r.close_today_bal || 0);
        if (catg.includes('statutory debt limit')) {
          statutoryLimitMillion = bal;
        } else if (catg.includes('debt held by the public')) {
          debtHeldByPublic = bal;
        } else if (catg.includes('intragovernmental holdings')) {
          intragovHoldings = bal;
        }
      }

      if (statutoryLimitMillion && debtHeldByPublic !== null && intragovHoldings !== null) {
        const totalDebtSubjectToLimit = debtHeldByPublic + intragovHoldings;
        const headroomMillion = statutoryLimitMillion - totalDebtSubjectToLimit;
        const totalLiquidityMillion = headroomMillion + tgaCashMillion;

        const dailyBurnRateMillion = 5500;
        const projectedDaysRemaining = Math.max(15, Math.round(totalLiquidityMillion / dailyBurnRateMillion));
        
        const projDate = new Date(Date.now() + projectedDaysRemaining * 24 * 60 * 60 * 1000);
        const projectedDateStr = projDate.toISOString().split('T')[0];

        events.push({
          id: `debt_ceiling_status_${latestDate.substring(0, 7)}`,
          category: 'FISCAL',
          subcategory: 'DEBT_CEILING',
          title: 'US Debt Ceiling Status & Headroom',
          event_date: latestDate,
          event_time: '16:00 EDT',
          status: 'CONFIRMED',
          criticality: headroomMillion < 200000 ? 'CRITICAL' : (headroomMillion < 500000 ? 'HIGH' : 'MEDIUM'),
          metadata_json: {
            recordDate: latestDate,
            statutoryLimitMillion,
            debtSubjectToLimitMillion: totalDebtSubjectToLimit,
            headroomMillion,
            tgaCashMillion,
            headroomBillion: Math.round(headroomMillion / 1000),
            tgaCashBillion: Math.round(tgaCashMillion / 1000)
          },
          source: 'US_TREASURY_DTS_TABLE_IIIC'
        });

        events.push({
          id: 'debt_ceiling_x_date_projection',
          category: 'FISCAL',
          subcategory: 'DEBT_CEILING',
          title: 'Debt Ceiling Hard Collision (Projected Dynamic X-Date)',
          event_date: projectedDateStr,
          event_time: '23:59 EDT',
          status: 'ESTIMATED',
          criticality: 'CRITICAL',
          metadata_json: {
            asOfDate: latestDate,
            projectedDate: projectedDateStr,
            daysRemaining: projectedDaysRemaining,
            totalAvailableLiquidityBillion: Math.round(totalLiquidityMillion / 1000),
            assumedDailyBurnRateMillion: dailyBurnRateMillion,
            notes: 'Erschöpfung von Headroom + TGA Cash unter normaler Defizit-Dynamik'
          },
          source: 'US_TREASURY_CALCULATION'
        });
      }
    }

    // 4. QRA Termine rollierend für aktuelles und folgendes Jahr
    const currentYear = new Date().getFullYear();
    const qraCurrent = CalendarFetchAdapter.generateQraEventsForYear(currentYear, todayStr);
    const qraNext = CalendarFetchAdapter.generateQraEventsForYear(currentYear + 1, todayStr);
    events.push(...qraCurrent, ...qraNext);

    // 5. Haushaltsfristen & Continuing Resolution (CR)
    events.push({
      id: 'statutory_deadline_fy2027',
      category: 'FISCAL',
      subcategory: 'SHUTDOWN',
      title: 'US Federal Budget Statutory Deadline (End of FY2026 / Start of FY2027)',
      event_date: '2026-09-30',
      event_time: '23:59 EDT',
      status: 'EXTENDED',
      criticality: 'HIGH',
      metadata_json: {
        statutoryDeadline: '2026-09-30',
        effectiveDeadline: '2026-12-18',
        resolutionName: 'Continuing Appropriations Act, 2027',
        notes: 'Frist politisch vor den US-Zwischenwahlen auf den 18. Dezember 2026 verlängert.'
      },
      source: 'CONGRESS_ENACTED_CR'
    });

    events.push({
      id: 'cr_deadline_fy2027',
      category: 'FISCAL',
      subcategory: 'SHUTDOWN',
      title: 'Continuing Resolution Funding Deadline (Shutdown-Risikofenster)',
      event_date: '2026-12-18',
      event_time: '23:59 EDT',
      status: 'CONFIRMED',
      criticality: 'CRITICAL',
      metadata_json: {
        statutoryDeadline: '2026-09-30',
        effectiveDeadline: '2026-12-18',
        preElectionShieldActive: true,
        lameDuckRiskWindow: '2026-12-01 - 2026-12-18'
      },
      source: 'CONGRESS_ENACTED_CR'
    });

    // 6. FOMC Zinsentscheid-Termine
    const fomcDates = [
      { id: 'fomc_2026_09_16', date: '2026-09-16', time: '20:00 MESZ', title: 'FOMC Zinsentscheid & Notenbank-Signal (September)', sep: true },
      { id: 'fomc_2026_11_05', date: '2026-11-05', time: '20:00 MEZ', title: 'FOMC Zinsentscheid (November)', sep: false },
      { id: 'fomc_2026_12_16', date: '2026-12-16', time: '20:00 MEZ', title: 'FOMC Zinsentscheid & Wirtschaftsprojektionen (Dezember)', sep: true }
    ];

    for (const f of fomcDates) {
      const isPast = f.date < todayStr;
      events.push({
        id: f.id,
        category: 'CENTRAL_BANK',
        subcategory: 'FOMC',
        title: f.title,
        event_date: f.date,
        event_time: f.time,
        status: isPast ? 'COMPLETED' : 'CONFIRMED',
        criticality: 'CRITICAL',
        metadata_json: {
          hasSummaryOfEconomicProjections: f.sep,
          expectedAction: 'HOLD_OR_CUT_25'
        },
        source: 'FEDERAL_RESERVE_CALENDAR'
      });
    }

    // 7. FRED Release Dates API: Offizielle Veröffentlichungstermine für BLS & BEA Makrodaten
    const fredApiKey = process.env.FRED_API_KEY;
    if (fredApiKey) {
      const releaseConfigs = CalendarFetchAdapter.getMacroReleaseConfigs();
      for (const rel of releaseConfigs) {
        try {
          const urlRelease = `https://api.stlouisfed.org/fred/release/dates?release_id=${rel.id}&api_key=${fredApiKey}&include_release_dates_with_no_data=true&file_type=json`;
          const json = await requestManager.fetch(urlRelease, task.provider, { responseType: 'json' });
          if (json && Array.isArray(json.release_dates)) {
            // Filtere Termine für das aktuelle und kommende Jahr ab 2026-08-01
            const relevantDates = json.release_dates.filter(d => d.date >= '2026-08-01' && d.date <= '2027-12-31');
            for (const d of relevantDates) {
              const targetObsDate = CalendarFetchAdapter.calculateTargetObservationDate(d.date, rel.lookbackMonths);
              const isPast = d.date < todayStr;
              const evId = `${rel.eventCode.toLowerCase()}_${d.date.replace(/-/g, '_')}`;

              events.push({
                id: evId,
                category: rel.category,
                subcategory: rel.subcategory,
                title: `${rel.title} (Berichtsmonat: ${targetObsDate.substring(0, 7)})`,
                event_date: d.date,
                event_time: rel.time,
                status: isPast ? 'COMPLETED' : 'SCHEDULED',
                criticality: rel.criticality,
                metadata_json: {
                  eventCode: rel.eventCode,
                  releaseId: rel.id,
                  targetObservationDate: targetObsDate,
                  passMessage: rel.passMessage,
                  failMessage: rel.failMessage,
                  rules: rel.rules,
                  consensusEstimate: null,
                  previousValue: null
                },
                source: 'FRED_RELEASE_DATES_API'
              });
            }
          }
        } catch (e) {
          Logger.warn(`[CalendarFetchAdapter] Konnte FRED Release ${rel.id} (${rel.eventCode}) nicht abrufen: ${e.message}`);
        }
      }
    }

    // 8. ForexFactory Konsens-Enrichment (Wochen-Vorschau)
    try {
      const ffUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
      const ffData = await requestManager.fetch(ffUrl, task.provider, {
        responseType: 'json',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      if (Array.isArray(ffData) && ffData.length > 0) {
        const usEvents = ffData.filter(e => e.country === 'USD');
        for (const ffEv of usEvents) {
          const ffDateStr = ffEv.date ? ffEv.date.split('T')[0] : null;
          if (!ffDateStr) continue;

          // Match gegen unsere anstehenden Events
          const matchingEvents = events.filter(e => e.event_date === ffDateStr);
          for (const mEv of matchingEvents) {
            const titleLower = (ffEv.title || '').toLowerCase();
            const subcat = mEv.subcategory;

            let isMatch = false;
            if (subcat === 'LABOR' && (titleLower.includes('non-farm') || titleLower.includes('jolts') || titleLower.includes('unemployment'))) {
              isMatch = true;
            } else if (subcat === 'INFLATION' && (titleLower.includes('cpi') || titleLower.includes('pce'))) {
              isMatch = true;
            } else if (subcat === 'PRODUCER_PRICES' && titleLower.includes('ppi')) {
              isMatch = true;
            } else if (subcat === 'FOMC' && titleLower.includes('federal funds rate')) {
              isMatch = true;
            }

            if (isMatch && mEv.metadata_json) {
              if (ffEv.forecast) mEv.metadata_json.consensusEstimate = ffEv.forecast;
              if (ffEv.previous) mEv.metadata_json.previousValue = ffEv.previous;
              if (ffEv.actual && !mEv.actual_value) mEv.actual_value = ffEv.actual;
            }
          }
        }
      }
    } catch (e) {
      Logger.warn(`[CalendarFetchAdapter] ForexFactory Konsens-Enrichment übersprungen: ${e.message}`);
    }

    Logger.info(`[CalendarFetchAdapter] Insgesamt ${events.length} Makro-Kalender-Events erfolgreich aufbereitet.`);
    return events;
  }
}
