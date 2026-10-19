import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { teleconsultClient, TeleconsultSession, TeleconsultDoctor } from '../services/teleconsultClient';
import { teleconsultCopy as copy } from '../i18n/translations/teleconsult';
import { useTranslation } from '../i18n';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';
import { getActivePersona } from '../services/personas';

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

  const [showRequest, setShowRequest] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestDoctors, setRequestDoctors] = useState<TeleconsultDoctor[]>([]);
  const [requestDoctorId, setRequestDoctorId] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [requestSlots, setRequestSlots] = useState<string[]>([]);
  const [requestError, setRequestError] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestLoadingDoctors, setRequestLoadingDoctors] = useState(false);
  const [requestLoadingSlots, setRequestLoadingSlots] = useState(false);
  const requestLock = useRef(false);
  const requestSlotVersion = useRef(0);

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

  const openRequest = () => {
    setShowRequest(true);
    setRequestError('');
    setRequestBusy(false);
    setRequestName(getActivePersona().name);
    setRequestDoctorId('');
    setRequestDate('');
    setRequestTime('');
    setRequestSlots([]);
  };

  useEffect(() => {
    if (!showRequest) return;
    const currentMode = modeVersion.current;
    let cancelled = false;
    setRequestDoctors([]);
    setRequestError('');
    setRequestLoadingDoctors(true);
    teleconsultClient.listDoctors().then(data => {
      if (!cancelled && currentMode === modeVersion.current) setRequestDoctors(data);
    }).catch(e => {
      if (!cancelled && currentMode === modeVersion.current) setRequestError(e instanceof Error ? e.message : copy.requestFailed);
    }).finally(() => {
      if (!cancelled && currentMode === modeVersion.current) setRequestLoadingDoctors(false);
    });
    return () => { cancelled = true; };
  }, [showRequest, isDemo]);

  useEffect(() => {
    const version = ++requestSlotVersion.current;
    setRequestTime('');
    setRequestSlots([]);
    setRequestLoadingSlots(false);
    if (!showRequest || !requestDoctorId || !requestDate) return;
    setRequestLoadingSlots(true);
    teleconsultClient.getAvailableSlots(requestDoctorId, requestDate).then(slots => {
      if (version === requestSlotVersion.current) setRequestSlots(slots);
    }).catch(e => {
      if (version === requestSlotVersion.current) setRequestError(e instanceof Error ? e.message : copy.requestFailed);
    }).finally(() => {
      if (version === requestSlotVersion.current) setRequestLoadingSlots(false);
    });
    return () => { requestSlotVersion.current += 1; };
  }, [showRequest, requestDoctorId, requestDate]);

  const next14Days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: date.getDate(),
    };
  });

  const submitRequest = async () => {
    if (requestLock.current || !active.current) return;
    const doctor = requestDoctors.find(d => d.id === requestDoctorId);
    if (!requestName.trim() || !doctor || !requestDate || !requestTime) {
      setRequestError(copy.requestFillAll);
      return;
    }
    requestLock.current = true;
    const currentMode = modeVersion.current;
    setRequestBusy(true);
    setRequestError('');
    try {
      const session = await teleconsultClient.create({
        patientName: requestName.trim(),
        patientId: `patient-${getActivePersona().role.toLowerCase()}`,
        fromFacilityId: doctor.facilityId,
        doctorId: doctor.id,
        scheduledTime: `${requestDate}T${requestTime}:00+05:30`,
      });
      if (!active.current || currentMode !== modeVersion.current) return;
      setShowRequest(false);
      await loadSessions();
      if (active.current && currentMode === modeVersion.current) {
        navigation.navigate('TeleconsultJoin', { sessionId: session.id });
      }
    } catch (e) {
      if (active.current && currentMode === modeVersion.current) {
        setRequestError(e instanceof Error ? e.message : copy.requestFailed);
      }
    } finally {
      if (currentMode === modeVersion.current) {
        requestLock.current = false;
        if (active.current) setRequestBusy(false);
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

        {isDemo && <Text style={styles.notice}>{copy.demo}</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={creating} style={styles.action} onPress={openRequest}>
          <Text style={styles.actionText}>{copy.newRequest}</Text>
        </TouchableOpacity>
        {isDemo && (
          <TouchableOpacity accessibilityRole="button" disabled={creating} style={[styles.action, styles.secondaryAction]} onPress={createDemo}>
            <Text style={[styles.actionText, styles.secondaryActionText]}>{creating ? copy.loading : copy.create}</Text>
          </TouchableOpacity>
        )}

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
                    {formatDate(session.scheduledTime)} â€¢ {formatTimeStr(session.scheduledTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showRequest} animationType="slide" transparent={true} onRequestClose={() => { if (!requestBusy) setShowRequest(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{copy.requestTitle}</Text>
              <TouchableOpacity disabled={requestBusy} style={styles.modalClose} onPress={() => setShowRequest(false)}>
                <Text style={styles.modalCloseText}>âœ•</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.requestContent}>
              {isDemo && <Text style={styles.notice}>{copy.requestDemoNote}</Text>}
              {!!requestError && <Text accessibilityRole="alert" style={styles.errorText}>{requestError}</Text>}

              <Text style={styles.label}>{copy.requestPatientName}</Text>
              <TextInput style={styles.input} value={requestName} editable={!requestBusy} onChangeText={setRequestName} placeholder={copy.requestPatientName} />

              <Text style={styles.label}>{copy.requestClinician}</Text>
              {requestLoadingDoctors && <Text style={styles.noSlots}>{copy.requestLoadingDoctors}</Text>}
              {!requestLoadingDoctors && !requestDoctors.length && <Text style={styles.noSlots}>{copy.requestNoDoctors}</Text>}
              <View style={styles.doctorList}>
                {requestDoctors.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    disabled={requestBusy}
                    style={[styles.doctorCard, requestDoctorId === doc.id && styles.doctorCardActive]}
                    onPress={() => { requestSlotVersion.current += 1; setRequestDoctorId(doc.id); setRequestTime(''); setRequestSlots([]); }}
                  >
                    <Text style={styles.doctorName}>{doc.name}</Text>
                    <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{copy.requestDate}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.requestDateRow}>
                {next14Days.map((day) => (
                  <TouchableOpacity
                    key={day.date}
                    disabled={requestBusy}
                    style={[styles.dayCell, requestDate === day.date && styles.dayCellSelected]}
                    onPress={() => { requestSlotVersion.current += 1; setRequestDate(day.date); setRequestTime(''); setRequestSlots([]); }}
                  >
                    <Text style={[styles.dayName, requestDate === day.date && styles.dayNameSelected]}>{day.dayName}</Text>
                    <Text style={[styles.dayNum, requestDate === day.date && styles.dayNumSelected]}>{day.dayNum}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>{copy.requestTime}</Text>
              {requestLoadingSlots && <Text style={styles.noSlots}>{copy.requestLoadingSlots}</Text>}
              {!requestLoadingSlots && requestDate && requestDoctorId && !requestSlots.length && <Text style={styles.noSlots}>{copy.requestNoSlots}</Text>}
              <View style={styles.timeGrid}>
                {requestSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    disabled={requestBusy}
                    style={[styles.timeSlot, requestTime === slot && styles.timeSlotActive]}
                    onPress={() => setRequestTime(slot)}
                  >
                    <Text style={[styles.timeText, requestTime === slot && styles.timeTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.action, requestBusy && styles.disabled]} disabled={requestBusy} onPress={submitRequest}>
                <Text style={styles.actionText}>{requestBusy ? copy.requesting : copy.requestSubmit}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  secondaryAction: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  secondaryActionText: { color: COLORS.primary },
  disabled: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  input: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  errorText: { color: COLORS.danger, fontSize: 13, lineHeight: 20 },
  doctorList: { gap: 8 },
  doctorCard: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  doctorCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  doctorSpecialty: { fontSize: 13, color: COLORS.textSecondary },
  requestContent: { gap: theme.spacing.md },
  requestDateRow: { gap: 8, paddingVertical: 4 },
  dayCell: { width: 56, height: 64, backgroundColor: COLORS.surface, borderRadius: 10, padding: 6, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border },
  dayCellSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  dayNameSelected: { color: COLORS.textOnPrimary },
  dayNum: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  dayNumSelected: { color: COLORS.textOnPrimary },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlot: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  timeSlotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, color: COLORS.textSecondary },
  timeTextActive: { color: COLORS.textOnPrimary, fontWeight: '600' },
  noSlots: { color: COLORS.textSecondary, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '700' },
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
