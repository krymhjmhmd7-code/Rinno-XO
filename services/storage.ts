import { Customer, Product, Invoice, AppSettings, Repayment, CylinderTransaction } from '../types';
import { sheetsService } from './sheetsService';

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
const safeSync = async (sheetName: string, data: any) => {
  if (!sheetsService.isConnected()) {
    markSyncNeeded();
    return;
  }

  try {
    const result = await sheetsService.saveSheetData(sheetName, data);
    if (!result) markSyncNeeded();
    else markSyncDone();
  } catch (e) {
    console.error(`Sync failed for ${sheetName}:`, e);
    markSyncNeeded();
  }
};

const markSyncNeeded = () => {
  const current = storageService.getSettings();
  if (!current.needsSync) {
    current.needsSync = true;
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(current));
  }
};

const markSyncDone = () => {
  const current = storageService.getSettings();
  if (current.needsSync) {
    current.needsSync = false;
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(current));
  }
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
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    safeSync('settings', [settings]);
  },

  getCustomerTypes: (): string[] => {
    const data = localStorage.getItem(KEYS.CUSTOMER_TYPES);
    return data ? JSON.parse(data) : defaultCustomerTypes;
  },

  saveCustomerTypes: (types: string[]) => {
    localStorage.setItem(KEYS.CUSTOMER_TYPES, JSON.stringify(types));
    safeSync('customerTypes', [{ types: JSON.stringify(types) }]);
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
      localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
    }

    return customers;
  },

  saveCustomers: (customers: Customer[]) => {
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
    safeSync('customers', customers);
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
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
    safeSync('products', products);
  },

  getInvoices: (): Invoice[] => {
    const data = localStorage.getItem(KEYS.INVOICES);
    return data ? JSON.parse(data) : [];
  },

  saveInvoices: (invoices: Invoice[]) => {
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
    safeSync('invoices', invoices);
  },

  addInvoice: (invoice: Invoice) => {
    // 1. Save Invoice
    const invoices = storageService.getInvoices();
    invoices.unshift(invoice);
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));

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

    if (sheetsService.isConnected()) {
      // For append, we also want to mark sync needed if it fails
      sheetsService.appendSheetRow('invoices', invoice)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
    }
  },

  // Helper to add a manual debt (e.g., old balance)
  addManualDebt: (customerId: string, customerName: string, amount: number, note: string) => {
    const invoice: Invoice = {
      id: Date.now().toString(),
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
    localStorage.setItem(KEYS.REPAYMENTS, JSON.stringify(repayments));

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

    if (sheetsService.isConnected()) {
      sheetsService.appendSheetRow('repayments', repayment)
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
    localStorage.setItem(KEYS.CYLINDER_TX, JSON.stringify(transactions));

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

    if (sheetsService.isConnected()) {
      sheetsService.appendSheetRow('cylinderTransactions', tx)
        .then(res => !res && markSyncNeeded())
        .catch(() => markSyncNeeded());
    } else {
      markSyncNeeded();
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

  exportDatabaseToExcel: () => {
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
      Date: new Date(inv.date).toLocaleDateString('ar-EG'),
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

    XLSX.writeFile(wb, `gaspro_full_data_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  importDatabaseFromJSON: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);

      // Basic validation
      if (!data.customers || !data.products || !data.invoices) {
        return false;
      }

      localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(data.customers));
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
      localStorage.setItem(KEYS.INVOICES, JSON.stringify(data.invoices));

      if (data.repayments) {
        localStorage.setItem(KEYS.REPAYMENTS, JSON.stringify(data.repayments));
      }

      if (data.cylinderTransactions) {
        localStorage.setItem(KEYS.CYLINDER_TX, JSON.stringify(data.cylinderTransactions));
      }

      if (data.customerTypes) {
        localStorage.setItem(KEYS.CUSTOMER_TYPES, JSON.stringify(data.customerTypes));
      }

      if (data.settings) {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      }

      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }
};