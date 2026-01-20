
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
  allowedEmails?: string[];
  // adminEmail will be the first user to log in if list is empty
  adminEmail?: string;

  // Backup Settings
  backupEmail?: string; // Legacy/Optional
  backupWhatsapp?: string; // Preferred WhatsApp number
  lastBackupDate?: string; // ISO Date String
  autoBackupEnabled?: boolean;

  // Storage Settings
  storageLimitMB?: number; // Configurable Plan Limit (Default 9000MB)

  // Legacy Google Sheets
  spreadsheetId?: string;
  needsSync?: boolean;
}

export type ViewState = 'dashboard' | 'customers' | 'inventory' | 'sales' | 'debts' | 'cylinder_loans' | 'reports' | 'settings' | 'calculator';

// Add UserProfile interface to fix the error in components/Login.tsx
export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
  accessToken?: string;
}
