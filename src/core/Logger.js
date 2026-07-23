export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

class LoggerClass {
  constructor() {
    // Standardmäßig auf INFO, in Prod (oder via .env) kann man es auf WARN stellen
    this.level = this._parseLogLevel(process.env.LOG_LEVEL) || LOG_LEVELS.INFO;
  }

  _parseLogLevel(levelStr) {
    if (!levelStr) return null;
    const upper = levelStr.toUpperCase();
    return LOG_LEVELS[upper] !== undefined ? LOG_LEVELS[upper] : null;
  }

  setLevel(levelStr) {
    const newLevel = this._parseLogLevel(levelStr);
    if (newLevel !== null) {
      this.level = newLevel;
    }
  }

  _formatMessage(levelName, message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${levelName}] ${message}`;
  }

  debug(message, ...optionalParams) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log(this._formatMessage('DEBUG', message), ...optionalParams);
    }
  }

  info(message, ...optionalParams) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(this._formatMessage('INFO', message), ...optionalParams);
    }
  }

  warn(message, ...optionalParams) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(`\x1b[33m${this._formatMessage('WARN', message)}\x1b[0m`, ...optionalParams);
    }
  }

  error(message, ...optionalParams) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(`\x1b[31m${this._formatMessage('ERROR', message)}\x1b[0m`, ...optionalParams);
    }
  }

  fatal(message, ...optionalParams) {
    if (this.level <= LOG_LEVELS.FATAL) {
      console.error(`\x1b[41m\x1b[37m${this._formatMessage('FATAL', message)}\x1b[0m`, ...optionalParams);
      // Hard crash as requested
      process.exit(1);
    }
  }
}

export const Logger = new LoggerClass();
