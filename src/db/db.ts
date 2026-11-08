import Dexie, { type Table } from 'dexie';
import type { DayLog, Product, Settings } from '../types';
import { DEFAULT_SETTINGS, seedProducts } from '../lib/seed';
import { todayKey } from '../lib/dates';

interface SettingsRow extends Settings {
  id: string;
}

export interface BackupData {
  app: 'skin-routine';
  version: 1;
  exportedAt: string;
  settings: Settings;
  products: Product[];
  dayLogs: DayLog[];
}

class SkinRoutineDb extends Dexie {
  settings!: Table<SettingsRow, string>;
  products!: Table<Product, string>;
  dayLogs!: Table<DayLog, string>;

  constructor() {
    super('skin-routine');
    this.version(1).stores({
      settings: 'id',
      products: 'id, status',
      dayLogs: 'date',
    });
  }
}

export const db = new SkinRoutineDb();

const SETTINGS_ID = 'app';

/** Seed settings + products on first launch. Safe to call repeatedly. */
export async function initDb(): Promise<void> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (existing) return;
  const today = todayKey();
  await db.transaction('rw', db.settings, db.products, async () => {
    await db.settings.put({ id: SETTINGS_ID, ...structuredClone(DEFAULT_SETTINGS) });
    const count = await db.products.count();
    if (count === 0) {
      await db.products.bulkPut(seedProducts(today));
    }
  });
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  const { id: _id, ...settings } = row;
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ id: SETTINGS_ID, ...settings });
}

export async function listProducts(): Promise<Product[]> {
  return db.products.toArray();
}

export async function upsertProduct(product: Product): Promise<void> {
  await db.products.put(product);
}

export async function getDayLog(date: string): Promise<DayLog | undefined> {
  return db.dayLogs.get(date);
}

export async function saveDayLog(log: DayLog): Promise<void> {
  await db.dayLogs.put(log);
}

export async function listDayLogs(): Promise<DayLog[]> {
  return db.dayLogs.toArray();
}

export async function exportAll(): Promise<BackupData> {
  const settings = await getSettings();
  const products = await listProducts();
  const dayLogs = await listDayLogs();
  return {
    app: 'skin-routine',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    products,
    dayLogs,
  };
}

export function isBackupData(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Partial<BackupData>;
  return (
    d.app === 'skin-routine' &&
    typeof d.settings === 'object' &&
    d.settings !== null &&
    Array.isArray(d.products) &&
    Array.isArray(d.dayLogs)
  );
}

/** Replace the entire database with a backup's contents. */
export async function importAll(data: BackupData): Promise<void> {
  await db.transaction('rw', db.settings, db.products, db.dayLogs, async () => {
    await db.settings.clear();
    await db.products.clear();
    await db.dayLogs.clear();
    await db.settings.put({ id: SETTINGS_ID, ...data.settings });
    if (data.products.length > 0) await db.products.bulkPut(data.products);
    if (data.dayLogs.length > 0) await db.dayLogs.bulkPut(data.dayLogs);
  });
}
