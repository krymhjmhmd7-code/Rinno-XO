

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer, Product, Invoice, Repayment } from '../types';
import { Plus, Search, Settings, Trash2, X, LayoutGrid, List, Printer } from 'lucide-react';
import { storageService } from '../services/storage';

// Import sub-components
import { CustomerForm } from './CustomerForm';
import { CustomerCard } from './CustomerCard';
import { CustomerTable } from './CustomerTable';
import { CustomerHistory, HistoryItem } from './CustomerHistory';
import { useDeletePassword } from '../hooks/useDeletePassword';
import { DeletePasswordModal } from './DeletePasswordModal';
import { generateInvoiceHtml, generateHistoryHtml } from '../utils/printTemplates';
import { captureAndShare } from '../utils/shareHelper';

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
  const {
    showPasswordModal,
    passwordInput,
    passwordError,
    setPasswordInput,
    requestDelete,
    verifyAndExecute,
    cancelDelete
  } = useDeletePassword();

  // Customer Types State
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [newTypeInput, setNewTypeInput] = useState('');

  // Calculate next serial
  const nextSerial = useMemo(() => {
    return customers.length > 0 ? Math.max(...customers.map(c => c.serialNumber || 0)) + 1 : 1;
  }, [customers]);

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

  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      c.name.includes(searchTerm) || c.phone.includes(searchTerm) || c.city.includes(searchTerm) || (c.serialNumber?.toString().includes(searchTerm))
    );
  }, [customers, searchTerm]);

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
    const existing = editingId ? customers.find(c => c.id === editingId) : null;
    const currentSerial = existing ? (existing.serialNumber || 0) : nextSerial;

    const customerData: Customer = {
      id: editingId || crypto.randomUUID(),
      serialNumber: currentSerial,
      name: formData.name!,
      type: formData.type || 'غير مصنف',
      phone: formData.phone || '',
      whatsapp: finalWa,
      city: formData.city || 'غير محدد',
      village: formData.village || '',
      neighborhood: formData.neighborhood || '',
      totalPurchases: existing ? (existing.totalPurchases || 0) : 0,
      balance: existing ? (existing.balance || 0) : 0,
      cylinderBalance: existing ? (existing.cylinderBalance || {}) : {}
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
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    requestDelete(() => {
      storageService.moveToRecycleBin('customer', customer, `زبون: ${customer.name} (#${customer.serialNumber})`);
      onUpdate(customers.filter(c => c.id !== id));
    });
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

  const printInvoice = (inv: Invoice) => { setPrintPreviewHtml(generateInvoiceHtml(inv)); };

  // Refs for hidden templates
  const invoiceTemplateRef = useRef<HTMLDivElement>(null);
  const historyTemplateRef = useRef<HTMLDivElement>(null);
  const [shareInvoiceData, setShareInvoiceData] = useState<{ inv: Invoice; customer: Customer } | null>(null);
  const [shareHistoryData, setShareHistoryData] = useState<{ customer: Customer; history: HistoryItem[] } | null>(null);

  const shareInvoice = async (inv: Invoice, customer: Customer) => {
    setShareInvoiceData({ inv, customer });
    await new Promise(resolve => setTimeout(resolve, 150));
    await captureAndShare(invoiceTemplateRef, `invoice_${inv.id.slice(-6)}.png`, `فاتورة #${inv.id.slice(-6)}`, `فاتورة للزبون ${customer.name}`);
    setShareInvoiceData(null);
  };

  const printHistory = (customer: Customer, history: HistoryItem[]) => { setPrintPreviewHtml(generateHistoryHtml(customer, history)); };

  const shareHistory = async (customer: Customer, history: HistoryItem[]) => {
    setShareHistoryData({ customer, history });
    await new Promise(resolve => setTimeout(resolve, 150));
    await captureAndShare(historyTemplateRef, `statement_${customer.serialNumber}.png`, `كشف حساب - ${customer.name}`, `كشف حساب للزبون ${customer.name}`);
    setShareHistoryData(null);
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
      <DeletePasswordModal
        show={showPasswordModal}
        passwordInput={passwordInput}
        passwordError={passwordError}
        onPasswordChange={setPasswordInput}
        onConfirm={verifyAndExecute}
        onCancel={cancelDelete}
      />

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

      {/* Hidden Invoice Template for Image Generation - B&W Minimal */}
      {shareInvoiceData && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div
            ref={invoiceTemplateRef}
            style={{
              width: '400px',
              padding: '20px',
              fontFamily: 'Arial, sans-serif',
              direction: 'rtl',
              background: 'white',
              color: 'black',
              border: '1px solid black'
            }}
          >
            <div style={{ background: 'white' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid black', paddingBottom: '12px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'black', marginBottom: '4px' }}>فاتورة مبيعات</div>
                <div style={{ fontSize: '14px', color: 'black' }}>Rinno OX</div>
              </div>

              {/* Invoice Info */}
              <div style={{ marginBottom: '16px', borderBottom: '1px solid black', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px' }}>رقم الفاتورة:</span>
                  <span style={{ fontWeight: 'bold' }}>#{shareInvoiceData.inv.id.slice(-6)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px' }}>التاريخ:</span>
                  <span style={{ fontWeight: 'bold' }}>{new Date(shareInvoiceData.inv.date).toLocaleDateString('en-US')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px' }}>الزبون:</span>
                  <span style={{ fontWeight: 'bold' }}>{shareInvoiceData.customer.name}</span>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>الصنف</th>
                      <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareInvoiceData.inv.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid black', padding: '6px' }}>{item.productName}</td>
                        <td style={{ border: '1px solid black', padding: '6px' }}>×{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div style={{ border: '2px solid black', padding: '12px', textAlign: 'center', fontWeight: 'bold', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', marginBottom: '2px' }}>المجموع الكلي</div>
                <div style={{ fontSize: '24px' }}>{shareInvoiceData.inv.totalAmount} ₪</div>
              </div>

              {/* Payment Details */}
              <div style={{ fontSize: '12px' }}>
                {shareInvoiceData.inv.paymentDetails.cash > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>المدفوع نقداً:</span>
                    <span>{shareInvoiceData.inv.paymentDetails.cash} ₪</span>
                  </div>
                )}
                {shareInvoiceData.inv.paymentDetails.cheque > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>المدفوع شيك:</span>
                    <span>{shareInvoiceData.inv.paymentDetails.cheque} ₪</span>
                  </div>
                )}
                {shareInvoiceData.inv.paymentDetails.debt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>المتبقي ذمم:</span>
                    <span>{shareInvoiceData.inv.paymentDetails.debt} ₪</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden History Template for Image Generation - B&W Simple */}
      {shareHistoryData && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div
            ref={historyTemplateRef}
            style={{
              width: '500px',
              padding: '24px',
              fontFamily: 'Arial, sans-serif',
              direction: 'rtl',
              background: 'white',
              color: 'black',
              border: '2px solid black',
            }}
          >
            <div style={{ background: 'white', padding: '16px' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '3px solid black', paddingBottom: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'black', marginBottom: '4px' }}>كشف حساب زبون</div>
              </div>

              {/* Customer Info */}
              <div style={{ marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>الاسم: {shareHistoryData.customer.name} (#{shareHistoryData.customer.serialNumber})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>رقم الجوال: {shareHistoryData.customer.phone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>تاريخ الاستخراج: {new Date().toLocaleDateString('en-US')}</span>
                </div>
              </div>

              {/* History Items (Last 15) */}
              <div style={{ marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '2px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>التاريخ</th>
                      <th style={{ border: '2px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>البيان</th>
                      <th style={{ border: '2px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>صادر [-]</th>
                      <th style={{ border: '2px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>وارد [+]</th>
                      <th style={{ border: '2px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sorted = [...shareHistoryData.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      let currentBalance = 0;
                      const ledger = sorted.map(item => {
                          let diff = 0;
                          let displayedSader: string | number = '-';
                          let displayedWared: string | number = '-';
                          if (item.type === 'invoice') {
                              const inv = item as Invoice;
                              diff = inv.paymentDetails?.debt || 0;
                              displayedSader = inv.totalAmount > 0 ? inv.totalAmount : '-';
                              const paid = (inv.paymentDetails?.cash || 0) + (inv.paymentDetails?.cheque || 0);
                              displayedWared = paid > 0 ? paid : '-';
                          } else {
                              const rep = item as Repayment;
                              diff = -rep.amount;
                              displayedWared = rep.amount > 0 ? rep.amount : '-';
                          }
                          currentBalance += diff;
                          return { item, displayedSader, displayedWared, runningBalance: currentBalance };
                      });
                      ledger.reverse();
                      return ledger.slice(0, 15).map(({ item, displayedSader, displayedWared, runningBalance }, idx) => {
                      const date = new Date(item.date).toLocaleDateString('en-US');
                        const balanceText = runningBalance > 0 ? `${Math.abs(runningBalance)} (عليه)` : runningBalance < 0 ? `${Math.abs(runningBalance)} (له)` : '0';

                        if (item.type === 'invoice') {
                          const inv = item as Invoice;
                          return (
                            <React.Fragment key={idx}>
                              <tr>
                                <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{date}</td>
                                <td style={{ border: '2px solid black', padding: '8px' }}>
                                  <div style={{ fontWeight: 'bold' }}>فاتورة #{inv.id.slice(-6)}</div>
                                  <div style={{ fontSize: '12px', color: 'black', fontWeight: 'bold', marginTop: '4px' }}>
                                    {inv.items.map(i => `${i.productName} (${i.quantity})`).join(' | ')}
                                  </div>
                                </td>
                                <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{displayedSader}</td>
                                <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{displayedWared}</td>
                                <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{balanceText}</td>
                              </tr>
                            </React.Fragment>
                          );
                        } else {
                          const rep = item as Repayment;
                          return (
                            <tr key={idx}>
                              <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{date}</td>
                              <td style={{ border: '2px solid black', padding: '8px' }}>
                                <div style={{ fontWeight: 'bold' }}>سداد / قبض</div>
                                <div style={{ fontSize: '12px', color: 'black', fontWeight: 'bold', marginTop: '4px' }}>
                                  {rep.method === 'cash' ? 'نقداً' : 'شيك'} {rep.note && ` - ${rep.note}`}
                                </div>
                              </td>
                              <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{displayedSader}</td>
                              <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{displayedWared}</td>
                              <td style={{ border: '2px solid black', padding: '8px', fontWeight: 'bold' }}>{balanceText}</td>
                            </tr>
                          );
                        }
                      });
                    })()}
                  </tbody>
                </table>
                {shareHistoryData.history.length > 15 && (
                  <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
                    ... وحركات أخرى غير ظاهرة ...
                  </div>
                )}
              </div>

              {/* Balance */}
              <div style={{ border: '3px solid black', padding: '16px', textAlign: 'center', fontWeight: 'bold' }}>
                <div style={{ fontSize: '18px' }}>الرصيد الحالي النهائي</div>
                <div style={{ fontSize: '28px', marginTop: '8px' }}>
                  {shareHistoryData.customer.balance > 0 ?
                    `${shareHistoryData.customer.balance} (عليه)` :
                    `${Math.abs(shareHistoryData.customer.balance)} (له)`}
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