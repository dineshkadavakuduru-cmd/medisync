import React, { useEffect, useRef, useState } from 'react';
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
import { useTranslation } from '../i18n';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';

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

export const TeleconsultListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { language } = useTranslation();
  const [isDemo, setIsDemo] = useState(isDemoActive);
  const [sessions, setSessions] = useState<TeleconsultSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const active = useRef(false);
  const createLock = useRef(false);
  const version = useRef(0);
  const modeVersion = useRef(0);

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
    setIsDemo(isDemoActive());
    void loadSessions();
    const unsubscribeMode = onDemoModeChange(() => {
      modeVersion.current += 1;
      version.current += 1;
      createLock.current = false;
      setIsDemo(isDemoActive());
      setSessions([]);
      setError('');
      setCreating(false);
      setFilterTab('all');
      setStatusFilter('all');
      setSpecialtyFilter(null);
      setShowFilters(false);
      void loadSessions();
    });
    const unsubscribe = navigation.addListener?.('focus', () => void loadSessions());
    return () => { active.current = false; version.current += 1; modeVersion.current += 1; unsubscribeMode(); unsubscribe?.(); };
  }, [navigation]);

  const onRefresh = async () => {
    await loadSessions();
  };

  const createDemo = async () => {
    if (createLock.current || !active.current || !isDemoActive()) return;
    const currentMode = modeVersion.current;
    createLock.current = true;
    setCreating(true);
    setError('');
    try {
      const session = await teleconsultClient.createDemo();
      if (active.current && currentMode === modeVersion.current) {
        await loadSessions();
        if (active.current && currentMode === modeVersion.current) navigation.navigate('TeleconsultJoin', { sessionId: session.id });
      }
    } catch (e) {
      if (active.current && currentMode === modeVersion.current) setError(e instanceof Error ? e.message : copy.error);
    } finally {
      if (currentMode === modeVersion.current) {
        createLock.current = false;
        if (active.current) setCreating(false);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const specialties = [...new Set(sessions.map(s => s.doctorSpecialty?.trim() || s.specialty?.trim()).filter((s): s is string => !!s))];
  const filteredSessions = sessions.filter(s => {
    const closed = ['COMPLETED', 'CANCELLED', 'DECLINED'].includes(s.status);
    return (filterTab === 'all' || (filterTab === 'past' ? closed : !closed)) &&
      (statusFilter === 'all' || s.status === statusFilter) &&
      (specialtyFilter === null || (s.doctorSpecialty?.trim() || s.specialty?.trim()) === specialtyFilter);
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
          {language !== 'en' && <Text style={styles.notice}>{copy.languageGap}</Text>}
          {!isDemo && <Text style={styles.notice}>{copy.backendNotice}</Text>}
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

        {isDemo && <>
          <Text style={styles.notice}>{copy.demo}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={creating} style={styles.action} onPress={createDemo}>
            <Text style={styles.actionText}>{creating ? copy.loading : copy.create}</Text>
          </TouchableOpacity>
        </>}

        {/* Filter Controls */}
        <TouchableOpacity style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
          <Text style={styles.filterToggleText}>
            {showFilters ? copy.hideFilters : copy.showFilters}
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
                      {sf === 'all' ? copy.all : copy.statuses[sf]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{copy.filterBySpecialty}</Text>
              <View style={styles.filterChips}>
                {[null, ...specialties].map((sp) => (
                  <TouchableOpacity
                    key={sp === null ? 'all' : `specialty-${sp}`}
                    style={[styles.filterChip, specialtyFilter === sp && styles.filterChipActive]}
                    onPress={() => setSpecialtyFilter(sp)}
                  >
                    <Text style={[styles.filterChipText, specialtyFilter === sp && styles.filterChipTextActive]}>
                      {sp ?? copy.all}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!specialties.length && <Text style={styles.notice}>{copy.specialtyMissing}</Text>}
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
            <Text style={styles.emptyTitle}>{sessions.length ? copy.noMatches : copy.empty}</Text>
            <Text style={styles.emptySubtitle}>
              {isDemo && !sessions.length ? copy.create : copy.retry}
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
                  {!!(session.doctorSpecialty || session.specialty) && <Text style={styles.doctorName}>{session.doctorSpecialty || session.specialty}</Text>}
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
