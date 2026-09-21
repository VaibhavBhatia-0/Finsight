import { type FormEvent, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, Plus, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useCreatePortfolio, usePortfolioBenchmarks, usePortfolios } from '../hooks/usePortfolios';

export default function PortfolioListPage() {
  const query = usePortfolios();
  const create = useCreatePortfolio();
  const benchmarks = usePortfolioBenchmarks();
  const [showForm, setShowForm] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const deposit = Number(data.get('initialDeposit') || 0);
    await create.mutateAsync({
      name: String(data.get('name')), baseCurrency: String(data.get('baseCurrency')),
      benchmarkId: data.get('benchmarkId') ? Number(data.get('benchmarkId')) : undefined,
      initialDeposit: deposit > 0 ? { amount: deposit, date: String(data.get('depositDate')) } : undefined,
    });
    form.reset(); setShowForm(false);
  }

  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">Invest</p><h1>Portfolios</h1><p className="page-subtitle">Ledger-backed portfolios with chronological transactions, historical FX, and reconciled holdings.</p></div><div className="flex flex-wrap gap-2"><Link to="/portfolios/compare" className="btn-secondary inline-flex items-center gap-2 px-4 py-2"><Scale size={16} /> Compare</Link><button onClick={() => setShowForm(value => !value)} className="btn-primary inline-flex items-center gap-2 px-4 py-2"><Plus size={16} /> New portfolio</button></div></header>
    {showForm && <form onSubmit={submit} className="panel mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm">Portfolio name<input name="name" required maxLength={100} placeholder="Long-term portfolio" className="mt-1 w-full px-3 py-2" /></label><label className="text-sm">Base currency<select name="baseCurrency" className="mt-1 w-full px-3 py-2"><option>INR</option><option>USD</option></select></label><label className="text-sm">Benchmark<select name="benchmarkId" className="mt-1 w-full px-3 py-2"><option value="">None</option>{benchmarks.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm">Opening cash contribution<input name="initialDeposit" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full px-3 py-2" /></label><label className="text-sm">Contribution date<input name="depositDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full px-3 py-2" /></label><div className="flex items-end"><button className="btn-primary w-full px-5 py-2" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create portfolio'}</button></div>{create.error && <p className="error-banner sm:col-span-2 lg:col-span-3" role="alert">{create.error.message}</p>}</form>}
    {query.isPending && <Spinner />}{query.error && <p className="error-banner">{query.error.message}</p>}
    {query.data?.length ? <div className="portfolio-grid">{query.data.map(value => <Link key={value.portfolio.id} to={`/portfolios/${value.portfolio.id}`} className="portfolio-card">
      <div className="flex items-start justify-between"><span className="portfolio-icon"><BriefcaseBusiness size={19} /></span><ArrowUpRight size={16} className="text-gray-500" /></div>
      <div><p className="portfolio-label">{value.portfolio.name}</p><p className="portfolio-value">{format(value.summary.totalValue, value.portfolio.baseCurrency)}</p></div>
      <div className="portfolio-footer"><span>{value.portfolio.baseCurrency} base</span><span className={value.summary.totalReturnAmount >= 0 ? 'movement-up' : 'movement-down'}>{value.summary.totalReturnPercentage >= 0 ? '+' : ''}{value.summary.totalReturnPercentage.toFixed(2)}%</span></div>
    </Link>)}</div> : !query.isPending && <div className="empty-state"><BriefcaseBusiness className="mx-auto mb-3 text-gold-400" /><p>Create a portfolio to begin a chronological investment ledger.</p></div>}
  </main>;
}

function format(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
