import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { Logger } from '../core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_FALLBACK_CONFIG = Object.freeze({
  fiscalYears: {
    FY2027: {
      statutoryDeadline: '2026-09-30',
      effectiveDeadline: '2026-12-18',
      status: 'EXTENDED_BY_CR',
      resolutionName: 'Continuing Appropriations Act, 2027',
      preElectionShieldActive: true,
      lameDuckRiskWindow: '2026-12-01 - 2026-12-18',
      notes: 'Haushaltsdeadline politisch vor den US-Zwischenwahlen auf den 18. Dezember 2026 verschoben.'
    }
  },
  treasuryMilestones: [
    {
      id: 'qra_q4_2026',
      date: '2026-11-04',
      title: 'Treasury Quarterly Refunding Announcement (QRA)',
      impact: 'Festlegung der Kupon-vs-Bill-Auktionsquoten für Q1 2027',
      criticality: 'HIGH'
    },
    {
      id: 'debt_ceiling_x_date_projection',
      date: '2027-02-15',
      title: 'Debt Ceiling Hard Collision (Projected X-Date)',
      impact: 'Erschöpfung der Extraordinary Measures & Aufprall auf Schuldenobergrenze',
      criticality: 'CRITICAL'
    }
  ],
  shutdownDynamics: {
    minOperatingCashBillion: 50,
    typicalTaxDrainWindowSeptember: '09-15 - 09-20',
    typicalTaxDrainWindowDecember: '12-15 - 12-20'
  }
});

export class FiscalCalendarService {
  constructor(configOrPath = null, options = {}) {
    this.databaseUrl = options.databaseUrl || process.env.DATABASE_URL || null;
    this.pool = options.pool || null;

    if (typeof configOrPath === 'string') {
      const resolvedPath = path.resolve(__dirname, configOrPath);
      if (fs.existsSync(resolvedPath)) {
        this.config = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_FALLBACK_CONFIG));
      }
    } else if (configOrPath && typeof configOrPath === 'object') {
      this.config = configOrPath;
    } else {
      const defaultConfigPath = path.resolve(__dirname, '../../config/Fiscal-Calendar-Config.json');
      if (fs.existsSync(defaultConfigPath)) {
        this.config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_FALLBACK_CONFIG));
      }
    }
  }

  /**
   * Lädt die aktuellen Events direkt aus der Tabelle macro_calendar_events
   * und aktualisiert den internen Zustand von this.config.
   * @param {Object} [pool] Optionaler mysql pool
   * @returns {Promise<Array>}
   */
  async loadFromDb(pool = null) {
    const activePool = pool || this.pool || (this.databaseUrl ? mysql.createPool(this.databaseUrl) : null);
    if (!activePool) {
      Logger.warn('[FiscalCalendarService] Kein DB-Pool verfügbar. Nutze statische Konfiguration.');
      return [];
    }

    try {
      const query = `
        SELECT id, category, subcategory, title, event_date, event_time, status, criticality, metadata_json, source
        FROM macro_calendar_events
        ORDER BY event_date ASC
      `;
      const [rows] = await activePool.query(query);
      if (Array.isArray(rows) && rows.length > 0) {
        this._updateConfigFromDbRows(rows);
      }
      return rows;
    } catch (e) {
      Logger.warn(`[FiscalCalendarService] Fehler beim Laden aus macro_calendar_events: ${e.message}`);
      return [];
    } finally {
      if (!pool && !this.pool && activePool) {
        await activePool.end();
      }
    }
  }

  _formatDbDate(val) {
    if (!val) return null;
    if (typeof val === 'string') return val.split('T')[0];
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(val);
  }

  _updateConfigFromDbRows(rows) {
    const milestones = [];
    for (const r of rows) {
      const dateStr = this._formatDbDate(r.event_date);

      const meta = typeof r.metadata_json === 'string'
        ? JSON.parse(r.metadata_json)
        : (r.metadata_json || {});

      // Wenn es sich um eine Haushalts-CR handelt
      if (r.id === 'cr_deadline_fy2027' || (r.category === 'FISCAL' && r.subcategory === 'SHUTDOWN' && r.status === 'CONFIRMED')) {
        this.config.fiscalYears = this.config.fiscalYears || {};
        this.config.fiscalYears['FY2027'] = {
          statutoryDeadline: meta.statutoryDeadline || '2026-09-30',
          effectiveDeadline: dateStr,
          status: 'EXTENDED_BY_CR',
          resolutionName: meta.resolutionName || 'Continuing Appropriations Act, 2027',
          preElectionShieldActive: Boolean(meta.preElectionShieldActive),
          lameDuckRiskWindow: meta.lameDuckRiskWindow || '2026-12-01 - 2026-12-18',
          notes: r.title
        };
      }

      // Aktive Meilensteine (QRA, Debt Ceiling X-Date, FOMC)
      if (['CONFIRMED', 'ESTIMATED', 'SCHEDULED'].includes(r.status)) {
        milestones.push({
          id: r.id,
          date: dateStr,
          title: r.title,
          category: r.category,
          subcategory: r.subcategory,
          impact: meta.description || meta.notes || r.title,
          criticality: r.criticality,
          status: r.status,
          metadata: meta
        });
      }
    }

    if (milestones.length > 0) {
      this.config.treasuryMilestones = milestones;
    }
  }

  /**
   * Holt anstehende Kalender-Events ab einem gegebenen Datum (z.B. für Dashboards oder Alerts)
   * @param {string} startDateStr - 'YYYY-MM-DD'
   * @param {Object} options - { limit: 10, category: string, pool: Object }
   * @returns {Promise<Array>}
   */
  async getUpcomingEvents(startDateStr, options = {}) {
    const activePool = options.pool || this.pool || (this.databaseUrl ? mysql.createPool(this.databaseUrl) : null);
    if (!activePool) {
      // Fallback auf in-memory milestones
      return (this.config.treasuryMilestones || [])
        .filter(m => m.date >= startDateStr)
        .slice(0, options.limit || 10);
    }

    try {
      let query = `
        SELECT id, category, subcategory, title, event_date, event_time, status, criticality, metadata_json, source
        FROM macro_calendar_events
        WHERE event_date >= ?
          AND status IN ('SCHEDULED', 'CONFIRMED', 'ESTIMATED')
      `;
      const params = [startDateStr];

      if (options.category) {
        query += ` AND category = ?`;
        params.push(options.category);
      }

      query += ` ORDER BY event_date ASC LIMIT ?`;
      params.push(options.limit || 10);

      const [rows] = await activePool.query(query, params);
      return rows.map(r => ({
        id: r.id,
        category: r.category,
        subcategory: r.subcategory,
        title: r.title,
        date: this._formatDbDate(r.event_date),
        time: r.event_time,
        status: r.status,
        criticality: r.criticality,
        metadata: typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json) : (r.metadata_json || {}),
        source: r.source
      }));
    } catch (e) {
      Logger.warn(`[FiscalCalendarService] getUpcomingEvents DB-Error: ${e.message}`);
      return [];
    } finally {
      if (!options.pool && !this.pool && activePool) {
        await activePool.end();
      }
    }
  }

  /**
   * Ermittelt den aktuellen fiskalischen Status für ein gegebenes Datum
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @returns {Object}
   */
  getFiscalStatus(dateStr) {
    const targetDate = new Date(dateStr);
    const year = targetDate.getFullYear();
    const fyKey = `FY${year + (targetDate.getMonth() >= 9 ? 1 : 0)}`;
    const fy = this.config.fiscalYears?.[fyKey] || this.config.fiscalYears?.['FY2027'];

    let isExtended = false;
    let effectiveDeadline = null;
    let daysUntilDeadline = null;

    if (fy) {
      effectiveDeadline = fy.effectiveDeadline || fy.statutoryDeadline;
      isExtended = fy.status === 'EXTENDED_BY_CR';
      const deadlineDate = new Date(effectiveDeadline);
      const diffMs = deadlineDate.getTime() - targetDate.getTime();
      daysUntilDeadline = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    // Nächster Meilenstein
    const upcoming = (this.config.treasuryMilestones || [])
      .filter(m => new Date(m.date) >= targetDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;

    let daysUntilMilestone = null;
    if (upcoming) {
      const msDate = new Date(upcoming.date);
      daysUntilMilestone = Math.round((msDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const preElectionShieldActive = fy?.preElectionShieldActive && daysUntilDeadline > 45;

    return {
      date: dateStr,
      fiscalYear: fyKey,
      isExtendedByContinuingResolution: isExtended,
      statutoryDeadline: fy?.statutoryDeadline || null,
      effectiveDeadline,
      daysUntilDeadline,
      preElectionShieldActive,
      nextMilestone: upcoming ? {
        id: upcoming.id,
        title: upcoming.title,
        date: upcoming.date,
        daysUntil: daysUntilMilestone,
        criticality: upcoming.criticality
      } : null
    };
  }
}
