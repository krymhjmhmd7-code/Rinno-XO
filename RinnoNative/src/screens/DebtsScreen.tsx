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
import { Picker } from '@react-native-picker/picker';
import { storageService } from '../services/storage';
import { Customer, Repayment } from '../types';

export const DebtsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<'cash' | 'cheque'>('cash');
    const [note, setNote] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (route.params?.customerId) {
            setSelectedCustomerId(route.params.customerId);
        }
    }, [route.params?.customerId]);

    const loadData = async () => {
        const data = await storageService.getCustomers();
        setCustomers(data.filter(c => c.balance > 0));
    };

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    const handleSave = async () => {
        if (!selectedCustomerId) {
            Alert.alert('خطأ', 'يرجى اختيار الزبون');
            return;
        }
        const repaymentAmount = parseInt(amount) || 0;
        if (repaymentAmount <= 0) {
            Alert.alert('خطأ', 'يرجى إدخال مبلغ صحيح');
            return;
        }

        const repayment: Repayment = {
            id: Date.now().toString(),
            customerId: selectedCustomerId,
            customerName: selectedCustomer?.name || '',
            amount: repaymentAmount,
            date: new Date().toISOString(),
            method,
            note,
        };

        // Save repayment
        const repayments = await storageService.getRepayments();
        await storageService.saveRepayments([...repayments, repayment]);

        // Update customer balance
        const allCustomers = await storageService.getCustomers();
        const updatedCustomers = allCustomers.map(c =>
            c.id === selectedCustomerId
                ? { ...c, balance: c.balance - repaymentAmount }
                : c
        );
        await storageService.saveCustomers(updatedCustomers);

        Alert.alert('نجاح', 'تم تسجيل السداد', [
            { text: 'موافق', onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>← رجوع</Text>
                </TouchableOpacity>
                <Text style={styles.title}>تسجيل سداد</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.label}>اختر الزبون</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedCustomerId}
                            onValueChange={setSelectedCustomerId}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- اختر الزبون --" value="" />
                            {customers.map(c => (
                                <Picker.Item key={c.id} label={`${c.name} (${c.balance} عليه)`} value={c.id} />
                            ))}
                        </Picker>
                    </View>

                    {selectedCustomer && (
                        <View style={styles.balanceCard}>
                            <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
                            <Text style={styles.balanceValue}>{selectedCustomer.balance} شيكل</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>مبلغ السداد</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="أدخل المبلغ"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholderTextColor="#9ca3af"
                    />

                    <Text style={styles.label}>طريقة الدفع</Text>
                    <View style={styles.methodContainer}>
                        <TouchableOpacity
                            style={[styles.methodBtn, method === 'cash' && styles.methodActive]}
                            onPress={() => setMethod('cash')}
                        >
                            <Text style={[styles.methodText, method === 'cash' && styles.methodTextActive]}>نقداً</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodBtn, method === 'cheque' && styles.methodActive]}
                            onPress={() => setMethod('cheque')}
                        >
                            <Text style={[styles.methodText, method === 'cheque' && styles.methodTextActive]}>شيك</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>ملاحظة (اختياري)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ملاحظة..."
                        value={note}
                        onChangeText={setNote}
                        placeholderTextColor="#9ca3af"
                    />
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>تسجيل السداد</Text>
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
    label: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12, textAlign: 'right' },
    pickerContainer: { backgroundColor: '#f3f4f6', borderRadius: 8 },
    picker: { height: 50 },
    balanceCard: { backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, marginTop: 12, alignItems: 'center' },
    balanceLabel: { fontSize: 14, color: '#dc2626' },
    balanceValue: { fontSize: 24, fontWeight: 'bold', color: '#dc2626', marginTop: 4 },
    input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'right', fontSize: 16 },
    methodContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    methodBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
    methodActive: { backgroundColor: '#22c55e' },
    methodText: { fontWeight: 'bold', color: '#374151' },
    methodTextActive: { color: '#fff' },
    saveBtn: { backgroundColor: '#22c55e', padding: 16, margin: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
