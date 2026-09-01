import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';

interface QueueEntry {
  appointmentId: string;
  patientName: string;
  priority: TriageSeverity;
  position: number;
  estimatedWaitMinutes: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  RED: COLORS.danger,
  YELLOW: COLORS.warning,
  GREEN: COLORS.success,
};

export const QueueScreen: React.FC = () => {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadQueue = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/appointments/queue/facility-2');
      const data = await res.json();
      setQueue(data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadQueue();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Facility Queue</Text>
          <Text style={styles.headerSubtitle}>Mulshi PHC — Live patient queue</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{queue.length}</Text>
            <Text style={styles.statLabel}>In Queue</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{queue.filter((q) => q.priority === 'RED').length}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {queue.length > 0 ? Math.max(...queue.map((q) => q.estimatedWaitMinutes)) : 0}m
            </Text>
            <Text style={styles.statLabel}>Max Wait</Text>
          </View>
        </View>

        {queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Queue is empty</Text>
            <Text style={styles.emptySubtitle}>No patients currently waiting</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {queue.map((entry) => (
              <View key={entry.appointmentId} style={styles.queueCard}>
                <View style={styles.positionBadge}>
                  <Text style={styles.positionText}>#{entry.position}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.patientName}>{entry.patientName}</Text>
                  <Text style={styles.waitTime}>~{entry.estimatedWaitMinutes} min wait</Text>
                </View>
                <View style={[styles.priorityIndicator, { backgroundColor: PRIORITY_COLORS[entry.priority] }]} />
              </View>
            ))}
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
  queueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  positionBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  positionText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: theme.typography.fontSize.md },
  cardContent: { flex: 1 },
  patientName: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: COLORS.textPrimary },
  waitTime: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  priorityIndicator: { width: 4, height: 40, borderRadius: 2 },
});
