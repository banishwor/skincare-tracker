import type {
  BlockId,
  BlockLog,
  DayLog,
  Product,
  Settings,
  StepDef,
} from '../types';
import {
  addDays,
  formatDayList,
  minutesOf,
  toDateKey,
  weekdayMon0,
} from './dates';

export const BLOCK_ORDER: BlockId[] = ['morning', 'backHome', 'night'];

export const BLOCK_NAMES: Record<BlockId, string> = {
  morning: 'Morning',
  backHome: 'Back home',
  night: 'Night',
};

export const BLOCK_ICONS: Record<BlockId, string> = {
  morning: '🌅',
  backHome: '🏠',
  night: '🌙',
};

/* ------------------------------------------------------------------ */
/* Current block                                                       */
/* ------------------------------------------------------------------ */

export interface CurrentBlock {
  block: BlockId;
  /** The routine-day date key the block belongs to (wraps past midnight). */
  logDate: string;
}

/**
 * The current block is the latest one whose start time has passed today.
 * Before the morning start, we are still in last night's Night block,
 * which belongs to yesterday's routine day.
 */
export function currentBlock(now: Date, settings: Settings): CurrentBlock {
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = toDateKey(now);
  let current: BlockId | null = null;
  for (const b of BLOCK_ORDER) {
    if (minutesOf(settings.blockStarts[b]) <= mins) current = b;
  }
  if (current === null) {
    return { block: 'night', logDate: addDays(today, -1) };
  }
  return { block: current, logDate: today };
}

/* ------------------------------------------------------------------ */
/* TXA scheduling                                                      */
/* ------------------------------------------------------------------ */

export function isTxaNight(dateKey: string, txaDays: number[]): boolean {
  return txaDays.includes(weekdayMon0(dateKey));
}

/** Whether the TXA step is in tonight's list, honouring the day's override. */
export function txaApplies(log: DayLog | undefined, dateKey: string, settings: Settings): boolean {
  if (log?.txaOverride === 'used') return true;
  if (log?.txaOverride === 'skipped') return false;
  return isTxaNight(dateKey, settings.txaDays);
}

/* ------------------------------------------------------------------ */
/* Product windows (which product fills a slot / gates a step, per day) */
/* ------------------------------------------------------------------ */

function inUseWindowOn(p: Product, dateKey: string): boolean {
  if (p.status !== 'using' && p.status !== 'finished') return false;
  if (p.startedOn && p.startedOn > dateKey) return false;
  if (p.finishedOn && dateKey >= p.finishedOn) return false;
  return true;
}

/** The product filling the toner slot on a given date, if any. */
export function tonerProductOn(products: Product[], dateKey: string): Product | null {
  const candidates = products
    .filter((p) => p.slot === 'toner' && inUseWindowOn(p, dateKey))
    .sort((a, b) => (a.startedOn ?? '').localeCompare(b.startedOn ?? ''));
  return candidates[candidates.length - 1] ?? null;
}

type GateState = 'using' | 'pending' | 'absent';

/** Whether the product gating a step (e.g. Niacinamide) is in use on a date. */
export function stepGateState(products: Product[], stepId: string, dateKey: string): GateState {
  const linked = products.filter((p) => p.stepId === stepId);
  if (linked.length === 0) return 'absent';
  if (linked.some((p) => inUseWindowOn(p, dateKey))) return 'using';
  if (linked.some((p) => p.status === 'toBuy' || p.status === 'suggested')) return 'pending';
  return 'absent';
}

/* ------------------------------------------------------------------ */
/* Step derivation                                                     */
/* ------------------------------------------------------------------ */

export interface StepContext {
  products: Product[];
  settings: Settings;
  dateKey: string;
  log?: DayLog;
}

function tonerStep(ctx: StepContext): StepDef {
  const filler = tonerProductOn(ctx.products, ctx.dateKey);
  if (filler) {
    return { id: 'toner', name: 'Toner', note: filler.name, optional: false, kind: 'check' };
  }
  return {
    id: 'toner',
    name: 'Toner',
    note: 'No toner in use — add or start one in Cabinet',
    optional: true,
    kind: 'check',
    skippable: true,
  };
}

export function buildSteps(block: BlockId, ctx: StepContext): StepDef[] {
  if (block === 'morning') {
    const nia = stepGateState(ctx.products, 'niacinamide', ctx.dateKey);
    const steps: StepDef[] = [
      { id: 'saWash', name: 'Minimalist Salicylic Acid 2% Face Wash', optional: false, kind: 'check' },
      tonerStep(ctx),
      nia === 'pending'
        ? {
            id: 'niacinamide',
            name: 'Niacinamide 10% Serum',
            note: 'Oil control + brightening',
            chip: 'to buy',
            optional: true,
            kind: 'check',
            skippable: true,
          }
        : nia === 'absent'
          ? {
              // Product finished (or never added) with nothing queued: the step
              // must stay optional forever — it can never block completion.
              id: 'niacinamide',
              name: 'Niacinamide 10% Serum',
              note: 'Add it in Cabinet when you buy it',
              optional: true,
              kind: 'check',
              skippable: true,
            }
          : {
              id: 'niacinamide',
              name: 'Niacinamide 10% Serum',
              note: 'Oil control + brightening',
              optional: false,
              kind: 'check',
            },
      { id: 'vitC', name: 'Minimalist Vitamin C Serum', optional: false, kind: 'check' },
      {
        id: 'moisturizer',
        name: 'Moisturizer',
        note: 'Light layer — skip if sunscreen feels hydrating enough',
        optional: false,
        kind: 'check',
        skippable: true,
      },
      { id: 'sunscreen', name: 'Sunscreen', note: '15–20 min before stepping out', optional: false, kind: 'check' },
    ];
    return steps;
  }
  if (block === 'backHome') {
    return [
      {
        id: 'saWash',
        name: 'SA Face Wash',
        note: 'Wash the day off — don’t let the oil sit till night',
        optional: false,
        kind: 'check',
      },
      {
        id: 'moisturizer',
        name: 'Moisturizer',
        note: 'Only if skin feels tight',
        optional: true,
        kind: 'check',
        skippable: true,
      },
    ];
  }
  // night
  const steps: StepDef[] = [
    {
      id: 'faceWash',
      name: 'Face wash',
      note: 'Single cleanse — sunscreen already came off at 2 PM',
      optional: false,
      kind: 'check',
    },
    tonerStep(ctx),
  ];
  if (txaApplies(ctx.log, ctx.dateKey, ctx.settings)) {
    steps.push({
      id: 'txa',
      name: 'Minimalist Tranexamic Acid 3% Serum',
      note: 'Brightening active',
      optional: false,
      kind: 'check',
    });
  }
  steps.push({
    id: 'finalMoisture',
    name: 'Moisturizer or Night Cream',
    note: 'Pick one — never both',
    optional: false,
    kind: 'either',
  });
  return steps;
}

/* ------------------------------------------------------------------ */
/* Resolution & completion                                             */
/* ------------------------------------------------------------------ */

/**
 * A step counts as resolved when the user has made a decision on it:
 * ticked done, or explicitly skipped. Pending = no record.
 */
export function isStepResolved(step: StepDef, blockLog: BlockLog | undefined): boolean {
  if (!blockLog) return false;
  if (step.kind === 'either') return !!blockLog.eitherChoice;
  const s = blockLog.steps[step.id];
  return s === 'done' || s === 'skipped';
}

export function isStepDone(step: StepDef, blockLog: BlockLog | undefined): boolean {
  if (!blockLog) return false;
  if (step.kind === 'either') return !!blockLog.eitherChoice;
  return blockLog.steps[step.id] === 'done';
}

/** Block is complete when it isn't missed and every non-optional step is resolved. */
export function blockComplete(block: BlockId, log: DayLog | undefined, ctx: StepContext): boolean {
  const blockLog = log?.blocks[block];
  if (!blockLog || blockLog.missed) return false;
  return buildSteps(block, ctx)
    .filter((s) => !s.optional)
    .every((s) => isStepResolved(s, blockLog));
}

/**
 * Non-optional steps of a block that are still pending (no decision recorded).
 * Optional steps (e.g. "moisturizer only if skin feels tight") are never
 * chased — leaving them untouched is a normal outcome, not a gap.
 */
export function pendingSteps(block: BlockId, log: DayLog | undefined, ctx: StepContext): StepDef[] {
  const blockLog = log?.blocks[block];
  if (blockLog?.missed) return [];
  return buildSteps(block, ctx).filter((s) => !s.optional && !isStepResolved(s, blockLog));
}

export function resolvedCount(block: BlockId, log: DayLog | undefined, ctx: StepContext): number {
  const steps = buildSteps(block, ctx);
  const blockLog = log?.blocks[block];
  return steps.filter((s) => isStepResolved(s, blockLog)).length;
}

/* ------------------------------------------------------------------ */
/* Catch-up                                                            */
/* ------------------------------------------------------------------ */

export interface CatchUpCandidate {
  block: BlockId;
  pendingNames: string[];
}

/** Has this block's window fully passed, given the block that is current now? */
export function windowPassed(block: BlockId, current: BlockId): boolean {
  return BLOCK_ORDER.indexOf(block) < BLOCK_ORDER.indexOf(current);
}

/**
 * The earliest block of the routine day whose window has passed, that still
 * has pending steps and whose catch-up question hasn't been resolved.
 */
export function catchUpCandidate(
  log: DayLog | undefined,
  logDate: string,
  current: BlockId,
  baseCtx: Omit<StepContext, 'log' | 'dateKey'>,
): CatchUpCandidate | null {
  for (const block of BLOCK_ORDER) {
    if (!windowPassed(block, current)) continue;
    const blockLog = log?.blocks[block];
    if (!blockLog || blockLog.catchUpResolved || blockLog.missed) {
      if (!blockLog) {
        // No log at all for the block: every step is pending.
        const ctx: StepContext = { ...baseCtx, dateKey: logDate, log };
        const pending = pendingSteps(block, log, ctx);
        if (pending.length > 0) return { block, pendingNames: pending.map((s) => s.name) };
      }
      continue;
    }
    const ctx: StepContext = { ...baseCtx, dateKey: logDate, log };
    const pending = pendingSteps(block, log, ctx);
    if (pending.length > 0) {
      return { block, pendingNames: pending.map((s) => s.name) };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Day state, streaks                                                  */
/* ------------------------------------------------------------------ */

export type DayState = 'full' | 'partial' | 'missed' | 'none';

export type DayEvaluator = (dateKey: string) => DayState;

export function makeDayEvaluator(
  logs: Map<string, DayLog>,
  products: Product[],
  settings: Settings,
): DayEvaluator {
  return (dateKey: string): DayState => {
    const log = logs.get(dateKey);
    if (!log) return 'none';
    const ctxBase = { products, settings };
    let anyMissed = false;
    let anyDone = false;
    let allComplete = true;
    for (const block of BLOCK_ORDER) {
      const blockLog = log.blocks[block];
      if (blockLog?.missed) anyMissed = true;
      const ctx: StepContext = { ...ctxBase, dateKey, log };
      const steps = buildSteps(block, ctx);
      if (steps.some((s) => isStepDone(s, blockLog))) anyDone = true;
      if (!blockComplete(block, log, ctx)) allComplete = false;
    }
    if (anyMissed) return 'missed';
    if (allComplete) return 'full';
    if (anyDone) return 'partial';
    return 'none';
  };
}

/**
 * Current streak: consecutive full days ending today (if today is already
 * full) or yesterday. An incomplete-but-still-running today doesn't break it.
 */
export function currentStreak(evaluate: DayEvaluator, today: string): number {
  let anchor = today;
  if (evaluate(anchor) !== 'full') anchor = addDays(today, -1);
  let streak = 0;
  let cursor = anchor;
  while (evaluate(cursor) === 'full') {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of full days within [fromKey, toKey] inclusive. */
export function bestStreak(evaluate: DayEvaluator, fromKey: string, toKey: string): number {
  let best = 0;
  let run = 0;
  let cursor = fromKey;
  while (cursor <= toKey) {
    if (evaluate(cursor) === 'full') {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return best;
}

/** Full days in the Mon–Sun week containing the given date. */
export function fullDaysThisWeek(evaluate: DayEvaluator, dateKey: string): number {
  const monday = addDays(dateKey, -weekdayMon0(dateKey));
  let count = 0;
  for (let i = 0; i < 7; i += 1) {
    if (evaluate(addDays(monday, i)) === 'full') count += 1;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Greeting                                                            */
/* ------------------------------------------------------------------ */

export function greeting(block: BlockId, userName: string): string {
  const part = block === 'morning' ? 'Good morning' : block === 'backHome' ? 'Good afternoon' : 'Good evening';
  return `${part}, ${userName}`;
}

export function suggestionLine(
  block: BlockId,
  log: DayLog | undefined,
  dateKey: string,
  settings: Settings,
): string {
  if (block === 'morning') {
    return 'Your morning routine before work — sunscreen last, 15–20 min before you step out.';
  }
  if (block === 'backHome') {
    return 'Back home — wash off the day’s oil and sunscreen.';
  }
  return txaApplies(log, dateKey, settings)
    ? 'Night routine — tonight is a TXA night.'
    : 'Night routine — no TXA tonight, keep it simple.';
}

export function txaScheduleText(settings: Settings): string {
  return formatDayList(settings.txaDays);
}

/** A fresh, empty day log. */
export function emptyDayLog(date: string): DayLog {
  return {
    date,
    blocks: {
      morning: { steps: {} },
      backHome: { steps: {} },
      night: { steps: {} },
    },
    txaOverride: null,
  };
}
