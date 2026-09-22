import { describe, expect, it } from 'vitest';
import { calculateTechnicalAnalysis, maximumDrawdown, relativeStrengthIndex, simpleMovingAverage } from '../../src/services/technicalAnalysis.service';

const bars = Array.from({ length: 220 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
  open: index + 1, high: index + 1, low: index + 1, close: index + 1,
  adjusted_close: index + 1, volume: 1_000 + index,
}));

describe('server-side technical analysis', () => {
  it('calculates deterministic SMA, EMA, RSI, MACD, Bollinger, volatility, and drawdown values', () => {
    const result = calculateTechnicalAnalysis(bars);
    const latest = result.series.at(-1)!;
    expect(latest).toMatchObject({ close: 220, volume: 1219, sma20: 210.5, sma50: 195.5, sma200: 120.5, rsi14: 100 });
    expect(latest.ema20).toBeCloseTo(210.5, 5);
    expect(latest.macd).toBeCloseTo(6.999999, 5);
    expect(latest.macdSignal).toBeCloseTo(6.999998, 5);
    expect(latest.macdHistogram).toBeCloseTo(0, 5);
    expect(latest.bollingerMiddle).toBe(210.5);
    expect(latest.bollingerUpper).toBeCloseTo(222.032563, 6);
    expect(latest.bollingerLower).toBeCloseTo(198.967437, 6);
    expect(result.summary?.maxDrawdown).toBe(0);
    expect(result.summary?.volatility).not.toBeNull();
  });

  it('uses exact windows and handles flat RSI and drawdowns deterministically', () => {
    expect(simpleMovingAverage([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
    expect(relativeStrengthIndex(Array(16).fill(10), 14).at(-1)).toBe(50);
    expect(maximumDrawdown([100, 120, 90, 108])).toBe(-25);
  });
});
