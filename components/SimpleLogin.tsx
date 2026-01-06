import React, { useState } from 'react';
import { Flame, LogIn, Mail } from 'lucide-react';

// Admin email - the only email allowed to access when list is empty
const ADMIN_EMAIL = 'krymhjmhmd7@gmail.com';

interface SimpleLoginProps {
    onLoginSuccess: (email: string) => void;
    allowedEmails: string[];
}

export const SimpleLogin: React.FC<SimpleLoginProps> = ({ onLoginSuccess, allowedEmails }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const trimmedEmail = email.trim().toLowerCase();

        // Validate email format
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('يرجى إدخال بريد إلكتروني صحيح');
            setIsLoading(false);
            return;
        }

        // Check if list is empty - only admin can access
        if (allowedEmails.length === 0) {
            if (trimmedEmail === ADMIN_EMAIL) {
                onLoginSuccess(trimmedEmail);
            } else {
                setError('عذراً، هذا البريد غير مصرح له بالدخول.\nيرجى التواصل مع المسؤول.');
            }
            setIsLoading(false);
            return;
        }

        // Check if email is in allowed list
        if (allowedEmails.includes(trimmedEmail)) {
            onLoginSuccess(trimmedEmail);
        } else {
            setError('عذراً، هذا البريد غير مصرح له بالدخول.\nيرجى التواصل مع المسؤول.');
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
                                <span>دخول</span>
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
