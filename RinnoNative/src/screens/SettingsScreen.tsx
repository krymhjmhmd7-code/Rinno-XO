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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>← رجوع</Text>
                </TouchableOpacity>
                <Text style={styles.title}>الإعدادات</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>الأمان</Text>

                    <Text style={styles.label}>كلمة مرور المسؤول</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="كلمة المرور"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholderTextColor="#9ca3af"
                    />
                    <Text style={styles.hint}>تستخدم لحماية عمليات الحذف</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>معلومات التطبيق</Text>
                    <Text style={styles.infoText}>رنّو اكسجين - Rinno OX</Text>
                    <Text style={styles.infoText}>الإصدار: 2.0.0 (React Native)</Text>
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>حفظ الإعدادات</Text>
            </TouchableOpacity>
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
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16, textAlign: 'right' },
    label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, textAlign: 'right' },
    input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 8, textAlign: 'right', fontSize: 16 },
    hint: { fontSize: 12, color: '#6b7280', textAlign: 'right' },
    infoText: { fontSize: 14, color: '#6b7280', textAlign: 'right', marginBottom: 8 },
    saveBtn: { backgroundColor: '#3b82f6', padding: 16, margin: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
