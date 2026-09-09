import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { patientClient } from '../services/patientClient';
import type { JourneyPatient } from '../services/patientHelpers';
import { syncService } from '../services/syncService';
import { initDemoMode, isDemoActive, onDemoModeChange } from '../services/demoMode';
import { useTranslation } from '../i18n';
import { patientJourney, patientJourneyError, PatientJourneyError } from '../i18n/patientJourney';

const FILTERS = ['all', 'recent'] as const;

export const PatientsScreen: React.FC = () => {
  const { t, language } = useTranslation();
  const copy = patientJourney[language];
  const navigation = useNavigation<NavigationProp<{ PatientDetail: { patientId: string } }>>();
  const [patients, setPatients] = useState<JourneyPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [demo, setDemo] = useState(isDemoActive);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(patientClient.getPendingPatients);
  const [refresh, setRefresh] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formGender, setFormGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [formVillage, setFormVillage] = useState('');
  const [formAbhaId, setFormAbhaId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formTrimester, setFormTrimester] = useState('');
  const [formLastVisit, setFormLastVisit] = useState('');
  const [formNextVisit, setFormNextVisit] = useState('');
  const [formLanguage, setFormLanguage] = useState<'en' | 'hi' | 'mr'>('mr');

  useEffect(() => {
    let active = true;
    void initDemoMode().then(() => { if (active) { setDemo(isDemoActive()); setReady(true); } }).catch(e => { if (active) { setError(e); setLoading(false); } });
    const stopMode = onDemoModeChange(() => { setDemo(isDemoActive()); setShowAddModal(false); });
    const stopQueue = syncService.subscribe(() => {
      setPending(patientClient.getPendingPatients());
      if (!syncService.isSyncing()) setRefresh(value => value + 1);
    });
    const stopFocus = navigation.addListener('focus', () => setRefresh(value => value + 1));
    return () => { active = false; stopMode(); stopQueue(); stopFocus(); };
  }, [navigation]);

  useEffect(() => {
    if (!ready || demo) return;
    let active = true;
    void syncService.init().catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [ready, demo]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setPatients([]);
    setError('');
    void patientClient.getPatients(demo ? 'demo' : 'live').then(data => {
      if (active) setPatients(data);
    }).catch(e => { if (active) setError(e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, demo, refresh]);

  const filtered = patients.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.abhaId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.village.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'recent') return new Date(p.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return true;
  });

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  const openAddModal = () => {
    setFormName('');
    setFormAge('');
    setFormGender('');
    setFormVillage('');
    setFormAbhaId('');
    setFormPhone('');
    setFormDistrict('');
    setFormTrimester('');
    setFormLastVisit('');
    setFormNextVisit('');
    setFormLanguage('mr');
    setSaveError('');
    setShowAddModal(true);
  };

  const handleSavePatient = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (!/^\d+$/.test(formAge.trim())) throw new PatientJourneyError('ageError');
      if (!formGender) throw new PatientJourneyError('genderError');
      if (demo !== isDemoActive()) throw new PatientJourneyError('modeError');
      await patientClient.createPatient({
        abhaId: formAbhaId, name: formName, age: Number(formAge), gender: formGender,
        phone: formPhone, village: formVillage, district: formDistrict, languagePreference: formLanguage,
        ...(formTrimester.trim() ? { trimester: Number(formTrimester) } : {}),
        ...(formLastVisit.trim() ? { lastVisit: formLastVisit.trim() } : {}),
        ...(formNextVisit.trim() ? { nextVisitDate: formNextVisit.trim() } : {}),
      }, demo ? 'demo' : 'live');
      setShowAddModal(false);
      setRefresh(value => value + 1);
    } catch (e) { setSaveError(e); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="account-group-outline" size={64} color={COLORS.textSecondary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{t('patients.noPatientsFound')}</Text>
      <Text style={styles.emptySubtitle}>{t('patients.addFirstPatient')}</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={openAddModal}>
        <MaterialCommunityIcons name="plus" size={20} color={COLORS.textOnPrimary} />
        <Text style={styles.emptyButtonText}>{t('patients.addPatient')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('patients.title')}</Text>
          <Text style={styles.headerSubtitle}>{demo ? copy.demoSource : copy.liveSource}</Text>
        </View>
        <TouchableOpacity style={styles.headerAddButton} disabled={!ready} onPress={openAddModal}>
          <Text style={styles.headerAddText}>+ {t('patients.addPatient')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('patients.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
              {t(`patients.${filter}` as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={() => setRefresh(value => value + 1)}
        ListHeaderComponent={<View>
          {loading && <Text style={styles.emptySubtitle}>{t('common.loading')}</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.emptySubtitle}>{patientJourneyError(error, language, 'loadError')} {copy.noFallback}</Text>}
          <TouchableOpacity onPress={() => setRefresh(value => value + 1)}><Text style={styles.filterText}>{copy.refreshPatients}</Text></TouchableOpacity>
          {!demo && pending.length > 0 && <View style={styles.formField}>
            <Text style={styles.emptyTitle}>{copy.pendingHeading}</Text>
            {pending.map(action => <View key={action.id} style={styles.patientCard}>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{String(action.payload.name || copy.patient)}</Text>
                <Text style={styles.patientMeta}>{copy.localAction}: {action.id}</Text>
                <Text style={styles.patientMeta}>{copy[action.status]}{action.error ? `: ${copy.syncError}` : ''}</Text>
                <Text style={styles.patientMeta}>{copy.pendingHint}</Text>
              </View>
            </View>)}
            <TouchableOpacity disabled={syncService.isSyncing()} onPress={() => { void syncService.syncAll().catch(e => setError(e)); }}>
              <Text style={styles.filterText}>{copy.retrySync}</Text>
            </TouchableOpacity>
          </View>}
        </View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.patientCard} onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })} activeOpacity={0.7}>
            <View style={styles.patientLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.patientMeta} numberOfLines={1}>
                  {item.age} {copy.years} • {copy[item.gender]} • {item.village}
                </Text>
              </View>
            </View>
            <View style={styles.abhaBadge}>
              <Text style={styles.abhaLabel}>{item.abhaId ? copy.abha : copy.localId}</Text>
              <Text style={styles.abhaId} numberOfLines={1}>{item.abhaId || item.id}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading && !error ? <EmptyState /> : null}
      />

      <Modal visible={showAddModal} animationType="slide" transparent={true} onRequestClose={() => { if (!saving) setShowAddModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('patients.addPatient')}</Text>
            <TouchableOpacity disabled={saving} onPress={() => setShowAddModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.name}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={copy.name}
                accessibilityLabel={copy.name}
                value={formName}
                onChangeText={setFormName}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.age}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={copy.age}
                accessibilityLabel={copy.age}
                keyboardType="numeric"
                value={formAge}
                onChangeText={setFormAge}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.gender}</Text>
              <View style={styles.genderRow}>
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderButton, formGender === g && styles.genderButtonActive]}
                    onPress={() => setFormGender(g)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderButtonText, formGender === g && styles.genderButtonTextActive]}>
                      {copy[g]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.village}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={copy.village}
                accessibilityLabel={copy.village}
                value={formVillage}
                onChangeText={setFormVillage}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.abhaOptional}</Text>
              <View style={styles.abhaRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder={copy.abhaHint}
                  accessibilityLabel={copy.abhaOptional}
                  value={formAbhaId}
                  onChangeText={setFormAbhaId}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.phone}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={copy.phone}
                accessibilityLabel={copy.phone}
                keyboardType="phone-pad"
                value={formPhone}
                onChangeText={setFormPhone}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            {[
              { label: copy.district, value: formDistrict, change: setFormDistrict },
              { label: copy.trimesterInput, value: formTrimester, change: setFormTrimester },
              { label: copy.lastVisitInput, value: formLastVisit, change: setFormLastVisit },
              { label: copy.nextVisitInput, value: formNextVisit, change: setFormNextVisit },
            ].map(field => <View key={field.label} style={styles.formField}>
              <Text style={styles.formLabel}>{field.label}</Text>
              <TextInput accessibilityLabel={field.label} style={styles.formInput} value={field.value} onChangeText={field.change} />
            </View>)}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{copy.language}</Text>
              <View style={styles.genderRow}>
                {(['en', 'hi', 'mr'] as const).map(value => <TouchableOpacity key={value}
                  style={[styles.genderButton, formLanguage === value && styles.genderButtonActive]} onPress={() => setFormLanguage(value)}>
                  <Text style={[styles.genderButtonText, formLanguage === value && styles.genderButtonTextActive]}>{copy[value]}</Text>
                </TouchableOpacity>)}
              </View>
            </View>
            {!!saveError && <Text accessibilityRole="alert" style={styles.emptySubtitle}>{patientJourneyError(saveError, language, 'saveError')}</Text>}
            <Text style={styles.formLabel}>{demo ? copy.demoSave : copy.liveSave}</Text>
            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                (!formName.trim() || !formAge.trim() || !formGender || !formVillage.trim() || !formPhone.trim()) && styles.modalSaveButtonDisabled,
              ]}
              onPress={handleSavePatient}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveText}>{saving ? copy.saving : t('common.save')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
  },
  headerAddButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  headerAddText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.layout.screenPadding,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingRight: 48,
  },
  searchIcon: {
    position: 'absolute',
    right: theme.layout.screenPadding + theme.spacing.lg,
  },
  filterScroll: {
    flexGrow: 0,
    height: 42,
    marginBottom: theme.spacing.sm,
  },
  filterRow: {
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.textOnPrimary,
  },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  patientCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.sm,
  },
  patientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
    paddingRight: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.primary,
  },
  patientInfo: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  patientName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  patientMeta: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  abhaBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'flex-end',
    minWidth: 100,
    maxWidth: 130,
  },
  abhaLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  abhaId: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxWidth: 120,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyIcon: {
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
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  emptyButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  modalBody: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.layout.screenPadding,
    gap: theme.spacing.md,
  },
  formField: {
    gap: theme.spacing.xs,
  },
  formLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  genderRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  genderButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  genderButtonTextActive: {
    color: COLORS.textOnPrimary,
  },
  abhaRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  abhaGenerateButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  abhaGenerateText: {
    color: COLORS.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.md,
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
});
