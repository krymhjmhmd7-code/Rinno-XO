import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    Modal,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storageService } from '../services/storage';
import { DeletedItem } from '../types';

const TYPE_LABELS: Record<string, string> = {
    customer: 'زبون',
    invoice: 'فاتورة',
    repayment: 'سداد',
    cylinder_transaction: 'حركة اسطوانة',
    product: 'منتج',
};

const TYPE_COLORS: Record<string, string> = {
    customer: '#3b82f6',
    invoice: '#f97316',
    repayment: '#22c55e',
    cylinder_transaction: '#8b5cf6',
    product: '#ec4899',
};

const FILTER_TABS = [
    { key: 'all', label: 'الكل' },
    { key: 'customer', label: 'زبائن' },
    { key: 'invoice', label: 'فواتير' },
    { key: 'repayment', label: 'سدادات' },
    { key: 'cylinder_transaction', label: 'اسطوانات' },
    { key: 'product', label: 'منتجات' },
];

export const RecycleBinScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [items, setItems] = useState<DeletedItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState('all');
    const [showEmptyPassword, setShowEmptyPassword] = useState(false);
    const [emptyPassword, setEmptyPassword] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const loadItems = useCallback(async () => {
        const bin = await storageService.getRecycleBin();
        setItems(bin);
        setSelectedIds(new Set());
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadItems();
        setRefreshing(false);
    };

    const filteredItems = filterType === 'all'
        ? items
        : items.filter(i => i.type === filterType);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const handleRestore = async (id: string) => {
        const success = await storageService.restoreFromRecycleBin(id);
        if (success) {
            Alert.alert('نجاح', 'تم الاسترجاع بنجاح');
            await loadItems();
        }
    };

    const handleRestoreSelected = async () => {
        if (selectedIds.size === 0) return;
        const count = await storageService.restoreMultiple(Array.from(selectedIds));
        Alert.alert('نجاح', `تم استرجاع ${count} عنصر بنجاح`);
        await loadItems();
    };

    const handleEmptyBin = () => {
        setShowEmptyPassword(true);
        setEmptyPassword('');
    };

    const verifyAndEmpty = async () => {
        const settings = await storageService.getSettings();
        const delPassword = settings.deletePassword || '1234';
        if (emptyPassword === delPassword) {
            await storageService.emptyRecycleBin();
            setShowEmptyPassword(false);
            Alert.alert('تم', 'تم تفريغ سلة المحذوفات نهائياً');
            await loadItems();
        } else {
            Alert.alert('خطأ', 'كلمة المرور خاطئة');
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>← رجوع</Text>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <Text style={styles.title}>🗑️ سلة المحذوفات</Text>
                    <Text style={styles.subtitle}>{items.length} عنصر</Text>
                </View>
            </View>

            {/* Actions Row */}
            <View style={styles.actionsRow}>
                {selectedIds.size > 0 && (
                    <TouchableOpacity style={styles.restoreBtn} onPress={handleRestoreSelected}>
                        <Text style={styles.restoreBtnText}>↩ استرجاع ({selectedIds.size})</Text>
                    </TouchableOpacity>
                )}
                {items.length > 0 && (
                    <TouchableOpacity style={styles.emptyBtn} onPress={handleEmptyBin}>
                        <Text style={styles.emptyBtnText}>🗑 تفريغ السلة</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
                {FILTER_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.filterTab, filterType === tab.key && styles.filterTabActive]}
                        onPress={() => { setFilterType(tab.key); setSelectedIds(new Set()); }}
                    >
                        <Text style={[styles.filterTabText, filterType === tab.key && styles.filterTabTextActive]}>
                            {tab.label}
                            {tab.key !== 'all' && ` (${items.filter(i => i.type === tab.key).length})`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Items */}
            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Select All */}
                {filteredItems.length > 0 && (
                    <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
                        <View style={[styles.checkbox, selectedIds.size === filteredItems.length && styles.checkboxActive]}>
                            {selectedIds.size === filteredItems.length && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.selectAllText}>
                            {selectedIds.size > 0 ? `${selectedIds.size} محدد` : 'تحديد الكل'}
                        </Text>
                    </TouchableOpacity>
                )}

                {filteredItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🗑️</Text>
                        <Text style={styles.emptyText}>سلة المحذوفات فارغة</Text>
                    </View>
                ) : (
                    filteredItems.map(item => (
                        <View key={item.id} style={[styles.itemCard, selectedIds.has(item.id) && styles.itemCardSelected]}>
                            <TouchableOpacity style={styles.itemLeft} onPress={() => toggleSelect(item.id)}>
                                <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxActive]}>
                                    {selectedIds.has(item.id) && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] + '20' }]}>
                                    <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[item.type] }]}>
                                        {TYPE_LABELS[item.type]}
                                    </Text>
                                </View>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                                    <Text style={styles.itemMeta}>
                                        🕐 {formatDate(item.deletedAt)} {formatTime(item.deletedAt)} • 👤 {item.deletedBy}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.restoreItemBtn} onPress={() => handleRestore(item.id)}>
                                <Text style={styles.restoreItemBtnText}>↩</Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Empty Password Modal */}
            <Modal visible={showEmptyPassword} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEmptyPassword(false)}>
                    <View style={styles.modal} onStartShouldSetResponder={() => true}>
                        <Text style={styles.modalTitle}>⚠️ تفريغ سلة المحذوفات نهائياً</Text>
                        <Text style={styles.modalDesc}>
                            سيتم حذف {items.length} عنصر نهائياً. أدخل كلمة مرور الحذف للتأكيد.
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="كلمة المرور"
                            secureTextEntry
                            value={emptyPassword}
                            onChangeText={setEmptyPassword}
                            onSubmitEditing={verifyAndEmpty}
                            autoFocus
                            placeholderTextColor="#9ca3af"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalDangerBtn} onPress={verifyAndEmpty}>
                                <Text style={styles.modalDangerBtnText}>تفريغ نهائي</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEmptyPassword(false)}>
                                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
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
    headerRight: { alignItems: 'flex-end' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
    subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    actionsRow: { flexDirection: 'row', padding: 12, gap: 8, justifyContent: 'flex-end' },
    restoreBtn: { backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    restoreBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    emptyBtn: { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    filterRow: { maxHeight: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    filterContent: { paddingHorizontal: 12, alignItems: 'center', gap: 8 },
    filterTab: { backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    filterTabActive: { backgroundColor: '#3b82f6' },
    filterTabText: { fontSize: 13, fontWeight: 'bold', color: '#6b7280' },
    filterTabTextActive: { color: '#fff' },
    content: { flex: 1, padding: 12 },
    selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 6 },
    selectAllText: { fontSize: 14, color: '#6b7280', fontWeight: 'bold' },
    checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#d1d5db', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', padding: 60 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, color: '#9ca3af' },
    itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb' },
    itemCardSelected: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    typeBadgeText: { fontSize: 11, fontWeight: 'bold' },
    itemInfo: { flex: 1 },
    itemDesc: { fontSize: 14, fontWeight: 'bold', color: '#1f2937', textAlign: 'right' },
    itemMeta: { fontSize: 11, color: '#9ca3af', marginTop: 3, textAlign: 'right' },
    restoreItemBtn: { backgroundColor: '#dcfce7', width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    restoreItemBtnText: { fontSize: 20, color: '#16a34a' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
    modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#dc2626', marginBottom: 8, textAlign: 'center' },
    modalDesc: { fontSize: 14, color: '#6b7280', marginBottom: 16, textAlign: 'center', lineHeight: 22 },
    modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 16, textAlign: 'center', marginBottom: 16 },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalDangerBtn: { flex: 1, backgroundColor: '#dc2626', padding: 14, borderRadius: 10, alignItems: 'center' },
    modalDangerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    modalCancelBtn: { flex: 1, backgroundColor: '#e5e7eb', padding: 14, borderRadius: 10, alignItems: 'center' },
    modalCancelBtnText: { color: '#374151', fontSize: 14 },
});
