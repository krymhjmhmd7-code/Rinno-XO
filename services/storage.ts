import { Customer, Product, Invoice, AppSettings, Repayment, CylinderTransaction, SoftDeletedRecord } from '../types';
import { dataService, userService, isDatabaseConfigured } from './dbService';
import { idbStorage } from './idbStorage';
import * as XLSX from 'xlsx';


const KEYS = {
  CUSTOMERS: 'gaspro_customers',
  PRODUCTS: 'gaspro_products',
  INVOICES: 'gaspro_invoices',
  REPAYMENTS: 'gaspro_repayments',
  CYLINDER_TX: 'gaspro_cylinder_transactions',
  CUSTOMER_TYPES: 'gaspro_customer_types',
  SETTINGS: 'gaspro_settings',
  RECYCLE_BIN: 'gaspro_recycle_bin',
};

/**
 * Write-through helper: writes to localStorage (sync cache) AND IndexedDB (durable store)
 * localStorage is used for fast synchronous reads, IndexedDB for capacity
 */
const persistItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[storage] localStorage.setItem(${key}) failed (likely QuotaExceeded). Data saved to IndexedDB only.`);
  }
  // Async write to IndexedDB (fire and forget)
  idbStorage.setItem(key, value).catch(err =>
    console.error(`[storage] idbStorage.setItem(${key}) failed:`, err)
  );
};



// Initial Seed Data - Empty for production use
const seedCustomers: Customer[] = [];

const seedProducts: Product[] = [];

const defaultCustomerTypes = [
  'غير مصنف',
  'مستشفى',
  'مركز طبي',
  'مستوصف',
  'فرد',
  'شركة',
  'مجمع سكني',
  'مطعم'
];

/**
 * Helper to safely sync or mark as needed
 */
/**
 * Helper to safely sync to DB
 */
const syncToDb = async (type: string, data: any) => {
  if (!isDatabaseConfigured()) {
    markSyncNeeded();
    return;
  }

  try {
    let result = false;
    switch (type) {
      case 'customers':
        result = await dataService.saveAllCustomers(data);
        break;
      case 'products':
        result = await dataService.saveAllProducts(data);
        break;
      case 'invoices': {
        // BUG-18 FIX: Sync invoices to cloud (loop with INSERT OR REPLACE)
        const invoiceArr = Array.isArray(data) ? data : [];
        for (const inv of invoiceArr) {
          await dataService.addInvoice(inv);
        }
        result = true;
        break;
      }
      case 'repayments': {
        // BUG-18 FIX: Sync repayments to cloud
        const repArr = Array.isArray(data) ? data : [];
        for (const rep of repArr) {
          await dataService.addRepayment(rep);
        }
        result = true;
        break;
      }
      case 'cylinder_transactions': {
        // BUG-18 FIX: Sync cylinder transactions to cloud
        const txArr = Array.isArray(data) ? data : [];
        for (const tx of txArr) {
          await dataService.addCylinderTransaction(tx);
        }
        result = true;
        break;
      }
      case 'settings':
        // Settings sync not fully implemented in DB yet, skipping
        result = true;
        break;
      default:
        console.warn('Unknown sync type:', type);
        result = true;
    }

    if (!result) markSyncNeeded();
    else markSyncDone();
  } catch (e) {
    console.error(`Sync failed for ${type}:`, e);
    markSyncNeeded();
  }
};

const markSyncNeeded = () => {
  const current = storageService.getSettings();
  if (!current.needsSync) {
    current.needsSync = true;
    persistItem(KEYS.SETTINGS, JSON.stringify(current));
  }
};

const markSyncDone = () => {
  const current = storageService.getSettings();
  if (current.needsSync) {
    current.needsSync = false;
    persistItem(KEYS.SETTINGS, JSON.stringify(current));
  }
};

// Helper to merge local and cloud records by ID using timestamps
// BUG-3 FIX: Respects soft-delete — local deletion always wins over cloud non-deleted
const mergeById = <T extends { id: string; updatedAt?: string; isDeleted?: boolean }>(local: T[], cloud: T[]): T[] => {
    const merged = new Map<string, T>();
    // Add all cloud items first
    for (const item of cloud) {
        merged.set(item.id, item);
    }
    // Merge local items: keep whichever has the newer updatedAt
    for (const item of local) {
        const existing = merged.get(item.id);
        if (!existing) {
            merged.set(item.id, item);
        } else {
            // Priority rule: if local is deleted but cloud is not, ALWAYS keep local (preserve deletion)
            if (item.isDeleted && !existing.isDeleted) {
                merged.set(item.id, item);
                continue;
            }
            // BUG-44 ROOT FIX: If cloud is deleted but local is not, compare timestamps.
            // The local copy may have been RESTORED from recycle bin (with a newer updatedAt).
            // Old code blindly kept cloud deletion, reversing any local restore on next sync!
            if (existing.isDeleted && !item.isDeleted) {
                const localTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
                const cloudTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                if (localTime >= cloudTime) {
                    merged.set(item.id, item); // Local restore is newer — honor it
                }
                continue;
            }
            // Otherwise compare timestamps as before
            const localTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
            const cloudTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (localTime >= cloudTime) {
                merged.set(item.id, item);
            }
        }
    }
    return Array.from(merged.values());
};

export const storageService = {
  // Expose for offline recovery
  hasPendingChanges: (): boolean => {
    return storageService.getSettings().needsSync || false;
  },

  getAllData: () => {
    return {
      customers: storageService.getCustomers(),
      products: storageService.getProducts(),
      invoices: storageService.getInvoices(),
      repayments: storageService.getRepayments(),
      cylinderTransactions: storageService.getCylinderTransactions(),
      customerTypes: storageService.getCustomerTypes(),
      settings: storageService.getSettings()
    };
  },


  getSettings: (): AppSettings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : {};
  },

  saveSettings: (settings: AppSettings) => {
    persistItem(KEYS.SETTINGS, JSON.stringify(settings));
    // optionally sync settings to DB if table exists (it does)
  },

  getCustomerTypes: (): string[] => {
    const data = localStorage.getItem(KEYS.CUSTOMER_TYPES);
    return data ? JSON.parse(data) : defaultCustomerTypes;
  },

  saveCustomerTypes: (types: string[]) => {
    persistItem(KEYS.CUSTOMER_TYPES, JSON.stringify(types));
  },

  // Recalculate all customer balances from invoices and repayments
  recalculateCustomerBalances: (): void => {
    const customersData = localStorage.getItem(KEYS.CUSTOMERS);
    if (!customersData) return;

    let customers: Customer[] = JSON.parse(customersData);
    // BUG-1 FIX: Filter out soft-deleted invoices/repayments to avoid counting deleted transactions
    const invoices: Invoice[] = (JSON.parse(localStorage.getItem(KEYS.INVOICES) || '[]') as Invoice[]).filter(i => !i.isDeleted);
    const repayments: Repayment[] = (JSON.parse(localStorage.getItem(KEYS.REPAYMENTS) || '[]') as Repayment[]).filter(r => !r.isDeleted);

    let hasChanges = false;

    customers = customers.map(customer => {
      // BUG-17 FIX: Skip soft-deleted customers — don't modify their balances
      if (customer.isDeleted) return customer;

      // Calculate balance from invoices (debt amounts only)
      const invoiceDebt = invoices
        .filter(inv => inv.customerId === customer.id)
        .reduce((sum, inv) => sum + (inv.paymentDetails?.debt || 0), 0);

      // BUG-24 FIX: Calculate totalPurchases excluding manual-debt entries
      const totalPurchases = invoices
        .filter(inv => inv.customerId === customer.id && inv.items?.[0]?.productId !== 'manual-debt')
        .reduce((sum, inv) => sum + inv.totalAmount, 0);

      // Calculate payments from repayments
      const totalRepayments = repayments
        .filter(rep => rep.customerId === customer.id)
        .reduce((sum, rep) => sum + rep.amount, 0);

      const correctBalance = invoiceDebt - totalRepayments;

      if (customer.balance !== correctBalance || customer.totalPurchases !== totalPurchases) {
        console.log(`Correcting balance for ${customer.name}: ${customer.balance} -> ${correctBalance}, purchases: ${customer.totalPurchases} -> ${totalPurchases}`);
        hasChanges = true;
        return { ...customer, balance: correctBalance, totalPurchases };
      }
      return customer;
    });

    if (hasChanges) {
      persistItem(KEYS.CUSTOMERS, JSON.stringify(customers));
      console.log('Customer balances recalculated and corrected.');
    }
  },


  getCustomers: (): Customer[] => {
    const data = localStorage.getItem(KEYS.CUSTOMERS);
    let customers: Customer[] = data ? JSON.parse(data) : seedCustomers;

    // Migration: Assign serial numbers if missing & initialize cylinderBalance
    let updated = false;
    let maxSerial = 0;

    // First pass to find max serial
    customers.forEach(c => {
      if (c.serialNumber && c.serialNumber > maxSerial) {
        maxSerial = c.serialNumber;
      }
    });

    // Second pass to assign missing serials and fields
    customers = customers.map((c, index) => {
      let modified = false;
      const newC = { ...c };

      if (!newC.serialNumber) {
        maxSerial++;
        newC.serialNumber = maxSerial;
        modified = true;
      }

      if (!newC.cylinderBalance) {
        newC.cylinderBalance = {};
        modified = true;
      }

      // Remove specialPrices if exists (cleanup)
      if ((newC as any).specialPrices) {
        delete (newC as any).specialPrices;
        modified = true;
      }

      if (modified) updated = true;
      return newC;
    });

    if (updated) {
      persistItem(KEYS.CUSTOMERS, JSON.stringify(customers));
    }

    // Filter out soft-deleted customers
    return customers.filter(c => !c.isDeleted);
  },

  // Raw getter (includes soft-deleted) for sync and recycle bin
  getAllCustomersRaw: (): Customer[] => {
    const data = localStorage.getItem(KEYS.CUSTOMERS);
    return data ? JSON.parse(data) : [];
  },

  saveCustomers: (customers: Customer[]) => {
    // Preserve soft-deleted records: merge incoming active customers with existing deleted ones
    const existing = storageService.getAllCustomersRaw();
    const deletedRecords = existing.filter((c: Customer) => c.isDeleted);
    const merged = [...customers.filter(c => !c.isDeleted), ...deletedRecords];
    persistItem(KEYS.CUSTOMERS, JSON.stringify(merged));
    syncToDb('customers', merged);
  },

  getProducts: (): Product[] => {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    let products = data ? JSON.parse(data) : seedProducts;

    // Migration: Add isActive if missing
    products = products.map((p: Product) => ({
      ...p,
      isActive: p.isActive !== undefined ? p.isActive : true
    }));

    // Filter out soft-deleted products
    return products.filter((p: Product) => !p.isDeleted);
  },

  getAllProductsRaw: (): Product[] => {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
  },

  saveProducts: (products: Product[]) => {
    // Preserve soft-deleted records
    const existing = storageService.getAllProductsRaw();
    const deletedRecords = existing.filter((p: Product) => p.isDeleted);
    const merged = [...products.filter(p => !p.isDeleted), ...deletedRecords];
    persistItem(KEYS.PRODUCTS, JSON.stringify(merged));
    syncToDb('products', merged);
  },

  getInvoices: (): Invoice[] => {
    const data = localStorage.getItem(KEYS.INVOICES);
    const invoices: Invoice[] = data ? JSON.parse(data) : [];
    return invoices.filter(i => !i.isDeleted);
  },

  getAllInvoicesRaw: (): Invoice[] => {
    const data = localStorage.getItem(KEYS.INVOICES);
    return data ? JSON.parse(data) : [];
  },

  saveInvoices: (invoices: Invoice[]) => {
    persistItem(KEYS.INVOICES, JSON.stringify(invoices));
    // BUG-49 FIX: Ensure cloud sync when invoices are saved directly
    syncToDb('invoices', invoices);
  },

  addInvoice: (invoice: Invoice) => {
    // 1. Save Invoice — BUG-2 FIX: use raw getter to preserve soft-deleted records
    const invoices = storageService.getAllInvoicesRaw();
    invoices.unshift(invoice);
    persistItem(KEYS.INVOICES, JSON.stringify(invoices));

    // 2. Update Customer Stats & Balance
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === invoice.customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];

      // Update Total Purchases
      customer.totalPurchases = (customer.totalPurchases || 0) + invoice.totalAmount;

      // Update Balance logic:
      if (invoice.paymentDetails && invoice.paymentDetails.debt !== 0) {
        customer.balance = (customer.balance || 0) + invoice.paymentDetails.debt;
      }

      // Save updated customer array back to storage
      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }

    if (isDatabaseConfigured()) {
      dataService.addInvoice(invoice)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  deleteInvoice: (id: string, customerId: string) => {
    // 1. Get the invoice to revert customer stats
    const invoices = storageService.getInvoices();
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;

    // 2. Soft-delete the invoice (marks it in-place)
    storageService.moveToRecycleBin('invoice', invoice, `فاتورة - ${invoice.customerName} - ${invoice.totalAmount} شيكل`);

    // 3. BUG-43 FIX: Use recalculate instead of manual arithmetic to prevent negative/wrong balances
    storageService.recalculateCustomerBalances();
  },

  updateInvoiceDate: (id: string, newDate: string) => {
    // BUG-5 FIX: use raw getter to preserve soft-deleted records
    const invoices = storageService.getAllInvoicesRaw();
    const invoiceIndex = invoices.findIndex(i => i.id === id);
    if (invoiceIndex === -1) return;

    invoices[invoiceIndex].date = newDate;
    invoices[invoiceIndex].updatedAt = new Date().toISOString();
    persistItem(KEYS.INVOICES, JSON.stringify(invoices));

    if (isDatabaseConfigured()) {
      dataService.updateInvoiceDate(id, newDate)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  // Helper to add a manual debt (e.g., old balance)
  addManualDebt: (customerId: string, customerName: string, amount: number, note: string) => {
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      customerId,
      customerName,
      date: new Date().toISOString(),
      items: [{
        productId: 'manual-debt',
        productName: `رصيد سابق / دين يدوي: ${note}`,
        quantity: 1,
      }],
      totalAmount: amount,
      status: 'debt',
      paymentDetails: {
        cash: 0,
        cheque: 0,
        debt: amount
      },
      updatedAt: new Date().toISOString()
    };
    storageService.addInvoice(invoice);
  },

  getRepayments: (): Repayment[] => {
    const data = localStorage.getItem(KEYS.REPAYMENTS);
    const repayments: Repayment[] = data ? JSON.parse(data) : [];
    return repayments.filter(r => !r.isDeleted);
  },

  getAllRepaymentsRaw: (): Repayment[] => {
    const data = localStorage.getItem(KEYS.REPAYMENTS);
    return data ? JSON.parse(data) : [];
  },

  addRepayment: (repayment: Repayment) => {
    // 1. Save Repayment Record — BUG-2 FIX: use raw getter to preserve soft-deleted records
    const repayments = storageService.getAllRepaymentsRaw();
    repayments.unshift(repayment);
    persistItem(KEYS.REPAYMENTS, JSON.stringify(repayments));

    // 2. Update Customer Balance
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === repayment.customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];
      // Reduce balance (Debt decreases)
      customer.balance = (customer.balance || 0) - repayment.amount;

      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }

    if (isDatabaseConfigured()) {
      dataService.addRepayment(repayment)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  deleteRepayment: (id: string, customerId: string) => {
    // 1. Get the repayment to revert customer stats
    const repayments = storageService.getRepayments();
    const repayment = repayments.find(r => r.id === id);
    if (!repayment) return;

    // 2. Soft-delete the repayment (marks it in-place)
    storageService.moveToRecycleBin('repayment', repayment, `سداد ${repayment.amount} شيكل - ${repayment.customerName}`);

    // 3. BUG-43 FIX: Use recalculate instead of manual arithmetic
    storageService.recalculateCustomerBalances();
  },

  updateRepaymentDate: (id: string, newDate: string) => {
    // BUG-5 FIX: use raw getter to preserve soft-deleted records
    const repayments = storageService.getAllRepaymentsRaw();
    const index = repayments.findIndex(r => r.id === id);
    if (index === -1) return;

    repayments[index].date = newDate;
    repayments[index].updatedAt = new Date().toISOString();
    persistItem(KEYS.REPAYMENTS, JSON.stringify(repayments));

    if (isDatabaseConfigured()) {
      dataService.updateRepaymentDate(id, newDate)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  // --- Cylinder Transactions ---
  getCylinderTransactions: (): CylinderTransaction[] => {
    const data = localStorage.getItem(KEYS.CYLINDER_TX);
    const txs: CylinderTransaction[] = data ? JSON.parse(data) : [];
    return txs.filter(t => !t.isDeleted);
  },

  getAllCylinderTransactionsRaw: (): CylinderTransaction[] => {
    const data = localStorage.getItem(KEYS.CYLINDER_TX);
    return data ? JSON.parse(data) : [];
  },

  addCylinderTransaction: (tx: CylinderTransaction) => {
    // 1. Save Transaction — BUG-2 FIX: use raw getter to preserve soft-deleted records
    const transactions = storageService.getAllCylinderTransactionsRaw();
    transactions.unshift(tx);
    persistItem(KEYS.CYLINDER_TX, JSON.stringify(transactions));

    // 2. Update Customer Cylinder Balance
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === tx.customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];
      if (!customer.cylinderBalance) customer.cylinderBalance = {};

      const currentVal = customer.cylinderBalance[tx.productName] || 0;

      if (tx.type === 'out') {
        // "Out" means given to customer -> He owes more
        customer.cylinderBalance[tx.productName] = currentVal + tx.quantity;
      } else {
        // "In" means returned by customer -> He owes less
        customer.cylinderBalance[tx.productName] = currentVal - tx.quantity;
      }

      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }

    if (isDatabaseConfigured()) {
      dataService.addCylinderTransaction(tx)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  deleteCylinderTransaction: (id: string, customerId: string) => {
    // 1. Get the transaction to revert customer stats
    const transactions = storageService.getCylinderTransactions();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    // 2. Soft-delete the transaction (marks it in-place)
    storageService.moveToRecycleBin('cylinder_transaction', tx, `${tx.type === 'out' ? 'إعارة' : 'إرجاع'} ${tx.quantity} ${tx.productName} - ${tx.customerName}`);

    // 3. BUG-42 FIX: Revert cylinder balance using safe recalculation
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];
      if (!customer.cylinderBalance) customer.cylinderBalance = {};

      const currentVal = customer.cylinderBalance[tx.productName] || 0;

      if (tx.type === 'out') {
        customer.cylinderBalance[tx.productName] = Math.max(0, currentVal - tx.quantity);
      } else {
        customer.cylinderBalance[tx.productName] = currentVal + tx.quantity;
      }

      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }
  },

  updateCylinderTransactionDate: (id: string, newDate: string) => {
    // BUG-6 FIX: use raw getter to preserve soft-deleted records
    const transactions = storageService.getAllCylinderTransactionsRaw();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;

    transactions[index].date = newDate;
    transactions[index].updatedAt = new Date().toISOString();
    persistItem(KEYS.CYLINDER_TX, JSON.stringify(transactions));

    if (isDatabaseConfigured()) {
      dataService.updateCylinderTransactionDate(id, newDate)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  // NEW: Sync all data from DB to LocalStorage
  syncAllFromDb: async () => {
    if (!isDatabaseConfigured()) return false;

    try {
      const { dataService } = await import('./dbService');

      // 1. Check for Global Reset Signal (safe: no auto-wipe)
      const serverResetTime = await dataService.getResetTimestamp();
      const localResetTime = localStorage.getItem('last_reset_timestamp');

      if (serverResetTime && serverResetTime !== localResetTime) {
        console.warn('Detected remote factory reset signal. Updating timestamp only (local data preserved).');
        persistItem('last_reset_timestamp', serverResetTime);
      }

      // 2. Customers - Smart Merge
      const dbCustomers = await dataService.getCustomers();
      const localCustomers: any[] = JSON.parse(localStorage.getItem(KEYS.CUSTOMERS) || '[]');
      const mergedCustomers = mergeById(localCustomers, dbCustomers);
      persistItem(KEYS.CUSTOMERS, JSON.stringify(mergedCustomers));

      // 3. Products - Smart Merge
      const dbProducts = await dataService.getProducts();
      const localProducts: any[] = JSON.parse(localStorage.getItem(KEYS.PRODUCTS) || '[]');
      const mergedProducts = mergeById(localProducts, dbProducts);
      persistItem(KEYS.PRODUCTS, JSON.stringify(mergedProducts));

      // 4. Invoices - Smart Merge
      const dbInvoices = await dataService.getInvoices();
      const localInvoices: any[] = JSON.parse(localStorage.getItem(KEYS.INVOICES) || '[]');
      const mergedInvoices = mergeById(localInvoices, dbInvoices);
      persistItem(KEYS.INVOICES, JSON.stringify(mergedInvoices));

      // 5. Repayments - Smart Merge
      const dbRepayments = await dataService.getRepayments();
      const localRepayments: any[] = JSON.parse(localStorage.getItem(KEYS.REPAYMENTS) || '[]');
      const mergedRepayments = mergeById(localRepayments, dbRepayments);
      persistItem(KEYS.REPAYMENTS, JSON.stringify(mergedRepayments));

      // 6. Cylinder Tx - Smart Merge
      const dbTx = await dataService.getCylinderTransactions();
      const localTx: any[] = JSON.parse(localStorage.getItem(KEYS.CYLINDER_TX) || '[]');
      const mergedTx = mergeById(localTx, dbTx);
      persistItem(KEYS.CYLINDER_TX, JSON.stringify(mergedTx));

      // 7. Push merged data back to cloud
      // BUG-23 FIX: Push ALL entity types back to cloud, not just customers/products
      try {
        if (mergedCustomers.length > 0) await dataService.saveAllCustomers(mergedCustomers);
        if (mergedProducts.length > 0) await dataService.saveAllProducts(mergedProducts);
        for (const inv of mergedInvoices) { await dataService.addInvoice(inv); }
        for (const rep of mergedRepayments) { await dataService.addRepayment(rep); }
        for (const tx of mergedTx) { await dataService.addCylinderTransaction(tx); }
      } catch (pushErr) {
        console.warn('Failed to push merged data to cloud:', pushErr);
      }

      console.log('Active Sync: Data loaded from Turso successfully');
      return true;
    } catch (e) {
      console.error('Failed to sync from DB:', e);
      return false;
    }
  },

  // NEW: Push all local data to Turso (Migration/Force Sync)
  syncAllToDb: async () => {
    if (!isDatabaseConfigured()) return false;

    try {
      const { initializeDatabase } = await import('./dbService');
      await initializeDatabase();

      // BUG-7 FIX: use raw getters to include soft-deleted records in cloud sync
      // 1. Customers
      const customers = storageService.getAllCustomersRaw();
      await dataService.saveAllCustomers(customers);

      // 2. Products
      const products = storageService.getAllProductsRaw();
      await dataService.saveAllProducts(products);

      // 3. Invoices (uses INSERT OR REPLACE)
      const invoices = storageService.getAllInvoicesRaw();
      for (const inv of invoices) {
        await dataService.addInvoice(inv);
      }

      // 4. Repayments
      const repayments = storageService.getAllRepaymentsRaw();
      for (const rep of repayments) {
        await dataService.addRepayment(rep);
      }

      // 5. Cylinder Tx
      const txs = storageService.getAllCylinderTransactionsRaw();
      for (const tx of txs) {
        await dataService.addCylinderTransaction(tx);
      }

      console.log('Active Sync: Data pushed to Turso successfully');
      // BUG-51 FIX: Clear the sync-needed flag after successful push
      markSyncDone();
      return true;
    } catch (e) {
      console.error('Failed to sync to DB:', e);
      return false;
    }
  },

  // Factory Reset (Clear Local & Remote)
  factoryReset: async () => {
    try {
      // 1. Clear Remote DB
      if (isDatabaseConfigured()) {
        const { dataService } = await import('./dbService');
        await dataService.clearDatabase();
      }

      // 2. Clear ALL Local Storage — BUG-22 FIX: clear everything including session/recycle/types
      localStorage.removeItem(KEYS.CUSTOMERS);
      localStorage.removeItem(KEYS.PRODUCTS);
      localStorage.removeItem(KEYS.INVOICES);
      localStorage.removeItem(KEYS.REPAYMENTS);
      localStorage.removeItem(KEYS.CYLINDER_TX);
      localStorage.removeItem(KEYS.SETTINGS);
      localStorage.removeItem(KEYS.CUSTOMER_TYPES);
      localStorage.removeItem(KEYS.RECYCLE_BIN);
      localStorage.removeItem('rinno_user');
      localStorage.removeItem('rinno_user_email');
      localStorage.removeItem('rinno_draft_cart');
      localStorage.removeItem('last_reset_timestamp');

      console.log('Factory Reset Complete');
      return true;
    } catch (e) {
      console.error('Factory Reset Failed:', e);
      return false;
    }
  },

  // Export Functions
  exportDatabaseToJSON: () => {
    // BUG-8 FIX: use raw getters to include soft-deleted records in backup
    const data = {
      customers: storageService.getAllCustomersRaw(),
      products: storageService.getAllProductsRaw(),
      invoices: storageService.getAllInvoicesRaw(),
      repayments: storageService.getAllRepaymentsRaw(),
      cylinderTransactions: storageService.getAllCylinderTransactionsRaw(),
      customerTypes: storageService.getCustomerTypes(),
      settings: storageService.getSettings(),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gaspro_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    // BUG-14 FIX: Release ObjectURL to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  exportDatabaseToExcel: (returnFile: boolean = false) => {

    // BUG-30 FIX: use raw getters to include soft-deleted records in Excel backup (consistent with JSON export)
    const customers = storageService.getAllCustomersRaw();
    const products = storageService.getAllProductsRaw();
    const invoices = storageService.getAllInvoicesRaw();
    const repayments = storageService.getAllRepaymentsRaw();
    const cylinderTx = storageService.getAllCylinderTransactionsRaw();

    // Flatten Invoices for CSV friendly format
    const flattenedInvoices = invoices.map(inv => ({
      InvoiceID: inv.id,
      Date: new Date(inv.date).toLocaleDateString('en-US'),
      Customer: inv.customerName,
      Total: inv.totalAmount,
      PaidCash: inv.paymentDetails.cash,
      PaidCheque: inv.paymentDetails.cheque,
      Debt: inv.paymentDetails.debt,
      Items: inv.items.map(i => `${i.productName} (${i.quantity})`).join(', ')
    }));

    const wb = XLSX.utils.book_new();
    const wsCustomers = XLSX.utils.json_to_sheet(customers);
    XLSX.utils.book_append_sheet(wb, wsCustomers, "الزبائن");
    const wsProducts = XLSX.utils.json_to_sheet(products);
    XLSX.utils.book_append_sheet(wb, wsProducts, "المنتجات");
    const wsInvoices = XLSX.utils.json_to_sheet(flattenedInvoices);
    XLSX.utils.book_append_sheet(wb, wsInvoices, "الفواتير");
    const wsRepayments = XLSX.utils.json_to_sheet(repayments);
    XLSX.utils.book_append_sheet(wb, wsRepayments, "سجل السداد");
    const wsCylinderTx = XLSX.utils.json_to_sheet(cylinderTx);
    XLSX.utils.book_append_sheet(wb, wsCylinderTx, "حركات الاسطوانات");

    // Update Last Backup Date
    const todayStr = new Date().toISOString();
    const settings = storageService.getSettings();
    storageService.saveSettings({ ...settings, lastBackupDate: todayStr });

    // File Name
    const fileName = `rinno_backup_${todayStr.split('T')[0]}.xlsx`;

    // Return File Object for Sharing API
    if (returnFile) {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new File([wbout], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // Default: Download
    XLSX.writeFile(wb, fileName);
    return null;
  },

  importDatabaseFromJSON: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);

      // Schema validation
      if (!data.customers || !data.products || !data.invoices) {
        console.error('Import failed: missing required keys (customers, products, invoices)');
        return false;
      }

      // Validate arrays
      if (!Array.isArray(data.customers) || !Array.isArray(data.products) || !Array.isArray(data.invoices)) {
        console.error('Import failed: customers, products, invoices must be arrays');
        return false;
      }

      // Validate each customer has required fields
      const validCustomers = data.customers.every((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string');
      if (!validCustomers) {
        console.error('Import failed: invalid customer data structure');
        return false;
      }

      // Validate each product has required fields
      const validProducts = data.products.every((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string');
      if (!validProducts) {
        console.error('Import failed: invalid product data structure');
        return false;
      }

      // Validate each invoice has required fields
      const validInvoices = data.invoices.every((i: any) => i && typeof i.id === 'string' && typeof i.customerId === 'string');
      if (!validInvoices) {
        console.error('Import failed: invalid invoice data structure');
        return false;
      }

      persistItem(KEYS.CUSTOMERS, JSON.stringify(data.customers));
      persistItem(KEYS.PRODUCTS, JSON.stringify(data.products));
      persistItem(KEYS.INVOICES, JSON.stringify(data.invoices));

      if (Array.isArray(data.repayments)) {
        persistItem(KEYS.REPAYMENTS, JSON.stringify(data.repayments));
      }

      if (Array.isArray(data.cylinderTransactions)) {
        persistItem(KEYS.CYLINDER_TX, JSON.stringify(data.cylinderTransactions));
      }

      if (Array.isArray(data.customerTypes)) {
        persistItem(KEYS.CUSTOMER_TYPES, JSON.stringify(data.customerTypes));
      }

      if (data.settings && typeof data.settings === 'object') {
        persistItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      }

      // BUG-38 FIX: Recalculate balances after import to ensure consistency
      storageService.recalculateCustomerBalances();

      // Mark sync needed so next sync pushes imported data to cloud
      markSyncNeeded();

      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  // --- Recycle Bin (Soft Delete) ---
  getCurrentUserEmail: (): string => {
    try {
      return localStorage.getItem('rinno_user_email') || 'غير معروف';
    } catch { return 'غير معروف'; }
  },

  /**
   * Soft-delete: marks a record with isDeleted=true in its own collection.
   * No separate recycle bin store needed.
   */
  moveToRecycleBin: (type: string, data: any, description: string) => {
    const now = new Date().toISOString();
    const deletedBy = storageService.getCurrentUserEmail();

    const markDeleted = (record: any) => ({
      ...record,
      isDeleted: true,
      deletedAt: now,
      deletedBy,
      _deleteDescription: description, // stored for RecycleBin UI
      updatedAt: now,
    });

    switch (type) {
      case 'customer': {
        const all = storageService.getAllCustomersRaw();
        const idx = all.findIndex((c: any) => c.id === data.id);
        if (idx !== -1) {
          all[idx] = markDeleted(all[idx]);
          persistItem(KEYS.CUSTOMERS, JSON.stringify(all));
          syncToDb('customers', all);
        }
        break;
      }
      case 'product': {
        const all = storageService.getAllProductsRaw();
        const idx = all.findIndex((p: any) => p.id === data.id);
        if (idx !== -1) {
          all[idx] = markDeleted(all[idx]);
          persistItem(KEYS.PRODUCTS, JSON.stringify(all));
          syncToDb('products', all);
        }
        break;
      }
      case 'invoice': {
        const all = storageService.getAllInvoicesRaw();
        const idx = all.findIndex((i: any) => i.id === data.id);
        if (idx !== -1) {
          all[idx] = markDeleted(all[idx]);
          persistItem(KEYS.INVOICES, JSON.stringify(all));
          syncToDb('invoices', all);
        }
        break;
      }
      case 'repayment': {
        const all = storageService.getAllRepaymentsRaw();
        const idx = all.findIndex((r: any) => r.id === data.id);
        if (idx !== -1) {
          all[idx] = markDeleted(all[idx]);
          persistItem(KEYS.REPAYMENTS, JSON.stringify(all));
          syncToDb('repayments', all);
        }
        break;
      }
      case 'cylinder_transaction': {
        const all = storageService.getAllCylinderTransactionsRaw();
        const idx = all.findIndex((t: any) => t.id === data.id);
        if (idx !== -1) {
          all[idx] = markDeleted(all[idx]);
          persistItem(KEYS.CYLINDER_TX, JSON.stringify(all));
          syncToDb('cylinder_transactions', all);
        }
        break;
      }
    }
  },

  /**
   * Get all soft-deleted records across all types for RecycleBin UI.
   */
  getRecycleBin: (): SoftDeletedRecord[] => {
    const results: SoftDeletedRecord[] = [];

    // Customers
    const allCustomers = storageService.getAllCustomersRaw();
    allCustomers.filter((c: any) => c.isDeleted).forEach((c: any) => {
      results.push({
        id: c.id,
        type: 'customer',
        record: c,
        deletedBy: c.deletedBy || 'غير معروف',
        deletedAt: c.deletedAt || '',
        description: c._deleteDescription || `زبون: ${c.name} (#${c.serialNumber})`,
      });
    });

    // Products
    const allProducts = storageService.getAllProductsRaw();
    allProducts.filter((p: any) => p.isDeleted).forEach((p: any) => {
      results.push({
        id: p.id,
        type: 'product',
        record: p,
        deletedBy: p.deletedBy || 'غير معروف',
        deletedAt: p.deletedAt || '',
        description: p._deleteDescription || `نوع: ${p.name} (${p.size})`,
      });
    });

    // Invoices
    const allInvoices = storageService.getAllInvoicesRaw();
    allInvoices.filter((i: any) => i.isDeleted).forEach((i: any) => {
      results.push({
        id: i.id,
        type: 'invoice',
        record: i,
        deletedBy: i.deletedBy || 'غير معروف',
        deletedAt: i.deletedAt || '',
        description: i._deleteDescription || `فاتورة - ${i.customerName} - ${i.totalAmount} شيكل`,
      });
    });

    // Repayments
    const allRepayments = storageService.getAllRepaymentsRaw();
    allRepayments.filter((r: any) => r.isDeleted).forEach((r: any) => {
      results.push({
        id: r.id,
        type: 'repayment',
        record: r,
        deletedBy: r.deletedBy || 'غير معروف',
        deletedAt: r.deletedAt || '',
        description: r._deleteDescription || `سداد ${r.amount} شيكل - ${r.customerName}`,
      });
    });

    // Cylinder Transactions
    const allTx = storageService.getAllCylinderTransactionsRaw();
    allTx.filter((t: any) => t.isDeleted).forEach((t: any) => {
      results.push({
        id: t.id,
        type: 'cylinder_transaction',
        record: t,
        deletedBy: t.deletedBy || 'غير معروف',
        deletedAt: t.deletedAt || '',
        description: t._deleteDescription || `${t.type === 'out' ? 'إعارة' : 'إرجاع'} ${t.quantity} ${t.productName}`,
      });
    });

    // Sort by deletedAt descending (newest first)
    results.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return results;
  },

  /**
   * Restore a soft-deleted record by clearing isDeleted flag.
   */
  restoreFromRecycleBin: (itemId: string): boolean => {
    const now = new Date().toISOString();

    const unmarkDeleted = (record: any) => {
      const restored = { ...record };
      delete restored.isDeleted;
      delete restored.deletedAt;
      delete restored.deletedBy;
      delete restored._deleteDescription;
      restored.updatedAt = now;
      return restored;
    };

    // BUG-32 FIX: ALL collections now have proper syncType — no more null!
    const collections = [
      { key: KEYS.CUSTOMERS, rawGetter: storageService.getAllCustomersRaw, syncType: 'customers' },
      { key: KEYS.PRODUCTS, rawGetter: storageService.getAllProductsRaw, syncType: 'products' },
      { key: KEYS.INVOICES, rawGetter: storageService.getAllInvoicesRaw, syncType: 'invoices' },
      { key: KEYS.REPAYMENTS, rawGetter: storageService.getAllRepaymentsRaw, syncType: 'repayments' },
      { key: KEYS.CYLINDER_TX, rawGetter: storageService.getAllCylinderTransactionsRaw, syncType: 'cylinder_transactions' },
    ];

    for (const col of collections) {
      const all = col.rawGetter();
      const idx = all.findIndex((r: any) => r.id === itemId && r.isDeleted);
      if (idx !== -1) {
        all[idx] = unmarkDeleted(all[idx]);
        persistItem(col.key, JSON.stringify(all));
        syncToDb(col.syncType, all);
        // BUG-33 FIX: Recalculate balances after restoring invoices/repayments/cylinders
        storageService.recalculateCustomerBalances();
        return true;
      }
    }

    return false;
  },

  restoreMultipleFromRecycleBin: (itemIds: string[]): number => {
    let restored = 0;
    for (const id of itemIds) {
      if (storageService.restoreFromRecycleBin(id)) restored++;
    }
    return restored;
  },

  /**
   * Hard delete: permanently remove all soft-deleted records from localStorage AND Turso.
   */
  emptyRecycleBin: async () => {
    // 1. Remove from localStorage
    const filterActive = (arr: any[]) => arr.filter((r: any) => !r.isDeleted);

    const cleanCustomers = filterActive(storageService.getAllCustomersRaw());
    const cleanProducts = filterActive(storageService.getAllProductsRaw());
    const cleanInvoices = filterActive(storageService.getAllInvoicesRaw());
    const cleanRepayments = filterActive(storageService.getAllRepaymentsRaw());
    const cleanCylinderTx = filterActive(storageService.getAllCylinderTransactionsRaw());

    persistItem(KEYS.CUSTOMERS, JSON.stringify(cleanCustomers));
    persistItem(KEYS.PRODUCTS, JSON.stringify(cleanProducts));
    persistItem(KEYS.INVOICES, JSON.stringify(cleanInvoices));
    persistItem(KEYS.REPAYMENTS, JSON.stringify(cleanRepayments));
    persistItem(KEYS.CYLINDER_TX, JSON.stringify(cleanCylinderTx));

    // 2. Also remove old legacy recycle bin data if it exists
    try {
      localStorage.removeItem(KEYS.RECYCLE_BIN);
      idbStorage.setItem(KEYS.RECYCLE_BIN, '[]').catch(() => {});
    } catch {}

    // 3. BUG-36 FIX: Sync cleaned data to Turso (overwrite soft-deleted records)
    if (isDatabaseConfigured()) {
      try {
        // First try hard-delete API if available
        await dataService.hardDeleteAllSoftDeleted();
      } catch (e) {
        console.warn('hardDeleteAllSoftDeleted not available, syncing clean data instead:', e);
      }
      // Always re-sync the clean data to ensure cloud matches local
      try {
        await dataService.saveAllCustomers(cleanCustomers);
        await dataService.saveAllProducts(cleanProducts);
        for (const inv of cleanInvoices) { await dataService.addInvoice(inv); }
        for (const rep of cleanRepayments) { await dataService.addRepayment(rep); }
        for (const tx of cleanCylinderTx) { await dataService.addCylinderTransaction(tx); }
      } catch (syncErr) {
        console.error('Failed to sync cleaned data to Turso:', syncErr);
        markSyncNeeded();
      }
    }
  },
};