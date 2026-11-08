import { useMemo, useState } from 'react';
import type { DayLog, Product, Settings } from '../types';
import {
  bestStreak,
  currentStreak,
  fullDaysThisWeek,
  makeDayEvaluator,
  type DayState,
} from '../lib/logic';
import { addDays, formatMonthTitle, parseDateKey, toDateKey, todayKey, DAY_LETTERS } from '../lib/dates';

interface Props {
  logs: Map<string, DayLog>;
  products: Product[];
  settings: Settings;
}

export default function HistoryScreen({ logs, products, settings }: Props) {
  const today = todayKey();
  const evaluate = useMemo(
    () => makeDayEvaluator(logs, products, settings),
    [logs, products, settings],
  );

  const streak = currentStreak(evaluate, today);
  const earliest = useMemo(() => {
    const keys = [...logs.keys()].sort();
    return keys[0] ?? today;
  }, [logs, today]);
  const best = bestStreak(evaluate, earliest, today);
  const weekFull = fullDaysThisWeek(evaluate, today);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(viewYear, viewMonth, 1 - mondayOffset);
    const out: { key: string; day: number; inMonth: boolean; state: DayState | 'future' }[] = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = toDateKey(d);
      const inMonth = d.getMonth() === viewMonth;
      const state: DayState | 'future' = key > today ? 'future' : evaluate(key);
      out.push({ key, day: d.getDate(), inMonth, state });
      if (i >= 35 && d.getMonth() !== viewMonth && d.getDate() >= 7) break;
    }
    // Trim a fully out-of-month trailing week.
    while (out.length > 7 && out.slice(-7).every((c) => !c.inMonth)) out.splice(out.length - 7, 7);
    return out;
  }, [viewYear, viewMonth, evaluate, today]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <section>
      <div className="dateline">Consistency</div>
      <div className="title-row"><h1>History</h1></div>

      <div className="stats">
        <div className="stat"><div className="v">{streak}</div><div className="l">Current streak</div></div>
        <div className="stat"><div className="v">{best}</div><div className="l">Best streak</div></div>
        <div className="stat"><div className="v">{weekFull}/7</div><div className="l">Full days · this week</div></div>
      </div>

      <div className="cal-nav">
        <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
        <div className="t">{formatMonthTitle(viewYear, viewMonth)}</div>
        <button aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div className="cal-head">
          {DAY_LETTERS.map((d, i) => <div key={i}>{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][i]}</div>)}
        </div>
        <div className="cal-grid" style={{ marginTop: 6 }}>
          {cells.map((c) => {
            const cls =
              'day' +
              (c.state === 'full' ? ' full' : c.state === 'partial' ? ' part' : c.state === 'missed' ? ' miss' : '') +
              (!c.inMonth || c.state === 'future' ? ' dim' : '') +
              (c.key === today ? ' today' : '');
            return (
              <div key={c.key} className={cls}>
                {c.day}
                {c.inMonth && c.state !== 'future' && c.state !== 'none' && <div className="cdot" />}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--blue)' }} />Full day</span>
          <span><i style={{ background: '#fff', border: '2.5px solid var(--blue)', width: 4, height: 4 }} />Partial</span>
          <span><i style={{ background: '#d1d1d6' }} />Missed</span>
        </div>
      </div>

      <div className="foot">Brightening shows in 6–12 weeks — the dots are the work.</div>
    </section>
  );
}
