
export type CustomerType = string;

// Shared soft-delete fields
export interface SoftDeletable {
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Customer extends SoftDeletable {
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
  updatedAt?: string;
}

export interface Product extends SoftDeletable {
  id: string;
  name: string;
  size: string;
  isActive?: boolean;
  updatedAt?: string;
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

export interface Invoice extends SoftDeletable {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  items: CartItem[];
  totalAmount: number;
  paymentDetails: PaymentDetails;
  status: 'paid' | 'debt' | 'partial';
  updatedAt?: string;
}

export interface Repayment extends SoftDeletable {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  method: 'cash' | 'cheque';
  note?: string;
  updatedAt?: string;
}

// Unified soft-deleted record view for RecycleBin UI
export interface SoftDeletedRecord {
  id: string;
  type: 'customer' | 'invoice' | 'repayment' | 'cylinder_transaction' | 'product';
  record: any;
  deletedBy: string;
  deletedAt: string;
  description: string;
}

export interface CylinderTransaction extends SoftDeletable {
  id: string;
  customerId: string;
  customerName: string;
  productName: string;
  quantity: number;
  type: 'out' | 'in';
  date: string;
  note?: string;
  updatedAt?: string;
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

  // Delete Protection
  deletePassword?: string; // Default: '1234'
}

export type ViewState = 'dashboard' | 'customers' | 'inventory' | 'sales' | 'debts' | 'cylinder_loans' | 'reports' | 'settings' | 'calculator' | 'recycle_bin';

// Add UserProfile interface to fix the error in components/Login.tsx
export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
  accessToken?: string;
}
