import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import api, { ApiError } from '../../api/client';
import { endpoints } from '../../api/endpoints';
import { server } from '../server';

describe('canonical API client contract', () => {
  test('unwraps data and metadata from a success envelope', async () => {
    server.use(http.get(`http://localhost${endpoints.markets.overview}`, () => HttpResponse.json({
      success: true,
      data: { indices: [], india: [], us: [] },
      error: null,
      meta: { timestamp: '2026-09-10T00:00:00.000Z', freshness: 'Synthetic', source: 'test' },
    })));

    const result = await api.get<{ indices: []; india: []; us: [] }>(endpoints.markets.overview);
    expect(result.data.indices).toEqual([]);
    expect(result.meta).toMatchObject({ freshness: 'Synthetic', source: 'test' });
  });

  test('throws a typed ApiError from the standard error envelope', async () => {
    server.use(http.get(`http://localhost${endpoints.finance.summary}`, () => HttpResponse.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid' },
    }, { status: 401 })));

    await expect(api.get(endpoints.finance.summary)).rejects.toEqual(expect.objectContaining<ApiError>({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication token is missing or invalid',
    }));
  });

  test('downloads authenticated report files through the canonical client', async () => {
    const values = new Map<string, string>([['jwt', 'test-jwt']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: () => null, get length() { return values.size; } } as Storage;
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('localStorage', storage);
    server.use(http.get(`http://localhost${endpoints.reports.export}`, ({ request }) => {
      expect(request.headers.get('authorization')).toBe('Bearer test-jwt');
      return new HttpResponse('metric,value\nnetSavings,100', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="finance.csv"' } });
    }));
    const result = await api.download(endpoints.reports.export, { params: { reportType: 'finance_summary', format: 'csv' } });
    expect(result.filename).toBe('finance.csv');
    expect(await result.blob.text()).toContain('netSavings,100');
    vi.unstubAllGlobals();
  });
});
