import { Logger } from '../../Logger.js';

export class PolygonM5FetchAdapter {
  constructor(options = {}) {
    this.minDelay = options.minDelay ?? 12500;
    this.rateLimitRetryDelay = options.rateLimitRetryDelay ?? 65000;
    this.max429Retries = options.max429Retries ?? 3;
    this.lastRequestTime = 0;
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _throttle() {
    if (this.lastRequestTime > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.minDelay) {
        await this.wait(this.minDelay - elapsed);
      }
    }
    this.lastRequestTime = Date.now();
  }

  _calculateFromMs(startValue, provider, task) {
    let fromMs;
    let isNumericOrCursor = false;

    if (typeof startValue === 'number' && !isNaN(startValue)) {
      fromMs = startValue + 300000;
      isNumericOrCursor = true;
    } else if (typeof startValue === 'string' && /^\d+$/.test(startValue.trim())) {
      fromMs = Number(startValue) + 300000;
      isNumericOrCursor = true;
    } else if (startValue && typeof startValue === 'object') {
      const ts = startValue.t ?? startValue.timestamp ?? startValue.cursor_timestamp ?? startValue.cursor;
      if (ts !== undefined && !isNaN(Number(ts))) {
        fromMs = Number(ts) + 300000;
        isNumericOrCursor = true;
      }
    }

    if (!isNumericOrCursor) {
      if (startValue) {
        const parsed = new Date(startValue).getTime();
        fromMs = isNaN(parsed) ? new Date(provider?.overrideStartDate || '2024-01-01').getTime() : parsed;
      } else {
        const fallback = task?.overrideStartDate || provider?.overrideStartDate || '2024-01-01';
        fromMs = new Date(fallback).getTime();
      }
    }

    return fromMs;
  }

  async _fetchWithRetry(url) {
    let attempts = 0;
    const maxRetries = this.max429Retries;

    while (true) {
      await this._throttle();

      const headers = {
        Authorization: `Bearer ${process.env.POLYGONIO_API_KEY}`
      };

      const response = await fetch(url, { headers });
      this.lastRequestTime = Date.now();

      if (response.status === 429) {
        if (attempts < maxRetries) {
          attempts++;
          Logger.warn(`[PolygonM5FetchAdapter] HTTP 429 rate limit exceeded. Sleeping ${this.rateLimitRetryDelay}ms before retry ${attempts}/${maxRetries}...`);
          await this.wait(this.rateLimitRetryDelay);
          this.lastRequestTime = 0;
          continue;
        }
        throw new Error(`HTTP 429: Rate limit exceeded after ${maxRetries} retries`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }
  }

  async fetch(task, provider, startValue, requestManager) {
    const fromMs = this._calculateFromMs(startValue, provider, task);

    if (fromMs >= Date.now()) {
      return [];
    }

    const baseUrl = provider?.baseUrl || 'https://api.polygon.io/v2';
    let currentUrl = `${baseUrl}/aggs/ticker/${task.ticker}/range/5/minute/${fromMs}/${Date.now()}?adjusted=true&sort=asc&limit=50000`;
    const results = [];

    while (currentUrl) {
      const data = await this._fetchWithRetry(currentUrl);

      if (data && Array.isArray(data.results)) {
        for (const item of data.results) {
          results.push({
            t: item.t,
            o: item.o,
            h: item.h,
            l: item.l,
            c: item.c,
            v: item.v
          });
        }
      }

      currentUrl = data?.next_url || null;
    }

    return results;
  }
}
