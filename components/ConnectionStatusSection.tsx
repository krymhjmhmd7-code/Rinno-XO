import React, { useState } from 'react';
import { Cloud, RefreshCw, Download, Upload } from 'lucide-react';
import { storageService } from '../services/storage';

export const ConnectionStatusSection: React.FC = () => {
  const [sheetsMessage, setSheetsMessage] = useState('');
  const [sheetsMessageType, setSheetsMessageType] = useState<'success' | 'error' | 'info'>('info');

  const getMessageColor = () => {
    switch (sheetsMessageType) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  return (
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
  );
};
