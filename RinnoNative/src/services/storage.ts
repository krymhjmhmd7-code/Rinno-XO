import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer, Product, Invoice, Repayment, CylinderTransaction, AppSettings } from '../types';

const KEYS = {
    CUSTOMERS: 'rinno_customers',
    PRODUCTS: 'rinno_products',
    INVOICES: 'rinno_invoices',
    REPAYMENTS: 'rinno_repayments',
    CYLINDER_TRANSACTIONS: 'rinno_cylinder_transactions',
    SETTINGS: 'rinno_settings',
    CUSTOMER_TYPES: 'rinno_customer_types',
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

    // Recalculate all customer balances from invoices and repayments
    async recalculateCustomerBalances(): Promise<void> {
        const customers = await this.getCustomers();
        const invoices = await this.getInvoices();
        const repayments = await this.getRepayments();

        let hasChanges = false;

        const updatedCustomers = customers.map(customer => {
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
            await this.saveCustomers(updatedCustomers);
            console.log('Customer balances recalculated and corrected.');
        }
    }
}

export const storageService = new StorageService();
