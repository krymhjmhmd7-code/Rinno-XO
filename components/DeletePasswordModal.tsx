import React from 'react';

interface DeletePasswordModalProps {
  show: boolean;
  title?: string;
  message?: string;
  passwordInput: string;
  passwordError: string;
  onPasswordChange: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeletePasswordModal: React.FC<DeletePasswordModalProps> = ({
  show,
  title = 'تأكيد الحذف',
  message = 'أدخل كلمة مرور المسؤول لإتمام الحذف.',
  passwordInput,
  passwordError,
  onPasswordChange,
  onConfirm,
  onCancel,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4 text-red-600">{title}</h3>
        <p className="text-gray-600 mb-4 text-sm">{message}</p>
        <input
          type="password"
          className={`w-full p-2 border rounded mb-2 ${passwordError ? 'border-red-500 bg-red-50' : ''}`}
          placeholder="كلمة المرور"
          value={passwordInput}
          onChange={e => onPasswordChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm()}
        />
        {passwordError && <p className="text-red-600 text-xs mb-4 font-bold">{passwordError}</p>}
        <div className="flex gap-2">
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white py-2 rounded font-bold">حذف</button>
          <button onClick={onCancel} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded">إلغاء</button>
        </div>
      </div>
    </div>
  );
};
