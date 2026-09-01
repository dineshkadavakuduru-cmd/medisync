import React, { useEffect, useState } from 'react';
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
import { useTranslation } from '../i18n';

interface TeleconsultSession {
  id: string;
  patientName: string;
  doctorName: string;
  scheduledTime: string;
  status: string;
  meetingLink: string;
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: COLORS.warning,
  ACCEPTED: COLORS.info,
  IN_PROGRESS: COLORS.success,
  COMPLETED: COLORS.textSecondary,
  DECLINED: COLORS.danger,
  CANCELLED: COLORS.textSecondary,
};

export const TeleconsultListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<TeleconsultSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/teleconsult/sessions');
      const data = await res.json();
      setSessions(data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Teleconsultation</Text>
          <Text style={styles.headerSubtitle}>Remote specialist consultations</Text>
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📹</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtitle}>Teleconsultation sessions will appear here</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.card}
                onPress={() => navigation.navigate('TeleconsultJoin', { sessionId: session.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.patientName}>{session.patientName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[session.status] || COLORS.textSecondary }]}>
                    <Text style={styles.statusText}>{session.status}</Text>
                  </View>
                </View>
                <Text style={styles.doctorName}>Dr. {session.doctorName}</Text>
                <Text style={styles.time}>{formatTime(session.scheduledTime)}</Text>
              </TouchableOpacity>
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
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl, gap: theme.spacing.md },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.sm, opacity: 0.4 },
  emptyTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textSecondary },
  emptySubtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, textAlign: 'center' },
  list: { gap: theme.spacing.md },
  card: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs },
  patientName: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  doctorName: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, marginBottom: 2 },
  time: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
});
