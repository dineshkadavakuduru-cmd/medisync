import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Linking,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FacilityType } from '@medisync/shared';
import { theme } from '../styles/theme';
import { api, MOCK_FACILITIES } from '../services/api';
import { wsClient } from '../services/websocket';
import { useTranslation } from '../i18n';

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

interface DistrictSummary {
  totalBeds: number;
  availableBeds: number;
  avgMedicineAvailability: number;
  totalStaffOnDuty: number;
  facilitiesWithCriticalStock: number;
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
  const [facilities, setFacilities] = useState<Facility[]>(MOCK_FACILITIES);
  const [districtSummary, setDistrictSummary] = useState<DistrictSummary | null>(null);
  const [filterType, setFilterType] = useState<FacilityType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const facRes = await api.getFacilities();
      const facList = (facRes.data || MOCK_FACILITIES) as Facility[];
      setFacilities(facList);
    } catch (e) {
      setFacilities(MOCK_FACILITIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    wsClient.connect();
    wsClient.on('BED_UPDATE', (msg: any) => {
      setHighlightedId(msg.facilityId);
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => setHighlightedId(null));
      loadData();
    });
    wsClient.on('MEDICINE_UPDATE', () => loadData());
    wsClient.on('STAFF_UPDATE', () => loadData());
    wsClient.on('ALERT_NEW', () => loadData());
    return () => {
      wsClient.disconnect();
    };
  }, [loadData]);

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
      <Text style={styles.emptyIcon}>🏥</Text>
      <Text style={styles.emptyTitle}>{loading ? t('facility.loadingFacilities') : t('facility.unableToLoad')}</Text>
      {!loading && <Text style={styles.emptySubtitle}>{t('facility.checkConnection')}</Text>}
    </View>
  );

  const renderFacilityCard = ({ item }: { item: Facility }) => {
    const bedPercent = Math.round((item.beds.available / item.beds.total) * 100);
    const bedColor = bedPercent > 60 ? COLORS.success : bedPercent > 30 ? COLORS.warning : COLORS.severityRed;
    const medColor = item.medicineAvailability > 60 ? COLORS.success : item.medicineAvailability > 30 ? COLORS.warning : COLORS.severityRed;
    const hasCritical = item.medicineAvailability < 60;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('FacilityDetail', { facilityId: item.id })}
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
          <Text style={styles.meterIcon}>🛏️</Text>
          <Text style={styles.meterLabel}>{item.beds.available}/{item.beds.total} {t('facility.bedsAvailable')}</Text>
          <View style={styles.meterBarBg}>
            <View style={[styles.meterBar, { width: `${bedPercent}%`, backgroundColor: bedColor }]} />
          </View>
        </View>

        <View style={styles.meterRow}>
          <Text style={styles.meterIcon}>💊</Text>
          <Text style={styles.meterLabel}>{item.medicineAvailability}%</Text>
          <View style={styles.meterBarBg}>
            <View style={[styles.meterBar, { width: `${item.medicineAvailability}%`, backgroundColor: medColor }]} />
          </View>
          {hasCritical && <Text style={styles.criticalText}>⚠️ {Math.max(0, 100 - item.medicineAvailability)}% {t('facility.itemsCritical')}</Text>}
        </View>

        <View style={styles.staffRow}>
          <Text style={styles.meterIcon}>👨‍⚕️</Text>
          <Text style={styles.meterLabel}>{item.specialists.length} specialists</Text>
          {item.specialists.slice(0, 2).map((s) => (
            <View key={s} style={styles.specialistChip}>
              <Text style={styles.specialistText}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.phoneRow}>
            <Text style={styles.phoneIcon}>📞</Text>
            <Text style={styles.phoneText}>{item.contactPhone}</Text>
          </TouchableOpacity>
          <TouchableOpacity>
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
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['ALL', FacilityType.SUB_CENTRE, FacilityType.PHC, FacilityType.CHC, FacilityType.DISTRICT_HOSPITAL] as const).map((type) => {
          const label = type === 'ALL' ? t('facility.all') : FACILITY_TYPE_LABELS[type];
          const count = typeCounts[type] || 0;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, filterType === type && styles.filterChipActive]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
                {label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  filterScroll: {
    flexGrow: 0,
    height: 42,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.surface,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.textOnPrimary },
  listContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  cardName: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary, flex: 1, marginRight: theme.spacing.sm },
  typeBadge: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  typeBadgeText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  meterIcon: { fontSize: theme.typography.fontSize.md, marginRight: theme.spacing.sm },
  meterLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginRight: theme.spacing.sm, minWidth: 110 },
  meterBarBg: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: theme.borderRadius.full, overflow: 'hidden' },
  meterBar: { height: '100%', borderRadius: theme.borderRadius.full },
  criticalText: { fontSize: theme.typography.fontSize.xs, color: COLORS.severityRed, fontWeight: '600', marginLeft: theme.spacing.sm },
  staffRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  specialistChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full, marginLeft: theme.spacing.xs },
  specialistText: { fontSize: theme.typography.fontSize.xs, color: COLORS.primary, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: theme.spacing.sm },
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  phoneIcon: { fontSize: theme.typography.fontSize.md, marginRight: theme.spacing.xs },
  phoneText: { fontSize: theme.typography.fontSize.sm, color: COLORS.primary, fontWeight: '500' },
  detailsLink: { fontSize: theme.typography.fontSize.sm, color: COLORS.primary, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyIcon: {
    fontSize: 64,
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
