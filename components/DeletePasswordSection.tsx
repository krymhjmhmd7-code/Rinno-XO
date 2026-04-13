import React, { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { storageService } from '../services/storage';
import { AppSettings } from '../types';

interface DeletePasswordSectionProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
}

export const DeletePasswordSection: React.FC<DeletePasswordSectionProps> = ({ settings, setSettings }) => {
  const [delPwd, setDelPwd] = useState('');
  const [delPwdConfirm, setDelPwdConfirm] = useState('');
  const [delPwdMsg, setDelPwdMsg] = useState('');

  const handleSaveDeletePassword = () => {
    if (!delPwd) { setDelPwdMsg('أدخل كلمة المرور الجديدة'); return; }
    if (delPwd !== delPwdConfirm) { setDelPwdMsg('كلمتا المرور غير متطابقتين'); return; }
    const newSettings = { ...settings, deletePassword: delPwd };
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
    setDelPwdMsg('تم حفظ كلمة مرور الحذف بنجاح ✅');
    setDelPwd('');
    setDelPwdConfirm('');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Trash2 className="text-orange-500" />
        كلمة مرور الحذف
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        كلمة مرور تُطلب عند حذف أي بيانات (زبائن، فواتير، سدادات، اسطوانات، منتجات). الافتراضية: <strong>1234</strong>
      </p>
      <div className="space-y-3">
        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
          حالة كلمة المرور: <strong className="text-gray-800">{settings.deletePassword ? 'معيّنة ✔️' : 'افتراضية (1234)'}</strong>
        </div>
        <input
          type="password"
          placeholder="كلمة المرور الجديدة"
          className="w-full p-2 border rounded-lg"
          value={delPwd}
          onChange={(e) => setDelPwd(e.target.value)}
        />
        <input
          type="password"
          placeholder="تأكيد كلمة المرور"
          className="w-full p-2 border rounded-lg"
          value={delPwdConfirm}
          onChange={(e) => setDelPwdConfirm(e.target.value)}
        />
        {delPwdMsg && <div className={`text-sm ${delPwdMsg.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>{delPwdMsg}</div>}
        <button
          onClick={handleSaveDeletePassword}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 w-full"
        >
          <Save size={18} className="inline ml-2" />
          حفظ كلمة مرور الحذف
        </button>
      </div>
    </div>
  );
};
