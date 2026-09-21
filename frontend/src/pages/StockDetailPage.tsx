import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import type { MarketStock, StockDetail } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { Spinner } from '../components/Spinner';
import StockAnalyticsPanel from '../components/StockAnalyticsPanel';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';

export default function StockDetailPage() {
  const { symbol = '' } = useParams();
  const { user } = useAuth();
  const watchlists = useWatchlist(Boolean(user));
  const query = useQuery({ queryKey: ['stock', symbol], queryFn: async () => (await api.get<StockDetail>(endpoints.markets.stock(symbol))).data, enabled: Boolean(symbol), staleTime: 30_000 });
  if (query.isPending) return <Spinner />;
  if (query.error) return <p role="alert" className="error-banner">This security is currently unavailable.</p>;
  if (!query.data) return null;
  const { stock, quote, fundamentals, dividends, corporateActions } = query.data;
  const marketStock: MarketStock = { ...stock, quote };
  const changeTone = quote.changePercent >= 0 ? 'movement-up' : 'movement-down';

  return <main>
    <Link to="/markets" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> Markets</Link>
    <header className="stock-hero">
      <div className="stock-identity"><span className="stock-logo"><Building2 size={22} /></span><div><p className="page-eyebrow">{stock.exchange_code} · {stock.country_code} · {stock.currency}</p><h1>{stock.company_name}</h1><p className="page-subtitle">{stock.display_symbol || stock.symbol} · {stock.sector ?? 'Sector unavailable'}</p></div></div>
      <div className="stock-quote"><p>{quote.marketStatus === 'OPEN' ? 'Current session' : 'Latest market observation'}</p><strong>{money(quote.price, stock.currency)}</strong><span className={changeTone}>{quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%</span></div>
    </header>
    <div className="notice my-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><span>{quote.source} · market timestamp {new Date(quote.marketTimestamp).toLocaleString()} · fetched {new Date(quote.fetchedAt).toLocaleString()}</span><FreshnessBadge freshness={quote.freshnessLabel} timestamp={quote.marketTimestamp} /></div>
    <div className="metric-grid mb-4">
      <Metric label="Previous close" value={moneyOrNA(quote.previousClose, stock.currency)} />
      <Metric label="Day high" value={moneyOrNA(quote.high, stock.currency)} />
      <Metric label="Day low" value={moneyOrNA(quote.low, stock.currency)} />
      <Metric label="Volume" value={compactNumber(quote.volume)} />
      <Metric label="52-week high" value={moneyOrNA(quote.fiftyTwoWeekHigh, stock.currency)} />
      <Metric label="52-week low" value={moneyOrNA(quote.fiftyTwoWeekLow, stock.currency)} />
      <Metric label="Market cap" value={compactMoney(fundamentals.marketCap, stock.currency)} />
      <Metric label="P/E ratio" value={numberOrNA(fundamentals.peRatio)} />
    </div>

    <section className="panel mb-4"><div className="panel-header"><div><h2 className="panel-title">Price, volume & technical study</h2><p className="panel-subtitle">Adjusted provider history. Indicators are calculated from the selected series.</p></div></div><StockAnalyticsPanel stock={marketStock} comparisonCandidates={(watchlists.data?.flatMap(list => list.items) ?? []).map(item => ({ id: item.stock_id, symbol: item.symbol, quote: item.quote }))} /></section>

    <div className="content-grid">
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Fundamentals</h2><p className="panel-subtitle">Only stored, sourced metrics are shown · {fundamentals.source}</p></div></div><dl className="fundamental-grid"><Fact label="EPS" value={numberOrNA(fundamentals.eps)} /><Fact label="Dividend yield" value={percentOrNA(fundamentals.dividendYield)} /><Fact label="Revenue" value={compactMoney(fundamentals.revenue, stock.currency)} /><Fact label="Profit" value={compactMoney(fundamentals.profit, stock.currency)} /><Fact label="Total debt" value={compactMoney(fundamentals.totalDebt, stock.currency)} /><Fact label="Industry" value={stock.industry ?? 'N/A'} /></dl><p className="chart-provenance">Retrieved {new Date(fundamentals.retrievedAt).toLocaleString()}. Missing provider metrics remain N/A and are never converted to zero.</p></section>
      <div className="content-stack">
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Dividends</h2><p className="panel-subtitle">Chronological ex-date history</p></div></div>{dividends.length ? <div className="data-list">{dividends.map(item => <div className="data-row" key={item.id}><div><strong>{item.ex_date.slice(0, 10)}</strong><p>Paid {item.payment_date?.slice(0, 10) ?? 'date unavailable'}</p></div><span className="font-mono">{item.currency} {item.amount.toFixed(2)}</span></div>)}</div> : <div className="empty-state"><p>No sourced dividend history is available.</p></div>}</section>
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Corporate actions</h2><p className="panel-subtitle">Effective-date chronology</p></div></div>{corporateActions.length ? <div className="data-list">{corporateActions.map(item => <div className="data-row" key={item.id}><div><strong>{item.action_type}</strong><p>{item.description ?? 'No description'}</p></div><span className="font-mono text-xs">{item.action_date.slice(0, 10)}{item.ratio ? ` · ${item.ratio}` : ''}</span></div>)}</div> : <div className="empty-state"><p>No sourced corporate actions are available.</p></div>}</section>
      </div>
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></article>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
function moneyOrNA(value: number | null, currency: string) { return value == null ? 'N/A' : money(value, currency); }
function compactMoney(value: number | null, currency: string) { return value == null ? 'N/A' : new Intl.NumberFormat('en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(value); }
function compactNumber(value: number | null) { return value == null ? 'N/A' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value); }
function numberOrNA(value: number | null) { return value == null ? 'N/A' : value.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function percentOrNA(value: number | null) { return value == null ? 'N/A' : `${value.toFixed(2)}%`; }
