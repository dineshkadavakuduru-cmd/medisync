import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';

interface SessionDetail {
  id: string;
  patientName: string;
  doctorName: string;
  scheduledTime: string;
  status: string;
  meetingLink: string;
}

export const TeleconsultJoinScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { sessionId } = route.params;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callActive) {
      interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const loadSession = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/teleconsult/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) setSession(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartCall = async () => {
    setCallActive(true);
    await fetch(`http://localhost:3001/api/teleconsult/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
  };

  const handleEndCall = async () => {
    setCallActive(false);
    await fetch(`http://localhost:3001/api/teleconsult/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    navigation.goBack();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loading}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {callActive ? (
          <View style={styles.callContainer}>
            <View style={styles.callHeader}>
              <Text style={styles.callTimer}>{formatDuration(callDuration)}</Text>
              <Text style={styles.callStatus}>Call in progress</Text>
            </View>

            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoIcon}>📹</Text>
              <Text style={styles.videoText}>Video consultation with Dr. {session.doctorName}</Text>
              <Text style={styles.videoSubtext}>Patient: {session.patientName}</Text>
            </View>

            <View style={styles.callControls}>
              <TouchableOpacity style={styles.controlButton}>
                <Text style={styles.controlIcon}>🎤</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={handleEndCall}>
                <Text style={styles.controlIcon}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton}>
                <Text style={styles.controlIcon}>📷</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.preCallContainer}>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionLabel}>Patient</Text>
              <Text style={styles.sessionValue}>{session.patientName}</Text>
            </View>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionLabel}>Doctor</Text>
              <Text style={styles.sessionValue}>Dr. {session.doctorName}</Text>
            </View>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionLabel}>Scheduled</Text>
              <Text style={styles.sessionValue}>
                {new Date(session.scheduledTime).toLocaleString()}
              </Text>
            </View>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionLabel}>Status</Text>
              <Text style={[styles.sessionValue, { color: COLORS.primary }]}>{session.status}</Text>
            </View>

            <TouchableOpacity style={styles.startCallButton} onPress={handleStartCall}>
              <Text style={styles.startCallText}>Start Consultation</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: COLORS.textSecondary },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.lg },
  callContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.xl },
  callHeader: { alignItems: 'center', marginBottom: theme.spacing.xl },
  callTimer: { fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  callStatus: { fontSize: theme.typography.fontSize.md, color: COLORS.success, marginTop: theme.spacing.xs },
  videoPlaceholder: { width: '100%', height: 300, backgroundColor: '#1a1a1a', borderRadius: theme.borderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xl },
  videoIcon: { fontSize: 64, marginBottom: theme.spacing.md },
  videoText: { color: '#fff', fontSize: theme.typography.fontSize.lg, fontWeight: '600' },
  videoSubtext: { color: '#aaa', fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.xs },
  callControls: { flexDirection: 'row', gap: theme.spacing.lg },
  controlButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadows.md },
  endCallButton: { backgroundColor: COLORS.danger },
  controlIcon: { fontSize: 24 },
  preCallContainer: { gap: theme.spacing.md },
  sessionCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  sessionLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginBottom: 2 },
  sessionValue: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: COLORS.textPrimary },
  startCallButton: { backgroundColor: COLORS.success, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', marginTop: theme.spacing.lg },
  startCallText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
});
