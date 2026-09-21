import { type FormEvent, useState } from 'react';
import { Calculator, History, Repeat2, WandSparkles } from 'lucide-react';
import StockSearchInput from '../components/StockSearchInput';
import { usePortfolios } from '../hooks/usePortfolios';
import LabResultView from './lab/LabResultView';
import { useRecurringPlanner, useReplay, useRequiredContribution, useWhatIf } from '../hooks/usePlanning';

type Tool = 'required' | 'what-if' | 'replay' | 'recurring';

export default function PlanningPage() {
  const [tool, setTool] = useState<Tool>('required');
  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">Plan</p><h1>Investment planning</h1><p className="page-subtitle">Goal requirements and historical what-if tools with explicit assumptions. Hypothetical results are never presented as guaranteed outcomes.</p></div></header>
    <nav className="planning-tabs" aria-label="Planning tools">
      <Tab active={tool === 'required'} onClick={() => setTool('required')} icon={Calculator}>Required contribution</Tab>
      <Tab active={tool === 'what-if'} onClick={() => setTool('what-if')} icon={WandSparkles}>What-if</Tab>
      <Tab active={tool === 'replay'} onClick={() => setTool('replay')} icon={History}>Investment replay</Tab>
      <Tab active={tool === 'recurring'} onClick={() => setTool('recurring')} icon={Repeat2}>Recurring planner</Tab>
    </nav>
    {tool === 'required' ? <RequiredContribution /> : <HistoricalPlanner tool={tool} />}
  </main>;
}

function RequiredContribution() {
  const calculation = useRequiredContribution();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const assumed = String(data.get('assumedAnnualReturn') || '');
    calculation.mutate({
      targetAmount: Number(data.get('targetAmount')), currentAmount: Number(data.get('currentAmount') || 0),
      asOfDate: String(data.get('asOfDate')), targetDate: String(data.get('targetDate')),
      frequency: String(data.get('frequency')) as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
      assumedAnnualReturn: assumed === '' ? undefined : Number(assumed) / 100,
    });
  };
  const result = calculation.data;
  return <div className="planning-layout"><form onSubmit={submit} className="panel scenario-form"><div className="panel-header"><div><h2 className="panel-title">Required contribution</h2><p className="panel-subtitle">No return is assumed unless you enter one</p></div></div><div className="planning-form-grid"><Field label="Target amount" name="targetAmount" type="number" min="0.01" step="0.01" required /><Field label="Current amount" name="currentAmount" type="number" min="0" step="0.01" defaultValue="0" /><Field label="As-of date" name="asOfDate" type="date" defaultValue={today()} required /><Field label="Target date" name="targetDate" type="date" required /><label>Contribution frequency<select name="frequency" defaultValue="MONTHLY"><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option></select></label><Field label="Assumed annual return (%) · optional" name="assumedAnnualReturn" type="number" min="-99.99" max="1000" step="0.01" /></div><button disabled={calculation.isPending} className="btn-primary mt-4 px-4 py-2">{calculation.isPending ? 'Calculating…' : 'Calculate requirement'}</button>{calculation.error && <p className="error-banner mt-3">{calculation.error.message}</p>}</form>{result && <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Contribution requirement</h2><p className="panel-subtitle">{result.contributionCount} actual calendar contribution dates</p></div></div><dl className="intelligence-summary"><PlanStat label="Amount remaining" value={format(result.remainingAmount)} /><PlanStat label="No-growth contribution" value={`${format(result.noGrowth.requiredContribution)} / period`} /><PlanStat label="No-growth total contributions" value={format(result.noGrowth.totalContributions)} />{result.growthAssumption && <><PlanStat label={`At ${result.growthAssumption.assumedAnnualReturn.toFixed(2)}% assumed`} value={`${format(result.growthAssumption.requiredContribution)} / period`} /><PlanStat label="Estimated contribution total" value={format(result.growthAssumption.totalContributions)} /><PlanStat label="Estimated growth" value={format(result.growthAssumption.estimatedGrowth)} /></>}</dl>{result.growthAssumption && <p className="notice mt-4 p-3 text-sm">{result.growthAssumption.disclaimer}</p>}<details className="methodology-details"><summary>Contribution dates</summary><p>{result.contributionDates.join(' · ')}</p></details></section>}</div>;
}

function HistoricalPlanner({ tool }: { tool: Exclude<Tool, 'required'> }) {
  const whatIf = useWhatIf();
  const replay = useReplay();
  const recurring = useRecurringPlanner();
  const planner = tool === 'what-if' ? whatIf : tool === 'replay' ? replay : recurring;
  const portfolios = usePortfolios();
  const [selectionType, setSelectionType] = useState<'ASSET' | 'PORTFOLIO'>('ASSET');
  const [symbol, setSymbol] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    planner.mutate({
      ...(selectionType === 'ASSET' ? { symbol } : { portfolioId: String(data.get('portfolioId')) }),
      startDate: String(data.get('startDate')), endDate: String(data.get('endDate')),
      initialAmount: Number(data.get('initialAmount')), baseCurrency: String(data.get('baseCurrency')),
      investmentMode: tool === 'recurring' ? 'RECURRING' : String(data.get('investmentMode')) as 'LUMP_SUM' | 'RECURRING',
      contributionFrequency: String(data.get('frequency')) as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY',
      contributionGrowthRate: Number(data.get('growthRate') || 0) / 100,
      benchmarkCode: String(data.get('benchmarkCode') || '') || undefined,
      feeRate: Number(data.get('feeRate') || 0) / 100,
      baselineInitialAmount: tool === 'what-if' && data.get('baselineInitialAmount') ? Number(data.get('baselineInitialAmount')) : undefined,
    });
  };
  const labels = {
    'what-if': ['What-if analysis', 'Change contributions, timing, or growth assumptions and compare with an optional baseline.'],
    replay: ['Investment replay', 'Reconstruct a lump-sum or recurring investment from actual historical observations.'],
    recurring: ['Recurring investment planner', 'Every contribution resolves to its own trade date, historical price, and historical FX.'],
  } as const;
  const response = planner.data;
  return <div className="content-stack"><form onSubmit={submit} className="panel scenario-form"><div className="panel-header"><div><h2 className="panel-title">{labels[tool][0]}</h2><p className="panel-subtitle">{labels[tool][1]}</p></div><span className="freshness-badge">Provider history</span></div><div className="planning-form-grid"><label>Model<select value={selectionType} onChange={event => setSelectionType(event.target.value as 'ASSET' | 'PORTFOLIO')}><option value="ASSET">Listed asset</option><option value="PORTFOLIO">Existing portfolio</option></select></label>{selectionType === 'ASSET' ? <StockSearchInput label="Asset" value={symbol} onChange={setSymbol} /> : <label>Portfolio<select name="portfolioId" required><option value="">Select portfolio</option>{portfolios.data?.map(item => <option key={item.portfolio.id} value={item.portfolio.id}>{item.portfolio.name}</option>)}</select></label>}<Field label={tool === 'recurring' ? 'Contribution amount' : 'Investment amount'} name="initialAmount" type="number" min="0.01" step="0.01" required />{tool === 'what-if' && <Field label="Original contribution · optional" name="baselineInitialAmount" type="number" min="0.01" step="0.01" />}<Field label="Start date" name="startDate" type="date" required /><Field label="End date" name="endDate" type="date" defaultValue={today()} required />{tool !== 'recurring' && <label>Investment mode<select name="investmentMode" defaultValue="LUMP_SUM"><option value="LUMP_SUM">Lump sum</option><option value="RECURRING">Recurring</option></select></label>}<label>Frequency<select name="frequency" defaultValue="MONTHLY"><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUALLY">Yearly</option></select></label><Field label="Annual contribution growth (%)" name="growthRate" type="number" min="0" max="1000" step="0.01" defaultValue="0" /><label>Base currency<select name="baseCurrency" defaultValue="INR"><option>INR</option><option>USD</option></select></label><label>Benchmark<select name="benchmarkCode" defaultValue=""><option value="">None</option><option value="NIFTY_50">NIFTY 50</option><option value="SENSEX">BSE SENSEX</option><option value="SP500">S&amp;P 500</option><option value="NASDAQ_COMP">NASDAQ Composite</option></select></label><Field label="Fee per trade (%)" name="feeRate" type="number" min="0" max="10" step="0.001" defaultValue="0" /></div><button disabled={planner.isPending || !symbol && selectionType === 'ASSET'} className="btn-primary mt-4 px-4 py-2">{planner.isPending ? 'Running historical engine…' : `Run ${labels[tool][0].toLowerCase()}`}</button>{planner.error && <p className="error-banner mt-3" role="alert">{planner.error.message}</p>}<p className="methodology-copy mt-4">Historical and hypothetical analysis only. No result is a forecast or guarantee.</p></form>{response && <><p className="notice p-3 text-sm">{response.disclaimer}</p>{response.comparison && <section className="panel"><h2 className="panel-title">Scenario difference</h2><dl className="intelligence-summary"><PlanStat label="Final value difference" value={format(response.comparison.finalValueDifference)} /><PlanStat label="Contribution difference" value={format(response.comparison.contributionDifference)} /></dl></section>}<LabResultView result={response.result} />{response.baseline && <details className="panel"><summary>Original scenario result</summary><LabResultView result={response.baseline} /></details>}</>}</div>;
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Calculator; children: string }) { return <button type="button" aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={onClick}><Icon size={16} />{children}</button>; }
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label>{label}<input {...props} /></label>; }
function PlanStat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function today() { return new Date().toISOString().slice(0, 10); }
function format(value: number) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value); }
