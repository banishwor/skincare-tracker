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
  type CatchUpCandidate,
} from './lib/logic';
import { todayKey } from './lib/dates';
import TodayScreen from './components/TodayScreen';
import CabinetScreen from './components/CabinetScreen';
import HistoryScreen from './components/HistoryScreen';
import SettingsScreen from './components/SettingsScreen';
import CatchupModal from './components/CatchupModal';

type View = 'today' | 'cabinet' | 'history' | 'settings';

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('today');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<Map<string, DayLog>>(new Map());
  const [now, setNow] = useState(() => new Date());
  const [catchUp, setCatchUp] = useState<CatchUpCandidate | null>(null);
  const catchUpShownRef = useRef(false);
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
  }, [reloadAll]);

  // Keep "now" fresh so the current block flips at block boundaries.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
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

  // Catch-up: ask once per app open, for the earliest passed block with pending steps.
  useEffect(() => {
    if (!ready || !settings || !cur || view !== 'today') return;
    if (catchUpShownRef.current || catchUp) return;
    const candidate = catchUpCandidate(log, logDate, cur.block, { products, settings });
    if (candidate) {
      catchUpShownRef.current = true;
      setCatchUp(candidate);
    }
  }, [ready, settings, cur, view, log, logDate, products, catchUp]);

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
    const block = catchUp.block;
    void mutateLog(logDate, (l) => {
      const ctx = { products, settings, dateKey: logDate, log: l };
      for (const step of buildSteps(block, ctx)) {
        if (step.kind === 'either') {
          if (!l.blocks[block].eitherChoice) l.blocks[block].eitherChoice = 'moisturizer';
        } else if (!l.blocks[block].steps[step.id]) {
          l.blocks[block].steps[step.id] = 'done';
        }
      }
      l.blocks[block].catchUpResolved = true;
      return l;
    });
    setCatchUp(null);
  };

  const handleCatchUpMissed = () => {
    if (!catchUp) return;
    const block = catchUp.block;
    void mutateLog(logDate, (l) => {
      const ctx = { products, settings, dateKey: logDate, log: l };
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
            catchUpShownRef.current = false;
            void reloadAll().then(() => setView('today'));
          }}
          onBack={() => setView('today')}
        />
      )}

      {view !== 'settings' && (
        <nav className="tabbar">
          <button className={view === 'today' ? 'on' : ''} onClick={() => setView('today')}>
            <span className="ti">☀️</span>Today
          </button>
          <button className={view === 'cabinet' ? 'on' : ''} onClick={() => setView('cabinet')}>
            <span className="ti">🧴</span>Cabinet
          </button>
          <button className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>
            <span className="ti">📅</span>History
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
