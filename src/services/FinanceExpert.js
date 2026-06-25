import mysql from 'mysql2/promise';

const TABLES = Object.freeze({
  BINANCE: 'market_data_binance',
  TIINGO: 'market_data_tiingo',
  YAHOO: 'market_data_yahoo',
  FRED: 'econ_fred',
  TGA: 'fiscal_tga',
  MATURITY_WALL: 'macro_maturity_wall',
});

const SYMBOLS = Object.freeze({
  BTC: 'BTCUSDT',
  SPY: 'SPY',
  QQQ: 'QQQ',
  TLT: 'TLT',
  DXY: 'DX-Y.NYB',
  GOLD: 'GC=F',
  COPPER: 'HG=F',
  VIX: '^VIX',
  HYG: 'HYG',
});

const FRED_SERIES = Object.freeze({
  WALCL: 'WALCL',
  RRPONTSYD: 'RRPONTSYD',
  DFII10: 'DFII10',
  NFCI: 'NFCI',
  TOTRESNS: 'TOTRESNS',
  BORROW: 'BORROW',
  T10Y2Y: 'T10Y2Y',
  ECBASSETSW: 'ECBASSETSW',
  M2SL: 'M2SL',
  PERMIT: 'PERMIT',
  UMCSENT: 'UMCSENT',
  CP: 'CP',
  ICSA: 'ICSA',
  SAHMREALTIME: 'SAHMREALTIME',
  T10YIE: 'T10YIE',
  INDPRO: 'INDPRO',
});

export class FinanceExpert {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl || process.env.DATABASE_URL;
    if (!this.databaseUrl) {
      throw new Error("No database URL provided for FinanceExpert.");
    }
    this.pool = mysql.createPool(this.databaseUrl);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Zieht alle Marktdaten ab dem gewünschten Datum aus der DB.
   * Führt ein automatisches Forward-Fill (LOCF) durch.
   */
  async getDailyGroupedData(startDate) {
    if (!startDate) throw new Error("startDate is required");

    // 1. Raw-Daten holen
    const [btc] = await this.pool.query(`
      SELECT DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') as date, close 
      FROM ${TABLES.BINANCE} 
      WHERE symbol = ? AND interval_type = '1d' AND DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') >= ?
    `, [SYMBOLS.BTC, startDate]);

    const [tiingo] = await this.pool.query(`
      SELECT symbol, record_date as date, close 
      FROM ${TABLES.TIINGO} 
      WHERE symbol IN (?, ?, ?) AND record_date >= ?
    `, [SYMBOLS.SPY, SYMBOLS.QQQ, SYMBOLS.TLT, startDate]);

    const [yahoo] = await this.pool.query(`
      SELECT symbol, record_date as date, close 
      FROM ${TABLES.YAHOO} 
      WHERE symbol IN (?, ?, ?, ?, ?) AND record_date >= ?
    `, [SYMBOLS.DXY, SYMBOLS.GOLD, SYMBOLS.COPPER, SYMBOLS.VIX, SYMBOLS.HYG, startDate]);

    const [fred] = await this.pool.query(`
      SELECT series_id, observation_date as date, value 
      FROM ${TABLES.FRED} 
      WHERE observation_date >= ?
    `, [startDate]);

    const [tga] = await this.pool.query(`
      SELECT record_date as date, open_balance, close_balance
      FROM ${TABLES.TGA}
      WHERE record_date >= ?
    `, [startDate]);

    const [mw] = await this.pool.query(`
      SELECT record_date as date, maturing_90d_billions
      FROM ${TABLES.MATURITY_WALL}
      WHERE record_date >= ?
    `, [startDate]);

    // 2. Timeline aufbauen (Dictionary gruppiert nach Datum)
    const timeline = {};
    const addToTimeline = (date, key, value) => {
      if (!date) return;
      if (!timeline[date]) timeline[date] = {};
      timeline[date][key] = value;
    };

    btc.forEach(r => addToTimeline(r.date, 'BTC', r.close));
    tiingo.forEach(r => addToTimeline(r.date, r.symbol, r.close));
    yahoo.forEach(r => {
      if (r.symbol === SYMBOLS.DXY) addToTimeline(r.date, 'DXY', r.close);
      if (r.symbol === SYMBOLS.GOLD) addToTimeline(r.date, 'Gold', r.close);
      if (r.symbol === SYMBOLS.COPPER) addToTimeline(r.date, 'Copper', r.close);
      if (r.symbol === SYMBOLS.VIX) addToTimeline(r.date, 'VIX', r.close);
      if (r.symbol === SYMBOLS.HYG) addToTimeline(r.date, 'HYG', r.close);
    });
    
    tga.forEach(r => {
      let val = r.close_balance !== 'null' && r.close_balance !== null ? r.close_balance : r.open_balance;
      if (val !== 'null' && val !== null) {
        addToTimeline(r.date, 'TGA', Number(val) / 1000);
      }
    });

    mw.forEach(r => {
      if (r.maturing_90d_billions !== null) {
        addToTimeline(r.date, 'MaturityWall90d', r.maturing_90d_billions);
      }
    });
    
    fred.forEach(r => {
      let val = r.value;
      if (val !== null && val !== 'null') {
        let numVal = Number(val);
        if (r.series_id === FRED_SERIES.WALCL) numVal = numVal / 1000; 
        addToTimeline(r.date, r.series_id, numVal);
      }
    });

    // 3. Kalendertage sortieren
    const dates = Object.keys(timeline).sort();

    // 4. Forward-Fill State
    const getLastBefore = async (table, dateCol, valCol, filterClause, params) => {
      const sql = `SELECT ${valCol} as val FROM ${table} WHERE ${dateCol} < ? ${filterClause} ORDER BY ${dateCol} DESC LIMIT 1`;
      const [rows] = await this.pool.query(sql, [startDate, ...params]);
      return rows.length > 0 ? rows[0].val : null;
    };

    const initialBtc = await getLastBefore(TABLES.BINANCE, "DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d')", 'close', "AND symbol = ? AND interval_type = '1d'", [SYMBOLS.BTC]);
    const initialSpy = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.SPY]);
    const initialQqq = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.QQQ]);
    const initialTlt = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.TLT]);
    
    const initialDxy = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.DXY]);
    const initialGold = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.GOLD]);
    const initialCopper = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.COPPER]);
    const initialVix = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.VIX]);
    const initialHyg = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.HYG]);

    const getFredBefore = async (seriesId) => await getLastBefore(TABLES.FRED, 'observation_date', 'value', "AND series_id = ?", [seriesId]);

    let initialTga = null;
    const [tgaRows] = await this.pool.query(`SELECT open_balance, close_balance FROM ${TABLES.TGA} WHERE record_date < ? ORDER BY record_date DESC LIMIT 1`, [startDate]);
    if (tgaRows.length > 0) {
      const tgaRow = tgaRows[0];
      let val = tgaRow.close_balance !== 'null' && tgaRow.close_balance !== null ? tgaRow.close_balance : tgaRow.open_balance;
      if (val !== 'null' && val !== null) initialTga = Number(val) / 1000;
    }

    const initialMw = await getLastBefore(TABLES.MATURITY_WALL, 'record_date', 'maturing_90d_billions', "", []);

    const parseFred = async (seriesId, isWalcl) => {
      let v = await getFredBefore(seriesId);
      if (v !== null && v !== 'null') {
        let num = Number(v);
        return isWalcl ? num / 1000 : num;
      }
      return null;
    };

    const state = {
      BTC: initialBtc, SPY: initialSpy, QQQ: initialQqq, TLT: initialTlt, DXY: initialDxy, Gold: initialGold, Copper: initialCopper,
      VIX: initialVix, HYG: initialHyg,
      WALCL: await parseFred(FRED_SERIES.WALCL, true), TGA: initialTga, RRPONTSYD: await parseFred(FRED_SERIES.RRPONTSYD, false),
      DFII10: await parseFred(FRED_SERIES.DFII10, false), NFCI: await parseFred(FRED_SERIES.NFCI, false), TOTRESNS: await parseFred(FRED_SERIES.TOTRESNS, false), BORROW: await parseFred(FRED_SERIES.BORROW, false), T10Y2Y: await parseFred(FRED_SERIES.T10Y2Y, false),
      ECBASSETSW: await parseFred(FRED_SERIES.ECBASSETSW, false), M2SL: await parseFred(FRED_SERIES.M2SL, false), PERMIT: await parseFred(FRED_SERIES.PERMIT, false), UMCSENT: await parseFred(FRED_SERIES.UMCSENT, false),
      CP: await parseFred(FRED_SERIES.CP, false), ICSA: await parseFred(FRED_SERIES.ICSA, false), SAHMREALTIME: await parseFred(FRED_SERIES.SAHMREALTIME, false), T10YIE: await parseFred(FRED_SERIES.T10YIE, false), INDPRO: await parseFred(FRED_SERIES.INDPRO, false),
      MaturityWall90d: initialMw
    };

    const finalData = [];

    for (const date of dates) {
      Object.assign(state, timeline[date]);

      const netLiquidity = (state.WALCL !== null && state.TGA !== null && state.RRPONTSYD !== null)
        ? (state.WALCL - state.TGA - state.RRPONTSYD)
        : null;

      const maturityWallPct = (state.MaturityWall90d && state.M2SL) 
        ? (state.MaturityWall90d / state.M2SL) * 100 
        : null;

      finalData.push({
        date,
        assets: {
          SPY: state.SPY,
          QQQ: state.QQQ,
          BTC: state.BTC,
          TLT: state.TLT,
          Gold: state.Gold,
          Copper: state.Copper,
          VIX: state.VIX,
          HYG: state.HYG
        },
        macroGroups: {
          NetLiquidity: {
            NetLiquidity: netLiquidity,
            WALCL: state.WALCL,
            TGA: state.TGA,
            RRPONTSYD: state.RRPONTSYD
          },
          FinancialConditions: {
            DXY: state.DXY,
            RealYield10y: state.DFII10,
            ChicagoFedIndex: state.NFCI
          },
          BankingHealth: {
            TotalReserves: state.TOTRESNS,
            EmergencyBorrowing: state.BORROW
          },
          YieldCurve: {
            Spread10y2y: state.T10Y2Y
          },
          Leading: {
            SahmRule: state.SAHMREALTIME,
            MaturityWallPct: maturityWallPct,
            BuildingPermits: state.PERMIT,
            ConsumerSentiment: state.UMCSENT,
            M2: state.M2SL,
            CorporateProfits: state.CP,
            BreakevenInflation: state.T10YIE,
            EcbAssets: state.ECBASSETSW
          },
          Contemporaneous: {
            IndustrialProduction: state.INDPRO,
            InitialClaims: state.ICSA
          }
        }
      });
    }

    return finalData;
  }
}
