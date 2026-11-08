export type BlockId = 'morning' | 'backHome' | 'night';

/** A step's recorded state in a day log. Absence of a record means "pending". */
export type StepState = 'done' | 'skipped' | 'missed';

export type TxaOverride = 'used' | 'skipped' | null;

export type ProductStatus = 'using' | 'toBuy' | 'finished' | 'suggested';

export type EitherChoice = 'moisturizer' | 'nightCream';

export interface Settings {
  userName: string;
  /** Weekdays (Mon = 0 … Sun = 6) on which TXA is scheduled at night. */
  txaDays: number[];
  /** Local 'HH:MM' start time of each block. */
  blockStarts: Record<BlockId, string>;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  status: ProductStatus;
  /** Fills a routine slot while in its use window (startedOn … finishedOn). */
  slot?: 'toner';
  /** Routine step this product gates (e.g. 'niacinamide'): optional while not using. */
  stepId?: string;
  /** Product planned to take over when this one finishes. */
  successorId?: string;
  /** Position in the to-buy queue (1-based). */
  queueOrder?: number;
  startedOn?: string; // YYYY-MM-DD
  finishedOn?: string; // YYYY-MM-DD
  note?: string;
  chip?: string;
  origin: 'seed' | 'suggested' | 'custom';
}

export interface BlockLog {
  steps: Record<string, StepState>;
  eitherChoice?: EitherChoice | null;
  missed?: boolean;
  catchUpResolved?: boolean;
}

export interface DayLog {
  /** Local date key YYYY-MM-DD this routine day belongs to. */
  date: string;
  blocks: Record<BlockId, BlockLog>;
  txaOverride: TxaOverride;
  /**
   * Snapshot of Settings.txaDays taken when this log was created.
   * Day evaluation uses the snapshot, so editing TXA days in Settings
   * never rewrites history. Absent on pre-0.1.1 logs (optional, therefore
   * non-indexed — no Dexie schema version bump needed); evaluation then
   * falls back to the current settings.
   */
  txaDays?: number[];
}

export interface StepDef {
  id: string;
  name: string;
  note?: string;
  chip?: string;
  optional: boolean;
  kind: 'check' | 'either';
  /** Show an explicit "Skip" affordance (unowned / situational steps). */
  skippable?: boolean;
}
