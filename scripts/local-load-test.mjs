import { monitorEventLoopDelay } from 'node:perf_hooks';

process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'pglite';
process.env.DB_PGLITE_DATA_DIR = `memory://finsight-load-${Date.now()}`;
process.env.JWT_SECRET = 'local-load-test-only-secret-that-is-longer-than-forty-eight-characters';
process.env.CORS_ORIGIN = 'http://127.0.0.1';
process.env.TRUST_PROXY_HOPS = '0';
process.env.RUN_SEEDS_ON_STARTUP = 'false';
process.env.PYTHON_PATH ||= 'python';
process.env.ANALYTICS_DIR ||= new URL('../analytics', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1');

const [{ createApp }, { runMigrations }, { runSeeds }, { db }] = await Promise.all([
  import('../backend/dist/app.js'),
  import('../backend/dist/database/migrate.js'),
  import('../backend/dist/database/seed.js'),
  import('../backend/dist/database/db.js'),
]);

await runMigrations();
await runSeeds();
const app = createApp();
const server = await new Promise(resolve => {
  const value = app.listen(0, '127.0.0.1', () => resolve(value));
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const originalLog = console.log;
console.log = (...values) => {
  if (typeof values[0] === 'string' && values[0].includes('"event":"http_request"')) return;
  originalLog(...values);
};

const fullStages = [
  { label: 'baseline', vus: 1, durationSeconds: 60 },
  { label: 'normal', vus: 5, durationSeconds: 120 },
  { label: 'moderate', vus: 10, durationSeconds: 180 },
  { label: 'burst', vus: 20, durationSeconds: 30 },
  { label: 'soak', vus: 5, durationSeconds: 300 },
];
const quickStages = [
  { label: 'smoke', vus: 2, durationSeconds: 10 },
];
const stages = process.env.LOAD_PROFILE === 'quick' ? quickStages : fullStages;
const users = [];

try {
  const userCount = Math.min(10, Math.max(...stages.map(stage => stage.vus)));
  for (let index = 0; index < userCount; index += 1) {
    const response = await jsonRequest('/api/v1/auth/register', 'POST', {
      email: `load_${Date.now()}_${index}@example.test`, password: 'LocalLoadPassword123!', name: `Load User ${index}`, baseCurrency: 'INR',
    });
    if (response.status !== 201 || !response.body?.data?.token) throw new Error(`Unable to create isolated load user ${index}: HTTP ${response.status}`);
    users.push(response.body.data.token);
  }

  const results = [];
  for (const stage of stages) {
    originalLog(`[Load] ${stage.label}: ${stage.vus} VU for ${stage.durationSeconds}s`);
    results.push(await runStage(stage, Array.from({ length: stage.vus }, (_, index) => users[index % users.length])));
  }
  originalLog(`LOAD_TEST_RESULT=${JSON.stringify({ target: 'LOCAL_ISOLATED_PGLITE', stages: results })}`);
} finally {
  console.log = originalLog;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await db.close();
}

async function runStage(stage, tokens) {
  const deadline = Date.now() + stage.durationSeconds * 1000;
  const measurements = [];
  const statusCodes = {};
  const endpointStats = new Map();
  const errors = [];
  let successful = 0;
  let connectionErrors = 0;
  let timeouts = 0;
  let peakRssBytes = process.memoryUsage().rss;
  const cpuStart = process.cpuUsage();
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const memorySampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 100);

  await Promise.all(tokens.map((token, worker) => workerLoop(token, worker)));
  clearInterval(memorySampler);
  loop.disable();
  const cpu = process.cpuUsage(cpuStart);
  const durationSeconds = stage.durationSeconds;
  const sorted = measurements.slice().sort((left, right) => left - right);
  return {
    label: stage.label,
    virtualUsers: stage.vus,
    durationSeconds,
    totalRequests: measurements.length,
    successfulRequests: successful,
    requestsPerSecond: round(measurements.length / durationSeconds),
    latencyMs: { p50: percentile(sorted, 0.50), p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99), max: round(sorted.at(-1) || 0) },
    statusCodes,
    errorRatePercent: round(measurements.length ? (measurements.length - successful) / measurements.length * 100 : 0),
    connectionErrors,
    timeouts,
    cpuPercentOneCore: round((cpu.user + cpu.system) / (durationSeconds * 1_000_000) * 100),
    peakRssMb: round(peakRssBytes / 1024 / 1024),
    eventLoopDelayMs: { mean: round(loop.mean / 1e6), p95: round(loop.percentile(95) / 1e6), max: round(loop.max / 1e6) },
    endpoints: Object.fromEntries([...endpointStats.entries()].map(([name, values]) => [name, { count: values.length, p95Ms: percentile(values.sort((a, b) => a - b), 0.95) }])),
    errorSamples: errors.slice(0, 5),
  };

  async function workerLoop(token, worker) {
    let analyticsExecuted = false;
    let preferenceToggle = false;
    while (Date.now() < deadline) {
      const choice = Math.random();
      let request;
      if (!analyticsExecuted && choice < 0.01) {
        analyticsExecuted = true;
        request = {
          name: 'scenario', path: '/api/v1/scenarios', method: 'POST', body: {
            scenarioType: 'SINGLE_INVESTMENT', symbol: 'NVDA', startDate: '2023-06-01', endDate: '2024-01-02', initialAmount: 100000, baseCurrency: 'INR',
          },
        };
      } else if (choice < 0.16) request = { name: 'preferences', path: '/api/v1/auth/preferences', method: 'PUT', body: { theme: (preferenceToggle = !preferenceToggle) ? 'dark' : 'light' } };
      else if (choice < 0.36) request = { name: 'profile', path: '/api/v1/auth/me' };
      else if (choice < 0.61) request = { name: 'finance-summary', path: '/api/v1/finance/summary' };
      else if (choice < 0.86) request = { name: 'transactions', path: '/api/v1/finance/transactions' };
      else request = { name: 'market-overview', path: '/api/v1/markets/overview' };

      const started = performance.now();
      try {
        const response = await jsonRequest(request.path, request.method || 'GET', request.body, token, 15_000);
        const latency = performance.now() - started;
        measurements.push(latency);
        (endpointStats.get(request.name) || endpointStats.set(request.name, []).get(request.name)).push(latency);
        statusCodes[response.status] = (statusCodes[response.status] || 0) + 1;
        if (response.status >= 200 && response.status < 400) successful += 1;
        else if (errors.length < 5) errors.push({ endpoint: request.name, status: response.status, code: response.body?.error?.code || null });
      } catch (error) {
        const latency = performance.now() - started;
        measurements.push(latency);
        connectionErrors += 1;
        if (error?.name === 'TimeoutError') timeouts += 1;
        if (errors.length < 5) errors.push({ endpoint: request.name, error: error instanceof Error ? error.message : String(error) });
      }
      await new Promise(resolve => setTimeout(resolve, 1_000 + worker * 2));
    }
  }
}

async function jsonRequest(path, method = 'GET', body, token, timeout = 15_000) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(timeout),
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  return round(values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]);
}
function round(value) { return Math.round(value * 100) / 100; }
