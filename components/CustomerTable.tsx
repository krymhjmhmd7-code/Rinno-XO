import React from 'react';
import { Customer } from '../types';
import { ShoppingCart, Wallet, Repeat, Settings, Trash2 } from 'lucide-react';

interface CustomerTableProps {
    customers: Customer[];
    onOpenHistory: (customer: Customer) => void;
    onOpenEdit: (customer: Customer, e?: React.MouseEvent) => void;
    onConfirmDelete: (id: string, e?: React.MouseEvent) => void;
    onNewOrder: (customerId: string) => void;
    onManageDebt?: (customerId: string) => void;
    onManageCylinders?: (customerId: string) => void;
    formatBalance: (bal: number) => string;
    formatBalanceColor: (bal: number) => string;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
    customers,
    onOpenHistory,
    onOpenEdit,
    onConfirmDelete,
    onNewOrder,
    onManageDebt,
    onManageCylinders,
    formatBalance,
    formatBalanceColor,
}) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-700 font-bold text-sm">
                        <tr>
                            <th className="p-4 w-16">#</th>
                            <th className="p-4">الاسم</th>
                            <th className="p-4 hidden md:table-cell">التصنيف</th>
                            <th className="p-4 hidden md:table-cell">العنوان</th>
                            <th className="p-4 hidden md:table-cell">الاتصال</th>
                            <th className="p-4">الرصيد (شيكل)</th>
                            <th className="p-4">الإجراءات السريعة</th>
                            <th className="p-4">أدوات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {customers.map(c => (
                            <tr
                                key={c.id}
                                className="hover:bg-gray-50 transition cursor-pointer"
                                onClick={() => onOpenHistory(c)}
                            >
                                <td className="p-4 font-mono text-gray-500">{c.serialNumber}</td>
                                <td className="p-4 font-bold text-lg text-gray-800">{c.name}</td>
                                <td className="p-4 hidden md:table-cell"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs">{c.type}</span></td>
                                <td className="p-4 text-sm text-gray-600 hidden md:table-cell">{c.city} - {c.village}</td>
                                <td className="p-4 text-lg font-mono hidden md:table-cell" dir="ltr">{c.phone}</td>
                                <td className={`p-4 font-black text-xl ${formatBalanceColor(c.balance)}`}>
                                    {formatBalance(c.balance)}
                                </td>
                                <td className="p-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={(e) => { e.stopPropagation(); onNewOrder(c.id); }} className="text-white bg-primary-500 hover:bg-primary-600 p-2 rounded-lg flex items-center gap-1 shadow-sm transition" title="طلبية جديدة"><ShoppingCart size={18} /> <span className="text-xs font-bold hidden xl:inline">بيع</span></button>
                                    <button onClick={(e) => { e.stopPropagation(); onManageDebt?.(c.id); }} className="text-white bg-red-500 hover:bg-red-600 p-2 rounded-lg flex items-center gap-1 shadow-sm transition" title="الديون"><Wallet size={18} /> <span className="text-xs font-bold hidden xl:inline">ديون</span></button>
                                    <button onClick={(e) => { e.stopPropagation(); onManageCylinders?.(c.id); }} className="text-white bg-orange-500 hover:bg-orange-600 p-2 rounded-lg flex items-center gap-1 shadow-sm transition" title="اسطوانات"><Repeat size={18} /> <span className="text-xs font-bold hidden xl:inline">عهد</span></button>
                                </td>
                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => onOpenEdit(c, e)} className="text-gray-400 hover:text-green-600 p-2 hover:bg-green-50 rounded-full transition" title="تعديل"><Settings size={20} /></button>
                                        <button onClick={(e) => onConfirmDelete(c.id, e)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition" title="حذف"><Trash2 size={20} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
