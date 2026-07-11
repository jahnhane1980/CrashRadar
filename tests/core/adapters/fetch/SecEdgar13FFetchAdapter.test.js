import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecEdgar13FFetchAdapter } from '../../../../src/core/adapters/fetch/SecEdgar13FFetchAdapter.js';
import fs from 'fs';

describe('SecEdgar13FFetchAdapter', () => {
    let adapter;
    let mockRequestManager;
    let task;
    let originalReadFileSync;

    beforeEach(() => {
        adapter = new SecEdgar13FFetchAdapter();
        // Speed up the wait() method in tests to avoid slow tests
        vi.spyOn(adapter, 'wait').mockResolvedValue();

        task = {
            id: 'sec_13f_smart_money',
            provider: 'SecEdgar13F'
        };

        // Mock Config File to only process 1 fund (Citadel) instead of 20
        originalReadFileSync = fs.readFileSync;
        vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, options) => {
            if (filePath.includes('Smart-Money-Config.json')) {
                return JSON.stringify({
                    "0001423053": { "name": "Citadel Advisors", "strategy": "Market Maker" }
                });
            }
            return originalReadFileSync(filePath, options);
        });

        mockRequestManager = {
            fetch: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sollte sauberes SEC XML korrekt parsen (Happy Path mit Namespaces)', async () => {
        // Mock API Responses
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) {
                return JSON.stringify({
                    filings: {
                        recent: {
                            form: ['10-K', '13F-HR', '13F-HR/A'],
                            accessionNumber: ['0001-22-00', '0001423053-26-000001', '0001423053-26-000002'],
                            filingDate: ['2026-01-01', '2026-05-15', '2026-05-20'],
                            reportDate: ['2025-12-31', '2026-03-31', '2026-03-31']
                        }
                    }
                });
            }
            if (url.includes('index.json')) {
                return JSON.stringify({
                    directory: {
                        item: [
                            { name: 'primary_doc.xml' },
                            { name: 'holdings_q1.xml' } // Target
                        ]
                    }
                });
            }
            if (url.includes('holdings_q1.xml')) {
                return `<?xml version="1.0"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable" xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
    <ns1:infoTable>
        <ns1:nameOfIssuer>APPLE INC</ns1:nameOfIssuer>
        <ns1:titleOfClass>COM</ns1:titleOfClass>
        <ns1:cusip>037833100</ns1:cusip>
        <ns1:value>150000</ns1:value>
        <ns1:shrsOrPrnAmt>
            <ns1:sshPrnamt>10000</ns1:sshPrnamt>
            <ns1:sshPrnamtType>SH</ns1:sshPrnamtType>
        </ns1:shrsOrPrnAmt>
        <ns1:putCall>PUT</ns1:putCall>
    </ns1:infoTable>
    <infoTable>
        <nameOfIssuer>NVIDIA CORP</nameOfIssuer>
        <cusip>67066G104</cusip>
        <value>250000</value>
        <shrsOrPrnAmt>
            <sshPrnamt>5000</sshPrnamt>
        </shrsOrPrnAmt>
    </infoTable>
</informationTable>`;
            }
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', '2026-01-01', mockRequestManager);

        // Weil wir 13F-HR und 13F-HR/A gemockt haben und beide dasselbe XML zurückgeben:
        // Gibt es 2 Filings * 2 Positionen = 4 Einträge im Result Array
        expect(result.length).toBe(4);
        
        // Prüfe Apple (mit Namespace ns1 und PUT Option)
        expect(result[0].issuer_name).toBe('APPLE INC');
        expect(result[0].cusip).toBe('037833100');
        expect(result[0].put_call).toBe('PUT');
        expect(result[0].value).toBe(150000);
        expect(result[0].shares).toBe(10000);
        expect(result[0].cik).toBe('0001423053');
        expect(result[0].report_date).toBe('2026-03-31');

        // Prüfe Nvidia (ohne Namespace, Fallback STOCK)
        expect(result[1].issuer_name).toBe('NVIDIA CORP');
        expect(result[1].cusip).toBe('67066G104');
        expect(result[1].put_call).toBe('STOCK');
    });

    it('sollte leere Arrays zurückgeben und keinen Crash verursachen, wenn das XML komplett kaputt ist', async () => {
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) return JSON.stringify({ filings: { recent: { form: ['13F-HR'], accessionNumber: ['123'], filingDate: ['2026'], reportDate: ['2026'] } } });
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) return `DIES IST GAR KEIN XML SONDERN EIN 502 GATEWAY ERROR HTML`;
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', null, mockRequestManager);

        expect(result).toEqual([]); // Stream läuft durch, findet keine <infoTable> -> kein Crash
    });

    it('sollte leere Arrays zurückgeben, wenn infoTable Tags im XML komplett fehlen', async () => {
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) return JSON.stringify({ filings: { recent: { form: ['13F-HR'], accessionNumber: ['123'], filingDate: ['2026'], reportDate: ['2026'] } } });
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) return `<?xml version="1.0"?><data><someOtherTag>AAPL</someOtherTag></data>`;
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', null, mockRequestManager);

        expect(result).toEqual([]); 
    });

    it('sollte den Fonds überspringen und nicht crashen, wenn das XML gar nicht ankommt (Network Error)', async () => {
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) return JSON.stringify({ filings: { recent: { form: ['13F-HR'], accessionNumber: ['123'], filingDate: ['2026'], reportDate: ['2026'] } } });
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) throw new Error('Network Timeout SEC');
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', null, mockRequestManager);

        // Catch block inside fetch catches the error and logs it, then proceeds to next fund
        // Since there is only 1 fund in mock config, it returns []
        expect(result).toEqual([]);
    });

    it('sollte Chaos-Zeilen in infoTable (z.B. fehlende CUSIP oder fehlerhafte Werte) überspringen', async () => {
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) return JSON.stringify({ filings: { recent: { form: ['13F-HR'], accessionNumber: ['123'], filingDate: ['2026'], reportDate: ['2026'] } } });
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) return `
                <infoTable>
                    <nameOfIssuer>MISSING CUSIP</nameOfIssuer>
                    <value>250000</value>
                    <shrsOrPrnAmt><sshPrnamt>5000</sshPrnamt></shrsOrPrnAmt>
                </infoTable>
                <infoTable>
                    <nameOfIssuer>MISSING SHARES</nameOfIssuer>
                    <cusip>123456789</cusip>
                    <value>250000</value>
                </infoTable>
                <infoTable>
                    <nameOfIssuer>BROKEN VALUE</nameOfIssuer>
                    <cusip>987654321</cusip>
                    <value>BROKEN</value>
                    <shrsOrPrnAmt><sshPrnamt>5000</sshPrnamt></shrsOrPrnAmt>
                </infoTable>
                <infoTable>
                    <nameOfIssuer>VALID RECORD</nameOfIssuer>
                    <cusip>111222333</cusip>
                    <value>100</value>
                    <shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt>
                </infoTable>
            `;
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', null, mockRequestManager);

        // Record 1 & 2 skipped because missing cusip / shares.
        // Record 3 has broken value, so parsed as 0 (due to parseInt(..., 10) || 0 fallback). 
        
        expect(result.length).toBe(2);
        expect(result[0].issuer_name).toBe('BROKEN VALUE');
        expect(result[0].value).toBe(0); // Fallback applied
        
        expect(result[1].issuer_name).toBe('VALID RECORD');
        expect(result[1].value).toBe(100);
    });

    it('sollte 13F-HR/A (Amendments / Korrekturen) zuverlässig erkennen und einlesen', async () => {
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) {
                return JSON.stringify({
                    filings: {
                        recent: {
                            form: ['13F-HR/A'], // Ausschließlich ein Amendment!
                            accessionNumber: ['AMEND-123'],
                            filingDate: ['2026-06-01'],
                            reportDate: ['2026-03-31']
                        }
                    }
                });
            }
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) return `
                <infoTable>
                    <nameOfIssuer>SECRET ASSET</nameOfIssuer>
                    <cusip>999999999</cusip>
                    <value>500000</value>
                    <shrsOrPrnAmt><sshPrnamt>20000</sshPrnamt></shrsOrPrnAmt>
                </infoTable>
            `;
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', null, mockRequestManager);

        expect(result.length).toBe(1);
        expect(result[0].issuer_name).toBe('SECRET ASSET');
        expect(result[0].report_date).toBe('2026-03-31');
    });

    it('sollte Optionen (PUT/CALL) und reine Aktien (STOCK) sauber über das putCall Tag trennen', async () => {
        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) return JSON.stringify({ filings: { recent: { form: ['13F-HR'], accessionNumber: ['123'], filingDate: ['2026'], reportDate: ['2026'] } } });
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) return `
                <infoTable>
                    <nameOfIssuer>APPLE LONG</nameOfIssuer>
                    <cusip>037833100</cusip>
                    <value>1000</value>
                    <shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt>
                </infoTable>
                <infoTable>
                    <nameOfIssuer>APPLE CALL</nameOfIssuer>
                    <cusip>037833100</cusip>
                    <value>500</value>
                    <shrsOrPrnAmt><sshPrnamt>5</sshPrnamt></shrsOrPrnAmt>
                    <putCall>Call</putCall>
                </infoTable>
                <infoTable>
                    <nameOfIssuer>APPLE PUT</nameOfIssuer>
                    <cusip>037833100</cusip>
                    <value>200</value>
                    <shrsOrPrnAmt><sshPrnamt>2</sshPrnamt></shrsOrPrnAmt>
                    <putCall> pUt </putCall>
                </infoTable>
            `;
        });

        const result = await adapter.fetch(task, 'SecEdgar13F', null, mockRequestManager);

        expect(result.length).toBe(3);
        
        // Fehlt das Tag, wird es zu 'STOCK'
        expect(result[0].issuer_name).toBe('APPLE LONG');
        expect(result[0].put_call).toBe('STOCK');

        // Call wird großgeschrieben (toUpperCase)
        expect(result[1].issuer_name).toBe('APPLE CALL');
        expect(result[1].put_call).toBe('CALL');

        // Put wird getrimmt und großgeschrieben
        expect(result[2].issuer_name).toBe('APPLE PUT');
        expect(result[2].put_call).toBe('PUT');
    });

    it('sollte nur den in task.params.cik übergebenen Fonds verarbeiten (Chunking-Logik)', async () => {
        // Wir überschreiben den beforeEach Mock für fs.readFileSync speziell für diesen Test,
        // um ZWEI Fonds in der Config zu simulieren.
        vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, options) => {
            if (filePath.includes('Smart-Money-Config.json')) {
                return JSON.stringify({
                    "0001423053": { "name": "Citadel Advisors", "strategy": "Market Maker" },
                    "0001067983": { "name": "Berkshire Hathaway", "strategy": "Value Investing" }
                });
            }
            return originalReadFileSync(filePath, options);
        });

        mockRequestManager.fetch.mockImplementation(async (url) => {
            if (url.includes('submissions')) return JSON.stringify({ filings: { recent: { form: ['13F-HR'], accessionNumber: ['123'], filingDate: ['2026'], reportDate: ['2026'] } } });
            if (url.includes('index.json')) return JSON.stringify({ directory: { item: [{ name: 'holdings.xml' }] } });
            if (url.includes('holdings.xml')) return `
                <infoTable>
                    <nameOfIssuer>TEST ASSET</nameOfIssuer>
                    <cusip>000000000</cusip>
                    <value>100</value>
                    <shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt>
                </infoTable>
            `;
        });

        // Task explizit mit params.cik
        const chunkTask = {
            id: 'sec_13f_0001423053',
            provider: 'SecEdgar13F',
            params: { cik: '0001423053' }
        };

        const result = await adapter.fetch(chunkTask, 'SecEdgar13F', null, mockRequestManager);

        // Erwartet: Nur 1 Datensatz von Citadel
        expect(result.length).toBe(1);
        expect(result[0].cik).toBe('0001423053');
        
        // Erwartet: Die URL-Aufrufe an die SEC dürfen absolut keine Berkshire CIK (1067983) enthalten
        const calledUrls = mockRequestManager.fetch.mock.calls.map(call => call[0]);
        const hasBerkshireCall = calledUrls.some(url => url.includes('1067983') || url.includes('CIK0001067983'));
        
        expect(hasBerkshireCall).toBe(false);
    });
});
