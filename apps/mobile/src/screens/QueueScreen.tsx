import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Animated,
} from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { queueScreenCopy as copy } from '../i18n/translations/queueScreen';

interface QueueEntry {
  appointmentId: string;
  patientId: string;
  patientName: string;
  priority: TriageSeverity;
  position: number;
  estimatedWaitMinutes: number;
  tokenNumber: string;
  checkedInAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  RED: COLORS.danger,
  YELLOW: COLORS.warning,
  GREEN: COLORS.success,
};

const PRIORITY_LABELS: Record<string, string> = {
  RED: 'Critical',
  YELLOW: 'Urgent',
  GREEN: 'Routine',
};

export const QueueScreen: React.FC = () => {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);

  const loadQueue = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/appointments/queue/facility-2');
      const data = await res.json();
      const newQueue = (data.data || []).map((q: any, idx: number) => ({
        ...q,
        position: idx + 1,
        tokenNumber: q.tokenNumber || `T${String(idx + 1).padStart(3, '0')}`,
      }));

      // Check for new RED entries that need animation
      if (queue.length > 0) {
        const prevRedTokens = new Set(queue.filter(q => q.priority === 'RED').map(q => q.tokenNumber));
        const newRedTokens = new Set(newQueue.filter(q => q.priority === 'RED').map(q => q.tokenNumber));
        const addedRedTokens = Array.from(newRedTokens).filter(t => !prevRedTokens.has(t));
        if (addedRedTokens.length > 0) {
          setHighlightedToken(addedRedTokens[0]);
          setTimeout(() => setHighlightedToken(null), 3000);
        }
      }

      setQueue(newQueue);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadQueue();
    setRefreshing(false);
  };

  const getWaitTimeEstimate = (entry: QueueEntry) => {
    // Calculate based on position and average consultation time
    const avgConsultTime = 15; // minutes
    const priorityBuffer = entry.priority === 'RED' ? 0 : entry.priority === 'YELLOW' ? 5 : 15;
    return Math.max(0, (entry.position - 1) * avgConsultTime + priorityBuffer);
  };

  const getPriorityLabel = (priority: TriageSeverity) => PRIORITY_LABELS[priority];

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

        <View style={styles.statsRow}>
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
              {queue.length > 0 ? Math.max(...queue.map(getWaitTimeEstimate)) : 0}m
            </Text>
            <Text style={styles.statLabel}>{copy.maxWait}</Text>
          </View>
        </View>

        {queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{copy.emptySubtitle}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {queue.map((entry, index) => {
              const isHighlighted = highlightedToken === entry.tokenNumber;
              const waitTime = getWaitTimeEstimate(entry);

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
                      #{entry.tokenNumber}
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
                          {t('queue.estimatedWait', { time: waitTime })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tokenDisplay}>
                      <Text style={styles.tokenLabel}>{copy.tokenLabel}</Text>
                      <Text style={styles.tokenValue}>{entry.tokenNumber}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {t('queue.position', { pos: entry.position })}
                    </Text>
                    <Text style={styles.metaText}>
                      {t('queue.estCallTime', {
                        time: new Date(Date.now() + waitTime * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      })}
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

export { QueueScreen };