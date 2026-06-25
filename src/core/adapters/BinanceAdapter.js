export class BinanceAdapter {
  getInsertQueryAndValues(task, data) {
    const query = `
      INSERT INTO market_data_binance (symbol, interval_type, open_time, open, high, low, close, volume, quote_asset_volume, trades, taker_buy_base_asset_volume, close_time)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume),
        quote_asset_volume = VALUES(quote_asset_volume), trades = VALUES(trades), taker_buy_base_asset_volume = VALUES(taker_buy_base_asset_volume), close_time = VALUES(close_time)
    `;
    const values = data.map(item => [task.params.symbol, task.params.interval, item[0], item[1], item[2], item[3], item[4], item[5], item[7], item[8], item[9], item[6]]);
    return { query, values };
  }
}
