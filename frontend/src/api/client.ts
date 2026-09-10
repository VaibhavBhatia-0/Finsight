export type DataFreshness =
  | 'Live'
  | 'Delayed'
  | 'End-of-day'
  | 'Historical'
  | 'Static'
  | 'Synthetic';

export interface ApiMeta {
  timestamp: string;
  freshness: DataFreshness;
  source?: string;
  asOf?: string;
  degraded?: boolean;
  [key: string]: unknown;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
  error: null;
  meta: ApiMeta;
}

interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown[] };
}

export interface ApiResult<T> {
  data: T;
  meta: ApiMeta;
}

export interface RequestConfig {
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function getToken(): string | null {
  if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return null;
  return sessionStorage.getItem('jwt') ?? localStorage.getItem('jwt');
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const runtimeBase = apiBaseUrl || (typeof window === 'undefined' ? 'http://localhost' : '');
  const url = `${runtimeBase}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `${url}?${serialized}` : url;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  config?: RequestConfig,
): Promise<ApiResult<T>> {
  const token = getToken();
  const response = await fetch(buildUrl(path, config?.params), {
    method,
    signal: config?.signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorEnvelope | null;
  if (!response.ok || !payload || payload.success === false) {
    if (response.status === 401) {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('jwt');
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jwt');
    }
    const error = payload && payload.success === false ? payload.error : undefined;
    throw new ApiError(
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.details,
    );
  }

  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, config?: RequestConfig) => request<T>('GET', path, undefined, config),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) => request<T>('POST', path, body, config),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) => request<T>('PUT', path, body, config),
  patch: <T>(path: string, body?: unknown, config?: RequestConfig) => request<T>('PATCH', path, body, config),
  delete: <T = void>(path: string, config?: RequestConfig) => request<T>('DELETE', path, undefined, config),
};

export default api;
