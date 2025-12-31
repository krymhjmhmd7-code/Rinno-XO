

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Customer, CartItem, Invoice } from '../types';
import { ShoppingCart, Trash2, CheckCircle, MessageCircle, Search, ChevronDown, Banknote, ScrollText, ArrowLeft, ArrowRight, LayoutGrid, CreditCard } from 'lucide-react';

interface SalesProps {
  products: Product[];
  customers: Customer[];
  onCompleteSale: (invoice: Invoice) => void;
  initialCustomerId?: string | null;
}

export const Sales: React.FC<SalesProps> = ({ products, customers, onCompleteSale, initialCustomerId }) => {
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // Customer Search State
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Payment State
  const [manualTotal, setManualTotal] = useState<number>(0); // Manual Total Amount
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [chequeAmount, setChequeAmount] = useState<number>(0);
  const [chequeNumber, setChequeNumber] = useState<string>('');
  
  // UI State
  const [success, setSuccess] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(true); 
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Auto-select customer if provided
  useEffect(() => {
    if (initialCustomerId) {
      const c = customers.find(c => c.id === initialCustomerId);
      if (c) {
        handleSelectCustomer(c);
      }
    }
  }, [initialCustomerId, customers]);

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId), 
  [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers;
    return customers.filter(c => 
      c.name.includes(customerSearchTerm) || 
      c.phone.includes(customerSearchTerm) ||
      c.serialNumber.toString().includes(customerSearchTerm)
    );
  }, [customers, customerSearchTerm]);

  // Handle clicking outside customer dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToCart = (product: Product) => {
    setSelectedProductId(product.id);
    setTimeout(() => setSelectedProductId(null), 1000);

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.productId !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Calculate Debt/Credit automatically based on Manual Total
  const remainingDebt = manualTotal - cashAmount - chequeAmount;

  // Helper to select a customer from dropdown
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchTerm(customer.name);
    setShowCustomerDropdown(false);
  };

  const handleNumericInput = (val: string, setter: (v: number) => void) => {
    const num = val.replace(/[^0-9.]/g, '');
    setter(Number(num));
  };

  const formatBalance = (bal: number) => {
    if (bal === 0) return '0';
    if (bal > 0) return `${bal} (عليه)`;
    return `${Math.abs(bal)} (له)`;
  };

  const sendWhatsAppDetails = (invoice: Invoice, customer: Customer) => {
    if (!customer.whatsapp) return;

    const itemsList = invoice.items.map(i => `- ${i.productName} (العدد: ${i.quantity})`).join('\n');
    
    let paymentText = '';
    if (invoice.paymentDetails.cash > 0) paymentText += `\n- نقداً: ${invoice.paymentDetails.cash} شيكل`;
    if (invoice.paymentDetails.cheque > 0) paymentText += `\n- شيك: ${invoice.paymentDetails.cheque} شيكل (رقم: ${invoice.paymentDetails.chequeNumber || '-'})`;
    
    if (invoice.paymentDetails.debt > 0) {
      paymentText += `\n- متبقي عليك: ${invoice.paymentDetails.debt} شيكل`;
    } else if (invoice.paymentDetails.debt < 0) {
      paymentText += `\n- متبقي لك (رصيد): ${Math.abs(invoice.paymentDetails.debt)} شيكل`;
    }

    const message = `
*فاتورة طلبية - GasPro*
مرحباً ${customer.name}،

*التفاصيل:*
${itemsList}

*المجموع:* ${invoice.totalAmount} شيكل
----------------
*الدفع:*${paymentText}
----------------
التاريخ: ${new Date().toLocaleDateString('ar-EG')}

دمتم بخير.
    `.trim();

    const encodedMessage = encodeURIComponent(message);
    const cleanNumber = customer.whatsapp.replace(/[^0-9+]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    
    window.open(url, '_blank');
  };

  const handleCheckout = () => {
    if (!selectedCustomerId || cart.length === 0) return;

    // Safety check for total amount? Assuming 0 is allowed for gifts, but warning might be good.
    // For now, allow it.

    const invoice: Invoice = {
      id: Date.now().toString(),
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Unknown',
      date: new Date().toISOString(),
      items: cart,
      totalAmount: manualTotal,
      status: remainingDebt > 0 ? (remainingDebt === manualTotal ? 'debt' : 'partial') : 'paid',
      paymentDetails: {
        cash: cashAmount,
        cheque: chequeAmount,
        chequeNumber: chequeNumber,
        debt: remainingDebt
      }
    };

    onCompleteSale(invoice);
    
    if (selectedCustomer && sendWhatsapp) {
      sendWhatsAppDetails(invoice, selectedCustomer);
    }

    setSuccess(true);
    // Reset Form
    setCart([]);
    setSelectedCustomerId('');
    setCustomerSearchTerm('');
    setManualTotal(0);
    setCashAmount(0);
    setChequeAmount(0);
    setChequeNumber('');
    setMobileTab('products'); 
    setTimeout(() => setSuccess(false), 3000);
  };

  const activeProducts = products.filter(p => p.isActive !== false);

  return (
    <div className="flex flex-col h-[calc(100dvh-100px)] lg:h-[calc(100dvh-140px)] relative">
      
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex bg-white border border-gray-200 rounded-lg mb-3 overflow-hidden shrink-0">
        <button 
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-3 flex justify-center items-center gap-2 text-sm font-bold transition-colors ${mobileTab === 'products' ? 'bg-primary-50 text-primary-600' : 'text-gray-600'}`}
        >
          <LayoutGrid size={18} />
          المنتجات
        </button>
        <button 
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-3 flex justify-center items-center gap-2 text-sm font-bold transition-colors ${mobileTab === 'cart' ? 'bg-primary-50 text-primary-600' : 'text-gray-600'}`}
        >
          <ShoppingCart size={18} />
          السلة ({totalItems})
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        
        {/* Products Section */}
        <div className={`
          lg:col-span-7 flex flex-col h-full overflow-hidden
          ${mobileTab === 'products' ? 'block' : 'hidden lg:flex'}
        `}>
          <h2 className="text-xl font-bold text-gray-800 shrink-0 mb-4 hidden lg:block">اختر النوع والكمية</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pb-20 lg:pb-4 pr-1">
            {activeProducts.map(product => {
              const isInCart = cart.some(item => item.productId === product.id);
              const qtyInCart = cart.find(item => item.productId === product.id)?.quantity || 0;

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`relative p-4 rounded-xl border text-right transition flex flex-col justify-between min-h-[120px]
                    ${isInCart 
                      ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-200' 
                      : 'bg-white border-gray-200 hover:border-primary-500 shadow-sm'}
                    ${selectedProductId === product.id ? 'selected-product-animate' : ''}
                    active:scale-95 touch-manipulation`}
                >
                  {isInCart && (
                     <div className="absolute top-2 left-2 bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-sm">
                       {qtyInCart}
                     </div>
                  )}
                  <div>
                    <div className="font-bold text-lg text-gray-800 line-clamp-1 mb-1">{product.name}</div>
                    <div className="text-gray-500 text-sm">{product.size}</div>
                  </div>
                  {/* No Price Display */}
                </button>
              );
            })}
          </div>

          {/* Floating Mobile Bar */}
          <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10 flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-xs text-gray-500">العدد الحالي</span>
               <span className="font-black text-xl text-primary-600">{totalItems} قطعة</span>
            </div>
            <button 
              onClick={() => setMobileTab('cart')}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-primary-200 active:scale-95 transition"
            >
              <span>إتمام الطلب</span>
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>

        {/* Cart/Checkout Section */}
        <div className={`
          lg:col-span-5 bg-white rounded-xl lg:shadow-lg lg:border border-gray-100 flex flex-col h-full overflow-hidden
          ${mobileTab === 'cart' ? 'block fixed inset-0 z-20 lg:static' : 'hidden lg:flex'}
        `}>
          {/* Mobile Cart Header */}
          <div className="lg:hidden p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
             <button onClick={() => setMobileTab('products')} className="p-2 -mr-2 text-gray-600">
               <ArrowRight size={20} />
             </button>
             <h2 className="text-lg font-bold text-gray-800">سلة المشتريات</h2>
          </div>

          <div className="hidden lg:block p-4 border-b border-gray-100 shrink-0">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={20} />
              تفاصيل الطلبية
            </h2>
          </div>
          
          {/* Customer Search Section */}
          <div className="p-4 bg-primary-50 shrink-0 relative" ref={searchContainerRef}>
            <label className="block text-sm font-bold text-gray-700 mb-2">الزبون</label>
            <div className="relative">
              <input 
                type="text"
                className="w-full p-3 pl-10 border border-primary-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 transition text-lg font-medium"
                placeholder="بحث (اسم، رقم، تسلسل)..."
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setShowCustomerDropdown(true);
                  if (e.target.value === '') {
                     setSelectedCustomerId('');
                  }
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <ChevronDown className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {showCustomerDropdown && (
              <div className="absolute top-full right-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="p-3 text-gray-500 text-sm text-center">لا يوجد نتائج</div>
                ) : (
                  filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-right p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-lg text-gray-800 flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">{c.serialNumber}</span>
                          {c.name}
                        </div>
                        <div className="text-xs text-gray-500">{c.city} - {c.phone}</div>
                      </div>
                      {c.balance !== 0 && (
                         <span className={`text-sm font-bold px-2 py-1 rounded-full ${c.balance > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                           {formatBalance(c.balance)}
                         </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedCustomer && !showCustomerDropdown && (
               <div className="mt-3 bg-white p-3 rounded-lg border border-primary-100 shadow-sm flex justify-between items-center">
                 <div>
                   <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span className="bg-gray-100 px-2 rounded text-xs">#{selectedCustomer.serialNumber}</span>
                      {selectedCustomer.name}
                   </div>
                   <div className="text-xs text-gray-500">{selectedCustomer.city}</div>
                 </div>
                 <div className={`font-black text-lg ${selectedCustomer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                   {formatBalance(selectedCustomer.balance)}
                 </div>
               </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p>لم يتم اختيار أسطوانات بعد.</p>
                <button onClick={() => setMobileTab('products')} className="lg:hidden mt-4 text-primary-600 font-bold">الذهاب للمنتجات</button>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex-1">
                    <div className="text-lg font-bold text-gray-800">{item.productName}</div>
                    {/* No price details */}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="px-2 py-1 hover:bg-gray-100 font-bold text-lg w-8">-</button>
                      <span className="px-1 text-lg font-medium w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="px-2 py-1 hover:bg-gray-100 font-bold text-lg w-8">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.productId)} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 space-y-3 pb-safe">
            
            {/* Manual Total Input */}
            <div className="flex flex-col gap-1 bg-white p-3 rounded-xl border border-gray-200">
               <span className="text-sm font-bold text-gray-500">المجموع الكلي (المتفق عليه)</span>
               <div className="flex items-center gap-2">
                 <input 
                   type="text" 
                   className="flex-1 text-3xl font-black text-primary-600 outline-none placeholder-gray-300"
                   placeholder="0.00"
                   value={manualTotal || ''}
                   onChange={e => handleNumericInput(e.target.value, setManualTotal)}
                 />
                 <span className="text-lg font-bold text-gray-400">شيكل</span>
               </div>
            </div>
            
            <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-3">
              <h4 className="text-xs font-bold text-gray-500 mb-2">طريقة الدفع</h4>
              
              {/* Cash Input */}
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-2 rounded text-green-600"><Banknote size={20}/></div>
                <input 
                  type="text" 
                  className="flex-1 p-2 text-xl font-bold border rounded-lg bg-gray-50 focus:bg-white transition outline-none focus:ring-1 ring-primary-300"
                  placeholder="مدفوع نقداً"
                  value={cashAmount || ''}
                  onChange={e => handleNumericInput(e.target.value, setCashAmount)}
                />
              </div>

              {/* Cheque Input */}
              <div className="flex gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="bg-purple-100 p-2 rounded text-purple-600"><ScrollText size={20}/></div>
                  <input 
                    type="text" 
                    className="w-full p-2 text-lg font-bold border rounded-lg bg-gray-50 focus:bg-white transition outline-none focus:ring-1 ring-primary-300"
                    placeholder="مدفوع شيك"
                    value={chequeAmount || ''}
                    onChange={e => handleNumericInput(e.target.value, setChequeAmount)}
                  />
                </div>
                {chequeAmount > 0 && (
                  <input 
                    type="text" 
                    className="w-24 p-2 text-lg border rounded-lg bg-gray-50 focus:bg-white transition outline-none"
                    placeholder="رقم الشيك"
                    value={chequeNumber}
                    onChange={e => handleNumericInput(e.target.value, (n) => setChequeNumber(n.toString()))}
                  />
                )}
              </div>

              {/* Debt/Credit Calculation */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="flex items-center gap-2 text-gray-600 text-sm">
                  <CreditCard size={16} /> 
                  {remainingDebt > 0 ? 'المتبقي (عليه):' : remainingDebt < 0 ? 'المتبقي (له):' : 'المتبقي:'}
                </span>
                <span className={`font-black text-2xl ${remainingDebt > 0 ? 'text-red-600' : remainingDebt < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  {Math.abs(remainingDebt)} <span className="text-xs text-gray-500">شيكل</span>
                </span>
              </div>
            </div>
            
            {/* Inline Success Message Banner */}
            {success && (
              <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center font-bold animate-pulse border border-green-200">
                تمت العملية بنجاح!
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition">
                <input 
                  type="checkbox" 
                  checked={sendWhatsapp}
                  onChange={(e) => setSendWhatsapp(e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                   <MessageCircle size={16} className="text-green-600" />
                   إرسال واتساب
                </span>
              </label>

              <button 
                onClick={handleCheckout}
                disabled={cart.length === 0 || !selectedCustomerId}
                className={`flex-1 py-4 rounded-xl font-bold text-lg text-white transition flex items-center justify-center gap-2
                  ${cart.length > 0 && selectedCustomerId 
                    ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-200' 
                    : 'bg-gray-300 cursor-not-allowed'}`}
              >
                <span>حفظ الفاتورة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};