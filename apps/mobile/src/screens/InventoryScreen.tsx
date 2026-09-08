import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { syncService } from '../services/syncService';
import { getActivePersona } from '../services/personas';

interface Medicine {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  threshold: number;
  minStock: number;
  maxStock: number;
  barcode?: string;
}

interface DispenseLog {
  id: string;
  medicineId: string;
  quantity: number;
  patientId?: string;
  dispensedBy: string;
  timestamp: string;
}

interface InventoryOrder {
  id: string;
  medicineId: string;
  quantity: number;
  status: 'PO' | 'RECEIVED' | 'VERIFIED';
  orderedBy: string;
  timestamp: string;
}

// 15 essential medicines across 7 categories
const MEDICINES_CATALOG: Medicine[] = [
  // Analgesics/Antipyretics
  { id: 'paracetamol', name: 'Paracetamol 500mg', category: 'Analgesics', unit: 'tablets', currentStock: 500, threshold: 200, minStock: 100, maxStock: 1000 },
  { id: 'ibuprofen', name: 'Ibuprofen 400mg', category: 'Analgesics', unit: 'tablets', currentStock: 300, threshold: 150, minStock: 50, maxStock: 600 },
  { id: 'diclofenac', name: 'Diclofenac 50mg', category: 'Analgesics', unit: 'tablets', currentStock: 200, threshold: 100, minStock: 50, maxStock: 400 },

  // Antibiotics
  { id: 'amoxicillin', name: 'Amoxicillin 500mg', category: 'Antibiotics', unit: 'capsules', currentStock: 400, threshold: 200, minStock: 100, maxStock: 800 },
  { id: 'azithromycin', name: 'Azithromycin 500mg', category: 'Antibiotics', unit: 'tablets', currentStock: 150, threshold: 80, minStock: 30, maxStock: 300 },
  { id: 'ciprofloxacin', name: 'Ciprofloxacin 500mg', category: 'Antibiotics', unit: 'tablets', currentStock: 100, threshold: 50, minStock: 20, maxStock: 200 },

  // Antimalarials
  { id: 'artesunate', name: 'Artesunate 50mg', category: 'Antimalarials', unit: 'tablets', currentStock: 80, threshold: 40, minStock: 20, maxStock: 160 },
  { id: 'chloroquine', name: 'Chloroquine 250mg', category: 'Antimalarials', unit: 'tablets', currentStock: 60, threshold: 30, minStock: 10, maxStock: 120 },

  // ORS & Rehydration
  { id: 'ors', name: 'ORS Sachets', category: 'Rehydration', unit: 'sachets', currentStock: 1000, threshold: 500, minStock: 200, maxStock: 2000 },
  { id: 'zinc', name: 'Zinc 20mg', category: 'Rehydration', unit: 'tablets', currentStock: 300, threshold: 150, minStock: 50, maxStock: 600 },

  // Antihypertensives
  { id: 'amlodipine', name: 'Amlodipine 5mg', category: 'Antihypertensives', unit: 'tablets', currentStock: 250, threshold: 120, minStock: 50, maxStock: 500 },
  { id: 'metoprolol', name: 'Metoprolol 50mg', category: 'Antihypertensives', unit: 'tablets', currentStock: 150, threshold: 80, minStock: 30, maxStock: 300 },

  // Antidiabetics
  { id: 'metformin', name: 'Metformin 500mg', category: 'Antidiabetics', unit: 'tablets', currentStock: 400, threshold: 200, minStock: 100, maxStock: 800 },
  { id: 'glimepiride', name: 'Glimepiride 2mg', category: 'Antidiabetics', unit: 'tablets', currentStock: 100, threshold: 50, minStock: 20, maxStock: 200 },

  // Vitamins/Supplements
  { id: 'folic_acid', name: 'Folic Acid 5mg', category: 'Supplements', unit: 'tablets', currentStock: 500, threshold: 250, minStock: 100, maxStock: 1000 },
  { id: 'iron_folic', name: 'Iron + Folic Acid', category: 'Supplements', unit: 'tablets', currentStock: 800, threshold: 400, minStock: 200, maxStock: 1600 },
];

const CATEGORIES = ['All', 'Analgesics', 'Antibiotics', 'Antimalarials', 'Rehydration', 'Antihypertensives', 'Antidiabetics', 'Supplements'];

export const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [medicines, setMedicines] = useState<Medicine[]>(MEDICINES_CATALOG);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDispenseModal, setShowDispenseModal] = useState<Medicine | null>(null);
  const [showOrderModal, setShowOrderModal] = useState<Medicine | null>(null);
  const [dispenseQuantity, setDispenseQuantity] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const loadData = async () => {
    setRefreshing(false);
  };

  const getStockStatus = (medicine: Medicine): 'ADEQUATE' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK' => {
    if (medicine.currentStock === 0) return 'OUT_OF_STOCK';
    const percentage = (medicine.currentStock / medicine.maxStock) * 100;
    if (percentage >= 60) return 'ADEQUATE';
    if (percentage >= 30) return 'LOW';
    return 'CRITICAL';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ADEQUATE': return COLORS.severityGreen;
      case 'LOW': return COLORS.severityYellow;
      case 'CRITICAL': return COLORS.severityRed;
      case 'OUT_OF_STOCK': return COLORS.textSecondary;
      default: return COLORS.textSecondary;
    }
  };

  const handleDispense = async (medicine: Medicine) => {
    const qty = parseInt(dispenseQuantity);
    if (!qty || qty <= 0 || qty > medicine.currentStock) {
      Alert.alert(t('inventory.error'), t('inventory.invalidQuantity'));
      return;
    }

    const newStock = medicine.currentStock - qty;
    const log: DispenseLog = {
      id: `disp-${Date.now()}`,
      medicineId: medicine.id,
      quantity: qty,
      dispensedBy: getActivePersona().name,
      timestamp: new Date().toISOString(),
    };

    if (syncService.isOnline()) {
      try {
        // In real app, call API
        console.log('Dispensing online:', log);
      } catch (e) {
        console.error('Failed to dispense online:', e);
      }
    } else {
      await syncService.enqueue({
        type: 'DISPENSE_MEDICINE',
        payload: { ...log, newStock },
        timestamp: Date.now(),
      });
    }

    setMedicines(prev => prev.map(m => m.id === medicine.id ? { ...m, currentStock: newStock } : m));
    setShowDispenseModal(null);
    setDispenseQuantity('');
  };

  const handleCreateOrder = async (medicine: Medicine) => {
    const qty = parseInt(orderQuantity);
    if (!qty || qty <= 0) {
      Alert.alert(t('inventory.error'), t('inventory.invalidQuantity'));
      return;
    }

    const order: InventoryOrder = {
      id: `ord-${Date.now()}`,
      medicineId: medicine.id,
      quantity: qty,
      status: 'PO',
      orderedBy: getActivePersona().name,
      timestamp: new Date().toISOString(),
    };

    if (syncService.isOnline()) {
      try {
        console.log('Creating order online:', order);
      } catch (e) {
        console.error('Failed to create order online:', e);
      }
    } else {
      await syncService.enqueue({
        type: 'CREATE_INVENTORY_ORDER',
        payload: order,
        timestamp: Date.now(),
      });
    }

    setShowOrderModal(null);
    setOrderQuantity('');
  };

  const handleReceiveOrder = async (medicine: Medicine, orderId: string) => {
    // In real app, scan barcode and verify
    const order: InventoryOrder = {
      id: orderId,
      medicineId: medicine.id,
      quantity: medicine.maxStock - medicine.currentStock,
      status: 'RECEIVED',
      orderedBy: getActivePersona().name,
      timestamp: new Date().toISOString(),
    };

    if (syncService.isOnline()) {
      try {
        console.log('Receiving order:', order);
      } catch (e) {
        console.error('Failed to receive order:', e);
      }
    } else {
      await syncService.enqueue({
        type: 'UPDATE_INVENTORY',
        payload: { medicineId: medicine.id, newStock: medicine.maxStock, orderId },
        timestamp: Date.now(),
      });
    }

    setMedicines(prev => prev.map(m => m.id === medicine.id ? { ...m, currentStock: medicine.maxStock } : m));
    Alert.alert(t('inventory.received'), t('inventory.stockUpdated'));
  };

  const handleVerifyStock = async (medicine: Medicine) => {
    if (syncService.isOnline()) {
      try {
        console.log('Verifying stock:', medicine.id, medicine.currentStock);
      } catch (e) {
        console.error('Failed to verify:', e);
      }
    }
    Alert.alert(t('inventory.verified'), t('inventory.stockVerified'));
  };

  const getReorderSuggestion = (medicine: Medicine) => {
    const dailyAvg = 5; // Simulated 7-day rolling average
    const daysUntilStockout = medicine.currentStock / dailyAvg;
    const suggestedOrder = Math.max(0, medicine.maxStock - medicine.currentStock);
    return { daysUntilStockout: Math.floor(daysUntilStockout), suggestedOrder };
  };

  const filteredMedicines = medicines
    .filter(m => selectedCategory === 'All' || m.category === selectedCategory)
    .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderMedicineCard = (medicine: Medicine) => {
    const status = getStockStatus(medicine);
    const percentage = Math.round((medicine.currentStock / medicine.maxStock) * 100);
    const { daysUntilStockout, suggestedOrder } = getReorderSuggestion(medicine);

    return (
      <View key={medicine.id} style={styles.medicineCard}>
        <View style={styles.medicineHeader}>
          <View style={styles.medicineInfo}>
            <Text style={styles.medicineName}>{medicine.name}</Text>
            <Text style={styles.medicineCategory}>{medicine.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
            <Text style={styles.statusText}>{t(`inventory.${status.toLowerCase()}`)}</Text>
          </View>
        </View>

        <View style={styles.stockBar}>
          <View style={[styles.stockProgress, { width: `${percentage}%`, backgroundColor: getStatusColor(status) }]} />
        </View>

        <View style={styles.stockInfo}>
          <Text style={styles.stockText}>
            {medicine.currentStock} / {medicine.maxStock} {medicine.unit} ({percentage}%)
          </Text>
          {status !== 'ADEQUATE' && status !== 'OUT_OF_STOCK' && (
            <Text style={styles.reorderText}>
              🔮 ${t('inventory.daysLeft')}: ${daysUntilStockout} | ${t('inventory.suggestedOrder')}: ${suggestedOrder}
            </Text>
          )}
        </View>

        <View style={styles.actionRow}>
          {status !== 'OUT_OF_STOCK' && (
            <TouchableOpacity style={styles.actionButton} onPress={() => { setDispenseQuantity(String(Math.min(10, medicine.currentStock))); setShowDispenseModal(medicine); }}>
              <Text style={styles.actionButtonText}>{t('inventory.dispense')}</Text>
            </TouchableOpacity>
          )}
          {status !== 'ADEQUATE' && (
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={() => { setOrderQuantity(String(suggestedOrder)); setShowOrderModal(medicine); }}>
              <Text style={styles.actionButtonText}>{t('inventory.reorder')}</Text>
            </TouchableOpacity>
          )}
          {(status === 'LOW' || status === 'CRITICAL') && (
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonTertiary]} onPress={() => handleVerifyStock(medicine)}>
              <Text style={styles.actionButtonText}>{t('inventory.verify')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('inventory.title')}</Text>
            <View style={styles.headerRight}>
              {syncService.getPendingCount() > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{syncService.getPendingCount()}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statsSummary}>
            {(['ADEQUATE', 'LOW', 'CRITICAL', 'OUT_OF_STOCK'] as const).map(status => {
              const count = medicines.filter(m => getStockStatus(m) === status).length;
              return (
                <View key={status} style={[styles.statBox, { borderLeftColor: getStatusColor(status) }]}>
                  <Text style={[styles.statNumber, { color: getStatusColor(status) }]}>{count}</Text>
                  <Text style={styles.statLabel}>{t(`inventory.${status.toLowerCase()}`)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('inventory.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredMedicines.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('inventory.noMedicines')}</Text>
            </View>
          ) : (
            <View style={styles.medicinesList}>
              {filteredMedicines.map(renderMedicineCard)}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Dispense Modal */}
      <Modal visible={!!showDispenseModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('inventory.dispense')}: {showDispenseModal?.name}</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowDispenseModal(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {t('inventory.available')}: {showDispenseModal?.currentStock} {showDispenseModal?.unit}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={t('inventory.quantity')}
              value={dispenseQuantity}
              onChangeText={setDispenseQuantity}
              keyboardType="numeric"
            />

            <View style={styles.quickButtons}>
              {[1, 5, 10, showDispenseModal?.currentStock].filter(v => v <= showDispenseModal!.currentStock).map(qty => (
                <TouchableOpacity key={qty} style={styles.quickButton} onPress={() => setDispenseQuantity(String(qty))}>
                  <Text style={styles.quickButtonText}>{qty}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={() => handleDispense(showDispenseModal!)}>
              <Text style={styles.submitButtonText}>{t('inventory.confirmDispense')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Order Modal */}
      <Modal visible={!!showOrderModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('inventory.reorder')}: {showOrderModal?.name}</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowOrderModal(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {t('inventory.suggested')}: {getReorderSuggestion(showOrderModal!).suggestedOrder} {showOrderModal?.unit}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={t('inventory.quantity')}
              value={orderQuantity}
              onChangeText={setOrderQuantity}
              keyboardType="numeric"
            />

            <View style={styles.quickButtons}>
              {[10, 20, 50, 100].map(qty => (
                <TouchableOpacity key={qty} style={styles.quickButton} onPress={() => setOrderQuantity(String(qty))}>
                  <Text style={styles.quickButtonText}>{qty}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={() => handleCreateOrder(showOrderModal!)}>
              <Text style={styles.submitButtonText}>{t('inventory.createOrder')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerRight: { flexDirection: 'row', gap: theme.spacing.sm },
  syncBadge: { backgroundColor: COLORS.warning, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  syncBadgeText: { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '700' },
  statsSummary: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  statBox: { flex: 1, backgroundColor: COLORS.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center', borderLeftWidth: 4 },
  statNumber: { fontSize: theme.typography.fontSize['2xl'], fontWeight: '800' },
  statLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  searchBar: { marginBottom: theme.spacing.md },
  searchInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: COLORS.textPrimary },
  categoryScroll: { marginBottom: theme.spacing.md, gap: theme.spacing.sm },
  categoryChip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, backgroundColor: COLORS.background, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textPrimary },
  categoryChipTextActive: { color: COLORS.textOnPrimary },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl * 2 },
  emptyText: { color: COLORS.textSecondary },
  medicinesList: { gap: theme.spacing.md },
  medicineCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  medicineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm },
  medicineInfo: { flex: 1 },
  medicineName: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary },
  medicineCategory: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600', color: COLORS.textOnPrimary },
  stockBar: { height: 6, backgroundColor: COLORS.background, borderRadius: 3, marginVertical: theme.spacing.sm, overflow: 'hidden' },
  stockProgress: { height: '100%', borderRadius: 3 },
  stockInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  reorderText: { fontSize: theme.typography.fontSize.xs, color: COLORS.warning, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  actionButton: { flex: 1, paddingVertical: theme.spacing.sm, backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  actionButtonSecondary: { backgroundColor: COLORS.warning },
  actionButtonTertiary: { backgroundColor: COLORS.info },
  actionButtonText: { color: COLORS.textOnPrimary, fontWeight: '600', fontSize: theme.typography.fontSize.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '700' },
  modalSubtitle: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginBottom: theme.spacing.md },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, color: COLORS.textPrimary, fontSize: theme.typography.fontSize.lg, textAlign: 'center' },
  quickButtons: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  quickButton: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, backgroundColor: COLORS.background, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: COLORS.border },
  quickButtonText: { fontWeight: '600', color: COLORS.textPrimary },
  submitButton: { backgroundColor: COLORS.primary, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  submitButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: theme.typography.fontSize.md },
});