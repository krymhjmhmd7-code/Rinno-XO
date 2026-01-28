

import React, { useState, useEffect, useRef } from 'react';
import { Customer, Product, Invoice, Repayment } from '../types';
import { Plus, Search, Settings, Trash2, X, LayoutGrid, List, Printer } from 'lucide-react';
import { storageService } from '../services/storage';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Import sub-components
import { CustomerForm } from './CustomerForm';
import { CustomerCard } from './CustomerCard';
import { CustomerTable } from './CustomerTable';
import { CustomerHistory, HistoryItem } from './CustomerHistory';

interface CustomersProps {
  customers: Customer[];
  products: Product[];
  onUpdate: (customers: Customer[]) => void;
  onNewOrder: (customerId: string) => void;
  onManageDebt?: (customerId: string) => void;
  onManageCylinders?: (customerId: string) => void;
  initialCustomerId?: string | null;
}

export const Customers: React.FC<CustomersProps> = ({ customers, products, onUpdate, onNewOrder, onManageDebt, onManageCylinders, initialCustomerId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize ViewMode from LocalStorage
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    return (localStorage.getItem('gaspro_customers_view_mode') as 'table' | 'grid') || 'table';
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<Customer | null>(null);

  // Combined History State
  const [customerHistory, setCustomerHistory] = useState<HistoryItem[]>([]);

  // Auto-open history if initialCustomerId is provided
  useEffect(() => {
    if (initialCustomerId) {
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer) {
        openHistory(customer);
      }
    }
  }, [initialCustomerId, customers]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Validation State
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Password Prompt
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Customer Types State
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [newTypeInput, setNewTypeInput] = useState('');

  // Calculate next serial
  const nextSerial = customers.length > 0 ? Math.max(...customers.map(c => c.serialNumber || 0)) + 1 : 1;

  useEffect(() => {
    setAvailableTypes(storageService.getCustomerTypes());
  }, []);

  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    type: 'غير مصنف',
    city: 'غير محدد',
    village: '',
    neighborhood: '',
    whatsapp: '+',
  });

  const filteredCustomers = customers.filter(c =>
    c.name.includes(searchTerm) || c.phone.includes(searchTerm) || c.city.includes(searchTerm) || (c.serialNumber?.toString().includes(searchTerm))
  );

  const handleViewModeChange = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('gaspro_customers_view_mode', mode);
  };

  const handleSaveCustomer = () => {
    // Validation
    const newErrors: { [key: string]: string } = {};
    if (!formData.name) newErrors.name = 'الاسم مطلوب';

    // Phone is optional, but if entered, it should be 10 digits
    if (formData.phone && formData.phone.length > 0 && formData.phone.length !== 10) {
      newErrors.phone = 'يجب أن يتكون الرقم من 10 خانات';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let finalWa = formData.whatsapp || '';
    if (finalWa === '+') finalWa = '';

    // Determine Serial Number for New Customer
    let currentSerial = 0;
    if (!editingId) {
      currentSerial = nextSerial;
    } else {
      currentSerial = customers.find(c => c.id === editingId)?.serialNumber || 0;
    }

    const customerData: Customer = {
      id: editingId || Date.now().toString(),
      serialNumber: currentSerial,
      name: formData.name!,
      type: formData.type || 'غير مصنف',
      phone: formData.phone || '',
      whatsapp: finalWa,
      city: formData.city || 'غير محدد',
      village: formData.village || '',
      neighborhood: formData.neighborhood || '',
      totalPurchases: editingId ? (customers.find(c => c.id === editingId)?.totalPurchases || 0) : 0,
      balance: editingId ? (customers.find(c => c.id === editingId)?.balance || 0) : 0,
      cylinderBalance: editingId ? (customers.find(c => c.id === editingId)?.cylinderBalance || {}) : {}
    };

    if (editingId) {
      onUpdate(customers.map(c => c.id === editingId ? customerData : c));
    } else {
      onUpdate([...customers, customerData]);
    }

    closeModal();
  };

  const handleAddType = () => {
    if (newTypeInput && !availableTypes.includes(newTypeInput)) {
      const updated = [...availableTypes, newTypeInput];
      setAvailableTypes(updated);
      storageService.saveCustomerTypes(updated);
      setNewTypeInput('');
    }
  };

  const handleDeleteType = (typeToDelete: string) => {
    const updated = availableTypes.filter(t => t !== typeToDelete);
    setAvailableTypes(updated);
    storageService.saveCustomerTypes(updated);
    if (formData.type === typeToDelete) {
      setFormData({ ...formData, type: updated[0] || '' });
    }
  };

  const confirmDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const settings = storageService.getSettings();
    if (settings.adminPassword) {
      setDeleteTargetId(id);
      setShowPasswordPrompt(true);
      setPasswordInput('');
      setPasswordError('');
    } else {
      performDelete(id);
    }
  };

  const performDelete = (id: string) => {
    onUpdate(customers.filter(c => c.id !== id));
    setShowPasswordPrompt(false);
    setDeleteTargetId(null);
  };

  const checkPasswordAndDelete = () => {
    const settings = storageService.getSettings();
    if (passwordInput === settings.adminPassword) {
      performDelete(deleteTargetId!);
    } else {
      setPasswordError('كلمة المرور خاطئة');
    }
  };

  const openHistory = (c: Customer) => {
    const allInvoices = storageService.getInvoices();
    const allRepayments = storageService.getRepayments();

    // Filter and map to unified structure
    const myInvoices = allInvoices
      .filter(inv => inv.customerId === c.id)
      .map(inv => ({ ...inv, type: 'invoice' } as HistoryItem));

    const myRepayments = allRepayments
      .filter(rep => rep.customerId === c.id)
      .map(rep => ({ ...rep, type: 'repayment' } as HistoryItem));

    // Combine and Sort by Date Descending
    const combined = [...myInvoices, ...myRepayments].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    setCustomerHistory(combined);
    setSelectedHistoryCustomer(c);
    setShowHistoryModal(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ type: 'غير مصنف', whatsapp: '+', city: 'غير محدد' });
    setErrors({});
    setShowAddModal(true);
  };

  const openEdit = (c: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(c.id);
    setFormData(c);
    setErrors({});
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setErrors({});
  };

  const formatBalance = (bal: number) => {
    if (bal === 0) return '0';
    if (bal > 0) return `${bal} (عليه)`;
    return `${Math.abs(bal)} (له)`;
  };

  const formatBalanceColor = (bal: number) => {
    if (bal > 0) return 'text-red-600';
    if (bal < 0) return 'text-green-600';
    return 'text-gray-400';
  };

  const handleDeleteTransaction = (type: 'invoice' | 'repayment', id: string, customerId: string) => {
    if (type === 'invoice') {
      storageService.deleteInvoice(id, customerId);
    } else {
      storageService.deleteRepayment(id, customerId);
    }

    // Refresh Customer List (Balance update)
    const updatedCustomers = storageService.getCustomers();
    onUpdate(updatedCustomers);

    // Refresh History for current customer
    const updatedCustomer = updatedCustomers.find(c => c.id === customerId);
    if (updatedCustomer) {
      openHistory(updatedCustomer);
    }
  };

  const handleUpdateTransactionDate = (type: 'invoice' | 'repayment', id: string, newDate: string) => {
    if (type === 'invoice') {
      storageService.updateInvoiceDate(id, newDate);
    } else {
      storageService.updateRepaymentDate(id, newDate);
    }

    // Refresh History (Order might change)
    if (selectedHistoryCustomer) {
      openHistory(selectedHistoryCustomer);
    }
  };

  // State for Print Preview Modal
  const [printPreviewHtml, setPrintPreviewHtml] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const printInvoice = (inv: Invoice) => {
    const html = `
        <html>
          <head>
            <title>فاتورة #${inv.id.slice(-6)}</title>
            <style>
              body { font-family: 'Arial', sans-serif; direction: rtl; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .info { margin-bottom: 20px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
              th { background-color: #f4f4f4; }
              .total { font-size: 18px; font-weight: bold; text-align: left; }
              .footer { margin-top: 40px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>GasPro - فاتورة غاز</h1>
              <p>تاريخ: ${new Date(inv.date).toLocaleDateString('en-US')}</p>
            </div>
            <div class="info">
              <p><strong>الزبون:</strong> ${inv.customerName}</p>
              <p><strong>رقم الفاتورة:</strong> #${inv.id.slice(-6)}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الكمية</th>
                </tr>
              </thead>
              <tbody>
                ${inv.items.map(i => `
                  <tr>
                    <td>${i.productName}</td>
                    <td>${i.quantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total">
              <p>المجموع الكلي: ${inv.totalAmount} شيكل</p>
              <p style="font-size: 14px; color: #555;">المدفوع نقداً: ${inv.paymentDetails.cash} | شيك: ${inv.paymentDetails.cheque}</p>
            </div>
            <div class="footer">
              <p>شكراً لتعاملكم معنا</p>
            </div>
          </body>
        </html>
      `;
    setPrintPreviewHtml(html);
  };

  // Refs for hidden templates
  const invoiceTemplateRef = useRef<HTMLDivElement>(null);
  const historyTemplateRef = useRef<HTMLDivElement>(null);
  const [shareInvoiceData, setShareInvoiceData] = useState<{ inv: Invoice; customer: Customer } | null>(null);
  const [shareHistoryData, setShareHistoryData] = useState<{ customer: Customer; history: HistoryItem[] } | null>(null);

  const shareInvoice = async (inv: Invoice, customer: Customer) => {
    // Set data and wait for render
    setShareInvoiceData({ inv, customer });

    // Wait for next frame to ensure DOM is updated
    await new Promise(resolve => setTimeout(resolve, 150));

    if (!invoiceTemplateRef.current) {
      alert('خطأ في إنشاء الصورة');
      setShareInvoiceData(null);
      return;
    }

    try {
      const canvas = await html2canvas(invoiceTemplateRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      // Convert canvas to base64
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      const fileName = `invoice_${inv.id.slice(-6)}.png`;

      try {
        // Save to cache directory
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        // Share using Capacitor Share
        await Share.share({
          title: `فاتورة #${inv.id.slice(-6)}`,
          text: `فاتورة للزبون ${customer.name}`,
          url: savedFile.uri,
          dialogTitle: 'مشاركة الفاتورة',
        });
      } catch (shareError: any) {
        console.error('Share failed:', shareError);
        // Fallback: try web download
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
        });
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      setShareInvoiceData(null);
    } catch (err) {
      console.error('Error creating image:', err);
      alert('خطأ في إنشاء الصورة');
      setShareInvoiceData(null);
    }
  };

  const printHistory = (customer: Customer, history: HistoryItem[]) => {
    const html = `
        <html>
          <head>
            <title>كشف حساب - ${customer.name}</title>
            <style>
              body { font-family: 'Arial', sans-serif; direction: rtl; padding: 20px; }
              h1, h2 { text-align: center; margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
              th { background-color: #f4f4f4; }
              .footer { margin-top: 30px; text-align: center; font-weight: bold; }
              .balance { font-size: 18px; margin-top: 10px; padding: 10px; border: 2px solid #333; display: inline-block; }
              .credit { color: green; }
              .debt { color: red; }
              .row-invoice { background-color: #fff; }
              .row-repay { background-color: #f9fff9; }
            </style>
          </head>
          <body>
            <h1>GasPro</h1>
            <h2>كشف حساب زبون</h2>
            <div style="margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
              <p><strong>الاسم:</strong> ${customer.name} (#${customer.serialNumber})</p>
              <p><strong>رقم الجوال:</strong> ${customer.phone}</p>
              <p><strong>تاريخ الاستخراج:</strong> ${new Date().toLocaleDateString('en-US')}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع الحركة</th>
                  <th>البيان / التفاصيل</th>
                  <th>مدين (عليه)</th>
                  <th>دائن (له/سدد)</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(item => {
      const date = new Date(item.date).toLocaleDateString('en-US');

      if (item.type === 'invoice') {
        const inv = item as Invoice;
        const details = inv.items.map(i => `${i.productName} (${i.quantity})`).join(', ');
        // Invoice increases debt (Debit)
        return `
                      <tr class="row-invoice">
                        <td>${date}</td>
                        <td>فاتورة #${inv.id.slice(-6)}</td>
                        <td>${details}</td>
                        <td>${inv.totalAmount}</td>
                        <td>0</td>
                      </tr>
                      ${(inv.paymentDetails.cash + inv.paymentDetails.cheque) > 0 ? `
                        <tr class="row-repay">
                          <td>${date}</td>
                          <td>دفع فوري (فاتورة)</td>
                          <td>نقد/شيك</td>
                          <td>0</td>
                          <td>${inv.paymentDetails.cash + inv.paymentDetails.cheque}</td>
                        </tr>
                      ` : ''}
                     `;
      } else {
        const rep = item as Repayment;
        // Repayment decreases debt (Credit)
        return `
                      <tr class="row-repay">
                        <td>${date}</td>
                        <td>سند سداد/قبض</td>
                        <td>${rep.method === 'cash' ? 'نقداً' : 'شيك'} ${rep.note ? ` - ${rep.note}` : ''}</td>
                        <td>0</td>
                        <td>${rep.amount}</td>
                      </tr>
                     `;
      }
    }).join('')}
              </tbody>
            </table>
            
            <div class="footer">
              <div class="balance">
                 الرصيد الحالي النهائي: 
                 <span class="${customer.balance > 0 ? 'debt' : 'credit'}">
                   ${customer.balance > 0 ? `${customer.balance} (عليه)` : `${Math.abs(customer.balance)} (له)`}
                 </span>
              </div>
            </div>
          </body>
        </html>
      `;
    setPrintPreviewHtml(html);
  };

  const shareHistory = async (customer: Customer, history: HistoryItem[]) => {
    // Set data and wait for render
    setShareHistoryData({ customer, history });

    // Wait for next frame to ensure DOM is updated
    await new Promise(resolve => setTimeout(resolve, 150));

    if (!historyTemplateRef.current) {
      alert('خطأ في إنشاء الصورة');
      setShareHistoryData(null);
      return;
    }

    try {
      const canvas = await html2canvas(historyTemplateRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      // Convert canvas to base64
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      const fileName = `statement_${customer.serialNumber}.png`;

      try {
        // Save to cache directory
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        // Share using Capacitor Share
        await Share.share({
          title: `كشف حساب - ${customer.name}`,
          text: `كشف حساب للزبون ${customer.name}`,
          url: savedFile.uri,
          dialogTitle: 'مشاركة كشف الحساب',
        });
      } catch (shareError: any) {
        console.error('Share failed:', shareError);
        // Fallback: try web download
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
        });
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      setShareHistoryData(null);
    } catch (err) {
      console.error('Error creating image:', err);
      alert('خطأ في إنشاء الصورة');
      setShareHistoryData(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">سجل الزبائن</h2>
        <div className="flex gap-2">
          <div className="bg-gray-100 p-1 rounded-lg flex items-center">
            <button onClick={() => handleViewModeChange('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}><List size={20} /></button>
            <button onClick={() => handleViewModeChange('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}><LayoutGrid size={20} /></button>
          </div>
          <button
            onClick={() => setShowTypesModal(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Settings size={20} />
            <span className="hidden md:inline">التصنيفات</span>
          </button>
          <button
            onClick={openAdd}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Plus size={20} />
            <span>زبون جديد</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="بحث باسم الزبون، المدينة، الرقم المتسلسل أو الجوال..."
            className="w-full pr-10 pl-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {viewMode === 'table' ? (
        <CustomerTable
          customers={filteredCustomers}
          onOpenHistory={openHistory}
          onOpenEdit={openEdit}
          onConfirmDelete={confirmDelete}
          onNewOrder={onNewOrder}
          onManageDebt={onManageDebt}
          onManageCylinders={onManageCylinders}
          formatBalance={formatBalance}
          formatBalanceColor={formatBalanceColor}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onOpenHistory={openHistory}
              onOpenEdit={openEdit}
              onConfirmDelete={confirmDelete}
              onNewOrder={onNewOrder}
              onManageDebt={onManageDebt}
              onManageCylinders={onManageCylinders}
              formatBalance={formatBalance}
              formatBalanceColor={formatBalanceColor}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <CustomerForm
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
          availableTypes={availableTypes}
          editingId={editingId}
          nextSerial={nextSerial}
          onSave={handleSaveCustomer}
          onClose={closeModal}
        />
      )}

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4 text-red-600">تأكيد الحذف</h3>
            <p className="text-gray-600 mb-4 text-sm">أدخل كلمة مرور المسؤول لإتمام الحذف.</p>
            <input
              type="password"
              className={`w-full p-2 border rounded mb-2 ${passwordError ? 'border-red-500 bg-red-50' : ''}`}
              placeholder="كلمة المرور"
              value={passwordInput}
              onChange={e => {
                setPasswordInput(e.target.value);
                setPasswordError('');
              }}
            />
            {passwordError && <p className="text-red-600 text-xs mb-4 font-bold">{passwordError}</p>}

            <div className="flex gap-2">
              <button onClick={checkPasswordAndDelete} className="flex-1 bg-red-600 text-white py-2 rounded">حذف</button>
              <button onClick={() => setShowPasswordPrompt(false)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* History Archive Modal */}
      {showHistoryModal && selectedHistoryCustomer && (
        <CustomerHistory
          customer={selectedHistoryCustomer}
          history={customerHistory}
          onClose={() => setShowHistoryModal(false)}
          onPrintInvoice={printInvoice}
          onShareInvoice={shareInvoice}
          onPrintHistory={printHistory}
          onShareHistory={shareHistory}
          onDeleteTransaction={handleDeleteTransaction}
          onUpdateTransactionDate={handleUpdateTransactionDate}
          formatBalance={formatBalance}
          formatBalanceColor={formatBalanceColor}
        />
      )}

      {/* Manage Types Modal */}
      {showTypesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">إدارة تصنيفات الزبائن</h3>
              <button onClick={() => setShowTypesModal(false)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                className="flex-1 p-2 border rounded-lg"
                placeholder="أضف تصنيف جديد..."
                value={newTypeInput}
                onChange={e => setNewTypeInput(e.target.value)}
              />
              <button
                onClick={handleAddType}
                className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700"
              >
                إضافة
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableTypes.map(type => (
                <div key={type} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                  <span>{type}</span>
                  <button onClick={() => handleDeleteType(type)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for Image Generation */}
      {shareInvoiceData && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div
            ref={invoiceTemplateRef}
            style={{
              width: '400px',
              padding: '24px',
              fontFamily: 'Arial, sans-serif',
              direction: 'rtl',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #667eea', paddingBottom: '16px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px' }}>Rinno OX</div>
                <div style={{ fontSize: '12px', color: '#666' }}>نظام إدارة وتوزيع الغاز</div>
              </div>

              {/* Invoice Info */}
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>رقم الفاتورة:</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>#{shareInvoiceData.inv.id.slice(-6)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>التاريخ:</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>{new Date(shareInvoiceData.inv.date).toLocaleDateString('en-US')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>الزبون:</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>{shareInvoiceData.customer.name}</span>
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>الأصناف:</div>
                {shareInvoiceData.inv.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: idx % 2 === 0 ? '#f0f0f0' : 'white', borderRadius: '4px' }}>
                    <span>{item.productName}</span>
                    <span style={{ fontWeight: 'bold' }}>×{item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>المجموع الكلي</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{shareInvoiceData.inv.totalAmount} ₪</div>
              </div>

              {/* Payment Details */}
              <div style={{ marginTop: '16px', fontSize: '13px', color: '#666' }}>
                {shareInvoiceData.inv.paymentDetails.cash > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>💵 نقداً:</span>
                    <span>{shareInvoiceData.inv.paymentDetails.cash} ₪</span>
                  </div>
                )}
                {shareInvoiceData.inv.paymentDetails.cheque > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>📝 شيك:</span>
                    <span>{shareInvoiceData.inv.paymentDetails.cheque} ₪</span>
                  </div>
                )}
                {shareInvoiceData.inv.paymentDetails.debt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 'bold' }}>
                    <span>⚠️ متبقي:</span>
                    <span>{shareInvoiceData.inv.paymentDetails.debt} ₪</span>
                  </div>
                )}
                {shareInvoiceData.inv.paymentDetails.debt < 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 'bold' }}>
                    <span>✅ رصيد لك:</span>
                    <span>{Math.abs(shareInvoiceData.inv.paymentDetails.debt)} ₪</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden History Template for Image Generation */}
      {shareHistoryData && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div
            ref={historyTemplateRef}
            style={{
              width: '420px',
              padding: '24px',
              fontFamily: 'Arial, sans-serif',
              direction: 'rtl',
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            }}
          >
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #11998e', paddingBottom: '16px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#11998e', marginBottom: '4px' }}>Rinno OX</div>
                <div style={{ fontSize: '14px', color: '#333', fontWeight: 'bold' }}>كشف حساب</div>
              </div>

              {/* Customer Info */}
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>الزبون:</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>{shareHistoryData.customer.name} (#{shareHistoryData.customer.serialNumber})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>تاريخ الاستخراج:</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>{new Date().toLocaleDateString('en-US')}</span>
                </div>
              </div>

              {/* History Items (Last 10) */}
              <div style={{ marginBottom: '16px', maxHeight: '400px', overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>آخر الحركات:</div>
                {shareHistoryData.history.slice(0, 10).map((item, idx) => {
                  const date = new Date(item.date).toLocaleDateString('en-US');
                  if (item.type === 'invoice') {
                    const inv = item as Invoice;
                    const debtAmount = inv.paymentDetails?.debt || 0;
                    const itemsText = inv.items.map(i => `${i.productName}×${i.quantity}`).join(' | ');
                    // Only show invoices that affected the balance (debt > 0)
                    if (debtAmount === 0) {
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f0f9ff', borderRadius: '4px', marginBottom: '4px', borderRight: '3px solid #3b82f6' }}>
                          <span style={{ fontSize: '12px' }}>📄 {date} - فاتورة #{inv.id.slice(-6)} (مدفوعة)</span>
                          <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{inv.totalAmount} ₪</span>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} style={{ padding: '8px', background: '#fff4f4', borderRadius: '4px', marginBottom: '4px', borderRight: '3px solid #dc2626' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px' }}>📄 {date} - فاتورة #{inv.id.slice(-6)}</span>
                          <span style={{ fontWeight: 'bold', color: '#dc2626' }}>+{debtAmount} ₪</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#333', fontWeight: '600', background: '#ffe8e8', padding: '6px 8px', borderRadius: '4px' }}>
                          📦 {itemsText}
                        </div>
                      </div>
                    );
                  } else {
                    const rep = item as Repayment;
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f0fff4', borderRadius: '4px', marginBottom: '4px', borderRight: '3px solid #16a34a' }}>
                        <span style={{ fontSize: '12px' }}>💵 {date} - سداد ({rep.method === 'cash' ? 'نقد' : 'شيك'})</span>
                        <span style={{ fontWeight: 'bold', color: '#16a34a' }}>-{rep.amount} ₪</span>
                      </div>
                    );
                  }
                })}
                {shareHistoryData.history.length > 10 && (
                  <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginTop: '8px' }}>
                    +{shareHistoryData.history.length - 10} حركة أخرى
                  </div>
                )}
              </div>

              {/* Balance */}
              <div style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center', marginTop: '16px' }}>
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>الرصيد الحالي</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {shareHistoryData.customer.balance > 0 ?
                    `عليه: ${shareHistoryData.customer.balance}` :
                    `له: ${Math.abs(shareHistoryData.customer.balance)}`} ₪
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printPreviewHtml && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full h-full max-w-4xl rounded-xl flex flex-col overflow-hidden">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">معاينة للطباعة</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (iframeRef.current && iframeRef.current.contentWindow) {
                      iframeRef.current.contentWindow.print();
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                >
                  <Printer size={20} />
                  طباعة
                </button>
                <button
                  onClick={() => setPrintPreviewHtml(null)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  إغلاق
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 p-4 relative">
              <iframe
                ref={iframeRef}
                srcDoc={printPreviewHtml}
                className="w-full h-full bg-white shadow-lg rounded"
                title="Print Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};