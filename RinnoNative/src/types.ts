export type CustomerType = string;

export interface Customer {
    id: string;
    serialNumber: number;
    name: string;
    type: CustomerType;
    city: string;
    village: string;
    neighborhood: string;
    phone: string;
    whatsapp: string;
    totalPurchases: number;
    balance: number;
    cylinderBalance?: { [productName: string]: number };
}

export interface Product {
    id: string;
    name: string;
    size: string;
    stock: number;
    minStock: number;
    isActive?: boolean;
}

export interface CartItem {
    productId: string;
    productName: string;
    quantity: number;
}

export interface PaymentDetails {
    cash: number;
    cheque: number;
    debt: number;
    chequeNumber?: string;
    chequeDate?: string;
}

export interface Invoice {
    id: string;
    customerId: string;
    customerName: string;
    date: string;
    items: CartItem[];
    totalAmount: number;
    paymentDetails: PaymentDetails;
    status: 'paid' | 'debt' | 'partial';
}

export interface Repayment {
    id: string;
    customerId: string;
    customerName: string;
    amount: number;
    date: string;
    method: 'cash' | 'cheque';
    note?: string;
}

export interface CylinderTransaction {
    id: string;
    customerId: string;
    customerName: string;
    productName: string;
    quantity: number;
    type: 'out' | 'in';
    date: string;
    note?: string;
}

export interface AppSettings {
    adminPassword?: string;
}
