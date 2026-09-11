// src/pages/ReportsPage.tsx
import { FormEvent, useState } from 'react';
import api from '../api/client';
import { endpoints } from '../api/endpoints';
import { usePortfolios } from '../hooks/usePortfolios';

type ReportType = 'portfolios' | 'portfolio_transactions' | 'scenarios' | 'backtests' | 'finance_summary' | 'finance_transactions';

export default function ReportsPage() {
  const portfolios = usePortfolios();
  const [reportType, setReportType] = useState<ReportType>('portfolios');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDownloading(true);
    setError(null);
    try {
      const result = await api.download(endpoints.reports.export, { params: {
        reportType,
        format: String(data.get('format')),
        portfolioId: reportType === 'portfolio_transactions' ? String(data.get('portfolioId')) : undefined,
        startDate: String(data.get('startDate') || '') || undefined,
        endDate: String(data.get('endDate') || '') || undefined,
      } });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename ?? `finsight-${reportType}.${String(data.get('format'))}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Report download failed'));
    } finally {
      setDownloading(false);
    }
  };

  return <main className="mx-auto max-w-2xl p-4">
    <h1 className="mb-2 text-2xl font-bold">Reports</h1>
    <p className="mb-6 text-sm text-gray-600">Authenticated exports include their source, methodology, generation time, and educational-use disclaimer.</p>
    <form onSubmit={submit} className="grid gap-4 rounded border p-4 sm:grid-cols-2">
      <label className="text-sm">Report<select value={reportType} onChange={event => setReportType(event.target.value as ReportType)} className="mt-1 block w-full rounded border px-3 py-2"><option value="portfolios">Portfolio valuations</option><option value="portfolio_transactions">Portfolio transactions</option><option value="scenarios">Saved scenarios</option><option value="backtests">Backtests</option><option value="finance_summary">Finance summary</option><option value="finance_transactions">Finance transactions</option></select></label>
      <label className="text-sm">Format<select name="format" className="mt-1 block w-full rounded border px-3 py-2"><option value="csv">CSV</option><option value="pdf">PDF</option></select></label>
      {reportType === 'portfolio_transactions' && <label className="text-sm sm:col-span-2">Portfolio<select name="portfolioId" required className="mt-1 block w-full rounded border px-3 py-2"><option value="">Select a portfolio</option>{portfolios.data?.map(item => <option key={item.portfolio.id} value={item.portfolio.id}>{item.portfolio.name}</option>)}</select></label>}
      <label className="text-sm">From (optional)<input name="startDate" type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label>
      <label className="text-sm">To (optional)<input name="endDate" type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label>
      <button disabled={downloading || portfolios.isPending} className="rounded bg-gold-600 px-4 py-2 text-white sm:col-span-2">{downloading ? 'Preparing…' : 'Download report'}</button>
      {error && <p className="text-red-600 sm:col-span-2" role="alert">{error.message}</p>}
    </form>
  </main>;
}
