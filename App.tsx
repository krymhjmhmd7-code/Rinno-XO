
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Cylinder,
  ShoppingCart,
  Menu,
  X,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Wallet,
  Repeat,
  Flame,
  Trash2,
  Calculator as CalculatorIcon,
} from 'lucide-react';

import { SimpleLogin, ADMIN_EMAIL } from './components/SimpleLogin';
import { Customers } from './components/Customers';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Settings } from './components/Settings';
import { Debts } from './components/Debts';
import { CylinderLoans } from './components/CylinderLoans';
import { Calculator } from './components/Calculator';
import { RecycleBin } from './components/RecycleBin';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { storageService } from './services/storage';
import { Customer, Product, Invoice, ViewState, Repayment } from './types';

// Simple User State
interface SimpleUser {
  email: string;
  name: string;
  isAdmin: boolean;
}

// Main Application Component
export const App: React.FC = () => {

  const [user, setUser] = useState<SimpleUser | null>(null);
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);

  // Navigation State
  const [preSelectedCustomerId, setPreSelectedCustomerId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Migrate localStorage to IndexedDB on first run (#13)
  useEffect(() => {
    import('./services/idbStorage').then(({ idbStorage }) => {
      idbStorage.migrateFromLocalStorage();
    });
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('rinno_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        const settings = storageService.getSettings();
        const existingEmails = settings.allowedEmails || [];

        // Grant access if list is empty and user is admin, or user is in list
        if ((existingEmails.length === 0 && parsedUser.email === ADMIN_EMAIL) || existingEmails.includes(parsedUser.email)) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('rinno_user');
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem('rinno_user');
      }
    }

    // Load initial data from LocalStorage
    storageService.recalculateCustomerBalances(); // Fix balances on local data first
    setCustomers(storageService.getCustomers());
    setProducts(storageService.getProducts());
    setInvoices(storageService.getInvoices());
    setRepayments(storageService.getRepayments());

    // Trigger Sync from Turso (if online)
    const syncData = async () => {
      if (navigator.onLine) {
        setIsSyncing(true);
        console.log('Starting active sync from Turso...');
        // Initialize DB tables first to ensure metadata table exists
        const { initializeDatabase } = await import('./services/dbService');
        await initializeDatabase();

        await storageService.syncAllFromDb();

        // Recalculate balances AFTER sync to fix any discrepancies
        storageService.recalculateCustomerBalances();

        // Refresh state after sync with corrected balances
        setCustomers(storageService.getCustomers());
        setProducts(storageService.getProducts());
        setInvoices(storageService.getInvoices());
        setRepayments(storageService.getRepayments());
        setIsSyncing(false);
        console.log('Active sync completed');
      }
    };
    syncData();

    // Online Status Listeners
    const handleOnline = () => {
      setIsOnline(true);
      syncData(); // Re-sync when coming back online
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto Export Timer
    const exportTimer = setInterval(() => {
      const settings = storageService.getSettings();
      const now = new Date();
      if (now.getHours() === 22 && now.getMinutes() === 0) {
        const todayStr = now.toDateString();

        // Updated to use lastBackupDate instead of legacy property
        const lastBackupStr = settings.lastBackupDate ? new Date(settings.lastBackupDate).toDateString() : '';

        if (lastBackupStr !== todayStr) {
          storageService.exportDatabaseToExcel();
          // exportDatabaseToExcel updates the date automatically now
        }
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(exportTimer);
    };
  }, []);

  const handleUpdateCustomers = (newCustomers: Customer[]) => {
    setCustomers(newCustomers);
    storageService.saveCustomers(newCustomers);
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    storageService.saveProducts(newProducts);
  };

  const handleSaleComplete = (invoice: Invoice) => {
    storageService.addInvoice(invoice);
    setInvoices(storageService.getInvoices());
    setProducts(storageService.getProducts());
    setCustomers(storageService.getCustomers());
  };

  // BUG-29 FIX: Wrap setActiveView to clear stale preSelectedCustomerId
  const navigateTo = (view: ViewState, customerId?: string) => {
    setPreSelectedCustomerId(customerId || null);
    setActiveView(view);
  };

  const handleNavigateToSale = (customerId: string) => {
    navigateTo('sales', customerId);
  };

  const handleNavigateToDebt = (customerId: string) => {
    navigateTo('debts', customerId);
  };

  const handleNavigateToCylinders = (customerId: string) => {
    navigateTo('cylinder_loans', customerId);
  };

  const refreshData = () => {
    setCustomers(storageService.getCustomers());
    setInvoices(storageService.getInvoices());
    setRepayments(storageService.getRepayments());
  };

  const handleLoginSuccess = (email: string) => {
    const settings = storageService.getSettings();
    const existingEmails = settings.allowedEmails || [];
    const isAdmin = email === ADMIN_EMAIL;

    // If list is empty, only admin can access and initialize
    if (existingEmails.length === 0 && isAdmin) {
      const newSettings = { ...settings, allowedEmails: [ADMIN_EMAIL], adminEmail: ADMIN_EMAIL };
      storageService.saveSettings(newSettings);
    }

    const newUser: SimpleUser = {
      email,
      name: email.split('@')[0],
      isAdmin
    };

    // Initialize Database Tables if connected
    import('./services/dbService').then(({ initializeDatabase }) => {
      initializeDatabase().then(success => {
        if (success) console.log('Database initialized successfully');
        else console.error('Failed to initialize database tables');
      });
    });

    setUser(newUser);
    localStorage.setItem('rinno_user', JSON.stringify(newUser));
    localStorage.setItem('rinno_user_email', email);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rinno_user');
    setIsSidebarOpen(false);
  };

  // --- Calculations are now in Dashboard.tsx (memoized) ---

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveView(view); setIsSidebarOpen(false); setPreSelectedCustomerId(null); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1
        ${activeView === view ? 'bg-primary-50 text-primary-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  // --- Login Guard ---
  if (!user) {
    return (
      <SimpleLogin
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <ErrorBoundary>
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 right-0 h-full w-64 bg-white border-l border-gray-200 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
              <Flame fill="white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight leading-none">Rinno</h1>
              <span className="text-primary-600 font-bold text-sm tracking-widest">OX</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X size={24} />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-800 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>

        <nav className="p-4">
          <NavItem view="dashboard" icon={LayoutDashboard} label="لوحة التحكم" />
          <NavItem view="customers" icon={Users} label="الزبائن" />
          <NavItem view="inventory" icon={Cylinder} label="الأنواع والأسعار" />
          <NavItem view="sales" icon={ShoppingCart} label="بيع جديد" />
          <NavItem view="debts" icon={Wallet} label="الديون" />
          <NavItem view="cylinder_loans" icon={Repeat} label="مداينة الاسطوانات" />
          <NavItem view="calculator" icon={CalculatorIcon} label="الآلة الحاسبة" />
          <NavItem view="recycle_bin" icon={Trash2} label="سلة المحذوفات" />
          <div className="pt-4 mt-4 border-t border-gray-100">
            <NavItem view="settings" icon={SettingsIcon} label="الإعدادات" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors mt-2"
            >
              <WifiOff size={20} />
              <span>تسجيل خروج</span>
            </button>
          </div>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-100 bg-white">
          <div className="mb-2 flex items-center gap-2 text-xs justify-center bg-gray-50 p-2 rounded">
            {isSyncing ? (
              <span className="flex items-center gap-2 text-blue-600 font-bold"><RefreshCw size={14} className="animate-spin" /> جاري المزامنة...</span>
            ) : isOnline ? (
              <span className="flex items-center gap-2 text-green-600"><Wifi size={14} /> متصل (محفوظ)</span>
            ) : (
              <span className="flex items-center gap-2 text-orange-600"><WifiOff size={14} /> غير متصل (محفوظ محلياً)</span>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white p-4 border-b border-gray-200 flex justify-between items-center lg:hidden shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600">
              <Menu size={24} />
            </button>
            {activeView !== 'dashboard' && (
              <button
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-1 text-primary-600 font-bold text-sm bg-primary-50 px-3 py-1.5 rounded-lg"
              >
                <LayoutDashboard size={16} />
                <span>الرئيسية</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-800 text-lg">Rinno <span className="text-primary-600">OX</span></span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {activeView === 'dashboard' && (
            <Dashboard
              customers={customers}
              invoices={invoices}
              repayments={repayments}
              setActiveView={setActiveView}
              setPreSelectedCustomerId={setPreSelectedCustomerId}
              onDataRefresh={refreshData}
            />
          )}

          {activeView === 'customers' && (
            <Customers
              customers={customers}
              products={products}
              onUpdate={handleUpdateCustomers}
              onNewOrder={handleNavigateToSale}
              onManageDebt={handleNavigateToDebt}
              onManageCylinders={handleNavigateToCylinders}
              initialCustomerId={preSelectedCustomerId}
            />
          )}

          {activeView === 'inventory' && <Inventory products={products} onUpdate={handleUpdateProducts} />}
          {activeView === 'sales' && <Sales products={products} customers={customers} onCompleteSale={handleSaleComplete} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'debts' && <Debts customers={customers} onUpdate={refreshData} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'cylinder_loans' && <CylinderLoans customers={customers} products={products} onUpdate={refreshData} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'settings' && <Settings isAdmin={user?.email === ADMIN_EMAIL} />}
          {activeView === 'calculator' && <Calculator />}
          {activeView === 'recycle_bin' && <RecycleBin onUpdate={refreshData} />}
        </div>
      </main>

      {/* Sync Status Toast */}
      {isSyncing && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl z-[100] flex items-center gap-3 animate-pulse">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm font-bold">جاري المزامنة...</span>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

export default App;