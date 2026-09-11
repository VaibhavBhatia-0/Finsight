import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useAddPortfolioTransaction, usePortfolio, usePortfolioTransactions } from '../hooks/usePortfolios';
import api from '../api/client';
import { endpoints } from '../api/endpoints';
import type { MarketStock, PortfolioTransactionRequest, PortfolioTransactionType } from '../api/contracts';

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const query = usePortfolio(id);
  const transactions = usePortfolioTransactions(id);
  const addTransaction = useAddPortfolioTransaction(id);
  const stocks = useQuery({ queryKey: ['market-stock-options'], queryFn: async () => (await api.get<MarketStock[]>(endpoints.markets.stocks)).data });
  const [showForm, setShowForm] = useState(false);
  if (query.isPending || transactions.isPending) return <Spinner />;
  const loadError = query.error || transactions.error;
  if (loadError) return <p className="p-4 text-red-600">{loadError.message}</p>; if (!query.data) return null;
  const value = query.data;
  return <section className="p-4"><Link to="/portfolios" className="text-gold-700 hover:underline">← Portfolios</Link><div className="mt-3 flex items-center justify-between"><h1 className="text-2xl font-bold">{value.portfolio.name}</h1><button type="button" onClick={() => setShowForm(current => !current)} className="rounded bg-gold-600 px-4 py-2 text-white">Add transaction</button></div>{showForm && <PortfolioTransactionForm currency={value.portfolio.baseCurrency} stocks={stocks.data ?? []} pending={addTransaction.isPending} error={addTransaction.error} onSubmit={async request => { await addTransaction.mutateAsync(request); setShowForm(false); }} />}<div className="mt-5 grid gap-3 sm:grid-cols-3"><Card label="Total value" value={`${value.portfolio.baseCurrency} ${value.summary.totalValue.toLocaleString()}`} /><Card label="Cash" value={`${value.portfolio.baseCurrency} ${value.summary.cashBalance.toLocaleString()}`} /><Card label="Return" value={`${value.summary.totalReturnPercentage.toFixed(2)}%`} /></div><h2 className="mt-8 text-xl font-semibold">Holdings</h2>{value.holdings.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left">Symbol</th><th className="text-right">Quantity</th><th className="text-right">Value</th><th className="text-right">P&amp;L</th><th className="text-right">Weight</th></tr></thead><tbody>{value.holdings.map(row => <tr key={row.stockId} className="border-t"><td className="py-2">{row.symbol}</td><td className="text-right">{row.quantity}</td><td className="text-right">{row.marketValue.toLocaleString()}</td><td className="text-right">{row.unrealizedPnL.toLocaleString()}</td><td className="text-right">{row.weight.toFixed(2)}%</td></tr>)}</tbody></table></div> : <p className="mt-3">No holdings yet.</p>} {value.risk.status && <p className="mt-6 text-sm text-gray-600">Risk metrics unavailable: {value.risk.status.replace(/_/g, ' ').toLowerCase()}.</p>}<h2 className="mt-8 text-xl font-semibold">Transaction history</h2>{transactions.data?.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left">Date</th><th className="text-left">Type</th><th className="text-left">Asset</th><th className="text-right">Amount</th><th className="text-right">Fee</th></tr></thead><tbody>{transactions.data.map(row => <tr key={row.id} className="border-t"><td className="py-2">{row.transaction_date.slice(0, 10)}</td><td>{row.transaction_type}</td><td>{row.symbol ?? 'Cash'}</td><td className="text-right">{row.currency} {Number(row.amount).toLocaleString()}</td><td className="text-right">{Number(row.fee_amount).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-3">No transactions recorded.</p>}</section>;
}
function Card({label,value}:{label:string;value:string}) { return <div className="rounded border p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }

function PortfolioTransactionForm({ currency, stocks, pending, error, onSubmit }: { currency: string; stocks: MarketStock[]; pending: boolean; error: Error | null; onSubmit: (request: PortfolioTransactionRequest) => Promise<void> }) {
  const [type, setType] = useState<PortfolioTransactionType>('BUY');
  const requiresStock = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].includes(type);
  const requiresTrade = type === 'BUY' || type === 'SELL';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get('quantity') || 0);
    const price = Number(data.get('price') || 0);
    const request: PortfolioTransactionRequest = {
      transactionType: type,
      transactionDate: String(data.get('transactionDate')),
      currency: String(data.get('currency')),
      amount: requiresTrade ? quantity * price : Number(data.get('amount') || 0),
      ...(requiresStock ? { stockId: String(data.get('stockId')) } : {}),
      ...(requiresTrade || type === 'SPLIT' ? { quantity } : {}),
      ...(requiresTrade ? { price } : {}),
      feeAmount: Number(data.get('feeAmount') || 0),
      notes: String(data.get('notes') || '') || undefined,
    };
    await onSubmit(request);
  };
  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded border p-4 sm:grid-cols-2"><label className="text-sm">Type<select name="type" value={type} onChange={event => setType(event.target.value as PortfolioTransactionType)} className="mt-1 block w-full rounded border px-3 py-2">{(['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE'] as const).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Date<input name="transactionDate" type="date" required className="mt-1 block w-full rounded border px-3 py-2" /></label>{requiresStock && <label className="text-sm">Asset<select name="stockId" required className="mt-1 block w-full rounded border px-3 py-2"><option value="">Select asset</option>{stocks.map(stock => <option key={stock.id} value={stock.id}>{stock.symbol} — {stock.company_name}</option>)}</select></label>}{(requiresTrade || type === 'SPLIT') && <label className="text-sm">{type === 'SPLIT' ? 'Split ratio' : 'Quantity'}<input name="quantity" type="number" min="0.00000001" step="0.00000001" required className="mt-1 block w-full rounded border px-3 py-2" /></label>}{requiresTrade && <label className="text-sm">Price<input name="price" type="number" min="0.00000001" step="0.00000001" required className="mt-1 block w-full rounded border px-3 py-2" /></label>}{!requiresTrade && <label className="text-sm">Amount<input name="amount" type="number" min="0" step="0.01" required className="mt-1 block w-full rounded border px-3 py-2" /></label>}<label className="text-sm">Currency<input name="currency" defaultValue={currency} pattern="[A-Z]{3}" required className="mt-1 block w-full rounded border px-3 py-2" /></label><label className="text-sm">Fee<input name="feeAmount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded border px-3 py-2" /></label><label className="text-sm sm:col-span-2">Notes<input name="notes" maxLength={1000} className="mt-1 block w-full rounded border px-3 py-2" /></label><div className="sm:col-span-2"><button disabled={pending} className="rounded bg-gold-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save transaction'}</button>{error && <p className="mt-2 text-red-600" role="alert">{error.message}</p>}</div></form>;
}
