/**
 * Local-first storage using IndexedDB.
 */

import type {
  WatchedAddress,
  NormalizedTransaction,
  Category,
  ClassificationRule,
  AppPreferences,
} from '../types';

var DB_NAME = 'bchbooks';
var DB_VERSION = 1;

type StoreName =
  | 'addresses'
  | 'transactions'
  | 'categories'
  | 'rules'
  | 'preferences'
  | 'meta';

function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = function () {
      reject(req.error || new Error('Failed to open DB'));
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('addresses')) {
        db.createObjectStore('addresses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        var txStore = db.createObjectStore('transactions', { keyPath: 'id' });
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

function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, mode);
      var store = tx.objectStore(storeName);
      var result = fn(store);
      tx.oncomplete = function () {
        if (result && typeof result === 'object' && 'result' in result) {
          resolve((result as IDBRequest<T>).result as T);
        } else {
          resolve(undefined as T);
        }
      };
      tx.onerror = function () {
        reject(tx.error);
      };
      if (result && typeof result === 'object' && 'onerror' in result) {
        var req = result as IDBRequest<T>;
        req.onerror = function () {
          reject(req.error);
        };
      }
    });
  });
}

export async function ensureDefaults(): Promise<void> {
  var cats = await getAllCategories();
  if (cats.length === 0) {
    var { DEFAULT_CATEGORIES } = await import('../types');
    var now = new Date().toISOString();
    for (var i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      var c = DEFAULT_CATEGORIES[i];
      await putCategory({
        id: uid(),
        name: c.name,
        type: c.type,
        isDefault: c.isDefault,
        createdAt: now,
      });
    }
  }
  var prefs = await getPreferences();
  if (!prefs) {
    var { DEFAULT_DONATION_ADDRESS } = await import('../types');
    await setPreferences({
      key: 'app',
      fiatCurrency: 'USD',
      period: 'this_month',
      customFrom: null,
      customTo: null,
      donationAddress: DEFAULT_DONATION_ADDRESS,
    } as AppPreferences);
  }
}

export async function getAllAddresses(): Promise<WatchedAddress[]> {
  return withStore('addresses', 'readonly', function (s) {
    return s.getAll();
  });
}

export async function putAddress(addr: WatchedAddress): Promise<void> {
  await withStore('addresses', 'readwrite', function (s) {
    s.put(addr);
  });
}

export async function deleteAddress(id: string): Promise<void> {
  await withStore('addresses', 'readwrite', function (s) {
    s.delete(id);
  });
}

export async function getAllTransactions(): Promise<NormalizedTransaction[]> {
  return withStore('transactions', 'readonly', function (s) {
    return s.getAll();
  });
}

export async function getTransactionsByAddress(
  address: string
): Promise<NormalizedTransaction[]> {
  var db = await openDb();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction('transactions', 'readonly');
    var store = tx.objectStore('transactions');
    var index = store.index('by_address');
    var req = index.getAll(address);
    req.onsuccess = function () {
      resolve(req.result as NormalizedTransaction[]);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

export async function putTransaction(tx: NormalizedTransaction): Promise<void> {
  await withStore('transactions', 'readwrite', function (s) {
    s.put(tx);
  });
}

export async function putTransactions(
  txs: NormalizedTransaction[]
): Promise<void> {
  var db = await openDb();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction('transactions', 'readwrite');
    var store = tx.objectStore('transactions');
    for (var i = 0; i < txs.length; i++) {
      store.put(txs[i]);
    }
    tx.oncomplete = function () {
      resolve();
    };
    tx.onerror = function () {
      reject(tx.error);
    };
  });
}

/** Remove all local transactions for one watched address (does not touch other addresses). */
export async function deleteTransactionsForAddress(
  address: string
): Promise<void> {
  var db = await openDb();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction('transactions', 'readwrite');
    var store = tx.objectStore('transactions');
    var index = store.index('by_address');
    var req = index.openCursor(IDBKeyRange.only(address));
    req.onsuccess = function () {
      var cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = function () {
      resolve();
    };
    tx.onerror = function () {
      reject(tx.error);
    };
  });
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string | null,
  notes?: string | null
): Promise<void> {
  var db = await openDb();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction('transactions', 'readwrite');
    var store = tx.objectStore('transactions');
    var req = store.get(id);
    req.onsuccess = function () {
      var existing = req.result as NormalizedTransaction | undefined;
      if (!existing) {
        resolve();
        return;
      }
      existing.categoryId = categoryId;
      if (notes !== undefined) existing.notes = notes;
      existing.updatedAt = new Date().toISOString();
      store.put(existing);
    };
    tx.oncomplete = function () {
      resolve();
    };
    tx.onerror = function () {
      reject(tx.error);
    };
  });
}

export async function getAllCategories(): Promise<Category[]> {
  return withStore('categories', 'readonly', function (s) {
    return s.getAll();
  });
}

export async function putCategory(cat: Category): Promise<void> {
  await withStore('categories', 'readwrite', function (s) {
    s.put(cat);
  });
}

export async function getAllRules(): Promise<ClassificationRule[]> {
  return withStore('rules', 'readonly', function (s) {
    return s.getAll();
  });
}

export async function putRule(rule: ClassificationRule): Promise<void> {
  await withStore('rules', 'readwrite', function (s) {
    s.put(rule);
  });
}

export async function deleteRule(id: string): Promise<void> {
  await withStore('rules', 'readwrite', function (s) {
    s.delete(id);
  });
}

export async function getPreferences(): Promise<AppPreferences | null> {
  var row = await withStore<{ key: string; value: AppPreferences } | undefined>(
    'preferences',
    'readonly',
    function (s) {
      return s.get('app');
    }
  );
  return row && row.value ? row.value : null;
}

export async function setPreferences(prefs: AppPreferences): Promise<void> {
  await withStore('preferences', 'readwrite', function (s) {
    s.put({ key: 'app', value: prefs });
  });
}

export { uid };
