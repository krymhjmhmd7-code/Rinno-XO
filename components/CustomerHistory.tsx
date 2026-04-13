import React from 'react';
import { Customer, Product, Invoice, Repayment } from '../types';
import { History, X, Printer, Share2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useDeletePassword } from '../hooks/useDeletePassword';
import { DeletePasswordModal } from './DeletePasswordModal';
import { storageService } from '../services/storage';

// Union type for History Items
type HistoryItem = (Invoice | Repayment) & { type: 'invoice' | 'repayment' };

interface CustomerHistoryProps {
    customer: Customer;
    history: HistoryItem[];
    onClose: () => void;
    onPrintInvoice: (inv: Invoice) => void;
    onShareInvoice: (inv: Invoice, customer: Customer) => void;
    onPrintHistory: (customer: Customer, history: HistoryItem[]) => void;
    onShareHistory: (customer: Customer, history: HistoryItem[]) => void;
    onDeleteTransaction: (type: 'invoice' | 'repayment', id: string, customerId: string) => void;
    onUpdateTransactionDate: (type: 'invoice' | 'repayment', id: string, newDate: string) => void;
    formatBalance: (bal: number) => string;
    formatBalanceColor: (bal: number) => string;
}

export const CustomerHistory: React.FC<CustomerHistoryProps> = ({
    customer,
    history,
    onClose,
    onPrintInvoice,
    onShareInvoice,
    onPrintHistory,
    onShareHistory,
    onDeleteTransaction,
    onUpdateTransactionDate,
    formatBalance,
    formatBalanceColor,
}) => {
    // State for Editing
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editDate, setEditDate] = React.useState('');
    const {
        showPasswordModal,
        passwordInput,
        passwordError,
        setPasswordInput,
        requestDelete,
        verifyAndExecute,
        cancelDelete
    } = useDeletePassword();

    const handleStartEdit = (item: HistoryItem) => {
        setEditingId(item.id);
        const dateStr = new Date(item.date).toISOString().split('T')[0]; // YYYY-MM-DD
        setEditDate(dateStr);
        
    };

    const handleSaveEdit = (item: HistoryItem) => {
        if (!editDate) return;
        // Construct ISO string with existing time or T00:00:00? 
        // Best to keep time if possible, but simplicity: set to noon or keep time component?
        // Let's just create a new date at current time or Keep original time?
        // Simple: new Date(editDate) sets to 00:00 UTC usually.
        // Let's append current time or 12:00
        const current = new Date();
        const newDateObj = new Date(editDate);
        newDateObj.setHours(current.getHours(), current.getMinutes(), current.getSeconds());

        onUpdateTransactionDate(item.type, item.id, newDateObj.toISOString());
        setEditingId(null);
    };

    const handleConfirmDelete = (type: 'invoice' | 'repayment', id: string) => {
        requestDelete(() => {
            onDeleteTransaction(type, id, customer.id);
        });
    };
    // 1. Sort ascending to calculate prefix sum (chronological order)
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 2. Map running balances
    let currentBalance = 0;
    const ledgerHistory = sortedHistory.map(item => {
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
        
        return {
            originalItem: item,
            runningBalance: currentBalance,
            displayedSader,
            displayedWared,
            diff
        };
    });

    // 3. Reverse back to descending for standard list display (newest first)
    ledgerHistory.reverse();
    const calculatedBalance = currentBalance;

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
                            الرصيد الحالي: <span className={`font-bold ${formatBalanceColor(calculatedBalance)}`}>{formatBalance(calculatedBalance)}</span>
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
                            onClick={() => onShareHistory(customer, history)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        >
                            <Share2 size={18} />
                            مشاركة كشف
                        </button>
                        <button onClick={onClose} className="bg-gray-100 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-bold border-b border-gray-200 text-gray-900 border-l">التاريخ</th>
                                <th className="p-4 font-bold border-b border-gray-200 text-gray-900 border-l">نوع الحركة</th>
                                <th className="p-4 font-bold border-b border-gray-200 text-gray-900 border-l">البيان</th>
                                <th className="p-4 font-black border-b border-gray-200 text-gray-900 border-l">صادر <span className="text-gray-500 font-normal">[-]</span></th>
                                <th className="p-4 font-black border-b border-gray-200 text-gray-900 border-l">وارد <span className="text-gray-500 font-normal">[+]</span></th>
                                <th className="p-4 font-black border-b border-gray-200 text-gray-900 border-l">الرصيد التراكمي</th>
                                <th className="p-4 font-bold border-b border-gray-200 text-gray-900">أدوات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500 text-lg">لا توجد حركات مسجلة لهذا الزبون.</td></tr>
                            ) : (
                                ledgerHistory.map(ledgerRow => {
                                    const item = ledgerRow.originalItem;
                                    const isInvoice = item.type === 'invoice';
                                    const inv = item as Invoice;
                                    const rep = item as Repayment;

                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50 ${isInvoice ? '' : 'bg-green-50/50'}`}>
                                            <td className="p-4 text-gray-800 border-l font-bold">
                                                {editingId === item.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="date"
                                                            value={editDate}
                                                            onChange={e => setEditDate(e.target.value)}
                                                            className="p-1 border rounded text-xs"
                                                        />
                                                        <button onClick={() => handleSaveEdit(item)} className="text-green-600 font-bold text-xs">حفظ</button>
                                                        <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs">إلغاء</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 group">
                                                        <span>{new Date(item.date).toLocaleDateString('en-US')}</span>
                                                        <button
                                                            onClick={() => handleStartEdit(item)}
                                                            className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-600 transition-opacity"
                                                            title="تعديل التاريخ"
                                                        >
                                                            <History size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-4 border-l">
                                                {isInvoice ? (
                                                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                                                        <ArrowUpRight size={16} className="text-gray-400" />
                                                        فاتورة #{inv.id.slice(-6)}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                                                        <ArrowDownLeft size={16} className="text-gray-400" />
                                                        سداد / قبض
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-4 border-l">
                                                {isInvoice ? (
                                                    <div className="flex flex-col">
                                                        {inv.items.map((i, idx) => (
                                                            <span key={idx} className="text-gray-600 text-xs font-bold">{i.productName} ({i.quantity})</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-600 font-bold">
                                                        {rep.method === 'cash' ? 'نقداً' : 'شيك'}
                                                        {rep.note && <span className="text-gray-500 text-xs block font-normal">{rep.note}</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Debt (Charge) Column */}
                                            <td className="p-4 font-mono text-base font-black text-gray-800 border-l">
                                                {ledgerRow.displayedSader !== '-' && <span className="text-gray-500 ml-1 text-xs font-normal">[-]</span>}
                                                {ledgerRow.displayedSader}
                                            </td>

                                            {/* Credit (Payment) Column */}
                                            <td className="p-4 font-mono text-base font-black text-gray-800 border-l">
                                                {ledgerRow.displayedWared !== '-' && <span className="text-gray-500 ml-1 text-xs font-normal">[+]</span>}
                                                {ledgerRow.displayedWared}
                                            </td>
                                            
                                            {/* Running Balance Column */}
                                            <td className="p-4 font-mono text-base font-black border-l">
                                                <div className="flex flex-col">
                                                    <span className={ledgerRow.runningBalance > 0 ? "text-gray-900" : ledgerRow.runningBalance < 0 ? "text-gray-900" : "text-gray-500"}>
                                                        {Math.abs(ledgerRow.runningBalance)} 
                                                        <span className="mr-1 text-xs font-normal">
                                                            {ledgerRow.runningBalance > 0 ? '(عليه)' : ledgerRow.runningBalance < 0 ? '(له)' : '-'}
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex gap-2 items-center">
                                                    {isInvoice && (
                                                        <>
                                                            <button
                                                                onClick={() => onPrintInvoice(inv)}
                                                                className="p-1.5 text-gray-500 hover:text-primary-600 bg-white border rounded shadow-sm"
                                                                title="طباعة"
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => onShareInvoice(inv, customer)}
                                                                className="p-1.5 text-blue-500 hover:text-blue-700 bg-white border rounded shadow-sm"
                                                                title="مشاركة"
                                                            >
                                                                <Share2 size={16} />
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* Delete Button */}
                                                    <button
                                                            onClick={() => handleConfirmDelete(isInvoice ? 'invoice' : 'repayment', item.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                            title="حذف الحركة"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Password Prompt Modal */}
            <DeletePasswordModal
                show={showPasswordModal}
                passwordInput={passwordInput}
                passwordError={passwordError}
                onPasswordChange={setPasswordInput}
                onConfirm={verifyAndExecute}
                onCancel={cancelDelete}
            />
        </div>
    );
};

export type { HistoryItem };
