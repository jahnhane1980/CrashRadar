### 1. Architectural Defects (Critical/Major)

[src/core/Storage.js:31] - Missing Destructuring Guard for Nullable Adapter Responses - Multiple storage adapters (`AaiiAdapter.js:3,25`, `CboeAdapter.js:3`, `FinraAdapter.js:3`, `NaaimAdapter.js:3,19`, `SecEdgar13FAdapter.js:3,29`, `SqueezeMetricsAdapter.js:3,23`) return `null` instead of `{ query: null, values: [] }` when data is empty or task ID does not match. Executing `const { query, values } = adapter.getInsertQueryAndValues(task, data)` throws `TypeError: Cannot destructure property 'query' of 'adapter.getInsertQueryAndValues(...)' as it is null`, which halts ingestion for that task and triggers a transaction rollback. - Harmonize storage adapter interface to guarantee `{ query: null, values: [] }` on empty input, and add a defensive fallback in `Storage.js`: `const { query, values } = adapter.getInsertQueryAndValues(task, data) || { query: null, values: [] };`.

[src/core/adapters/storage/YahooFinanceAdapter.js:5-36] - Options Chain Schema Fallthrough & Data Corruption - For task `yahoo_spy_options_chain` (`task.method === 'options'`), `YahooFinanceFetchAdapter.js:25-34` returns `{ quotes: [{ date, ticker, call_wall_strike, call_wall_oi, put_wall_strike, put_wall_oi }] }`. In `YahooFinanceAdapter.js`, only `task.method === 'fundamentals'` is checked; options requests fall through into the stock price query (`INSERT INTO market_data_yahoo (symbol, record_date, open, high, low, close, volume)`). Fields `open`, `high`, `low`, `close`, `volume` are `undefined`, writing rows with null/corrupt market prices into `market_data_yahoo` and silently discarding call/put strike and open interest data. - Implement a dedicated handler in `YahooFinanceAdapter.js` (or a dedicated `YahooOptionsAdapter`) targeting an options table (e.g. `market_data_options_wall`) mapping `call_wall_strike`, `call_wall_oi`, `put_wall_strike`, `put_wall_oi`.

[src/services/PaginationStrategies.js:22-25, 32-35, 69-72, 86-89, 105-108, 114-117] - Silent Exception Swallowing in Pagination Loops - Across `time-cursor`, `page-number`, and `date-range`, errors occurring during `fetcher.storage.insertDataAndState` or `fetcher.extractData` are logged via `Logger.error`, followed by a `break;` or `return;`. Errors are never passed to `fetcher.errorRegistry.addError()` nor rethrown. The runner treats the task execution as successful, `ErrorRegistry.hasErrors()` evaluates to `false`, no alerting occurs via Ntfy, and ingestion aborts midway through pagination without notifying callers or recording cursor progress. - In `PaginationStrategies.js`, register any caught exception in `fetcher.errorRegistry.addError(task.id, error)` and rethrow or cleanly propagate the rejection so `TimeSeriesFetcher.runTask` handles failed pagination state deterministically.

[src/core/RequestManager.js:106-131] - Unbounded Promise Cache with Persistent Error Retention - `RequestManager.fetch` caches request promises in `this.cache = new Map()` indexed by `cacheKey`. If an HTTP request fails with a network error, 500, or 503, the rejected Promise remains permanently stored in `this.cache`. Any subsequent call to the same endpoint returns the rejected Promise without dispatching a network call. Furthermore, in long-running processes, `this.cache` grows unbounded across tasks without TTL or eviction. - Purge failed requests from `this.cache` on rejection (`promise.catch(() => this.cache.delete(cacheKey))`), and replace the unbounded Map with an LRU cache or explicit TTL for idempotent requests.

[src/core/adapters/storage/FiscalDataAdapter.js:24-27] - Non-Idempotent Ingestion for Buybacks - In `FiscalDataAdapter.js`, the query for `fiscal_buybacks` is defined as `INSERT INTO fiscal_buybacks (...) VALUES ?` without an `ON DUPLICATE KEY UPDATE` clause (unlike all other tables). Re-running the pipeline or processing overlapping date ranges raises MySQL `ER_DUP_ENTRY` errors on primary/unique keys, causing transaction rollbacks. - Add `ON DUPLICATE KEY UPDATE settlement_date = VALUES(settlement_date), operation_type = VALUES(operation_type), security_type = VALUES(security_type), maturity_bucket = VALUES(maturity_bucket), total_offered = VALUES(total_offered), total_accepted = VALUES(total_accepted)` to `fiscal_buybacks`.

[src/services/TimeSeriesFetcher.js:294-304] - Hardcoded Whitelist Drops Custom Cursor Keys - In `fetchViaHttp` (without pagination), `cursorToSave` extracts only keys matching `['date', 'record_date', 'observation_date', 'id', 'symbol', 'ticker', 'open_time']`. If a task defines a custom date field (e.g. `operation_date` in `fiscaldata_buybacks`), the date is omitted from `cursorToSave`, defaulting to `{ updated: <ISO> }`. On subsequent runs, `getStartDate` cannot extract the last date from state and falls back to `globalStartDate` ("1999-12-01"), causing the task to re-ingest entire datasets from the beginning on every execution. - Dynamically include `task.dateExtractPath` in `keysToKeep` or explicitly record `{ [task.dateExtractPath || 'date']: lastItem[extractPath] }`.

[src/core/adapters/fetch/SecEdgar13FFetchAdapter.js:48, 93-111] - Storage Leak & Direct Database Access in Fetch Adapter - `SecEdgar13FFetchAdapter` accesses `storage.pool` directly and issues raw MySQL queries (`SELECT DISTINCT report_date, filing_date FROM fund_13f_holdings WHERE cik = ?`). This breaks layer encapsulation, couples external fetching directly to MySQL connection internals, and throws errors if `storage` is null, mocked, or non-MySQL. - Relocate the duplicate check to `Storage.js` or `SecEdgar13FAdapter.js` exposed via a standardized method on `Storage` (e.g. `storage.getExistingFilings(cik)`).

[src/core/Storage.js:45] - Non-Standard Timestamp Formatting in MySQL Queries - `Storage.js` passes `new Date().toISOString()` (ISO 8601 string containing `'T'` and `'Z'`) into `sync_states.updated_at`. Depending on MySQL SQL mode (`STRICT_TRANS_TABLES`), inserting ISO strings into `DATETIME`/`TIMESTAMP` fields produces `ER_TRUNCATED_WRONG_VALUE` errors or improper timezone conversions. - Bind `new Date()` directly (native `mysql2` date conversion), use `CURRENT_TIMESTAMP`, or format the timestamp as `'YYYY-MM-DD HH:MM:SS'`.

---

### 2. Dead Code & Unused Modules

[Package / @tensorflow/tfjs] - Zero imports across `src/`. Machine learning training logic is out of scope for the headless ETL ingestion pipeline.
[Package / technicalindicators] - Zero imports across `src/`. Indicator calculations are retired per `index.js:42-45`.
[Package / puppeteer] - Zero imports across `src/`. Headless browser dependencies are unused; all HTTP fetching uses `ky`.
[Package / cheerio] - Zero imports across `src/`. HTML extraction in adapters is handled via regular expressions or custom parsers.
[Package / @supabase/supabase-js] - Zero imports across `src/`. The database layer is implemented entirely via `mysql2`.
[File / src/runners/DataFetchRunner.js] - Redundant 2-line re-export stub. `TimeSeriesFetchRunner.js:73` already exports `export const DataFetchRunner = TimeSeriesFetchRunner;`.
[File / src/core/adapters/storage/InvestingComAdapter.js] - Orphan adapter. `InvestingCom` is declared in `config/Database-Fetcher-Config.json:114` under providers, but has no tasks configured in `tasks` and no corresponding fetch adapter in `FetchAdapterFactory.js`.
[File / src/core/adapters/fetch/NaaimFetchAdapter.js & src/core/adapters/storage/NaaimAdapter.js] - Inactive provider. Fully implemented fetch and storage adapters for NAAIM exist, but zero tasks with `"provider": "NAAIM"` exist in `config/Database-Fetcher-Config.json`.
[Package Scripts / package.json:10-13] - Scripts `"ml:train": "node ml.js"`, `"ml:retrain": "node ml.js ..."`, and `"compass": "node src/runners/DailyPortfolioCompassRunner.js"` reference non-existent files (`ml.js`, `DailyPortfolioCompassRunner.js`). Script `"signals": "node index.js --signals"` targets an unsupported CLI argument.

---

### 3. Contract & Consistency Inconsistencies

[Fetch Adapters / Signature Inconsistency] - `TimeSeriesFetcher.js:215` invokes `adapter.fetch(task, provider, startValue, this.requestManager, this.storage)`. Parameter expectations vary across adapters:
- `YahooFinanceFetchAdapter.js`: Expects `(task, provider, startValue)`. Ignores `requestManager` and instantiates an independent `YahooFinance` client, bypassing global rate-limiting.
- `CboeFetchAdapter.js`: Expects `(task, provider, startValue, requestManager)`. Ignores `storage`.
- `FinraFetchAdapter.js`, `SqueezeMetricsFetchAdapter.js`, `AaiiFetchAdapter.js`, `NaaimFetchAdapter.js`, `CalendarFetchAdapter.js`: Expect `(task, provider, startDate, requestManager)`. Names parameter `startDate` instead of `startValue` (fails polymorphic naming conventions when passing integer millisecond timestamps or non-date cursors).
- `SecEdgar13FFetchAdapter.js`: Expects `(task, provider, startDate, requestManager, storage = null)`. Accepts `storage` to run direct queries.

[Fetch Adapters / Return Type Disparity] - `YahooFinanceFetchAdapter` returns `{ quotes: [...] }` (requiring `provider.responseExtractPath = "quotes"`), whereas `CboeFetchAdapter`, `FinraFetchAdapter`, `SqueezeMetricsFetchAdapter`, `AaiiFetchAdapter`, `NaaimFetchAdapter`, `CalendarFetchAdapter`, and `SecEdgar13FFetchAdapter` return raw data arrays `[...]`. On skipped execution, `YahooFinanceFetchAdapter` returns `[]`, which triggers `extractData` to return `[]`.

[Fetch Adapters / Side-Effect I/O Violations] - `CboeFetchAdapter.js:110-117` and `FinraFetchAdapter.js:140-147` perform synchronous file system I/O, writing CSV files into `data/archive/` during fetching. Adapters must remain stateless data extraction units without undocumented disk writes.

[Storage Adapters / Return Type Contract Deviation] - When supplied with empty arrays or non-matching tasks:
- `AaiiAdapter`, `CboeAdapter`, `FinraAdapter`, `NaaimAdapter`, `SecEdgar13FAdapter`, `SqueezeMetricsAdapter` return `null`.
- `CalendarStorageAdapter`, `FiscalDataAdapter`, `SecEdgarAdapter` return `{ query: null, values: [] }` or `{ query: null, values: null }`.
- `BinanceAdapter`, `FredAdapter`, `InvestingComAdapter`, `TiingoAdapter`, `YahooFinanceAdapter` perform no length check on `data`, assuming a populated array.

[Runners / Complex Runner Hierarchy & In-Place Config Mutation] - `index.js` delegates to `DataFetchRunner` (`TimeSeriesFetchRunner`), which wraps `StandardRunner` or `TestRunner`, which in turn delegates to `TimeSeriesFetcher`. `TestRunner.applyTestConfigOverrides` directly mutates the shared in-memory `config` object, creating cross-test side effects.

---

### 4. Prioritized Remediation Roadmap (Phase 1 to 3)

#### Phase 1: Critical Ingestion Stability & Data Integrity (Immediate)
- Harmonize all storage adapters in `src/core/adapters/storage/` to return `{ query: null, values: [] }` on empty data or mismatched task IDs. Add fallback destructuring in `src/core/Storage.js:31`.
- Fix `YahooFinanceAdapter.js` to handle `task.method === 'options'` without writing corrupted rows with `NULL` prices into `market_data_yahoo`.
- Add `ON DUPLICATE KEY UPDATE` to `fiscal_buybacks` in `FiscalDataAdapter.js` to ensure idempotency.
- Fix silent error swallowing in `src/services/PaginationStrategies.js` by registering errors with `fetcher.errorRegistry.addError()` and rethrowing.
- Modify `src/core/RequestManager.js` to delete rejected promises from `this.cache` on failure.

#### Phase 2: Contract Normalization & Encapsulation (Consolidation)
- Standardize the fetch adapter method signature across all adapters to `async fetch(task, provider, startValue, requestManager)`.
- Normalize fetch adapter return formats to return arrays directly, standardizing `extractData` behavior.
- Remove database pool access from `SecEdgar13FFetchAdapter.js`; provide a `storage.getExistingFilings(cik)` method or handle deduplication inside `SecEdgar13FAdapter.js`.
- Remove synchronous CSV file writing (`data/archive/`) from `CboeFetchAdapter.js` and `FinraFetchAdapter.js`.
- Fix `TimeSeriesFetcher.js:294` cursor extraction to retain `task.dateExtractPath` (resolving historical refetch loop in `fiscaldata_buybacks`).
- Fix `Storage.js:45` timestamp parameter format to prevent MySQL `DATETIME` truncation warnings.

#### Phase 3: Dead Code Elimination & Pipeline Simplification (Technical Debt)
- Uninstall unused dependencies from `package.json`: `@tensorflow/tfjs`, `technicalindicators`, `puppeteer`, `cheerio`, `@supabase/supabase-js`.
- Delete dead runner file `src/runners/DataFetchRunner.js` and update imports to `TimeSeriesFetchRunner.js`.
- Clean up broken scripts in `package.json` (`ml:train`, `ml:retrain`, `compass`, `signals`).
- Remove ghost adapter `InvestingComAdapter.js` or add corresponding tasks to `config/Database-Fetcher-Config.json`.
- Configure missing task `naaim_exposure` in `config/Database-Fetcher-Config.json` or remove `NaaimFetchAdapter.js` and `NaaimAdapter.js`.
- Flatten runner architecture by removing redundant `StandardRunner.js` indirection and merging execution flow into `TimeSeriesFetchRunner.js`.
