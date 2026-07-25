import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ObservabilityController } from "@backend/modules/api/controllers/ObservabilityController";

const loggerFns = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@backend/shared/logging/Logger.js", () => {
  return {
    Logger: class MockLogger {
      warn(...args: unknown[]) { return loggerFns.warn(...args); }
      info(...args: unknown[]) { return loggerFns.info(...args); }
      error(...args: unknown[]) { return loggerFns.error(...args); }
      debug(...args: unknown[]) { return loggerFns.debug(...args); }
    },
  };
});

describe("ObservabilityController - executeSigNozQuery", () => {
  let controller: InstanceType<typeof ObservabilityController>;

  beforeEach(() => {
    controller = new ObservabilityController();
    loggerFns.warn.mockClear();
    loggerFns.info.mockClear();
    loggerFns.error.mockClear();
    loggerFns.debug.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const runQuery = () =>
    (controller as unknown as { executeSigNozQuery: (...args: unknown[]) => Promise<unknown> })
      .executeSigNozQuery("https://cloud.url", "api-key", {} as never, "testQuery");

  it("returns sorted point values for the SigNoz v5 response shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        data: {
          type: "time_series",
          meta: {},
          data: {
            results: [
              {
                queryName: "testQuery",
                aggregations: [
                  {
                    index: 0,
                    alias: "__result_0",
                    meta: {},
                    series: [
                      { values: [{ timestamp: 200, value: 5 }, { timestamp: 100, value: 3 }] },
                      { values: [{ timestamp: 300, value: 2 }] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
    } as Response));

    const points = await runQuery();

    expect(points).toEqual([
      { timestamp: 100, value: 3 },
      { timestamp: 200, value: 5 },
      { timestamp: 300, value: 2 },
    ]);
    expect(loggerFns.warn).not.toHaveBeenCalled();
  });

  it("returns sorted point values for the legacy response shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          results: [
            {
              queryName: "testQuery",
              series: [
                { pointValues: [{ timestamp: 200, value: 5 }, { timestamp: 100, value: 3 }] },
                { pointValues: [{ timestamp: 300, value: 2 }] },
              ],
            },
          ],
        },
      }),
    } as Response));

    const points = await runQuery();

    expect(points).toEqual([
      { timestamp: 100, value: 3 },
      { timestamp: 200, value: 5 },
      { timestamp: 300, value: 2 },
    ]);
    expect(loggerFns.warn).not.toHaveBeenCalled();
  });

  it("logs a warning and returns empty when data.results is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response));

    const points = await runQuery();

    expect(points).toEqual([]);
    expect(loggerFns.warn).toHaveBeenCalledWith(
      expect.stringContaining("missing data.results"),
      expect.any(Object),
    );
  });

  it("logs a warning and returns empty when queryName does not match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { results: [{ queryName: "otherQuery", series: [] }] },
      }),
    } as Response));

    const points = await runQuery();

    expect(points).toEqual([]);
    expect(loggerFns.warn).toHaveBeenCalledWith(
      expect.stringContaining("no matching queryName"),
      expect.any(Object),
    );
  });

  it("logs a warning and returns empty when series is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { results: [{ queryName: "testQuery", series: [] }] },
      }),
    } as Response));

    const points = await runQuery();

    expect(points).toEqual([]);
    expect(loggerFns.warn).toHaveBeenCalledWith(
      expect.stringContaining("returned no series"),
      expect.any(Object),
    );
  });

  it("logs a warning and returns empty when pointValues are missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { results: [{ queryName: "testQuery", series: [{ labels: {} }] }] },
      }),
    } as Response));

    const points = await runQuery();

    expect(points).toEqual([]);
    expect(loggerFns.warn).toHaveBeenCalledWith(
      expect.stringContaining("returned series but no pointValues"),
      expect.any(Object),
    );
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    } as Response));

    await expect(runQuery()).rejects.toThrow("SigNoz query \"testQuery\" failed: 401 unauthorized");
  });

  it("calls SigNoz with the expected URL, method, and auth header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { results: [{ queryName: "testQuery", series: [] }] } }),
    } as Response));

    await runQuery();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://cloud.url/api/v5/query_range",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "SIGNOZ-API-KEY": "api-key",
        }),
      }),
    );
  });
});
