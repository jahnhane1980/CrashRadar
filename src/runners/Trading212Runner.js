import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';
import { Trading212Fetcher } from '../services/Trading212Fetcher.js';
import { NtfyService } from '../services/NtfyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, '../../data/trading212_portfolio_snapshot.json');

export class Trading212Runner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.mode = options.mode || 'weekly';
    this.sendNtfy = Boolean(options.sendNtfy);
    this.fetcher = dependencies.fetcher || new Trading212Fetcher();
    this.ntfyTopic = process.env.NTFY_PORTFOLIO_TOPIC || 'StockRadar-UoPgenbsdw';
    this.ntfyService = dependencies.ntfyService || new NtfyService(this.ntfyTopic);
  }

  /**
   * Lädt den vorherigen gespeicherten Portfolio-Snapshot
   */
  loadPreviousSnapshot() {
    try {
      if (fs.existsSync(SNAPSHOT_PATH)) {
        const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      Logger.warn(`[Trading212] Konnte vorherigen Snapshot nicht lesen: ${e.message}`);
    }
    return null;
  }

  /**
   * Speichert den aktuellen Snapshot atomar lokal ab
   */
  saveSnapshot(snapshot) {
    try {
      const dir = path.dirname(SNAPSHOT_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
      Logger.info(`[Trading212] Portfolio-Snapshot erfolgreich gespeichert unter: ${SNAPSHOT_PATH}`);
    } catch (e) {
      Logger.error(`[Trading212] Fehler beim Speichern des Snapshots: ${e.message}`);
    }
  }

  /**
   * Vergleicht zwei Snapshots und ermittelt präzise Deltas (Käufe, Verkäufe, Änderungen, Orders)
   */
  detectDeltas(previous, current) {
    if (!previous || !previous.positions) {
      return {
        isInitial: true,
        added: [],
        removed: [],
        modified: [],
        ordersAdded: [],
        ordersRemoved: [],
        cashDeltaPct: 0,
        hasChanges: false,
      };
    }

    const prevMap = new Map(previous.positions.map((p) => [p.ticker, p]));
    const curMap = new Map(current.positions.map((p) => [p.ticker, p]));

    const added = [];
    const removed = [];
    const modified = [];

    // Neu hinzugekommene Positionen
    for (const [ticker, cur] of curMap.entries()) {
      if (!prevMap.has(ticker)) {
        added.push(cur);
      } else {
        const prev = prevMap.get(ticker);
        const qtyDiff = cur.quantity - prev.quantity;
        // Änderung wenn Stückzahl um mehr als 0.001 abweicht
        if (Math.abs(qtyDiff) > 0.001) {
          modified.push({
            ticker,
            prevQty: prev.quantity,
            curQty: cur.quantity,
            qtyDiff,
            prevWeight: prev.weightPct,
            curWeight: cur.weightPct,
            type: qtyDiff > 0 ? 'AUFSTOCKUNG' : 'TEILVERKAUF',
          });
        }
      }
    }

    // Vollständig aufgelöste Positionen
    for (const [ticker, prev] of prevMap.entries()) {
      if (!curMap.has(ticker)) {
        removed.push(prev);
      }
    }

    // Deltas offener Orders erfassen
    const prevOrders = previous.pendingOrders || [];
    const curOrders = current.pendingOrders || [];
    const prevOrderIds = new Set(prevOrders.map((o) => o.id || `${o.ticker}_${o.limitPrice}_${o.quantity}`));
    const curOrderIds = new Set(curOrders.map((o) => o.id || `${o.ticker}_${o.limitPrice}_${o.quantity}`));

    const ordersAdded = curOrders.filter((o) => !prevOrderIds.has(o.id || `${o.ticker}_${o.limitPrice}_${o.quantity}`));
    const ordersRemoved = prevOrders.filter((o) => !curOrderIds.has(o.id || `${o.ticker}_${o.limitPrice}_${o.quantity}`));

    const cashDeltaPct = Number((current.cashPct - previous.cashPct).toFixed(2));

    return {
      isInitial: false,
      added,
      removed,
      modified,
      ordersAdded,
      ordersRemoved,
      cashDeltaPct,
      hasChanges:
        added.length > 0 ||
        removed.length > 0 ||
        modified.length > 0 ||
        ordersAdded.length > 0 ||
        ordersRemoved.length > 0,
    };
  }

  /**
   * Formatiert den Bericht für Terminal-Logging und Ntfy-Broadcast
  /**
   * Zeichnet einen horizontalen Unicode-Balken für die relative Allokation
   */
  static renderBar(pct, maxPct = 20, barLength = 11) {
    const safeMax = Math.max(maxPct, 1);
    const filled = Math.round((pct / safeMax) * barLength);
    return '█'.repeat(Math.max(1, filled)) + '░'.repeat(Math.max(0, barLength - filled));
  }

  /**
   * Formatiert den wöchentlichen Portfolio-Report (Freitags nach Börsenschluss)
   */
  formatWeeklyReport(current) {
    const dateStr = new Date(current.timestamp).toLocaleDateString('de-DE', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const freeCash = current.freeCashPct ?? current.cashPct;
    const blockedCash = current.blockedCashPct ?? 0;
    const ib01Cash = current.ib01CashPct ?? 0;
    const investedPct = current.investedPct != null ? current.investedPct : 100 - current.cashPct;
    const positionsCount = current.positionsCount != null ? current.positionsCount : current.positions?.length || 0;

    let msg = `📊 **Kamikaze Portfolio Update** (${dateStr})\n`;
    msg += `----------------------------------------\n`;

    const cashBreakdown = [];
    if (freeCash > 0) cashBreakdown.push(`Bar: ${freeCash.toFixed(1)} %`);
    if (blockedCash > 0) cashBreakdown.push(`In Limit-Orders: ${blockedCash.toFixed(1)} %`);
    if (ib01Cash > 0) cashBreakdown.push(`Geldmarkt (IB01): ${ib01Cash.toFixed(1)} %`);

    if (cashBreakdown.length > 1) {
      msg += `💵 **Cash-Quote:** ${current.cashPct.toFixed(1)} % (${cashBreakdown.join(', ')})\n`;
    } else {
      msg += `💵 **Cash-Quote:** ${current.cashPct.toFixed(1)} %\n`;
    }
    msg += `📈 **Investiert:** ${investedPct.toFixed(1)} % (${positionsCount} Positionen)\n`;

    if (current.allTimeReturnPct != null) {
      const allTimeSign = current.allTimeReturnPct >= 0 ? '+' : '';
      let returnLine = `🚀 **Gesamtrendite:** ${allTimeSign}${current.allTimeReturnPct.toFixed(1)} %`;
      if (current.openReturnPct != null) {
        const openSign = current.openReturnPct >= 0 ? '+' : '';
        returnLine += ` (Offen: ${openSign}${current.openReturnPct.toFixed(1)} %)`;
      }
      msg += `${returnLine}\n`;
    }
    msg += `\n`;

    // Offene Limit-Orders
    if (current.pendingOrders && current.pendingOrders.length > 0) {
      msg += `⏳ **Offene Limit-Orders (${current.pendingOrders.length}):**\n`;
      for (const o of current.pendingOrders) {
        const weightText = o.targetWeightPct > 0 ? ` (~${o.targetWeightPct.toFixed(1)} % Ziel-Allokation)` : '';
        msg += `• **${o.ticker}:** ${o.quantity} Stk. @ ${o.limitPrice.toFixed(2)} ${o.currency}${weightText}\n`;
      }
      msg += `\n`;
    }

    // Allokations-Balkendiagramm (Monospace, pixelgenau auf allen Endgeräten)
    msg += `📊 **Allokation & Performance:**\n`;
    msg += '```\n';

    const allItems = [
      ...(current.positions || []).map((p) => ({
        ticker: p.ticker,
        weightPct: p.weightPct,
        pnlDisplay: p.pnlPct != null ? `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%` : '--',
      })),
      {
        ticker: 'CASH',
        weightPct: current.cashPct,
        pnlDisplay: '--',
      },
    ];

    allItems.sort((a, b) => b.weightPct - a.weightPct);

    const maxPct = Math.max(20, ...allItems.map((i) => i.weightPct));
    for (const item of allItems) {
      const bar = Trading212Runner.renderBar(item.weightPct, maxPct, 11);
      const padTicker = item.ticker.padEnd(5, ' ');
      const padPct = (item.weightPct.toFixed(1) + ' %').padStart(7, ' ');
      const padPnl = item.pnlDisplay.padStart(7, ' ');
      msg += `${padTicker} ${padPct} [${bar}] ${padPnl}\n`;
    }
    msg += '```\n';

    return msg;
  }

  /**
   * Formatiert die kumulierte Transaktions-Nachricht für Trades & Ausführungen
   */
  formatTradesReport(current, deltas) {
    if (!deltas || !deltas.hasChanges) return null;

    const timeStr = new Date(current.timestamp).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    let msg = `🔔 **Kamikaze Transaktions-Alert** (${timeStr})\n`;
    msg += `----------------------------------------\n`;

    // Ausgeführte Limit-Orders von stornierten/gelöschten trennen
    const executedOrders = [];
    const cancelledOrders = [];
    for (const or of (deltas.ordersRemoved || [])) {
      const matched =
        deltas.added.find((a) => a.ticker === or.ticker) ||
        deltas.modified.find((m) => m.ticker === or.ticker);
      if (matched) {
        executedOrders.push(or);
      } else {
        cancelledOrders.push(or);
      }
    }

    // 1. Ausgeführte Orders
    for (const eo of executedOrders) {
      msg += `🎯 **ORDER AUSGEFÜHRT:** ${eo.ticker} (${eo.quantity} Stk. @ ${eo.limitPrice.toFixed(2)} ${eo.currency})\n`;
    }

    // 2. Positionsänderungen
    for (const a of deltas.added) {
      msg += `🟢 **NEUKAUF:** ${a.ticker} (+${a.weightPct.toFixed(1)} % Allokation, ${a.quantity} Stk.)\n`;
    }
    for (const m of deltas.modified) {
      const diffSign = m.qtyDiff > 0 ? `+${m.qtyDiff}` : `${m.qtyDiff}`;
      if (m.type === 'AUFSTOCKUNG') {
        msg += `🔼 **AUFSTOCKUNG:** ${m.ticker} (${m.prevWeight.toFixed(1)} % ➔ ${m.curWeight.toFixed(1)} %, ${diffSign} Stk.)\n`;
      } else {
        msg += `🔽 **TEILVERKAUF:** ${m.ticker} (${m.prevWeight.toFixed(1)} % ➔ ${m.curWeight.toFixed(1)} %, ${diffSign} Stk.)\n`;
      }
    }
    for (const r of deltas.removed) {
      msg += `🔴 **VERKAUF:** ${r.ticker} (Position vollständig aufgelöst)\n`;
    }

    // 3. Limit-Order Buch (neu angelegt oder storniert)
    for (const oa of (deltas.ordersAdded || [])) {
      msg += `📝 **LIMIT-ORDER ERSTELLT:** ${oa.ticker} (${oa.quantity} Stk. @ ${oa.limitPrice.toFixed(2)} ${oa.currency})\n`;
    }
    for (const co of cancelledOrders) {
      msg += `❌ **ORDER GELÖSCHT:** ${co.ticker} (${co.quantity} Stk. @ ${co.limitPrice.toFixed(2)} ${co.currency})\n`;
    }

    // 4. Cash-Quote mit Delta
    let cashText = `💵 **Aktuelle Cash-Quote:** ${current.cashPct.toFixed(1)} %`;
    if (deltas.cashDeltaPct && Math.abs(deltas.cashDeltaPct) >= 0.1) {
      const deltaSign = deltas.cashDeltaPct > 0 ? `+${deltas.cashDeltaPct.toFixed(1)}` : `${deltas.cashDeltaPct.toFixed(1)}`;
      cashText += ` (${deltaSign} %)`;
    }
    msg += `\n${cashText}\n`;
    return msg;
  }

  /**
   * Universelle Report-Methode (abwärtskompatibel)
   */
  formatReport(current, deltas, mode = this.mode) {
    if (mode === 'trades') {
      return this.formatTradesReport(current, deltas);
    }
    return this.formatWeeklyReport(current);
  }

  async run() {
    Logger.info('================================================================');
    Logger.info(`   TRADING 212 PORTFOLIO RUNNER (MODE: ${this.mode.toUpperCase()})`);
    Logger.info('================================================================');

    if (!process.env.TRADING212_API_KEY) {
      Logger.error('[Trading212] TRADING212_API_KEY fehlt in der .env!');
      Logger.info('[Trading212] Bitte trage deinen API-Schlüssel in .env ein: TRADING212_API_KEY=...');
      return;
    }

    try {
      Logger.info('[Trading212] Rufe Kontodaten und offene Positionen von Trading 212 ab...');
      const current = await this.fetcher.getPortfolioSnapshot();
      Logger.info(`[Trading212] ${current.positionsCount} offene Positionen geladen. Cash: ${current.cashPct}%`);

      const previous = this.loadPreviousSnapshot();
      const deltas = this.detectDeltas(previous, current);

      if (this.mode === 'trades') {
        if (deltas.isInitial) {
          Logger.info('[Trading212] Initialer Snapshot erstellt. Keine früheren Transaktionen vorhanden (Silent Mode).');
          this.saveSnapshot(current);
          return;
        }

        if (!deltas.hasChanges) {
          Logger.info('[Trading212] Keine Transaktionen seit dem letzten Lauf festgestellt. Ntfy bleibt stumm.');
          this.saveSnapshot(current);
          return;
        }

        const report = this.formatTradesReport(current, deltas);
        console.log('\n' + report + '\n');
        this.saveSnapshot(current);

        if (this.sendNtfy) {
          Logger.info(`[Trading212] Sende Transaktions-Alert an Ntfy Topic '${this.ntfyTopic}'...`);
          await this.ntfyService.send(
            'Kamikaze Transaktions-Alert',
            report,
            'high',
            'bell,chart_with_upwards_trend'
          );
        } else {
          Logger.info('[Trading212] Lokaler Test-Modus aktiv: Ntfy-Versand übersprungen.');
          Logger.info('[Trading212] (Verwende --send-ntfy für den scharfen Alert-Versand).');
        }
      } else {
        // mode === 'weekly'
        const report = this.formatWeeklyReport(current);
        console.log('\n' + report + '\n');
        this.saveSnapshot(current);

        if (this.sendNtfy) {
          Logger.info(`[Trading212] Sende Wöchentliches Portfolio-Update an Ntfy Topic '${this.ntfyTopic}'...`);
          await this.ntfyService.send(
            'Kamikaze Portfolio Update',
            report,
            'default',
            'chart_with_upwards_trend'
          );
        } else {
          Logger.info('[Trading212] Lokaler Test-Modus aktiv: Ntfy-Versand übersprungen.');
          Logger.info('[Trading212] (Verwende --send-ntfy für den scharfen Alert-Versand).');
        }
      }

      Logger.info('[Trading212] Portfolio-Lauf erfolgreich abgeschlossen.');
    } catch (error) {
      Logger.error('[Trading212] Runner-Fehler:', error.message);
      throw error;
    }
  }

  cleanup() {
    Logger.info('[Trading212] Runner aufgeräumt.');
  }
}
