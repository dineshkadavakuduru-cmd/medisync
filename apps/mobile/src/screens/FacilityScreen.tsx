import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FacilityType } from '@medisync/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { api, MOCK_FACILITIES } from '../services/api';
import { wsClient } from '../services/websocket';
import { useTranslation } from '../i18n';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';

interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  district: string;
  taluka: string;
  beds: { total: number; available: number; occupied: number };
  medicineAvailability: number;
  specialists: string[];
  contactPhone: string;
  isActive: boolean;
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

export const FacilityScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [demoMode, setDemoMode] = useState(isDemoActive);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadError, setLoadError] = useState(false);
  const loadRequest = useRef(0);
  const [filterType, setFilterType] = useState<FacilityType | 'ALL'>('ALL');
  const [searchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => onDemoModeChange(() => {
    loadRequest.current++;
    setFacilities([]);
    setDemoMode(isDemoActive());
  }), []);

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoadError(false);
    if (demoMode) {
      setFacilities(MOCK_FACILITIES);
      setLoading(false);
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      setLoading(true);
      const facRes = await Promise.race([
        api.getFacilities(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Facility request timed out')), 8000); }),
      ]);
      if (!facRes.success || facRes.source === 'sample' || !Array.isArray(facRes.data)) throw new Error('Facilities unavailable');
      if (request === loadRequest.current) setFacilities(facRes.data as Facility[]);
    } catch {
      if (request === loadRequest.current) { setFacilities([]); setLoadError(true); }
    } finally {
      clearTimeout(timeout);
      if (request === loadRequest.current) setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    const requests = loadRequest;
    loadData();
    return () => { requests.current++; };
  }, [loadData]);

  useEffect(() => {
    if (demoMode) return;
    const release = wsClient.connect();
    const offBeds = wsClient.on('BED_UPDATE', (msg: any) => {
      setHighlightedId(msg.facilityId);
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => setHighlightedId(null));
      loadData();
    });
    const offMedicine = wsClient.on('MEDICINE_UPDATE', () => loadData());
    const offStaff = wsClient.on('STAFF_UPDATE', () => loadData());
    const offAlert = wsClient.on('ALERT_NEW', () => loadData());
    return () => {
      offBeds(); offMedicine(); offStaff(); offAlert(); release();
    };
  }, [loadData, highlightAnim, demoMode]);

  const filtered = facilities.filter((f) => {
    const matchesType = filterType === 'ALL' || f.type === filterType;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.taluka.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const typeCounts: Record<string, number> = { ALL: facilities.length };
  facilities.forEach((f) => {
    typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
  });

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="hospital-building" size={64} color={COLORS.textSecondary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{loading ? t('facility.loadingFacilities') : t('facility.unableToLoad')}</Text>
      {!loading && <Text style={styles.emptySubtitle}>{loadError ? t('facility.checkConnection') : 'No facilities match this filter.'}</Text>}
      {!loading && loadError && <TouchableOpacity accessibilityRole="button" onPress={loadData} style={styles.filterChip}><Text style={styles.detailsLink}>Retry</Text></TouchableOpacity>}
    </View>
  );

  const renderFacilityCard = ({ item }: { item: Facility }) => {
    const bedPercent = item.beds.total > 0 ? Math.max(0, Math.min(100, Math.round((item.beds.available / item.beds.total) * 100))) : 0;
    const bedColor = bedPercent > 60 ? COLORS.success : bedPercent > 30 ? COLORS.warning : COLORS.severityRed;
    const medColor = item.medicineAvailability > 60 ? COLORS.success : item.medicineAvailability > 30 ? COLORS.warning : COLORS.severityRed;
    const hasCritical = item.medicineAvailability < 60;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('FacilityDetail', { facilityId: item.id, ...(demoMode ? { facility: item, facilitySource: 'sample' } : {}) })}
        style={[
          styles.card,
          hasCritical && { borderTopColor: COLORS.severityRed, borderTopWidth: 3 },
          highlightedId === item.id && { backgroundColor: COLORS.primaryLight },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.typeBadge, { backgroundColor: `${FACILITY_TYPE_COLORS[item.type]}20` }]}>
            <Text style={[styles.typeBadgeText, { color: FACILITY_TYPE_COLORS[item.type] }]}>
              {FACILITY_TYPE_LABELS[item.type]}
            </Text>
          </View>
        </View>

        <View style={styles.meterRow}>
          <MaterialCommunityIcons name="bed-outline" size={18} color={COLORS.primary} style={styles.meterIcon} />
          <Text style={styles.meterLabel}>{item.beds.available}/{item.beds.total} {t('facility.bedsAvailable')}</Text>
          <View style={styles.meterBarBg}>
            <View style={[styles.meterBar, { width: `${bedPercent}%`, backgroundColor: bedColor }]} />
          </View>
        </View>

        <View style={styles.meterRow}>
          <MaterialCommunityIcons name="pill" size={18} color={COLORS.primary} style={styles.meterIcon} />
          <Text style={styles.meterLabel}>{item.medicineAvailability}% {t('facility.medicineAvailability') || 'stock'}</Text>
          <View style={styles.meterBarBg}>
            <View style={[styles.meterBar, { width: `${item.medicineAvailability}%`, backgroundColor: medColor }]} />
          </View>
          {hasCritical && (
            <View style={styles.criticalTextContainer}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={12} color={COLORS.severityRed} />
              <Text style={styles.criticalText}>{Math.max(0, 100 - item.medicineAvailability)}% {t('facility.itemsCritical')}</Text>
            </View>
          )}
        </View>

        <View style={styles.staffRow}>
          <MaterialCommunityIcons name="doctor" size={16} color={COLORS.textSecondary} style={styles.meterIcon} />
          <Text style={styles.meterLabel}>{item.specialists.length} specialists</Text>
          {item.specialists.slice(0, 2).map((s) => (
            <View key={s} style={styles.specialistChip}>
              <Text style={styles.specialistText}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.phoneRow}>
            <MaterialCommunityIcons name="phone-outline" size={16} color={COLORS.primary} style={styles.phoneIcon} />
            <Text style={styles.phoneText}>{item.contactPhone}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('FacilityDetail', { facilityId: item.id, ...(demoMode ? { facility: item, facilitySource: 'sample' } : {}) })}>
            <Text style={styles.detailsLink}>{t('facility.viewDetails')} →</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('facility.title')}</Text>
        {demoMode && <Text style={styles.demoNotice}>DEMO MODE: Synthetic facility snapshots, not live availability. No server connection or live edits.</Text>}
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {(['ALL', FacilityType.SUB_CENTRE, FacilityType.PHC, FacilityType.CHC, FacilityType.DISTRICT_HOSPITAL] as const).map((type) => {
            const label = type === 'ALL' ? t('facility.all') : FACILITY_TYPE_LABELS[type];
            const count = typeCounts[type] || 0;
            const isActive = filterType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilterType(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderFacilityCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, width: '100%', backgroundColor: COLORS.background },
  demoNotice: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  filterWrapper: {
    minWidth: 0,
    maxWidth: '100%',
    marginBottom: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
   cardHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  cardName: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary, flex: 1, marginRight: theme.spacing.sm },
  typeBadge: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  typeBadgeText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  meterRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.xs, alignItems: 'center', marginBottom: theme.spacing.sm },
  meterIcon: { marginRight: theme.spacing.sm },
  meterLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginRight: theme.spacing.sm, flexShrink: 1, maxWidth: '100%' },
  meterBarBg: { flexGrow: 1, flexBasis: 60, height: 6, backgroundColor: COLORS.border, borderRadius: theme.borderRadius.full, overflow: 'hidden' },
  meterBar: { height: '100%', borderRadius: theme.borderRadius.full },
  criticalText: { fontSize: theme.typography.fontSize.xs, color: COLORS.severityRed, fontWeight: '600', marginLeft: theme.spacing.sm },
  criticalTextContainer: { flexDirection: 'row', flexShrink: 1, alignItems: 'center' },
  staffRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.xs, alignItems: 'center', marginBottom: theme.spacing.sm },
  specialistChip: { maxWidth: '100%', flexShrink: 1, backgroundColor: COLORS.primaryLight, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full, marginLeft: theme.spacing.xs },
  specialistText: { fontSize: theme.typography.fontSize.xs, color: COLORS.primary, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center', justifyContent: 'space-between', paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: theme.spacing.sm },
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  phoneIcon: { marginRight: theme.spacing.xs },
  phoneText: { fontSize: theme.typography.fontSize.sm, color: COLORS.primary, fontWeight: '500' },
  detailsLink: { fontSize: theme.typography.fontSize.sm, color: COLORS.primary, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyIcon: {
    marginBottom: theme.spacing.sm,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
