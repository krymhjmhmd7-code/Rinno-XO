import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, CheckSquare, Square, AlertTriangle, Shield, User, Clock, Package, FileText, CreditCard, Cylinder } from 'lucide-react';
import { useDeletePassword } from '../hooks/useDeletePassword';
import { DeletePasswordModal } from './DeletePasswordModal';
import { storageService } from '../services/storage';
import { SoftDeletedRecord } from '../types';

const TYPE_LABELS: Record<string, string> = {
  customer: 'زبون',
  invoice: 'فاتورة',
  repayment: 'سداد',
  cylinder_transaction: 'حركة اسطوانة',
  product: 'منتج',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  customer: <User size={16} />,
  invoice: <FileText size={16} />,
  repayment: <CreditCard size={16} />,
  cylinder_transaction: <Cylinder size={16} />,
  product: <Package size={16} />,
};

const TYPE_COLORS: Record<string, string> = {
  customer: 'bg-blue-100 text-blue-700',
  invoice: 'bg-orange-100 text-orange-700',
  repayment: 'bg-green-100 text-green-700',
  cylinder_transaction: 'bg-purple-100 text-purple-700',
  product: 'bg-pink-100 text-pink-700',
};

interface RecycleBinProps {
  onUpdate: () => void;
}

export const RecycleBin: React.FC<RecycleBinProps> = ({ onUpdate }) => {
  const [items, setItems] = useState<SoftDeletedRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const {
    showPasswordModal,
    passwordInput,
    passwordError,
    setPasswordInput,
    requestDelete,
    verifyAndExecute,
    cancelDelete
  } = useDeletePassword();
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    refreshItems();
  }, []);

  const refreshItems = () => {
    setItems(storageService.getRecycleBin());
    setSelectedIds(new Set());
  };

  const filteredItems = filterType === 'all'
    ? items
    : items.filter(i => i.type === filterType);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleRestore = (id: string) => {
    const success = storageService.restoreFromRecycleBin(id);
    if (success) {
      showSuccess('تم الاسترجاع بنجاح');
      refreshItems();
      onUpdate();
    }
  };

  const handleRestoreSelected = () => {
    if (selectedIds.size === 0) return;
    const count = storageService.restoreMultipleFromRecycleBin(Array.from(selectedIds));
    showSuccess(`تم استرجاع ${count} عنصر بنجاح`);
    refreshItems();
    onUpdate();
  };

  const handleEmptyBin = () => {
    requestDelete(async () => {
      await storageService.emptyRecycleBin();
      showSuccess('تم تفريغ سلة المحذوفات نهائياً');
      refreshItems();
      onUpdate();
    });
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 className="text-red-600" size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">سلة المحذوفات</h2>
            <p className="text-gray-500 text-sm">{items.length} عنصر محذوف</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleRestoreSelected}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-bold"
            >
              <RotateCcw size={16} />
              استرجاع المحدد ({selectedIds.size})
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={handleEmptyBin}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-bold"
            >
              <Trash2 size={16} />
              تفريغ السلة
            </button>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm font-bold animate-pulse">
          ✅ {successMsg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'customer', label: 'زبائن' },
          { key: 'invoice', label: 'فواتير' },
          { key: 'repayment', label: 'سدادات' },
          { key: 'cylinder_transaction', label: 'اسطوانات' },
          { key: 'product', label: 'منتجات' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilterType(tab.key); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition ${
              filterType === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="mr-1 opacity-75">
                ({items.filter(i => tab.key === 'all' || i.type === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Trash2 className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-400 text-lg">سلة المحذوفات فارغة</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Select All Header */}
          <div className="bg-gray-50 p-3 border-b flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-gray-500 hover:text-primary-600">
              {selectedIds.size === filteredItems.length ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>
            <span className="text-sm text-gray-500 font-bold">
              {selectedIds.size > 0 ? `${selectedIds.size} محدد` : 'تحديد الكل'}
            </span>
          </div>

          {/* Items */}
          <div className="divide-y divide-gray-100">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition ${
                  selectedIds.has(item.id) ? 'bg-blue-50' : ''
                }`}
              >
                {/* Checkbox */}
                <button onClick={() => toggleSelect(item.id)} className="text-gray-400 hover:text-primary-600 shrink-0">
                  {selectedIds.has(item.id) ? <CheckSquare size={20} className="text-primary-600" /> : <Square size={20} />}
                </button>

                {/* Type Badge */}
                <span className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${TYPE_COLORS[item.type]}`}>
                  {TYPE_ICONS[item.type]}
                  {TYPE_LABELS[item.type]}
                </span>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{item.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(item.deletedAt)} - {formatTime(item.deletedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {item.deletedBy}
                    </span>
                  </div>
                </div>

                {/* Restore Button */}
                <button
                  onClick={() => handleRestore(item.id)}
                  className="bg-green-50 hover:bg-green-100 text-green-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-bold transition shrink-0"
                >
                  <RotateCcw size={14} />
                  استرجاع
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Bin Password Modal */}
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
