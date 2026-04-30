import React from 'react';
import { Shield, Download, Cloud } from 'lucide-react';
import { storageService } from '../services/storage';
import { AppSettings } from '../types';

interface BackupSectionProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

export const BackupSection: React.FC<BackupSectionProps> = ({ settings, setSettings }) => {
  return (
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
            <Cloud size={18} />
            مشاركة (WhatsApp)
          </button>
        </div>
      </div>
    </div>
  );
};
