import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { storageService } from '../services/storage';
import { Customer, Product, CylinderTransaction } from '../types';

export const CylinderLoansScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<CylinderTransaction[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [quantity, setQuantity] = useState('1');
    const [type, setType] = useState<'out' | 'in'>('out');
    const [note, setNote] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [loadedCustomers, loadedProducts, loadedTransactions] = await Promise.all([
            storageService.getCustomers(),
            storageService.getProducts(),
            storageService.getCylinderTransactions(),
        ]);
        setCustomers(loadedCustomers);
        setProducts(loadedProducts);
        setTransactions(loadedTransactions.slice(0, 20)); // Last 20
    };

    const handleSave = async () => {
        if (!selectedCustomerId || !selectedProduct) {
            Alert.alert('خطأ', 'يرجى اختيار الزبون والمنتج');
            return;
        }

        const qty = parseInt(quantity) || 1;
        const customer = customers.find(c => c.id === selectedCustomerId);

        const transaction: CylinderTransaction = {
            id: Date.now().toString(),
            customerId: selectedCustomerId,
            customerName: customer?.name || '',
            productName: selectedProduct,
            quantity: qty,
            type,
            date: new Date().toISOString(),
            note,
        };

        // Save transaction
        const allTransactions = await storageService.getCylinderTransactions();
        await storageService.saveCylinderTransactions([transaction, ...allTransactions]);

        // Update customer cylinder balance
        const allCustomers = await storageService.getCustomers();
        const updatedCustomers = allCustomers.map(c => {
            if (c.id === selectedCustomerId) {
                const balance = { ...c.cylinderBalance } || {};
                const currentQty = balance[selectedProduct] || 0;
                balance[selectedProduct] = type === 'out' ? currentQty + qty : Math.max(0, currentQty - qty);
                return { ...c, cylinderBalance: balance };
            }
            return c;
        });
        await storageService.saveCustomers(updatedCustomers);

        Alert.alert('نجاح', 'تم تسجيل الحركة');
        loadData();
        setQuantity('1');
        setNote('');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>← رجوع</Text>
                </TouchableOpacity>
                <Text style={styles.title}>مداينة الاسطوانات</Text>
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
                                <Picker.Item key={c.id} label={c.name} value={c.id} />
                            ))}
                        </Picker>
                    </View>

                    <Text style={styles.label}>اختر المنتج</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedProduct}
                            onValueChange={setSelectedProduct}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- اختر المنتج --" value="" />
                            {products.map(p => (
                                <Picker.Item key={p.id} label={p.name} value={p.name} />
                            ))}
                        </Picker>
                    </View>

                    <Text style={styles.label}>نوع الحركة</Text>
                    <View style={styles.typeContainer}>
                        <TouchableOpacity
                            style={[styles.typeBtn, type === 'out' && styles.typeOutActive]}
                            onPress={() => setType('out')}
                        >
                            <Text style={[styles.typeText, type === 'out' && styles.typeTextActive]}>إعارة (خروج)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeBtn, type === 'in' && styles.typeInActive]}
                            onPress={() => setType('in')}
                        >
                            <Text style={[styles.typeText, type === 'in' && styles.typeTextActive]}>إرجاع (دخول)</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>الكمية</Text>
                    <TextInput
                        style={styles.input}
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        placeholderTextColor="#9ca3af"
                    />

                    <Text style={styles.label}>ملاحظة</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ملاحظة..."
                        value={note}
                        onChangeText={setNote}
                        placeholderTextColor="#9ca3af"
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>تسجيل الحركة</Text>
                    </TouchableOpacity>
                </View>

                {/* Transaction History */}
                <View style={styles.section}>
                    <Text style={styles.label}>سجل الحركات</Text>
                    {transactions.map(t => (
                        <View key={t.id} style={styles.transactionRow}>
                            <View style={[styles.typeBadge, t.type === 'out' ? styles.badgeOut : styles.badgeIn]}>
                                <Text style={styles.badgeText}>{t.type === 'out' ? 'إعارة' : 'إرجاع'}</Text>
                            </View>
                            <View style={styles.transactionInfo}>
                                <Text style={styles.transactionCustomer}>{t.customerName}</Text>
                                <Text style={styles.transactionDetails}>{t.productName} × {t.quantity}</Text>
                                <Text style={styles.transactionDate}>{new Date(t.date).toLocaleDateString('en-US')}</Text>
                            </View>
                        </View>
                    ))}
                </View>
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
    label: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12, textAlign: 'right' },
    pickerContainer: { backgroundColor: '#f3f4f6', borderRadius: 8, marginBottom: 16 },
    picker: { height: 50 },
    typeContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    typeBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
    typeOutActive: { backgroundColor: '#dc2626' },
    typeInActive: { backgroundColor: '#22c55e' },
    typeText: { fontWeight: 'bold', color: '#374151' },
    typeTextActive: { color: '#fff' },
    input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'right', fontSize: 16 },
    saveBtn: { backgroundColor: '#8b5cf6', padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    transactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginLeft: 12 },
    badgeOut: { backgroundColor: '#fee2e2' },
    badgeIn: { backgroundColor: '#dcfce7' },
    badgeText: { fontSize: 12, fontWeight: 'bold' },
    transactionInfo: { flex: 1, alignItems: 'flex-end' },
    transactionCustomer: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
    transactionDetails: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    transactionDate: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
});
