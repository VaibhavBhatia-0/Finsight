import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Scale, WandSparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import type { MarketStock, MarketStocksResponse, PortfolioTransactionRequest, PortfolioTransactionType } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import { Spinner } from '../components/Spinner';
import PortfolioIntelligencePanel from '../components/PortfolioIntelligencePanel';
import { useAddPortfolioTransaction, usePortfolio, usePortfolioBenchmarks, usePortfolioIntelligence, usePortfolioTransactions } from '../hooks/usePortfolios';

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const query = usePortfolio(id);
  const transactions = usePortfolioTransactions(id);
  const intelligence = usePortfolioIntelligence(id);
  const benchmarks = usePortfolioBenchmarks();
  const addTransaction = useAddPortfolioTransaction(id);
  const stocks = useQuery({ queryKey: ['market-stock-options'], queryFn: async () => (await api.get<MarketStocksResponse>(endpoints.markets.stocks, { params: { limit: 100 } })).data.items });
  const [showForm, setShowForm] = useState(false);
  if (query.isPending || transactions.isPending) return <Spinner />;
  const loadError = query.error || transactions.error;
  if (loadError) return <p className="error-banner" role="alert">{loadError.message}</p>;
  if (!query.data) return null;
  const value = query.data;

  return <main>
    <Link to="/portfolios" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> All portfolios</Link>
    <header className="page-heading"><div><p className="page-eyebrow">Portfolio · {value.portfolio.baseCurrency}</p><h1>{value.portfolio.name}</h1><p className="page-subtitle">Position values, intelligence, and P&amp;L are derived from the chronological transaction ledger.</p></div><div className="flex flex-wrap gap-2"><Link to="/portfolios/compare" className="btn-secondary inline-flex items-center gap-2 px-4 py-2"><Scale size={16} /> Compare</Link><Link to="/planning" className="btn-secondary inline-flex items-center gap-2 px-4 py-2"><WandSparkles size={16} /> Plan</Link><button type="button" onClick={() => setShowForm(current => !current)} className="btn-primary inline-flex items-center gap-2 px-4 py-2"><Plus size={16} /> Add transaction</button></div></header>
    {showForm && <PortfolioTransactionForm currency={value.portfolio.baseCurrency} stocks={stocks.data ?? []} pending={addTransaction.isPending} error={addTransaction.error} onSubmit={async request => { await addTransaction.mutateAsync(request); setShowForm(false); }} />}

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

function PortfolioTransactionForm({ currency, stocks, pending, error, onSubmit }: { currency: string; stocks: MarketStock[]; pending: boolean; error: Error | null; onSubmit: (request: PortfolioTransactionRequest) => Promise<void> }) {
  const [type, setType] = useState<PortfolioTransactionType>('BUY');
  const requiresStock = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].includes(type);
  const requiresTrade = type === 'BUY' || type === 'SELL';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get('quantity') || 0);
    const price = Number(data.get('price') || 0);
    await onSubmit({
      transactionType: type, transactionDate: String(data.get('transactionDate')), currency: String(data.get('currency')),
      amount: requiresTrade ? quantity * price : Number(data.get('amount') || 0),
      ...(requiresStock ? { stockId: String(data.get('stockId')) } : {}),
      ...(requiresTrade || type === 'SPLIT' ? { quantity } : {}), ...(requiresTrade ? { price } : {}),
      feeAmount: Number(data.get('feeAmount') || 0), notes: String(data.get('notes') || '') || undefined,
    });
  };
  return <form onSubmit={submit} className="panel mb-5 grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select value={type} onChange={event => setType(event.target.value as PortfolioTransactionType)} className="mt-1 block w-full px-3 py-2">{(['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX'] as const).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Date<input name="transactionDate" type="date" required className="mt-1 block w-full px-3 py-2" /></label>{requiresStock && <label className="text-sm">Asset<select name="stockId" required className="mt-1 block w-full px-3 py-2"><option value="">Select asset</option>{stocks.map(stock => <option key={stock.id} value={stock.id}>{stock.symbol} — {stock.company_name}</option>)}</select></label>}{(requiresTrade || type === 'SPLIT') && <label className="text-sm">{type === 'SPLIT' ? 'Split ratio' : 'Quantity'}<input name="quantity" type="number" min="0.00000001" step="0.00000001" required className="mt-1 block w-full px-3 py-2" /></label>}{requiresTrade && <label className="text-sm">Price<input name="price" type="number" min="0.00000001" step="0.00000001" required className="mt-1 block w-full px-3 py-2" /></label>}{!requiresTrade && <label className="text-sm">Amount<input name="amount" type="number" min="0" step="0.01" required className="mt-1 block w-full px-3 py-2" /></label>}<label className="text-sm">Currency<input name="currency" defaultValue={currency} pattern="[A-Z]{3}" required className="mt-1 block w-full px-3 py-2" /></label><label className="text-sm">Fee<input name="feeAmount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full px-3 py-2" /></label><label className="text-sm sm:col-span-2">Notes<input name="notes" maxLength={1000} className="mt-1 block w-full px-3 py-2" /></label><div className="sm:col-span-2"><button disabled={pending} className="btn-primary px-4 py-2">{pending ? 'Saving…' : 'Save transaction'}</button>{error && <p className="error-banner mt-2" role="alert">{error.message}</p>}</div></form>;
}

function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
