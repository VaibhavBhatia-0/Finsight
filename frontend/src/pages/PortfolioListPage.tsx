import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCreatePortfolio, usePortfolios } from '../hooks/usePortfolios';
import { Spinner } from '../components/Spinner';

export default function PortfolioListPage() {
  const query = usePortfolios();
  const create = useCreatePortfolio();
  const [showForm, setShowForm] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await create.mutateAsync({ name: String(data.get('name')), baseCurrency: String(data.get('baseCurrency')) }); event.currentTarget.reset(); setShowForm(false); }
  return <section className="p-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Portfolios</h1><button onClick={() => setShowForm(value => !value)} className="rounded bg-gold-600 px-4 py-2 text-white">New portfolio</button></div>{showForm && <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2"><input name="name" required maxLength={100} placeholder="Portfolio name" className="rounded border px-3 py-2" /><select name="baseCurrency" className="rounded border px-3 py-2"><option>INR</option><option>USD</option></select><button className="rounded border px-4 py-2" disabled={create.isPending}>Create</button></form>}{query.isPending && <Spinner />}{query.error && <p className="mt-4 text-red-600">{query.error.message}</p>}<div className="mt-6 grid gap-4 sm:grid-cols-2">{query.data?.map(value => <Link key={value.portfolio.id} to={`/portfolios/${value.portfolio.id}`} className="rounded-lg border p-4 hover:border-gold-500"><h2 className="font-semibold">{value.portfolio.name}</h2><p className="mt-2 text-xl">{value.portfolio.baseCurrency} {value.summary.totalValue.toLocaleString()}</p><p className={value.summary.totalReturnAmount >= 0 ? 'text-green-600' : 'text-red-600'}>{value.summary.totalReturnPercentage.toFixed(2)}%</p></Link>)}</div></section>;
}
