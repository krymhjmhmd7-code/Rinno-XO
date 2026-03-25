import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storageService } from '../services/storage';
import { Customer } from '../types';

export const CustomersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        city: '',
        type: 'غير مصنف',
    });

    const loadCustomers = async () => {
        const data = await storageService.getCustomers();
        setCustomers(data);
    };

    useEffect(() => {
        loadCustomers();
        const unsubscribe = navigation.addListener('focus', loadCustomers);
        return unsubscribe;
    }, [navigation]);

    const filteredCustomers = customers.filter(c =>
        c.name.includes(searchTerm) || c.phone.includes(searchTerm)
    );

    const handleSave = async () => {
        if (!formData.name) {
            Alert.alert('خطأ', 'الاسم مطلوب');
            return;
        }

        const nextSerial = customers.length > 0 ? Math.max(...customers.map(c => c.serialNumber || 0)) + 1 : 1;

        const customerData: Customer = {
            id: editingId || Date.now().toString(),
            serialNumber: editingId ? (customers.find(c => c.id === editingId)?.serialNumber || 0) : nextSerial,
            name: formData.name,
            type: formData.type,
            phone: formData.phone,
            whatsapp: '',
            city: formData.city,
            village: '',
            neighborhood: '',
            totalPurchases: editingId ? (customers.find(c => c.id === editingId)?.totalPurchases || 0) : 0,
            balance: editingId ? (customers.find(c => c.id === editingId)?.balance || 0) : 0,
            cylinderBalance: editingId ? (customers.find(c => c.id === editingId)?.cylinderBalance || {}) : {},
        };

        let updated: Customer[];
        if (editingId) {
            updated = customers.map(c => c.id === editingId ? customerData : c);
        } else {
            updated = [...customers, customerData];
        }

        await storageService.saveCustomers(updated);
        setCustomers(updated);
        closeModal();
    };

    const handleDelete = (id: string) => {
        Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الزبون؟', [
            { text: 'إلغاء', style: 'cancel' },
            {
                text: 'حذف',
                style: 'destructive',
                onPress: async () => {
                    const updated = customers.filter(c => c.id !== id);
                    await storageService.saveCustomers(updated);
                    setCustomers(updated);
                },
            },
        ]);
    };

    const openAdd = () => {
        setEditingId(null);
        setFormData({ name: '', phone: '', city: '', type: 'غير مصنف' });
        setShowModal(true);
    };

    const openEdit = (c: Customer) => {
        setEditingId(c.id);
        setFormData({ name: c.name, phone: c.phone, city: c.city, type: c.type });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData({ name: '', phone: '', city: '', type: 'غير مصنف' });
    };

    const renderItem = ({ item }: { item: Customer }) => (
        <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
            <View style={styles.cardContent}>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>#{item.serialNumber} - {item.name}</Text>
                    <Text style={styles.cardDetails}>{item.phone} | {item.city}</Text>
                </View>
                <View style={styles.cardActions}>
                    <Text style={[
                        styles.balance,
                        item.balance > 0 ? styles.debt : item.balance < 0 ? styles.credit : null
                    ]}>
                        {item.balance === 0 ? '0' : item.balance > 0 ? `${item.balance} عليه` : `${Math.abs(item.balance)} له`}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>حذف</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>سجل الزبائن</Text>
                <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
                    <Text style={styles.addBtnText}>+ إضافة</Text>
                </TouchableOpacity>
            </View>

            <TextInput
                style={styles.searchInput}
                placeholder="بحث..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholderTextColor="#9ca3af"
            />

            <FlatList
                data={filteredCustomers}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
            />

            {/* Add/Edit Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>{editingId ? 'تعديل زبون' : 'إضافة زبون جديد'}</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="الاسم *"
                            value={formData.name}
                            onChangeText={text => setFormData({ ...formData, name: text })}
                            placeholderTextColor="#9ca3af"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="رقم الجوال"
                            value={formData.phone}
                            onChangeText={text => setFormData({ ...formData, phone: text })}
                            keyboardType="phone-pad"
                            placeholderTextColor="#9ca3af"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="المدينة"
                            value={formData.city}
                            onChangeText={text => setFormData({ ...formData, city: text })}
                            placeholderTextColor="#9ca3af"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>حفظ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                                <Text style={styles.cancelBtnText}>إلغاء</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    addBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    addBtnText: { color: '#fff', fontWeight: 'bold' },
    searchInput: { backgroundColor: '#fff', margin: 16, padding: 12, borderRadius: 12, fontSize: 16, textAlign: 'right', borderWidth: 1, borderColor: '#e5e7eb' },
    list: { padding: 16 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
    cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardInfo: { flex: 1, alignItems: 'flex-end' },
    cardName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    cardDetails: { fontSize: 12, color: '#6b7280', marginTop: 4 },
    cardActions: { alignItems: 'flex-start' },
    balance: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    debt: { backgroundColor: '#fee2e2', color: '#dc2626' },
    credit: { backgroundColor: '#dcfce7', color: '#16a34a' },
    deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
    deleteBtnText: { color: '#dc2626', fontSize: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
    input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 12, textAlign: 'right', fontSize: 16 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    saveBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelBtn: { flex: 1, backgroundColor: '#e5e7eb', padding: 14, borderRadius: 8, alignItems: 'center' },
    cancelBtnText: { color: '#374151', fontWeight: 'bold', fontSize: 16 },
});
