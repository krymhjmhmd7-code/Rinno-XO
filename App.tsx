
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
  ArrowLeft,
  Cloud,
  Calculator as CalculatorIcon,
  Search,
  FileText,
  Phone
} from 'lucide-react';

import { SimpleLogin, ADMIN_EMAIL } from './components/SimpleLogin';
import { Customers } from './components/Customers';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Settings } from './components/Settings';
import { Debts } from './components/Debts';
import { CylinderLoans } from './components/CylinderLoans';
import { Calculator } from './components/Calculator';
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
  const [dashboardSearch, setDashboardSearch] = useState('');



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

    // Initialize Database Tables if connected
    import('./services/dbService').then(({ initializeDatabase }) => {
      initializeDatabase().then(success => {
        if (success) console.log('Database initialized successfully');
        else console.error('Failed to initialize database tables');
      });
    });

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
    return new Date(last.date).toLocaleDateString('en-US');
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
          <NavItem view="calculator" icon={CalculatorIcon} label="الآلة الحاسبة" />
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
            <div className="space-y-6 max-w-6xl mx-auto pb-safe">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">نظرة عامة</h2>
                <div className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>

              {/* Smart Backup Alert */}
              {(() => {
                const settings = storageService.getSettings();
                const lastDate = settings.lastBackupDate ? new Date(settings.lastBackupDate) : new Date(0);
                const now = new Date();
                const diffHours = Math.abs(now.getTime() - lastDate.getTime()) / 36e5;

                if (diffHours > 24) {
                  return (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center justify-between shadow-sm animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                          <Cloud size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-orange-800">تذكير النسخ الاحتياطي 🔔</h4>
                          <p className="text-xs text-orange-600">لم تقم بحفظ نسخة منذ {Math.floor(diffHours)} ساعة.</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const file = storageService.exportDatabaseToExcel(true) as File;
                            if (navigator.share) {
                              await navigator.share({
                                title: 'Rinno Backup',
                                text: `نسخة احتياطية - ${new Date().toLocaleDateString()}`,
                                files: [file]
                              });
                              window.location.reload();
                            } else {
                              storageService.exportDatabaseToExcel();
                              window.location.reload();
                            }
                          } catch (e) { console.error(e); }
                        }}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold shadow hover:bg-orange-700 transition"
                      >
                        حفظ ومشاركة الآن
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveView('sales')}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-primary-500 to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition active:scale-95"
                >
                  <ShoppingCart size={28} />
                  <span className="font-bold text-sm">بيع جديد</span>
                </button>
                <button
                  onClick={() => setActiveView('debts')}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transition active:scale-95"
                >
                  <Wallet size={28} />
                  <span className="font-bold text-sm">تسجيل سداد</span>
                </button>
                <button
                  onClick={() => setActiveView('cylinder_loans')}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition active:scale-95"
                >
                  <Cylinder size={28} />
                  <span className="font-bold text-sm">مداينة اسطوانات</span>
                </button>
                <button
                  onClick={() => setActiveView('customers')}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl shadow-lg hover:shadow-xl transition active:scale-95"
                >
                  <Users size={28} />
                  <span className="font-bold text-sm">سجل الزبائن</span>
                </button>
              </div>

              {/* Customer List with Search - Full Details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center gap-3 justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Users className="text-primary-600" size={24} />
                    <h3 className="font-bold text-gray-800">قائمة الزبائن ({customers.length})</h3>
                  </div>
                  <div className="relative w-full md:w-80">
                    <input
                      type="text"
                      placeholder="بحث بالاسم أو الرقم..."
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>
                <div className="overflow-y-auto">
                  {customers
                    .filter(c =>
                      dashboardSearch === '' ||
                      c.name.includes(dashboardSearch) ||
                      c.phone.includes(dashboardSearch) ||
                      c.serialNumber.toString().includes(dashboardSearch)
                    )
                    .map(customer => (
                      <div
                        key={customer.id}
                        className="p-4 border-b border-gray-100 hover:bg-gray-50 transition"
                      >
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-xl shrink-0">
                              {customer.serialNumber}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-lg text-gray-800">{customer.name}</h4>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                                <span className="flex items-center gap-1"><Phone size={14} /> {customer.phone}</span>
                                <span className="text-gray-300">|</span>
                                <span>{customer.city}</span>
                              </div>

                              {/* Cylinder Balances */}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {customer.cylinderBalance && Object.entries(customer.cylinderBalance).map(([name, qty]) => {
                                  if (qty === 0) return null;
                                  return (
                                    <span key={name} className={`text-xs px-2 py-0.5 rounded border ${qty > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                      {name}: {qty}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full md:w-auto">
                            <span className={`font-black text-xl px-4 py-2 rounded-lg ${customer.balance > 0 ? 'bg-red-50 text-red-600' :
                              customer.balance < 0 ? 'bg-green-50 text-green-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                              {customer.balance === 0 ? '0 شيكل' : customer.balance > 0 ? `${customer.balance} عليه` : `${Math.abs(customer.balance)} له`}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setPreSelectedCustomerId(customer.id); setActiveView('customers'); }}
                                className="flex flex-col items-center p-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition min-w-[50px]"
                                title="كشف حساب"
                              >
                                <span className="text-xs font-bold mb-1">كشف</span>
                                <FileText size={24} />
                              </button>
                              <button
                                onClick={() => { setPreSelectedCustomerId(customer.id); setActiveView('cylinder_loans'); }}
                                className="flex flex-col items-center p-3 px-4 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl transition min-w-[50px]"
                                title="اسطوانات"
                              >
                                <span className="text-xs font-bold mb-1">اسطوانات</span>
                                <Cylinder size={24} />
                              </button>
                              <button
                                onClick={() => { setPreSelectedCustomerId(customer.id); setActiveView('sales'); }}
                                className="flex flex-col items-center p-3 px-8 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-xl transition min-w-[100px]"
                              >
                                <span className="text-xs font-bold mb-1">بيع</span>
                                <ShoppingCart size={24} />
                              </button>
                              <button
                                onClick={() => { setPreSelectedCustomerId(customer.id); setActiveView('debts'); }}
                                className="flex flex-col items-center p-3 px-4 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition min-w-[50px]"
                              >
                                <span className="text-xs font-bold mb-1">سداد</span>
                                <Wallet size={24} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Stats Cards - At Bottom */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">مبيعات اليوم</p>
                      <h3 className="text-4xl font-black text-gray-800">{totalRevenueToday.toLocaleString()} <span className="text-lg font-normal text-gray-400">شيكل</span></h3>
                    </div>
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={24} /></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveView('debts')}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">ديون على الزبائن</p>
                      <h3 className="text-4xl font-black text-red-600">{totalReceivables.toLocaleString()} <span className="text-lg font-normal text-red-300">شيكل</span></h3>
                    </div>
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><AlertOctagon size={24} /></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">ديون للزبائن</p>
                      <h3 className="text-4xl font-black text-green-600">{totalPayables.toLocaleString()} <span className="text-lg font-normal text-green-300">شيكل</span></h3>
                    </div>
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Banknote size={24} /></div>
                  </div>
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
              initialCustomerId={preSelectedCustomerId}
            />
          )}

          {activeView === 'inventory' && <Inventory products={products} onUpdate={handleUpdateProducts} />}
          {activeView === 'sales' && <Sales products={products} customers={customers} onCompleteSale={handleSaleComplete} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'debts' && <Debts customers={customers} onUpdate={refreshData} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'cylinder_loans' && <CylinderLoans customers={customers} products={products} onUpdate={refreshData} initialCustomerId={preSelectedCustomerId} />}
          {activeView === 'settings' && <Settings isAdmin={user?.email === ADMIN_EMAIL} />}
          {activeView === 'calculator' && <Calculator />}
        </div>
      </main>
    </div>
  );
}

export default App;