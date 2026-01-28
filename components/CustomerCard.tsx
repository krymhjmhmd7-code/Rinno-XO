import React from 'react';
import { Customer } from '../types';
import { MapPin, Phone, ShoppingCart, Wallet, Repeat, Settings, Trash2, FileText, Cylinder } from 'lucide-react';

interface CustomerCardProps {
    customer: Customer;
    onOpenHistory: (customer: Customer) => void;
    onOpenEdit: (customer: Customer, e?: React.MouseEvent) => void;
    onConfirmDelete: (id: string, e?: React.MouseEvent) => void;
    onNewOrder: (customerId: string) => void;
    onManageDebt?: (customerId: string) => void;
    onManageCylinders?: (customerId: string) => void;
    formatBalance: (bal: number) => string;
    formatBalanceColor: (bal: number) => string;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
    customer,
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
        <div
            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition relative group cursor-pointer"
            onClick={() => onOpenHistory(customer)}
        >
            {/* Action Buttons - Left aligned absolute */}
            <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition z-10" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); onOpenHistory(customer); }} className="bg-white shadow text-blue-500 hover:bg-blue-50 p-2 rounded-full border border-gray-100" title="كشف حساب"><FileText size={18} /></button>
                <button onClick={(e) => onOpenEdit(customer, e)} className="bg-white shadow text-gray-500 hover:bg-gray-100 p-2 rounded-full border border-gray-100" title="تعديل"><Settings size={18} /></button>
                <button onClick={(e) => onConfirmDelete(customer.id, e)} className="bg-white shadow text-red-500 hover:bg-red-50 p-2 rounded-full border border-gray-100" title="حذف"><Trash2 size={18} /></button>
            </div>

            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 w-full">
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full font-bold text-gray-600 font-mono shrink-0">
                        {customer.serialNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-800 truncate pl-24" title={customer.name}>{customer.name}</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{customer.type}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                    <MapPin size={18} className="text-gray-400 mt-1 shrink-0" />
                    <span>
                        {customer.city} - {customer.village}
                        <br />
                        <span className="text-xs text-gray-400">{customer.neighborhood}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Phone size={18} className="text-gray-400" />
                    <span dir="ltr" className="text-lg font-mono">{customer.phone}</span>
                </div>
            </div>

            {/* Cylinder Balances */}
            <div className="mt-3 flex flex-wrap gap-1">
                {customer.cylinderBalance && Object.entries(customer.cylinderBalance).map(([name, qty]) => {
                    if (qty === 0) return null;
                    return (
                        <span key={name} className={`text-xs px-2 py-0.5 rounded border ${qty > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {name}: {qty}
                        </span>
                    );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                <span className={`font-black text-2xl ${formatBalanceColor(customer.balance)}`}>
                    {formatBalance(customer.balance)}
                </span>

                {/* Quick Actions in Grid View */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); onNewOrder(customer.id); }} className="bg-primary-50 text-primary-600 p-2 rounded-full hover:bg-primary-100 transition" title="طلبية جديدة"><ShoppingCart size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onManageDebt?.(customer.id); }} className="bg-red-50 text-red-600 p-2 rounded-full hover:bg-red-100 transition" title="الديون"><Wallet size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onManageCylinders?.(customer.id); }} className="bg-orange-50 text-orange-600 p-2 rounded-full hover:bg-orange-100 transition" title="اسطوانات"><Repeat size={18} /></button>
                </div>
            </div>
        </div>
    );
};
