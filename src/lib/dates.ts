/** Local-date helpers. All date keys are local 'YYYY-MM-DD' strings. */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Weekday with Monday = 0 … Sunday = 6. */
export function weekdayMon0(key: string): number {
  return (parseDateKey(key).getDay() + 6) % 7;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'Sunday, 8 Nov' — the mockup's dateline format. */
export function formatDateline(key: string): string {
  const d = parseDateKey(key);
  return `${WEEKDAY_LONG[weekdayMon0(key)]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function formatMonthTitle(year: number, month0: number): string {
  return `${MONTH_LONG[month0]} ${year}`;
}

/** '8 Nov' style short date for product lines. */
export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** Minutes since local midnight for an 'HH:MM' string. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** '17:30' → '5:30 PM'. */
export function formatTime(hhmm: string): string {
  const mins = minutesOf(hhmm);
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 'Mon, Tue, Thu, Fri, Sat' from a Mon0 weekday list. */
export function formatDayList(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES_SHORT[d] ?? '')
    .join(', ');
}
