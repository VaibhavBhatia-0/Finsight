import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Scale, WandSparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { PortfolioTransactionRequest, PortfolioTransactionType, SecuritySearchItem } from '../api/contracts';
import { Spinner } from '../components/Spinner';
import StockSearchInput from '../components/StockSearchInput';
import FreshnessBadge from '../components/FreshnessBadge';
import PortfolioIntelligencePanel from '../components/PortfolioIntelligencePanel';
import { useHistoricalPrice, useSecurityQuote } from '../hooks/useMarketIntelligence';
import { useAddPortfolioTransaction, usePortfolio, usePortfolioBenchmarks, usePortfolioIntelligence, usePortfolioTransactionPreview, usePortfolioTransactions } from '../hooks/usePortfolios';

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const query = usePortfolio(id);
  const transactions = usePortfolioTransactions(id);
  const intelligence = usePortfolioIntelligence(id);
  const benchmarks = usePortfolioBenchmarks();
  const addTransaction = useAddPortfolioTransaction(id);
  const [showForm, setShowForm] = useState(false);
  if (query.isPending || transactions.isPending) return <Spinner />;
  const loadError = query.error || transactions.error;
  if (loadError) return <p className="error-banner" role="alert">{loadError.message}</p>;
  if (!query.data) return null;
  const value = query.data;

  return <main>
    <Link to="/portfolios" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> All portfolios</Link>
    <header className="page-heading"><div><p className="page-eyebrow">Portfolio · {value.portfolio.baseCurrency}</p><h1>{value.portfolio.name}</h1><p className="page-subtitle">Position values, intelligence, and P&amp;L are derived from the chronological transaction ledger.</p></div><div className="flex flex-wrap gap-2"><Link to="/portfolios/compare" className="btn-secondary inline-flex items-center gap-2 px-4 py-2"><Scale size={16} /> Compare</Link><Link to="/planning" className="btn-secondary inline-flex items-center gap-2 px-4 py-2"><WandSparkles size={16} /> Plan</Link><button type="button" onClick={() => setShowForm(current => !current)} className="btn-primary inline-flex items-center gap-2 px-4 py-2"><Plus size={16} /> Add transaction</button></div></header>
    {showForm && <PortfolioTransactionForm portfolioId={value.portfolio.id} portfolioCurrency={value.portfolio.baseCurrency} pending={addTransaction.isPending} error={addTransaction.error} onSubmit={async request => { await addTransaction.mutateAsync(request); setShowForm(false); }} />}

    <div className="metric-grid mb-4">
      <Metric label="Total value" value={money(value.summary.totalValue, value.portfolio.baseCurrency)} />
      <Metric label="Cash balance" value={money(value.summary.cashBalance, value.portfolio.baseCurrency)} />
      <Metric label="Total return" value={`${value.summary.totalReturnPercentage.toFixed(2)}%`} tone={value.summary.totalReturnAmount >= 0 ? 'up' : 'down'} />
      <Metric label="Fees paid" value={money(value.summary.feesPaid, value.portfolio.baseCurrency)} />
    </div>

    {intelligence.isPending && <section className="panel mb-4"><Spinner /></section>}
    {intelligence.error && <p className="error-banner mb-4" role="alert">Portfolio intelligence is unavailable: {intelligence.error.message}</p>}
    {intelligence.data && <PortfolioIntelligencePanel data={intelligence.data} benchmarks={benchmarks.data ?? []} />}

    <div className="content-stack mt-4">
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Holdings</h2><p className="panel-subtitle">Current positions, weights, and unrealized performance</p></div></div>{value.holdings.length ? <><div className="allocation-track mb-5">{value.holdings.map(row => <span key={row.stockId} className="allocation-segment" style={{ width: `${row.weight}%` }} title={`${row.symbol}: ${row.weight.toFixed(2)}%`} />)}</div><div className="overflow-x-auto"><table><thead><tr><th className="text-left">Asset</th><th className="text-right">Quantity</th><th className="text-right">Market value</th><th className="text-right">Unrealized P&amp;L</th><th className="text-right">Weight</th></tr></thead><tbody>{value.holdings.map(row => <tr key={row.stockId}><td><Link to={`/markets/${row.symbol}`} className="font-mono text-gold-300">{row.symbol}</Link><span className="ml-3 text-xs text-gray-500">{row.companyName}</span></td><td className="text-right font-mono">{row.quantity}</td><td className="text-right font-mono">{money(row.marketValue, value.portfolio.baseCurrency)}</td><td className={`text-right font-mono ${row.unrealizedPnL >= 0 ? 'movement-up' : 'movement-down'}`}>{money(row.unrealizedPnL, value.portfolio.baseCurrency)}</td><td className="text-right font-mono">{row.weight.toFixed(2)}%</td></tr>)}</tbody></table></div></> : <div className="empty-state"><p>No holdings yet. Add a deposit and your first buy transaction.</p></div>}</section>
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Transaction history</h2><p className="panel-subtitle">Immutable chronological source for derived holdings</p></div></div>{transactions.data?.length ? <div className="overflow-x-auto"><table><thead><tr><th className="text-left">Date</th><th className="text-left">Type</th><th className="text-left">Asset</th><th className="text-right">Amount</th><th className="text-right">Fee</th></tr></thead><tbody>{transactions.data.map(row => <tr key={row.id}><td>{row.transaction_date.slice(0, 10)}</td><td><span className={`ledger-pill ${row.transaction_type.toLowerCase()}`}>{row.transaction_type}</span></td><td>{row.symbol ?? 'Cash'}</td><td className="text-right font-mono">{row.currency} {Number(row.amount).toLocaleString()}</td><td className="text-right font-mono">{Number(row.fee_amount).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="empty-state"><p>No transactions recorded.</p></div>}</section>
    </div>
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className={`metric-value${tone ? ` movement-${tone}` : ''}`}>{value}</p></article>; }

function PortfolioTransactionForm({ portfolioId, portfolioCurrency, pending, error, onSubmit }: { portfolioId: string | number; portfolioCurrency: string; pending: boolean; error: Error | null; onSubmit: (request: PortfolioTransactionRequest) => Promise<void> }) {
  const [type, setType] = useState<PortfolioTransactionType>('BUY');
  const [securityText, setSecurityText] = useState('');
  const [security, setSecurity] = useState<SecuritySearchItem | null>(null);
  const [transactionDate, setTransactionDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');
  const [priceSource, setPriceSource] = useState<'HISTORICAL' | 'MANUAL' | null>(null);
  const requiresStock = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].includes(type);
  const requiresTrade = type === 'BUY' || type === 'SELL';
  const quote = useSecurityQuote(security?.id);
  const historicalPrice = useHistoricalPrice(requiresTrade ? security?.id : null, requiresTrade ? transactionDate : undefined);
  useEffect(() => { setPrice(''); setPriceSource(null); }, [security?.id, transactionDate, requiresTrade]);
  useEffect(() => {
    if (historicalPrice.data && String(historicalPrice.data.security.id) === String(security?.id) && historicalPrice.data.requestedDate === transactionDate) {
      setPrice(String(historicalPrice.data.price)); setPriceSource('HISTORICAL');
    }
  }, [historicalPrice.data, security?.id, transactionDate]);
  const previewInput = useMemo(() => security && requiresTrade && transactionDate && Number(quantity) > 0 && Number(price) > 0 ? {
    stockId: security.id, transactionType: type as 'BUY' | 'SELL', transactionDate,
    quantity: Number(quantity), price: Number(price), feeAmount: Number(fee || 0),
  } : undefined, [fee, price, quantity, requiresTrade, security, transactionDate, type]);
  const preview = usePortfolioTransactionPreview(portfolioId, useDeferredValue(previewInput));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const numericQuantity = Number(quantity || 0);
    const numericPrice = Number(price || 0);
    await onSubmit({
      transactionType: type, transactionDate, currency: security && requiresStock ? security.currency : String(data.get('currency')),
      amount: requiresTrade ? numericQuantity * numericPrice : type === 'SPLIT' ? 0 : Number(data.get('amount') || 0),
      ...(requiresStock && security ? { stockId: security.id } : {}),
      ...(requiresTrade || type === 'SPLIT' ? { quantity: numericQuantity } : {}), ...(requiresTrade ? { price: numericPrice } : {}),
      feeAmount: Number(fee || 0), notes: String(data.get('notes') || '') || undefined,
    });
  };
  return <form onSubmit={submit} className="panel mb-5 grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select value={type} onChange={event => setType(event.target.value as PortfolioTransactionType)} className="mt-1 block w-full px-3 py-2">{(['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX'] as const).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Transaction date<input name="transactionDate" value={transactionDate} onChange={event => setTransactionDate(event.target.value)} type="date" required className="mt-1 block w-full px-3 py-2" /></label>{requiresStock && <StockSearchInput label="Asset" value={securityText} onChange={setSecurityText} onSelect={setSecurity} />}{security && quote.data && <div className="notice p-3 text-sm"><strong>{quote.data.security.providerSymbol}</strong><p>{money(quote.data.quote.price, quote.data.quote.currency)} · {quote.data.security.exchange} · {quote.data.quote.marketStatus}</p><FreshnessBadge freshness={quote.data.quote.freshnessLabel} timestamp={quote.data.quote.marketTimestamp} /></div>}{security && quote.error && <p className="error-banner">Current quote unavailable. Historical/manual entry may still be used.</p>}{(requiresTrade || type === 'SPLIT') && <label className="text-sm">{type === 'SPLIT' ? 'Split ratio' : 'Quantity'}<input name="quantity" value={quantity} onChange={event => setQuantity(event.target.value)} type="number" min="0.00000001" step="0.00000001" required className="mt-1 block w-full px-3 py-2" /></label>}{requiresTrade && <label className="text-sm">Transaction-date price · {security?.currency ?? 'asset currency'}<input name="price" value={price} onChange={event => { setPrice(event.target.value); setPriceSource('MANUAL'); }} type="number" min="0.00000001" step="0.00000001" required className="mt-1 block w-full px-3 py-2" /><small>{historicalPrice.isFetching ? 'Loading price for selected date…' : historicalPrice.error ? 'Historical price unavailable — manual entry permitted.' : priceSource === 'HISTORICAL' && historicalPrice.data ? `${historicalPrice.data.source} close from ${historicalPrice.data.priceDate}` : priceSource === 'MANUAL' ? 'Manual price entry' : 'Select an asset and transaction date.'}</small></label>}{!requiresTrade && type !== 'SPLIT' && <label className="text-sm">Amount<input name="amount" type="number" min="0.01" step="0.01" required className="mt-1 block w-full px-3 py-2" /></label>}<label className="text-sm">Transaction currency<input name="currency" value={security && requiresStock ? security.currency : portfolioCurrency} readOnly={Boolean(security && requiresStock)} pattern="[A-Z]{3}" required className="mt-1 block w-full px-3 py-2" /><small>Portfolio base currency: {portfolioCurrency}</small></label><label className="text-sm">Fee · transaction currency<input name="feeAmount" value={fee} onChange={event => setFee(event.target.value)} type="number" min="0" step="0.01" className="mt-1 block w-full px-3 py-2" /></label>{preview.data && <section className="notice sm:col-span-2 p-3" aria-label="Authoritative transaction preview"><h3 className="panel-title">Transaction preview</h3><dl className="fundamental-grid"><Fact label="Quantity × price" value={`${preview.data.assetCurrency} ${preview.data.gross.toLocaleString()}`} /><Fact label="Fee" value={`${preview.data.assetCurrency} ${preview.data.fee.toLocaleString()}`} /><Fact label="Trade total" value={`${preview.data.assetCurrency} ${preview.data.totalAssetCurrency.toLocaleString()}`} /><Fact label="Historical FX" value={`${preview.data.fxRate.toFixed(6)} · ${preview.data.fxRateDate}`} /><Fact label="Portfolio cash impact" value={`${preview.data.portfolioCurrency} ${preview.data.portfolioCashImpact.toLocaleString()}`} /></dl><p className="methodology-copy">{preview.data.methodology}</p></section>}{preview.error && <p className="error-banner sm:col-span-2">Transaction preview unavailable: {preview.error.message}</p>}<label className="text-sm sm:col-span-2">Notes<input name="notes" maxLength={1000} className="mt-1 block w-full px-3 py-2" /></label><div className="sm:col-span-2"><button disabled={pending || requiresStock && !security || requiresTrade && !preview.data} className="btn-primary px-4 py-2">{pending ? 'Saving…' : 'Save transaction'}</button>{error && <p className="error-banner mt-2" role="alert">{error.message}</p>}</div></form>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd className="font-mono">{value}</dd></div>; }

function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
