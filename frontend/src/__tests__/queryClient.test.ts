import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { shouldRetryQuery } from '../queryClient';

describe('query retry policy', () => {
  it('does not retry deterministic client failures or rate limits', () => {
    expect(shouldRetryQuery(0, new ApiError('bad input', 400, 'VALIDATION_ERROR'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('unauthorized', 401, 'UNAUTHORIZED'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('rate limited', 429, 'RATE_LIMITED'))).toBe(false);
  });

  it('permits only one bounded retry for server and network failures', () => {
    expect(shouldRetryQuery(0, new ApiError('generic server failure', 503, 'INTERNAL_SERVER_ERROR'))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError('generic server failure', 503, 'INTERNAL_SERVER_ERROR'))).toBe(false);
    expect(shouldRetryQuery(0, new TypeError('fetch failed'))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError('fetch failed'))).toBe(false);
  });

  it('does not amplify known market-provider or reference-universe outages', () => {
    expect(shouldRetryQuery(0, new ApiError('provider unavailable', 503, 'MARKET_DATA_UNAVAILABLE'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('catalogue unavailable', 503, 'MARKET_UNIVERSE_UNAVAILABLE'))).toBe(false);
  });
});
