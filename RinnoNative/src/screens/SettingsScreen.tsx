import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storageService } from '../services/storage';
import { AppSettings } from '../types';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [settings, setSettings] = useState<AppSettings>({});
    const [password, setPassword] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deletePasswordConfirm, setDeletePasswordConfirm] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const data = await storageService.getSettings();
        setSettings(data);
        setPassword(data.adminPassword || '');
    };

    const handleSave = async () => {
        const updatedSettings = { ...settings, adminPassword: password };
        await storageService.saveSettings(updatedSettings);
        Alert.alert('نجاح', 'تم حفظ الإعدادات');
    };

    const handleSaveDeletePassword = async () => {
        if (!deletePassword) {
            Alert.alert('خطأ', 'أدخل كلمة المرور الجديدة');
            return;
        }
        if (deletePassword !== deletePasswordConfirm) {
            Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
            return;
        }
        const updatedSettings = { ...settings, deletePassword };
        setSettings(updatedSettings);
        await storageService.saveSettings(updatedSettings);
        setDeletePassword('');
        setDeletePasswordConfirm('');
        Alert.alert('نجاح', 'تم حفظ كلمة مرور الحذف');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>← رجوع</Text>
                </TouchableOpacity>
                <Text style={styles.title}>الإعدادات</Text>
            </View>

            <ScrollView style={styles.content}>
                {/* Admin Password */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔒 كلمة مرور الدخول</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="كلمة مرور المسؤول"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholderTextColor="#9ca3af"
                    />
                    <Text style={styles.hint}>كلمة مرور موحدة للدخول للنظام</Text>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>حفظ كلمة مرور الدخول</Text>
                    </TouchableOpacity>
                </View>

                {/* Delete Password */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🗑️ كلمة مرور الحذف</Text>
                    <View style={styles.currentPwdBox}>
                        <Text style={styles.currentPwdLabel}>كلمة المرور الحالية:</Text>
                        <Text style={styles.currentPwdValue}>{settings.deletePassword || '1234'}</Text>
                    </View>
                    <Text style={styles.hint}>تُطلب عند حذف أي بيانات. الافتراضية: 1234</Text>
                    <TextInput
                        style={[styles.input, { marginTop: 12 }]}
                        placeholder="كلمة المرور الجديدة"
                        value={deletePassword}
                        onChangeText={setDeletePassword}
                        secureTextEntry
                        placeholderTextColor="#9ca3af"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="تأكيد كلمة المرور"
                        value={deletePasswordConfirm}
                        onChangeText={setDeletePasswordConfirm}
                        secureTextEntry
                        placeholderTextColor="#9ca3af"
                    />
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#f97316' }]} onPress={handleSaveDeletePassword}>
                        <Text style={styles.saveBtnText}>حفظ كلمة مرور الحذف</Text>
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ℹ️ معلومات التطبيق</Text>
                    <Text style={styles.infoText}>رنّو اكسجين - Rinno OX</Text>
                    <Text style={styles.infoText}>الإصدار: 2.1.0 (React Native)</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    backBtn: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
    content: { flex: 1, padding: 16 },
    section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1f2937', marginBottom: 14, textAlign: 'right' },
    label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, textAlign: 'right' },
    input: { backgroundColor: '#f3f4f6', padding: 14, borderRadius: 10, marginBottom: 10, textAlign: 'right', fontSize: 16 },
    hint: { fontSize: 12, color: '#6b7280', textAlign: 'right', marginBottom: 4 },
    infoText: { fontSize: 14, color: '#6b7280', textAlign: 'right', marginBottom: 8 },
    saveBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    currentPwdBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f3f4f6', padding: 14, borderRadius: 10, marginBottom: 8, alignItems: 'center' },
    currentPwdLabel: { fontSize: 14, color: '#6b7280' },
    currentPwdValue: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
});
