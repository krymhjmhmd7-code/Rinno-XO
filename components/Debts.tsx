
import React, { useState, useEffect } from 'react';
import { Customer, Repayment, Invoice } from '../types';
import { storageService } from '../services/storage';
import { Wallet, Search, ArrowRight, Calendar, Banknote, ScrollText, CheckCircle, PlusCircle, AlertCircle, Filter, FileText } from 'lucide-react';

interface DebtsProps {
  customers: Customer[];
  onUpdate: () => void;
  initialCustomerId?: string | null;
}

export const Debts: React.FC<DebtsProps> = ({ customers, onUpdate, initialCustomerId }) => {
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // UI State - Changed default to 'add_debt'
  const [activeTab, setActiveTab] = useState<'repay' | 'add_debt'>('add_debt');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(true); // Default: Show Debtors Only (Red)

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<'cash' | 'cheque'>('cash');
  const [note, setNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setRepayments(storageService.getRepayments());
    setInvoices(storageService.getInvoices());
  }, []);

  // Auto-select customer if provided via navigation
  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      // If the customer isn't a debtor, show all so they appear in the list
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer && customer.balance <= 0) {
        setShowDebtorsOnly(false);
      }
      setSearchTerm(customer?.name || '');
    }
  }, [initialCustomerId, customers]);

  const totalDebt = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
  const debtorsCount = customers.filter(c => c.balance > 0).length;

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.includes(searchTerm) || c.phone.includes(searchTerm) || c.serialNumber.toString().includes(searchTerm);
    const matchesFilter = showDebtorsOnly ? c.balance > 0 : true;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    // Sort debtors first, then by name
    if (a.balance > 0 && b.balance <= 0) return -1;
    if (a.balance <= 0 && b.balance > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  // Function to get the last significant note/statement for a customer
  const getLastNote = (customerId: string) => {
    // 1. Find Repayments for this customer
    const custRepayments = repayments.filter(r => r.customerId === customerId);
    // 2. Find Invoices (specifically manual debts or regular invoices)
    const custInvoices = invoices.filter(i => i.customerId === customerId);

    // Combine and sort by date descending
    const allActivities = [
      ...custRepayments.map(r => ({ date: new Date(r.date), type: 'repayment', note: r.note, amount: r.amount })),
      ...custInvoices.map(i => ({
        date: new Date(i.date),
        type: 'invoice',
        // Check if it's a manual debt (single item usually) or regular invoice
        note: i.items[0]?.productId === 'manual-debt' ? i.items[0].productName : `فاتورة مبيعات`,
        amount: i.totalAmount
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (allActivities.length > 0) {
      const last = allActivities[0];
      // Return the note if it exists, otherwise generic description
      return last.note || (last.type === 'invoice' ? 'فاتورة' : 'سداد');
    }
    return '-';
  };

  const handleRepayment = () => {
    if (!selectedCustomerId || !amount || Number(amount) <= 0) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    const newRepayment: Repayment = {
      id: Date.now().toString(),
      customerId: selectedCustomerId,
      customerName: customer.name,
      amount: Number(amount),
      date: new Date().toISOString(),
      method,
      note
    };

    storageService.addRepayment(newRepayment);
    setRepayments(storageService.getRepayments());
    onUpdate();
    resetForm();
    showSuccessMessage();
  };

  const handleAddOldDebt = () => {
    if (!selectedCustomerId || !amount || Number(amount) <= 0) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    storageService.addManualDebt(selectedCustomerId, customer.name, Number(amount), note || 'رصيد سابق / دين يدوي');
    setInvoices(storageService.getInvoices()); // Refresh local invoices to update list immediately
    onUpdate();
    resetForm();
    showSuccessMessage();
  };

  const resetForm = () => {
    setAmount('');
    setNote('');
    // Do not reset selected customer, keep them selected for continuous entry
    // setSelectedCustomerId(''); 
  };

  const showSuccessMessage = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    // If adding debt, clear amount. If repaying, maybe suggest amount?
    if (activeTab === 'repay' && customer.balance > 0) {
      setAmount(customer.balance);
    } else {
      setAmount('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="text-primary-600" />
          إدارة الديون والتحصيل
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex justify-between items-center">
          <div>
            <p className="text-red-600 font-bold mb-1">إجمالي الديون (على الزبائن)</p>
            <h3 className="text-4xl font-black text-red-700">{totalDebt.toLocaleString()} شيكل</h3>
          </div>
          <div className="p-3 bg-white rounded-full text-red-500 shadow-sm"><Wallet size={32} /></div>
        </div>
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex justify-between items-center">
          <div>
            <p className="text-blue-600 font-bold mb-1">عدد المدينين</p>
            <h3 className="text-4xl font-black text-blue-700">{debtorsCount} زبون</h3>
          </div>
          <div className="p-3 bg-white rounded-full text-blue-500 shadow-sm"><Search size={32} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Action Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 sticky top-4 overflow-hidden">

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => { setActiveTab('repay'); resetForm(); }}
                className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'repay' ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                تسجيل سداد
              </button>
              <button
                onClick={() => { setActiveTab('add_debt'); resetForm(); }}
                className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'add_debt' ? 'bg-red-50 text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                إضافة دين قديم
              </button>
            </div>

            <div className="p-6 space-y-4">
              <h3 className="font-bold text-lg mb-2 text-gray-800">
                {activeTab === 'repay' ? 'تسجيل دفعة جديدة' : 'إضافة رصيد سابق (دين)'}
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الزبون</label>
                <select
                  className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- اختر الزبون --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.balance > 0 ? `عليه: ${c.balance}` : c.balance < 0 ? `له: ${Math.abs(c.balance)}` : '0'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'repay' ? 'قيمة الدفعة (شيكل)' : 'قيمة الدين (شيكل)'}
                </label>
                <input
                  type="number"
                  className="w-full p-3 border rounded-lg font-bold text-xl"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                />
              </div>

              {activeTab === 'repay' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMethod('cash')}
                      className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-bold ${method === 'cash' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600'}`}
                    >
                      <Banknote size={20} /> نقداً
                    </button>
                    <button
                      onClick={() => setMethod('cheque')}
                      className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-bold ${method === 'cheque' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-gray-200 text-gray-600'}`}
                    >
                      <ScrollText size={20} /> شيك
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات / بيان</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-lg"
                  placeholder={activeTab === 'repay' ? "رقم الشيك، ملاحظات..." : "رصيد افتتاحي، دين سابق..."}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {showSuccess && (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg flex items-center justify-center gap-2 animate-bounce">
                  <CheckCircle size={20} /> تم الحفظ بنجاح
                </div>
              )}

              <button
                onClick={activeTab === 'repay' ? handleRepayment : handleAddOldDebt}
                disabled={!selectedCustomerId || !amount}
                className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition
                  ${!selectedCustomerId || !amount
                    ? 'bg-gray-300 cursor-not-allowed'
                    : activeTab === 'repay'
                      ? 'bg-primary-600 hover:bg-primary-700'
                      : 'bg-red-600 hover:bg-red-700'}`}
              >
                {activeTab === 'repay' ? 'حفظ السداد' : 'إضافة الدين'}
              </button>
            </div>
          </div>
        </div>

        {/* Customers List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
              <h3 className="font-bold text-gray-800">قائمة الزبائن والأرصدة</h3>
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Filter Toggle */}
                <button
                  onClick={() => setShowDebtorsOnly(!showDebtorsOnly)}
                  className={`p-2 rounded-lg border flex items-center gap-2 text-sm font-bold transition ${showDebtorsOnly ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                >
                  <Filter size={16} />
                  {showDebtorsOnly ? 'إظهار المدينين فقط' : 'إظهار الجميع'}
                </button>

                <div className="relative flex-1 md:w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary-500"
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 text-sm sticky top-0 z-10">
                  <tr>
                    <th className="p-4">#</th>
                    <th className="p-4">الزبون</th>
                    <th className="p-4 hidden md:table-cell">آخر بيان / ملاحظة</th>
                    <th className="p-4">الرصيد</th>
                    <th className="p-4">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا يوجد زبائن مطابقين.</td></tr>
                  ) : (
                    filteredCustomers.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="p-4 text-gray-500 font-mono">{c.serialNumber}</td>
                        <td className="p-4 font-bold text-gray-800">
                          {c.name}
                          <div className="text-xs text-gray-400 md:hidden">{c.phone}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 hidden md:table-cell max-w-xs truncate" title={getLastNote(c.id)}>
                          <div className="flex items-center gap-1">
                            <FileText size={14} className="text-gray-400" />
                            {getLastNote(c.id)}
                          </div>
                        </td>
                        <td className={`p-4 font-black text-lg ${c.balance > 0 ? 'text-red-600' : c.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {c.balance > 0 ? c.balance : c.balance < 0 ? Math.abs(c.balance) + ' (له)' : '0'}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleCustomerSelect(c)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition
                              ${activeTab === 'repay'
                                ? 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                          >
                            {activeTab === 'repay' ? 'سداد' : 'إضافة دين'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Repayments History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">آخر عمليات السداد</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">الزبون</th>
                    <th className="p-4">المبلغ</th>
                    <th className="p-4">الطريقة</th>
                    <th className="p-4">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {repayments.slice(0, 5).map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-500">{new Date(r.date).toLocaleDateString('en-US')}</td>
                      <td className="p-4 font-medium text-gray-800">{r.customerName}</td>
                      <td className="p-4 font-bold text-green-600">{r.amount}</td>
                      <td className="p-4 text-sm">{r.method === 'cash' ? 'نقداً' : 'شيك'}</td>
                      <td className="p-4 text-sm text-gray-500">{r.note || '-'}</td>
                    </tr>
                  ))}
                  {repayments.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد عمليات سداد مسجلة.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
