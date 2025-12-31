
import { storageService } from './storage';
import { googleApiService } from './googleApiService';

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SyncStatus {
    lastSync: string | null;
    isSyncing: boolean;
    error: string | null;
}

export const sheetsService = {
    // Get Access Token from User Session
    getAccessToken: (): string | null => {
        const savedUser = localStorage.getItem('rinno_user');
        if (!savedUser) return null;
        try {
            return JSON.parse(savedUser).accessToken || null;
        } catch {
            return null;
        }
    },

    getSpreadsheetId: (): string | null => {
        return storageService.getSettings().spreadsheetId || null;
    },

    // Test Connection (Checks if file exists and is accessible)
    testConnection: async (): Promise<{ success: boolean; message: string }> => {
        const token = sheetsService.getAccessToken();
        const sheetId = sheetsService.getSpreadsheetId();

        if (!token) return { success: false, message: 'غير مسجل الدخول' };
        if (!sheetId) return { success: false, message: 'لم يتم إنشاء قاعدة البيانات بعد' };

        try {
            const response = await fetch(`${SHEETS_API_URL}/${sheetId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                return { success: true, message: 'تم الاتصال بنجاح بقاعدة البيانات' };
            } else {
                return { success: false, message: 'فشل الاتصال. تحقق من الصلاحيات' };
            }
        } catch (error: any) {
            return { success: false, message: `خطأ في الاتصال: ${error.message}` };
        }
    },

    // Sync All Data (Push Local to Cloud)
    syncAllData: async (localData: any): Promise<boolean> => {
        const token = sheetsService.getAccessToken();
        const sheetId = sheetsService.getSpreadsheetId();

        if (!token || !sheetId) {
            console.error("Missing token or sheet ID for sync");
            return false;
        }

        try {
            const result = await googleApiService.syncData(token, sheetId, localData);

            if (result) {
                localStorage.setItem('rinno_last_sync_status', 'success');
                localStorage.setItem('rinno_last_sync_time', new Date().toISOString());
                return true;
            }
            return false;

        } catch (error) {
            console.error('Sync failed:', error);
            localStorage.setItem('rinno_last_sync_status', 'error');
            return false;
        }
    },

    // Legacy wrappers to prevent errors, redirecting to syncAllData approach via background
    saveSheetData: async (sheetName: string, data: any[]): Promise<boolean> => {
        return true;
    },

    appendSheetRow: async (sheetName: string, rowData: any): Promise<boolean> => {
        return true;
    },

    isConnected: (): boolean => {
        return !!sheetsService.getSpreadsheetId() && !!sheetsService.getAccessToken();
    }
};

export const getSyncStatus = (): SyncStatus => {
    return {
        lastSync: localStorage.getItem('rinno_last_sync_time'),
        isSyncing: false,
        error: localStorage.getItem('rinno_last_sync_status') === 'error' ? 'Sync Failed' : null
    };
};
