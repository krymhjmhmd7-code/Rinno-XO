import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema definition
interface RinnoDB extends DBSchema {
  customers: { key: string; value: string };   // JSON string keyed by storage key
  products: { key: string; value: string };
  invoices: { key: string; value: string };
  repayments: { key: string; value: string };
  cylinderTransactions: { key: string; value: string };
  customerTypes: { key: string; value: string };
  settings: { key: string; value: string };
  recycleBin: { key: string; value: string };
  keyvalue: { key: string; value: string };    // Generic key-value store
}

const DB_NAME = 'rinno_db';
const DB_VERSION = 1;

// Storage keys matching the localStorage keys
const STORE_NAME = 'keyvalue';

let dbInstance: IDBPDatabase<RinnoDB> | null = null;

const getDB = async (): Promise<IDBPDatabase<RinnoDB>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<RinnoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create a single key-value store (mirrors localStorage API)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

  return dbInstance;
};

/**
 * IndexedDB Storage Service
 * Drop-in replacement for localStorage with much larger capacity (~50% of disk space vs 5MB)
 * All methods are async since IndexedDB is async by nature
 */
export const idbStorage = {
  /**
   * Get an item from IndexedDB
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const db = await getDB();
      const value = await db.get(STORE_NAME, key);
      return value ?? null;
    } catch (e) {
      console.error(`[idbStorage] getItem(${key}) failed:`, e);
      // Fallback to localStorage
      return localStorage.getItem(key);
    }
  },

  /**
   * Set an item in IndexedDB
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, key);
    } catch (e) {
      console.error(`[idbStorage] setItem(${key}) failed:`, e);
      // Fallback to localStorage
      try {
        localStorage.setItem(key, value);
      } catch (lsError) {
        console.error(`[idbStorage] localStorage fallback also failed (likely QuotaExceeded):`, lsError);
      }
    }
  },

  /**
   * Remove an item from IndexedDB
   */
  async removeItem(key: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, key);
    } catch (e) {
      console.error(`[idbStorage] removeItem(${key}) failed:`, e);
      localStorage.removeItem(key);
    }
  },

  /**
   * Clear all data from IndexedDB
   */
  async clear(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear(STORE_NAME);
    } catch (e) {
      console.error(`[idbStorage] clear() failed:`, e);
      localStorage.clear();
    }
  },

  /**
   * Migrate data from localStorage to IndexedDB
   * Called once on first app load to transfer existing data
   */
  async migrateFromLocalStorage(): Promise<void> {
    const migrationKey = '__rinno_idb_migrated__';
    
    // Check if already migrated
    try {
      const db = await getDB();
      const migrated = await db.get(STORE_NAME, migrationKey);
      if (migrated === 'true') return;
    } catch {
      return; // If we can't even access IDB, skip migration
    }

    console.log('[idbStorage] Migrating data from localStorage to IndexedDB...');
    
    // BUG-35 FIX: Keys must match KEYS in storage.ts (gaspro_ prefix, not rinno_)
    const keysToMigrate = [
      'gaspro_customers',
      'gaspro_products', 
      'gaspro_invoices',
      'gaspro_repayments',
      'gaspro_cylinder_transactions',
      'gaspro_customer_types',
      'gaspro_settings',
      'gaspro_recycle_bin',
      'rinno_user',
      'rinno_user_email',
      'rinno_user_name',
    ];

    let migratedCount = 0;
    for (const key of keysToMigrate) {
      const value = localStorage.getItem(key);
      if (value) {
        await idbStorage.setItem(key, value);
        migratedCount++;
      }
    }

    // Mark migration as complete
    await idbStorage.setItem(migrationKey, 'true');
    console.log(`[idbStorage] Migration complete: ${migratedCount} keys transferred`);
  },

  /**
   * Get approximate storage usage in bytes
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  },
};
