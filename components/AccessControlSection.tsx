import React, { useState } from 'react';
import { Shield, Plus, Trash2, Users, Save } from 'lucide-react';
import { storageService } from '../services/storage';
import { AppSettings } from '../types';

interface AccessControlSectionProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

export const AccessControlSection: React.FC<AccessControlSectionProps> = ({ settings, setSettings }) => {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleAddEmail = () => {
    if (!newEmail || !newEmail.includes('@')) return;

    const currentList = settings.allowedEmails || [];
    if (currentList.includes(newEmail)) return;

    const updatedList = [...currentList, newEmail];
    const newSettings = { ...settings, allowedEmails: updatedList };

    setSettings(newSettings);
    storageService.saveSettings(newSettings);
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    // Prevent deleting the admin email
    const currentSettings = storageService.getSettings();
    if (email === currentSettings.adminEmail) {
      alert('لا يمكن حذف إيميل المسؤول الرئيسي.');
      return;
    }
    const currentList = settings.allowedEmails || [];
    const updatedList = currentList.filter(e => e !== email);
    const newSettings = { ...settings, allowedEmails: updatedList };

    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleSavePassword = () => {
    // BUG-41 FIX: Prevent saving empty password
    if (!password.trim()) {
      setMessage('كلمة المرور لا يمكن أن تكون فارغة');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('كلمات المرور غير متطابقة');
      return;
    }

    const newSettings = { ...settings, adminPassword: password };
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
    setPassword('');
    setConfirmPassword('');
    setMessage('تم حفظ كلمة المرور بنجاح');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Users className="text-purple-600" />
          صلاحيات الدخول (للحماية)
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          أضف البريد الإلكتروني (Gmail) للأشخاص المسموح لهم بالدخول للنظام.
          <br />
          <span className="text-xs text-orange-500">أنت المسؤول الرئيسي - يمكنك إضافة أو إزالة المستخدمين.</span>
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="email"
            placeholder="example@gmail.com"
            className="flex-1 p-2 border rounded-lg text-sm"
            dir="ltr"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <button
            onClick={handleAddEmail}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus size={18} />
            إضافة
          </button>
        </div>

        <div className="space-y-2">
          {settings.allowedEmails?.map(email => (
            <div key={email} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{email}</span>
                {email === settings.adminEmail && (
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">المسؤول</span>
                )}
              </div>
              {email !== settings.adminEmail && (
                <button
                  onClick={() => handleRemoveEmail(email)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Shield className="text-red-500" />
          تأمين النظام (كلمة المرور)
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          تعيين كلمة مرور موحدة للدخول. لن يتمكن أي موظف من الدخول إلا بمعرفة هذه الكلمة بالإضافة للإيميل.
        </p>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="كلمة المرور الجديدة"
            className="w-full p-2 border rounded-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="تأكيد كلمة المرور"
            className="w-full p-2 border rounded-lg"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {message && <div className={`text-sm ${message.includes('بنجاح') ? 'text-green-600' : 'text-red-600'}`}>{message}</div>}

          <button
            onClick={handleSavePassword}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 w-full"
          >
            <Save size={18} className="inline ml-2" />
            حفظ كلمة المرور
          </button>
        </div>
      </div>
    </div>
  );
};
