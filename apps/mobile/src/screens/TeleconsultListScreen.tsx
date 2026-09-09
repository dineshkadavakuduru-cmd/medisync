import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { teleconsultClient, TeleconsultSession } from '../services/teleconsultClient';
import { teleconsultCopy as copy } from '../i18n/translations/teleconsult';

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: COLORS.warning,
  ACCEPTED: COLORS.info,
  IN_PROGRESS: COLORS.success,
  COMPLETED: COLORS.textSecondary,
  DECLINED: COLORS.danger,
  CANCELLED: COLORS.textSecondary,
};

type FilterTab = 'all' | 'upcoming' | 'past';
type StatusFilter = 'all' | 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
type SpecialtyFilter = 'all' | 'General Physician' | 'Cardiologist' | 'Pediatrician' | 'Neurologist';

export const TeleconsultListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [sessions, setSessions] = useState<TeleconsultSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const active = useRef(false);
  const createLock = useRef(false);
  const version = useRef(0);

  const loadSessions = async () => {
    const current = ++version.current;
    setRefreshing(true);
    try {
      const data = await teleconsultClient.list();
      if (active.current && current === version.current) {
        setSessions(data);
        setError('');
      }
    } catch (e) {
      if (active.current && current === version.current) setError(e instanceof Error ? e.message : copy.error);
    } finally {
      if (active.current && current === version.current) setRefreshing(false);
    }
  };

  useEffect(() => {
    active.current = true;
    void loadSessions();
    const unsubscribe = navigation.addListener?.('focus', () => void loadSessions());
    return () => { active.current = false; version.current += 1; unsubscribe?.(); };
  }, [navigation]);

  const onRefresh = async () => {
    await loadSessions();
  };

  const createDemo = async () => {
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    setError('');
    try {
      const session = await teleconsultClient.createDemo();
      if (active.current) {
        await loadSessions();
        navigation.navigate('TeleconsultJoin', { sessionId: session.id });
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : copy.error);
    } finally {
      createLock.current = false;
      if (active.current) setCreating(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const now = Date.now();

  // Filter sessions based on tabs and filters
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Tab filter
    if (filterTab === 'upcoming') {
      result = result.filter(s => new Date(s.scheduledTime).getTime() >= now && ['REQUESTED', 'ACCEPTED'].includes(s.status));
    } else if (filterTab === 'past') {
      result = result.filter(s => new Date(s.scheduledTime).getTime() < now || ['COMPLETED', 'CANCELLED', 'DECLINED'].includes(s.status));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    // Specialty filter (in real app, this would come from doctor data)
    if (specialtyFilter !== 'all') {
      // For demo, we'll filter by doctor name containing specialty
      // In real app, this would be a proper doctor lookup
      result = result.filter(s => {
        if (specialtyFilter === 'General Physician') return s.doctorName.includes('शर्मा');
        if (specialtyFilter === 'Cardiologist') return s.doctorName.includes('पाटिल');
        if (specialtyFilter === 'Pediatrician') return s.doctorName.includes('शिंदे');
        if (specialtyFilter === 'Neurologist') return s.doctorName.includes('कुलकर्णी');
        return true;
      });
    }

    return result;
  }, [sessions, filterTab, statusFilter, specialtyFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          {(['all', 'upcoming', 'past'] as FilterTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, filterTab === tab && styles.tabButtonActive]}
              onPress={() => setFilterTab(tab)}
            >
              <Text style={[styles.tabButtonText, filterTab === tab && styles.tabButtonTextActive]}>
                {copy[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {teleconsultClient.isDemo && <>
          <Text style={styles.notice}>{copy.demo}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={creating} style={styles.action} onPress={createDemo}>
            <Text style={styles.actionText}>{creating ? copy.loading : copy.create}</Text>
          </TouchableOpacity>
        </>}

        {/* Filter Controls */}
        <TouchableOpacity style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
          <Text style={styles.filterToggleText}>
            {showFilters ? 'Hide Filters' : 'Show Filters'} {' ▾'}
          </Text>
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{copy.filterByStatus}</Text>
              <View style={styles.filterChips}>
                {(['all', 'REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'] as StatusFilter[]).map((sf) => (
                  <TouchableOpacity
                    key={sf}
                    style={[styles.filterChip, statusFilter === sf && styles.filterChipActive]}
                    onPress={() => setStatusFilter(sf)}
                  >
                    <Text style={[styles.filterChipText, statusFilter === sf && styles.filterChipTextActive]}>
                      {sf === 'all' ? 'All' : copy.statuses[sf]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{copy.filterBySpecialty}</Text>
              <View style={styles.filterChips}>
                {(['all', 'General Physician', 'Cardiologist', 'Pediatrician', 'Neurologist'] as SpecialtyFilter[]).map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={[styles.filterChip, specialtyFilter === sp && styles.filterChipActive]}
                    onPress={() => setSpecialtyFilter(sp)}
                  >
                    <Text style={[styles.filterChipText, specialtyFilter === sp && styles.filterChipTextActive]}>
                      {sp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.notice}>{copy.roles}</Text>
        {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.danger }}>{error}</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={refreshing} onPress={onRefresh} style={styles.action}>
          <Text style={styles.actionText}>{refreshing ? copy.loading : copy.retry}</Text>
        </TouchableOpacity>

        {filteredSessions.length === 0 && !refreshing && !error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{copy.empty}</Text>
            <Text style={styles.emptySubtitle}>
              {filterTab !== 'all' ? 'No consultations in this category' : 'Create a demo to get started'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                accessibilityRole="button"
                style={styles.card}
                onPress={() => navigation.navigate('TeleconsultJoin', { sessionId: session.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.patientName}>{session.patientName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[session.status] || COLORS.textSecondary }]}>
                    <Text style={styles.statusText}>{copy.statuses[session.status]}</Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.doctorName}>{session.doctorName}</Text>
                  <Text style={styles.time}>
                    {formatDate(session.scheduledTime)} • {formatTimeStr(session.scheduledTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const formatTimeStr = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.lg },
  header: { gap: theme.spacing.xs, paddingTop: theme.spacing.md },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerSubtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary },
  tabRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabButtonText: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabButtonTextActive: { color: COLORS.textOnPrimary },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl, gap: theme.spacing.md },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.sm, opacity: 0.4 },
  emptyTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textSecondary },
  emptySubtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, textAlign: 'center' },
  list: { gap: theme.spacing.md },
  card: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs },
  patientName: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  cardMeta: { gap: 4 },
  doctorName: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, marginBottom: 2 },
  time: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  notice: { backgroundColor: '#EAF3F2', color: '#234B47', padding: 14, borderRadius: 10, lineHeight: 21 },
  action: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '600' },
  filterToggle: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: theme.spacing.md },
  filterToggleText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  filterPanel: { backgroundColor: COLORS.surface, borderRadius: 12, padding: theme.spacing.md, gap: theme.spacing.md, borderWidth: 1, borderColor: COLORS.border },
  filterRow: { gap: theme.spacing.md },
  filterLabel: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textPrimary },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.background, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  filterChipTextActive: { color: COLORS.textOnPrimary },
});