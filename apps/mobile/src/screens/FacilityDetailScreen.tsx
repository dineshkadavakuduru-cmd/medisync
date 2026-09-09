import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, FacilityType, MedicineItemStatus } from '@medisync/shared';
import { theme } from '../styles/theme';
import { api, MOCK_FACILITIES } from '../services/api';
import { wsClient } from '../services/websocket';
import { useTranslation } from '../i18n';
import { buildSyntheticBedHistory, fetchBedForecast, BedForecastResult } from '../services/bedForecast';
import { bedForecastCopy } from './bedForecastI18n';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';

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

type SampleFacility = typeof MOCK_FACILITIES[number];

// This snapshot is only selected in demo mode. It is never occupancy history.
export function sampleFacilitySummary(facility: SampleFacility): FacilitySummary {
  const bounded = (value: number, max: number) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
  const total = bounded(facility.beds?.total, 500);
  const available = bounded(facility.beds?.available, total);
  return {
    facility: { id: facility.id, name: facility.name, type: facility.type, district: facility.district, taluka: facility.taluka, contactPhone: facility.contactPhone },
    beds: { total, available, occupied: total - available, occupancyRate: total ? Math.round((total - available) / total * 100) : 0 },
    medicine: { overallAvailability: bounded(facility.medicineAvailability, 100), totalItems: 0, adequate: 0, low: 0, critical: 0, outOfStock: 0, criticalItems: [] },
    staff: { total: 6, onDuty: 4, doctors: 2, doctorsOnDuty: 1, specialists: [], specialistsOnDuty: [] },
    recentReferralsIn: 0, recentReferralsOut: 0, activeAlerts: 0,
  };
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
  const { facilityId, facility: routeFacility, facilitySource } = (route.params || {}) as { facilityId?: string; facility?: SampleFacility; facilitySource?: 'sample' };

  const [demoMode, setDemoMode] = useState(isDemoActive);
  const [summary, setSummary] = useState<FacilitySummary | null>(null);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequest = useRef(0);
  const lastLoadedAt = useRef(0);
  const [medFilter, setMedFilter] = useState<'ALL' | 'CRITICAL' | 'LOW' | 'ADEQUATE'>('ALL');
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineItem | null>(null);
  const [restockValue, setRestockValue] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('just now');
  const { language } = useTranslation();
  const forecastText = bedForecastCopy(language);
  const [demoVisible, setDemoVisible] = useState(false);
  const [forecast, setForecast] = useState<BedForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(false);
  const forecastRequest = useRef<AbortController | null>(null);

  useEffect(() => onDemoModeChange(() => {
    loadRequest.current++;
    forecastRequest.current?.abort();
    setSummary(null);
    setMedicines([]);
    setStaff([]);
    setLoading(true);
    setRestockModalVisible(false);
    setSelectedMedicine(null);
    setDemoMode(isDemoActive());
  }), []);

  useEffect(() => {
    setDemoVisible(false);
    setForecast(null);
    setForecastLoading(false);
    setForecastError(false);
    return () => { forecastRequest.current?.abort(); };
  }, [facilityId, demoMode]);

  const runForecastDemo = async () => {
    forecastRequest.current?.abort();
    const controller = new AbortController();
    forecastRequest.current = controller;
    setDemoVisible(true);
    setForecast(null);
    setForecastError(false);
    setForecastLoading(true);
    try {
      const result = await fetchBedForecast(buildSyntheticBedHistory(), { signal: controller.signal });
      if (!controller.signal.aborted) setForecast(result);
    } catch {
      if (!controller.signal.aborted) setForecastError(true);
    } finally {
      if (!controller.signal.aborted) setForecastLoading(false);
    }
  };

  const closeForecastDemo = () => {
    forecastRequest.current?.abort();
    setDemoVisible(false);
    setForecast(null);
    setForecastLoading(false);
    setForecastError(false);
  };

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setLoadError(null);
    setSummary(null);
    setMedicines([]);
    setStaff([]);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!facilityId) throw new Error('No facility selected. Go back and select a facility.');
      if (demoMode) {
        const sample = facilitySource === 'sample' && routeFacility?.id === facilityId
          ? routeFacility : MOCK_FACILITIES.find(item => item.id === facilityId);
        if (!sample) throw new Error('No sample is available for this facility. Select a facility from the demo list.');
        setSummary(sampleFacilitySummary(sample));
        return;
      }
      if (!process.env.EXPO_PUBLIC_API_URL?.trim()) throw new Error('Server not configured. Set EXPO_PUBLIC_API_URL to load facility details, then retry.');
      const [summaryRes, medRes, staffRes] = await Promise.race([
        Promise.all([
          api.getFacilitySummary(facilityId),
          api.getFacilityInventory(facilityId),
          api.getFacilityStaff(facilityId),
        ]),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Facility request timed out. Check the server connection and retry.')), 8000); }),
      ]);
      if (!summaryRes.success || !medRes.success || !staffRes.success || summaryRes.source === 'sample' || medRes.source === 'sample' || staffRes.source === 'sample' || !summaryRes.data || !Array.isArray(medRes.data) || !Array.isArray(staffRes.data)) throw new Error('Facility details are unavailable. Check the server connection and retry.');
      const data = summaryRes.data as FacilitySummary;
      if (data.facility?.id !== facilityId || !data.beds || !Number.isInteger(data.beds.total) || data.beds.total < 0 || !Number.isInteger(data.beds.available) || data.beds.available < 0 || data.beds.available > data.beds.total || !data.medicine || !data.staff) throw new Error('The server returned invalid facility details. Please retry.');
      if (request !== loadRequest.current) return;
      setSummary(data);
      setMedicines(medRes.data as MedicineItem[]);
      setStaff(staffRes.data as StaffMember[]);
      lastLoadedAt.current = Date.now();
      setLastUpdated('just now');
    } catch (e) {
      if (request === loadRequest.current) setLoadError(e instanceof Error ? e.message : 'Facility details are unavailable. Please retry.');
    } finally {
      clearTimeout(timeout);
      if (request === loadRequest.current) setLoading(false);
    }
  }, [facilityId, demoMode, routeFacility, facilitySource]);

  useEffect(() => {
    const requests = loadRequest;
    loadData();
    return () => { requests.current++; };
  }, [loadData]);

  useEffect(() => {
    if (demoMode || !facilityId) return;
    const interval = setInterval(() => {
      const mins = Math.max(0, Math.floor((Date.now() - lastLoadedAt.current) / 60000));
      setLastUpdated(mins === 0 ? 'just now' : `${mins} min${mins > 1 ? 's' : ''} ago`);
    }, 60000);

    const release = wsClient.connect(facilityId);
    const offBeds = wsClient.on('BED_UPDATE', () => loadData());
    const offMedicine = wsClient.on('MEDICINE_UPDATE', () => loadData());
    const offStaff = wsClient.on('STAFF_UPDATE', () => loadData());

    return () => {
      clearInterval(interval);
      offBeds(); offMedicine(); offStaff(); release();
    };
  }, [loadData, facilityId, demoMode]);

  const handleRestock = async () => {
    if (isDemoActive() || !facilityId || !selectedMedicine || !restockValue) return;
    const newStock = parseInt(restockValue, 10);
    if (isNaN(newStock) || newStock < 0) return;
    try {
      await api.updateMedicineStock(facilityId, selectedMedicine.id, newStock);
    } catch {
      setLoadError('Restock failed. No stock update was confirmed. Retry loading facility details.');
      return;
    }
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

  if (loading || !summary || loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text accessibilityRole={loading ? undefined : 'alert'} style={styles.loadingText}>{loading ? 'Loading facility details...' : loadError || 'Facility details are unavailable.'}</Text>
          {!loading && <TouchableOpacity accessibilityRole="button" style={styles.forecastButton} onPress={loadData}><Text style={styles.callBtnText}>Retry</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" style={styles.backBtn} onPress={() => navigation.goBack()}><Text style={styles.backText}>Back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const f = summary.facility;
  const bedPercent = summary.beds.total > 0 ? Math.round((summary.beds.available / summary.beds.total) * 100) : 0;
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

        {demoMode && <View style={styles.section}><Text style={styles.forecastSample}>DEMO MODE: Synthetic selected facility</Text><Text style={styles.forecastBody}>Sample snapshot only, not live availability. Bed and medicine figures are bounded samples; staffing is a fixed 4 of 6 example. No live edits, calls, or referrals are available.</Text></View>}
        <Text style={styles.facilityName}>{f.name}</Text>
        <Text style={styles.facilityAddress}>{f.district}, {f.taluka}</Text>
        <TouchableOpacity disabled={demoMode} accessibilityState={{ disabled: demoMode }} onPress={() => { if (!isDemoActive()) Linking.openURL(`tel:${f.contactPhone}`); }} style={styles.phoneRow}>
          <Text style={styles.phoneIcon}>📞</Text>
          <Text style={styles.phoneText}>{f.contactPhone}</Text>
        </TouchableOpacity>
        <Text style={styles.lastUpdated}>{demoMode ? 'Synthetic snapshot; no live update timestamp' : `Last updated: ${lastUpdated}`}</Text>

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
            {Array.from({ length: Math.min(summary.beds.total, 500) }).map((_, idx) => {
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
          {summary.beds.total > 500 && <Text style={styles.forecastBody}>Showing the first 500 beds.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{forecastText.title}</Text>
          <Text style={styles.forecastBody}>{forecastText.noHistory}</Text>
          <Text style={styles.forecastWarning}>{forecastText.disclaimer}</Text>
          {!demoVisible ? (
            <TouchableOpacity accessibilityRole="button" style={styles.forecastButton} onPress={runForecastDemo}>
              <Text style={styles.callBtnText}>{forecastText.tryDemo}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.forecastContent}>
              <Text style={styles.forecastSample}>{forecastText.sample}</Text>
              <Text style={styles.forecastBody}>{forecastText.sampleDetails}</Text>
              {forecastLoading && (
                <View accessibilityLiveRegion="polite" style={styles.forecastContent}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.forecastBody}>{forecastText.loading}</Text>
                </View>
              )}
              {forecastError && <Text accessibilityRole="alert" style={styles.forecastWarning}>{forecastText.error}</Text>}
              {forecast && (
                <View accessibilityLiveRegion="polite" style={styles.forecastContent}>
                  <Text style={styles.forecastBody}>{forecastText.source}: {forecastText[forecast.source]}</Text>
                  <Text style={styles.forecastBody}>{forecast.prediction.model_used === 'synthetic_lstm' ? forecastText.lstm : forecastText.heuristic}</Text>
                  {forecast.localReason && <Text style={styles.forecastWarning}>{forecastText[forecast.localReason]}</Text>}
                  {forecast.source === 'ml' && forecast.prediction.fallback_reason && (
                    <Text style={styles.forecastWarning}>{forecastText[forecast.prediction.fallback_reason]}</Text>
                  )}
                  <View style={styles.forecastGrid}>
                    {forecast.prediction.forecasts.map(point => (
                      <View key={point.horizon_hours} style={styles.forecastTile}>
                        <Text style={styles.medName}>+{point.horizon_hours} {forecastText.hours}</Text>
                        <Text style={styles.forecastBody}>{forecastText.occupied}: {point.occupied_beds}/{forecast.prediction.capacity} ({Math.round(point.occupancy_rate * 100)}%)</Text>
                        <Text style={styles.forecastBody}>{forecastText.available}: {point.available_beds}</Text>
                        <Text style={styles.forecastBody}>{forecastText.utc}: {new Date(point.timestamp).toISOString().slice(0, 16).replace('T', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              <View style={styles.forecastControls}>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: forecastLoading }} disabled={forecastLoading} style={[styles.forecastButton, forecastLoading && styles.forecastDisabled]} onPress={runForecastDemo}>
                  <Text style={styles.callBtnText}>{forecastText.retry}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.forecastClose} onPress={closeForecastDemo}>
                  <Text style={styles.referralBtnText}>{forecastText.close}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medicine Stock ({medPercent}%)</Text>
          </View>
          {demoMode && <Text style={styles.forecastBody}>Sample percentage only. No medicine inventory records or restocking in demo mode.</Text>}
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
                  <View style={styles.medIdentity}>
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
                  {!demoMode && <TouchableOpacity style={styles.restockBtn} onPress={() => { if (isDemoActive()) return; setSelectedMedicine(med); setRestockValue(String(med.maxCapacity)); setRestockModalVisible(true); }}>
                    <Text style={styles.restockBtnText}>Restock</Text>
                  </TouchableOpacity>}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff on Duty ({summary.staff.onDuty}/{summary.staff.total})</Text>
          {demoMode && <Text style={styles.forecastBody}>Synthetic staffing example only. No live staff roster is available.</Text>}
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

        {!demoMode && <View style={styles.quickActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${f.contactPhone}`)}>
            <Text style={styles.callBtnText}>📞 Call Facility</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.referralBtn} onPress={() => {}}>
            <Text style={styles.referralBtnText}>🚑 Send Referral Here</Text>
          </TouchableOpacity>
        </View>}
      </ScrollView>

      <Modal visible={!demoMode && restockModalVisible} transparent animationType="slide">
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
  container: { flex: 1, minWidth: 0, width: '100%', backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textSecondary, fontSize: theme.typography.fontSize.md },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.xl, gap: theme.spacing.lg },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
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
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  statCard: {
    flexGrow: 1,
    flexBasis: 80,
    minWidth: 0,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
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
  forecastBody: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, lineHeight: 22 },
  forecastWarning: { fontSize: theme.typography.fontSize.sm, color: COLORS.severityRed, lineHeight: 22, marginVertical: theme.spacing.sm },
  forecastSample: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.primary },
  forecastContent: { gap: theme.spacing.sm },
  forecastGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  forecastTile: { flexGrow: 1, flexBasis: 150, backgroundColor: COLORS.background, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, gap: theme.spacing.xs },
  forecastControls: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  forecastButton: { maxWidth: '100%', flexShrink: 1, backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  forecastClose: { maxWidth: '100%', flexShrink: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  forecastDisabled: { opacity: 0.5 },
  medTabs: { marginBottom: theme.spacing.md },
  medTab: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full, backgroundColor: COLORS.background, marginRight: theme.spacing.sm },
  medTabActive: { backgroundColor: COLORS.primary },
  medTabText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: '500' },
  medTabTextActive: { color: COLORS.textOnPrimary },
  medCard: { padding: theme.spacing.md, borderRadius: theme.borderRadius.sm, marginBottom: theme.spacing.sm, backgroundColor: COLORS.background },
  medHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  medIdentity: { flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  medName: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  medCategory: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary, marginTop: theme.spacing.xs },
  medStatusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  medStatusText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  medBarBg: { height: 6, backgroundColor: COLORS.border, borderRadius: theme.borderRadius.full, overflow: 'hidden', marginBottom: theme.spacing.sm },
  medBar: { height: '100%', borderRadius: theme.borderRadius.full },
  medFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
  medStockText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textPrimary, fontWeight: '500' },
  medThresholdText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  expiringText: { fontSize: theme.typography.fontSize.xs, color: COLORS.warning, fontWeight: '600' },
  restockBtn: { marginLeft: 'auto', backgroundColor: COLORS.primary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full },
  restockBtnText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  staffCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.sm, alignItems: 'center', paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  avatarText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  staffInfo: { flexGrow: 1, flexBasis: 100, minWidth: 0 },
  staffName: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  staffRole: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  languageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  langChip: { backgroundColor: COLORS.background, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  langText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  staffRight: { alignItems: 'flex-end' },
  dutyDot: { width: 8, height: 8, borderRadius: 4, marginBottom: theme.spacing.xs },
  dutyText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  shiftText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  callBtn: { flexGrow: 1, flexBasis: 150, backgroundColor: COLORS.primary, padding: theme.spacing.md, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  callBtnText: { flexShrink: 1, textAlign: 'center', color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  referralBtn: { flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: COLORS.primary, padding: theme.spacing.md, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  referralBtnText: { flexShrink: 1, textAlign: 'center', color: COLORS.primary, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
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
