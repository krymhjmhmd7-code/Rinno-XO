import React from 'react';

interface QuantityModalProps {
  isOpen: boolean;
  productName: string | undefined;
  qtyInput: string;
  setQtyInput: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const QuantityModal: React.FC<QuantityModalProps> = ({
  isOpen,
  productName,
  qtyInput,
  setQtyInput,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-gray-800 mb-1 text-center">{productName}</h3>
        <p className="text-sm text-gray-500 mb-4 text-center">أدخل الكمية المطلوبة</p>
        <input
          type="number"
          className="w-full text-center text-4xl font-black p-4 border-2 border-primary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }}
          autoFocus
          min={1}
        />
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[1, 2, 3, 5, 10, 15, 20, 50].map(n => (
            <button
              key={n}
              onClick={() => setQtyInput(String(n))}
              className={`py-2 rounded-lg font-bold text-sm transition active:scale-95 ${
                qtyInput === String(n)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onConfirm}
            className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-700 transition active:scale-95"
          >
            تأكيد ✓
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-200 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-300 transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
