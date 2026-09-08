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

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: COLORS.warning,
  ACCEPTED: COLORS.info,
  IN_PROGRESS: COLORS.success,
  COMPLETED: COLORS.textSecondary,
  DECLINED: COLORS.danger,
  CANCELLED: COLORS.textSecondary,
};

export const TeleconsultListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [sessions, setSessions] = useState<TeleconsultSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
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
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
        </View>
        {teleconsultClient.isDemo && <>
          <Text style={styles.notice}>{copy.demo}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={creating} style={styles.action} onPress={createDemo}>
            <Text style={styles.actionText}>{creating ? copy.loading : copy.create}</Text>
          </TouchableOpacity>
        </>}
        <Text style={styles.notice}>{copy.roles}</Text>
        {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.danger }}>{error}</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={refreshing} onPress={onRefresh} style={styles.action}>
          <Text style={styles.actionText}>{refreshing ? copy.loading : copy.retry}</Text>
        </TouchableOpacity>

        {sessions.length === 0 && !refreshing && !error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{copy.empty}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sessions.map((session) => (
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
                <Text style={styles.doctorName}>{session.doctorName}</Text>
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
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs },
  patientName: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  doctorName: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, marginBottom: 2 },
  time: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  notice: { backgroundColor: '#EAF3F2', color: '#234B47', padding: 14, borderRadius: 10, lineHeight: 21 },
  action: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '600' },
});
