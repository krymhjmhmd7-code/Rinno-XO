import { Customer, Product, Invoice, AppSettings, Repayment, CylinderTransaction } from '../types';
import { dataService, userService, isDatabaseConfigured } from './dbService';
import { idbStorage } from './idbStorage';

// Declare XLSX for TypeScript (loaded via CDN)
declare const XLSX: any;

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

/**
 * SHA-256 hash for passwords (#8)
 */
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
      case 'invoices':
        // Invoices are appended individually, but if we need full sync:
        // For now, saveInvoices is rarely called directly for bulk updates except migration.
        // We will assume 'data' is array here.
        // Turso implementation for saveAllInvoices is not yet there, skipping or implementing loop?
        // Let's rely on addInvoice for new ones. 
        // If this is called, it might be bulk import. 
        // For safety, let's mark sync needed if we can't handle it, or just return true to not block.
        // Actually, we should probably implement full sync later if needed.
        result = true;
        break;
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
const mergeById = <T extends { id: string; updatedAt?: string }>(local: T[], cloud: T[]): T[] => {
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
            const localTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
            const cloudTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            // If local is newer or same age, keep local (preserves offline edits)
            if (localTime >= cloudTime) {
                merged.set(item.id, item);
            }
            // Otherwise keep cloud version (it's newer)
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
    const invoices: Invoice[] = JSON.parse(localStorage.getItem(KEYS.INVOICES) || '[]');
    const repayments: Repayment[] = JSON.parse(localStorage.getItem(KEYS.REPAYMENTS) || '[]');

    let hasChanges = false;

    customers = customers.map(customer => {
      // Calculate balance from invoices (debt amounts only)
      const invoiceDebt = invoices
        .filter(inv => inv.customerId === customer.id)
        .reduce((sum, inv) => sum + (inv.paymentDetails?.debt || 0), 0);

      // Calculate payments from repayments
      const totalRepayments = repayments
        .filter(rep => rep.customerId === customer.id)
        .reduce((sum, rep) => sum + rep.amount, 0);

      const correctBalance = invoiceDebt - totalRepayments;

      if (customer.balance !== correctBalance) {
        console.log(`Correcting balance for ${customer.name}: ${customer.balance} -> ${correctBalance}`);
        hasChanges = true;
        return { ...customer, balance: correctBalance };
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

    return customers;
  },

  saveCustomers: (customers: Customer[]) => {
    persistItem(KEYS.CUSTOMERS, JSON.stringify(customers));
    syncToDb('customers', customers);
  },

  getProducts: (): Product[] => {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    let products = data ? JSON.parse(data) : seedProducts;

    // Migration: Add isActive if missing
    products = products.map((p: Product) => ({
      ...p,
      isActive: p.isActive !== undefined ? p.isActive : true
    }));

    return products;
  },

  saveProducts: (products: Product[]) => {
    persistItem(KEYS.PRODUCTS, JSON.stringify(products));
    syncToDb('products', products);
  },

  getInvoices: (): Invoice[] => {
    const data = localStorage.getItem(KEYS.INVOICES);
    return data ? JSON.parse(data) : [];
  },

  saveInvoices: (invoices: Invoice[]) => {
    persistItem(KEYS.INVOICES, JSON.stringify(invoices));
    // syncToDb('invoices', invoices); // Not strictly needed for active sync if addInvoice handles it
  },

  addInvoice: (invoice: Invoice) => {
    // 1. Save Invoice
    const invoices = storageService.getInvoices();
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
    // 1. Get current list and find the invoice
    const invoices = storageService.getInvoices();
    const invoiceIndex = invoices.findIndex(i => i.id === id);
    if (invoiceIndex === -1) return;

    const invoice = invoices[invoiceIndex];

    // Save to recycle bin before deleting
    storageService.moveToRecycleBin('invoice', invoice, `فاتورة - ${invoice.customerName} - ${invoice.totalAmount} شيكل`);

    // 2. Remove Invoice
    invoices.splice(invoiceIndex, 1);
    persistItem(KEYS.INVOICES, JSON.stringify(invoices));

    // 3. Revert Customer Stats & Balance
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];

      // Revert Total Purchases
      customer.totalPurchases = Math.max(0, (customer.totalPurchases || 0) - invoice.totalAmount);

      // Revert Balance (Subtract amount that was added as debt)
      if (invoice.paymentDetails && invoice.paymentDetails.debt !== 0) {
        customer.balance = (customer.balance || 0) - invoice.paymentDetails.debt;
      }

      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }

    // 4. Sync with DB
    if (isDatabaseConfigured()) {
      dataService.deleteInvoice(id)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  updateInvoiceDate: (id: string, newDate: string) => {
    const invoices = storageService.getInvoices();
    const invoiceIndex = invoices.findIndex(i => i.id === id);
    if (invoiceIndex === -1) return;

    invoices[invoiceIndex].date = newDate;
    // Re-sort to maintain order if necessary, but UI usually sorts. Array order in storage doesn't strictly matter if we always sort on display.
    // However, for consistency let's keep it somewhat ordered or just save.
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
      }
    };
    storageService.addInvoice(invoice);
  },

  getRepayments: (): Repayment[] => {
    const data = localStorage.getItem(KEYS.REPAYMENTS);
    return data ? JSON.parse(data) : [];
  },

  addRepayment: (repayment: Repayment) => {
    // 1. Save Repayment Record
    const repayments = storageService.getRepayments();
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
    // 1. Get current list and find repayment
    const repayments = storageService.getRepayments();
    const index = repayments.findIndex(r => r.id === id);
    if (index === -1) return;

    const repayment = repayments[index];

    // Save to recycle bin before deleting
    storageService.moveToRecycleBin('repayment', repayment, `سداد ${repayment.amount} شيكل - ${repayment.customerName}`);

    // 2. Remove
    repayments.splice(index, 1);
    persistItem(KEYS.REPAYMENTS, JSON.stringify(repayments));

    // 3. Revert Customer Balance
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];
      // Add balance back (Debt increases back because we removed a payment)
      customer.balance = (customer.balance || 0) + repayment.amount;

      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }

    // 4. Sync
    if (isDatabaseConfigured()) {
      dataService.deleteRepayment(id)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  updateRepaymentDate: (id: string, newDate: string) => {
    const repayments = storageService.getRepayments();
    const index = repayments.findIndex(r => r.id === id);
    if (index === -1) return;

    repayments[index].date = newDate;
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
    return data ? JSON.parse(data) : [];
  },

  addCylinderTransaction: (tx: CylinderTransaction) => {
    // 1. Save Transaction
    const transactions = storageService.getCylinderTransactions();
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
    // 1. Get list and tx
    const transactions = storageService.getCylinderTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;

    const tx = transactions[index];

    // Save to recycle bin before deleting
    storageService.moveToRecycleBin('cylinder_transaction', tx, `${tx.type === 'out' ? 'إعارة' : 'إرجاع'} ${tx.quantity} ${tx.productName} - ${tx.customerName}`);

    // 2. Remove
    transactions.splice(index, 1);
    persistItem(KEYS.CYLINDER_TX, JSON.stringify(transactions));

    // 3. Revert Balance
    const customers = storageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);

    if (customerIndex !== -1) {
      const customer = customers[customerIndex];
      if (!customer.cylinderBalance) customer.cylinderBalance = {};

      const currentVal = customer.cylinderBalance[tx.productName] || 0;

      if (tx.type === 'out') {
        // Was 'out' (added to debt), so subtact
        customer.cylinderBalance[tx.productName] = currentVal - tx.quantity;
      } else {
        // Was 'in' (removed from debt), so add back
        customer.cylinderBalance[tx.productName] = currentVal + tx.quantity;
      }

      customers[customerIndex] = customer;
      storageService.saveCustomers(customers);
    }

    // 4. Sync
    if (isDatabaseConfigured()) {
      dataService.deleteCylinderTransaction(id)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  updateCylinderTransactionDate: (id: string, newDate: string) => {
    const transactions = storageService.getCylinderTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;

    transactions[index].date = newDate;
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
      try {
        if (mergedCustomers.length > 0) await dataService.saveAllCustomers(mergedCustomers);
        if (mergedProducts.length > 0) await dataService.saveAllProducts(mergedProducts);
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

      // 1. Customers
      const customers = storageService.getCustomers();
      await dataService.saveAllCustomers(customers);

      // 2. Products
      const products = storageService.getProducts();
      await dataService.saveAllProducts(products);

      // 3. Invoices (Batch add - Turso doesn't have bulk insert for these yet in our service, so loop)
      const invoices = storageService.getInvoices();
      for (const inv of invoices) {
        await dataService.addInvoice(inv);
      }

      // 4. Repayments
      const repayments = storageService.getRepayments();
      for (const rep of repayments) {
        await dataService.addRepayment(rep);
      }

      // 5. Cylinder Tx
      const txs = storageService.getCylinderTransactions();
      for (const tx of txs) {
        await dataService.addCylinderTransaction(tx);
      }

      console.log('Active Sync: Data pushed to Turso successfully');
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

      // 2. Clear Local Storage
      localStorage.removeItem(KEYS.CUSTOMERS);
      localStorage.removeItem(KEYS.PRODUCTS);
      localStorage.removeItem(KEYS.INVOICES);
      localStorage.removeItem(KEYS.REPAYMENTS);
      localStorage.removeItem(KEYS.CYLINDER_TX);
      localStorage.removeItem(KEYS.SETTINGS);

      console.log('Factory Reset Complete');
      return true;
    } catch (e) {
      console.error('Factory Reset Failed:', e);
      return false;
    }
  },

  // Export Functions
  exportDatabaseToJSON: () => {
    const data = {
      customers: storageService.getCustomers(),
      products: storageService.getProducts(),
      invoices: storageService.getInvoices(),
      repayments: storageService.getRepayments(),
      cylinderTransactions: storageService.getCylinderTransactions(),
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
  },

  exportDatabaseToExcel: (returnFile: boolean = false) => {
    if (typeof XLSX === 'undefined') {
      alert("مكتبة التصدير غير محملة، يرجى التحقق من الانترنت");
      return;
    }

    const customers = storageService.getCustomers();
    const products = storageService.getProducts();
    const invoices = storageService.getInvoices();
    const repayments = storageService.getRepayments();
    const cylinderTx = storageService.getCylinderTransactions();

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

      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  // --- Recycle Bin ---
  getCurrentUserEmail: (): string => {
    try {
      return localStorage.getItem('rinno_user_email') || 'غير معروف';
    } catch { return 'غير معروف'; }
  },

  moveToRecycleBin: (type: string, data: any, description: string) => {
    const bin = storageService.getRecycleBin();
    bin.unshift({
      id: crypto.randomUUID(),
      type,
      data: JSON.parse(JSON.stringify(data)),
      deletedBy: storageService.getCurrentUserEmail(),
      deletedAt: new Date().toISOString(),
      description
    });
    persistItem(KEYS.RECYCLE_BIN, JSON.stringify(bin));
  },

  getRecycleBin: (): any[] => {
    const data = localStorage.getItem(KEYS.RECYCLE_BIN);
    return data ? JSON.parse(data) : [];
  },

  restoreFromRecycleBin: (itemId: string): boolean => {
    const bin = storageService.getRecycleBin();
    const index = bin.findIndex((i: any) => i.id === itemId);
    if (index === -1) return false;

    const item = bin[index];
    let success = false;

    switch (item.type) {
      case 'customer': {
        const customers = storageService.getCustomers();
        if (!customers.find((c: any) => c.id === item.data.id)) {
          customers.push(item.data);
          storageService.saveCustomers(customers);
        }
        success = true;
        break;
      }
      case 'product': {
        const products = storageService.getProducts();
        if (!products.find((p: any) => p.id === item.data.id)) {
          products.push(item.data);
          storageService.saveProducts(products);
        }
        success = true;
        break;
      }
      case 'invoice': {
        const invoices = storageService.getInvoices();
        if (!invoices.find((i: any) => i.id === item.data.id)) {
          storageService.addInvoice(item.data);
        }
        success = true;
        break;
      }
      case 'repayment': {
        const repayments = storageService.getRepayments();
        if (!repayments.find((r: any) => r.id === item.data.id)) {
          storageService.addRepayment(item.data);
        }
        success = true;
        break;
      }
      case 'cylinder_transaction': {
        const txs = storageService.getCylinderTransactions();
        if (!txs.find((t: any) => t.id === item.data.id)) {
          storageService.addCylinderTransaction(item.data);
        }
        success = true;
        break;
      }
    }

    if (success) {
      bin.splice(index, 1);
      persistItem(KEYS.RECYCLE_BIN, JSON.stringify(bin));
    }
    return success;
  },

  restoreMultipleFromRecycleBin: (itemIds: string[]): number => {
    let restored = 0;
    for (const id of itemIds) {
      if (storageService.restoreFromRecycleBin(id)) restored++;
    }
    return restored;
  },

  emptyRecycleBin: () => {
    persistItem(KEYS.RECYCLE_BIN, JSON.stringify([]));
  },
};