import { SYMBOLS, FRED_SERIES } from '../core/repositories/AnalysisRepository.js';

export class TimeSeriesService {
  static buildTimeline(rawData) {
    const { btc, tiingo, yahoo, fred, tga, mw, sec, cboe, finra, shortVolume, pcr } = rawData;
    const timeline = {};
    const addToTimeline = (date, key, value) => {
      if (!date) return;
      let dateStr = date;
      if (date instanceof Date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      } else if (typeof date === 'string' && date.includes('GMT')) {
        // Fallback for already stringified Date objects (just in case)
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          dateStr = `${yyyy}-${mm}-${dd}`;
        }
      }
      
      if (!timeline[dateStr]) timeline[dateStr] = {};
      timeline[dateStr][key] = value;
    };

    btc?.forEach(r => {
      addToTimeline(r.date, 'BTC', r.close);
      if (r.volume !== undefined && r.volume !== null) {
        addToTimeline(r.date, 'BTC_Volume', Number(r.volume));
      }
    });
    tiingo?.forEach(r => {
      addToTimeline(r.date, r.symbol, r.close);
      if (r.volume !== undefined && r.volume !== null) {
        addToTimeline(r.date, `${r.symbol}_Volume`, r.volume);
      }
    });
    yahoo?.forEach(r => {
      if (r.symbol === SYMBOLS.DXY) addToTimeline(r.date, 'DXY', r.close);
      if (r.symbol === SYMBOLS.GOLD) {
        addToTimeline(r.date, 'Gold', r.close);
        addToTimeline(r.date, 'Gold_Volume', r.volume);
      }
      if (r.symbol === SYMBOLS.COPPER) addToTimeline(r.date, 'Copper', r.close);
      if (r.symbol === SYMBOLS.VIX) addToTimeline(r.date, 'VIX', r.close);
      if (r.symbol === SYMBOLS.HYG) addToTimeline(r.date, 'HYG', r.close);
      if (r.symbol === SYMBOLS.BIZD) addToTimeline(r.date, 'BIZD', r.close);
      if (r.symbol === SYMBOLS.BKLN) addToTimeline(r.date, 'BKLN', r.close);
      if (r.symbol === SYMBOLS.SKEW) addToTimeline(r.date, 'SKEW', r.close);
    });
    
    tga?.forEach(r => {
      let val = r.close_balance !== 'null' && r.close_balance !== null ? r.close_balance : r.open_balance;
      if (val !== 'null' && val !== null) {
        addToTimeline(r.date, 'TGA', Number(val) / 1000);
      }
    });

    mw?.forEach(r => {
      if (r.maturing_90d_billions !== null) {
        addToTimeline(r.date, 'MaturityWall90d', r.maturing_90d_billions);
      }
    });
    
    fred?.forEach(r => {
      let val = r.value;
      if (val !== null && val !== 'null') {
        let numVal = Number(val);
        if (r.series_id === FRED_SERIES.WALCL) numVal = numVal / 1000; 
        addToTimeline(r.date, r.series_id, numVal);
      }
    });

    if (sec) {
      sec.forEach(r => {
        if (r.interest_expense !== null) addToTimeline(r.date, `${r.ticker}_InterestExpense`, Number(r.interest_expense));
        if (r.total_assets !== null) addToTimeline(r.date, `${r.ticker}_TotalAssets`, Number(r.total_assets));
        if (r.net_income !== null) addToTimeline(r.date, `${r.ticker}_NetIncome`, Number(r.net_income));
      });
    }

    cboe?.forEach(r => addToTimeline(r.date, 'CBOE_SPY', r.volume));
    finra?.forEach(r => addToTimeline(r.date, 'MarginDebt', r.MarginDebt));
    shortVolume?.forEach(r => addToTimeline(r.date, 'SPY_ShortVolumeRatio', r.short_volume_ratio));
    pcr?.forEach(r => addToTimeline(r.date, 'TotalPCR', r.total_pcr));

    return timeline;
  }
}
