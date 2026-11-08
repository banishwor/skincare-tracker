import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  exportAll,
  getDayLog,
  getSettings,
  importAll,
  initDb,
  isBackupData,
  listProducts,
  saveDayLog,
  updateDayLog,
} from './db';
import { emptyDayLog } from '../lib/logic';

describe('database', () => {
  beforeEach(async () => {
    await db.settings.clear();
    await db.products.clear();
    await db.dayLogs.clear();
  });

  it('seeds settings and the real shelf on first init', async () => {
    await initDb();
    const settings = await getSettings();
    expect(settings.userName).toBe('Banishwor');
    expect(settings.txaDays).toEqual([0, 1, 3, 4, 5]);
    const products = await listProducts();
    const byId = new Map(products.map((p) => [p.id, p]));
    // Both products bought on 2026-11-08 seed as USING; queue is empty.
    expect(byId.get('p-pha')?.status).toBe('using');
    expect(byId.get('p-pha')?.startedOn).toBe('2026-11-08');
    expect(byId.get('p-nia')?.status).toBe('using');
    expect(products.filter((p) => p.status === 'toBuy')).toEqual([]);
    expect(byId.get('p-plum')?.status).toBe('finished');
    expect(byId.get('p-plum')?.successorId).toBe('p-pha');
    expect(byId.get('p-aza')?.status).toBe('suggested');
    // Idempotent: a second init does not duplicate.
    await initDb();
    expect(await listProducts()).toHaveLength(products.length);
  });

  it('round-trips a day log and the full backup', async () => {
    await initDb();
    const log = emptyDayLog('2026-11-08');
    log.blocks.morning.steps['sunscreen'] = 'done';
    await saveDayLog(log);
    expect((await getDayLog('2026-11-08'))?.blocks.morning.steps['sunscreen']).toBe('done');

    const backup = await exportAll();
    expect(isBackupData(backup)).toBe(true);
    await db.dayLogs.clear();
    await db.products.clear();
    await importAll(backup);
    expect((await getDayLog('2026-11-08'))?.blocks.morning.steps['sunscreen']).toBe('done');
    expect((await listProducts()).length).toBeGreaterThan(0);
  });

  it('updateDayLog composes concurrent mutations instead of overwriting', async () => {
    await initDb();
    // Two mutations fired "at once", each touching a different step.
    await Promise.all([
      updateDayLog('2026-11-08', [0, 1], (l) => {
        l.blocks.morning.steps['sunscreen'] = 'done';
        return l;
      }),
      updateDayLog('2026-11-08', [0, 1], (l) => {
        l.blocks.morning.steps['vitC'] = 'done';
        return l;
      }),
    ]);
    const log = await getDayLog('2026-11-08');
    expect(log?.blocks.morning.steps['sunscreen']).toBe('done');
    expect(log?.blocks.morning.steps['vitC']).toBe('done');
  });

  it('updateDayLog snapshots TXA days at creation and keeps them afterwards', async () => {
    await initDb();
    const created = await updateDayLog('2026-11-08', [2], (l) => l);
    expect(created.txaDays).toEqual([2]);
    // A later mutation (even called with different days) must not rewrite it.
    const again = await updateDayLog('2026-11-08', [0, 1, 3], (l) => {
      l.blocks.night.steps['faceWash'] = 'done';
      return l;
    });
    expect(again.txaDays).toEqual([2]);
    expect((await getDayLog('2026-11-08'))?.txaDays).toEqual([2]);
  });

  it('rejects foreign JSON as a backup', () => {
    expect(isBackupData({ app: 'other' })).toBe(false);
    expect(isBackupData(null)).toBe(false);
    expect(isBackupData('skin-routine')).toBe(false);
  });
});
