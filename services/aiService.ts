
import { GoogleGenAI } from "@google/genai";
import { Invoice, Product, Customer } from "../types";

// Polyfill type definition for process.env to satisfy TypeScript in Vite
declare const process: {
  env: {
    API_KEY?: string;
    [key: string]: any;
  }
};

export const analyzeBusinessData = async (
  invoices: Invoice[],
  products: Product[],
  customers: Customer[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "الرجاء إعداد مفتاح API الخاص بـ Gemini للحصول على تحليلات ذكية.";
  }

  try {
    // Initialize GoogleGenAI with the API key from process.env as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prepare a summary for the AI (avoid sending too much raw data)
    const totalSales = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const lowStock = products.filter(p => p.stock <= p.minStock).map(p => p.name);
    const topCustomers = customers.sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 3).map(c => `${c.name} (${c.type})`);
    
    const prompt = `
      بصفتك مستشار أعمال خبير لشركة توزيع غاز في فلسطين، قم بتحليل البيانات التالية باختصار وقدم نصيحة واحدة استراتيجية:
      - إجمالي المبيعات: ${totalSales} شيكل
      - المنتجات (الأنواع) منخفضة المخزون: ${lowStock.join(', ') || 'لا يوجد'}
      - أفضل العملاء: ${topCustomers.join(', ')}
      
      الرد يجب أن يكون باللغة العربية، احترافي، وموجه لصاحب العمل.
    `;

    // Use 'gemini-3-flash-preview' for basic text tasks as per model selection rules
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Extract text directly from the response object as per extracting text guidelines
    return response.text || "لم يتم استلام رد.";
  } catch (error) {
    console.error("AI Analysis Failed", error);
    return "حدث خطأ أثناء الاتصال بالمساعد الذكي.";
  }
};
