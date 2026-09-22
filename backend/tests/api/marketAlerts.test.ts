import { beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';

describe('User-owned market alerts API', () => {
  let server: http.Server;
  let baseUrl = '';
  let ownerToken = '';
  let otherToken = '';
  let alertId = '';

  beforeAll(async () => {
    await runMigrations(); await runSeeds();
    server = createApp().listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    baseUrl = `http://localhost:${(server.address() as any).port}`;
    const register = async (prefix: string) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${prefix}_${Date.now()}@example.com`, password: 'Password123!', name: prefix, baseCurrency: 'INR' }) });
      return (await response.json()).data.token as string;
    };
    ownerToken = await register('alert_owner'); otherToken = await register('alert_other');
    return () => server.close();
  });

  it('creates, lists, updates, and deletes a configured alert', async () => {
    const created = await fetch(`${baseUrl}/api/v1/alerts`, { method: 'POST', headers: auth(ownerToken), body: JSON.stringify({ stockId: 1, condition: 'PRICE_ABOVE', threshold: 3000 }) });
    const createdData = await created.json(); alertId = createdData.data.id;
    expect(created.status).toBe(201);
    const list = await (await fetch(`${baseUrl}/api/v1/alerts?stockId=1`, { headers: { Authorization: `Bearer ${ownerToken}` } })).json();
    expect(list.data).toHaveLength(1);
    const updated = await (await fetch(`${baseUrl}/api/v1/alerts/${alertId}`, { method: 'PATCH', headers: auth(ownerToken), body: JSON.stringify({ enabled: false }) })).json();
    expect(updated.data.enabled).toBe(false);
  });

  it('enforces ownership and alert validation', async () => {
    const otherList = await (await fetch(`${baseUrl}/api/v1/alerts?stockId=1`, { headers: { Authorization: `Bearer ${otherToken}` } })).json();
    expect(otherList.data).toEqual([]);
    const update = await fetch(`${baseUrl}/api/v1/alerts/${alertId}`, { method: 'PATCH', headers: auth(otherToken), body: JSON.stringify({ enabled: true }) });
    const remove = await fetch(`${baseUrl}/api/v1/alerts/${alertId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherToken}` } });
    const invalid = await fetch(`${baseUrl}/api/v1/alerts`, { method: 'POST', headers: auth(ownerToken), body: JSON.stringify({ stockId: 1, condition: 'RSI_ABOVE', threshold: 101 }) });
    expect(update.status).toBe(404); expect(remove.status).toBe(404); expect(invalid.status).toBe(400);
  });

  it('allows only the owner to delete the alert', async () => {
    const removed = await fetch(`${baseUrl}/api/v1/alerts/${alertId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(removed.status).toBe(200);
    const list = await (await fetch(`${baseUrl}/api/v1/alerts`, { headers: { Authorization: `Bearer ${ownerToken}` } })).json();
    expect(list.data).toEqual([]);
  });
});

function auth(token: string) { return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }; }
