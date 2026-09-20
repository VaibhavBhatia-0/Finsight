import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import type { StockDetail } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { Spinner } from '../components/Spinner';

export default function StockDetailPage() {
  const { symbol = '' } = useParams();
  const query = useQuery({ queryKey: ['stock', symbol], queryFn: async () => (await api.get<StockDetail>(endpoints.markets.stock(symbol))).data, enabled: Boolean(symbol) });
  if (query.isPending) return <Spinner />;
  if (query.error) return <p role="alert" className="error-banner">{query.error.message}</p>;
  if (!query.data) return null;
  const { stock, quote, fundamentals, dividends, corporateActions } = query.data;
  const changeTone = quote.changePercent >= 0 ? 'movement-up' : 'movement-down';

  return <main>
    <Link to="/markets" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> Markets</Link>
    <header className="stock-hero">
      <div className="stock-identity"><span className="stock-logo"><Building2 size={22} /></span><div><p className="page-eyebrow">{stock.exchange_code} · {stock.country_code}</p><h1>{stock.company_name}</h1><p className="page-subtitle">{stock.symbol} · {stock.sector ?? 'Unclassified'}</p></div></div>
      <div className="stock-quote"><p>{stock.currency}</p><strong>{quote.price.toFixed(2)}</strong><span className={changeTone}>{quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%</span></div>
    </header>
    <div className="notice my-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><span>{quote.freshness === 'Synthetic' ? 'Quote and fundamentals use deterministic development fixtures.' : 'Quote uses the configured market-data provider; fundamentals remain a labelled development snapshot.'}</span><FreshnessBadge freshness={quote.freshness} timestamp={quote.timestamp} /></div>
    <div className="metric-grid mb-4">
      <Metric label="Market cap" value={compact(fundamentals.marketCap, stock.currency)} />
      <Metric label="P/E ratio" value={fundamentals.peRatio.toFixed(2)} />
      <Metric label="EPS" value={fundamentals.eps.toFixed(2)} />
      <Metric label="Dividend yield" value={`${fundamentals.dividendYield.toFixed(2)}%`} />
    </div>
    <div className="content-grid">
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Fundamentals</h2><p className="panel-subtitle">Synthetic company snapshot</p></div></div><dl className="fundamental-grid"><Fact label="Revenue" value={compact(fundamentals.revenue, stock.currency)} /><Fact label="Profit" value={compact(fundamentals.profit, stock.currency)} /><Fact label="Total debt" value={compact(fundamentals.totalDebt, stock.currency)} /><Fact label="RSI (14)" value={fundamentals.rsi14.toFixed(2)} /><Fact label="SMA 50" value={fundamentals.sma50.toFixed(2)} /><Fact label="SMA 200" value={fundamentals.sma200.toFixed(2)} /><Fact label="52-week high" value={fundamentals.fiftyTwoWeekHigh.toFixed(2)} /><Fact label="52-week low" value={fundamentals.fiftyTwoWeekLow.toFixed(2)} /></dl></section>
      <div className="content-stack">
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Dividends</h2><p className="panel-subtitle">Chronological ex-date history</p></div></div>{dividends.length ? <div className="data-list">{dividends.map(item => <div className="data-row" key={item.id}><div><strong>{item.ex_date.slice(0, 10)}</strong><p>Paid {item.payment_date?.slice(0, 10) ?? 'date unavailable'}</p></div><span className="font-mono">{item.currency} {item.amount.toFixed(2)}</span></div>)}</div> : <div className="empty-state"><p>No dividend history.</p></div>}</section>
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Corporate actions</h2><p className="panel-subtitle">Effective-date chronology</p></div></div>{corporateActions.length ? <div className="data-list">{corporateActions.map(item => <div className="data-row" key={item.id}><div><strong>{item.action_type}</strong><p>{item.description ?? 'No description'}</p></div><span className="font-mono text-xs">{item.action_date.slice(0, 10)}{item.ratio ? ` · ${item.ratio}` : ''}</span></div>)}</div> : <div className="empty-state"><p>No corporate actions.</p></div>}</section>
      </div>
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></article>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function compact(value: number, currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(value); }
