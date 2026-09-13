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
  EXPANSION: 'EXPANSION',             // Puffer ausreichend, Slack gesund
  DRAIN_WARNING: 'DRAIN_WARNING',     // TGA Refill / Schrumpfende Reserven
  CRITICAL_DRAIN: 'CRITICAL_DRAIN',   // Akute Liquiditätsverknappung
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
