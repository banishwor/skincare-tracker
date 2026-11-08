import type { Product, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  userName: 'Banishwor',
  txaDays: [0, 1, 3, 4, 5], // Mon, Tue, Thu, Fri, Sat (Mon = 0)
  blockStarts: {
    morning: '04:00',
    backHome: '12:30',
    night: '17:30',
  },
};

/**
 * The user's real routine shelf, as of the app's first launch.
 * `today` is the seed date — the Plum Toner finished "today", and both
 * queued products (PHA 3% Toner, Niacinamide) were bought on 2026-11-08,
 * so the to-buy queue seeds empty.
 */
export function seedProducts(today: string): Product[] {
  return [
    // ---- Using ----
    {
      id: 'p-sa-wash',
      name: 'Minimalist Salicylic Acid 2% Face Wash',
      brand: 'Minimalist',
      status: 'using',
      note: 'Using since Oct',
      origin: 'seed',
    },
    {
      id: 'p-vitc',
      name: 'Minimalist Vitamin C Serum',
      brand: 'Minimalist',
      status: 'using',
      note: 'Using since Oct',
      origin: 'seed',
    },
    {
      id: 'p-moist',
      name: 'Moisturizer',
      brand: '',
      status: 'using',
      note: 'Using since Oct',
      origin: 'seed',
    },
    {
      id: 'p-sunscreen',
      name: 'Sunscreen',
      brand: '',
      status: 'using',
      note: 'Using since Oct',
      origin: 'seed',
    },
    {
      id: 'p-txa',
      name: 'Minimalist Tranexamic Acid 3% Serum',
      brand: 'Minimalist',
      status: 'using',
      startedOn: '2026-10-18',
      note: 'Started 18 Oct · PM, 4–5 nights/wk',
      origin: 'seed',
    },
    {
      id: 'p-garnier',
      name: 'Garnier Vitamin C Night Cream',
      brand: 'Garnier',
      status: 'using',
      chip: 'use up',
      note: 'Night cream — alternate nights',
      origin: 'seed',
    },
    // ---- Finished ----
    {
      id: 'p-plum',
      name: 'Plum Toner',
      brand: 'Plum',
      status: 'finished',
      slot: 'toner',
      successorId: 'p-pha',
      finishedOn: today,
      note: 'Finished — replaced by PHA 3% Toner',
      origin: 'seed',
    },
    // ---- Bought 2026-11-08 (queue seeds empty) ----
    {
      id: 'p-pha',
      name: 'Minimalist PHA 3% Toner',
      brand: 'Minimalist',
      status: 'using',
      slot: 'toner',
      startedOn: '2026-11-08',
      note: 'Replaced the Plum toner',
      origin: 'seed',
    },
    {
      id: 'p-nia',
      name: 'Minimalist Niacinamide 10% Serum',
      brand: 'Minimalist',
      status: 'using',
      stepId: 'niacinamide',
      startedOn: '2026-11-08',
      note: 'Oil control + brightening',
      origin: 'seed',
    },
    // ---- Suggested (not queued) ----
    {
      id: 'p-aza',
      name: 'Azelaic Acid 10% Serum',
      brand: 'Minimalist',
      status: 'suggested',
      note: 'For uneven tone — queue after Niacinamide',
      origin: 'suggested',
    },
    {
      id: 'p-gentle',
      name: 'Gentle gel cleanser (non-SA)',
      brand: '',
      status: 'suggested',
      note: 'Alternate with the SA wash — three SA washes a day is heavy on the barrier',
      origin: 'suggested',
    },
  ];
}
