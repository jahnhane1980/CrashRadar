import { SYMBOLS, FRED_SERIES } from '../core/repositories/AnalysisRepository.js';

export class TimeSeriesService {
  static buildTimeline(rawData) {
    const { btc, tiingo, yahoo, fred, tga, mw } = rawData;
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

    return timeline;
  }
}
