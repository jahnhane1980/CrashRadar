/**
 * SignalTypes
 * 
 * Standardisierte Enums und Konstanten für die moderne SignalEngine.
 * Trennt strikt zwischen universellem technischem Status (Ampel)
 * und domänenspezifischen, rein deskriptiven Markt-Regimes.
 */

/**
 * Universeller technischer Status (für alle Sensoren und Hubs identisch)
 */
export const SignalStatus = Object.freeze({
  OK: 'OK',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN'
});

/**
 * Krypto-Regime (CryptoSensorHub)
 */
export const CryptoRegime = Object.freeze({
  BULL_EXPANSION: 'BULL_EXPANSION',         // Alles grün, Trend & Taktgeber intakt
  BULL_WARNING: 'BULL_WARNING',             // Erste Ermüdung / Taktgeber nähert sich SMA
  BULL_CRITICAL: 'BULL_CRITICAL',           // Akuter Top-Alarm: MSTR verliert SMA-200
  BEAR_REGIME: 'BEAR_REGIME',               // Krypto-Winter / toxisches Makro-Klima
  CYCLE_BOTTOM_CLOSE: 'CYCLE_BOTTOM_CLOSE', // Kapitulation / Generations-Bodenbildung
  UNKNOWN: 'UNKNOWN'
});

/**
 * Makro-Stress & Crash-Regime (MacroStressSensorHub, ehemals Katastrophen-Matrix & Gold-Sniper)
 */
export const MacroStressRegime = Object.freeze({
  NORMAL_EXPANSION: 'NORMAL_EXPANSION',       // Wirtschaft & Trend intakt
  SYSTEMIC_STRESS: 'SYSTEMIC_STRESS',         // Trendbruch + Makro-Pfeiler: Kredit/Vola/Liquidität
  LIQUIDATION_CASCADE: 'LIQUIDATION_CASCADE', // S&P Drawdown -18% bis -20%: Zwangsverkäufe rollen
  PANIC_CAPITULATION: 'PANIC_CAPITULATION',   // Panik-Boden / Verkäufer-Erschöpfung
  UNKNOWN: 'UNKNOWN'
});

/**
 * Geldmarkt- & Treasury-Liquiditäts-Regime (LiquiditySensorHub)
 */
export const LiquidityRegime = Object.freeze({
  EXPANSION: 'EXPANSION',               // Puffer ausreichend, Slack gesund
  BUFFERED_CUSHION: 'BUFFERED_CUSHION', // RRP niedrig, aber TGA-Cushion & Buybacks puffern (TTC > 90d)
  DRAIN_WARNING: 'DRAIN_WARNING',       // TGA Refill / Schrumpfende Reserven / Moderater Entzug
  CRITICAL_DRAIN: 'CRITICAL_DRAIN',     // Akute Liquiditätsverknappung / TTC < 30d / Toxische Falle
  UNKNOWN: 'UNKNOWN'
});

/**
 * Markt-Boden & Kapitulations-Regime (MarketBottomSensorHub)
 */
export const BottomRegime = Object.freeze({
  NONE: 'NONE',
  BOTTOM_FORMING: 'BOTTOM_FORMING',
  CAPITULATION_CONFIRMED: 'CAPITULATION_CONFIRMED',
  UNKNOWN: 'UNKNOWN'
});

/**
 * Derivate- & OpEx-Regime (DerivativesSensorHub)
 */
export const DerivativesRegime = Object.freeze({
  EXTREME_SQUEEZE_COIL: 'EXTREME_SQUEEZE_COIL', // Hexensabbat/OpEx + extremer Put/Short-Überhang
  MILD_OPEX_PINNING: 'MILD_OPEX_PINNING',       // Reguläre Verfallswoche mit normalem Sentiment
  VOL_CRUSH_REBOUND: 'VOL_CRUSH_REBOUND',       // VIX-Settlement erreicht + VIX-Abfall
  POST_OPEX_EXPANSION: 'POST_OPEX_EXPANSION',   // Folgewoche nach Verfall: Gamma-Klammer gelöst
  NEUTRAL_FLOW: 'NEUTRAL_FLOW',                 // Außerhalb relevanter Verfallsfenster
  UNKNOWN: 'UNKNOWN'
});

/**
 * Goldilocks- & Makro-Regime (GoldilocksSensorHub)
 */
export const GoldilocksRegime = Object.freeze({
  GOLDILOCKS_EXPANSION: 'GOLDILOCKS_EXPANSION',   // Disinflation + stabiler Jobmarkt + Zinspause/Cuts (Max Bullish)
  STAGFLATION_PRESSURE: 'STAGFLATION_PRESSURE',   // Re-Inflation / Rohstoff-Spike bei schwächelndem Wachstum
  RECESSION_CONTRACTION: 'RECESSION_CONTRACTION', // Sahm-Regel getriggert oder rapider Job-Abbau
  OVERHEATING_BOOM: 'OVERHEATING_BOOM',           // Wirtschaft überhitzt, Lohn-Preis-Spirale droht
  TRANSITIONAL: 'TRANSITIONAL',                   // Uneinheitliche Daten / Übergangsphase
  UNKNOWN: 'UNKNOWN'
});


