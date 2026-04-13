import React, { useState, useEffect, useRef } from 'react';
import { Save, Shield, Download, FileJson, FileSpreadsheet, Upload, Cloud, RefreshCw, Plus, Trash2, Users, AlertOctagon } from 'lucide-react';
import { storageService } from '../services/storage';
import { AppSettings } from '../types';
import { DeletePasswordSection } from './DeletePasswordSection';
import { AccessControlSection } from './AccessControlSection';
import { ConnectionStatusSection } from './ConnectionStatusSection';
import { BackupSection } from './BackupSection';
import { StorageMonitor } from './StorageMonitor';

interface SettingsProps {
  isAdmin?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ isAdmin = false }) => {
  const [settings, setSettings] = useState<AppSettings>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(storageService.getSettings());
    
  }, []);

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800">الإعدادات</h2>

      {isAdmin && (
        <AccessControlSection settings={settings} setSettings={setSettings} />
      )}

      {/* Delete Password */}
      <DeletePasswordSection settings={settings} setSettings={setSettings} />

      {/* Database Usage Monitor */}
      <StorageMonitor settings={settings} setSettings={setSettings} />

      <ConnectionStatusSection />

      <BackupSection settings={settings} setSettings={setSettings} />

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
