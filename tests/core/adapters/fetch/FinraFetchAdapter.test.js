import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinraFetchAdapter } from '../../../../../src/core/adapters/fetch/FinraFetchAdapter.js';
import fs from 'fs';
import xlsx from 'xlsx';

// Mock fs to avoid writing actual files during tests
vi.mock('fs');
vi.mock('xlsx');

describe('FinraFetchAdapter', () => {
    let adapter;
    let mockRequestManager;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRequestManager = { fetch: vi.fn() };
        adapter = new FinraFetchAdapter();
    });

    it('should catch error and return empty array if margin-statistics link is not found', async () => {
        mockRequestManager.fetch.mockResolvedValue('<html><body>No link here</body></html>');

        const result = await adapter.fetch({ id: 'finra_test' }, {}, '2020-01-01', mockRequestManager);
        expect(result).toEqual([]);
    });

    it('should parse excel and return formatted data correctly', async () => {
        // Mock the HTML page response
        mockRequestManager.fetch.mockResolvedValueOnce('<html><a href="/sites/default/files/2021-03/margin-statistics.xlsx">Link</a></html>');
        
        // Mock the Excel file buffer response
        mockRequestManager.fetch.mockResolvedValueOnce(new ArrayBuffer(8));

        const mockSheet = {}; // Not used because we mock sheet_to_json
        const mockWorkbook = {
            SheetNames: ['Margin Debt'],
            Sheets: { 'Margin Debt': mockSheet }
        };

        xlsx.read.mockReturnValue(mockWorkbook);
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Year-Month', 'Debit Balances'],
            ['2025-10', 1183654],
            ['2021-01', 200000],
            ['Invalid', null]
        ]);

        const task = { id: 'finra_test' };
        const result = await adapter.fetch(task, {}, '2020-01-01', mockRequestManager);

        expect(result.length).toBe(2);
        
        // Assert sorting and mapping
        expect(result[0].record_date).toBe('2021-01-01');
        expect(result[0].margin_debt).toBe(200000);
        
        expect(result[1].record_date).toBe('2025-10-01');
        expect(result[1].margin_debt).toBe(1183654);

        // Verify fs.writeFileSync was called to archive
        expect(fs.writeFileSync).toHaveBeenCalled();
    });
});
