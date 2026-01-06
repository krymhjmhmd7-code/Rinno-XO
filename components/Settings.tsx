
import React, { useState, useEffect, useRef } from 'react';
import { Save, Shield, Download, FileJson, FileSpreadsheet, Upload, Cloud, RefreshCw, CheckCircle, XCircle, Link, Plus, Trash2, Users } from 'lucide-react';
import { storageService } from '../services/storage';
import { sheetsService, getSyncStatus, SyncStatus } from '../services/sheetsService';
import { AppSettings } from '../types';

interface SettingsProps {
  isAdmin?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ isAdmin = false }) => {
  const [settings, setSettings] = useState<AppSettings>({});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access Control
  const [newEmail, setNewEmail] = useState('');

  // Google Sheets State

  const [sheetsMessage, setSheetsMessage] = useState('');
  const [sheetsMessageType, setSheetsMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ lastSync: null, isSyncing: false, error: null });
  const [backupEmailInput, setBackupEmailInput] = useState('');

  useEffect(() => {
    setSettings(storageService.getSettings());
    setBackupEmailInput(storageService.getSettings().backupEmail || '');
    setSyncStatus(getSyncStatus());
  }, []);

  const handleSavePassword = () => {
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = storageService.importDatabaseFromJSON(event.target?.result as string);
      if (success) {
        alert('تم استيراد البيانات بنجاح! سيتم إعادة تحميل الصفحة.');
        window.location.reload();
      } else {
        alert('فشل استيراد الملف. تأكد من صحة الملف.');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Google Sheets Functions


  const handleTestConnection = async () => {
    setIsTesting(true);
    setSheetsMessage('جاري اختبار الاتصال...');
    setSheetsMessageType('info');

    const result = await sheetsService.testConnection();

    setIsTesting(false);
    setSheetsMessage(result.message);
    setSheetsMessageType(result.success ? 'success' : 'error');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSheetsMessage('جاري المزامنة...');
    setSheetsMessageType('info');

    // جمع البيانات المحلية
    const localData = {
      customers: storageService.getCustomers(),
      products: storageService.getProducts(),
      invoices: storageService.getInvoices(),
      repayments: storageService.getRepayments(),
      cylinderTransactions: storageService.getCylinderTransactions(),
      customerTypes: storageService.getCustomerTypes(),
      settings: storageService.getSettings()
    };

    const result = await sheetsService.syncAllData(localData);

    setIsSyncing(false);
    setSyncStatus(getSyncStatus());

    if (result) {
      setSheetsMessage('تمت المزامنة بنجاح!');
      setSheetsMessageType('success');
    } else {
      setSheetsMessage('فشلت المزامنة. تحقق من الرابط والاتصال.');
      setSheetsMessageType('error');
    }
  };

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

  const getMessageColor = () => {
    switch (sheetsMessageType) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800">الإعدادات</h2>

      {/* Access Control Section - Only visible to admin */}
      {isAdmin && (
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
      )}

      {/* Google Sheets Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Cloud className="text-blue-600" />
          حالة الاتصال والبيانات
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          يتم حفظ بياناتك تلقائياً في ملف Excel خاص بك يسمى <b>"Rinno Database"</b> في Google Drive.
        </p>

        <div className="space-y-4">
          {settings.spreadsheetId ? (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <p className="font-bold text-green-800">متصل بقاعدة البيانات بنجاح</p>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-green-600 underline hover:text-green-800"
                >
                  فتح ملف قاعدة البيانات (Google Sheets)
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex items-center gap-3">
              <RefreshCw className="text-orange-600 animate-spin" size={24} />
              <div>
                <p className="font-bold text-orange-800">جاري البحث عن قاعدة البيانات...</p>
                <p className="text-xs text-orange-600">سيتم الإنشاء تلقائياً بعد تسجيل الدخول.</p>
              </div>
            </div>
          )}

          {sheetsMessage && (
            <div className={`text-sm ${getMessageColor()} flex items-center gap-2`}>
              {sheetsMessageType === 'success' && <CheckCircle size={16} />}
              {sheetsMessageType === 'error' && <XCircle size={16} />}
              {sheetsMessage}
            </div>
          )}

          <div className="flex gap-3 flex-wrap mt-2">
            <button
              onClick={handleSync}
              disabled={isSyncing || !settings.spreadsheetId}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              تحديث البيانات الآن (فرض المزامنة)
            </button>
            <button
              onClick={handleTestConnection}
              className="text-gray-500 hover:text-gray-700 text-sm underline"
            >
              فحص الاتصال
            </button>
          </div>

          {syncStatus.lastSync && (
            <p className="text-xs text-gray-500">
              آخر تحديث: {new Date(syncStatus.lastSync).toLocaleString('ar-EG')}
            </p>
          )}
        </div>
      </div>

      {/* Backup Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Shield className="text-orange-600" />
          النسخ الاحتياطي (Auto Backup)
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          حماية إضافية لبياناتك يتم حفظها تلقائياً كل ساعة في مجلد منفصل.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoBackup"
              checked={settings.autoBackupEnabled || false}
              onChange={(e) => {
                const newSettings = { ...settings, autoBackupEnabled: e.target.checked };
                setSettings(newSettings);
                storageService.saveSettings(newSettings);
              }}
              className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
            />
            <label htmlFor="autoBackup" className="font-bold text-gray-700">تفعيل النسخ الاحتياطي التلقائي (كل ساعة)</label>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">بريد إضافي لاستلام النسخ (اختياري)</label>

            {/* Input Area */}
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="example@gmail.com"
                className="flex-1 p-2 border rounded-lg text-sm"
                dir="ltr"
                value={backupEmailInput}
                onChange={(e) => setBackupEmailInput(e.target.value)}
              />
              <button
                onClick={() => {
                  if (!backupEmailInput || !backupEmailInput.includes('@')) return alert('يرجى كتابة إيميل صحيح');
                  const newSettings = { ...settings, backupEmail: backupEmailInput };
                  setSettings(newSettings);
                  storageService.saveSettings(newSettings);
                  setBackupEmailInput(''); // Clear input
                  alert('تم حفظ بريد النسخ الاحتياطي بنجاح');
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus size={18} />
                إضافة
              </button>
            </div>

            {/* Saved Email Display */}
            {settings.backupEmail && (
              <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-200 mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle className="text-green-600" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{settings.backupEmail}</p>
                    <p className="text-xs text-green-600">تم الحفظ - سيتم إرسال النسخ لهذا البريد</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newSettings = { ...settings, backupEmail: undefined };
                    setSettings(newSettings);
                    storageService.saveSettings(newSettings);
                  }}
                  className="text-red-500 hover:text-red-700 p-2"
                  title="حذف"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}

            {!settings.backupEmail && (
              <p className="text-xs text-gray-400 mt-1">لم يتم تحديد بريد احتياطي بعد.</p>
            )}
          </div>

          <button
            onClick={async () => {
              if (!settings.spreadsheetId) return alert('يجب توصيل قاعدة البيانات أولاً');
              const token = sheetsService.getAccessToken();
              if (!token) return alert('يجب تسجيل الدخول أولاً');

              setSheetsMessage('جاري عمل نسخة احتياطية...');
              const result = await import('../services/googleApiService').then(m =>
                m.googleApiService.createBackup(token, settings.spreadsheetId!, settings.backupEmail)
              );

              if (result.success) {
                alert('تم إنشاء النسخة الاحتياطية بنجاح!');
                setSheetsMessage('');
              } else {
                alert(result.message);
                setSheetsMessage('');
              }
            }}
            className="bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-lg hover:bg-orange-100 flex items-center gap-2 w-fit"
          >
            <Shield size={18} />
            إنشاء نسخة احتياطية الآن
          </button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Shield className="text-primary-600" />
          حماية الحذف (كلمة مرور)
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          تستخدم كلمة المرور هذه لتأكيد عمليات الحذف المهمة في النظام.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <input
              type="password"
              className="w-full p-2 border rounded-lg"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">تأكيد كلمة المرور</label>
            <input
              type="password"
              className="w-full p-2 border rounded-lg"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          {message && <div className={`text-sm ${message.includes('بنجاح') ? 'text-green-600' : 'text-red-600'}`}>{message}</div>}

          <button
            onClick={handleSavePassword}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 mt-2"
          >
            <Save size={18} />
            حفظ كلمة المرور
          </button>
        </div>
      </div>

      {/* Export/Import Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Download className="text-green-600" />
          تصدير واستيراد البيانات
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          يمكنك تنزيل نسخة كاملة من قاعدة البيانات، أو استعادة نسخة سابقة.
          <br />
          <span className="text-xs text-orange-500">ملاحظة: النظام يقوم بالتنزيل التلقائي لملف Excel يومياً الساعة 10 مساءً.</span>
        </p>

        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => storageService.exportDatabaseToExcel()}
            className="flex-1 bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-lg hover:bg-green-100 flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={20} />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={() => storageService.exportDatabaseToJSON()}
            className="flex-1 bg-gray-50 text-gray-700 border border-gray-200 px-4 py-3 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-2"
          >
            <FileJson size={20} />
            <span>تصدير بيانات</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".json"
          />
          <button
            onClick={handleImportClick}
            className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-3 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
          >
            <Upload size={20} />
            <span>استيراد بيانات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
