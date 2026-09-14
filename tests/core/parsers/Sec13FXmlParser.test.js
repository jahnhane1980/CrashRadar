import { describe, it, expect } from 'vitest';
import { Sec13FXmlParser } from '../../../src/core/parsers/Sec13FXmlParser.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Sec13FXmlParser', () => {
  const parser = new Sec13FXmlParser();

  it('sollte valides 13F XML mit Namespaces und Optionen sauber parsen', async () => {
    const xmlContent = `<?xml version="1.0"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable" xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
    <ns1:infoTable>
        <ns1:nameOfIssuer>APPLE INC</ns1:nameOfIssuer>
        <ns1:cusip>037833100</ns1:cusip>
        <ns1:value>150000</ns1:value>
        <ns1:shrsOrPrnAmt>
            <ns1:sshPrnamt>10000</ns1:sshPrnamt>
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

    const tmpFile = path.join(os.tmpdir(), `test_13f_parser_${Date.now()}.xml`);
    fs.writeFileSync(tmpFile, xmlContent);

    try {
      const results = await parser.parseStream(tmpFile, {
        cik: '0001536411',
        reportDate: '2026-06-30',
        filingDate: '2026-08-14'
      });

      expect(results.length).toBe(2);

      // Apple mit PUT
      expect(results[0].cik).toBe('0001536411');
      expect(results[0].report_date).toBe('2026-06-30');
      expect(results[0].filing_date).toBe('2026-08-14');
      expect(results[0].issuer_name).toBe('APPLE INC');
      expect(results[0].cusip).toBe('037833100');
      expect(results[0].put_call).toBe('PUT');
      expect(results[0].value).toBe(150000);
      expect(results[0].shares).toBe(10000);

      // Nvidia Fallback STOCK
      expect(results[1].issuer_name).toBe('NVIDIA CORP');
      expect(results[1].cusip).toBe('67066G104');
      expect(results[1].put_call).toBe('STOCK');
      expect(results[1].value).toBe(250000);
      expect(results[1].shares).toBe(5000);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('sollte auch mit positional Parametern aufrufbar sein', async () => {
    const xmlContent = `<infoTable>
        <nameOfIssuer>MICROSOFT CORP</nameOfIssuer>
        <cusip>594918104</cusip>
        <value>300000</value>
        <shrsOrPrnAmt><sshPrnamt>7000</sshPrnamt></shrsOrPrnAmt>
        <putCall> call </putCall>
    </infoTable>`;

    const tmpFile = path.join(os.tmpdir(), `test_13f_pos_${Date.now()}.xml`);
    fs.writeFileSync(tmpFile, xmlContent);

    try {
      const results = await parser.parseStream(tmpFile, '2026-06-30', '2026-08-14', '0001135730');
      expect(results.length).toBe(1);
      expect(results[0].cik).toBe('0001135730');
      expect(results[0].put_call).toBe('CALL');
      expect(results[0].issuer_name).toBe('MICROSOFT CORP');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('sollte unvollständige Einträge überspringen (Chaos Protection)', async () => {
    const xmlContent = `
    <infoTable>
        <nameOfIssuer>NO CUSIP</nameOfIssuer>
        <value>100</value>
        <shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt>
    </infoTable>
    <infoTable>
        <nameOfIssuer>NO VALUE</nameOfIssuer>
        <cusip>123456789</cusip>
        <shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt>
    </infoTable>
    <infoTable>
        <nameOfIssuer>NO SHARES</nameOfIssuer>
        <cusip>987654321</cusip>
        <value>500</value>
    </infoTable>
    <infoTable>
        <nameOfIssuer>VALID ITEM</nameOfIssuer>
        <cusip>111222333</cusip>
        <value>200</value>
        <shrsOrPrnAmt><sshPrnamt>50</sshPrnamt></shrsOrPrnAmt>
    </infoTable>`;

    const tmpFile = path.join(os.tmpdir(), `test_13f_chaos_${Date.now()}.xml`);
    fs.writeFileSync(tmpFile, xmlContent);

    try {
      const results = await parser.parseStream(tmpFile, { cik: '123', reportDate: '2026-06-30', filingDate: '2026-08-14' });
      expect(results.length).toBe(1);
      expect(results[0].issuer_name).toBe('VALID ITEM');
      expect(results[0].cusip).toBe('111222333');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('sollte leeres Array zurückgeben wenn Datei nicht existiert', async () => {
    const results = await parser.parseStream('/non/existent/path/file.xml', { cik: '123' });
    expect(results).toEqual([]);
  });

  it('sollte leeres Array zurückgeben wenn kein infoTable vorhanden ist', async () => {
    const tmpFile = path.join(os.tmpdir(), `test_13f_empty_${Date.now()}.xml`);
    fs.writeFileSync(tmpFile, '<html><body>Server Error 502</body></html>');

    try {
      const results = await parser.parseStream(tmpFile, { cik: '123' });
      expect(results).toEqual([]);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});
