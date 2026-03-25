import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer, Product, Invoice, Repayment, CylinderTransaction, AppSettings, DeletedItem } from '../types';

const KEYS = {
    CUSTOMERS: 'rinno_customers',
    PRODUCTS: 'rinno_products',
    INVOICES: 'rinno_invoices',
    REPAYMENTS: 'rinno_repayments',
    CYLINDER_TRANSACTIONS: 'rinno_cylinder_transactions',
    SETTINGS: 'rinno_settings',
    CUSTOMER_TYPES: 'rinno_customer_types',
    RECYCLE_BIN: 'rinno_recycle_bin',
};

class StorageService {
    // Customers
    async getCustomers(): Promise<Customer[]> {
        const data = await AsyncStorage.getItem(KEYS.CUSTOMERS);
        return data ? JSON.parse(data) : [];
    }

    async saveCustomers(customers: Customer[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
    }

    // Products
    async getProducts(): Promise<Product[]> {
        const data = await AsyncStorage.getItem(KEYS.PRODUCTS);
        return data ? JSON.parse(data) : this.getDefaultProducts();
    }

    async saveProducts(products: Product[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
    }

    getDefaultProducts(): Product[] {
        return [
            { id: '1', name: 'اسطوانة 12 كغ', size: '12kg', stock: 100, minStock: 20, isActive: true },
            { id: '2', name: 'اسطوانة 48 كغ', size: '48kg', stock: 50, minStock: 10, isActive: true },
        ];
    }

    // Invoices
    async getInvoices(): Promise<Invoice[]> {
        const data = await AsyncStorage.getItem(KEYS.INVOICES);
        return data ? JSON.parse(data) : [];
    }

    async saveInvoices(invoices: Invoice[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
    }

    // Repayments
    async getRepayments(): Promise<Repayment[]> {
        const data = await AsyncStorage.getItem(KEYS.REPAYMENTS);
        return data ? JSON.parse(data) : [];
    }

    async saveRepayments(repayments: Repayment[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.REPAYMENTS, JSON.stringify(repayments));
    }

    // Cylinder Transactions
    async getCylinderTransactions(): Promise<CylinderTransaction[]> {
        const data = await AsyncStorage.getItem(KEYS.CYLINDER_TRANSACTIONS);
        return data ? JSON.parse(data) : [];
    }

    async saveCylinderTransactions(transactions: CylinderTransaction[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.CYLINDER_TRANSACTIONS, JSON.stringify(transactions));
    }

    // Settings
    async getSettings(): Promise<AppSettings> {
        const data = await AsyncStorage.getItem(KEYS.SETTINGS);
        return data ? JSON.parse(data) : {};
    }

    async saveSettings(settings: AppSettings): Promise<void> {
        await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    }

    // Customer Types
    async getCustomerTypes(): Promise<string[]> {
        const data = await AsyncStorage.getItem(KEYS.CUSTOMER_TYPES);
        return data ? JSON.parse(data) : ['تاجر', 'موزع', 'مستهلك'];
    }

    async saveCustomerTypes(types: string[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.CUSTOMER_TYPES, JSON.stringify(types));
    }

    // --- Recycle Bin ---
    async getRecycleBin(): Promise<DeletedItem[]> {
        const data = await AsyncStorage.getItem(KEYS.RECYCLE_BIN);
        return data ? JSON.parse(data) : [];
    }

    async moveToRecycleBin(type: DeletedItem['type'], data: any, description: string): Promise<void> {
        const bin = await this.getRecycleBin();
        bin.unshift({
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
            type,
            data: JSON.parse(JSON.stringify(data)),
            deletedBy: 'تطبيق الموبايل',
            deletedAt: new Date().toISOString(),
            description,
        });
        await AsyncStorage.setItem(KEYS.RECYCLE_BIN, JSON.stringify(bin));
    }

    async restoreFromRecycleBin(itemId: string): Promise<boolean> {
        const bin = await this.getRecycleBin();
        const index = bin.findIndex(i => i.id === itemId);
        if (index === -1) return false;

        const item = bin[index];
        let success = false;

        switch (item.type) {
            case 'customer': {
                const customers = await this.getCustomers();
                if (!customers.find(c => c.id === item.data.id)) {
                    customers.push(item.data);
                    await this.saveCustomers(customers);
                }
                success = true;
                break;
            }
            case 'product': {
                const products = await this.getProducts();
                if (!products.find(p => p.id === item.data.id)) {
                    products.push(item.data);
                    await this.saveProducts(products);
                }
                success = true;
                break;
            }
            case 'invoice': {
                const invoices = await this.getInvoices();
                if (!invoices.find(i => i.id === item.data.id)) {
                    invoices.unshift(item.data);
                    await this.saveInvoices(invoices);
                    // Restore customer balance
                    const customers = await this.getCustomers();
                    const ci = customers.findIndex(c => c.id === item.data.customerId);
                    if (ci !== -1) {
                        customers[ci].balance = (customers[ci].balance || 0) + (item.data.paymentDetails?.debt || 0);
                        customers[ci].totalPurchases = (customers[ci].totalPurchases || 0) + item.data.totalAmount;
                        await this.saveCustomers(customers);
                    }
                }
                success = true;
                break;
            }
            case 'repayment': {
                const repayments = await this.getRepayments();
                if (!repayments.find(r => r.id === item.data.id)) {
                    repayments.unshift(item.data);
                    await this.saveRepayments(repayments);
                    const customers = await this.getCustomers();
                    const ci = customers.findIndex(c => c.id === item.data.customerId);
                    if (ci !== -1) {
                        customers[ci].balance = (customers[ci].balance || 0) - item.data.amount;
                        await this.saveCustomers(customers);
                    }
                }
                success = true;
                break;
            }
            case 'cylinder_transaction': {
                const txs = await this.getCylinderTransactions();
                if (!txs.find(t => t.id === item.data.id)) {
                    txs.unshift(item.data);
                    await this.saveCylinderTransactions(txs);
                }
                success = true;
                break;
            }
        }

        if (success) {
            bin.splice(index, 1);
            await AsyncStorage.setItem(KEYS.RECYCLE_BIN, JSON.stringify(bin));
        }
        return success;
    }

    async restoreMultiple(itemIds: string[]): Promise<number> {
        let restored = 0;
        for (const id of itemIds) {
            if (await this.restoreFromRecycleBin(id)) restored++;
        }
        return restored;
    }

    async emptyRecycleBin(): Promise<void> {
        await AsyncStorage.setItem(KEYS.RECYCLE_BIN, JSON.stringify([]));
    }

    // Recalculate all customer balances
    async recalculateCustomerBalances(): Promise<void> {
        const customers = await this.getCustomers();
        const invoices = await this.getInvoices();
        const repayments = await this.getRepayments();

        let hasChanges = false;

        const updatedCustomers = customers.map(customer => {
            const invoiceDebt = invoices
                .filter(inv => inv.customerId === customer.id)
                .reduce((sum, inv) => sum + (inv.paymentDetails?.debt || 0), 0);

            const totalRepayments = repayments
                .filter(rep => rep.customerId === customer.id)
                .reduce((sum, rep) => sum + rep.amount, 0);

            const correctBalance = invoiceDebt - totalRepayments;

            if (customer.balance !== correctBalance) {
                hasChanges = true;
                return { ...customer, balance: correctBalance };
            }
            return customer;
        });

        if (hasChanges) {
            await this.saveCustomers(updatedCustomers);
        }
    }
}

export const storageService = new StorageService();
