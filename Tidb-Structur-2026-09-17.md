# TiDB Schema & Sample Data (2026-09-17)

## Tabelle: `company_fundamentals`

### Struktur
```sql
CREATE TABLE `company_fundamentals` (
  `symbol` varchar(20) NOT NULL,
  `date` date NOT NULL,
  `period` varchar(10) NOT NULL DEFAULT '3M',
  `shareIssued` bigint DEFAULT NULL,
  `freeCashFlow` bigint DEFAULT NULL,
  `totalRevenue` bigint DEFAULT NULL,
  `netIncome` bigint DEFAULT NULL,
  `financingCashFlow` bigint DEFAULT NULL,
  `institutional_ownership` decimal(10,4) DEFAULT NULL,
  `filing_date` date DEFAULT NULL,
  `yoy_revenue_growth_pct` double DEFAULT NULL,
  `gross_profit` bigint DEFAULT NULL,
  `operating_cash_flow` bigint DEFAULT NULL,
  `eps` decimal(10,4) DEFAULT NULL,
  PRIMARY KEY (`symbol`,`date`,`period`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "AIRO",
    "date": "2025-06-29T22:00:00.000Z",
    "period": "Q2",
    "shareIssued": null,
    "freeCashFlow": null,
    "totalRevenue": 24550193,
    "netIncome": 5870429,
    "financingCashFlow": null,
    "institutional_ownership": null,
    "filing_date": "2025-08-12T22:00:00.000Z",
    "yoy_revenue_growth_pct": null,
    "gross_profit": null,
    "operating_cash_flow": null,
    "eps": null
  },
  {
    "symbol": "AIRO",
    "date": "2025-09-29T22:00:00.000Z",
    "period": "Q3",
    "shareIssued": null,
    "freeCashFlow": null,
    "totalRevenue": 6283692,
    "netIncome": -7962016,
    "financingCashFlow": null,
    "institutional_ownership": null,
    "filing_date": "2025-11-13T23:00:00.000Z",
    "yoy_revenue_growth_pct": null,
    "gross_profit": null,
    "operating_cash_flow": null,
    "eps": null
  }
]
```

---

## Tabelle: `econ_challenger`

### Struktur
```sql
CREATE TABLE `econ_challenger` (
  `record_date` date NOT NULL,
  `value` float NOT NULL,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "1999-11-30T23:00:00.000Z",
    "value": 50900
  },
  {
    "record_date": "1999-12-31T23:00:00.000Z",
    "value": 44700
  }
]
```

---

## Tabelle: `econ_fred`

### Struktur
```sql
CREATE TABLE `econ_fred` (
  `series_id` varchar(255) NOT NULL,
  `observation_date` varchar(255) NOT NULL,
  `value` double DEFAULT NULL,
  PRIMARY KEY (`series_id`,`observation_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "series_id": "A091RC1Q027SBEA",
    "observation_date": "1947-01-01",
    "value": 5.352
  },
  {
    "series_id": "A091RC1Q027SBEA",
    "observation_date": "1947-04-01",
    "value": 5.36
  }
]
```

---

## Tabelle: `fiscal_auctions`

### Struktur
```sql
CREATE TABLE `fiscal_auctions` (
  `auction_date` varchar(255) NOT NULL,
  `cusip` varchar(255) NOT NULL,
  `security_type` varchar(255) DEFAULT NULL,
  `issue_date` varchar(255) DEFAULT NULL,
  `maturity_date` varchar(255) DEFAULT NULL,
  `total_accepted` double DEFAULT NULL,
  `high_yield` double DEFAULT NULL,
  PRIMARY KEY (`auction_date`,`cusip`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "auction_date": "1999-12-21",
    "cusip": "912795DC2",
    "security_type": "Bill",
    "issue_date": "1999-12-21",
    "maturity_date": "2000-01-13",
    "total_accepted": 10004000000,
    "high_yield": null
  },
  {
    "auction_date": "1999-12-23",
    "cusip": "912795DN8",
    "security_type": "Bill",
    "issue_date": "1999-12-23",
    "maturity_date": "2000-03-23",
    "total_accepted": 12589260000,
    "high_yield": null
  }
]
```

---

## Tabelle: `fiscal_buybacks`

### Struktur
```sql
CREATE TABLE `fiscal_buybacks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `operation_date` varchar(20) NOT NULL,
  `settlement_date` varchar(20) DEFAULT NULL,
  `operation_type` varchar(50) DEFAULT NULL,
  `security_type` varchar(50) DEFAULT NULL,
  `maturity_bucket` varchar(50) DEFAULT NULL,
  `total_offered` decimal(20,2) DEFAULT NULL,
  `total_accepted` decimal(20,2) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=180001
```

### Erste 2 Einträge
```json
[
  {
    "id": 1,
    "operation_date": "2026-08-25",
    "settlement_date": "2026-08-26",
    "operation_type": "Liquidity Support",
    "security_type": "Nominal Coupons",
    "maturity_bucket": "5Y to 7Y",
    "total_offered": "8402000000.00",
    "total_accepted": "1191000000.00",
    "created_at": "2026-08-30T13:36:10.000Z"
  },
  {
    "id": 2,
    "operation_date": "2026-08-20",
    "settlement_date": "2026-08-21",
    "operation_type": "Liquidity Support",
    "security_type": "Nominal Coupons",
    "maturity_bucket": "3Y to 5Y",
    "total_offered": "10159000000.00",
    "total_accepted": "1860000000.00",
    "created_at": "2026-08-30T13:36:10.000Z"
  }
]
```

---

## Tabelle: `fiscal_tga`

### Struktur
```sql
CREATE TABLE `fiscal_tga` (
  `record_date` varchar(255) NOT NULL,
  `open_balance` double DEFAULT NULL,
  `close_balance` double DEFAULT NULL,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2005-10-19",
    "open_balance": 4697,
    "close_balance": 4469
  },
  {
    "record_date": "2005-10-20",
    "open_balance": 4469,
    "close_balance": 5301
  }
]
```

---

## Tabelle: `fund_13f_holdings`

### Struktur
```sql
CREATE TABLE `fund_13f_holdings` (
  `cik` varchar(20) NOT NULL,
  `report_date` date NOT NULL,
  `filing_date` date NOT NULL,
  `cusip` varchar(20) NOT NULL,
  `put_call` varchar(10) NOT NULL DEFAULT 'STOCK',
  `issuer_name` varchar(255) DEFAULT NULL,
  `shares` bigint NOT NULL,
  `value` bigint NOT NULL,
  PRIMARY KEY (`cik`,`report_date`,`cusip`,`put_call`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "cik": "0001135730",
    "report_date": "2016-03-30T22:00:00.000Z",
    "filing_date": "2016-05-15T22:00:00.000Z",
    "cusip": "00507V109",
    "put_call": "STOCK",
    "issuer_name": "ACTIVISION BLIZZARD INC",
    "shares": 14479821,
    "value": 489997
  },
  {
    "cik": "0001135730",
    "report_date": "2016-03-30T22:00:00.000Z",
    "filing_date": "2016-05-15T22:00:00.000Z",
    "cusip": "00724F101",
    "put_call": "STOCK",
    "issuer_name": "ADOBE SYS INC",
    "shares": 3798749,
    "value": 356323
  }
]
```

---

## Tabelle: `fund_sec_edgar`

### Struktur
```sql
CREATE TABLE `fund_sec_edgar` (
  `ticker` varchar(50) NOT NULL,
  `record_date` date NOT NULL,
  `interest_expense` decimal(36,18) DEFAULT NULL,
  `total_assets` decimal(36,18) DEFAULT NULL,
  `net_income` decimal(36,18) DEFAULT NULL,
  PRIMARY KEY (`ticker`,`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "ticker": "ARCC",
    "record_date": "2020-12-30T23:00:00.000Z",
    "interest_expense": "317000000.000000000000000000",
    "total_assets": null,
    "net_income": "484000000.000000000000000000"
  },
  {
    "ticker": "ARCC",
    "record_date": "2021-09-29T22:00:00.000Z",
    "interest_expense": "94000000.000000000000000000",
    "total_assets": null,
    "net_income": "334000000.000000000000000000"
  }
]
```

---

## Tabelle: `fund_trust_holdings`

### Struktur
```sql
CREATE TABLE `fund_trust_holdings` (
  `cik` varchar(20) NOT NULL,
  `report_date` date NOT NULL,
  `filing_date` date NOT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'N-Q',
  `accession_number` varchar(30) DEFAULT NULL,
  `issuer_name` varchar(255) NOT NULL,
  `shares` bigint NOT NULL,
  `value_usd` bigint NOT NULL,
  PRIMARY KEY (`cik`,`report_date`,`issuer_name`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "cik": "0001579982",
    "report_date": "2014-10-30T23:00:00.000Z",
    "filing_date": "2014-12-22T23:00:00.000Z",
    "source": "N-Q",
    "accession_number": "0001144204-14-075499",
    "issuer_name": "ABB Ltd.",
    "shares": 9738,
    "value_usd": 213652
  },
  {
    "cik": "0001579982",
    "report_date": "2014-10-30T23:00:00.000Z",
    "filing_date": "2014-12-22T23:00:00.000Z",
    "source": "N-Q",
    "accession_number": "0001144204-14-075499",
    "issuer_name": "ANSYS, Inc.",
    "shares": 2340,
    "value_usd": 183830
  }
]
```

---

## Tabelle: `macro_calendar_events`

### Struktur
```sql
CREATE TABLE `macro_calendar_events` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subcategory` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_date` date NOT NULL,
  `event_time` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('SCHEDULED','CONFIRMED','ESTIMATED','COMPLETED','EXTENDED','PENDING_DATA','PASSED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `criticality` enum('LOW','MEDIUM','HIGH','CRITICAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEDIUM',
  `metadata_json` json DEFAULT NULL,
  `actual_value` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details_json` json DEFAULT NULL,
  `source` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_event_date` (`event_date`),
  KEY `idx_category_status` (`category`,`status`),
  KEY `idx_subcategory` (`subcategory`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Erste 2 Einträge
```json
[
  {
    "id": "cpi_core_2026_08_12",
    "category": "MACRO_RELEASE",
    "subcategory": "INFLATION",
    "title": "US Core CPI Inflation (Verbraucherpreise) (Berichtsmonat: 2026-07)",
    "event_date": "2026-08-11T22:00:00.000Z",
    "event_time": "14:30 MESZ",
    "status": "COMPLETED",
    "criticality": "CRITICAL",
    "metadata_json": {
      "consensusEstimate": null,
      "eventCode": "CPI_CORE",
      "failMessage": "Kerninflation klebt zäh fest (>2.7%) – Zinsangst steigt!",
      "passMessage": "Kerninflation bestätigt Disinflationspfad (<=2.7% / Nowcast: 2.38%)",
      "previousValue": null,
      "releaseId": 10,
      "rules": [
        {
          "failMsg": "Kerninflation zäh (>2.7%)",
          "max": 2.7,
          "metric": "CPILFESL_YOY",
          "passMsg": "Kerninflation im Disinflationspfad (<=2.7%)",
          "type": "MAX"
        }
      ],
      "targetObservationDate": "2026-07-01"
    },
    "actual_value": null,
    "details_json": null,
    "source": "FRED_RELEASE_DATES_API",
    "created_at": "2026-09-14T03:52:12.000Z",
    "updated_at": "2026-09-17T03:59:03.000Z"
  },
  {
    "id": "cpi_core_2026_09_11",
    "category": "MACRO_RELEASE",
    "subcategory": "INFLATION",
    "title": "US Core CPI Inflation (Verbraucherpreise) (Berichtsmonat: 2026-08)",
    "event_date": "2026-09-10T22:00:00.000Z",
    "event_time": "14:30 MESZ",
    "status": "COMPLETED",
    "criticality": "CRITICAL",
    "metadata_json": {
      "consensusEstimate": null,
      "eventCode": "CPI_CORE",
      "failMessage": "Kerninflation klebt zäh fest (>2.7%) – Zinsangst steigt!",
      "passMessage": "Kerninflation bestätigt Disinflationspfad (<=2.7% / Nowcast: 2.38%)",
      "previousValue": null,
      "releaseId": 10,
      "rules": [
        {
          "failMsg": "Kerninflation zäh (>2.7%)",
          "max": 2.7,
          "metric": "CPILFESL_YOY",
          "passMsg": "Kerninflation im Disinflationspfad (<=2.7%)",
          "type": "MAX"
        }
      ],
      "targetObservationDate": "2026-08-01"
    },
    "actual_value": null,
    "details_json": null,
    "source": "FRED_RELEASE_DATES_API",
    "created_at": "2026-09-14T03:52:12.000Z",
    "updated_at": "2026-09-17T03:59:03.000Z"
  }
]
```

---

## Tabelle: `macro_margin_debt`

### Struktur
```sql
CREATE TABLE `macro_margin_debt` (
  `record_date` date NOT NULL,
  `margin_debt` bigint NOT NULL,
  `free_credit_cash` bigint DEFAULT NULL,
  `free_credit_margin` bigint DEFAULT NULL,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "1999-11-30T23:00:00.000Z",
    "margin_debt": 241967,
    "free_credit_cash": 146582,
    "free_credit_margin": null
  },
  {
    "record_date": "1999-12-31T23:00:00.000Z",
    "margin_debt": 260409,
    "free_credit_cash": 148567,
    "free_credit_margin": null
  }
]
```

---

## Tabelle: `macro_maturity_wall`

### Struktur
```sql
CREATE TABLE `macro_maturity_wall` (
  `record_date` varchar(255) NOT NULL,
  `maturing_90d_billions` double DEFAULT NULL,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2005-10-19",
    "maturing_90d_billions": 630.776227
  },
  {
    "record_date": "2005-10-20",
    "maturing_90d_billions": 590.812418
  }
]
```

---

## Tabelle: `market_data_aaii`

### Struktur
```sql
CREATE TABLE `market_data_aaii` (
  `record_date` date NOT NULL,
  `bullish` decimal(6,4) DEFAULT NULL,
  `neutral` decimal(6,4) DEFAULT NULL,
  `bearish` decimal(6,4) DEFAULT NULL,
  `spread` decimal(6,4) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2010-01-06T23:00:00.000Z",
    "bullish": "0.4100",
    "neutral": "0.3300",
    "bearish": "0.2600",
    "spread": "0.1500",
    "created_at": "2026-07-11T09:48:27.000Z"
  },
  {
    "record_date": "2010-01-13T23:00:00.000Z",
    "bullish": "0.4744",
    "neutral": "0.2564",
    "bearish": "0.2692",
    "spread": "0.2052",
    "created_at": "2026-07-11T09:48:27.000Z"
  }
]
```

---

## Tabelle: `market_data_binance`

### Struktur
```sql
CREATE TABLE `market_data_binance` (
  `symbol` varchar(255) NOT NULL,
  `interval_type` varchar(255) NOT NULL,
  `open_time` bigint NOT NULL,
  `open` double DEFAULT NULL,
  `high` double DEFAULT NULL,
  `low` double DEFAULT NULL,
  `close` double DEFAULT NULL,
  `volume` double DEFAULT NULL,
  `quote_asset_volume` double DEFAULT NULL,
  `trades` int DEFAULT NULL,
  `taker_buy_base_asset_volume` double DEFAULT NULL,
  `close_time` bigint DEFAULT NULL,
  PRIMARY KEY (`symbol`,`interval_type`,`open_time`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "BTCUSDT",
    "interval_type": "1d",
    "open_time": 1502928000000,
    "open": 4261.48,
    "high": 4485.39,
    "low": 4200.74,
    "close": 4285.08,
    "volume": 795.150377,
    "quote_asset_volume": 3454770.05073206,
    "trades": 3427,
    "taker_buy_base_asset_volume": 616.248541,
    "close_time": 1503014399999
  },
  {
    "symbol": "BTCUSDT",
    "interval_type": "1d",
    "open_time": 1503014400000,
    "open": 4285.08,
    "high": 4371.52,
    "low": 3938.77,
    "close": 4108.37,
    "volume": 1199.888264,
    "quote_asset_volume": 5086958.30617151,
    "trades": 5233,
    "taker_buy_base_asset_volume": 972.86871,
    "close_time": 1503100799999
  }
]
```

---

## Tabelle: `market_data_cboe`

### Struktur
```sql
CREATE TABLE `market_data_cboe` (
  `symbol` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_date` date NOT NULL,
  `volume` bigint DEFAULT NULL,
  PRIMARY KEY (`symbol`,`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "QQQ",
    "record_date": "2007-01-02T23:00:00.000Z",
    "volume": 251109
  },
  {
    "symbol": "QQQ",
    "record_date": "2007-01-03T23:00:00.000Z",
    "volume": 152050
  }
]
```

---

## Tabelle: `market_data_dix`

### Struktur
```sql
CREATE TABLE `market_data_dix` (
  `record_date` date NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `dix` decimal(10,6) NOT NULL,
  `gex` double NOT NULL,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2011-05-01T22:00:00.000Z",
    "price": "1361.22",
    "dix": "0.378842",
    "gex": 1897312571.486
  },
  {
    "record_date": "2011-05-02T22:00:00.000Z",
    "price": "1356.62",
    "dix": "0.383411",
    "gex": 1859730656.13
  }
]
```

---

## Tabelle: `market_data_fiscaldata`

### Struktur
```sql
CREATE TABLE `market_data_fiscaldata` (
  `record_date` varchar(50) NOT NULL,
  `account_type` varchar(255) NOT NULL,
  `close_today_bal` varchar(50) DEFAULT NULL,
  `open_today_bal` varchar(50) DEFAULT NULL,
  `open_month_bal` varchar(50) DEFAULT NULL,
  `open_fiscal_year_bal` varchar(50) DEFAULT NULL,
  `table_nbr` varchar(50) DEFAULT NULL,
  `table_nm` varchar(100) DEFAULT NULL,
  `sub_table_name` varchar(100) DEFAULT NULL,
  `src_line_nbr` varchar(50) DEFAULT NULL,
  `record_fiscal_year` varchar(50) DEFAULT NULL,
  `record_fiscal_quarter` varchar(50) DEFAULT NULL,
  `record_calendar_year` varchar(50) DEFAULT NULL,
  `record_calendar_quarter` varchar(50) DEFAULT NULL,
  `record_calendar_month` varchar(50) DEFAULT NULL,
  `record_calendar_day` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`record_date`,`account_type`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2005-10-03",
    "account_type": "Federal Reserve Account",
    "close_today_bal": "5448",
    "open_today_bal": "4381",
    "open_month_bal": "4381",
    "open_fiscal_year_bal": "4381",
    "table_nbr": "I",
    "table_nm": "Operating Cash Balance",
    "sub_table_name": "Type of account",
    "src_line_nbr": "1",
    "record_fiscal_year": "2006",
    "record_fiscal_quarter": "1",
    "record_calendar_year": "2005",
    "record_calendar_quarter": "4",
    "record_calendar_month": "10",
    "record_calendar_day": "03"
  },
  {
    "record_date": "2005-10-03",
    "account_type": "Tax and Loan Note Accounts (Table V)",
    "close_today_bal": "9295",
    "open_today_bal": "31300",
    "open_month_bal": "31300",
    "open_fiscal_year_bal": "31300",
    "table_nbr": "I",
    "table_nm": "Operating Cash Balance",
    "sub_table_name": "Type of account",
    "src_line_nbr": "2",
    "record_fiscal_year": "2006",
    "record_fiscal_quarter": "1",
    "record_calendar_year": "2005",
    "record_calendar_quarter": "4",
    "record_calendar_month": "10",
    "record_calendar_day": "03"
  }
]
```

---

## Tabelle: `market_data_fred`

### Struktur
```sql
CREATE TABLE `market_data_fred` (
  `date` varchar(50) NOT NULL,
  `value` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "date": "2002-12-18",
    "value": "719542"
  },
  {
    "date": "2002-12-25",
    "value": "732059"
  }
]
```

---

## Tabelle: `market_data_m5`

### Struktur
```sql
CREATE TABLE `market_data_m5` (
  `symbol` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_time` datetime NOT NULL,
  `open` decimal(10,4) DEFAULT NULL,
  `high` decimal(10,4) DEFAULT NULL,
  `low` decimal(10,4) DEFAULT NULL,
  `close` decimal(10,4) DEFAULT NULL,
  `volume` bigint DEFAULT NULL,
  PRIMARY KEY (`symbol`,`record_time`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "CIBR",
    "record_time": "2024-06-10T10:00:00.000Z",
    "open": "53.8300",
    "high": "53.8300",
    "low": "53.8200",
    "close": "53.8200",
    "volume": 249
  },
  {
    "symbol": "CIBR",
    "record_time": "2024-06-10T10:05:00.000Z",
    "open": "53.7800",
    "high": "53.7800",
    "low": "53.7800",
    "close": "53.7800",
    "volume": 598
  }
]
```

---

## Tabelle: `market_data_naaim`

### Struktur
```sql
CREATE TABLE `market_data_naaim` (
  `record_date` date NOT NULL,
  `exposure_index` decimal(8,2) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2010-01-05T23:00:00.000Z",
    "exposure_index": "70.65",
    "created_at": "2026-07-11T09:48:23.000Z"
  },
  {
    "record_date": "2010-01-12T23:00:00.000Z",
    "exposure_index": "72.97",
    "created_at": "2026-07-11T09:48:23.000Z"
  }
]
```

---

## Tabelle: `market_data_pcr`

### Struktur
```sql
CREATE TABLE `market_data_pcr` (
  `record_date` date NOT NULL,
  `total_pcr` decimal(8,4) DEFAULT NULL,
  `equity_pcr` decimal(8,4) DEFAULT NULL,
  `index_pcr` decimal(8,4) DEFAULT NULL,
  PRIMARY KEY (`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Erste 2 Einträge
```json
[
  {
    "record_date": "2020-01-01T23:00:00.000Z",
    "total_pcr": "0.8300",
    "equity_pcr": null,
    "index_pcr": null
  },
  {
    "record_date": "2020-01-02T23:00:00.000Z",
    "total_pcr": "0.8500",
    "equity_pcr": null,
    "index_pcr": null
  }
]
```

---

## Tabelle: `market_data_short_volume`

### Struktur
```sql
CREATE TABLE `market_data_short_volume` (
  `symbol` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_date` date NOT NULL,
  `short_volume` bigint NOT NULL,
  `total_volume` bigint NOT NULL,
  `short_volume_ratio` decimal(5,4) NOT NULL,
  PRIMARY KEY (`symbol`,`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "LUMN",
    "record_date": "2023-01-02T23:00:00.000Z",
    "short_volume": 2872867,
    "total_volume": 5288933,
    "short_volume_ratio": "0.5432"
  },
  {
    "symbol": "LUMN",
    "record_date": "2023-01-03T23:00:00.000Z",
    "short_volume": 3351461,
    "total_volume": 5781972,
    "short_volume_ratio": "0.5796"
  }
]
```

---

## Tabelle: `market_data_tiingo`

### Struktur
```sql
CREATE TABLE `market_data_tiingo` (
  `symbol` varchar(255) NOT NULL,
  `record_date` varchar(255) NOT NULL,
  `resolution` varchar(255) NOT NULL,
  `open` double DEFAULT NULL,
  `high` double DEFAULT NULL,
  `low` double DEFAULT NULL,
  `close` double DEFAULT NULL,
  `volume` double DEFAULT NULL,
  PRIMARY KEY (`symbol`,`record_date`,`resolution`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "ARKK",
    "record_date": "2014-10-31",
    "resolution": "daily",
    "open": 20.42,
    "high": 20.42,
    "low": 20.38,
    "close": 20.38,
    "volume": 2661
  },
  {
    "symbol": "ARKK",
    "record_date": "2014-11-03",
    "resolution": "daily",
    "open": 20.49,
    "high": 20.49,
    "low": 20.35,
    "close": 20.38,
    "volume": 2270
  }
]
```

---

## Tabelle: `market_data_yahoo`

### Struktur
```sql
CREATE TABLE `market_data_yahoo` (
  `symbol` varchar(255) NOT NULL,
  `record_date` varchar(255) NOT NULL,
  `open` double DEFAULT NULL,
  `high` double DEFAULT NULL,
  `low` double DEFAULT NULL,
  `close` double DEFAULT NULL,
  `volume` double DEFAULT NULL,
  PRIMARY KEY (`symbol`,`record_date`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "symbol": "AAPL",
    "record_date": "2014-10-01",
    "open": 25.147499084472656,
    "high": 25.172500610351562,
    "low": 24.674999237060547,
    "close": 21.83302879333496,
    "volume": 205965200
  },
  {
    "symbol": "AAPL",
    "record_date": "2014-10-02",
    "open": 24.8174991607666,
    "high": 25.05500030517578,
    "low": 24.510000228881836,
    "close": 21.99151611328125,
    "volume": 191031200
  }
]
```

---

## Tabelle: `sync_locks`

### Struktur
```sql
CREATE TABLE `sync_locks` (
  `lock_key` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`lock_key`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[]
```

---

## Tabelle: `sync_states`

### Struktur
```sql
CREATE TABLE `sync_states` (
  `job_id` varchar(255) NOT NULL,
  `provider` varchar(255) DEFAULT NULL,
  `cursor_data` text DEFAULT NULL,
  `updated_at` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`job_id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

### Erste 2 Einträge
```json
[
  {
    "job_id": "aaii_sentiment",
    "provider": "AAII",
    "cursor_data": "{\"record_date\":\"2026-09-10\",\"bullish\":0.379501,\"neutral\":0.227147,\"bearish\":0.393352,\"spread\":-0.013851000000000002}",
    "updated_at": "2026-09-11T05:42:10.585Z"
  },
  {
    "job_id": "binance_btc_daily",
    "provider": "Binance",
    "cursor_data": "[1789603200000,\"76206.13000000\",\"76760.01000000\",\"76064.90000000\",\"76210.80000000\",\"1.69613000\",1789689599999,\"129580.11087560\",901,\"1.14180000\",\"87235.98568710\",\"0\"]",
    "updated_at": "2026-09-17T04:34:18.667Z"
  }
]
```

---

