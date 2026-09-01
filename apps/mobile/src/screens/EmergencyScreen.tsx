import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { EmergencyCard } from '../components/EmergencyCard';
import { api } from '../services/api';
import { useTranslation } from '../i18n';
import { isDemoActive } from '../services/demoMode';

interface Emergency {
  id: string;
  patientId?: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  condition: string;
  description: string;
  protocolLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  status: 'INITIATED' | 'ACKNOWLEDGED' | 'AMBULANCE_DISPATCHED' | 'AMBULANCE_EN_ROUTE' | 'PATIENT_PICKED_UP' | 'EN_ROUTE_TO_HOSPITAL' | 'ARRIVED' | 'UNDER_TREATMENT' | 'RESOLVED' | 'ESCALATED';
  originFacilityId: string;
  createdAt: string;
  initiatedBy: string;
  timeline: any[];
  firstAidSteps: string[];
}

const EMERGENCY_CONTACTS = [
  { label: 'ambulance', number: '108', icon: '🚑', color: COLORS.emergency },
  { label: 'districtHospital', number: '020-24440000', icon: '🏥', color: COLORS.primary },
  { label: 'onDutyDoctor', number: '020-24446666', icon: '👨‍⚕️', color: COLORS.info },
  { label: 'districtOfficer', number: '9876543210', icon: '🏛️', color: COLORS.warning },
];

export const EmergencyScreen: React.FC = () => {
  const { t } = useTranslation();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sosScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadEmergencies();
    const interval = setInterval(loadEmergencies, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sosScale, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(sosScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [sosScale]);

  const loadEmergencies = async () => {
    try {
      const res = await api.getEmergencies('active');
      if (res.success) {
        setEmergencies(res.data || []);
      }
    } catch (e) {
      console.error(e);
      setEmergencies([
        {
          id: 'e1',
          patientId: 'p3',
          patientName: 'Baby of Sunita',
          patientAge: 2,
          patientGender: 'FEMALE',
          condition: 'Severe Dehydration',
          description: 'Vomiting and loose motion since morning',
          protocolLevel: 'LEVEL_2',
          status: 'AMBULANCE_EN_ROUTE',
          originFacilityId: 'f1',
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          initiatedBy: 'ashha-worker-1',
          timeline: [
            { id: 't1', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), event: 'Emergency Initiated', description: 'ASHA reported severe dehydration', automated: false },
            { id: 't2', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), event: 'Ambulance Dispatched', description: 'Ambulance A1 dispatched from PHC', automated: true },
          ],
          firstAidSteps: ['Keep baby hydrated with ORS', 'Do not give solid food', 'Keep warm and monitor breathing'],
        },
        {
          id: 'e2',
          patientId: 'p2',
          patientName: 'Ramesh Pawar',
          patientAge: 55,
          patientGender: 'MALE',
          condition: 'Chest Pain',
          description: 'Severe chest pain radiating to left arm',
          protocolLevel: 'LEVEL_1',
          status: 'ACKNOWLEDGED',
          originFacilityId: 'f2',
          createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          initiatedBy: 'doctor-2',
          timeline: [
            { id: 't3', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), event: 'Emergency Initiated', description: 'Doctor reported chest pain', automated: false },
            { id: 't4', timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), event: 'Acknowledged', description: 'District Hospital acknowledged', automated: true },
          ],
          firstAidSteps: ['Have patient sit down and rest', 'Loosen tight clothing', 'Monitor vitals until ambulance arrives'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyPress = (emergency: Emergency) => {
    // Navigate to detail screen
  };

  const simulateEmergency = async () => {
    try {
      await api.createEmergency({
        patientName: 'Demo Patient',
        patientAge: 55,
        patientGender: 'MALE',
        condition: 'Cardiac Arrest',
        description: 'Simulated emergency for demo mode',
        protocolLevel: 'LEVEL_1',
        originFacilityId: 'facility-1',
        initiatedBy: 'demo-user',
      });
      loadEmergencies();
    } catch (e) {
      console.error(e);
    }
  };

  const activeCount = emergencies.length;
  const demoActive = isDemoActive();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: pulseAnim }]}>
          <Text style={styles.headerTitle}>🚨 {t('emergency.title')}</Text>
          <View style={styles.activeBadge}>
            <Animated.View style={[styles.pulsingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.activeText}>{activeCount} {t('emergency.activeEmergencies')}</Text>
          </View>
        </Animated.View>
        <Text style={styles.subtitle}>{t('emergency.tapToInitiate')}</Text>

        {demoActive && (
          <TouchableOpacity style={styles.demoButton} onPress={simulateEmergency}>
            <Text style={styles.demoButtonText}>🔬 Simulate Emergency</Text>
          </TouchableOpacity>
        )}

        <View style={styles.sosSection}>
          <TouchableOpacity
            style={styles.sosButtonOuter}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.9}
          >
            <Animated.View style={[styles.sosButtonInner, { transform: [{ scale: sosScale }] }]}>
              <Text style={styles.sosText}>SOS</Text>
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.sosLabel}>{t('emergency.tapToInitiate')}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Animated.View style={[styles.sectionPulseDot, { opacity: pulseAnim }]} />
              <Text style={styles.sectionTitle}>{t('emergency.activeEmergencies')}</Text>
            </View>
          </View>
          {loading ? (
            <Text style={styles.noEmergencies}>{t('common.loading')}</Text>
          ) : activeCount === 0 ? (
            <View style={styles.noEmergenciesCard}>
              <Text style={styles.noEmergenciesIcon}>✅</Text>
              <Text style={styles.noEmergenciesTitle}>{t('emergency.allClear')}</Text>
              <Text style={styles.noEmergencies}>{t('emergency.noActiveEmergencies')}</Text>
            </View>
          ) : (
            <View style={styles.emergencyList}>
              {emergencies.map((emergency) => (
                <EmergencyCard key={emergency.id} emergency={emergency} onPress={() => handleEmergencyPress(emergency)} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('emergency.emergencyContacts')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactsScroll}>
            {EMERGENCY_CONTACTS.map((contact, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.contactCard, { borderLeftColor: contact.color }]}
                onPress={() => Linking.openURL(`tel:${contact.number}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.contactIcon}>{contact.icon}</Text>
                <Text style={styles.contactLabel}>{t(`emergency.${contact.label}` as any)}</Text>
                <Text style={styles.contactNumber}>{contact.number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('emergency.recentHistory')}</Text>
          <View style={styles.historyList}>
            <View style={styles.historyCard}>
              <Text style={styles.historyCondition}>Cardiac Arrest</Text>
              <Text style={styles.historyPatient}>Rajesh Patil, 55M</Text>
              <Text style={styles.historyTime}>Resolved 2h ago</Text>
              <View style={[styles.historyBadge, { backgroundColor: COLORS.success }]}>
                <Text style={styles.historyBadgeText}>12 min response</Text>
              </View>
            </View>
            <View style={styles.historyCard}>
              <Text style={styles.historyCondition}>Severe Dehydration</Text>
              <Text style={styles.historyPatient}>Baby of Sunita, 2F</Text>
              <Text style={styles.historyTime}>Resolved 5h ago</Text>
              <View style={[styles.historyBadge, { backgroundColor: COLORS.success }]}>
                <Text style={styles.historyBadgeText}>8 min response</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showCreateModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay} onTouchStart={() => setShowCreateModal(false)}>
          <View style={styles.modalContent} onTouchStart={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Declare Emergency</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalNote}>{t('common.noData')}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => { setShowCreateModal(false); }}>
              <Text style={styles.modalButtonText}>Go to Emergency Tab</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  scrollContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.emergency,
    flex: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFCDD2',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    gap: 6,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.emergency,
  },
  activeText: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.emergency,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: -theme.spacing.md,
  },
  demoButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  demoButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  sosSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  sosButtonOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(198, 40, 40, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.emergency,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  sosText: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.textOnPrimary,
    letterSpacing: 4,
  },
  sosLabel: {
    marginTop: theme.spacing.md,
    color: COLORS.textSecondary,
    fontSize: theme.typography.fontSize.sm,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.emergency,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  emergencyList: {
    gap: theme.spacing.md,
  },
  noEmergenciesCard: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  noEmergenciesIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  noEmergenciesTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.success,
  },
  noEmergencies: {
    color: COLORS.textSecondary,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  contactsScroll: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  contactCard: {
    width: 130,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderLeftWidth: 4,
    ...theme.shadows.sm,
  },
  contactIcon: {
    fontSize: 28,
  },
  contactLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  contactNumber: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  historyList: {
    gap: theme.spacing.md,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  historyCondition: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  historyPatient: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  historyTime: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
  historyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  historyBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: theme.layout.screenPadding,
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
  modalClose: {
    fontSize: theme.typography.fontSize.xl,
    color: COLORS.textSecondary,
  },
  modalBody: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  modalNote: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: COLORS.emergency,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  modalButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
});
