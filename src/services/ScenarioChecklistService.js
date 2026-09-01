import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ScenarioChecklistService {
  constructor(config = null) {
    if (config) {
      this.config = config;
    } else {
      const configPath = path.resolve(__dirname, '../../config/Macro-Scenarios-Config.json');
      if (fs.existsSync(configPath)) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        this.config = { activeScenario: null, scenarios: {} };
      }
    }
  }

  /**
   * Gibt das Event für ein bestimmtes Tagesdatum aus dem aktiven Szenario zurück (oder null).
   * @param {string} currentDateStr - Format 'YYYY-MM-DD'
   * @returns {Object|null}
   */
  getEventForDate(currentDateStr) {
    if (!this.config || !this.config.activeScenario) return null;
    const scenario = this.config.scenarios[this.config.activeScenario];
    if (!scenario || !Array.isArray(scenario.events)) return null;
    return scenario.events.find(e => e.date === currentDateStr) || null;
  }

  /**
   * Ermittelt die Task-IDs (z. B. FRED), die für ein bestimmtes Szenario-Event benötigt werden.
   * @param {Object} event
   * @returns {string[]}
   */
  getRequiredTaskIdsForEvent(event) {
    if (!event) return [];
    const metricToTaskMap = {
      JTSJOL: 'fred_jtsjol',
      PAYEMS: 'fred_payems',
      PAYEMS_DIFF: 'fred_payems',
      SAHMREALTIME: 'fred_sahmrealtime',
      PPIACO_YOY: 'fred_ppiaco',
      PPI: 'fred_ppiaco',
      CPILFESL_YOY: 'fred_cpilfesl',
      CPI_CORE: 'fred_cpilfesl',
      PCEPILFE_YOY: 'fred_pcepilfe',
      PCE_CORE: 'fred_pcepilfe',
      DFF_ACTION: 'fred_dff',
      DFF: 'fred_dff',
      HYG: 'tiingo_hyg'
    };

    const taskIds = new Set();
    if (Array.isArray(event.rules)) {
      for (const r of event.rules) {
        if (r.metric && metricToTaskMap[r.metric]) {
          taskIds.add(metricToTaskMap[r.metric]);
        }
      }
    }
    if (event.metric && metricToTaskMap[event.metric]) {
      taskIds.add(metricToTaskMap[event.metric]);
    }
    return Array.from(taskIds);
  }

  /**
   * Bewertet das aktive Szenario für ein gegebenes Tagesdatum und die Timeline.
   * @param {string} currentDateStr - Datum im Format 'YYYY-MM-DD'
   * @param {Array} timeline - Array von täglichen Makro-Objekten ({ date, assets, macroGroups })
   * @param {Object} options - { forceNotify: boolean }
   * @returns {Object} { shouldNotify, title, message, priority, tags, evaluation }
   */
  evaluate(currentDateStr, timeline = [], options = {}) {
    if (!this.config || !this.config.activeScenario) {
      return { shouldNotify: false };
    }

    const scenario = this.config.scenarios[this.config.activeScenario];
    if (!scenario || !Array.isArray(scenario.events) || scenario.events.length === 0) {
      return { shouldNotify: false };
    }

    const isEventDay = scenario.events.some(e => e.date === currentDateStr);
    if (!isEventDay && !options.forceNotify) {
      return { shouldNotify: false };
    }

    const evaluatedEvents = [];
    let nextUpcomingEvent = null;

    for (const event of scenario.events) {
      if (event.date <= currentDateStr) {
        const evalResult = this._evaluateSingleEvent(event, timeline, currentDateStr);
        evaluatedEvents.push(evalResult);
      } else if (!nextUpcomingEvent) {
        nextUpcomingEvent = event;
      }
    }

    // Wenn das heutige Event noch im Zustand isPending ist (Daten noch nicht von der Behörde publiziert), nicht alarmieren!
    const todayEvaluated = evaluatedEvents.find(e => e.date === currentDateStr);
    if (todayEvaluated && todayEvaluated.isPending && !options.forceNotify) {
      return {
        shouldNotify: false,
        isPending: true,
        pendingEvent: todayEvaluated,
        reason: todayEvaluated.reason
      };
    }

    if (evaluatedEvents.length === 0 && !options.forceNotify) {
      return { shouldNotify: false };
    }

    const passedCount = evaluatedEvents.filter(e => e.passed).length;
    const totalEvaluated = evaluatedEvents.length;
    const hasFailures = passedCount < totalEvaluated;

    const report = this._buildReportText(scenario, evaluatedEvents, nextUpcomingEvent, passedCount, totalEvaluated);

    return {
      shouldNotify: true,
      title: scenario.title,
      message: report,
      priority: hasFailures ? 'high' : 'default',
      tags: hasFailures ? 'warning' : 'trophy',
      evaluation: {
        passedCount,
        totalEvaluated,
        hasFailures,
        evaluatedEvents,
        nextUpcomingEvent
      }
    };
  }

  _normalizeMetricKey(metricKey) {
    switch (metricKey) {
      case 'JTSJOL': return 'JTSJOL';
      case 'PAYEMS':
      case 'PAYEMS_DIFF': return 'PAYEMS';
      case 'SAHMREALTIME': return 'SAHMREALTIME';
      case 'PPIACO_YOY':
      case 'PPI': return 'PPIACO';
      case 'CPILFESL_YOY':
      case 'CPI_CORE': return 'CPILFESL';
      case 'PCEPILFE_YOY':
      case 'PCE_CORE': return 'PCEPILFE';
      case 'DFF_ACTION':
      case 'DFF': return 'DFF';
      default: return metricKey;
    }
  }

  _isEventDataAvailable(event, latestData) {
    if (!event.targetObservationDate || !latestData || !latestData.observationDates) {
      return true; // Fallback für Legacy-Konfigs oder Mocks ohne observationDates
    }

    const metrics = [];
    if (Array.isArray(event.rules)) {
      for (const r of event.rules) {
        if (r.metric) metrics.push(this._normalizeMetricKey(r.metric));
      }
    }
    if (event.metric) {
      metrics.push(this._normalizeMetricKey(event.metric));
    }

    for (const m of metrics) {
      const obsDate = latestData.observationDates[m];
      if (!obsDate || obsDate < event.targetObservationDate) {
        return false;
      }
    }
    return true;
  }

  _evaluateSingleEvent(event, timeline, currentDateStr) {
    const latestData = this._getLatestDataForDate(timeline, event.date <= currentDateStr ? event.date : currentDateStr);
    
    // Freshness-Guard: Prüfen, ob die Daten für diesen Berichtsmonat vorliegen
    const isDataAvailable = this._isEventDataAvailable(event, latestData);
    if (!isDataAvailable) {
      return {
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        passed: false,
        isPending: true,
        reason: `Daten für Berichts-Stichtag ${event.targetObservationDate} noch nicht publiziert`
      };
    }
    
    // Fall 1: Multiple Rules
    if (Array.isArray(event.rules) && event.rules.length > 0) {
      let allPassed = true;
      const details = [];

      for (const r of event.rules) {
        const val = this._resolveMetricValue(r.metric, latestData, timeline);
        const passed = this._checkRule(r, val);
        if (!passed) allPassed = false;
        details.push({
          metric: r.metric,
          value: val,
          passed,
          msg: passed ? r.passMsg : r.failMsg
        });
      }

      const failDetails = details.filter(d => !d.passed);
      const reason = failDetails.length > 0
        ? failDetails.map(d => d.msg).join('; ')
        : (event.passMessage || 'Alle Kriterien erfüllt');

      return {
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        passed: allPassed,
        reason,
        details
      };
    }

    // Fall 2: Single Rule
    const val = this._resolveMetricValue(event.metric, latestData, timeline);
    const passed = this._checkRule(event.rule, val);
    const reason = passed ? event.passMessage : event.failMessage;

    return {
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      passed,
      value: val,
      reason
    };
  }

  _checkRule(rule, val) {
    if (!rule) return true;
    if (val === null || val === undefined) return false;

    switch (rule.type) {
      case 'RANGE':
        return val >= rule.min && val <= rule.max;
      case 'MIN':
        return val >= rule.min;
      case 'MAX':
        return val <= rule.max;
      case 'ALLOWED_VALUES':
        return Array.isArray(rule.allowed) && rule.allowed.includes(val);
      default:
        return true;
    }
  }

  _resolveMetricValue(metricKey, currentData, timeline) {
    if (!currentData) return null;
    const mg = currentData.macroGroups || {};
    const assets = currentData.assets || {};

    switch (metricKey) {
      case 'JTSJOL':
        return mg.LaborMarket?.JTSJOL ?? null;
      case 'PAYEMS':
        return mg.LaborMarket?.PAYEMS ?? null;
      case 'PAYEMS_DIFF': {
        if (!Array.isArray(timeline) || timeline.length < 2) return null;
        const currIdx = timeline.findIndex(d => d.date === currentData.date);
        if (currIdx <= 0) return null;
        const prevData = timeline[currIdx - 1];
        const p1 = currentData.macroGroups?.LaborMarket?.PAYEMS;
        const p0 = prevData.macroGroups?.LaborMarket?.PAYEMS;
        return (p1 !== undefined && p0 !== undefined && p1 !== null && p0 !== null) ? (p1 - p0) : null;
      }
      case 'SAHMREALTIME':
        return mg.Leading?.SahmRule ?? null;
      case 'PPIACO_YOY':
      case 'PPI':
        return mg.Leading?.PPI ?? null;
      case 'CPILFESL_YOY':
      case 'CPI_CORE':
        return mg.Leading?.CPI_Core ?? null;
      case 'PCEPILFE_YOY':
      case 'PCE_CORE':
        return mg.Leading?.PCE_Core ?? null;
      case 'DFF_ACTION': {
        const rate = mg.FinancialConditions?.FedFundsRate;
        if (rate === null || rate === undefined) return 'PAUSE';
        return rate > 5.5 ? 'HIKE_25' : 'PAUSE';
      }
      case 'HYG':
        return assets.HYG ?? null;
      default:
        return mg.Leading?.[metricKey] ?? mg.LaborMarket?.[metricKey] ?? assets[metricKey] ?? null;
    }
  }

  _getLatestDataForDate(timeline, targetDateStr) {
    if (!Array.isArray(timeline) || timeline.length === 0) return null;
    const found = timeline.filter(d => d.date <= targetDateStr);
    return found.length > 0 ? found[found.length - 1] : timeline[timeline.length - 1];
  }

  _buildReportText(scenario, evaluatedEvents, nextEvent, passedCount, totalCount) {
    const isAllPassed = passedCount === totalCount;
    const statusEmoji = isAllPassed ? '🟢' : '🟡';
    const statusText = isAllPassed
      ? `${statusEmoji} ${passedCount} / ${totalCount} Kriterien ERFÜLLT (Melt-Up-Pfad intakt)`
      : `${statusEmoji} ${passedCount} / ${totalCount} Kriterien ERFÜLLT (Achtung: Dämpfer!)`;

    const lines = [];
    lines.push(scenario.title);
    lines.push('Status: ' + statusText);
    lines.push('======================================================');
    lines.push('');
    lines.push('📅 ABGESCHLOSSENE PRÜFPUNKTE:');

    for (const ev of evaluatedEvents) {
      const datePart = ev.date.split('-').slice(1).reverse().join('.');
      if (ev.isPending) {
        lines.push(`• ${datePart}. ${ev.title}: ⏳ AUSSTEHEND (${ev.reason})`);
      } else if (ev.passed) {
        lines.push(`• ${datePart}. ${ev.title}: 🟢 PASS (${ev.reason})`);
      } else {
        lines.push(`• ${datePart}. ${ev.title}: 🔴 FAIL`);
        lines.push(`  ↳ Grund: ${ev.reason}`);
      }
    }

    lines.push('');
    if (nextEvent) {
      const nextDatePart = nextEvent.date.split('-').slice(1).reverse().join('.');
      lines.push('⏳ NÄCHSTE PRÜFUNG:');
      lines.push(`• ${nextDatePart}. ${nextEvent.time}: ${nextEvent.title}`);
      lines.push('');
    }

    lines.push('🎯 FAZIT FÜR DIE RALLYE:');
    if (isAllPassed) {
      lines.push('Fundamentaldaten stützen das Goldilocks-Szenario.');
      lines.push(`Melt-Up-Fenster bleibt bis zum TGA-Kollisionsfenster (${scenario.tgaTargetCollision || 'Ende Okt'}) offen.`);
    } else {
      lines.push('Dämpfer im Szenario erhöht das Risiko restriktiver Notenbank-Reaktionen.');
      lines.push('Neukäufe bremsen und Trailing-Stops bei High-Beta Titeln eng nachziehen.');
    }
    lines.push('======================================================');

    return lines.join('\n');
  }
}