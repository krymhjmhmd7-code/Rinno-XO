import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Flame } from 'lucide-react';
import { UserProfile } from '../types';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {

  // 1. Web Login Hook
  const webLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoRes.json();
        const user: UserProfile = {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          accessToken: tokenResponse.access_token
        };
        onLoginSuccess(user);
      } catch (error) {
        console.error("Web Login Error:", error);
        alert("فشل تسجيل الدخول (Web).");
      }
    },
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file email profile',
  });

  // 2. Native Login Function
  const nativeLogin = async () => {
    try {
      const user = await GoogleAuth.signIn();

      // Native plugin returns authentication object slightly differently
      // We need the authentication.accessToken for API calls
      const userProfile: UserProfile = {
        email: user.email,
        name: user.name || user.givenName || 'User',
        picture: user.imageUrl,
        accessToken: user.authentication.accessToken
      };

      onLoginSuccess(userProfile);
    } catch (error) {
      console.error("Native Login Error:", error);
      alert("فشل تسجيل الدخول (Mobile).");
    }
  };

  // 3. Unified Handler
  const handleLogin = () => {
    if (Capacitor.isNativePlatform()) {
      nativeLogin();
    } else {
      webLogin();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md text-center">

        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-200 animate-pulse">
            <Flame fill="white" size={48} />
          </div>
        </div>

        <h1 className="text-3xl font-black text-gray-800 tracking-tight leading-none mb-2">
          Rinno <span className="text-primary-600">OX</span>
        </h1>
        <p className="text-gray-500 mb-8">نظام إدارة وتوزيع الغاز المتكامل</p>

        <div className="space-y-4">
          <p className="text-sm font-bold text-gray-700">يرجى تسجيل الدخول للمتابعة</p>

          <div className="flex justify-center flex-col items-center gap-3">
            <button
              onClick={handleLogin}
              className="flex items-center gap-3 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-full hover:bg-gray-50 hover:shadow-md transition-all font-bold text-lg w-full justify-center"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
              <span>تسجيل الدخول باستخدام Google</span>
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            سيطلب التطبيق إذن الوصول إلى Google Drive
            <br />
            (لإنشاء ملف قاعدة البيانات تلقائياً)
          </p>
        </div>
      </div>
    </div>
  );
};
