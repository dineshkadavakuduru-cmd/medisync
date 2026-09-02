import React, { useState, useEffect } from 'react';
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
import { COLORS, Patient as PatientType } from '@medisync/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

const FILTERS = ['all', 'recent', 'highRisk', 'referred'] as const;

const MOCK_PATIENTS: PatientType[] = [
  { id: 'p1', abhaId: 'ABHA-PN-2024-0001', name: 'Sunita Khade', age: 28, gender: 'FEMALE', phone: '9876543210', village: 'Khadki', district: 'Pune', languagePreference: 'mr', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'p2', abhaId: 'ABHA-PN-2024-0002', name: 'Ramesh Pawar', age: 55, gender: 'MALE', phone: '9765432109', village: 'Pimpri', district: 'Pune', languagePreference: 'mr', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'p3', abhaId: 'ABHA-PN-2024-0003', name: 'Anjali Deshmukh', age: 34, gender: 'FEMALE', phone: '9654321098', village: 'Chinchwad', district: 'Pune', languagePreference: 'hi', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'p4', abhaId: 'ABHA-PN-2024-0004', name: 'Vijay Shinde', age: 62, gender: 'MALE', phone: '9543210987', village: 'Hadapsar', district: 'Pune', languagePreference: 'mr', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'p5', abhaId: 'ABHA-PN-2024-0005', name: 'Priya More', age: 22, gender: 'FEMALE', phone: '9432109876', village: 'Bhosari', district: 'Pune', languagePreference: 'mr', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
];

const generateAbhaId = () => `ABHA-PN-2024-${String(Math.floor(Math.random() * 9000) + 1000)}`;

export const PatientsScreen: React.FC = () => {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<PatientType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formGender, setFormGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [formVillage, setFormVillage] = useState('');
  const [formAbhaId, setFormAbhaId] = useState('');
  const [formPhone, setFormPhone] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const response = await api.getPatients();
      setPatients(response.data || []);
    } catch (e) {
      console.error(e);
      setPatients(MOCK_PATIENTS);
    } finally {
      setLoading(false);
    }
  };

  const filtered = patients.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.abhaId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.village.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'recent') return new Date(p.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (activeFilter === 'highRisk') return p.village.length > 0;
    if (activeFilter === 'referred') return false;
    return true;
  });

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  const openAddModal = () => {
    setFormName('');
    setFormAge('');
    setFormGender('');
    setFormVillage('');
    setFormAbhaId(generateAbhaId());
    setFormPhone('');
    setShowAddModal(true);
  };

  const handleSavePatient = () => {
    if (!formName.trim() || !formAge.trim() || !formGender || !formVillage.trim() || !formPhone.trim()) {
      return;
    }
    const newPatient: PatientType = {
      id: `p${Date.now()}`,
      abhaId: formAbhaId || generateAbhaId(),
      name: formName.trim(),
      age: parseInt(formAge, 10) || 0,
      gender: formGender as PatientType['gender'],
      phone: formPhone.trim(),
      village: formVillage.trim(),
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date().toISOString(),
    };
    setPatients((prev) => [newPatient, ...prev]);
    setShowAddModal(false);
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
          <Text style={styles.headerSubtitle}>{t('patients.all')}</Text>
        </View>
        <TouchableOpacity style={styles.headerAddButton} onPress={openAddModal}>
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
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.patientCard} onPress={() => {}} activeOpacity={0.7}>
            <View style={styles.patientLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.patientMeta} numberOfLines={1}>
                  {item.age} yrs • {item.gender} • {item.village}
                </Text>
              </View>
            </View>
            <View style={styles.abhaBadge}>
              <Text style={styles.abhaLabel}>ABHA ID</Text>
              <Text style={styles.abhaId} numberOfLines={1}>{item.abhaId}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState />}
      />

      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay} onTouchStart={() => setShowAddModal(false)}>
          <View style={styles.modalContent} onTouchStart={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('patients.addPatient')}</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{t('patients.searchPlaceholder').replace('Search by ', '').replace('...', '')}</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Name"
                value={formName}
                onChangeText={setFormName}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Age</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Age"
                keyboardType="numeric"
                value={formAge}
                onChangeText={setFormAge}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderButton, formGender === g && styles.genderButtonActive]}
                    onPress={() => setFormGender(g)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderButtonText, formGender === g && styles.genderButtonTextActive]}>
                      {g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Village</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Village"
                value={formVillage}
                onChangeText={setFormVillage}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ABHA ID</Text>
              <View style={styles.abhaRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="ABHA ID"
                  value={formAbhaId}
                  onChangeText={setFormAbhaId}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity style={styles.abhaGenerateButton} onPress={() => setFormAbhaId(generateAbhaId())}>
                  <Text style={styles.abhaGenerateText}>Auto</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Phone"
                keyboardType="phone-pad"
                value={formPhone}
                onChangeText={setFormPhone}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                (!formName.trim() || !formAge.trim() || !formGender || !formVillage.trim() || !formPhone.trim()) && styles.modalSaveButtonDisabled,
              ]}
              onPress={handleSavePatient}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveText}>{t('common.save')} Patient</Text>
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
