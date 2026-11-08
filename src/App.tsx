import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlockId, DayLog, EitherChoice, Product, Settings, StepDef, TxaOverride } from './types';
import {
  getSettings,
  initDb,
  listDayLogs,
  listProducts,
  updateDayLog,
  upsertProduct,
} from './db/db';
import {
  buildSteps,
  catchUpCandidate,
  currentBlock,
  currentStreak,
  makeDayEvaluator,
  pendingSteps,
  type CatchUpCandidate,
} from './lib/logic';
import { addDays, todayKey } from './lib/dates';
import TodayScreen from './components/TodayScreen';
import CabinetScreen from './components/CabinetScreen';
import HistoryScreen from './components/HistoryScreen';
import SettingsScreen from './components/SettingsScreen';
import CatchupModal from './components/CatchupModal';

type View = 'today' | 'cabinet' | 'history' | 'settings';

/* Tab-bar line icons: one consistent stroke style, coloured via currentColor. */
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function BottleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 2h4" />
      <path d="M10 2v3.2c0 .5-.2 1-.6 1.4C8.5 7.5 8 8.6 8 10v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9c0-1.4-.5-2.5-1.4-3.4-.4-.4-.6-.9-.6-1.4V2" />
      <path d="M8 14h8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('today');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<Map<string, DayLog>>(new Map());
  const [now, setNow] = useState(() => new Date());
  const [catchUp, setCatchUp] = useState<CatchUpCandidate | null>(null);
  // Catch-up is shown at most once per "occasion": an occasion is the
  // routine day + a foregrounding counter, so the question re-arms when
  // the routine day rolls over or the app comes back to the foreground.
  const [catchUpSession, setCatchUpSession] = useState(0);
  const catchUpShownKeyRef = useRef<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  const reloadAll = useCallback(async () => {
    await initDb();
    const [s, p, l] = await Promise.all([getSettings(), listProducts(), listDayLogs()]);
    setSettings(s);
    setProducts(p);
    setLogs(new Map(l.map((log) => [log.date, log])));
    setReady(true);
  }, []);

  useEffect(() => {
    void reloadAll();
    // Ask the browser to exempt this origin's storage from eviction —
    // without it, IndexedDB is only "best-effort" and can be cleared
    // under storage pressure. Guarded for browsers without the API.
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => undefined);
    }
  }, [reloadAll]);

  // Keep "now" fresh so the current block flips at block boundaries.
  // Returning to the foreground also re-arms the catch-up question.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setNow(new Date());
        setCatchUpSession((s) => s + 1);
      }
    };
    const onFocus = () => setCatchUpSession((s) => s + 1);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Service-worker update available (posted by the waiting worker flow in main.tsx).
  useEffect(() => {
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('sw-update-available', onUpdate);
    return () => window.removeEventListener('sw-update-available', onUpdate);
  }, []);

  const applyUpdate = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  // Day-log mutations are chained through a promise queue, and each one
  // re-reads the log from Dexie inside a transaction (updateDayLog), so a
  // rapid tick-tick-tick — or a second open tab — composes instead of the
  // last writer overwriting the others from a stale state snapshot.
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current = settings;

  const mutateLog = useCallback((date: string, fn: (log: DayLog) => DayLog) => {
    const run = async () => {
      const next = await updateDayLog(date, settingsRef.current?.txaDays, fn);
      setLogs((prev) => new Map(prev).set(date, next));
    };
    const queued = mutationQueueRef.current.then(run, run);
    mutationQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, []);

  const cur = settings ? currentBlock(now, settings) : null;
  const logDate = cur?.logDate ?? todayKey(now);
  const log = logs.get(logDate);
  const yesterdayLog = logs.get(addDays(logDate, -1));

  // Catch-up: at most once per occasion (routine day + foregrounding).
  useEffect(() => {
    if (!ready || !settings || !cur || view !== 'today') return;
    if (catchUp) return;
    const key = `${logDate}#${catchUpSession}`;
    if (catchUpShownKeyRef.current === key) return;
    const candidate = catchUpCandidate(log, logDate, cur.block, { products, settings }, yesterdayLog);
    if (candidate) {
      catchUpShownKeyRef.current = key;
      setCatchUp(candidate);
    }
  }, [ready, settings, cur, view, log, yesterdayLog, logDate, products, catchUp, catchUpSession]);

  const streak = useMemo(() => {
    if (!settings) return 0;
    return currentStreak(makeDayEvaluator(logs, products, settings), todayKey(now));
  }, [logs, products, settings, now]);

  if (!ready || !settings || !cur) {
    return (
      <div className="phone">
        <div className="loading">Loading your routine…</div>
      </div>
    );
  }

  const handleToggleStep = (block: BlockId, step: StepDef) => {
    void mutateLog(logDate, (l) => {
      const bl = l.blocks[block];
      const state = bl.steps[step.id];
      if (state === 'done') delete bl.steps[step.id];
      else bl.steps[step.id] = 'done';
      return l;
    });
  };

  const handleSkipStep = (block: BlockId, step: StepDef) => {
    void mutateLog(logDate, (l) => {
      l.blocks[block].steps[step.id] = 'skipped';
      return l;
    });
  };

  const handleEither = (block: BlockId, choice: EitherChoice | null) => {
    void mutateLog(logDate, (l) => {
      l.blocks[block].eitherChoice = choice;
      return l;
    });
  };

  const handleTxaOverride = (override: TxaOverride) => {
    void mutateLog(logDate, (l) => {
      l.txaOverride = override;
      return l;
    });
  };

  const handleCatchUpYes = () => {
    if (!catchUp) return;
    const { date, block } = catchUp;
    void mutateLog(date, (l) => {
      const ctx = { products, settings, dateKey: date, log: l };
      // Mark exactly the pending non-optional check steps the popup named —
      // never optional steps, and never invent an either/or choice.
      for (const step of pendingSteps(block, l, ctx)) {
        if (step.kind === 'check') l.blocks[block].steps[step.id] = 'done';
      }
      l.blocks[block].catchUpResolved = true;
      return l;
    });
    setCatchUp(null);
  };

  const handleCatchUpMissed = () => {
    if (!catchUp) return;
    const { date, block } = catchUp;
    void mutateLog(date, (l) => {
      const ctx = { products, settings, dateKey: date, log: l };
      for (const step of buildSteps(block, ctx)) {
        if (step.kind === 'check' && !l.blocks[block].steps[step.id]) {
          l.blocks[block].steps[step.id] = 'missed';
        }
      }
      l.blocks[block].missed = true;
      l.blocks[block].catchUpResolved = true;
      return l;
    });
    setCatchUp(null);
  };

  const updateProduct = async (id: string, patch: Partial<Product>) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const next = { ...p, ...patch };
    await upsertProduct(next);
    setProducts((prev) => prev.map((x) => (x.id === id ? next : x)));
  };

  const nextQueueOrder = () =>
    Math.max(0, ...products.filter((p) => p.status === 'toBuy').map((p) => p.queueOrder ?? 0)) + 1;

  const handleStartProduct = (id: string) =>
    void updateProduct(id, { status: 'using', startedOn: todayKey(), queueOrder: undefined });
  const handleFinishProduct = (id: string) =>
    void updateProduct(id, { status: 'finished', finishedOn: todayKey() });
  const handleQueueSuggested = (id: string) =>
    void updateProduct(id, { status: 'toBuy', queueOrder: nextQueueOrder() });
  const handleAddCustom = async (name: string, brand: string, status: 'using' | 'toBuy') => {
    const product: Product = {
      id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      brand,
      status,
      origin: 'custom',
      ...(status === 'using' ? { startedOn: todayKey() } : { queueOrder: nextQueueOrder() }),
    };
    await upsertProduct(product);
    setProducts((prev) => [...prev, product]);
  };

  return (
    <div className="phone">
      {updateReady && (
        <button className="update-banner" onClick={() => void applyUpdate()}>
          <span>✨</span>
          <span>A new version of Skin Routine is ready — tap to update.</span>
        </button>
      )}

      {view === 'today' && (
        <TodayScreen
          settings={settings}
          products={products}
          log={log}
          logDate={logDate}
          current={cur.block}
          streak={streak}
          onToggleStep={handleToggleStep}
          onSkipStep={handleSkipStep}
          onEither={handleEither}
          onTxaOverride={handleTxaOverride}
          onOpenSettings={() => setView('settings')}
        />
      )}
      {view === 'cabinet' && (
        <CabinetScreen
          products={products}
          today={todayKey(now)}
          onStart={handleStartProduct}
          onFinish={handleFinishProduct}
          onQueueSuggested={handleQueueSuggested}
          onAddCustom={(n, b, s) => void handleAddCustom(n, b, s)}
          onOpenSettings={() => setView('settings')}
        />
      )}
      {view === 'history' && (
        <HistoryScreen logs={logs} products={products} settings={settings} />
      )}
      {view === 'settings' && (
        <SettingsScreen
          settings={settings}
          onSaved={(s) => setSettings(s)}
          onImported={() => {
            catchUpShownKeyRef.current = null;
            void reloadAll().then(() => setView('today'));
          }}
          onBack={() => setView('today')}
        />
      )}

      {view !== 'settings' && (
        <nav className="tabbar">
          <button className={view === 'today' ? 'on' : ''} onClick={() => setView('today')}>
            <span className="ti"><SunIcon /></span>Today
          </button>
          <button className={view === 'cabinet' ? 'on' : ''} onClick={() => setView('cabinet')}>
            <span className="ti"><BottleIcon /></span>Cabinet
          </button>
          <button className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>
            <span className="ti"><CalendarIcon /></span>History
          </button>
        </nav>
      )}

      {catchUp && view === 'today' && (
        <CatchupModal
          candidate={catchUp}
          onYes={handleCatchUpYes}
          onMissed={handleCatchUpMissed}
          onLater={() => setCatchUp(null)}
        />
      )}
    </div>
  );
}
