import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    Modal,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { storageService } from '../services/storage';
import { Customer, Product, Invoice, CartItem, PaymentDetails } from '../types';

const { width } = Dimensions.get('window');
const QUICK_QTYS = [1, 2, 3, 5, 10, 15, 20, 50];

export const SalesScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [payment, setPayment] = useState({ cash: '', cheque: '' });

    // Quick Quantity Popup
    const [qtyPopup, setQtyPopup] = useState<{ productId: string; productName: string } | null>(null);
    const [qtyInput, setQtyInput] = useState('');

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

    const openQtyEditor = (product: Product) => {
        const existing = cart.find(c => c.productId === product.id);
        setQtyPopup({ productId: product.id, productName: product.name });
        setQtyInput(existing ? String(existing.quantity) : '1');
    };

    const confirmQtyPopup = () => {
        if (!qtyPopup) return;
        const qty = parseInt(qtyInput) || 1;
        if (qty < 1) return;

        const existing = cart.find(c => c.productId === qtyPopup.productId);
        if (existing) {
            setCart(cart.map(c => c.productId === qtyPopup.productId ? { ...c, quantity: qty } : c));
        } else {
            setCart([...cart, { productId: qtyPopup.productId, productName: qtyPopup.productName, quantity: qty }]);
        }
        setQtyPopup(null);
        setQtyInput('');
    };

    const updateQuantity = (productId: string, qty: number) => {
        if (qty <= 0) {
            setCart(cart.filter(c => c.productId !== productId));
        } else {
            setCart(cart.map(c => c.productId === productId ? { ...c, quantity: qty } : c));
        }
    };

    const totalAmount = cart.reduce((sum, item) => {
        return sum + item.quantity * 50; // Default price
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

        const invoices = await storageService.getInvoices();
        await storageService.saveInvoices([invoice, ...invoices]);

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

                {/* Products - Tap to +1, Long press to edit qty */}
                <View style={styles.section}>
                    <Text style={styles.label}>المنتجات (اضغط للإضافة، اضغط مطولاً لتحديد الكمية)</Text>
                    <View style={styles.productsGrid}>
                        {products.map(product => {
                            const inCart = cart.find(c => c.productId === product.id);
                            return (
                                <TouchableOpacity
                                    key={product.id}
                                    style={[styles.productCard, inCart && styles.productCardActive]}
                                    onPress={() => addToCart(product)}
                                    onLongPress={() => openQtyEditor(product)}
                                    activeOpacity={0.7}
                                >
                                    {inCart && (
                                        <View style={styles.qtyBadge}>
                                            <Text style={styles.qtyBadgeText}>{inCart.quantity}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.productCardName}>{product.name}</Text>
                                    <Text style={styles.productCardSize}>{product.size}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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
                                    <TextInput
                                        style={styles.qtyInputField}
                                        value={String(item.quantity)}
                                        onChangeText={text => {
                                            const val = parseInt(text);
                                            if (val >= 1) updateQuantity(item.productId, val);
                                        }}
                                        keyboardType="numeric"
                                    />
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

                <View style={{ height: 100 }} />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>حفظ الفاتورة</Text>
            </TouchableOpacity>

            {/* Quick Quantity Modal */}
            <Modal visible={!!qtyPopup} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQtyPopup(null)}>
                    <View style={styles.qtyModal} onStartShouldSetResponder={() => true}>
                        <Text style={styles.qtyModalTitle}>{qtyPopup?.productName}</Text>
                        <Text style={styles.qtyModalSubtitle}>أدخل الكمية المطلوبة</Text>
                        <TextInput
                            style={styles.qtyModalInput}
                            value={qtyInput}
                            onChangeText={setQtyInput}
                            keyboardType="numeric"
                            autoFocus
                            onSubmitEditing={confirmQtyPopup}
                        />
                        <View style={styles.quickQtyRow}>
                            {QUICK_QTYS.map(n => (
                                <TouchableOpacity
                                    key={n}
                                    style={[styles.quickQtyBtn, qtyInput === String(n) && styles.quickQtyBtnActive]}
                                    onPress={() => setQtyInput(String(n))}
                                >
                                    <Text style={[styles.quickQtyBtnText, qtyInput === String(n) && styles.quickQtyBtnTextActive]}>{n}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.qtyModalActions}>
                            <TouchableOpacity style={styles.qtyConfirmBtn} onPress={confirmQtyPopup}>
                                <Text style={styles.qtyConfirmBtnText}>تأكيد ✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.qtyCancelBtn} onPress={() => setQtyPopup(null)}>
                                <Text style={styles.qtyCancelBtnText}>إلغاء</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12, textAlign: 'right' },
    pickerContainer: { backgroundColor: '#f3f4f6', borderRadius: 8 },
    picker: { height: 50 },
    // Product Grid
    productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
    productCard: {
        width: (width - 80) / 2,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 16,
        alignItems: 'flex-end',
        minHeight: 90,
        justifyContent: 'center',
    },
    productCardActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
        borderWidth: 2,
    },
    productCardName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', textAlign: 'right' },
    productCardSize: { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'right' },
    qtyBadge: {
        position: 'absolute',
        top: -8,
        left: -8,
        backgroundColor: '#3b82f6',
        borderRadius: 14,
        minWidth: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    qtyBadgeText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    // Cart
    cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    cartItemName: { fontSize: 15, color: '#374151', fontWeight: '600' },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qtyBtn: { backgroundColor: '#e5e7eb', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { fontSize: 20, fontWeight: 'bold', color: '#374151' },
    qtyInputField: {
        width: 50,
        height: 36,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        backgroundColor: '#fff',
        padding: 0,
    },
    total: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginTop: 12, padding: 12, backgroundColor: '#dbeafe', borderRadius: 8 },
    input: { backgroundColor: '#f3f4f6', padding: 14, borderRadius: 8, marginBottom: 12, textAlign: 'right', fontSize: 16 },
    debtText: { textAlign: 'center', fontSize: 16 },
    debtWarning: { color: '#dc2626', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#3b82f6', padding: 16, margin: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    // Quantity Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    qtyModal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' },
    qtyModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
    qtyModalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
    qtyModalInput: {
        width: '100%',
        textAlign: 'center',
        fontSize: 36,
        fontWeight: '900',
        padding: 16,
        borderWidth: 2,
        borderColor: '#93c5fd',
        borderRadius: 12,
        color: '#1f2937',
    },
    quickQtyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' },
    quickQtyBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    quickQtyBtnActive: { backgroundColor: '#3b82f6' },
    quickQtyBtnText: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
    quickQtyBtnTextActive: { color: '#fff' },
    qtyModalActions: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
    qtyConfirmBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center' },
    qtyConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    qtyCancelBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 20, padding: 14, borderRadius: 12, alignItems: 'center' },
    qtyCancelBtnText: { color: '#374151', fontSize: 14 },
});
