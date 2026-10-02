import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '../core/Storage.js';
import { RequestManager } from '../core/RequestManager.js';
import { TimeSeriesFetcher } from '../services/TimeSeriesFetcher.js';
import { ErrorRegistry } from '../core/ErrorRegistry.js';
import { NtfyService } from '../services/NtfyService.js';
import { Logger } from '../core/Logger.js';
import { StandardRunner } from './StandardRunner.js';
import { TestRunner } from './TestRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TimeSeriesFetchRunner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.isTest = Boolean(options.test);
    this.dependencies = dependencies;
    this.activeRunner = null;
    this.storage = dependencies.storage || null;
    this.errorRegistry = dependencies.errorRegistry || null;
    this.heartbeatInterval = null;
  }

  async run() {
    const isTest = this.isTest;
    const dbUrl = isTest 
      ? (this.dependencies.dbUrl || TestRunner.getDatabaseUrl()) 
      : (this.dependencies.dbUrl || process.env.DATABASE_URL);

    if (!dbUrl) throw new Error("Missing DATABASE_URL in environment.");

    const configPath = this.dependencies.configPath || path.resolve(__dirname, '../../config/Database-Fetcher-Config.json');
    let config = this.dependencies.config;
    if (!config) {
      if (!fs.existsSync(configPath)) {
        throw new Error(`Critical Config not found at ${configPath}. Exiting.`);
      }
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (isTest) {
      TestRunner.applyTestConfigOverrides(config);
    }

    if (config.tasks && Array.isArray(config.tasks)) {
      if (this.options.group) {
        config.tasks = config.tasks.filter(task => task.group === this.options.group);
        this.options.profile = 'all';
      } else {
        config.tasks = config.tasks.filter(task => task.group !== 'intraday_m5');
      }
    }

    const storage = this.dependencies.storage || new Storage({ databaseUrl: dbUrl });
    this.storage = storage;
    const requestManager = this.dependencies.requestManager || new RequestManager(config);
    const errorRegistry = this.dependencies.errorRegistry || this.errorRegistry || new ErrorRegistry();
    this.errorRegistry = errorRegistry;
    Logger.setRegistry(errorRegistry);
    const ntfyTopic = process.env.NTFY_TOPIC || this.dependencies.ntfyTopic;
    const ntfyService = this.dependencies.ntfyService !== undefined 
      ? this.dependencies.ntfyService 
      : new NtfyService(ntfyTopic);
    const fetcher = this.dependencies.fetcher || new TimeSeriesFetcher(config, storage, requestManager, errorRegistry);

    const runnerArgs = { config, storage, fetcher, errorRegistry, ntfyService, options: this.options };
    
    if (this.dependencies.runner) {
      this.activeRunner = this.dependencies.runner;
    } else {
      this.activeRunner = isTest ? new TestRunner(runnerArgs) : new StandardRunner(runnerArgs);
    }

    const isM5Group = this.options.group === 'intraday_m5';
    let heartbeatInterval = null;

    if (isM5Group) {
      const lockAcquired = await storage.acquireLock('m5_sync_lock', 600);
      if (!lockAcquired) {
        Logger.warn('m5_sync_lock is active - skipping execution');
        if (storage && typeof storage.close === 'function') {
          await storage.close();
        }
        return;
      }

      heartbeatInterval = setInterval(async () => {
        try {
          if (storage && typeof storage.renewLock === 'function') {
            await storage.renewLock('m5_sync_lock', 600);
          }
        } catch (err) {
          Logger.warn(`[LockHeartbeat] Failed to renew lock: ${err.message}`);
        }
      }, 120000);
      if (typeof heartbeatInterval.unref === 'function') {
        heartbeatInterval.unref();
      }
      this.heartbeatInterval = heartbeatInterval;
    }

    const originalClose = storage && typeof storage.close === 'function' ? storage.close.bind(storage) : null;
    if (isM5Group && originalClose) {
      storage.close = async () => {};
    }

    try {
      await this.activeRunner.run();
    } finally {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        this.heartbeatInterval = null;
      }
      if (isM5Group) {
        try {
          if (storage && typeof storage.releaseLock === 'function') {
            await storage.releaseLock('m5_sync_lock');
          }
        } finally {
          if (originalClose) {
            storage.close = originalClose;
            await originalClose();
          }
        }
      }
    }
  }

  async cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.activeRunner && typeof this.activeRunner.cleanup === 'function') {
      await this.activeRunner.cleanup();
      this.activeRunner = null;
    }
  }
}

// Backward-compatibility alias
export const DataFetchRunner = TimeSeriesFetchRunner;
