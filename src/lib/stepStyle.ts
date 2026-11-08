/**
 * Decorative colour dots for the Today screen's Now-card step list.
 *
 * The dot is a scanning aid only — it is aria-hidden in the UI and step
 * state (done / skipped / missed) is always conveyed by the tick, never
 * by the dot. Colours are chosen strong enough to read on white cards.
 */
export type StepCategory =
  | 'cleanser'
  | 'toner'
  | 'serum'
  | 'treatment'
  | 'moisture'
  | 'sun'
  | 'other';

export interface StepStyle {
  category: StepCategory;
  /** Dot colour (hex). */
  color: string;
}

const CLEANSER: StepStyle = { category: 'cleanser', color: '#0f766e' }; // teal
const TONER: StepStyle = { category: 'toner', color: '#7c3aed' }; // violet
const SERUM: StepStyle = { category: 'serum', color: '#d97706' }; // amber
const TREATMENT: StepStyle = { category: 'treatment', color: '#dc4446' }; // coral-red
const MOISTURE: StepStyle = { category: 'moisture', color: '#2f7fd0' }; // blue
const SUN: StepStyle = { category: 'sun', color: '#dd7a08' }; // orange

/**
 * Every step id `buildSteps` can emit, mapped to its category style.
 * `saWash` serves both the morning wash and the back-home wash;
 * `faceWash` is the night cleanse. `finalMoisture` is the either/or
 * moisturizer-or-night-cream step.
 */
export const STEP_STYLES: Record<string, StepStyle> = {
  saWash: CLEANSER,
  faceWash: CLEANSER,
  toner: TONER,
  niacinamide: SERUM,
  vitC: SERUM,
  txa: TREATMENT,
  moisturizer: MOISTURE,
  finalMoisture: MOISTURE,
  sunscreen: SUN,
};

/** Fallback for any future step id without an explicit category. */
export const DEFAULT_STEP_STYLE: StepStyle = { category: 'other', color: '#8e8e93' };

export function stepStyle(stepId: string): StepStyle {
  return STEP_STYLES[stepId] ?? DEFAULT_STEP_STYLE;
}

export function stepDotColor(stepId: string): string {
  return stepStyle(stepId).color;
}
