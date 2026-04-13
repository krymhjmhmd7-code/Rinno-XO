import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, AlertOctagon } from 'lucide-react';
import { AppSettings } from '../types';
import { storageService } from '../services/storage';

interface StorageMonitorProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
}

export const StorageMonitor: React.FC<StorageMonitorProps> = ({ settings, setSettings }) => {
  const limitMB = settings.storageLimitMB || 9000;
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
                const val = parseInt(e.target.value, 10);
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
    </div>
  );
};
