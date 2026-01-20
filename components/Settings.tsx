import React, { useState, useEffect, useRef } from 'react';
import { Save, Shield, Download, FileJson, FileSpreadsheet, Upload, Cloud, RefreshCw, Plus, Trash2, Users, AlertOctagon } from 'lucide-react';
import { storageService } from '../services/storage';
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

  // Turso Connection State
  const [sheetsMessage, setSheetsMessage] = useState('');
  const [sheetsMessageType, setSheetsMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [backupEmailInput, setBackupEmailInput] = useState('');

  useEffect(() => {
    setSettings(storageService.getSettings());
    setBackupEmailInput(storageService.getSettings().backupEmail || '');
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

      {/* Security Settings - Password */}
      {isAdmin && (
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
      )}

      {/* Database Usage Monitor */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
        <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-full text-blue-600">
              <Cloud size={20} />
            </div>
            حالة التخزين السحابي (Cloud Storage)
          </div>
          <button
            onClick={() => window.dispatchEvent(new Event('refreshStorageMonitor'))}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} />
          </button>
        </h3>

        {(() => {
          const limitMB = settings.storageLimitMB || 9000; // Default 9GB
          const [usage, setUsage] = useState({ sizeBytes: 0, rows: 0, loading: true });

          useEffect(() => {
            const fetchUsage = async () => {
              setUsage(prev => ({ ...prev, loading: true }));
              try {
                const { dataService } = await import('../services/dbService');
                const stats = await dataService.getDatabaseUsage();
                setUsage({ ...stats, loading: false });
              } catch (e) { console.error(e); setUsage(prev => ({ ...prev, loading: false })); }
            };
            fetchUsage();

            const handleRefresh = () => fetchUsage();
            window.addEventListener('refreshStorageMonitor', handleRefresh);
            return () => window.removeEventListener('refreshStorageMonitor', handleRefresh);
          }, []);

          const usedMB = usage.sizeBytes / (1024 * 1024);
          const percent = Math.min((usedMB / limitMB) * 100, 100);
          const isCritical = percent > 90;

          return (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-2xl font-bold text-gray-800">{usedMB < 1 ? '< 1' : usedMB.toFixed(1)}</span>
                  <span className="text-xs text-gray-500 mx-1">MB مستخدم</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">من أصل {limitMB / 1000} GB</div>
                  <div className={`text-sm font-bold ${isCritical ? 'text-red-600' : 'text-green-600'}`}>
                    {percent.toFixed(2)}% ممتلئ
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>

              {/* Critical Warning */}
              {isCritical && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm mt-2">
                  <AlertOctagon size={18} />
                  <strong>تحذير:</strong> لقد اقتربت من امتلاء قاعدة البيانات! يرجى التواصل مع الدعم للترقية.
                </div>
              )}

              {/* Plan Configuration */}
              <details className="text-xs text-gray-400 mt-2">
                <summary className="cursor-pointer hover:text-blue-500">تعديل حد الخطة (للمتقدمين فقط)</summary>
                <div className="mt-2 flex items-center gap-2">
                  <span>الحد الأقصى (MB):</span>
                  <input
                    type="number"
                    value={settings.storageLimitMB || 9000}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const newSettings = { ...settings, storageLimitMB: val };
                      setSettings(newSettings);
                      storageService.saveSettings(newSettings);
                    }}
                    className="border p-1 rounded w-24 text-center"
                  />
                </div>
              </details>

              <div className="text-xs text-gray-400 mt-2 flex justify-between">
                <span>عدد السجلات التقريبي: {usage.rows}</span>
                <span> {usage.loading ? 'جاري الحساب...' : 'تم التحديث'}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Connection Status Section - For Debugging */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
            <Cloud size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">حالة الاتصال بقاعدة البيانات (Turso)</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-col">
              <span className="font-bold text-gray-700">قاعدة البيانات المتصلة:</span>
              <span className="text-xs text-gray-500 font-mono mt-1" dir="ltr">
                {import.meta.env.VITE_TURSO_DATABASE_URL
                  ? import.meta.env.VITE_TURSO_DATABASE_URL.replace('libsql://', '').split('.')[0] + '... (Turso)'
                  : 'غير متصل'}
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${import.meta.env.VITE_TURSO_DATABASE_URL ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {import.meta.env.VITE_TURSO_DATABASE_URL ? 'متصل ✅' : 'مفصول ❌'}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={async () => {
                setSheetsMessage('جاري فحص الاتصال...');
                try {
                  const { tursoClient } = await import('../services/dbService');
                  if (!tursoClient) {
                    setSheetsMessage('العميل غير مهيأ (راجع المتغيرات)');
                    setSheetsMessageType('error');
                    return;
                  }
                  await tursoClient.execute('SELECT 1');
                  setSheetsMessage('الاتصال ناجح! ✅');
                  setSheetsMessageType('success');
                } catch (e: any) {
                  setSheetsMessage(`فشل الاتصال: ${e.message}`);
                  setSheetsMessageType('error');
                }
              }}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition flex-1 justify-center"
            >
              <RefreshCw size={18} />
              فحص الاتصال
            </button>

            <button
              onClick={() => {
                storageService.syncAllFromDb().then(res => {
                  if (res) alert('تمت المزامنة بنجاح');
                  else alert('فشلت المزامنة');
                });
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition flex-1 justify-center"
            >
              <Download size={18} />
              جلب البيانات
            </button>

            <button
              onClick={() => {
                if (confirm('تنبيه: سيقوم هذا الخيار برفع جميع البيانات من هذا الجهاز إلى السحابة. هل أنت متأكد؟')) {
                  storageService.syncAllToDb().then(res => {
                    if (res) alert('تم رفع البيانات للسحابة بنجاح! ✅');
                    else alert('حدث خطأ أثناء الرفع ❌');
                  });
                }
              }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold transition flex-1 justify-center"
            >
              <Upload size={18} />
              رفع للسحابة
            </button>

            <button
              onClick={() => {
                const pwd = prompt('أدخل كلمة المرور لتأكيد حذف جميع البيانات نهائياً:');
                if (pwd === 'rinno2025') {
                  if (confirm('تحذير أخير: سيتم حذف كل شيء بلا رجعة. هل أنت متأكد؟')) {
                    storageService.factoryReset().then(res => {
                      if (res) {
                        alert('تم تصفير النظام بنجاح');
                        window.location.reload();
                      } else {
                        alert('فشلت العملية');
                      }
                    });
                  }
                } else if (pwd !== null) {
                  alert('كلمة المرور خاطئة');
                }
              }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition flex-1 justify-center"
            >
              تصفير النظام
            </button>
          </div>

          <div className="text-xs text-gray-400 font-mono mt-2 p-2 bg-gray-100 rounded flex justify-between">
            <span>Server Reset: <span id="server-ts">Loading...</span></span>
            <span>Local Reset: {localStorage.getItem('last_reset_timestamp') || 'None'}</span>
          </div>
          <button
            onClick={async () => {
              const el = document.getElementById('server-ts');
              if (el) el.innerText = 'Checking...';
              try {
                const { dataService } = await import('../services/dbService');
                const ts = await dataService.getResetTimestamp();
                if (el) el.innerText = ts || 'NULL';

                const local = localStorage.getItem('last_reset_timestamp');
                if (ts && ts !== local) {
                  if (confirm(`Detected remote reset mismatch.\nServer: ${ts}\nLocal: ${local}\nWipe now?`)) {
                    localStorage.clear();
                    window.location.reload();
                  }
                } else {
                  alert('Sync is up to date.');
                }
              } catch (e) {
                if (el) el.innerText = 'Error';
                console.error(e);
              }
            }}
            className="text-xs text-blue-500 underline text-center block w-full"
          >
            Check Reset Signal
          </button>
          {sheetsMessage && (
            <div className={`p-3 rounded-lg text-sm font-bold text-center ${getMessageColor()}`}>
              {sheetsMessage}
            </div>
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


          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm text-gray-700 font-bold">رقم واتساب للنسخ الاحتياطي</label>
              <span className="text-xs text-gray-400 font-mono">
                آخر نسخ: {settings.lastBackupDate ? new Date(settings.lastBackupDate).toLocaleDateString('en-US') : 'لم يتم بعد'}
              </span>
            </div>

            {/* Input Area */}
            <div className="flex gap-2 mb-3">
              <input
                type="tel"
                placeholder="Ex: 972591234567"
                className="flex-1 p-2 border rounded-lg text-sm text-center font-mono"
                dir="ltr"
                value={settings.backupWhatsapp || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const newSettings = { ...settings, backupWhatsapp: val };
                  setSettings(newSettings);
                  storageService.saveSettings(newSettings);
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                storageService.exportDatabaseToExcel();
              }}
              className="bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2 flex-1 justify-center"
            >
              <Download size={18} />
              تنزيل (Download)
            </button>

            <button
              onClick={async () => {
                try {
                  // 1. Generate File
                  const file = storageService.exportDatabaseToExcel(true) as File;

                  // 2. Share
                  if (navigator.share) {
                    await navigator.share({
                      title: 'Rinno Backup',
                      text: `نسخة احتياطية - ${new Date().toLocaleDateString()}`,
                      files: [file]
                    });
                  } else {
                    alert('المشاركة غير مدعومة في هذا المتصفح. سيتم التنزيل بدلاً من ذلك.');
                    storageService.exportDatabaseToExcel();
                  }
                } catch (e) {
                  console.error(e);
                  // User cancelled share or error
                }
              }}
              className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 flex items-center gap-2 flex-1 justify-center"
            >
              <div className="w-1 h-1 bg-green-500 rounded-full animate-ping absolute top-0 right-0"></div>
              <Cloud size={18} />
              مشاركة (WhatsApp)
            </button>
          </div>
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
