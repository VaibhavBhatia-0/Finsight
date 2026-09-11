import { useUserPreferences, type DashboardSectionId } from '../context/UserPreferencesContext';

const labels: Record<DashboardSectionId, string> = {
  summary: 'Portfolio and finance summary',
  indices: 'Market indices',
  watchlist: 'Watchlist snapshot',
  insights: 'Insights',
  labLaunch: 'FinSight Lab shortcuts',
};

export default function SettingsPage() {
  const { preferences, saving, error, setOrder, setVisibility, updateSettings } = useUserPreferences();
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order];
    [order[index], order[target]] = [order[target], order[index]];
    void setOrder(order).catch(() => undefined);
  };

  return <section className="mx-auto max-w-3xl p-4">
    <h1 className="mb-6 text-2xl font-bold">Settings</h1>
    {error && <p className="mb-4 text-red-600" role="alert">{error.message}</p>}
    <fieldset className="rounded border p-4" disabled={saving}>
      <legend className="px-2 font-semibold">Presentation</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Theme<select value={preferences.theme} onChange={event => { void updateSettings({ theme: event.target.value as 'light' | 'dark' | 'system' }).catch(() => undefined); }} className="mt-1 block w-full rounded border px-3 py-2"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="text-sm font-medium">Default currency<select value={preferences.defaultCurrency} onChange={event => { void updateSettings({ defaultCurrency: event.target.value }).catch(() => undefined); }} className="mt-1 block w-full rounded border px-3 py-2"><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
      </div>
    </fieldset>
    <fieldset className="mt-6 rounded border p-4" disabled={saving}>
      <legend className="px-2 font-semibold">Educational tax estimates</legend>
      <p className="mb-3 text-sm text-gray-600">Residency is never inferred. Selecting it enables effective-dated educational estimates; this is not tax advice.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Tax residency<select value={preferences.taxResidency ?? ''} onChange={event => { void updateSettings({ taxResidency: event.target.value ? event.target.value as 'IN' | 'US' : null }).catch(() => undefined); }} className="mt-1 block w-full rounded border px-3 py-2"><option value="">Not configured</option><option value="IN">India</option><option value="US">United States</option></select></label>
        <label className="text-sm font-medium">Tax status<input value={preferences.taxStatus ?? ''} onChange={event => { void updateSettings({ taxStatus: event.target.value || null }).catch(() => undefined); }} maxLength={40} placeholder="Optional status or bracket" className="mt-1 block w-full rounded border px-3 py-2" /></label>
      </div>
    </fieldset>
    <fieldset className="mt-6 rounded border p-4" disabled={saving}>
      <legend className="px-2 font-semibold">Dashboard sections</legend>
      <div className="space-y-2">{preferences.order.map((id, index) => <div key={id} className="flex items-center gap-3 rounded border p-3"><input type="checkbox" checked={preferences.visible[id]} onChange={event => { void setVisibility(id, event.target.checked).catch(() => undefined); }} aria-label={`Show ${labels[id]}`} /><span className="flex-1">{labels[id]}</span><button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded border px-2 py-1">Up</button><button type="button" disabled={index === preferences.order.length - 1} onClick={() => move(index, 1)} className="rounded border px-2 py-1">Down</button></div>)}</div>
    </fieldset>
    <fieldset className="mt-6 rounded border p-4" disabled={saving}>
      <legend className="px-2 font-semibold">Market indices</legend>
      <div className="grid gap-2 sm:grid-cols-2">{['NIFTY_50', 'SENSEX', 'SP500', 'NASDAQ_COMP'].map(code => <label key={code} className="flex items-center gap-2"><input type="checkbox" checked={preferences.selectedMarketIndices.includes(code)} onChange={event => { const next = event.target.checked ? [...preferences.selectedMarketIndices, code] : preferences.selectedMarketIndices.filter(value => value !== code); void updateSettings({ selectedMarketIndices: next }).catch(() => undefined); }} />{code}</label>)}</div>
    </fieldset>
    {saving && <p className="mt-3 text-sm text-gray-600" role="status">Saving preferences…</p>}
  </section>;
}
