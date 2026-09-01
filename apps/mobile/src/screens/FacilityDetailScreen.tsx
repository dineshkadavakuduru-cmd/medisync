import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  Animated,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, FacilityType, MedicineItemStatus } from '@medisync/shared';
import { theme } from '../styles/theme';
import { api } from '../services/api';
import { wsClient, WSMessageType } from '../services/websocket';

interface FacilitySummary {
  facility: {
    id: string;
    name: string;
    type: FacilityType;
    district: string;
    taluka: string;
    contactPhone: string;
  };
  beds: { total: number; available: number; occupied: number; occupancyRate: number };
  medicine: {
    overallAvailability: number;
    totalItems: number;
    adequate: number;
    low: number;
    critical: number;
    outOfStock: number;
    criticalItems: { name: string; currentStock: number; minThreshold: number }[];
  };
  staff: {
    total: number;
    onDuty: number;
    doctors: number;
    doctorsOnDuty: number;
    specialists: string[];
    specialistsOnDuty: string[];
  };
  recentReferralsIn: number;
  recentReferralsOut: number;
  activeAlerts: number;
}

interface MedicineItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  status: MedicineItemStatus;
  expiryDate?: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  specialization?: string;
  phone: string;
  isOnDuty: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  languages: string[];
}

const FACILITY_TYPE_COLORS: Record<FacilityType, string> = {
  [FacilityType.SUB_CENTRE]: '#2E7D32',
  [FacilityType.PHC]: '#1565C0',
  [FacilityType.CHC]: '#FF8F00',
  [FacilityType.DISTRICT_HOSPITAL]: '#C62828',
};

const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  [FacilityType.SUB_CENTRE]: 'Sub-Centre',
  [FacilityType.PHC]: 'PHC',
  [FacilityType.CHC]: 'CHC',
  [FacilityType.DISTRICT_HOSPITAL]: 'District Hospital',
};

const STATUS_COLORS: Record<MedicineItemStatus, string> = {
  ADEQUATE: COLORS.success,
  LOW: COLORS.warning,
  CRITICAL: COLORS.severityRed,
  'OUT_OF_STOCK': '#424242',
};

export const FacilityDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { facilityId } = route.params as { facilityId: string };

  const [summary, setSummary] = useState<FacilitySummary | null>(null);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [medFilter, setMedFilter] = useState<'ALL' | 'CRITICAL' | 'LOW' | 'ADEQUATE'>('ALL');
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineItem | null>(null);
  const [restockValue, setRestockValue] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('just now');

  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, medRes, staffRes] = await Promise.all([
        api.getFacilitySummary(facilityId),
        api.getFacilityInventory(facilityId),
        api.getFacilityStaff(facilityId),
      ]);
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data as FacilitySummary);
      if (medRes.success && medRes.data) setMedicines(medRes.data as MedicineItem[]);
      if (staffRes.success && staffRes.data) setStaff(staffRes.data as StaffMember[]);
      setLastUpdated('just now');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() % 3600000) / 60000);
      setLastUpdated(mins === 0 ? 'just now' : `${mins} min${mins > 1 ? 's' : ''} ago`);
    }, 60000);

    wsClient.connect(facilityId);
    wsClient.on('BED_UPDATE', () => loadData());
    wsClient.on('MEDICINE_UPDATE', () => loadData());
    wsClient.on('STAFF_UPDATE', () => loadData());

    return () => {
      clearInterval(interval);
    };
  }, [loadData, facilityId]);

  const handleRestock = async () => {
    if (!selectedMedicine || !restockValue) return;
    const newStock = parseInt(restockValue, 10);
    if (isNaN(newStock) || newStock < 0) return;
    await api.updateMedicineStock(facilityId, selectedMedicine.id, newStock);
    setRestockModalVisible(false);
    setRestockValue('');
    setSelectedMedicine(null);
    loadData();
  };

  const getRingColor = (percent: number, type: 'bed' | 'med' | 'staff') => {
    if (type === 'bed') return percent > 60 ? COLORS.success : percent > 30 ? COLORS.warning : COLORS.severityRed;
    if (type === 'med') return percent > 60 ? COLORS.success : percent > 30 ? COLORS.warning : COLORS.severityRed;
    return COLORS.info;
  };

  if (loading || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading facility details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const f = summary.facility;
  const bedPercent = Math.round((summary.beds.available / summary.beds.total) * 100);
  const medPercent = summary.medicine.overallAvailability;
  const staffPercent = Math.round((summary.staff.onDuty / (summary.staff.total || 1)) * 100);

  const filteredMeds = medicines.filter((m) => {
    if (medFilter === 'ALL') return true;
    if (medFilter === 'CRITICAL') return m.status === 'CRITICAL' || m.status === 'OUT_OF_STOCK';
    return m.status === medFilter;
  });

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays >= 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={[styles.typeBadge, { backgroundColor: `${FACILITY_TYPE_COLORS[f.type]}20` }]}>
            <Text style={[styles.typeBadgeText, { color: FACILITY_TYPE_COLORS[f.type] }]}>
              {FACILITY_TYPE_LABELS[f.type]}
            </Text>
          </View>
        </View>

        <Text style={styles.facilityName}>{f.name}</Text>
        <Text style={styles.facilityAddress}>{f.district}, {f.taluka}</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${f.contactPhone}`)} style={styles.phoneRow}>
          <Text style={styles.phoneIcon}>📞</Text>
          <Text style={styles.phoneText}>{f.contactPhone}</Text>
        </TouchableOpacity>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.beds.available}/{summary.beds.total}</Text>
            <Text style={styles.statLabel}>Beds</Text>
            <View style={[styles.ring, { borderColor: getRingColor(bedPercent, 'bed') }]}>
              <View style={[styles.ringFill, { borderColor: getRingColor(bedPercent, 'bed'), width: `${bedPercent}%` }]} />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{medPercent}%</Text>
            <Text style={styles.statLabel}>Medicine</Text>
            <View style={[styles.ring, { borderColor: getRingColor(medPercent, 'med') }]}>
              <View style={[styles.ringFill, { borderColor: getRingColor(medPercent, 'med'), width: `${medPercent}%` }]} />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.staff.onDuty}/{summary.staff.total}</Text>
            <Text style={styles.statLabel}>Staff</Text>
            <View style={[styles.ring, { borderColor: getRingColor(staffPercent, 'staff') }]}>
              <View style={[styles.ringFill, { borderColor: getRingColor(staffPercent, 'staff'), width: `${staffPercent}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bed Availability ({summary.beds.available}/{summary.beds.total})</Text>
          <View style={styles.bedGrid}>
            {Array.from({ length: summary.beds.total }).map((_, idx) => {
              const isOccupied = idx >= summary.beds.available;
              return (
                <View
                  key={idx}
                  style={[
                    styles.bedSquare,
                    { backgroundColor: isOccupied ? COLORS.severityRed : COLORS.success },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medicine Stock ({medPercent}%)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.medTabs}>
            {(['ALL', 'CRITICAL', 'LOW', 'ADEQUATE'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.medTab, medFilter === tab && styles.medTabActive]}
                onPress={() => setMedFilter(tab)}
              >
                <Text style={[styles.medTabText, medFilter === tab && styles.medTabTextActive]}>
                  {tab === 'ALL' ? 'All' : tab === 'CRITICAL' ? `⚠️ Critical` : tab}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {filteredMeds.map((med) => {
            const stockPercent = Math.round((med.currentStock / med.maxCapacity) * 100);
            return (
              <View
                key={med.id}
                style={[
                  styles.medCard,
                  (med.status === 'CRITICAL' || med.status === 'OUT_OF_STOCK') && { backgroundColor: '#FFEBEE' },
                ]}
              >
                <View style={styles.medHeader}>
                  <View>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medCategory}>{med.category.toUpperCase()} • {med.unit}</Text>
                  </View>
                  <View style={[styles.medStatusBadge, { backgroundColor: `${STATUS_COLORS[med.status]}20` }]}>
                    <Text style={[styles.medStatusText, { color: STATUS_COLORS[med.status] }]}>
                      {med.status === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : med.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.medBarBg}>
                  <View style={[styles.medBar, { width: `${stockPercent}%`, backgroundColor: STATUS_COLORS[med.status] }]} />
                </View>
                <View style={styles.medFooter}>
                  <Text style={styles.medStockText}>{med.currentStock} / {med.maxCapacity} {med.unit}</Text>
                  <Text style={styles.medThresholdText}>Min: {med.minThreshold}</Text>
                  {isExpiringSoon(med.expiryDate) && <Text style={styles.expiringText}>⚠️ Expiring soon</Text>}
                  <TouchableOpacity style={styles.restockBtn} onPress={() => { setSelectedMedicine(med); setRestockValue(String(med.maxCapacity)); setRestockModalVisible(true); }}>
                    <Text style={styles.restockBtnText}>Restock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff on Duty ({summary.staff.onDuty}/{summary.staff.total})</Text>
          {staff.map((s) => (
            <View key={s.id} style={styles.staffCard}>
              <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.avatarText}>{s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{s.name}</Text>
                <Text style={styles.staffRole}>{s.role}{s.specialization ? ` • ${s.specialization}` : ''}</Text>
                <View style={styles.languageChips}>
                  {s.languages.map((l) => (
                    <View key={l} style={styles.langChip}>
                      <Text style={styles.langText}>{l}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.staffRight}>
                <View style={[styles.dutyDot, { backgroundColor: s.isOnDuty ? COLORS.success : COLORS.textSecondary }]} />
                <Text style={styles.dutyText}>{s.isOnDuty ? 'On Duty' : 'Off Duty'}</Text>
                {s.isOnDuty && s.shiftStart && (
                  <Text style={styles.shiftText}>{s.shiftStart} - {s.shiftEnd}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${f.contactPhone}`)}>
            <Text style={styles.callBtnText}>📞 Call Facility</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.referralBtn} onPress={() => {}}>
            <Text style={styles.referralBtnText}>🚑 Send Referral Here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={restockModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Restock Medicine</Text>
            <Text style={styles.modalSubtitle}>{selectedMedicine?.name}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={restockValue}
              onChangeText={setRestockValue}
              placeholder="Enter new stock quantity"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setRestockModalVisible(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleRestock}>
                <Text style={[styles.modalBtnText, { color: COLORS.textOnPrimary }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textSecondary, fontSize: theme.typography.fontSize.md },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.xl, gap: theme.spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
  backBtn: { padding: theme.spacing.sm },
  backText: { fontSize: theme.typography.fontSize.md, color: COLORS.primary, fontWeight: '600' },
  typeBadge: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full },
  typeBadgeText: { fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  facilityName: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  facilityAddress: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, marginTop: theme.spacing.xs },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm },
  phoneIcon: { fontSize: theme.typography.fontSize.md, marginRight: theme.spacing.xs },
  phoneText: { fontSize: theme.typography.fontSize.md, color: COLORS.primary, fontWeight: '500' },
  lastUpdated: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginTop: theme.spacing.xs },
  statRow: { flexDirection: 'row', gap: theme.spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  statValue: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginTop: theme.spacing.xs },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 4, marginTop: theme.spacing.sm, overflow: 'hidden', flexDirection: 'row' },
  ringFill: { height: '100%', borderRadius: 20 },
  section: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.lg, ...theme.shadows.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary, marginBottom: theme.spacing.md },
  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  bedSquare: { width: 28, height: 28, borderRadius: 6 },
  medTabs: { marginBottom: theme.spacing.md },
  medTab: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full, backgroundColor: COLORS.background, marginRight: theme.spacing.sm },
  medTabActive: { backgroundColor: COLORS.primary },
  medTabText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: '500' },
  medTabTextActive: { color: COLORS.textOnPrimary },
  medCard: { padding: theme.spacing.md, borderRadius: theme.borderRadius.sm, marginBottom: theme.spacing.sm, backgroundColor: COLORS.background },
  medHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  medName: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  medCategory: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary, marginTop: theme.spacing.xs },
  medStatusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  medStatusText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  medBarBg: { height: 6, backgroundColor: COLORS.border, borderRadius: theme.borderRadius.full, overflow: 'hidden', marginBottom: theme.spacing.sm },
  medBar: { height: '100%', borderRadius: theme.borderRadius.full },
  medFooter: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  medStockText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textPrimary, fontWeight: '500' },
  medThresholdText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  expiringText: { fontSize: theme.typography.fontSize.xs, color: COLORS.warning, fontWeight: '600' },
  restockBtn: { marginLeft: 'auto', backgroundColor: COLORS.primary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full },
  restockBtnText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  staffCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  avatarText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  staffInfo: { flex: 1 },
  staffName: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  staffRole: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  languageChips: { flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  langChip: { backgroundColor: COLORS.background, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  langText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  staffRight: { alignItems: 'flex-end' },
  dutyDot: { width: 8, height: 8, borderRadius: 4, marginBottom: theme.spacing.xs },
  dutyText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  shiftText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  quickActions: { flexDirection: 'row', gap: theme.spacing.md },
  callBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  callBtnText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  referralBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  referralBtnText: { color: COLORS.primary, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.lg, width: '80%' },
  modalTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: COLORS.textPrimary, marginBottom: theme.spacing.sm },
  modalSubtitle: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginBottom: theme.spacing.md },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, fontSize: theme.typography.fontSize.md, marginBottom: theme.spacing.md },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md },
  modalBtn: { flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: COLORS.background },
  modalBtnSave: { backgroundColor: COLORS.primary },
  modalBtnText: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
});
