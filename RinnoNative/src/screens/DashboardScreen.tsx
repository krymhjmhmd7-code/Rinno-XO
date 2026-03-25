import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storageService } from '../services/storage';
import { Customer, Product, Invoice, Repayment } from '../types';

interface DashboardScreenProps {
    navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        // Recalculate balances first to ensure correct values
        await storageService.recalculateCustomerBalances();

        const [loadedCustomers, loadedProducts, loadedInvoices] = await Promise.all([
            storageService.getCustomers(),
            storageService.getProducts(),
            storageService.getInvoices(),
        ]);
        setCustomers(loadedCustomers);
        setProducts(loadedProducts);
        setInvoices(loadedInvoices);
    };

    useEffect(() => {
        loadData();
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [navigation]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.includes(searchTerm) || c.phone.includes(searchTerm)
    );

    // Calculate stats
    const todaySales = invoices
        .filter(inv => new Date(inv.date).toDateString() === new Date().toDateString())
        .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const totalDebts = customers
        .filter(c => c.balance > 0)
        .reduce((sum, c) => sum + c.balance, 0);

    const renderCustomerItem = ({ item }: { item: Customer }) => {
        const cylinderCount = item.cylinderBalance
            ? Object.values(item.cylinderBalance).reduce((a, b) => a + b, 0)
            : 0;

        return (
            <View style={styles.customerCard}>
                <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{item.name}</Text>
                    <Text style={styles.customerDetails}>
                        {item.phone} | {item.city}
                        {cylinderCount > 0 && ` | ${cylinderCount} أسطوانة`}
                    </Text>
                </View>
                <View style={styles.customerActions}>
                    <Text style={[
                        styles.balance,
                        item.balance > 0 ? styles.debtBalance : item.balance < 0 ? styles.creditBalance : styles.zeroBalance
                    ]}>
                        {item.balance === 0 ? '0' : item.balance > 0 ? `${item.balance} عليه` : `${Math.abs(item.balance)} له`}
                    </Text>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.saleBtn]}
                            onPress={() => navigation.navigate('Sales', { customerId: item.id })}
                        >
                            <Text style={styles.actionBtnText}>بيع</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.debtBtn]}
                            onPress={() => navigation.navigate('Debts', { customerId: item.id })}
                        >
                            <Text style={styles.actionBtnText}>سداد</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.title}>رنّو اكسجين</Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: '#3b82f6' }]}
                        onPress={() => navigation.navigate('Sales')}
                    >
                        <Text style={styles.quickBtnText}>بيع جديد</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: '#22c55e' }]}
                        onPress={() => navigation.navigate('Debts')}
                    >
                        <Text style={styles.quickBtnText}>تسجيل سداد</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: '#8b5cf6' }]}
                        onPress={() => navigation.navigate('CylinderLoans')}
                    >
                        <Text style={styles.quickBtnText}>مداينة اسطوانات</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: '#f97316' }]}
                        onPress={() => navigation.navigate('Customers')}
                    >
                        <Text style={styles.quickBtnText}>سجل الزبائن</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="بحث عن زبون..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {/* Customer List */}
                <View style={styles.customerList}>
                    <Text style={styles.sectionTitle}>قائمة الزبائن ({filteredCustomers.length})</Text>
                    {filteredCustomers.map(customer => (
                        <View key={customer.id}>
                            {renderCustomerItem({ item: customer })}
                        </View>
                    ))}
                </View>

                {/* Stats at Bottom */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
                        <Text style={styles.statLabel}>مبيعات اليوم</Text>
                        <Text style={[styles.statValue, { color: '#1d4ed8' }]}>{todaySales} شيكل</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
                        <Text style={styles.statLabel}>ديون على الزبائن</Text>
                        <Text style={[styles.statValue, { color: '#dc2626' }]}>{totalDebts} شيكل</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    logo: {
        width: 40,
        height: 40,
        marginLeft: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 8,
    },
    quickBtn: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    quickBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    searchInput: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        fontSize: 16,
        textAlign: 'right',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 12,
        textAlign: 'right',
    },
    customerList: {
        paddingHorizontal: 16,
    },
    customerCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    customerInfo: {
        flex: 1,
        alignItems: 'flex-end',
    },
    customerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    customerDetails: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    customerActions: {
        alignItems: 'flex-start',
    },
    balance: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    debtBalance: {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
    },
    creditBalance: {
        backgroundColor: '#dcfce7',
        color: '#16a34a',
    },
    zeroBalance: {
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saleBtn: {
        backgroundColor: '#dbeafe',
    },
    debtBtn: {
        backgroundColor: '#dcfce7',
    },
    actionBtnText: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#4b5563',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
});
