import { Customer, Invoice, Repayment } from '../types';
import { HistoryItem } from '../components/CustomerHistory';

/**
 * Generate print-ready HTML for an invoice
 */
export const generateInvoiceHtml = (inv: Invoice): string => `
<html>
  <head>
    <title>فاتورة #${inv.id.slice(-6)}</title>
    <style>
      body { font-family: 'Arial', sans-serif; direction: rtl; padding: 20px; color: #000; }
      .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
      .info { margin-bottom: 20px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
      th, td { border: 1px solid #000; padding: 8px; text-align: right; }
      th { background-color: #fff; font-weight: bold; }
      .total { font-size: 16px; font-weight: bold; margin-top: 10px; border-top: 1px solid #000; padding-top: 10px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px dashed #000; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h2>فاتورة ضريبية / مبيعات</h2>
      <p>مؤسسة رنّو اكسجين</p>
    </div>
    <div class="info">
      <table style="border: none; width: 100%;">
        <tr style="border: none;">
          <td style="border: none;"><strong>الزبون:</strong> ${inv.customerName}</td>
          <td style="border: none; text-align: left;"><strong>التاريخ:</strong> ${new Date(inv.date).toLocaleDateString('en-US')}</td>
        </tr>
        <tr style="border: none;">
          <td style="border: none;"><strong>رقم الفاتورة:</strong> #${inv.id.slice(-6)}</td>
          <td style="border: none;"></td>
        </tr>
      </table>
    </div>
    <table>
      <thead>
        <tr><th>الصنف</th><th>الكمية</th></tr>
      </thead>
      <tbody>
        ${inv.items.map(i => `<tr><td>${i.productName}</td><td>${i.quantity}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="total">
      <p>المجموع الكلي: ${inv.totalAmount} شيكل</p>
      <p style="font-size: 14px;">المدفوع نقداً: ${inv.paymentDetails.cash} | شيك: ${inv.paymentDetails.cheque}</p>
      <p style="font-size: 14px;">المتبقي ذمم: ${inv.paymentDetails.debt} شيكل</p>
    </div>
    <div class="footer">
      <p>شكراً لتعاملكم معنا - نعتز بثقتكم</p>
    </div>
  </body>
</html>`;

/**
 * Generate print-ready HTML for customer account statement
 */
export const generateHistoryHtml = (customer: Customer, history: HistoryItem[]): string => `
<html>
  <head>
    <title>كشف حساب - ${customer.name}</title>
    <style>
      body { font-family: 'Arial', sans-serif; direction: rtl; padding: 20px; color: #000; }
      h1, h2 { text-align: center; margin: 10px 0; color: #000; font-weight: bold; font-size: 26px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 2px solid #000; }
      th, td { border: 2px solid #000; padding: 10px; text-align: right; color: #000; font-size: 15px; }
      th { background-color: #fff; font-weight: bold; border-bottom: 3px solid #000; }
      .footer { margin-top: 30px; text-align: center; font-weight: bold; }
      .balance { font-size: 24px; margin-top: 15px; padding: 15px; border: 3px solid #000; display: inline-block; font-weight: bold; width: 100%; box-sizing: border-box; }
      .customer-info { margin-top: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; font-weight: bold; font-size: 18px; }
    </style>
  </head>
  <body>
    <h2>كشف حساب زبون</h2>
    <div class="customer-info">
      <div style="display: flex; justify-content: space-between;">
        <span>الاسم: ${customer.name} (#${customer.serialNumber})</span>
        <span>تاريخ الاستخراج: ${new Date().toLocaleDateString('en-US')}</span>
      </div>
      <div style="margin-top: 5px;">رقم الجوال: ${customer.phone}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>التاريخ</th><th>البيان</th><th>صادر [-]</th><th>وارد [+]</th><th>الرصيد التراكمي</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          let currentBalance = 0;
          const rows = sorted.map(item => {
            const date = new Date(item.date).toLocaleDateString('en-US');
            let diff = 0;
            let displayedSader: string | number = '-';
            let displayedWared: string | number = '-';
            let detailsHtml = '';

            if (item.type === 'invoice') {
              const inv = item as Invoice;
              const details = inv.items.map(i => `${i.productName} (${i.quantity})`).join(' | ');
              detailsHtml = `<div>فاتورة #${inv.id.slice(-6)}</div><div style="font-size: 12px; margin-top: 5px;">${details}</div>`;
              diff = inv.paymentDetails?.debt || 0;
              displayedSader = inv.totalAmount > 0 ? inv.totalAmount : '-';
              const paid = (inv.paymentDetails?.cash || 0) + (inv.paymentDetails?.cheque || 0);
              displayedWared = paid > 0 ? paid : '-';
            } else {
              const rep = item as Repayment;
              detailsHtml = `<div>سداد/قبض</div><div style="font-size: 12px; margin-top: 5px;">${rep.method === 'cash' ? 'نقداً' : 'شيك'} ${rep.note ? `- ${rep.note}` : ''}</div>`;
              diff = -rep.amount;
              displayedWared = rep.amount > 0 ? rep.amount : '-';
            }
            
            currentBalance += diff;
            const balanceText = currentBalance > 0 ? `${Math.abs(currentBalance)} (عليه)` : currentBalance < 0 ? `${Math.abs(currentBalance)} (له)` : '0';

            return `
              <tr>
                <td style="font-weight: bold;">${date}</td>
                <td style="font-weight: bold;">${detailsHtml}</td>
                <td style="font-weight: bold;">${displayedSader}</td>
                <td style="font-weight: bold;">${displayedWared}</td>
                <td style="font-weight: bold;">${balanceText}</td>
              </tr>
            `;
          });
          return rows.reverse().join('');
        })()}
      </tbody>
    </table>
    <div class="footer">
      <div class="balance">
        الرصيد الحالي النهائي:
        ${customer.balance > 0 ? `${customer.balance} (عليه)` : `${Math.abs(customer.balance)} (له)`}
      </div>
    </div>
  </body>
</html>`;
