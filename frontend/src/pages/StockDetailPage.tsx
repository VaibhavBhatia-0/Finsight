import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, Building2, BriefcaseBusiness, Scale, Star, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import type { MarketAlertCondition, MarketStock, StockDetail } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { Spinner } from '../components/Spinner';
import StockAnalyticsPanel from '../components/StockAnalyticsPanel';
import { useAuth } from '../hooks/useAuth';
import { useMarketAlerts } from '../hooks/useMarketAlerts';
import { useWatchlist } from '../hooks/useWatchlist';

export default function StockDetailPage() {
  const { symbol = '' } = useParams();
  const { user } = useAuth();
  const watchlists = useWatchlist(Boolean(user));
  const query = useQuery({ queryKey: ['stock', symbol], queryFn: async () => (await api.get<StockDetail>(endpoints.markets.stock(symbol))).data, enabled: Boolean(symbol), staleTime: 30_000 });
  if (query.isPending) return <Spinner />;
  if (query.error) return <p role="alert" className="error-banner">This security is currently unavailable.</p>;
  if (!query.data) return null;
  const { stock, quote, fundamentals, dividends, corporateActions, eventAvailability } = query.data;
  const marketStock: MarketStock = { ...stock, quote };
  const changeTone = quote.changePercent == null ? '' : quote.changePercent >= 0 ? 'movement-up' : 'movement-down';
  const inWatchlist = watchlists.data?.some(list => list.items.some(item => String(item.stock_id) === String(stock.id)));
  const events = [
    ...dividends.map(item => ({ id: `dividend-${item.id}`, date: item.ex_date, type: 'DIVIDEND', detail: `${item.currency} ${item.amount.toFixed(4)} per share`, source: item.source ?? 'DATABASE' })),
    ...corporateActions.map(item => ({ id: `action-${item.id}`, date: item.action_date, type: item.action_type, detail: item.description ?? (item.ratio ? `Ratio ${item.ratio}` : 'No description'), source: item.source ?? 'DATABASE' })),
  ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 24);

  return <main>
    <Link to="/markets" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> Markets</Link>
    <header className="stock-hero">
      <div className="stock-identity"><span className="stock-logo"><Building2 size={22} /></span><div><p className="page-eyebrow">{stock.exchange_code} · {stock.country_code} · {stock.currency}</p><h1>{stock.company_name}</h1><p className="page-subtitle">{stock.display_symbol || stock.symbol} · {stock.sector ?? 'Sector unavailable'}</p></div></div>
      <div className="stock-quote"><p>{quote.marketStatus === 'OPEN' ? 'Current session' : 'Latest market observation'}</p><strong>{money(quote.price, stock.currency)}</strong><span className={changeTone}>{percentOrNA(quote.changePercent, true)}</span></div>
    </header>
    <div className="stock-actions">
      {user ? <button type="button" className="btn-secondary inline-flex items-center gap-2 px-4 py-2" disabled={Boolean(inWatchlist)} onClick={() => watchlists.addToWatchlist(stock.id)}><Star size={15} /> {inWatchlist ? 'In watchlist' : 'Add to watchlist'}</button> : <Link className="btn-secondary inline-flex items-center gap-2 px-4 py-2" to="/login"><Star size={15} /> Sign in to save</Link>}
      <Link className="btn-secondary inline-flex items-center gap-2 px-4 py-2" to="/markets/compare"><Scale size={15} /> Compare</Link>
      <Link className="btn-secondary inline-flex items-center gap-2 px-4 py-2" to="/portfolios"><BriefcaseBusiness size={15} /> Portfolio transaction</Link>
    </div>
    {watchlists.addError && <p role="alert" className="error-banner">{watchlists.addError.message}</p>}
    <div className="notice my-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><span>{quote.source} · market timestamp {new Date(quote.marketTimestamp).toLocaleString()} · fetched {new Date(quote.fetchedAt).toLocaleString()}</span><FreshnessBadge freshness={quote.freshnessLabel} timestamp={quote.marketTimestamp} /></div>
    <div className="metric-grid mb-4"><Metric label="Previous close" value={moneyOrNA(quote.previousClose, stock.currency)} /><Metric label="Day high" value={moneyOrNA(quote.high, stock.currency)} /><Metric label="Day low" value={moneyOrNA(quote.low, stock.currency)} /><Metric label="Volume" value={compactNumber(quote.volume)} /><Metric label="52-week high" value={moneyOrNA(quote.fiftyTwoWeekHigh, stock.currency)} /><Metric label="52-week low" value={moneyOrNA(quote.fiftyTwoWeekLow, stock.currency)} /><Metric label="Market cap" value={compactMoney(fundamentals.marketCap, stock.currency)} /><Metric label="P/E ratio" value={numberOrNA(fundamentals.peRatio)} /></div>

    <section className="panel mb-4"><div className="panel-header"><div><h2 className="panel-title">Price, volume &amp; technical study</h2><p className="panel-subtitle">Server-calculated indicators from adjusted provider history.</p></div></div><StockAnalyticsPanel stock={marketStock} comparisonCandidates={(watchlists.data?.flatMap(list => list.items) ?? []).map(item => ({ id: item.stock_id, symbol: item.symbol, quote: item.quote }))} /></section>

    <div className="content-grid">
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Fundamentals &amp; market information</h2><p className="panel-subtitle">Only sourced metrics are shown · {fundamentals.source}</p></div></div><dl className="fundamental-grid"><Fact label="EPS" value={numberOrNA(fundamentals.eps)} /><Fact label="Dividend yield" value={percentOrNA(fundamentals.dividendYield)} /><Fact label="Revenue" value={compactMoney(fundamentals.revenue, stock.currency)} /><Fact label="Profit" value={compactMoney(fundamentals.profit, stock.currency)} /><Fact label="Total debt" value={compactMoney(fundamentals.totalDebt, stock.currency)} /><Fact label="Industry" value={stock.industry ?? 'N/A'} /><Fact label="Exchange" value={stock.exchange_code} /><Fact label="Country" value={stock.country_code} /></dl><p className="chart-provenance">Retrieved {new Date(fundamentals.retrievedAt).toLocaleString()}. Missing provider metrics remain N/A.</p></section>
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Corporate-action timeline</h2><p className="panel-subtitle">Latest 24 deduplicated events · most recent first</p></div></div>{events.length ? <ol className="event-timeline">{events.map(item => <li key={item.id}><time>{item.date.slice(0, 10)}</time><div><strong>{item.type}</strong><p>{item.detail}</p><small>Source · {item.source}</small></div></li>)}</ol> : <div className="empty-state"><p>No sourced corporate actions are available.</p></div>}<p className="chart-provenance">Earnings events: {eventAvailability?.earnings === 'UNAVAILABLE_FROM_CURRENT_PROVIDER' ? 'Unavailable from the current provider' : eventAvailability?.earnings ?? 'Unavailable'}.</p></section>
    </div>
    {user ? <AlertPanel stockId={stock.id} currency={stock.currency} /> : <section className="panel mt-4"><div className="panel-header"><div><h2 className="panel-title">Market alerts</h2><p className="panel-subtitle">Sign in to configure user-owned alerts.</p></div></div></section>}
  </main>;
}

function AlertPanel({ stockId, currency }: { stockId: string | number; currency: string }) {
  const alerts = useMarketAlerts(stockId);
  const [condition, setCondition] = useState<MarketAlertCondition>('PRICE_ABOVE');
  const [threshold, setThreshold] = useState('');
  const create = (event: FormEvent) => { event.preventDefault(); alerts.create.mutate({ stockId, condition, threshold: Number(threshold) }, { onSuccess: () => setThreshold('') }); };
  return <section className="panel mt-4"><div className="panel-header"><div><h2 className="panel-title"><Bell size={16} /> Configured alerts</h2><p className="panel-subtitle">Saved rules only. FinSight does not actively monitor or notify without a scheduler.</p></div></div>
    <form className="alert-form" onSubmit={create}><label>Condition<select value={condition} onChange={event => setCondition(event.target.value as MarketAlertCondition)}><option value="PRICE_ABOVE">Price above</option><option value="PRICE_BELOW">Price below</option><option value="DAILY_CHANGE_ABOVE">Daily change above</option><option value="DAILY_CHANGE_BELOW">Daily change below</option><option value="RSI_ABOVE">RSI above</option><option value="RSI_BELOW">RSI below</option></select></label><label>Threshold {condition.startsWith('PRICE_') ? `(${currency})` : condition.startsWith('DAILY_') ? '(%)' : ''}<input value={threshold} onChange={event => setThreshold(event.target.value)} type="number" step="0.01" required /></label><button className="btn-primary px-4 py-2" disabled={alerts.create.isPending || !Number.isFinite(Number(threshold)) || threshold === ''}>Add alert</button></form>
    {alerts.create.error && <p className="error-banner" role="alert">{alerts.create.error.message}</p>}
    {alerts.isPending ? <Spinner /> : alerts.data?.length ? <div className="data-list">{alerts.data.map(alert => <div className="data-row" key={alert.id}><div><strong>{alert.condition.replace(/_/g, ' ')}</strong><p className="font-mono">{Number(alert.threshold).toLocaleString()} · {alert.enabled ? 'Enabled' : 'Disabled'} · never triggered</p></div><div className="flex gap-2"><button type="button" className="btn-secondary px-3 py-2" onClick={() => alerts.update.mutate({ id: alert.id, enabled: !alert.enabled })}>{alert.enabled ? 'Disable' : 'Enable'}</button><button type="button" className="icon-action" aria-label="Delete alert" onClick={() => alerts.remove.mutate(alert.id)}><Trash2 size={15} /></button></div></div>)}</div> : <div className="empty-state"><p>No configured alerts for this security.</p></div>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></article>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
function moneyOrNA(value: number | null, currency: string) { return value == null ? 'N/A' : money(value, currency); }
function compactMoney(value: number | null, currency: string) { return value == null ? 'N/A' : new Intl.NumberFormat('en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(value); }
function compactNumber(value: number | null) { return value == null ? 'N/A' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value); }
function numberOrNA(value: number | null) { return value == null ? 'N/A' : value.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function percentOrNA(value: number | null, signed = false) { return value == null ? 'N/A' : `${signed && value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
