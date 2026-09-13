import { Logger } from '../core/Logger.js';

export class Trading212Fetcher {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.TRADING212_API_KEY;
    this.apiSecret = config.apiSecret || process.env.TRADING212_API_SECRET;
    this.baseUrl = config.baseUrl || process.env.TRADING212_API_URL || 'https://live.trading212.com/api/v0';
  }

  // Mapping für Trading-212 Legacy-/SPAC-Kürzel auf echte Ticker
  static LEGACY_TICKER_MAP = {
    'CTL': 'LUMN',    // CenturyLink -> Lumen Technologies
    'LOKB': 'NVTS',   // Live Oak II SPAC -> Navitas Semiconductor
    'EJFA': 'PGY',    // EJF Acquisition SPAC -> Pagaya Technologies
    'NK': 'IBRX',     // NantKwest -> ImmunityBio
    'CNDX': 'CDNX',   // iShares Nasdaq 100 UCITS ETF
    'SEMI': 'SEMI',   // VanEck Semiconductor ETF
    'IB01l': 'IB01',  // iShares $ Treasury Bond 0-1yr UCITS ETF
  };

  // Liste von Geldmarkt- / Cash-Äquivalenten (US-Treasury 0-1y etc.)
  static CASH_EQUIVALENTS = new Set([
    'IB01',   // iShares $ Treasury Bond 0-1yr UCITS ETF (USD)
    'XEON',   // Xtrackers II EUR Overnight Rate Swap UCITS ETF (EUR)
    'ERND',   // iShares $ Ultrashort Bond UCITS ETF
  ]);

  /**
   * Bereinigt Trading-212-spezifische Ticker-Suffixe (z. B. "PLTR_US_EQ" -> "PLTR", "CTL_US_EQ" -> "LUMN")
   */
  static cleanTicker(ticker) {
    if (!ticker) return '';
    const raw = ticker
      .replace(/_([A-Z]{2})_EQ$/i, '')
      .replace(/[a-z]_EQ$/i, '')
      .replace(/_EQ$/i, '')
      .trim();
    
    return Trading212Fetcher.LEGACY_TICKER_MAP[raw] || raw;
  }

  /**
   * Führt authentifizierten HTTP-Aufruf gegen die Trading 212 API aus
   */
  async fetchFromAPI(endpoint, method = 'GET', body = null) {
    if (!this.apiKey) {
      throw new Error('TRADING212_API_KEY_MISSING');
    }

    let authHeader = this.apiKey;
    if (this.apiSecret) {
      authHeader = `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`;
    }

    const headers = {
      'Authorization': authHeader,
    };

    if (this.apiSecret) {
      headers['X-API-SECRET'] = this.apiSecret;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`T212_API_ERROR_${response.status}: ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      Logger.error(`[Trading212Fetcher] Fehler bei [${method} ${endpoint}]:`, error.message);
      throw error;
    }
  }

  /**
   * Holt die aktuellen Cash- und Kontoinformationen
   */
  async getAccountCash() {
    return this.fetchFromAPI('/equity/account/cash', 'GET');
  }

  /**
   * Holt alle offenen Positionen
   */
  async getOpenPositions() {
    return this.fetchFromAPI('/equity/portfolio', 'GET');
  }

  /**
   * Holt alle offenen Limit- und Stop-Aufträge
   */
  async getOpenOrders() {
    return this.fetchFromAPI('/equity/orders', 'GET');
  }

  /**
   * Erstellt einen vollständigen, rein relativen Portfolio-Snapshot (Prozentwerte, keine nominalen Gesamtsummen)
   */
  async getPortfolioSnapshot() {
    const [cashData, positionsData, ordersData] = await Promise.all([
      this.getAccountCash(),
      this.getOpenPositions(),
      this.getOpenOrders(),
    ]);

    const totalValue = Number(cashData.total) || 0;
    const freeCash = Number(cashData.free) || 0;
    const blockedCash = Number(cashData.blocked) || 0;
    const rawCash = freeCash + blockedCash;
    const ppl = Number(cashData.ppl) || 0;
    const result = Number(cashData.result) || 0;
    const investedCost = Number(cashData.invested) || 0;

    // Renditen berechnen (rein prozentual)
    const openReturnPct = investedCost > 0 ? (ppl / investedCost) * 100 : 0;
    const totalProfit = result + ppl;
    const netDeposits = totalValue - totalProfit;
    const allTimeReturnPct = netDeposits > 0 ? (totalProfit / netDeposits) * 100 : 0;

    // Gesamtbetrag aller Positionen in Basiswährung EUR
    const totalPositionsValueEur = Math.max(0, totalValue - rawCash);

    // Ermittle Summe der Nominalwerte aller Positionen zur proportionalen Allokation
    let totalPositionsNominal = 0;
    for (const pos of (positionsData || [])) {
      const qty = Number(pos.quantity) || 0;
      const curPrice = Number(pos.currentPrice) || 0;
      totalPositionsNominal += qty * curPrice;
    }

    let ib01CashEur = 0;
    const equityPositions = [];

    for (const pos of (positionsData || [])) {
      const clean = Trading212Fetcher.cleanTicker(pos.ticker);
      const qty = Number(pos.quantity) || 0;
      const curPrice = Number(pos.currentPrice) || 0;
      const avgPrice = Number(pos.averagePrice) || 0;
      const nominal = qty * curPrice;

      // Exakte proportionale Gewichtung in Relation zum EUR-Gesamtwert
      const posEur = totalPositionsNominal > 0 ? (nominal / totalPositionsNominal) * totalPositionsValueEur : 0;
      const weightPct = totalValue > 0 ? (posEur / totalValue) * 100 : 0;
      const pnlPct = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice) * 100 : 0;

      // Geldmarktfonds / Cash-Äquivalente (z. B. IB01, XEON) direkt zum Cash zählen
      if (Trading212Fetcher.CASH_EQUIVALENTS.has(clean)) {
        ib01CashEur += posEur;
      } else {
        equityPositions.push({
          ticker: clean,
          rawTicker: pos.ticker,
          quantity: qty,
          averagePrice: avgPrice,
          currentPrice: curPrice,
          weightPct: Number(weightPct.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
        });
      }
    }

    // Sortierung nach Portfoliogewichtung absteigend
    equityPositions.sort((a, b) => b.weightPct - a.weightPct);

    // Cash-Quoten konsolidieren
    const freeCashPct = totalValue > 0 ? (freeCash / totalValue) * 100 : 0;
    const blockedCashPct = totalValue > 0 ? (blockedCash / totalValue) * 100 : 0;
    const ib01CashPct = totalValue > 0 ? (ib01CashEur / totalValue) * 100 : 0;
    const totalCashPct = freeCashPct + blockedCashPct + ib01CashPct;

    // Offene Aufträge aufbereiten (z. B. Limit-Orders)
    const rawOrders = Array.isArray(ordersData) ? ordersData : [];
    const activeOrders = rawOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED');

    let totalOrdersNominal = 0;
    for (const o of activeOrders) {
      const q = Number(o.quantity) || 0;
      const p = Number(o.limitPrice || o.stopPrice || 0);
      totalOrdersNominal += q * p;
    }

    const pendingOrders = activeOrders.map((o) => {
      const clean = Trading212Fetcher.cleanTicker(o.ticker);
      const qty = Number(o.quantity) || 0;
      const limitPrice = Number(o.limitPrice || o.stopPrice || 0);
      const nominal = qty * limitPrice;

      // Anteil der Order am Gesamtportfolio berechnen
      let targetWeightPct = 0;
      if (totalOrdersNominal > 0 && blockedCash > 0 && totalValue > 0) {
        const orderValueEur = (nominal / totalOrdersNominal) * blockedCash;
        targetWeightPct = (orderValueEur / totalValue) * 100;
      }

      return {
        id: o.id,
        ticker: clean,
        rawTicker: o.ticker,
        side: o.side || 'BUY',
        type: o.type || 'LIMIT',
        quantity: qty,
        limitPrice,
        currency: o.currency || 'USD',
        status: o.status,
        targetWeightPct: Number(targetWeightPct.toFixed(2)),
      };
    });

    return {
      timestamp: new Date().toISOString(),
      cashPct: Number(totalCashPct.toFixed(2)),
      freeCashPct: Number(freeCashPct.toFixed(2)),
      blockedCashPct: Number(blockedCashPct.toFixed(2)),
      ib01CashPct: Number(ib01CashPct.toFixed(2)),
      investedPct: Number((100 - totalCashPct).toFixed(2)),
      allTimeReturnPct: Number(allTimeReturnPct.toFixed(2)),
      openReturnPct: Number(openReturnPct.toFixed(2)),
      positionsCount: equityPositions.length,
      positions: equityPositions,
      pendingOrdersCount: pendingOrders.length,
      pendingOrders,
    };
  }
}
