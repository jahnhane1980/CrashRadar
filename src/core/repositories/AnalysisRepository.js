import mysql from 'mysql2/promise';

export const TABLES = Object.freeze({
  BINANCE: 'market_data_binance',
  TIINGO: 'market_data_tiingo',
  YAHOO: 'market_data_yahoo',
  FRED: 'econ_fred',
  TGA: 'fiscal_tga',
  MATURITY_WALL: 'macro_maturity_wall',
  FUND_SEC: 'fund_sec_edgar',
  FINRA: 'macro_margin_debt',
  CHALLENGER: 'econ_challenger',
});

export const SYMBOLS = Object.freeze({
  BTC: 'BTCUSDT',
  SPY: 'SPY',
  QQQ: 'QQQ',
  TLT: 'TLT',
  DXY: 'DX-Y.NYB',
  GOLD: 'GC=F',
  COPPER: 'HG=F',
  VIX: '^VIX',
  HYG: 'HYG',
  BIZD: 'BIZD',
  BKLN: 'BKLN',
  SKEW: '^SKEW',
  MSTR: 'MSTR',
  COIN: 'COIN',
  PLTR: 'PLTR',
});

export const FRED_SERIES = Object.freeze({
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
  DFF: 'DFF',
});

export class AnalysisRepository {
  constructor(databaseUrl) {
    const url = databaseUrl || process.env.DATABASE_URL;
    if (!url) {
      throw new Error("No database URL provided for AnalysisRepository.");
    }
    this.pool = mysql.createPool(url);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getOhlcvForTicker(ticker, startDate = '2015-01-01') {
    // BTCUSDT from Binance
    if (ticker === 'BTC') {
      const [rows] = await this.pool.query(`
        SELECT DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') as date, close, volume, high, low 
        FROM market_data_binance 
        WHERE symbol = 'BTCUSDT' AND interval_type = '1d' AND DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') >= ?
        ORDER BY open_time ASC
      `, [startDate]);
      return rows;
    }
    
    // Equities from Tiingo
    const [tiingoRows] = await this.pool.query(`
      SELECT record_date as date, close, volume, high, low
      FROM market_data_tiingo 
      WHERE symbol = ? AND record_date >= ?
      ORDER BY record_date ASC
    `, [ticker, startDate]);
    
    if (tiingoRows.length > 0) return tiingoRows;

    // Fallback Yahoo Finance
    const [yahooRows] = await this.pool.query(`
      SELECT record_date as date, close, volume, high, low
      FROM market_data_yahoo 
      WHERE symbol = ? AND record_date >= ?
      ORDER BY record_date ASC
    `, [ticker, startDate]);

    return yahooRows;
  }

  async getAllRawData(startDate) {
    const [btc] = await this.pool.query(`
      SELECT DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') as date, close, volume, high, low 
      FROM ${TABLES.BINANCE} 
      WHERE symbol = ? AND interval_type = '1d' AND DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') >= ?
    `, [SYMBOLS.BTC, startDate]);

    const [tiingo] = await this.pool.query(`
      SELECT symbol, record_date as date, close, volume 
      FROM ${TABLES.TIINGO} 
      WHERE symbol IN (?, ?, ?, ?, ?, ?) AND record_date >= ?
    `, [SYMBOLS.SPY, SYMBOLS.QQQ, SYMBOLS.TLT, SYMBOLS.MSTR, SYMBOLS.COIN, SYMBOLS.PLTR, startDate]);

    const [yahoo] = await this.pool.query(`
      SELECT symbol, record_date as date, close, volume
      FROM ${TABLES.YAHOO} 
      WHERE symbol IN (?, ?, ?, ?, ?, ?, ?, ?) AND record_date >= ?
    `, [SYMBOLS.DXY, SYMBOLS.GOLD, SYMBOLS.COPPER, SYMBOLS.VIX, SYMBOLS.HYG, SYMBOLS.BIZD, SYMBOLS.BKLN, SYMBOLS.SKEW, startDate]);

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

    const [sec] = await this.pool.query(`
      SELECT ticker, record_date as date, interest_expense, total_assets, net_income
      FROM ${TABLES.FUND_SEC}
      WHERE record_date >= ?
    `, [startDate]);

    const [cboe] = await this.pool.query(`
      SELECT record_date as date, volume 
      FROM market_data_cboe 
      WHERE symbol = 'SPY' AND record_date >= ?
    `, [startDate]);

    const [finra] = await this.pool.query(`
      SELECT record_date as date, margin_debt as MarginDebt 
      FROM ${TABLES.FINRA} 
      WHERE record_date >= ?
    `, [startDate]);

    const [shortVolume] = await this.pool.query(`
      SELECT symbol, record_date as date, short_volume_ratio 
      FROM market_data_short_volume 
      WHERE symbol = 'SPY' AND record_date >= ?
    `, [startDate]);

    const [pcr] = await this.pool.query(`
      SELECT record_date as date, total_pcr 
      FROM market_data_pcr 
      WHERE record_date >= ?
    `, [startDate]);

    const [challenger] = await this.pool.query(`
      SELECT record_date as date, value as Challenger
      FROM ${TABLES.CHALLENGER}
      WHERE record_date >= ?
    `, [startDate]);

    return { btc, tiingo, yahoo, fred, tga, mw, sec, cboe, finra, shortVolume, pcr, challenger };
  }

  async getInitialState(startDate) {
    const getLastBefore = async (table, dateCol, valCol, filterClause, params) => {
      const sql = `SELECT ${valCol} as val FROM ${table} WHERE ${dateCol} < ? ${filterClause} ORDER BY ${dateCol} DESC LIMIT 1`;
      const [rows] = await this.pool.query(sql, [startDate, ...params]);
      return rows.length > 0 ? rows[0].val : null;
    };

    const initialBtc = await getLastBefore(TABLES.BINANCE, "DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d')", 'close', "AND symbol = ? AND interval_type = '1d'", [SYMBOLS.BTC]);
    const initialBtcVol = await getLastBefore(TABLES.BINANCE, "DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d')", 'volume', "AND symbol = ? AND interval_type = '1d'", [SYMBOLS.BTC]);
    const initialBtcHigh = await getLastBefore(TABLES.BINANCE, "DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d')", 'high', "AND symbol = ? AND interval_type = '1d'", [SYMBOLS.BTC]);
    const initialBtcLow = await getLastBefore(TABLES.BINANCE, "DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d')", 'low', "AND symbol = ? AND interval_type = '1d'", [SYMBOLS.BTC]);
    const initialSpy = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.SPY]);
    const initialQqq = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.QQQ]);
    const initialTlt = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.TLT]);
    const initialMstr = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.MSTR]);
    const initialCoin = await getLastBefore(TABLES.TIINGO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.COIN]);
    
    const initialDxy = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.DXY]);
    const initialGold = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.GOLD]);
    const initialGoldVol = await getLastBefore(TABLES.YAHOO, 'record_date', 'volume', "AND symbol = ?", [SYMBOLS.GOLD]);
    const initialCopper = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.COPPER]);
    const initialVix = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.VIX]);
    const initialHyg = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.HYG]);
    const initialBizd = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.BIZD]);
    const initialBkln = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.BKLN]);
    const initialSkew = await getLastBefore(TABLES.YAHOO, 'record_date', 'close', "AND symbol = ?", [SYMBOLS.SKEW]);
    const initialCboeSpy = await getLastBefore('market_data_cboe', 'record_date', 'volume', "AND symbol = ?", [SYMBOLS.SPY]);
    const initialSpyShortVol = await getLastBefore('market_data_short_volume', 'record_date', 'short_volume_ratio', "AND symbol = ?", [SYMBOLS.SPY]);
    const initialPcr = await getLastBefore('market_data_pcr', 'record_date', 'total_pcr', "", []);
    const initialChallenger = await getLastBefore(TABLES.CHALLENGER, 'record_date', 'value', "", []);

    const getFredBefore = async (seriesId) => await getLastBefore(TABLES.FRED, 'observation_date', 'value', "AND series_id = ?", [seriesId]);

    let initialTga = null;
    const [tgaRows] = await this.pool.query(`SELECT open_balance, close_balance FROM ${TABLES.TGA} WHERE record_date < ? ORDER BY record_date DESC LIMIT 1`, [startDate]);
    if (tgaRows.length > 0) {
      const tgaRow = tgaRows[0];
      let val = tgaRow.close_balance !== 'null' && tgaRow.close_balance !== null ? tgaRow.close_balance : tgaRow.open_balance;
      if (val !== 'null' && val !== null) initialTga = Number(val) / 1000;
    }

    const initialMw = await getLastBefore(TABLES.MATURITY_WALL, 'record_date', 'maturing_90d_billions', "", []);
    const initialMarginDebt = await getLastBefore(TABLES.FINRA, 'record_date', 'margin_debt', "", []);

    const parseFred = async (seriesId, isWalcl) => {
      let v = await getFredBefore(seriesId);
      if (v !== null && v !== 'null') {
        let num = Number(v);
        return isWalcl ? num / 1000 : num;
      }
      return null;
    };

    const initialArccInterest = await getLastBefore(TABLES.FUND_SEC, 'record_date', 'interest_expense', "AND ticker = ?", ['ARCC']);
    const initialArccAssets = await getLastBefore(TABLES.FUND_SEC, 'record_date', 'total_assets', "AND ticker = ?", ['ARCC']);
    const initialArccIncome = await getLastBefore(TABLES.FUND_SEC, 'record_date', 'net_income', "AND ticker = ?", ['ARCC']);

    return {
      BTC: initialBtc, BTC_Volume: initialBtcVol, BTC_High: initialBtcHigh, BTC_Low: initialBtcLow, MSTR: initialMstr, COIN: initialCoin, SPY: initialSpy, QQQ: initialQqq, TLT: initialTlt, DXY: initialDxy, Gold: initialGold, Gold_Volume: initialGoldVol, Copper: initialCopper,
      VIX: initialVix, HYG: initialHyg, BIZD: initialBizd, BKLN: initialBkln, SKEW: initialSkew, CBOE_SPY: initialCboeSpy, SPY_ShortVolumeRatio: initialSpyShortVol, TotalPCR: initialPcr,
      WALCL: await parseFred(FRED_SERIES.WALCL, true), TGA: initialTga, RRPONTSYD: await parseFred(FRED_SERIES.RRPONTSYD, false),
      DFII10: await parseFred(FRED_SERIES.DFII10, false), DFF: await parseFred(FRED_SERIES.DFF, false), NFCI: await parseFred(FRED_SERIES.NFCI, false), TOTRESNS: await parseFred(FRED_SERIES.TOTRESNS, false), BORROW: await parseFred(FRED_SERIES.BORROW, false), T10Y2Y: await parseFred(FRED_SERIES.T10Y2Y, false),
      ECBASSETSW: await parseFred(FRED_SERIES.ECBASSETSW, false), M2SL: await parseFred(FRED_SERIES.M2SL, false), PERMIT: await parseFred(FRED_SERIES.PERMIT, false), UMCSENT: await parseFred(FRED_SERIES.UMCSENT, false),
      CP: await parseFred(FRED_SERIES.CP, false), ICSA: await parseFred(FRED_SERIES.ICSA, false), SAHMREALTIME: await parseFred(FRED_SERIES.SAHMREALTIME, false), T10YIE: await parseFred(FRED_SERIES.T10YIE, false), INDPRO: await parseFred(FRED_SERIES.INDPRO, false),
      MaturityWall90d: initialMw,
      ARCC_InterestExpense: initialArccInterest,
      ARCC_TotalAssets: initialArccAssets,
      ARCC_NetIncome: initialArccIncome,
      MarginDebt: initialMarginDebt,
      Challenger: initialChallenger
    };
  }
}
