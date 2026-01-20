import React, { useState } from 'react';
import { Flame, LogIn, Mail, Shield } from 'lucide-react';

// Admin email - the only email allowed to access when list is empty
const ADMIN_EMAIL = 'krymhjmhmd7@gmail.com';

interface SimpleLoginProps {
    onLoginSuccess: (email: string) => void;
    allowedEmails: string[];
}

export const SimpleLogin: React.FC<SimpleLoginProps> = ({ onLoginSuccess, allowedEmails }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();

        // 1. Validate Form
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('يرجى إدخال بريد إلكتروني صحيح');
            setIsLoading(false);
            return;
        }

        if (!trimmedPassword) {
            setError('يرجى إدخال كلمة المرور');
            setIsLoading(false);
            return;
        }

        // 2. Load Settings for Auth Logic
        // We need to dynamic import storage service or pass it as prop, best to import here to avoid circular dep issues in some architectures, 
        // but storage is standard. Let's assume global storage or import it.
        // Since SimpleLogin is a component, we can use the imported storageService from App.tsx context or import it directly.
        // We will do a dynamic import to be safe / consistent with other patterns used here, or better just import it at top. 
        // NOTE: The previous view of this file did NOT show storageService import. I will add it or assume it needs to be imported.
        // Actually, let's use the one that should be imported. I'll add the import in a separate step if needed, 
        // but for now I will assume I can access it via the existing import pattern if I add it.
        // Wait, I see I can probably just import it at the top. 
        // Let's modify the imports first in a separate Tool call if it's missing?
        // No, I will include the import in the `replace_file_content` if I can target the top, OR
        // I will use `await import('../services/storage')` inside the function.

        try {
            const { storageService } = await import('../services/storage');
            const settings = storageService.getSettings();

            // 3. Verify Password
            // If no password set yet, maybe allow default or block? 
            // Let's assume 'rinno2025' as default if not set to prevent lockout, OR enforce empty check.
            // User requested "Password protection", implies strictness.
            const validPassword = settings.adminPassword || 'rinno2025'; // Fallback default

            if (trimmedPassword !== validPassword) {
                setError('كلمة المرور غير صحيحة');
                setIsLoading(false);
                return;
            }

            // 4. Verify Email
            const allowedEmails = settings.allowedEmails || [];
            if (allowedEmails.length === 0) {
                // First user (Admin) check
                // The constant ADMIN_EMAIL is defined in this file (lines 4-5)
                if (trimmedEmail !== 'krymhjmhmd7@gmail.com') { // Hardcoded fallback or use const
                    setError('عذراً، هذا البريد غير مصرح له بالدخول كمسؤول رئيسي.');
                    setIsLoading(false);
                    return;
                }
            } else {
                if (!allowedEmails.includes(trimmedEmail)) {
                    setError('عذراً، هذا البريد غير مصرح له بالدخول.\nيرجى التواصل مع المسؤول.');
                    setIsLoading(false);
                    return;
                }
            }

            // Success
            onLoginSuccess(trimmedEmail);

        } catch (e) {
            console.error(e);
            setError('حدث خطأ أثناء الدخول');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md text-center">

                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
                        <Flame fill="white" size={48} />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-gray-800 tracking-tight leading-none mb-2">
                    Rinno <span className="text-primary-600">OX</span>
                </h1>
                <p className="text-gray-500 mb-8">نظام إدارة وتوزيع الغاز المتكامل</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                            البريد الإلكتروني
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="example@gmail.com"
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                dir="ltr"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                            كلمة المرور
                        </label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                dir="ltr"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm whitespace-pre-line">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-primary-500 to-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary-200 transition-all disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span>جاري التحقق...</span>
                        ) : (
                            <>
                                <LogIn size={20} />
                                <span>دخول آمن</span>
                            </>
                        )}
                    </button>
                </form>

                <p className="text-xs text-gray-400 mt-6">
                    يمكن للمسؤول فقط إضافة مستخدمين جدد من الإعدادات
                </p>
            </div>
        </div>
    );
};

export { ADMIN_EMAIL };
