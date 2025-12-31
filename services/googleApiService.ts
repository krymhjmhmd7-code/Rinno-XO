
import { storageService } from './storage';
import { Customer, Product, Invoice, Repayment, AppSettings } from '../types';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DB_FILENAME = 'Rinno Database';

interface SheetProperties {
    sheetId: number;
    title: string;
}

export const googleApiService = {

    // 1. Initial Setup: Find or Create Database
    initializeDatabase: async (accessToken: string): Promise<string | null> => {
        try {
            // Step A: Search for existing file
            const searchUrl = `${DRIVE_API_URL}?q=name='${DB_FILENAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
            const searchRes = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                console.log('Database found:', searchData.files[0].id);

                // Save ID to settings
                const settings = storageService.getSettings();
                storageService.saveSettings({ ...settings, spreadsheetId: searchData.files[0].id });

                return searchData.files[0].id;
            }

            // Step B: Create new file if not found
            console.log('Database not found. Creating new...');
            const createRes = await fetch(SHEETS_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: { title: DB_FILENAME },
                    sheets: [
                        { properties: { title: 'Customers' } },
                        { properties: { title: 'Products' } },
                        { properties: { title: 'Invoices' } },
                        { properties: { title: 'Repayments' } },
                        { properties: { title: 'Settings' } },
                    ]
                })
            });

            const createData = await createRes.json();
            const newSpreadsheetId = createData.spreadsheetId;
            console.log('Database created:', newSpreadsheetId);

            // Save ID to settings
            const settings = storageService.getSettings();
            storageService.saveSettings({ ...settings, spreadsheetId: newSpreadsheetId });

            // Step C: Initialize Headers
            await googleApiService.initializeHeaders(accessToken, newSpreadsheetId);

            return newSpreadsheetId;
        } catch (error) {
            console.error('Error initializing database:', error);
            return null;
        }
    },

    // 2. Initialize Headers for new sheets
    initializeHeaders: async (accessToken: string, spreadsheetId: string) => {
        const headers = {
            Customers: ['id', 'name', 'phone', 'location', 'type', 'balance', 'cylinderBalance', 'notes', 'priceType'],
            Products: ['id', 'name', 'type', 'price', 'dealerPrice', 'stock'],
            Invoices: ['id', 'customerId', 'customerName', 'date', 'items', 'totalAmount', 'paidAmount', 'remainingAmount', 'type'],
            Repayments: ['id', 'customerId', 'amount', 'date', 'notes'],
            Settings: ['json']
        };

        const requests = Object.entries(headers).map(([sheetName, cols]) => {
            return fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${sheetName}!A1:Z1?valueInputOption=RAW`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [cols] })
            });
        });

        await Promise.all(requests);
    },

    // 3. Sync Data (Save Local to Cloud)
    syncData: async (accessToken: string, spreadsheetId: string, data: any) => {
        // Helper to format data for sheets
        const formatForSheet = (items: any[], headers: string[]) => {
            return items.map(item => headers.map(header => {
                const val = item[header];
                if (typeof val === 'object') return JSON.stringify(val);
                return val;
            }));
        };

        // Prepare updates
        const updates = [
            { range: 'Customers!A2', values: formatForSheet(data.customers, ['id', 'name', 'phone', 'location', 'type', 'balance', 'cylinderBalance', 'notes', 'priceType']) },
            { range: 'Products!A2', values: formatForSheet(data.products, ['id', 'name', 'type', 'price', 'dealerPrice', 'stock']) },
            { range: 'Invoices!A2', values: formatForSheet(data.invoices, ['id', 'customerId', 'customerName', 'date', 'items', 'totalAmount', 'paidAmount', 'remainingAmount', 'type']) },
            { range: 'Repayments!A2', values: formatForSheet(data.repayments, ['id', 'customerId', 'amount', 'date', 'notes']) },
        ];

        // Execute Batch Update
        for (const update of updates) {
            if (update.values.length === 0) continue; // Skip empty tables

            await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${update.range}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: update.values })
            });
        }

        return true;
    },

    // 4. Backup System
    ensureBackupFolder: async (accessToken: string): Promise<string | null> => {
        try {
            const folderName = 'Rinno Backups';
            const searchUrl = `${DRIVE_API_URL}?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const searchRes = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                return searchData.files[0].id;
            }

            // Create folder
            const createRes = await fetch(DRIVE_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            });
            const createData = await createRes.json();
            return createData.id;
        } catch (error) {
            console.error('Error creating backup folder:', error);
            return null;
        }
    },

    createBackup: async (accessToken: string, fileId: string, backupEmail?: string): Promise<{ success: boolean; message: string }> => {
        try {
            // 1. Get/Create Backup Folder
            const folderId = await googleApiService.ensureBackupFolder(accessToken);
            if (!folderId) return { success: false, message: 'فشل في الوصول لمجلد النسخ الاحتياطي' };

            // 2. Create timestamped name
            const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
            const backupName = `Rinno Backup - ${date}`;

            // 3. Copy File
            const copyRes = await fetch(`${DRIVE_API_URL}/${fileId}/copy`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: backupName,
                    parents: [folderId]
                })
            });

            if (!copyRes.ok) throw new Error('Copy failed');
            const copyData = await copyRes.json();
            const newFileId = copyData.id;

            // 4. Share with Backup Email (if provided)
            if (backupEmail) {
                await fetch(`${DRIVE_API_URL}/${newFileId}/permissions`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'user',
                        emailAddress: backupEmail
                    })
                });
            }

            return { success: true, message: 'تم إنشاء النسخة الاحتياطية بنجاح' };
        } catch (error: any) {
            console.error('Backup failed:', error);
            return { success: false, message: `فشل النسخ الاحتياطي: ${error.message}` };
        }
    }
};

