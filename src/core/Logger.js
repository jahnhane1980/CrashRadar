import { ErrorRegistry } from './ErrorRegistry.js';

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
    this.registry = new ErrorRegistry();
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

  _parseContext(message, optionalParams = []) {
    const strMsg = typeof message === 'string' ? message : String(message);
    let context = 'System';
    let cleanMsg = strMsg;

    const match = strMsg.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      context = match[1];
      cleanMsg = match[2] || strMsg;
    }

    const extra = optionalParams
      .map(p => (p instanceof Error ? p.message : typeof p === 'object' ? JSON.stringify(p) : String(p)))
      .filter(Boolean)
      .join(' ');
    const fullMsg = extra ? `${cleanMsg} ${extra}`.trim() : cleanMsg;

    return { context, fullMsg };
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
    const { context, fullMsg } = this._parseContext(message, optionalParams);
    this.registry.addWarning(context, fullMsg);
  }

  error(message, ...optionalParams) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(`\x1b[31m${this._formatMessage('ERROR', message)}\x1b[0m`, ...optionalParams);
    }
    const { context, fullMsg } = this._parseContext(message, optionalParams);
    this.registry.addError(context, fullMsg);
  }

  fatal(message, ...optionalParams) {
    const { context, fullMsg } = this._parseContext(message, optionalParams);
    this.registry.addError(context, fullMsg);
    if (this.level <= LOG_LEVELS.FATAL) {
      console.error(`\x1b[41m\x1b[37m${this._formatMessage('FATAL', message)}\x1b[0m`, ...optionalParams);
      // Hard crash as requested
      process.exit(1);
    }
  }

  hasIssues() {
    return this.registry.hasErrors() || this.registry.hasWarnings();
  }

  hasErrors() {
    return this.registry.hasErrors();
  }

  hasWarnings() {
    return this.registry.hasWarnings();
  }

  getSummary() {
    return this.registry.getSummary();
  }

  reset() {
    this.registry = new ErrorRegistry();
  }
}

export const Logger = new LoggerClass();

