/**
 * Local-first storage using IndexedDB via a lightweight promise wrapper.
 * Structured so encrypted cloud backup can be added later.
 */

import type {
  WatchedAddress,
  NormalizedTransaction,
  Category,
  ClassificationRule,
  AppPreferences,
} from '../types';

const DB_NAME = 'bchbooks';
const DB_VERSION = 1;

type StoreName =
  | 'addresses'
  | 'transactions'
  | 'categories'
  | 'rules'
  | 'preferences'
  | 'meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('Failed to open DB'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('addresses')) {
        db.createObjectStore('addresses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by_address', 'address', { unique: false });
        txStore.createIndex('by_date', 'date', { unique: false });
        txStore.createIndex('by_category', 'categoryId', { unique: false });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('rules')) {
        db.createObjectStore('rules', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => {
      if (result && 'result' in result) {
        resolve(result.result as T);
      } else {
        resolve(undefined as T);
      }
    };
    tx.onerror = () => reject(tx.error);
    if (result && 'onerror' in result) {
      result.onerror = () => reject(result.error);
    }
  });
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureDefaults(): Promise<void> {
  const cats = await getAllCategories();
  if (cats.length === 0) {
    const { DEFAULT_CATEGORIES } = await import('../types');
    for (const c of DEFAULT_CATEGORIES) {
      await putCategory({
        id: uid(),
        ...c,
        createdAt: new Date().toISOString(),
      });
    }
  }
  const prefs = await getPreferences();
  if (!prefs) {
    const { DEFAULT_DONATION_ADDRESS } = await import('../types');
    await setPreferences({
      fiatCurrency: 'USD',
      period: 'this_month',
      customFrom: null,
      customTo: null,
      donationAddress: DEFAULT_DONATION_ADDRESS,
    });
  }
}

// --- Addresses ---
export async function getAllAddresses(): Promise<WatchedAddress[]> {
  return withStore('addresses', 'readonly', (s) => s.getAll());
}

export async function putAddress(addr: WatchedAddress): Promise<void> {
  await withStore('addresses', 'readwrite', (s) => s.put(addr));
}

export async function deleteAddress(id: string): Promise<void> {
  await withStore('addresses', 'readwrite', (s) => s.delete(id));
}

// --- Transactions ---
export async function getAllTransactions(): Promise<NormalizedTransaction[]> {
  return withStore('transactions', 'readonly', (s) => s.getAll());
}

export async function getTransactionsByAddress(
  address: string
): Promise<NormalizedTransaction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const idx = store.index('by_address');
    const req = idx.getAll(address);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putTransaction(tx: NormalizedTransaction): Promise<void> {
  await withStore('transactions', 'readwrite', (s) => s.put(tx));
}

export async function putTransactions(txs: NormalizedTransaction[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    for (const t of txs) store.put(t);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string | null,
  notes?: string | null
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.get(id);
    req.onsuccess = () => {
      const existing = req.result as NormalizedTransaction | undefined;
      if (!existing) {
        resolve();
        return;
      }
      existing.categoryId = categoryId;
      if (notes !== undefined) existing.notes = notes;
      existing.updatedAt = new Date().toISOString();
      store.put(existing);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Categories ---
export async function getAllCategories(): Promise<Category[]> {
  return withStore('categories', 'readonly', (s) => s.getAll());
}

export async function putCategory(cat: Category): Promise<void> {
  await withStore('categories', 'readwrite', (s) => s.put(cat));
}

// --- Rules ---
export async function getAllRules(): Promise<ClassificationRule[]> {
  return withStore('rules', 'readonly', (s) => s.getAll());
}

export async function putRule(rule: ClassificationRule): Promise<void> {
  await withStore('rules', 'readwrite', (s) => s.put(rule));
}

export async function deleteRule(id: string): Promise<void> {
  await withStore('rules', 'readwrite', (s) => s.delete(id));
}

// --- Preferences ---
export async function getPreferences(): Promise<AppPreferences | null> {
  const row = await withStore<{ key: string; value: AppPreferences } | undefined>(
    'preferences',
    'readonly',
    (s) => s.get('app')
  );
  return row?.value ?? null;
}

export async function setPreferences(prefs: AppPreferences): Promise<void> {
  await withStore('preferences', 'readwrite', (s) =>
    s.put({ key: 'app', value: prefs })
  );
}

export { uid };
