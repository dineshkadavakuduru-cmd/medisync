import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Animated,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';
import { configuredApiRequest } from '../services/teleconsultClient';
import { queueScreenCopy as copy } from '../i18n/translations/queueScreen';

interface QueueEntry {
  appointmentId: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  priority: TriageSeverity;
  position: number;
  estimatedWaitMinutes: number;
  tokenNumber?: string;
  checkedInAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  RED: COLORS.danger,
  YELLOW: COLORS.warning,
  GREEN: COLORS.success,
};

export const QueueScreen: React.FC<{ route?: { params?: { facilityId?: string } } }> = ({ route }) => {
  const { language } = useTranslation();
  const connected = !!process.env.EXPO_PUBLIC_API_URL?.trim();
  const [facilityInput, setFacilityInput] = useState(route?.params?.facilityId || '');
  const [facilityId, setFacilityId] = useState(route?.params?.facilityId?.trim() || '');
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const queueRef = useRef<QueueEntry[]>([]);
  const active = useRef(false);
  const version = useRef(0);
  const inFlight = useRef<number | null>(null);
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadQueue = async () => {
    if (!connected || !facilityId || inFlight.current !== null) return;
    const current = ++version.current;
    inFlight.current = current;
    setRefreshing(true);
    try {
      const data = await configuredApiRequest(`/appointments/queue/${encodeURIComponent(facilityId)}`);
      if (!Array.isArray(data) || data.some(q => !q || typeof q.appointmentId !== 'string' || !q.appointmentId.trim() ||
          typeof q.patientId !== 'string' || !q.patientId.trim() || typeof q.patientName !== 'string' || !q.patientName.trim() ||
          q.facilityId !== facilityId || !['RED', 'YELLOW', 'GREEN'].includes(q.priority) ||
          !Number.isInteger(q.position) || q.position < 1 || typeof q.estimatedWaitMinutes !== 'number' ||
          !Number.isFinite(q.estimatedWaitMinutes) || q.estimatedWaitMinutes < 0 ||
          typeof q.checkedInAt !== 'string' || !Number.isFinite(Date.parse(q.checkedInAt)) ||
          (q.tokenNumber !== undefined && (typeof q.tokenNumber !== 'string' || !q.tokenNumber.trim()))) ||
          new Set(data.map(q => q.appointmentId)).size !== data.length ||
          new Set(data.map(q => q.position)).size !== data.length) throw new Error(copy.invalidResponse);
      if (!active.current || current !== version.current) return;
      const newQueue = (data as QueueEntry[]).slice().sort((a, b) => a.position - b.position);
      const prevRedIds = new Set(queueRef.current.filter(q => q.priority === 'RED').map(q => q.appointmentId));
      const addedRed = newQueue.find(q => q.priority === 'RED' && !prevRedIds.has(q.appointmentId));
      if (addedRed) {
        if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
        setHighlightedToken(addedRed.appointmentId);
        highlightTimeout.current = setTimeout(() => setHighlightedToken(null), 3000);
      }
      queueRef.current = newQueue;
      setQueue(newQueue);
      setUpdatedAt(Date.now());
      setError('');
    } catch (e) {
      if (active.current && current === version.current) setError(e instanceof Error ? e.message : copy.error);
    } finally {
      if (inFlight.current === current) inFlight.current = null;
      if (active.current && current === version.current) setRefreshing(false);
    }
  };

  useEffect(() => {
    active.current = true;
    queueRef.current = [];
    setQueue([]);
    setUpdatedAt(null);
    setError('');
    setRefreshing(false);
    setHighlightedToken(null);
    void loadQueue();
    const interval = setInterval(() => void loadQueue(), 15000);
    return () => {
      active.current = false;
      version.current += 1;
      inFlight.current = null;
      clearInterval(interval);
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
    };
  }, [connected, facilityId]);

  const onRefresh = async () => {
    await loadQueue();
  };

  const getPriorityLabel = (priority: TriageSeverity) => ({ RED: copy.critical, YELLOW: copy.urgent, GREEN: copy.routine })[priority];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
          {language !== 'en' && <Text style={styles.headerSubtitle}>{copy.languageGap}</Text>}
          <Text style={styles.headerSubtitle}>{connected ? copy.backendNotice : copy.notConnected}</Text>
          <Text style={styles.headerSubtitle}>{copy.facilityId}</Text>
          <TextInput style={styles.facilityInput} value={facilityInput} onChangeText={setFacilityInput}
            autoCapitalize="none" placeholder={copy.facilityPlaceholder} />
          <TouchableOpacity accessibilityRole="button" disabled={!connected || !facilityInput.trim() || refreshing}
            onPress={() => { if (facilityInput.trim() === facilityId) void onRefresh(); else setFacilityId(facilityInput.trim()); }}>
            <Text style={styles.patientName}>{refreshing ? copy.loading : copy.retry}</Text>
          </TouchableOpacity>
          {connected && !facilityId && <Text style={styles.headerSubtitle}>{copy.chooseFacility}</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!!error && updatedAt !== null && <Text style={styles.error}>{copy.stale}</Text>}
          {updatedAt !== null && <Text style={styles.headerSubtitle}>{copy.facilityId}: {facilityId}. {copy.updated} {new Date(updatedAt).toLocaleTimeString('en-IN')}</Text>}
        </View>

        {updatedAt !== null && <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{queue.length}</Text>
            <Text style={styles.statLabel}>{copy.inQueue}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {queue.filter((q) => q.priority === 'RED').length}
            </Text>
            <Text style={styles.statLabel}>{copy.critical}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {queue.length > 0 ? Math.max(...queue.map(q => q.estimatedWaitMinutes)) : 0}m
            </Text>
            <Text style={styles.statLabel}>{copy.maxWait}</Text>
          </View>
        </View>}

        {updatedAt !== null && !error && queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{copy.emptySubtitle}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {queue.map((entry) => {
              const isHighlighted = highlightedToken === entry.appointmentId;
              const waitTime = entry.estimatedWaitMinutes;

              return (
                <Animated.View
                  key={entry.appointmentId}
                  style={[
                    styles.queueCard,
                    isHighlighted && styles.highlightedCard,
                    entry.priority === 'RED' && styles.redCard,
                  ]}
                >
                  <View style={styles.positionBadge}>
                    <Animated.Text style={[
                      styles.positionText,
                      isHighlighted && styles.highlightedText,
                    ]}>
                      #{entry.position}
                    </Animated.Text>
                    {entry.priority === 'RED' && (
                      <Animated.View style={[
                        styles.priorityPulse,
                        isHighlighted && styles.activePulse,
                      ]} />
                    )}
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.patientInfo}>
                      <Text style={styles.patientName}>{entry.patientName}</Text>
                      <View style={styles.metaRow}>
                        <View style={[styles.priorityChip, { backgroundColor: PRIORITY_COLORS[entry.priority] }]}>
                          <Text style={styles.priorityChipText}>
                            {getPriorityLabel(entry.priority)}
                          </Text>
                        </View>
                        <Text style={styles.waitTime}>
                          {copy.estimatedWait.replace('{time}', String(waitTime))}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tokenDisplay}>
                      <Text style={styles.tokenLabel}>{copy.tokenLabel}</Text>
                      <Text style={styles.tokenValue}>{entry.tokenNumber ?? copy.unknownToken}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {copy.position.replace('{pos}', String(entry.position))}
                    </Text>
                    <Text style={styles.metaText}>
                      {copy.estCallTime.replace('{time}', new Date((updatedAt ?? 0) + waitTime * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  facilityInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, color: COLORS.textPrimary },
  error: { color: COLORS.danger },
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.lg },
  header: { gap: theme.spacing.xs, paddingTop: theme.spacing.md },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerSubtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, alignItems: 'center', ...theme.shadows.sm },
  statValue: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl, gap: theme.spacing.md },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.sm },
  emptyTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textSecondary },
  emptySubtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, textAlign: 'center' },
  list: { gap: theme.spacing.md },
  queueCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  highlightedCard: {
    borderWidth: 3,
    borderColor: COLORS.warning,
    backgroundColor: '#FFFEF0',
  },
  redCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  positionBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  positionText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: theme.typography.fontSize.lg,
  },
  highlightedText: {
    color: COLORS.warning,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  priorityPulse: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.danger,
    opacity: 0,
  },
  activePulse: {
    opacity: 1,
  },
  cardContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  patientInfo: { flex: 1 },
  patientName: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xs, flexWrap: 'wrap' },
  priorityChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  priorityChipText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  waitTime: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  tokenDisplay: { alignItems: 'flex-end', paddingLeft: theme.spacing.md },
  tokenLabel: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  tokenValue: { fontSize: theme.typography.fontSize['2xl'], fontWeight: '800', color: COLORS.primary },
  metaText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
});
