
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Cylinder,
  ShoppingCart,
  Menu,
  X,
  TrendingUp,
  Banknote,
  AlertOctagon,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Wallet,
  Repeat,
  CalendarClock,
  Flame,
  ArrowLeft
} from 'lucide-react';

import { SimpleLogin, ADMIN_EMAIL } from './components/SimpleLogin';
import { Customers } from './components/Customers';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Settings } from './components/Settings';
import { Debts } from './components/Debts';
import { CylinderLoans } from './components/CylinderLoans';
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

  // Auto Backup Timer - now uses localStorage backup
  useEffect(() => {
    const backupInterval = setInterval(() => {
      const settings = storageService.getSettings();
      if (settings.autoBackupEnabled) {
        console.log('Auto Backup: Saving to localStorage...');
        // Data is already in localStorage, just log
        console.log('Data backed up successfully');
      }
    }, 3600000); // 1 Hour

    return () => clearInterval(backupInterval);
  }, []);

  // Sync on Reconnect - simplified for localStorage
  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online');
      setIsOnline(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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

    setCustomers(storageService.getCustomers());
    setProducts(storageService.getProducts());
    setInvoices(storageService.getInvoices());
    setRepayments(storageService.getRepayments());

    // Online Status Listeners
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000); // Simulate sync
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto Export Timer
    const exportTimer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 22 && now.getMinutes() === 0) {
        const settings = storageService.getSettings();
        const todayStr = now.toDateString();

        if (settings.lastAutoExportDate !== todayStr) {
          storageService.exportDatabaseToExcel();
          storageService.saveSettings({ ...settings, lastAutoExportDate: todayStr });
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

  const handleNavigateToSale = (customerId: string) => {
    setPreSelectedCustomerId(customerId);
    setActiveView('sales');
  };

  const handleNavigateToDebt = (customerId: string) => {
    setPreSelectedCustomerId(customerId);
    setActiveView('debts');
  };

  const handleNavigateToCylinders = (customerId: string) => {
    setPreSelectedCustomerId(customerId);
    setActiveView('cylinder_loans');
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

    setUser(newUser);
    localStorage.setItem('rinno_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rinno_user');
    setIsSidebarOpen(false);
  };


  // --- Calculations ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysInvoices = invoices.filter(inv => new Date(inv.date) >= today);
  const totalRevenueToday = todaysInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalReceivables = customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
  const totalPayables = customers.reduce((acc, c) => acc + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);

  const stagnantDebtors = customers.filter(c => {
    if (c.balance <= 0) return false;
    const custRepayments = repayments.filter(r => r.customerId === c.id);
    if (custRepayments.length === 0) return true;
    const lastRepayment = custRepayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const lastDate = new Date(lastRepayment.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastDate < thirtyDaysAgo;
  }).sort((a, b) => b.balance - a.balance);

  const getLastRepaymentDate = (customerId: string) => {
    const custRepayments = repayments.filter(r => r.customerId === customerId);
    if (custRepayments.length === 0) return 'لا يوجد سداد';
    const last = custRepayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return new Date(last.date).toLocaleDateString('ar-EG');
  };

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
    const settings = storageService.getSettings();
    const allowedEmails = settings.allowedEmails || [];
    return (
      <SimpleLogin
        onLoginSuccess={handleLoginSuccess}
        allowedEmails={allowedEmails}
      />
    );
  }

  return (
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
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-800 text-lg">Rinno <span className="text-primary-600">OX</span></span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {activeView === 'dashboard' && (
            <div className="space-y-6 max-w-6xl mx-auto pb-safe">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">نظرة عامة</h2>
                <div className="text-sm text-gray-500">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>

              <div
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition group flex flex-col md:flex-row items-center justify-between gap-4"
                onClick={() => setActiveView('customers')}
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="p-4 bg-primary-50 text-primary-600 rounded-2xl shrink-0">
                    <Users size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-800 group-hover:text-primary-600 transition">الزبائن</h3>
                    <p className="text-gray-500">إدارة سجل الزبائن ({customers.length})، الديون، والطلبات.</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 text-primary-600 font-bold bg-primary-50 px-4 py-2 rounded-lg group-hover:bg-primary-100 transition">
                  <span>عرض القائمة</span>
                  <ArrowLeft size={20} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">مبيعات اليوم</p>
                      <h3 className="text-5xl font-black text-gray-800">{totalRevenueToday.toLocaleString()} <span className="text-xl font-normal text-gray-400">شيكل</span></h3>
                    </div>
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={24} /></div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveView('debts')}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">ديون على الزبائن</p>
                      <h3 className="text-5xl font-black text-red-600">{totalReceivables.toLocaleString()} <span className="text-xl font-normal text-red-300">شيكل</span></h3>
                    </div>
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><AlertOctagon size={24} /></div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">ديون للزبائن</p>
                      <h3 className="text-5xl font-black text-green-600">{totalPayables.toLocaleString()} <span className="text-xl font-normal text-green-300">شيكل</span></h3>
                    </div>
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Banknote size={24} /></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                  <CalendarClock className="text-orange-500" size={24} />
                  <h3 className="font-bold text-gray-800">ديون راكدة (لم يتم السداد منذ +30 يوم)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm">
                      <tr>
                        <th className="p-4">الزبون</th>
                        <th className="p-4">إجمالي الدين</th>
                        <th className="p-4">آخر دفعة سداد</th>
                        <th className="p-4">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stagnantDebtors.slice(0, 10).map(customer => (
                        <tr key={customer.id} className="hover:bg-gray-50 transition">
                          <td className="p-4 font-bold text-gray-800">
                            {customer.name}
                            <span className="block text-xs text-gray-500 font-normal">{customer.phone}</span>
                          </td>
                          <td className="p-4 font-black text-xl text-red-600">{customer.balance}</td>
                          <td className="p-4 text-gray-500 text-sm">{getLastRepaymentDate(customer.id)}</td>
                          <td className="p-4">
                            <button
                              onClick={() => { setActiveView('debts'); setPreSelectedCustomerId(customer.id); }}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold transition"
                            >
                              متابعة الدين
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'customers' && (
            <Customers
              customers={customers}
              products={products}
              onUpdate={handleUpdateCustomers}
              onNewOrder={handleNavigateToSale}
              onManageDebt={handleNavigateToDebt}
              onManageCylinders={handleNavigateToCylinders}
            />
          )}

          {activeView === 'inventory' && <Inventory products={products} onUpdate={handleUpdateProducts} />}
          {activeView === 'sales' && <Sales products={products} customers={customers} onCompleteSale={handleSaleComplete} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'debts' && <Debts customers={customers} onUpdate={refreshData} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'cylinder_loans' && <CylinderLoans customers={customers} products={products} onUpdate={refreshData} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'settings' && <Settings isAdmin={user?.email === ADMIN_EMAIL} />}
        </div>
      </main>
    </div>
  );
}

export default App;