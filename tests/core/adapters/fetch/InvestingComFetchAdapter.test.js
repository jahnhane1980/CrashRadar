import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvestingComFetchAdapter } from '../../../../src/core/adapters/fetch/InvestingComFetchAdapter.js';
import fetch from 'node-fetch';

vi.mock('node-fetch');

describe('InvestingComFetchAdapter', () => {
    let adapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new InvestingComFetchAdapter();
    });

    const mockResponse = (status, html) => {
        fetch.mockResolvedValue({
            status,
            ok: status >= 200 && status < 300,
            text: async () => html
        });
    };

    const validHtml = `
        <html>
            <body>
                <h1 class="font-bold smMax:text-xl smMax:leading-7 sm:text-3xl sm:leading-8">U.S. Challenger Job Cuts</h1>
                <table>
                    <tbody>
                        <tr>
                            <td>Dec 05, 2024</td>
                            <td>12:30</td>
                            <td>75.4K</td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    `;

    it('should fetch and parse data successfully on happy path', async () => {
        mockResponse(200, validHtml);
        
        const task = { id: 'investing_challenger' };
        const result = await adapter.fetch(task, {}, null);
        
        expect(result).toHaveLength(1);
        expect(result[0].record_date).toBe('2024-12-05');
        expect(result[0].value).toBe(75400);
    });
    
    it('should parse million suffix correctly (M)', async () => {
        const html = validHtml.replace('75.4K', '1.5M');
        mockResponse(200, html);
        
        const task = { id: 'investing_challenger' };
        const result = await adapter.fetch(task, {}, null);
        
        expect(result[0].value).toBe(1500000);
    });

    it('should throw an error if task id is unsupported', async () => {
        const task = { id: 'invalid_task' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('Unsupported task for InvestingComFetchAdapter: invalid_task');
    });

    it('should throw an error if HTTP returns 403 Forbidden', async () => {
        mockResponse(403, '');
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('HTTP 403 Forbidden: Blocked by Cloudflare!');
    });

    it('should throw an error if HTTP returns other non-ok status', async () => {
        mockResponse(500, '');
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('HTTP Error: 500');
    });

    it('should throw an error if H1 text is missing or wrong', async () => {
        const invalidHtml = validHtml.replace('U.S. Challenger Job Cuts', 'Wrong Title');
        mockResponse(200, invalidHtml);
        
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('Validation Failed: H1 with text "U.S. Challenger Job Cuts" not found! DOM structure changed.');
    });

    it('should throw an error if H1 is missing required CSS classes', async () => {
        const invalidHtml = validHtml.replace('sm:text-3xl', 'wrong-class');
        mockResponse(200, invalidHtml);
        
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow(/Validation Failed: H1 class mismatch/);
    });

    it('should throw an error if table tbody tr structure is missing (no data found)', async () => {
        const invalidHtml = `
            <html>
                <body>
                    <h1 class="font-bold smMax:text-xl smMax:leading-7 sm:text-3xl sm:leading-8">U.S. Challenger Job Cuts</h1>
                    <table>
                        <tbody>
                            <!-- empty -->
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        mockResponse(200, invalidHtml);
        
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('Could not extract data rows from the table.');
    });

    it('should throw an error if actual value is unparseable', async () => {
        const invalidHtml = validHtml.replace('75.4K', 'NaNValue');
        mockResponse(200, invalidHtml);
        
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('Could not parse actual value: NaNValue');
    });

    it('should throw an error if date is unparseable', async () => {
        const invalidHtml = validHtml.replace('Dec 05, 2024', 'Invalid Date String');
        mockResponse(200, invalidHtml);
        
        const task = { id: 'investing_challenger' };
        await expect(adapter.fetch(task, {}, null)).rejects.toThrow('Could not parse date: Invalid Date String');
    });
    
    it('should handle missing actual values in top row correctly (skips to next row)', async () => {
        const htmlWithEmptyTopRow = `
            <html>
                <body>
                    <h1 class="font-bold smMax:text-xl smMax:leading-7 sm:text-3xl sm:leading-8">U.S. Challenger Job Cuts</h1>
                    <table>
                        <tbody>
                            <tr>
                                <td>Jan 01, 2025</td>
                                <td>12:30</td>
                                <td></td> <!-- Missing actual -->
                                <td></td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>Dec 05, 2024</td>
                                <td>12:30</td>
                                <td>75.4K</td> <!-- Valid actual -->
                                <td></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        mockResponse(200, htmlWithEmptyTopRow);
        
        const task = { id: 'investing_challenger' };
        const result = await adapter.fetch(task, {}, null);
        
        expect(result).toHaveLength(1);
        expect(result[0].record_date).toBe('2024-12-05');
        expect(result[0].value).toBe(75400);
    });
});
