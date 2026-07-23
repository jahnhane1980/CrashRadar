import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LOG_LEVELS } from '../../src/core/Logger.js';

describe('Logger', () => {
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let processExitSpy;

    beforeEach(() => {
        // Spies einrichten, um Konsolenausgaben zu prüfen und zu unterdrücken
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Mock process.exit, damit der Test-Runner bei .fatal() nicht abstürzt
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

        // Logger-Level für die Tests auf ein sauberes Standard-Level setzen
        Logger.setLevel('DEBUG');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should correctly parse log levels', () => {
        expect(Logger._parseLogLevel('DEBUG')).toBe(LOG_LEVELS.DEBUG);
        expect(Logger._parseLogLevel('info')).toBe(LOG_LEVELS.INFO);
        expect(Logger._parseLogLevel('WaRn')).toBe(LOG_LEVELS.WARN);
        expect(Logger._parseLogLevel('ERROR')).toBe(LOG_LEVELS.ERROR);
        expect(Logger._parseLogLevel('FATAL')).toBe(LOG_LEVELS.FATAL);
        
        // Ungültige oder fehlende Level
        expect(Logger._parseLogLevel('UNKNOWN_LEVEL')).toBeNull();
        expect(Logger._parseLogLevel(undefined)).toBeNull();
        expect(Logger._parseLogLevel(null)).toBeNull();
    });

    it('should update log level via setLevel()', () => {
        Logger.setLevel('WARN');
        expect(Logger.level).toBe(LOG_LEVELS.WARN);

        // Fallback: Wenn ein ungültiges Level übergeben wird, darf sich das aktuelle Level nicht ändern
        Logger.setLevel('INVALID');
        expect(Logger.level).toBe(LOG_LEVELS.WARN);
    });

    it('should format messages correctly with timestamps', () => {
        const formatted = Logger._formatMessage('INFO', 'Testnachricht');
        // Regex prüft auf: [2026-07-23T12:00:00.000Z] [INFO] Testnachricht
        expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Testnachricht$/);
    });

    it('should output debug messages only if level is DEBUG', () => {
        Logger.setLevel('DEBUG');
        Logger.debug('Debug1');
        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG] Debug1');

        Logger.setLevel('INFO');
        Logger.debug('Debug2');
        expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Keine zweite Ausgabe, da Level = INFO
    });

    it('should output info messages if level is <= INFO', () => {
        Logger.setLevel('INFO');
        Logger.info('Info1', 'Extra param');
        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy.mock.calls[0][0]).toContain('[INFO] Info1');
        expect(consoleLogSpy.mock.calls[0][1]).toBe('Extra param'); // Teste variadic params

        Logger.setLevel('WARN');
        Logger.info('Info2');
        expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Keine zweite Ausgabe
    });

    it('should output warn messages with ANSI colors if level is <= WARN', () => {
        Logger.setLevel('WARN');
        Logger.warn('Warn1');
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        // Prüfe auf gelbe ANSI-Farbe (\x1b[33m)
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('\x1b[33m');
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN] Warn1');

        Logger.setLevel('ERROR');
        Logger.warn('Warn2');
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should output error messages with ANSI colors if level is <= ERROR', () => {
        Logger.setLevel('ERROR');
        Logger.error('Error1');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        // Prüfe auf rote ANSI-Farbe (\x1b[31m)
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('\x1b[31m');
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR] Error1');

        Logger.setLevel('FATAL');
        Logger.error('Error2');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should output fatal messages, use ANSI colors and trigger process.exit(1)', () => {
        Logger.setLevel('FATAL');
        Logger.fatal('System crash!');
        
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('\x1b[41m'); // Roter Hintergrund
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('[FATAL] System crash!');
        
        expect(processExitSpy).toHaveBeenCalledTimes(1);
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});
