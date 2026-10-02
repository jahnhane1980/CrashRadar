import { Logger } from '../../Logger.js';

export class PolygonM5FetchAdapter {
  constructor(requestManagerOrOptions = null, options = {}) {
    if (requestManagerOrOptions && typeof requestManagerOrOptions.fetch === 'function') {
      this.requestManager = requestManagerOrOptions;
      this.options = options || {};
    } else if (requestManagerOrOptions && typeof requestManagerOrOptions === 'object') {
      this.options = requestManagerOrOptions;
      this.requestManager = requestManagerOrOptions.requestManager || null;
    } else {
      this.options = options || {};
      this.requestManager = null;
    }
  }

  setRequestManager(requestManager) {
    this.requestManager = requestManager;
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  _buildHeaders(provider) {
    const headers = { ...(provider?.headers || {}) };

    if (provider?.auth) {
      const envVar = provider.auth.envVar;
      const authVal = envVar ? process.env[envVar] : null;
      if (!authVal) {
        Logger.warn(`[PolygonM5FetchAdapter] Missing environment variable ${envVar}`);
      } else {
        const type = provider.auth.type || 'header';
        if (type === 'header') {
          const key = provider.auth.key || 'Authorization';
          const prefix = provider.auth.prefix ?? 'Bearer ';
          headers[key] = `${prefix}${authVal}`;
        }
      }
    } else if (process.env.POLYGONIO_API_KEY) {
      headers.Authorization = `Bearer ${process.env.POLYGONIO_API_KEY}`;
    }

    return headers;
  }

  async fetch(task, provider, startValue, requestManager) {
    const rm = requestManager || this.requestManager;
    if (!rm || typeof rm.fetch !== 'function') {
      throw new Error('[PolygonM5FetchAdapter] RequestManager is required');
    }

    const fromMs = this._calculateFromMs(startValue, provider, task);

    if (fromMs >= Date.now()) {
      return [];
    }

    const providerId = task?.provider || (typeof provider === 'string' ? provider : provider?.id || provider?.name) || 'PolygonM5';
    const baseUrl = provider?.baseUrl || 'https://api.polygon.io/v2';
    const headers = this._buildHeaders(provider);

    let currentUrl = `${baseUrl}/aggs/ticker/${task.ticker}/range/5/minute/${fromMs}/${Date.now()}?adjusted=true&sort=asc&limit=50000`;
    const results = [];

    while (currentUrl) {
      const data = await rm.fetch(currentUrl, providerId, { headers });

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
