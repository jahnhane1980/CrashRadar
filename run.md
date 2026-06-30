Starting fetch jobs...
--- Starting task: binance_btc_daily ---
--- Starting task: fiscaldata_tga ---
--- Starting task: fiscaldata_auctions ---
--- Starting task: fiscaldata_buybacks ---
--- Starting task: fred_walcl ---
--- Starting task: fred_dff ---
--- Starting task: fred_rrpontsyd ---
--- Starting task: fred_dfii10 ---
--- Starting task: fred_t10y2y ---
--- Starting task: fred_totresns ---
[HTTP GET] https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&file_type=json&api_key=***&observation_start=2026-06-27&limit=100000
[HTTP GET] https://api.binance.us/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=1782691200001&limit=1000
[RequestManager] Cache hit for https://api.stlouisfed.org/fred/series/observations
[HTTP GET] https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/buybacks_operations?sort=-operation_date&filter=operation_date%3Agte%3A1999-12-01&page%5Bnumber%5D=1&page%5Bsize%5D=10000
[Storage] Inserted/Updated 1 items and state for task 'binance_btc_daily'
[Storage] Inserted/Updated 1 items and state for task 'fred_rrpontsyd'
[Storage] Inserted/Updated 1 items and state for task 'fred_dfii10'
[Storage] Inserted/Updated 207 items and state for task 'fiscaldata_buybacks'
Error:  Task fiscaldata_tga failed entirely: read ECONNRESET
Error:  Task fred_dff failed entirely: read ECONNRESET
Error:  Task fiscaldata_auctions failed entirely: read ECONNRESET
Error:  Task fred_walcl failed entirely: read ECONNRESET
Error:  Task fred_t10y2y failed entirely: read ECONNRESET
Error:  Task fred_totresns failed entirely: read ECONNRESET
--- Starting task: fred_wlcfll ---
--- Starting task: fred_borrow ---
--- Starting task: fred_loans ---
--- Starting task: fred_woral ---
--- Starting task: fred_nfci ---
--- Starting task: tiingo_spy_daily ---
--- Starting task: tiingo_qqq_daily ---
--- Starting task: tiingo_tlt_daily ---
--- Starting task: tiingo_gdx_daily ---
--- Starting task: yahoo_dxy ---
[RequestManager] Cache hit for https://api.stlouisfed.org/fred/series/observations
[RequestManager] Cache hit for https://api.stlouisfed.org/fred/series/observations
[HTTP GET] https://api.tiingo.com/tiingo/daily/TLT/prices?startDate=1999-12-01
[RequestManager] Cache hit for https://api.stlouisfed.org/fred/series/observations
[RequestManager] Cache hit for https://api.stlouisfed.org/fred/series/observations
[Storage] Inserted/Updated 1 items and state for task 'fred_loans'
[Storage] Inserted/Updated 1 items and state for task 'fred_woral'
[HTTP GET] https://api.tiingo.com/tiingo/daily/QQQ/prices?startDate=1999-12-01
[Storage] Inserted/Updated 1 items and state for task 'fred_nfci'
[Storage] Inserted/Updated 1 items and state for task 'fred_borrow'
[HTTP GET] https://api.tiingo.com/tiingo/daily/SPY/prices?startDate=1999-12-01
[HTTP GET] https://api.tiingo.com/tiingo/daily/GDX/prices?startDate=1999-12-01
[Storage] Inserted/Updated 6019 items and state for task 'tiingo_tlt_daily'
[Storage] Inserted/Updated 5057 items and state for task 'tiingo_gdx_daily'
[Storage] Inserted/Updated 6683 items and state for task 'tiingo_spy_daily'
