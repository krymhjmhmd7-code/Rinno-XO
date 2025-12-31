/**
 * Google Apps Script - Rinno OX Database
 * 
 * هذا الكود يُنسخ إلى Google Apps Script
 * يوفر واجهة API للتطبيق
 * 
 * الإعداد:
 * 1. إنشاء Google Sheet جديد
 * 2. Extensions → Apps Script
 * 3. لصق هذا الكود
 * 4. Deploy → New deployment → Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. نسخ الرابط واستخدامه في التطبيق
 */

// أسماء الأوراق
const SHEET_NAMES = {
    CUSTOMERS: 'customers',
    PRODUCTS: 'products',
    INVOICES: 'invoices',
    REPAYMENTS: 'repayments',
    CYLINDER_TX: 'cylinderTransactions',
    CUSTOMER_TYPES: 'customerTypes',
    SETTINGS: 'settings'
};

/**
 * معالجة طلبات GET (قراءة البيانات)
 */
function doGet(e) {
    try {
        const sheetName = e.parameter.sheet;

        if (!sheetName) {
            return jsonResponse({ error: 'Missing sheet parameter' }, 400);
        }

        const data = getSheetData(sheetName);
        return jsonResponse({ success: true, data: data });

    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

/**
 * معالجة طلبات POST (كتابة البيانات)
 */
function doPost(e) {
    try {
        const params = JSON.parse(e.postData.contents);
        const action = params.action;
        const sheetName = params.sheet;
        const data = params.data;

        if (!sheetName) {
            return jsonResponse({ error: 'Missing sheet parameter' }, 400);
        }

        switch (action) {
            case 'save':
                // حفظ/تحديث البيانات بالكامل
                saveSheetData(sheetName, data);
                return jsonResponse({ success: true, message: 'Data saved' });

            case 'append':
                // إضافة صف جديد
                appendRow(sheetName, data);
                return jsonResponse({ success: true, message: 'Row appended' });

            case 'update':
                // تحديث صف محدد
                updateRow(sheetName, params.id, data);
                return jsonResponse({ success: true, message: 'Row updated' });

            case 'delete':
                // حذف صف
                deleteRow(sheetName, params.id);
                return jsonResponse({ success: true, message: 'Row deleted' });

            case 'sync':
                // مزامنة كاملة
                const allData = syncAllData(data);
                return jsonResponse({ success: true, data: allData });

            default:
                return jsonResponse({ error: 'Unknown action' }, 400);
        }

    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

/**
 * قراءة بيانات ورقة
 */
function getSheetData(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    // إنشاء الورقة إذا لم تكن موجودة
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        return [];
    }

    const data = sheet.getDataRange().getValues();

    if (data.length === 0) return [];

    // تحويل إلى مصفوفة كائنات
    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            let value = row[index];
            // محاولة تحويل JSON المخزن
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    value = JSON.parse(value);
                } catch (e) { }
            }
            obj[header] = value;
        });
        return obj;
    });
}

/**
 * حفظ بيانات كاملة (استبدال)
 */
function saveSheetData(sheetName, data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    // إنشاء الورقة إذا لم تكن موجودة
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }

    // مسح البيانات القديمة
    sheet.clear();

    if (!data || data.length === 0) return;

    // استخراج العناوين من أول كائن
    const headers = Object.keys(data[0]);

    // إعداد البيانات
    const rows = data.map(item => {
        return headers.map(header => {
            const value = item[header];
            // تحويل الكائنات إلى JSON
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value);
            }
            return value !== undefined ? value : '';
        });
    });

    // كتابة العناوين والبيانات
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
}

/**
 * إضافة صف جديد
 */
function appendRow(sheetName, rowData) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        const headers = Object.keys(rowData);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => {
        const value = rowData[header];
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return value !== undefined ? value : '';
    });

    sheet.appendRow(newRow);
}

/**
 * تحديث صف بواسطة ID
 */
function updateRow(sheetName, id, rowData) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('id');

    if (idIndex === -1) return;

    for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === id) {
            const newRow = headers.map(header => {
                const value = rowData[header];
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value !== undefined ? value : '';
            });
            sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
            break;
        }
    }
}

/**
 * حذف صف بواسطة ID
 */
function deleteRow(sheetName, id) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('id');

    if (idIndex === -1) return;

    for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === id) {
            sheet.deleteRow(i + 1);
            break;
        }
    }
}

/**
 * مزامنة كاملة لجميع البيانات
 */
function syncAllData(clientData) {
    // حفظ بيانات العميل
    if (clientData.customers) saveSheetData(SHEET_NAMES.CUSTOMERS, clientData.customers);
    if (clientData.products) saveSheetData(SHEET_NAMES.PRODUCTS, clientData.products);
    if (clientData.invoices) saveSheetData(SHEET_NAMES.INVOICES, clientData.invoices);
    if (clientData.repayments) saveSheetData(SHEET_NAMES.REPAYMENTS, clientData.repayments);
    if (clientData.cylinderTransactions) saveSheetData(SHEET_NAMES.CYLINDER_TX, clientData.cylinderTransactions);
    if (clientData.customerTypes) saveSheetData(SHEET_NAMES.CUSTOMER_TYPES, [{ types: JSON.stringify(clientData.customerTypes) }]);
    if (clientData.settings) saveSheetData(SHEET_NAMES.SETTINGS, [clientData.settings]);

    // إرجاع البيانات المحدثة
    return {
        customers: getSheetData(SHEET_NAMES.CUSTOMERS),
        products: getSheetData(SHEET_NAMES.PRODUCTS),
        invoices: getSheetData(SHEET_NAMES.INVOICES),
        repayments: getSheetData(SHEET_NAMES.REPAYMENTS),
        cylinderTransactions: getSheetData(SHEET_NAMES.CYLINDER_TX),
        customerTypes: getCustomerTypes(),
        settings: getSettings()
    };
}

/**
 * الحصول على تصنيفات الزبائن
 */
function getCustomerTypes() {
    const data = getSheetData(SHEET_NAMES.CUSTOMER_TYPES);
    if (data.length > 0 && data[0].types) {
        try {
            return JSON.parse(data[0].types);
        } catch (e) { }
    }
    return ['غير مصنف', 'مستشفى', 'مركز طبي', 'مستوصف', 'فرد', 'شركة', 'مجمع سكني', 'مطعم'];
}

/**
 * الحصول على الإعدادات
 */
function getSettings() {
    const data = getSheetData(SHEET_NAMES.SETTINGS);
    return data.length > 0 ? data[0] : {};
}

/**
 * إرجاع استجابة JSON
 */
function jsonResponse(data, statusCode = 200) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * دالة اختبار
 */
function testSetup() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // إنشاء جميع الأوراق
    Object.values(SHEET_NAMES).forEach(name => {
        if (!ss.getSheetByName(name)) {
            ss.insertSheet(name);
        }
    });

    Logger.log('Setup complete! All sheets created.');
}
