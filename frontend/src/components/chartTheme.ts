import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export type Theme = 'dark' | 'light';

export interface ChartPalette {
  text: string;
  strong: string;
  grid: string;
  border: string;
  tooltip: string;
  tooltipText: string;
  /** Electric blue, magenta, violet, cyan, amber, then neutral grey (used for cash). */
  series: string[];
  gain: string;
  loss: string;
  /** Dashed benchmark / trend lines. */
  trend: string;
}

const palettes: Record<Theme, ChartPalette> = {
  dark: {
    text: '#8f8fa0',
    strong: '#dcdce6',
    grid: 'rgba(255,255,255,.07)',
    border: 'rgba(255,255,255,.12)',
    tooltip: 'rgba(20,20,28,.88)',
    tooltipText: '#f6f6f9',
    series: ['#4d8dff', '#ff5fd2', '#a98bff', '#3ee0ff', '#ffd166', '#8e8e9c'],
    gain: '#3df5a7',
    loss: '#ff5277',
    trend: 'rgba(220,220,235,.55)',
  },
  light: {
    text: '#6e6457',
    strong: '#2a231b',
    grid: 'rgba(70,52,30,.1)',
    border: 'rgba(70,52,30,.18)',
    tooltip: 'rgba(246,240,230,.94)',
    tooltipText: '#231d16',
    series: ['#2d5fe0', '#c2338f', '#6a49cf', '#08849f', '#b07a00', '#958a7c'],
    gain: '#0a7f4c',
    loss: '#c21f45',
    trend: 'rgba(70,52,30,.45)',
  },
};

export function chartPalette(theme: Theme): ChartPalette { return palettes[theme]; }

export function useChartPalette(): ChartPalette {
  return palettes[useContext(ThemeContext)?.theme ?? 'dark'];
}

/** `#rrggbb` → `rgba(r,g,b,a)`; other colour strings are returned unchanged. */
export function alpha(color: string, opacity: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const [red, green, blue] = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
  return `rgba(${red},${green},${blue},${opacity})`;
}

const vertical = (stops: Array<[number, string]>) => ({ type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: stops.map(([offset, color]) => ({ offset, color })) });

/** Glowing line style, as in the reference charts. */
export function glowLine(color: string, width = 2.5) {
  return { width, color, shadowColor: alpha(color, .55), shadowBlur: 14, shadowOffsetY: 6, cap: 'round' as const };
}

/** Area fill that fades from the line colour to transparent. */
export function areaFill(color: string, strength = .32) {
  return { color: vertical([[0, alpha(color, strength)], [1, alpha(color, 0)]]) };
}

/** Glossy rounded bar: bright at the tip, fading toward the axis. */
export function barFill(color: string, horizontal = false) {
  const stops = [{ offset: 0, color: horizontal ? alpha(color, .22) : color }, { offset: 1, color: horizontal ? color : alpha(color, .22) }];
  return {
    color: { type: 'linear', x: 0, y: 0, x2: horizontal ? 1 : 0, y2: horizontal ? 0 : 1, colorStops: stops },
    borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 2, 2],
    shadowColor: alpha(color, .35),
    shadowBlur: 8,
  };
}

/** Green when the series ends at or above where it started, red otherwise. */
export function trendColor(palette: ChartPalette, values: Array<number | null | undefined>): string {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (numbers.length < 2) return palette.series[0];
  return numbers[numbers.length - 1] >= numbers[0] ? palette.gain : palette.loss;
}

/** Shared tooltip, legend, axis and entry-animation styling for ECharts line/bar charts. */
export function chartChrome(palette: ChartPalette) {
  return {
    /** Spread into the option's top level. */
    base: {
      backgroundColor: 'transparent',
      animationDuration: 1100,
      animationEasing: 'cubicOut' as const,
      animationDurationUpdate: 600,
      textStyle: { fontFamily: 'DM Sans, Inter, system-ui, sans-serif' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltip,
      borderColor: palette.border,
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: palette.tooltipText },
      extraCssText: 'border-radius:14px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 40px rgba(0,0,0,.35);',
      axisPointer: { type: 'line', lineStyle: { color: palette.border, type: 'dashed' } },
    },
    legend: { top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 16, textStyle: { color: palette.text } },
    axisLabel: { color: palette.text, hideOverlap: true },
    axisLine: { show: false },
    splitLine: { lineStyle: { color: palette.grid, type: 'dashed' as const } },
  };
}

/** Smooth Catmull-Rom curve through the points as an SVG path. */
export function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return path;
}
