import React from 'react';
import { Customer, Product, Invoice, Repayment } from '../types';
import { History, X, Printer, Share2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

// Union type for History Items
type HistoryItem = (Invoice | Repayment) & { type: 'invoice' | 'repayment' };

interface CustomerHistoryProps {
    customer: Customer;
    history: HistoryItem[];
    onClose: () => void;
    onPrintInvoice: (inv: Invoice) => void;
    onSendInvoiceWhatsApp: (inv: Invoice, customer: Customer) => void;
    onPrintHistory: (customer: Customer, history: HistoryItem[]) => void;
    onSendHistoryWhatsApp: (customer: Customer, history: HistoryItem[]) => void;
    formatBalance: (bal: number) => string;
    formatBalanceColor: (bal: number) => string;
}

export const CustomerHistory: React.FC<CustomerHistoryProps> = ({
    customer,
    history,
    onClose,
    onPrintInvoice,
    onSendInvoiceWhatsApp,
    onPrintHistory,
    onSendHistoryWhatsApp,
    formatBalance,
    formatBalanceColor,
}) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl p-6 h-[80vh] flex flex-col">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <History size={24} className="text-primary-600" />
                            كشف حساب: {customer.name}
                            <span className="text-sm font-normal text-gray-500 mr-2">(#{customer.serialNumber})</span>
                        </h3>
                        <p className="text-lg text-gray-600 mt-1">
                            الرصيد الحالي: <span className={`font-bold ${formatBalanceColor(customer.balance)}`}>{formatBalance(customer.balance)}</span>
                        </p>
                    </div>

                    <div className="flex gap-2 self-end">
                        <button
                            onClick={() => onPrintHistory(customer, history)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        >
                            <Printer size={18} />
                            طباعة كشف
                        </button>
                        <button
                            onClick={() => onSendHistoryWhatsApp(customer, history)}
                            className="bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        >
                            <Share2 size={18} />
                            إرسال واتساب
                        </button>
                        <button onClick={onClose} className="bg-gray-100 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0">
                            <tr>
                                <th className="p-4">التاريخ</th>
                                <th className="p-4">نوع الحركة</th>
                                <th className="p-4">التفاصيل / البيان</th>
                                <th className="p-4">مدين (عليه)</th>
                                <th className="p-4">دائن (له)</th>
                                <th className="p-4">أدوات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500 text-lg">لا توجد حركات مسجلة لهذا الزبون.</td></tr>
                            ) : (
                                history.map(item => {
                                    const isInvoice = item.type === 'invoice';
                                    const inv = item as Invoice;
                                    const rep = item as Repayment;

                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50 ${isInvoice ? '' : 'bg-green-50/50'}`}>
                                            <td className="p-4 text-gray-600">{new Date(item.date).toLocaleDateString('ar-EG')}</td>

                                            <td className="p-4">
                                                {isInvoice ? (
                                                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                                                        <ArrowUpRight size={16} className="text-red-400" />
                                                        فاتورة #{inv.id.slice(-6)}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-green-700 font-bold">
                                                        <ArrowDownLeft size={16} />
                                                        سداد / قبض
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-4">
                                                {isInvoice ? (
                                                    <div className="flex flex-col">
                                                        {inv.items.map((i, idx) => (
                                                            <span key={idx} className="text-gray-600 text-xs">{i.productName} ({i.quantity})</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-green-800">
                                                        {rep.method === 'cash' ? 'نقداً' : 'شيك'}
                                                        {rep.note && <span className="text-gray-500 text-xs block">{rep.note}</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Debt (Charge) Column */}
                                            <td className="p-4 font-mono text-base font-bold text-red-600">
                                                {isInvoice ? inv.totalAmount : '-'}
                                            </td>

                                            {/* Credit (Payment) Column */}
                                            <td className="p-4 font-mono text-base font-bold text-green-600">
                                                {isInvoice ? (inv.paymentDetails.cash + inv.paymentDetails.cheque || '-') : rep.amount}
                                            </td>

                                            <td className="p-4">
                                                {isInvoice && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => onPrintInvoice(inv)}
                                                            className="p-1.5 text-gray-500 hover:text-primary-600 bg-white border rounded shadow-sm"
                                                            title="طباعة"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => onSendInvoiceWhatsApp(inv, customer)}
                                                            className="p-1.5 text-green-500 hover:text-green-700 bg-white border rounded shadow-sm"
                                                            title="واتساب"
                                                        >
                                                            <Share2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export type { HistoryItem };
