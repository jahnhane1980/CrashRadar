import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeSeriesFetcher } from '../../src/services/TimeSeriesFetcher.js';

describe('TimeSeriesFetcher Profile Filtering', () => {
  let mockStorage;
  let mockRequestManager;
  let mockErrorRegistry;
  let mockConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = { insertDataAndState: vi.fn(), getSyncState: vi.fn().mockReturnValue(null) };
    mockRequestManager = { fetch: vi.fn() };
    mockErrorRegistry = { addError: vi.fn(), addWarning: vi.fn() };

    mockConfig = {
      globalConcurrency: 2,
      providers: {
        "Simple": { type: "http", baseUrl: "http://simple.com", auth: null }
      },
      tasks: [
        { id: "task_daily_1", provider: "Simple", endpoint: "/daily1" }, // default daily (no frequency field)
        { id: "task_daily_2", provider: "Simple", endpoint: "/daily2", frequency: "daily" },
        { id: "task_m5_1", provider: "Simple", endpoint: "/m5_1", frequency: "intraday_m5" },
        { id: "task_m5_2", provider: "Simple", endpoint: "/m5_2", frequency: "intraday_m5" }
      ]
    };
  });

  it('filters only daily tasks when profile is "daily"', async () => {
    const fetcher = new TimeSeriesFetcher(mockConfig, mockStorage, mockRequestManager, mockErrorRegistry);
    const executedTaskIds = [];
    vi.spyOn(fetcher, 'runTask').mockImplementation(async (task) => {
      executedTaskIds.push(task.id);
    });

    await fetcher.runAllTasks('daily');

    expect(executedTaskIds).toEqual(['task_daily_1', 'task_daily_2']);
  });

  it('filters only intraday_m5 tasks when profile is "intraday_m5"', async () => {
    const fetcher = new TimeSeriesFetcher(mockConfig, mockStorage, mockRequestManager, mockErrorRegistry);
    const executedTaskIds = [];
    vi.spyOn(fetcher, 'runTask').mockImplementation(async (task) => {
      executedTaskIds.push(task.id);
    });

    await fetcher.runAllTasks('intraday_m5');

    expect(executedTaskIds).toEqual(['task_m5_1', 'task_m5_2']);
  });

  it('runs all tasks when profile is "all"', async () => {
    const fetcher = new TimeSeriesFetcher(mockConfig, mockStorage, mockRequestManager, mockErrorRegistry);
    const executedTaskIds = [];
    vi.spyOn(fetcher, 'runTask').mockImplementation(async (task) => {
      executedTaskIds.push(task.id);
    });

    await fetcher.runAllTasks('all');

    expect(executedTaskIds).toEqual(['task_daily_1', 'task_daily_2', 'task_m5_1', 'task_m5_2']);
  });
});
