
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Product, CylinderTransaction } from '../types';
import { storageService } from '../services/storage';
import { Repeat, Search, ArrowUpRight, ArrowDownLeft, Cylinder, CheckCircle, AlertCircle } from 'lucide-react';

interface CylinderLoansProps {
  customers: Customer[];
  products: Product[];
  onUpdate: () => void;
  initialCustomerId?: string | null;
}

export const CylinderLoans: React.FC<CylinderLoansProps> = ({ customers, products, onUpdate, initialCustomerId }) => {
  const [transactions, setTransactions] = useState<CylinderTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [type, setType] = useState<'out' | 'in'>('out');
  const [note, setNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTransactions(storageService.getCylinderTransactions());
    if (products.length > 0 && !selectedProductName) {
      setSelectedProductName(products[0].name);
    }
  }, [products]);

  // Auto-select customer if provided via navigation
  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer) {
        setSearchTerm(customer.name);
      }
    }
  }, [initialCustomerId, customers]);

  // Calculate current holding for the selected customer and product
  const currentHolding = useMemo(() => {
    if (!selectedCustomerId || !selectedProductName) return 0;
    const customer = customers.find(c => c.id === selectedCustomerId);
    return customer?.cylinderBalance?.[selectedProductName] || 0;
  }, [selectedCustomerId, selectedProductName, customers]);

  // Validation Effect to clear/set errors based on selection
  useEffect(() => {
    setError('');
    if (type === 'in' && selectedCustomerId && selectedProductName) {
      if (currentHolding <= 0) {
        setError(`تنبيه: هذا الزبون لا يملك أي اسطوانات من نوع "${selectedProductName}" لإرجاعها.`);
      }
    }
  }, [type, selectedCustomerId, selectedProductName, currentHolding]);

  const handleQuantityChange = (val: string) => {
    setError('');
    const num = Number(val);

    // Prevent negative input conceptually
    if (val && num < 0) return;

    // Logic for Return (IN) validation
    if (type === 'in' && val !== '') {
      if (num > currentHolding) {
        setError(`لا يمكن إرجاع ${num} اسطوانة. الزبون بحوزته فقط ${currentHolding}.`);
        // Optional: Force set to max? No, just warn and block save.
      }
    }

    setQuantity(val === '' ? '' : num);
  };

  const handleSaveTransaction = () => {
    setError('');

    if (!selectedCustomerId || !selectedProductName || !quantity || Number(quantity) <= 0) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    // Strict Validation before saving
    if (type === 'in') {
      const currentBalance = customer.cylinderBalance?.[selectedProductName] || 0;

      if (currentBalance === 0) {
        setError(`خطأ: الزبون لا يملك هذا النوع "${selectedProductName}" في ذمته.`);
        return;
      }

      if (Number(quantity) > currentBalance) {
        setError(`خطأ: الكمية المدخلة (${quantity}) أكبر من الرصيد الموجود لدى الزبون (${currentBalance}).`);
        return;
      }
    }

    const tx: CylinderTransaction = {
      id: Date.now().toString(),
      customerId: selectedCustomerId,
      customerName: customer.name,
      productName: selectedProductName,
      quantity: Number(quantity),
      type,
      date: new Date().toISOString(),
      note
    };

    storageService.addCylinderTransaction(tx);
    setTransactions(storageService.getCylinderTransactions());
    onUpdate(); // Updates global customer list

    // Reset form partially
    setQuantity('');
    setNote('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Filter customers for the list view
  const filteredCustomers = customers.filter(c => {
    const hasActiveLoan = c.cylinderBalance && Object.values(c.cylinderBalance).some(v => v !== 0);
    const matchesSearch = c.name.includes(searchTerm) || c.phone.includes(searchTerm) || c.serialNumber.toString().includes(searchTerm);
    if (searchTerm) return matchesSearch;
    return hasActiveLoan;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const totalCylindersOut = customers.reduce((sum, c) => {
    if (!c.cylinderBalance) return sum;
    const custTotal = Object.values(c.cylinderBalance).reduce((s: number, v: number) => s + v, 0);
    return sum + custTotal;
  }, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Repeat className="text-primary-600" />
          مداينة الاسطوانات (العُهد)
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Action Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 sticky top-4 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">تسجيل حركة جديدة</h3>
            </div>

            <div className="p-6 space-y-4">

              {/* Transaction Type Toggle */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => { setType('out'); setError(''); setQuantity(''); }}
                  className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition ${type === 'out' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                >
                  <ArrowUpRight size={16} />
                  خروج (له)
                </button>
                <button
                  onClick={() => { setType('in'); setError(''); setQuantity(''); }}
                  className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition ${type === 'in' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                >
                  <ArrowDownLeft size={16} />
                  دخول (منه)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الزبون</label>
                <select
                  className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white"
                  value={selectedCustomerId}
                  onChange={e => { setSelectedCustomerId(e.target.value); }}
                >
                  <option value="">-- اختر الزبون --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (#{c.serialNumber})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الاسطوانة</label>
                <select
                  className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white"
                  value={selectedProductName}
                  onChange={e => { setSelectedProductName(e.target.value); }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.size})</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">العدد</label>
                  {selectedCustomerId && (
                    <span className={`text-xs font-bold ${currentHolding > 0 ? 'text-primary-600' : 'text-gray-400'}`}>
                      في ذمة الزبون حالياً: {currentHolding}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={type === 'in' ? currentHolding : undefined}
                  className={`w-full p-3 border rounded-lg font-bold text-xl ${error ? 'border-red-500 bg-red-50' : ''}`}
                  placeholder="0"
                  value={quantity}
                  onKeyDown={(e) => {
                    // Prevent entering negative sign
                    if (e.key === '-' || e.key === 'e') {
                      e.preventDefault();
                    }
                  }}
                  onChange={e => handleQuantityChange(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-lg"
                  placeholder="ملاحظات إضافية..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm font-bold border border-red-100">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {showSuccess && (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg flex items-center justify-center gap-2 animate-bounce">
                  <CheckCircle size={20} /> تم الحفظ بنجاح
                </div>
              )}

              <button
                onClick={handleSaveTransaction}
                disabled={!selectedCustomerId || !quantity || !!error || (type === 'in' && currentHolding === 0)}
                className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition
                  ${(!selectedCustomerId || !quantity || !!error || (type === 'in' && currentHolding === 0))
                    ? 'bg-gray-300 cursor-not-allowed'
                    : type === 'out'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'}`}
              >
                {type === 'out' ? 'تسجيل إعارة للزبون' : 'تسجيل إرجاع من الزبون'}
              </button>
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="lg:col-span-2 space-y-6">

          {/* Summary Card */}
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-xl flex justify-between items-center">
            <div>
              <h3 className="text-orange-800 font-bold text-lg mb-1">إجمالي الاسطوانات في السوق</h3>
              <p className="text-orange-600 text-sm">مجموع الاسطوانات الموجودة عند الزبائن</p>
            </div>
            <div className="text-4xl font-black text-orange-600 flex items-center gap-3">
              {totalCylindersOut}
              <Cylinder size={32} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
              <h3 className="font-bold text-gray-800">أرصدة الزبائن (العيني)</h3>
              <div className="relative flex-1 w-full md:max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary-500"
                  placeholder="بحث عن زبون..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 text-sm sticky top-0 z-10">
                  <tr>
                    <th className="p-4">الزبون</th>
                    <th className="p-4">تفاصيل الأرصدة</th>
                    <th className="p-4">إجمالي بذمته</th>
                    <th className="p-4">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">لا توجد مداينات مسجلة.</td></tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const balances: Record<string, number> = c.cylinderBalance || {};
                      const hasDebt = Object.values(balances).some((v) => v !== 0);
                      const total = Object.values(balances).reduce((a, b) => a + b, 0);

                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition">
                          <td className="p-4 font-bold text-gray-800">
                            {c.name}
                            <div className="text-xs text-gray-400">#{c.serialNumber}</div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(balances).map(([prod, val]) => {
                                const qty = val;
                                if (qty === 0) return null;
                                return (
                                  <span key={prod} className={`text-xs font-bold px-2 py-1 rounded-md border ${qty > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                    {prod}: {qty}
                                  </span>
                                );
                              })}
                              {!hasDebt && <span className="text-gray-400 text-xs">لا يوجد رصيد</span>}
                            </div>
                          </td>
                          <td className={`p-4 font-black text-lg ${total > 0 ? 'text-red-600' : total < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {total}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => { setSelectedCustomerId(c.id); setType('in'); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="px-3 py-1 bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded-lg text-sm font-bold transition"
                            >
                              إرجاع
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800">سجل الحركات (التواريخ)</h3>
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 text-sm sticky top-0 z-10">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الزبون</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">العدد</th>
                    <th className="p-3">الحركة</th>
                    <th className="p-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد حركات مسجلة.</td></tr>
                  ) : (
                    transactions
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 50)
                      .map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 text-sm text-gray-600">
                            {new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            <div className="text-xs text-gray-400">
                              {new Date(tx.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="p-3 font-bold text-gray-800">{tx.customerName}</td>
                          <td className="p-3 text-sm">{tx.productName}</td>
                          <td className="p-3 font-black text-lg">{tx.quantity}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${tx.type === 'out'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-green-50 text-green-600'
                              }`}>
                              {tx.type === 'out' ? 'إعارة' : 'إرجاع'}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-gray-500">{tx.note || '-'}</td>
                        </tr>
                      ))
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
