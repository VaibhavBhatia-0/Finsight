import { describe, expect, it } from 'vitest';
import { oppositeTheme, resolveTheme } from '../context/ThemeContext';

describe('theme preference behavior', () => {
  it('defaults a fresh browser to dark', () => {
    expect(resolveTheme(null)).toBe('dark');
    expect(resolveTheme('system')).toBe('dark');
  });

  it('restores a persisted light or dark preference', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('toggles deterministically in both directions', () => {
    expect(oppositeTheme('dark')).toBe('light');
    expect(oppositeTheme('light')).toBe('dark');
  });
});
