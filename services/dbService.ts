import { createClient } from '@libsql/client';

// Turso Database Configuration
// In production: credentials are on the server (/api/db), NOT in the frontend bundle
// In development: direct connection for convenience (VITE_ vars)
const TURSO_URL = import.meta.env.VITE_TURSO_DATABASE_URL || '';
const TURSO_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || '';

// Direct client for development only (will be null in production if VITE_ vars are removed)
export const tursoClient = TURSO_URL ? createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
}) : null;

// API proxy helper — used in production to keep credentials server-side
const apiExecute = async (sql: string, args: any[] = []) => {
    const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', params: { sql, args } }),
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return (await res.json()).result;
};

const apiBatch = async (statements: { sql: string; args?: any[] }[]) => {
    const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', params: { statements } }),
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return (await res.json()).results;
};

// Use API proxy if tursoClient is not available (production mode)
const useProxy = !tursoClient;

// Check if database is configured
export const isDatabaseConfigured = (): boolean => {
    return !!TURSO_URL || useProxy; // In production, proxy is always available
};

// Initialize database tables
export const initializeDatabase = async (): Promise<boolean> => {
    if (!tursoClient) {
        console.warn('Turso database not configured');
        return false;
    }

    try {
        // Create Users table
        await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create Customers table
        await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        serial_number INTEGER,
        name TEXT NOT NULL,
        type TEXT,
        city TEXT,
        village TEXT,
        neighborhood TEXT,
        phone TEXT,
        whatsapp TEXT,
        total_purchases REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        cylinder_balance TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create Products table
        await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        size TEXT,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create Invoices table
        await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        date TEXT,
        items TEXT,
        total_amount REAL,
        payment_details TEXT,
        status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create Repayments table
        await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS repayments (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        amount REAL,
        date TEXT,
        method TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create CylinderTransactions table
        await tursoClient.execute(`
          CREATE TABLE IF NOT EXISTS cylinder_transactions (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            customer_name TEXT,
            product_name TEXT,
            quantity REAL,
            type TEXT,
            date TEXT,
            note TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create Metadata table for System Reset Signal
        await tursoClient.execute(`
          CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `);

        // --- Soft Delete & Sync Migration: Add columns if missing ---
        const syncTables = ['customers', 'products', 'invoices', 'repayments', 'cylinder_transactions'];
        for (const table of syncTables) {
          for (const col of ['is_deleted', 'deleted_at', 'deleted_by', 'updated_at']) {
            try {
              const defaultVal = col === 'is_deleted' ? 'INTEGER DEFAULT 0' : 'TEXT';
              await tursoClient.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${defaultVal}`);
            } catch {
              // Column already exists — safe to ignore
            }
          }
        }

        console.log('Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
};

// User functions
export const userService = {
    async findByEmail(email: string) {
        if (!tursoClient) return null;
        try {
            const result = await tursoClient.execute({
                sql: 'SELECT * FROM users WHERE email = ?',
                args: [email]
            });
            return result.rows[0] || null;
        } catch {
            return null;
        }
    },

    async create(email: string, name: string, isAdmin: boolean = false) {
        if (!tursoClient) return null;
        try {
            await tursoClient.execute({
                sql: 'INSERT INTO users (email, name, is_admin) VALUES (?, ?, ?)',
                args: [email, name, isAdmin ? 1 : 0]
            });
            return this.findByEmail(email);
        } catch {
            return null;
        }
    },

    async getAllowedEmails(): Promise<string[]> {
        if (!tursoClient) return [];
        try {
            const result = await tursoClient.execute('SELECT email FROM users');
            return result.rows.map(row => row.email as string);
        } catch {
            return [];
        }
    },

    async addAllowedEmail(email: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'INSERT OR IGNORE INTO users (email, name, is_admin) VALUES (?, ?, 0)',
                args: [email, '']
            });
            return true;
        } catch {
            return false;
        }
    },

    async removeEmail(email: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'DELETE FROM users WHERE email = ? AND is_admin = 0',
                args: [email]
            });
            return true;
        } catch {
            return false;
        }
    },

    async isAdmin(email: string): Promise<boolean> {
        if (!tursoClient) return false;
        try {
            const result = await tursoClient.execute({
                sql: 'SELECT is_admin FROM users WHERE email = ?',
                args: [email]
            });
            return result.rows[0]?.is_admin === 1;
        } catch {
            return false;
        }
    }
};

// Data sync functions for customers, products, etc.
export const dataService = {
    // Customers
    async getCustomers() {
        if (!tursoClient) return [];
        try {
            const result = await tursoClient.execute('SELECT * FROM customers ORDER BY serial_number');
            return result.rows.map(row => ({
                id: row.id as string,
                serialNumber: row.serial_number as number,
                name: row.name as string,
                type: row.type as string,
                city: row.city as string,
                village: row.village as string,
                neighborhood: row.neighborhood as string,
                phone: row.phone as string,
                whatsapp: row.whatsapp as string,
                totalPurchases: row.total_purchases as number,
                balance: row.balance as number,
                cylinderBalance: row.cylinder_balance ? JSON.parse(row.cylinder_balance as string) : {},
                isDeleted: row.is_deleted === 1,
                deletedAt: row.deleted_at as string || undefined,
                deletedBy: row.deleted_by as string || undefined,
                updatedAt: row.updated_at as string || undefined,
            }));
        } catch {
            return [];
        }
    },

    async saveCustomer(customer: any) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: `INSERT OR REPLACE INTO customers (id, serial_number, name, type, city, village, neighborhood, phone, whatsapp, total_purchases, balance, cylinder_balance, is_deleted, deleted_at, deleted_by, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [customer.id, customer.serialNumber, customer.name, customer.type, customer.city, customer.village, customer.neighborhood, customer.phone, customer.whatsapp, customer.totalPurchases, customer.balance, JSON.stringify(customer.cylinderBalance || {}), customer.isDeleted ? 1 : 0, customer.deletedAt || null, customer.deletedBy || null, customer.updatedAt || new Date().toISOString()]
            });
            return true;
        } catch {
            return false;
        }
    },

    async saveAllCustomers(customers: any[]) {
        if (!tursoClient) return false;
        try {
            const tx = await tursoClient.transaction('write');
            for (const customer of customers) {
                await tx.execute({
                    sql: `INSERT OR REPLACE INTO customers (id, serial_number, name, type, city, village, neighborhood, phone, whatsapp, total_purchases, balance, cylinder_balance, is_deleted, deleted_at, deleted_by, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [customer.id, customer.serialNumber, customer.name, customer.type, customer.city, customer.village, customer.neighborhood, customer.phone, customer.whatsapp, customer.totalPurchases, customer.balance, JSON.stringify(customer.cylinderBalance || {}), customer.isDeleted ? 1 : 0, customer.deletedAt || null, customer.deletedBy || null, customer.updatedAt || new Date().toISOString()]
                });
            }
            await tx.commit();
            return true;
        } catch (e) {
            console.error('Failed to save all customers', e);
            return false;
        }
    },

    // Products
    async getProducts() {
        if (!tursoClient) return [];
        try {
            const result = await tursoClient.execute('SELECT * FROM products');
            return result.rows.map(row => ({
                id: row.id as string,
                name: row.name as string,
                size: row.size as string,
                isActive: row.is_active === 1,
                isDeleted: row.is_deleted === 1,
                deletedAt: row.deleted_at as string || undefined,
                deletedBy: row.deleted_by as string || undefined,
                updatedAt: row.updated_at as string || undefined,
            }));
        } catch {
            return [];
        }
    },

    async saveProduct(product: any) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                // BUG-45 FIX: Include soft-delete fields to prevent INSERT OR REPLACE from wiping them
                sql: `INSERT OR REPLACE INTO products (id, name, size, is_active, is_deleted, deleted_at, deleted_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [product.id, product.name, product.size, product.isActive ? 1 : 0, product.isDeleted ? 1 : 0, product.deletedAt || null, product.deletedBy || null, product.updatedAt || new Date().toISOString()]
            });
            return true;
        } catch {
            return false;
        }
    },

    async saveAllProducts(products: any[]) {
        if (!tursoClient) return false;
        try {
            const tx = await tursoClient.transaction('write');
            for (const product of products) {
                await tx.execute({
                    sql: `INSERT OR REPLACE INTO products (id, name, size, is_active, is_deleted, deleted_at, deleted_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [product.id, product.name, product.size, product.isActive ? 1 : 0, product.isDeleted ? 1 : 0, product.deletedAt || null, product.deletedBy || null, product.updatedAt || new Date().toISOString()]
                });
            }
            await tx.commit();
            return true;
        } catch {
            return false;
        }
    },

    async getInvoices() {
        if (!tursoClient) return [];
        try {
            const result = await tursoClient.execute('SELECT * FROM invoices ORDER BY date DESC');
            return result.rows.map(row => ({
                id: row.id as string,
                customerId: row.customer_id as string,
                customerName: row.customer_name as string,
                date: row.date as string,
                items: JSON.parse(row.items as string),
                totalAmount: row.total_amount as number,
                paymentDetails: JSON.parse(row.payment_details as string),
                status: row.status as string,
                isDeleted: row.is_deleted === 1,
                deletedAt: row.deleted_at as string || undefined,
                deletedBy: row.deleted_by as string || undefined,
                updatedAt: row.updated_at as string || undefined,
            }));
        } catch {
            return [];
        }
    },

    async addInvoice(invoice: any) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: `INSERT OR REPLACE INTO invoices (id, customer_id, customer_name, date, items, total_amount, payment_details, status, is_deleted, deleted_at, deleted_by, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [invoice.id, invoice.customerId, invoice.customerName, invoice.date, JSON.stringify(invoice.items), invoice.totalAmount, JSON.stringify(invoice.paymentDetails), invoice.status, invoice.isDeleted ? 1 : 0, invoice.deletedAt || null, invoice.deletedBy || null, invoice.updatedAt || new Date().toISOString()]
            });
            return true;
        } catch {
            return false;
        }
    },

    async deleteInvoice(id: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'DELETE FROM invoices WHERE id = ?',
                args: [id]
            });
            return true;
        } catch {
            return false;
        }
    },

    async updateInvoiceDate(id: string, date: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'UPDATE invoices SET date = ? WHERE id = ?',
                args: [date, id]
            });
            return true;
        } catch {
            return false;
        }
    },

    async getRepayments() {
        if (!tursoClient) return [];
        try {
            const result = await tursoClient.execute('SELECT * FROM repayments ORDER BY date DESC');
            return result.rows.map(row => ({
                id: row.id as string,
                customerId: row.customer_id as string,
                customerName: row.customer_name as string,
                amount: row.amount as number,
                date: row.date as string,
                method: row.method as string,
                note: row.note as string,
                isDeleted: row.is_deleted === 1,
                deletedAt: row.deleted_at as string || undefined,
                deletedBy: row.deleted_by as string || undefined,
                updatedAt: row.updated_at as string || undefined,
            }));
        } catch {
            return [];
        }
    },

    async addRepayment(repayment: any) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: `INSERT OR REPLACE INTO repayments (id, customer_id, customer_name, amount, date, method, note, is_deleted, deleted_at, deleted_by, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [repayment.id, repayment.customerId, repayment.customerName, repayment.amount, repayment.date, repayment.method, repayment.note || '', repayment.isDeleted ? 1 : 0, repayment.deletedAt || null, repayment.deletedBy || null, repayment.updatedAt || new Date().toISOString()]
            });
            return true;
        } catch {
            return false;
        }
    },

    async deleteRepayment(id: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'DELETE FROM repayments WHERE id = ?',
                args: [id]
            });
            return true;
        } catch {
            return false;
        }
    },

    async updateRepaymentDate(id: string, date: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'UPDATE repayments SET date = ? WHERE id = ?',
                args: [date, id]
            });
            return true;
        } catch {
            return false;
        }
    },

    async getCylinderTransactions() {
        if (!tursoClient) return [];
        try {
            const result = await tursoClient.execute('SELECT * FROM cylinder_transactions ORDER BY date DESC');
            return result.rows.map(row => ({
                id: row.id as string,
                customerId: row.customer_id as string,
                customerName: row.customer_name as string,
                productName: row.product_name as string,
                quantity: row.quantity as number,
                type: row.type as string,
                date: row.date as string,
                note: row.note as string,
                isDeleted: row.is_deleted === 1,
                deletedAt: row.deleted_at as string || undefined,
                deletedBy: row.deleted_by as string || undefined,
                updatedAt: row.updated_at as string || undefined,
            }));
        } catch {
            return [];
        }
    },

    async addCylinderTransaction(tx: any) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: `INSERT OR REPLACE INTO cylinder_transactions (id, customer_id, customer_name, product_name, quantity, type, date, note, is_deleted, deleted_at, deleted_by, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [tx.id, tx.customerId, tx.customerName, tx.productName, tx.quantity, tx.type, tx.date, tx.note || '', tx.isDeleted ? 1 : 0, tx.deletedAt || null, tx.deletedBy || null, tx.updatedAt || new Date().toISOString()]
            });
            return true;
        } catch {
            return false;
        }
    },

    async deleteCylinderTransaction(id: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'DELETE FROM cylinder_transactions WHERE id = ?',
                args: [id]
            });
            return true;
        } catch {
            return false;
        }
    },

    async updateCylinderTransactionDate(id: string, date: string) {
        if (!tursoClient) return false;
        try {
            await tursoClient.execute({
                sql: 'UPDATE cylinder_transactions SET date = ? WHERE id = ?',
                args: [date, id]
            });
            return true;
        } catch {
            return false;
        }
    },

    // Factory Reset
    async clearDatabase() {
        if (!tursoClient) return false;
        try {
            const tx = await tursoClient.transaction('write');
            await tx.execute('DELETE FROM customers');
            await tx.execute('DELETE FROM products');
            await tx.execute('DELETE FROM invoices');
            await tx.execute('DELETE FROM repayments');
            await tx.execute('DELETE FROM cylinder_transactions');
            await tx.execute('DELETE FROM users');

            // Set Reset Timestamp
            const timestamp = new Date().toISOString();
            await tx.execute({
                sql: `INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_reset_timestamp', ?)`,
                args: [timestamp]
            });

            await tx.commit();
            return true;
        } catch (e) {
            console.error('Failed to clear database', e);
            return false;
        }
    },

    async getResetTimestamp() {
        if (!tursoClient) return null;
        try {
            const result = await tursoClient.execute(`SELECT value FROM metadata WHERE key = 'last_reset_timestamp'`);
            return result.rows.length > 0 ? result.rows[0].value as string : null;
        } catch {
            return null;
        }
    },

    // Get DB Usage Stats
    async getDatabaseUsage() {
        if (!tursoClient) return { sizeBytes: 0, rows: 0 };
        try {
            // Get Size (Pages * PageSize)
            const countResult = await tursoClient.execute('PRAGMA page_count');
            const sizeResult = await tursoClient.execute('PRAGMA page_size');

            const pageCount = Number(countResult.rows[0][0]);
            const pageSize = Number(sizeResult.rows[0][0]);
            const totalBytes = pageCount * pageSize;

            // Get Approximate Row Count (Customers as proxy or sum of all)
            const rowsResult = await tursoClient.execute('SELECT count(*) as c FROM customers');
            const totalRows = Number(rowsResult.rows[0].c);

            return { sizeBytes: totalBytes, rows: totalRows };
        } catch (e) {
            console.error('Failed to get usage stats', e);
            return { sizeBytes: 0, rows: 0 };
        }
    },

    // --- Hard Delete: permanently remove soft-deleted records ---
    async hardDeleteByIds(table: string, ids: string[]) {
        if (!tursoClient || ids.length === 0) return false;
        try {
            const tx = await tursoClient.transaction('write');
            for (const id of ids) {
                await tx.execute({ sql: `DELETE FROM ${table} WHERE id = ?`, args: [id] });
            }
            await tx.commit();
            return true;
        } catch (e) {
            console.error(`Failed to hard delete from ${table}`, e);
            return false;
        }
    },

    async hardDeleteAllSoftDeleted() {
        if (!tursoClient) return false;
        try {
            const tx = await tursoClient.transaction('write');
            await tx.execute('DELETE FROM customers WHERE is_deleted = 1');
            await tx.execute('DELETE FROM products WHERE is_deleted = 1');
            await tx.execute('DELETE FROM invoices WHERE is_deleted = 1');
            await tx.execute('DELETE FROM repayments WHERE is_deleted = 1');
            await tx.execute('DELETE FROM cylinder_transactions WHERE is_deleted = 1');
            await tx.commit();
            return true;
        } catch (e) {
            console.error('Failed to hard delete all soft-deleted records', e);
            return false;
        }
    },
};
