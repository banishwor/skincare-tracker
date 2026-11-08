import { describe, expect, it } from 'vitest';
import type { DayLog, Settings } from '../types';
import { DEFAULT_SETTINGS, seedProducts } from './seed';
import { buildSteps, emptyDayLog } from './logic';
import { STEP_STYLES, stepDotColor, stepStyle } from './stepStyle';

const settings: Settings = structuredClone(DEFAULT_SETTINGS);
const products = seedProducts('2026-11-08');

/** Every step id buildSteps can emit, across all blocks incl. a TXA night. */
function allEmittedStepIds(): Set<string> {
  const ids = new Set<string>();
  // 2026-11-09 is a Monday — a TXA night in the default schedule.
  const txaLog: DayLog = emptyDayLog('2026-11-09', settings.txaDays);
  const ctxs = [
    { products, settings, dateKey: '2026-11-08' },
    { products, settings, dateKey: '2026-11-09', log: txaLog },
  ];
  for (const ctx of ctxs) {
    for (const block of ['morning', 'backHome', 'night'] as const) {
      for (const step of buildSteps(block, ctx)) ids.add(step.id);
    }
  }
  return ids;
}

describe('stepStyle', () => {
  it('covers every step id buildSteps can emit', () => {
    const ids = allEmittedStepIds();
    // Guard the fixture itself: the full known id set must be exercised.
    expect([...ids].sort()).toEqual(
      [
        'saWash',
        'toner',
        'niacinamide',
        'vitC',
        'moisturizer',
        'sunscreen',
        'faceWash',
        'txa',
        'finalMoisture',
      ].sort(),
    );
    for (const id of ids) {
      expect(STEP_STYLES[id], `missing style for step id ${id}`).toBeDefined();
      expect(stepStyle(id).category).not.toBe('other');
      expect(stepDotColor(id)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('maps each id to its intended category', () => {
    expect(stepStyle('saWash').category).toBe('cleanser');
    expect(stepStyle('faceWash').category).toBe('cleanser');
    expect(stepStyle('toner').category).toBe('toner');
    expect(stepStyle('niacinamide').category).toBe('serum');
    expect(stepStyle('vitC').category).toBe('serum');
    expect(stepStyle('txa').category).toBe('treatment');
    expect(stepStyle('moisturizer').category).toBe('moisture');
    expect(stepStyle('finalMoisture').category).toBe('moisture');
    expect(stepStyle('sunscreen').category).toBe('sun');
  });

  it('gives each category a distinct colour', () => {
    const byCategory = new Map<string, string>();
    for (const style of Object.values(STEP_STYLES)) {
      if (byCategory.has(style.category)) {
        expect(byCategory.get(style.category)).toBe(style.color);
      } else {
        byCategory.set(style.category, style.color);
      }
    }
    expect(new Set(byCategory.values()).size).toBe(byCategory.size);
    expect(byCategory.size).toBe(6);
  });

  it('falls back gracefully for an unknown id', () => {
    expect(stepStyle('nope').category).toBe('other');
    expect(stepDotColor('nope')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
