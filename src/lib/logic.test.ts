import { describe, expect, it } from 'vitest';
import type { DayLog, Product, Settings } from '../types';
import { DEFAULT_SETTINGS, seedProducts } from './seed';
import {
  blockComplete,
  buildSteps,
  catchUpCandidate,
  currentBlock,
  currentStreak,
  emptyDayLog,
  fullDaysThisWeek,
  isTxaNight,
  makeDayEvaluator,
  pendingSteps,
  tonerProductOn,
  txaApplies,
} from './logic';
import { addDays } from './dates';

const settings: Settings = structuredClone(DEFAULT_SETTINGS);
const products = seedProducts('2026-11-08');
const ctx = (log?: DayLog, dateKey = '2026-11-08') => ({ products, settings, dateKey, log });

function fullLog(date: string, overrides?: Partial<DayLog>): DayLog {
  const log = emptyDayLog(date);
  log.blocks.morning.steps = {
    saWash: 'done', toner: 'done', niacinamide: 'done',
    vitC: 'done', moisturizer: 'done', sunscreen: 'done',
  };
  log.blocks.backHome.steps = { saWash: 'done' };
  log.blocks.night.steps = { faceWash: 'done', toner: 'done' };
  log.blocks.night.eitherChoice = 'moisturizer';
  if (isTxaNight(date, settings.txaDays)) log.blocks.night.steps['txa'] = 'done';
  return { ...log, ...overrides };
}

describe('currentBlock', () => {
  const at = (h: number, m: number) => new Date(2026, 10, 8, h, m); // Sun 8 Nov 2026
  it('is Morning after 04:00 and before 12:30', () => {
    expect(currentBlock(at(4, 0), settings)).toEqual({ block: 'morning', logDate: '2026-11-08' });
    expect(currentBlock(at(9, 15), settings).block).toBe('morning');
  });
  it('is BackHome from 12:30 to 17:30', () => {
    expect(currentBlock(at(12, 30), settings).block).toBe('backHome');
    expect(currentBlock(at(14, 0), settings).block).toBe('backHome');
  });
  it('is Night from 17:30 onwards', () => {
    expect(currentBlock(at(17, 30), settings).block).toBe('night');
    expect(currentBlock(at(23, 59), settings).block).toBe('night');
  });
  it('wraps past midnight: 01:00 is still yesterday’s Night', () => {
    expect(currentBlock(at(1, 0), settings)).toEqual({ block: 'night', logDate: '2026-11-07' });
    expect(currentBlock(at(3, 59), settings).logDate).toBe('2026-11-07');
  });
  it('honours custom start times', () => {
    const s2: Settings = { ...settings, blockStarts: { morning: '06:00', backHome: '13:00', night: '20:00' } };
    expect(currentBlock(at(5, 0), s2)).toEqual({ block: 'night', logDate: '2026-11-07' });
    expect(currentBlock(at(19, 0), s2).block).toBe('backHome');
  });
});

describe('TXA scheduling', () => {
  it('2026-11-08 is a Sunday — not a TXA night by default', () => {
    expect(weekdayCheck('2026-11-08')).toBe(false);
    expect(isTxaNight('2026-11-09', settings.txaDays)).toBe(true); // Monday
    expect(isTxaNight('2026-11-11', settings.txaDays)).toBe(false); // Wednesday
    expect(isTxaNight('2026-11-14', settings.txaDays)).toBe(true); // Saturday
  });
  function weekdayCheck(d: string) {
    return isTxaNight(d, settings.txaDays);
  }
  it('override used forces TXA in on a plain night', () => {
    const log = { ...emptyDayLog('2026-11-08'), txaOverride: 'used' as const };
    expect(txaApplies(log, '2026-11-08', settings)).toBe(true);
    expect(buildSteps('night', ctx(log)).some((s) => s.id === 'txa')).toBe(true);
  });
  it('override skipped removes TXA on a TXA night', () => {
    const log = { ...emptyDayLog('2026-11-09'), txaOverride: 'skipped' as const };
    expect(txaApplies(log, '2026-11-09', settings)).toBe(false);
    expect(buildSteps('night', ctx(log, '2026-11-09')).some((s) => s.id === 'txa')).toBe(false);
  });
  it('night step list includes TXA on a scheduled night without override', () => {
    expect(buildSteps('night', ctx(undefined, '2026-11-09')).map((s) => s.id)).toEqual([
      'faceWash', 'toner', 'txa', 'finalMoisture',
    ]);
    expect(buildSteps('night', ctx(undefined, '2026-11-08')).map((s) => s.id)).toEqual([
      'faceWash', 'toner', 'finalMoisture',
    ]);
  });
});

describe('seed-driven step derivation', () => {
  it('toner slot is filled by PHA from 2026-11-08 (bought that day)', () => {
    expect(tonerProductOn(products, '2026-11-08')?.id).toBe('p-pha');
    const toner = buildSteps('morning', ctx()).find((s) => s.id === 'toner');
    expect(toner?.optional).toBe(false);
    expect(toner?.note).toBe('Minimalist PHA 3% Toner');
  });
  it('niacinamide step is a normal owned step (no chip, not optional)', () => {
    const nia = buildSteps('morning', ctx()).find((s) => s.id === 'niacinamide');
    expect(nia?.optional).toBe(false);
    expect(nia?.chip).toBeUndefined();
  });
  it('toner step becomes optional when no toner product is in its window', () => {
    const without = products.filter((p) => p.id !== 'p-pha');
    const c = { products: without, settings, dateKey: '2026-11-08', log: undefined };
    const toner = buildSteps('morning', c).find((s) => s.id === 'toner');
    expect(toner?.optional).toBe(true);
    expect(toner?.note).toBe('PHA 3% not started yet');
  });
  it('niacinamide step is optional with a to-buy chip while the product is queued', () => {
    const queued = products.map((p) =>
      p.id === 'p-nia' ? { ...p, status: 'toBuy' as const, startedOn: undefined } : p,
    );
    const c = { products: queued, settings, dateKey: '2026-11-08', log: undefined };
    const nia = buildSteps('morning', c).find((s) => s.id === 'niacinamide');
    expect(nia?.optional).toBe(true);
    expect(nia?.chip).toBe('to buy');
  });
  it('before PHA started, the Plum toner filled the slot (until its finish date)', () => {
    expect(tonerProductOn(products, '2026-11-01')?.id).toBe('p-plum');
    expect(tonerProductOn(products, '2026-11-07')?.id).toBe('p-plum');
    expect(tonerProductOn(products, '2026-11-08')?.id).toBe('p-pha');
  });
});

describe('block completion', () => {
  it('optional steps never block completion', () => {
    const log = emptyDayLog('2026-11-08');
    log.blocks.backHome.steps = { saWash: 'done' }; // moisturizer (optional) untouched
    expect(blockComplete('backHome', log, ctx(log))).toBe(true);
  });
  it('either/or completes when one option is chosen', () => {
    const log = fullLog('2026-11-08');
    expect(blockComplete('night', log, ctx(log))).toBe(true);
    const log2 = fullLog('2026-11-08');
    log2.blocks.night.eitherChoice = null;
    expect(blockComplete('night', log2, ctx(log2))).toBe(false);
  });
  it('a missed block is never complete; skipped counts as resolved', () => {
    const log = fullLog('2026-11-08');
    log.blocks.morning.missed = true;
    expect(blockComplete('morning', log, ctx(log))).toBe(false);
    const log2 = fullLog('2026-11-08');
    log2.blocks.morning.steps['moisturizer'] = 'skipped';
    expect(blockComplete('morning', log2, ctx(log2))).toBe(true);
  });
  it('a fully ticked day completes all blocks', () => {
    const log = fullLog('2026-11-09'); // TXA Monday
    expect(blockComplete('morning', log, ctx(log, '2026-11-09'))).toBe(true);
    expect(blockComplete('night', log, ctx(log, '2026-11-09'))).toBe(true);
  });
});

describe('catch-up', () => {
  it('asks about the earliest passed block with pending steps', () => {
    const log = emptyDayLog('2026-11-08');
    log.blocks.morning.steps = { saWash: 'done' }; // rest pending
    const candidate = catchUpCandidate(log, '2026-11-08', 'night', { products, settings });
    expect(candidate?.block).toBe('morning');
    expect(candidate?.pendingNames).toContain('Sunscreen');
  });
  it('does not ask when catch-up was resolved, or when nothing is pending', () => {
    const resolved = fullLog('2026-11-08');
    resolved.blocks.morning.catchUpResolved = true;
    expect(catchUpCandidate(resolved, '2026-11-08', 'night', { products, settings })).toBeNull();
    expect(catchUpCandidate(fullLog('2026-11-08'), '2026-11-08', 'night', { products, settings })).toBeNull();
  });
  it('does not ask about the current or future blocks', () => {
    const log = emptyDayLog('2026-11-08');
    expect(catchUpCandidate(log, '2026-11-08', 'morning', { products, settings })).toBeNull();
    const c = catchUpCandidate(log, '2026-11-08', 'backHome', { products, settings });
    expect(c?.block).toBe('morning');
  });
  it('with no log at all, every step of passed blocks is pending', () => {
    const c = catchUpCandidate(undefined, '2026-11-08', 'backHome', { products, settings });
    expect(c?.block).toBe('morning');
    expect(pendingSteps('morning', undefined, ctx()).length).toBeGreaterThan(0);
  });
});

describe('streaks and day states', () => {
  const base = '2026-11-08';
  function logsFor(map: Record<string, DayLog>): Map<string, DayLog> {
    return new Map(Object.entries(map));
  }
  it('counts consecutive full days ending today when today is full', () => {
    const logs = logsFor({
      '2026-11-06': fullLog('2026-11-06'),
      '2026-11-07': fullLog('2026-11-07'),
      '2026-11-08': fullLog('2026-11-08'),
    });
    const evaluate = makeDayEvaluator(logs, products, settings);
    expect(evaluate('2026-11-08')).toBe('full');
    expect(currentStreak(evaluate, base)).toBe(3);
  });
  it('an incomplete today does not break the streak (anchor moves to yesterday)', () => {
    const logs = logsFor({
      '2026-11-06': fullLog('2026-11-06'),
      '2026-11-07': fullLog('2026-11-07'),
    });
    const evaluate = makeDayEvaluator(logs, products, settings);
    expect(currentStreak(evaluate, base)).toBe(2);
  });
  it('a missed block breaks the streak and marks the day missed', () => {
    const missedDay = fullLog('2026-11-07');
    missedDay.blocks.morning = { steps: { sunscreen: 'missed' }, missed: true, catchUpResolved: true };
    const logs = logsFor({
      '2026-11-06': fullLog('2026-11-06'),
      '2026-11-07': missedDay,
      '2026-11-08': fullLog('2026-11-08'),
    });
    const evaluate = makeDayEvaluator(logs, products, settings);
    expect(evaluate('2026-11-07')).toBe('missed');
    expect(currentStreak(evaluate, base)).toBe(1);
  });
  it('partial day: some steps done, no miss', () => {
    const log = emptyDayLog('2026-11-08');
    log.blocks.morning.steps = { saWash: 'done' };
    const evaluate = makeDayEvaluator(logsFor({ '2026-11-08': log }), products, settings);
    expect(evaluate('2026-11-08')).toBe('partial');
    expect(evaluate('2026-11-05')).toBe('none');
  });
  it('fullDaysThisWeek counts full days Mon–Sun', () => {
    const logs = logsFor({
      '2026-11-02': fullLog('2026-11-02'), // Monday
      '2026-11-03': fullLog('2026-11-03'),
      '2026-11-08': fullLog('2026-11-08'), // Sunday, same week
    });
    const evaluate = makeDayEvaluator(logs, products, settings);
    expect(fullDaysThisWeek(evaluate, '2026-11-08')).toBe(3);
    expect(fullDaysThisWeek(evaluate, addDays('2026-11-08', 1))).toBe(0); // next week
  });
});
