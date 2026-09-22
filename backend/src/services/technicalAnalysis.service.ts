import type { PriceBar } from '../repositories/priceHistory.repository';

export interface TechnicalPoint {
  date: string;
  close: number;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
}

export function calculateTechnicalAnalysis(bars: PriceBar[]) {
  const ordered = [...bars].sort((left, right) => left.date.localeCompare(right.date));
  const closes = ordered.map(row => Number(row.adjusted_close ?? row.close));
  const sma20 = simpleMovingAverage(closes, 20);
  const sma50 = simpleMovingAverage(closes, 50);
  const sma200 = simpleMovingAverage(closes, 200);
  const ema20 = exponentialMovingAverage(closes, 20);
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);
  const macd = closes.map((_, index) => ema12[index] == null || ema26[index] == null ? null : ema12[index]! - ema26[index]!);
  const macdSignal = exponentialMovingAverageNullable(macd, 9);
  const bollinger = bollingerBands(closes, 20, 2);
  const rsi14 = relativeStrengthIndex(closes, 14);
  const series: TechnicalPoint[] = ordered.map((row, index) => ({
    date: row.date,
    close: closes[index],
    volume: Number(row.volume || 0),
    sma20: roundedNullable(sma20[index]),
    sma50: roundedNullable(sma50[index]),
    sma200: roundedNullable(sma200[index]),
    ema20: roundedNullable(ema20[index]),
    rsi14: roundedNullable(rsi14[index]),
    macd: roundedNullable(macd[index]),
    macdSignal: roundedNullable(macdSignal[index]),
    macdHistogram: macd[index] == null || macdSignal[index] == null ? null : round(macd[index]! - macdSignal[index]!),
    bollingerUpper: roundedNullable(bollinger.upper[index]),
    bollingerMiddle: roundedNullable(bollinger.middle[index]),
    bollingerLower: roundedNullable(bollinger.lower[index]),
  }));
  const latest = [...series].reverse().find(row => row.close > 0) ?? null;
  return {
    series,
    summary: latest ? {
      asOfDate: latest.date,
      sma20: latest.sma20,
      sma50: latest.sma50,
      sma200: latest.sma200,
      ema20: latest.ema20,
      rsi14: latest.rsi14,
      macd: latest.macd,
      macdSignal: latest.macdSignal,
      macdHistogram: latest.macdHistogram,
      volatility: annualizedVolatility(closes),
      maxDrawdown: maximumDrawdown(closes),
    } : null,
    methodology: 'Indicators are calculated server-side from adjusted provider closes. Volatility is annualized from daily returns using 252 observations per year.',
  };
}

export function simpleMovingAverage(values: number[], period: number): Array<number | null> {
  let sum = 0;
  return values.map((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    return index + 1 < period ? null : sum / period;
  });
}

export function exponentialMovingAverage(values: number[], period: number): Array<number | null> {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  let current = values[0];
  return values.map((value, index) => {
    current = index === 0 ? value : value * multiplier + current * (1 - multiplier);
    return index + 1 < period ? null : current;
  });
}

function exponentialMovingAverageNullable(values: Array<number | null>, period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  const valid: number[] = [];
  let current = 0;
  const multiplier = 2 / (period + 1);
  values.forEach((value, index) => {
    if (value == null) return;
    valid.push(value);
    current = valid.length === 1 ? value : value * multiplier + current * (1 - multiplier);
    if (valid.length >= period) output[index] = current;
  });
  return output;
}

export function relativeStrengthIndex(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index < period) return null;
    let gains = 0;
    let losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const change = values[cursor] - values[cursor - 1];
      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }
    if (losses === 0) return gains === 0 ? 50 : 100;
    return 100 - 100 / (1 + gains / losses);
  });
}

function bollingerBands(values: number[], period: number, deviations: number) {
  const middle = simpleMovingAverage(values, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  values.forEach((_, index) => {
    if (index + 1 < period || middle[index] == null) { upper.push(null); lower.push(null); return; }
    const window = values.slice(index + 1 - period, index + 1);
    const variance = window.reduce((sum, value) => sum + (value - middle[index]!) ** 2, 0) / period;
    const deviation = Math.sqrt(variance) * deviations;
    upper.push(middle[index]! + deviation);
    lower.push(middle[index]! - deviation);
  });
  return { upper, middle, lower };
}

export function annualizedVolatility(values: number[]): number | null {
  if (values.length < 3) return null;
  const returns = values.slice(1).map((value, index) => value / values[index] - 1);
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

export function maximumDrawdown(values: number[]): number | null {
  if (!values.length) return null;
  let peak = values[0];
  let drawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) drawdown = Math.min(drawdown, value / peak - 1);
  }
  return round(drawdown * 100);
}

function roundedNullable(value: number | null): number | null { return value == null ? null : round(value); }
function round(value: number): number { return Math.round(value * 1e6) / 1e6; }
