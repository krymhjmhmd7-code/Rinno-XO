import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, Users, TrendingUp, Banknote, AlertOctagon,
  Wallet, Cylinder, Cloud, Search, FileText, Phone
} from 'lucide-react';
import { Customer, Invoice, Repayment, ViewState } from '../types';
import { storageService } from '../services/storage';

interface DashboardProps {
  customers: Customer[];
  invoices: Invoice[];
  repayments: Repayment[];
  setActiveView: (view: ViewState) => void;
  setPreSelectedCustomerId: (id: string | null) => void;
  onDataRefresh: () => void;
}

const CUSTOMERS_PER_PAGE = 50;

export const Dashboard: React.FC<DashboardProps> = ({
  customers,
  invoices,
  repayments,
  setActiveView,
  setPreSelectedCustomerId,
  onDataRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(CUSTOMERS_PER_PAGE);

  // Memoized: today's date (recalculated only when invoices change)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [invoices]);

  // Memoized: today's revenue
  const totalRevenueToday = useMemo(() => {
    return invoices
      .filter(inv => new Date(inv.date) >= today)
      .reduce((acc, inv) => acc + inv.totalAmount, 0);
  }, [invoices, today]);

  // Memoized: total receivables (owed BY customers)
  const totalReceivables = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
  }, [customers]);

  // Memoized: total payables (owed TO customers)
  const totalPayables = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
  }, [customers]);

  // Memoized: filtered customers (evaluated only when search or customers change)
  const filteredCustomers = useMemo(() => {
    if (searchQuery === '') return customers;
    return customers.filter(c =>
      c.name.includes(searchQuery) ||
      c.phone.includes(searchQuery) ||
      c.serialNumber.toString().includes(searchQuery)
    );
  }, [customers, searchQuery]);

  // Paginated slice
  const visibleCustomers = filteredCustomers.slice(0, visibleCount);
  const hasMore = filteredCustomers.length > visibleCount;

  // Backup alert logic (computed once per render, cheap)
  const backupAlert = useMemo(() => {
    const settings = storageService.getSettings();
    const lastDate = settings.lastBackupDate ? new Date(settings.lastBackupDate) : new Date(0);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - lastDate.getTime()) / 36e5;
    return diffHours > 24 ? Math.floor(diffHours) : null;
  }, []);

  const handleBackup = async () => {
    try {
      const file = storageService.exportDatabaseToExcel(true) as File;
      if (navigator.share) {
        await navigator.share({
          title: 'Rinno Backup',
          text: `نسخة احتياطية - ${new Date().toLocaleDateString()}`,
          files: [file]
        });
      } else {
        storageService.exportDatabaseToExcel();
      }
      onDataRefresh();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-safe">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">نظرة عامة</h2>
        <div className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Smart Backup Alert */}
      {backupAlert !== null && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full text-orange-600">
              <Cloud size={20} />
            </div>
            <div>
              <h4 className="font-bold text-orange-800">تذكير النسخ الاحتياطي 🔔</h4>
              <p className="text-xs text-orange-600">لم تقم بحفظ نسخة منذ {backupAlert} ساعة.</p>
            </div>
          </div>
          <button
            onClick={handleBackup}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold shadow hover:bg-orange-700 transition"
          >
            حفظ ومشاركة الآن
          </button>
        </div>
      )}

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

      {/* Customer List with Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center gap-3 justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Users className="text-primary-600" size={24} />
            <h3 className="font-bold text-gray-800">قائمة الزبائن ({filteredCustomers.length})</h3>
          </div>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="بحث بالاسم أو الرقم..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(CUSTOMERS_PER_PAGE); }}
              className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {visibleCustomers.map(customer => (
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
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="p-4 text-center border-t border-gray-100">
              <button
                onClick={() => setVisibleCount(prev => prev + CUSTOMERS_PER_PAGE)}
                className="px-6 py-2 bg-primary-50 text-primary-700 rounded-lg font-bold hover:bg-primary-100 transition"
              >
                عرض المزيد ({filteredCustomers.length - visibleCount} متبقي)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
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
  );
};
