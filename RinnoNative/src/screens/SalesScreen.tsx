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
import { Customer, Product, Invoice, CartItem, PaymentDetails } from '../types';

export const SalesScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [payment, setPayment] = useState({ cash: '', cheque: '' });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (route.params?.customerId) {
            setSelectedCustomerId(route.params.customerId);
        }
    }, [route.params?.customerId]);

    const loadData = async () => {
        const [loadedCustomers, loadedProducts] = await Promise.all([
            storageService.getCustomers(),
            storageService.getProducts(),
        ]);
        setCustomers(loadedCustomers);
        setProducts(loadedProducts.filter(p => p.isActive !== false));
    };

    const addToCart = (product: Product) => {
        const existing = cart.find(c => c.productId === product.id);
        if (existing) {
            setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setCart([...cart, { productId: product.id, productName: product.name, quantity: 1 }]);
        }
    };

    const updateQuantity = (productId: string, qty: number) => {
        if (qty <= 0) {
            setCart(cart.filter(c => c.productId !== productId));
        } else {
            setCart(cart.map(c => c.productId === productId ? { ...c, quantity: qty } : c));
        }
    };

    const totalAmount = cart.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        return sum + (product ? item.quantity * 50 : 0); // Default price 50
    }, 0);

    const cashAmount = parseInt(payment.cash) || 0;
    const chequeAmount = parseInt(payment.cheque) || 0;
    const debtAmount = totalAmount - cashAmount - chequeAmount;

    const handleSave = async () => {
        if (!selectedCustomerId) {
            Alert.alert('خطأ', 'يرجى اختيار الزبون');
            return;
        }
        if (cart.length === 0) {
            Alert.alert('خطأ', 'السلة فارغة');
            return;
        }

        const customer = customers.find(c => c.id === selectedCustomerId);
        if (!customer) return;

        const paymentDetails: PaymentDetails = {
            cash: cashAmount,
            cheque: chequeAmount,
            debt: debtAmount,
        };

        const invoice: Invoice = {
            id: Date.now().toString(),
            customerId: selectedCustomerId,
            customerName: customer.name,
            date: new Date().toISOString(),
            items: cart,
            totalAmount,
            paymentDetails,
            status: debtAmount > 0 ? 'debt' : 'paid',
        };

        // Save invoice
        const invoices = await storageService.getInvoices();
        await storageService.saveInvoices([...invoices, invoice]);

        // Update customer balance
        const updatedCustomers = customers.map(c =>
            c.id === selectedCustomerId
                ? { ...c, balance: c.balance + debtAmount, totalPurchases: c.totalPurchases + totalAmount }
                : c
        );
        await storageService.saveCustomers(updatedCustomers);

        Alert.alert('نجاح', 'تم حفظ الفاتورة', [
            { text: 'موافق', onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>← رجوع</Text>
                </TouchableOpacity>
                <Text style={styles.title}>بيع جديد</Text>
            </View>

            <ScrollView style={styles.content}>
                {/* Customer Selection */}
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
                </View>

                {/* Products */}
                <View style={styles.section}>
                    <Text style={styles.label}>المنتجات</Text>
                    {products.map(product => (
                        <View key={product.id} style={styles.productRow}>
                            <TouchableOpacity style={styles.addProductBtn} onPress={() => addToCart(product)}>
                                <Text style={styles.addProductBtnText}>+</Text>
                            </TouchableOpacity>
                            <Text style={styles.productName}>{product.name}</Text>
                        </View>
                    ))}
                </View>

                {/* Cart */}
                {cart.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.label}>السلة</Text>
                        {cart.map(item => (
                            <View key={item.productId} style={styles.cartRow}>
                                <View style={styles.qtyControls}>
                                    <TouchableOpacity onPress={() => updateQuantity(item.productId, item.quantity - 1)} style={styles.qtyBtn}>
                                        <Text style={styles.qtyBtnText}>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.qtyText}>{item.quantity}</Text>
                                    <TouchableOpacity onPress={() => updateQuantity(item.productId, item.quantity + 1)} style={styles.qtyBtn}>
                                        <Text style={styles.qtyBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.cartItemName}>{item.productName}</Text>
                            </View>
                        ))}
                        <Text style={styles.total}>المجموع: {totalAmount} شيكل</Text>
                    </View>
                )}

                {/* Payment */}
                <View style={styles.section}>
                    <Text style={styles.label}>الدفع</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="نقداً"
                        value={payment.cash}
                        onChangeText={text => setPayment({ ...payment, cash: text })}
                        keyboardType="numeric"
                        placeholderTextColor="#9ca3af"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="شيك"
                        value={payment.cheque}
                        onChangeText={text => setPayment({ ...payment, cheque: text })}
                        keyboardType="numeric"
                        placeholderTextColor="#9ca3af"
                    />
                    <Text style={[styles.debtText, debtAmount > 0 && styles.debtWarning]}>
                        المتبقي (دين): {debtAmount} شيكل
                    </Text>
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>حفظ الفاتورة</Text>
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
    productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    productName: { fontSize: 16, color: '#1f2937' },
    addProductBtn: { backgroundColor: '#3b82f6', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    addProductBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    cartItemName: { fontSize: 14, color: '#374151' },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    qtyBtn: { backgroundColor: '#e5e7eb', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { fontSize: 18, fontWeight: 'bold' },
    qtyText: { fontSize: 16, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
    total: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginTop: 12, padding: 12, backgroundColor: '#dbeafe', borderRadius: 8 },
    input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 12, textAlign: 'right', fontSize: 16 },
    debtText: { textAlign: 'center', fontSize: 16 },
    debtWarning: { color: '#dc2626', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#3b82f6', padding: 16, margin: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
