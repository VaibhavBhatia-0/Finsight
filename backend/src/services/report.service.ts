import { AppError } from '../middleware/errorHandler';
import { BacktestRepository } from '../repositories/backtest.repository';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { ScenarioRepository } from '../repositories/scenario.repository';
import type { ReportQuery } from '../validators/report.validator';
import { FinanceService } from './finance.service';
import { PortfolioService } from './portfolio.service';

type ReportValue = string | number | boolean | null | undefined;
type ReportRow = Record<string, ReportValue>;

interface ReportContent {
  title: string;
  columns: string[];
  rows: ReportRow[];
  methodology: string;
  source: string;
}

export class ReportService {
  static async generate(userId: string, query: ReportQuery) {
    const content = await this.load(userId, query);
    const generatedAt = new Date().toISOString();
    const disclaimer = 'Educational estimates only. Not investment, tax, or legal advice.';
    const basename = `finsight-${query.reportType}-${generatedAt.slice(0, 10)}`;

    if (query.format === 'csv') {
      const rows = [
        ['Report', content.title],
        ['Generated at', generatedAt],
        ['Source', content.source],
        ['Methodology', content.methodology],
        ['Disclaimer', disclaimer],
        [],
        content.columns,
        ...content.rows.map(row => content.columns.map(column => row[column] ?? '')),
      ];
      return { buffer: Buffer.from(rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'utf8'), contentType: 'text/csv; charset=utf-8', filename: `${basename}.csv` };
    }

    const lines = [
      content.title,
      `Generated at: ${generatedAt}`,
      `Source: ${content.source}`,
      `Methodology: ${content.methodology}`,
      `Disclaimer: ${disclaimer}`,
      '',
      content.columns.join(' | '),
      ...content.rows.map(row => content.columns.map(column => displayValue(row[column])).join(' | ')),
    ];
    return { buffer: createTextPdf(lines), contentType: 'application/pdf', filename: `${basename}.pdf` };
  }

  private static async load(userId: string, query: ReportQuery): Promise<ReportContent> {
    switch (query.reportType) {
      case 'finance_transactions': {
        const values = await FinanceService.getTransactions(userId, { startDate: query.startDate, endDate: query.endDate });
        return report('Finance transactions', ['date', 'type', 'category', 'amount', 'currency', 'description', 'recurring'], values.map(value => ({ date: dateOnly(value.transaction_date), type: value.transaction_type, category: value.category, amount: Number(value.amount), currency: value.currency, description: value.description, recurring: value.recurring })), 'Ledger entries are exported as recorded; no amounts are netted.', 'USER_FINANCE_LEDGER');
      }
      case 'finance_summary': {
        const value = await FinanceService.getSummary(userId);
        return report('Finance summary', ['metric', 'value', 'currency'], Object.entries(value.overview).map(([metric, amount]) => ({ metric, value: amount, currency: metric === 'savingsRate' ? '%' : value.currency })), `Transaction amounts are converted using historical transaction-date FX. Synthetic FX used: ${value.calculation.hasSyntheticFx}.`, 'USER_FINANCE_LEDGER');
      }
      case 'scenarios': {
        const values = filterByDate(await ScenarioRepository.findByUserId(userId), query, 'created_at');
        return report('Saved scenarios', ['id', 'name', 'type', 'currency', 'start_date', 'end_date', 'initial_amount', 'final_value', 'return_percentage'], values.map(value => ({ id: value.id, name: value.name, type: value.scenario_type, currency: value.base_currency, start_date: dateOnly(value.start_date), end_date: dateOnly(value.end_date), initial_amount: value.initial_amount, final_value: value.final_value, return_percentage: value.return_percentage })), 'Results are stored outputs from the FinSight Scenario Engine, not backtests.', 'SCENARIO_ENGINE_RESULTS');
      }
      case 'backtests': {
        const values = filterByDate(await BacktestRepository.list(userId), query, 'created_at');
        return report('Backtests', ['id', 'name', 'strategy', 'currency', 'start_date', 'end_date', 'initial_amount', 'final_value', 'return_percentage', 'cagr', 'xirr'], values.map(value => ({ id: value.canonical_backtest_id, name: value.name, strategy: value.strategy_type, currency: value.base_currency, start_date: dateOnly(value.start_date), end_date: dateOnly(value.end_date), initial_amount: value.initial_amount, final_value: value.final_value, return_percentage: value.return_percentage, cagr: value.cagr, xirr: value.xirr })), 'Results are stored outputs from the canonical Backtesting Engine.', 'BACKTEST_ENGINE_RESULTS');
      }
      case 'portfolio_transactions': {
        const portfolio = await PortfolioRepository.findById(query.portfolioId!, userId);
        if (!portfolio) throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
        const values = filterByDate(await PortfolioRepository.getTransactions(portfolio.id), query, 'transaction_date');
        return report(`${portfolio.name} transactions`, ['date', 'type', 'symbol', 'quantity', 'price', 'amount', 'currency', 'fee', 'fx_rate'], values.map(value => ({ date: dateOnly(value.transaction_date), type: value.transaction_type, symbol: (value as any).symbol, quantity: value.quantity, price: value.price, amount: value.amount, currency: value.currency, fee: value.fee_amount, fx_rate: value.fx_rate })), 'Authoritative portfolio ledger in chronological order.', 'USER_PORTFOLIO_LEDGER');
      }
      case 'portfolios': {
        const portfolios = await PortfolioRepository.findByUserId(userId);
        const values = await Promise.all(portfolios.map(portfolio => PortfolioService.getValuation(portfolio.id, userId)));
        return report('Portfolio valuations', ['id', 'name', 'currency', 'total_value', 'cash_balance', 'holdings_value', 'total_invested', 'total_return', 'return_percentage', 'dividends', 'fees'], values.map(value => ({ id: value.portfolio.id, name: value.portfolio.name, currency: value.portfolio.baseCurrency, total_value: value.summary.totalValue, cash_balance: value.summary.cashBalance, holdings_value: value.summary.holdingsValue, total_invested: value.summary.totalInvested, total_return: value.summary.totalReturnAmount, return_percentage: value.summary.totalReturnPercentage, dividends: value.summary.dividendsEarned, fees: value.summary.feesPaid })), 'Ledger state combined with current synthetic development quotes and latest available FX.', 'PORTFOLIO_LEDGER_AND_FINSIGHT_DEVELOPMENT_FIXTURE');
      }
    }
  }
}

function report(title: string, columns: string[], rows: ReportRow[], methodology: string, source: string): ReportContent {
  return { title, columns, rows, methodology, source };
}

function filterByDate<T extends Record<string, any>>(values: T[], query: ReportQuery, field: keyof T): T[] {
  return values.filter(value => {
    const date = dateOnly(value[field]);
    return (!query.startDate || date >= query.startDate) && (!query.endDate || date <= query.endDate);
  });
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function displayValue(value: ReportValue): string {
  return value === null || value === undefined ? '' : String(value);
}

function csvCell(value: ReportValue): string {
  const text = displayValue(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createTextPdf(lines: string[]): Buffer {
  const pageHeight = 792;
  const linesPerPage = 48;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) pages.push(lines.slice(index, index + linesPerPage));
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const commands = ['BT', '/F1 9 Tf', `40 ${pageHeight - 44} Td`, '12 TL'];
    pageLines.forEach((line, index) => {
      if (index > 0) commands.push('T*');
      commands.push(`(${escapePdf(line).slice(0, 170)}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'utf8');
}

function escapePdf(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');
}
