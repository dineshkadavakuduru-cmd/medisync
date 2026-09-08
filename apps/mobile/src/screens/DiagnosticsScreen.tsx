import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
} from 'react-native';
import { COLORS, DiagnosticPriority, DiagnosticStatus, TestFlag } from '@medisync/shared';
import { theme } from '../styles/theme';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useTranslation } from '../i18n';
import { DiagnosticOrder, TestResult } from '@medisync/shared';
import { syncService, SyncAction } from '../services/syncService';
import { getActivePersona } from '../services/personas';
import { getRecommendedDiagnostics } from '../services/triageService';

interface DiagnosticsScreenProps {
  navigation: any;
}

export const DiagnosticsScreen: React.FC<DiagnosticsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [patientId, setPatientId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [priority, setPriority] = useState<DiagnosticPriority>('ROUTINE');
  const [notes, setNotes] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DiagnosticOrder | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const { data: testsCatalog, refetch: refetchCatalog } = useApi(() => api.getDiagnosticsTests?.() || Promise.resolve({ success: true, data: [] }));

  const { data: ordersData, refetch: refetchOrders } = useApi(() => api.getDiagnosticsOrders?.() || Promise.resolve({ success: true, data: [] }));

  useEffect(() => {
    if (ordersData?.success && ordersData.data) {
      setOrders(ordersData.data);
    }
  }, [ordersData]);

  const loadData = async () => {
    await refetchCatalog();
    await refetchOrders();
    setRefreshing(false);
  };

  const handleCreateOrder = async () => {
    if (!patientId || !facilityId || selectedTests.length === 0) return;

    const persona = getActivePersona();
    const newOrderData = {
      patientId,
      facilityId,
      tests: selectedTests,
      priority,
      orderedBy: persona.name,
      notes,
    };

    if (syncService.isOnline()) {
      try {
        const res = await api.createDiagnosticsOrder(newOrderData);
        if (res?.success && res.data) {
          setOrders(prev => [res.data!, ...prev]);
        }
      } catch (e) {
        console.error('Failed to create order online:', e);
      }
    } else {
      // Queue offline
      await syncService.enqueue({
        type: 'CREATE_DIAGNOSTIC_ORDER',
        payload: newOrderData,
        timestamp: Date.now(),
      });
    }

    setShowCreateModal(false);
    setPatientId('');
    setFacilityId('');
    setSelectedTests([]);
    setPriority('ROUTINE');
    setNotes('');
  };

  const handleAddResult = async (orderId: string, testCode: string, value: string, unit: string, flag: TestFlag, referenceRange?: string) => {
    if (syncService.isOnline()) {
      try {
        const res = await api.addDiagnosticsResult?.(orderId, testCode, value, unit, flag, referenceRange);
        if (res?.success && res.data) {
          setOrders(prev => prev.map(o => o.id === orderId ? res.data! : o));
          if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
        }
      } catch (e) {
        console.error('Failed to add result online:', e);
      }
    } else {
      await syncService.enqueue({
        type: 'ADD_DIAGNOSTIC_RESULT',
        payload: { orderId, testCode, value, unit, flag, referenceRange },
        timestamp: Date.now(),
      });
    }
  };

  const handleUpdateStatus = async (orderId: string, status: DiagnosticStatus) => {
    if (syncService.isOnline()) {
      try {
        const res = await api.updateDiagnosticsOrderStatus?.(orderId, status);
        if (res?.success && res.data) {
          setOrders(prev => prev.map(o => o.id === orderId ? res.data! : o));
          if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
        }
      } catch (e) {
        console.error('Failed to update status online:', e);
      }
    } else {
      await syncService.enqueue({
        type: 'UPDATE_DIAGNOSTIC_STATUS',
        payload: { orderId, status },
        timestamp: Date.now(),
      });
    }
  };

  const handleAutoCreateFromTriage = (triageId: string, symptoms: string[]) => {
    const persona = getActivePersona();
    const recommended = getRecommendedDiagnostics(symptoms);
    if (recommended.length > 0) {
      setSelectedTests(recommended);
      setPatientId('patient-1');
      setFacilityId(persona.facility);
      setPriority('URGENT');
      setShowCreateModal(true);
    }
  };

  const getStatusColor = (status: DiagnosticStatus) => {
    switch (status) {
      case 'ORDERED': return COLORS.info;
      case 'SAMPLE_COLLECTED': return COLORS.warning;
      case 'IN_PROGRESS': return COLORS.primary;
      case 'COMPLETED': return COLORS.success;
      case 'CANCELLED': return COLORS.textSecondary;
      default: return COLORS.textSecondary;
    }
  };

  const getFlagColor = (flag: TestFlag) => {
    switch (flag) {
      case 'NORMAL': return COLORS.severityGreen;
      case 'ABNORMAL': return COLORS.severityYellow;
      case 'CRITICAL': return COLORS.severityRed;
      default: return COLORS.textSecondary;
    }
  };

  const renderOrderCard = (order: DiagnosticOrder) => (
    <TouchableOpacity
      key={order.id}
      style={styles.orderCard}
      onPress={() => { setSelectedOrder(order); setShowOrderDetail(true); }}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderTitleRow}>
          <Text style={styles.orderId}>{order.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusText}>{t(`diagnostics.status.${order.status.toLowerCase()}`)}</Text>
          </View>
        </View>
        <View style={styles.orderMeta}>
          <Text style={styles.metaText}>{t('diagnostics.patient')}: {order.patientName}</Text>
          <Text style={styles.metaText}>{t('diagnostics.facility')}: {order.facilityName}</Text>
          <Text style={styles.metaText}>{t('diagnostics.priority')}: {order.priority}</Text>
          <Text style={styles.metaText}>{t('diagnostics.testsCount')}: {order.tests.length}</Text>
        </View>
      </View>
      <View style={styles.testsPreview}>
        {order.tests.slice(0, 3).map(testCode => {
          const catalogEntry = testsCatalog?.success && testsCatalog.data ? testsCatalog.data.find((c: any) => c.code === testCode) : null;
          const result = order.results.find(r => r.testCode === testCode);
          return (
            <View key={testCode} style={styles.testChip}>
              <Text style={styles.testName}>{catalogEntry?.name || testCode}</Text>
              {result && (
                <View style={[styles.flagDot, { backgroundColor: getFlagColor(result.flag) }]} />
              )}
            </View>
          );
        })}
        {order.tests.length > 3 && (
          <Text style={styles.moreTests}>+{order.tests.length - 3} {t('diagnostics.more')}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('diagnostics.title')}</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.addButtonText}>+ {t('diagnostics.newOrder')}</Text>
            </TouchableOpacity>
          </View>

          {syncService.getPendingCount() > 0 && (
            <View style={styles.syncBanner}>
              <Text style={styles.syncText}>⏳ {syncService.getPendingCount()} {t('diagnostics.pendingSync')}</Text>
            </View>
          )}

          <View style={styles.filters}>
            <TouchableOpacity style={styles.filterChip}>
              <Text>{t('diagnostics.all')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Text>{t('diagnostics.ordered')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Text>{t('diagnostics.inProgress')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Text>{t('diagnostics.completed')}</Text>
            </TouchableOpacity>
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('diagnostics.noOrders')}</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.addButtonText}>{t('diagnostics.createFirst')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {orders.map(renderOrderCard)}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Create Order Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('diagnostics.newOrder')}</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder={t('diagnostics.patientId')}
              value={patientId}
              onChangeText={setPatientId}
            />
            <TextInput
              style={styles.input}
              placeholder={t('diagnostics.facilityId')}
              value={facilityId}
              onChangeText={setFacilityId}
            />

            <Text style={styles.sectionTitle}>{t('diagnostics.selectTests')}</Text>
            <View style={styles.testsGrid}>
              {testsCatalog?.data?.map((test: any) => (
                <TouchableOpacity
                  key={test.code}
                  style={[
                    styles.testChip,
                    selectedTests.includes(test.code) && styles.testChipSelected,
                  ]}
                  onPress={() => {
                    setSelectedTests(prev =>
                      prev.includes(test.code)
                        ? prev.filter(t => t !== test.code)
                        : [...prev, test.code]
                    );
                  }}
                >
                  <Text style={[
                    styles.testChipText,
                    selectedTests.includes(test.code) && styles.testChipTextSelected,
                  ]}>
                    {test.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.priorityRow}>
              <Text style={styles.label}>{t('diagnostics.priority')}</Text>
              <View style={styles.priorityChips}>
                {(['ROUTINE', 'URGENT', 'STAT'] as DiagnosticPriority[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityChip,
                      priority === p && styles.priorityChipSelected,
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[
                      styles.priorityChipText,
                      priority === p && styles.priorityChipTextSelected,
                    ]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('diagnostics.notes')}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleCreateOrder} disabled={!patientId || !facilityId || selectedTests.length === 0}>
              <Text style={styles.submitButtonText}>{t('diagnostics.create')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Order Detail Modal */}
      <Modal visible={showOrderDetail} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { flex: 1 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('diagnostics.orderDetail')}: {selectedOrder?.id}</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowOrderDetail(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView contentContainerStyle={styles.detailContent}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('diagnostics.patient')}</Text>
                  <Text style={styles.detailValue}>{selectedOrder.patientName}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('diagnostics.facility')}</Text>
                  <Text style={styles.detailValue}>{selectedOrder.facilityName}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('diagnostics.status')}</Text>
                  <View style={styles.detailValueRow}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                      <Text style={styles.statusText}>{t(`diagnostics.status.${selectedOrder.status.toLowerCase()}`)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.statusAction}
                      onPress={() => {
                        const nextStatus: DiagnosticStatus =
                          selectedOrder.status === 'ORDERED' ? 'IN_PROGRESS' :
                          selectedOrder.status === 'IN_PROGRESS' ? 'COMPLETED' : 'ORDERED';
                        handleUpdateStatus(selectedOrder.id, nextStatus);
                      }}
                    >
                      <Text>{t('diagnostics.nextStatus')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>{t('diagnostics.testResults')}</Text>
                {selectedOrder.tests.map(testCode => {
                  const catalogEntry = testsCatalog?.success && testsCatalog.data ? testsCatalog.data.find((c: any) => c.code === testCode) : null;
                  const result = selectedOrder.results.find(r => r.testCode === testCode);
                  return (
                    <View key={testCode} style={styles.resultCard}>
                      <Text style={styles.resultName}>{catalogEntry?.name || testCode}</Text>
                      {result ? (
                        <>
                          <View style={styles.resultRow}>
                            <Text style={styles.resultLabel}>{t('diagnostics.value')}</Text>
                            <Text style={styles.resultValue}>{result.value} {result.unit}</Text>
                          </View>
                          <View style={styles.resultRow}>
                            <Text style={styles.resultLabel}>{t('diagnostics.reference')}</Text>
                            <Text style={styles.resultValue}>{result.referenceRange}</Text>
                          </View>
                          <View style={styles.resultRow}>
                            <Text style={styles.resultLabel}>{t('diagnostics.flag')}</Text>
                            <View style={[styles.flagBadge, { backgroundColor: getFlagColor(result.flag) }]}>
                              <Text style={styles.flagText}>{result.flag}</Text>
                            </View>
                          </View>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.addResultButton}
                          onPress={() => {
                            // Simple prompt for demo
                            const value = prompt(`Enter value for ${catalogEntry?.name || testCode}:`);
                            if (value) {
                              const flag = parseFloat(value) > (catalogEntry?.referenceHigh || 100) ? 'CRITICAL' :
                                parseFloat(value) < (catalogEntry?.referenceLow || 0) ? 'ABNORMAL' : 'NORMAL';
                              handleAddResult(selectedOrder.id, testCode, value, catalogEntry?.unit || '', flag as TestFlag, catalogEntry?.normalRange);
                            }
                          }}
                        >
                          <Text style={styles.addResultText}>{t('diagnostics.addResult')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  addButton: { backgroundColor: COLORS.primary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.md },
  addButtonText: { color: COLORS.textOnPrimary, fontWeight: '600' },
  syncBanner: { backgroundColor: COLORS.warning, padding: theme.spacing.sm, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, alignItems: 'center' },
  syncText: { color: COLORS.textOnPrimary, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  filterChip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: COLORS.border },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl * 2 },
  emptyText: { color: COLORS.textSecondary, marginBottom: theme.spacing.md },
  ordersList: { gap: theme.spacing.md },
  orderCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  orderHeader: { gap: theme.spacing.sm },
  orderTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600', color: COLORS.textOnPrimary },
  orderMeta: { gap: 4 },
  metaText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  testsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  testChip: { backgroundColor: COLORS.background, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 4 },
  testChipSelected: { backgroundColor: COLORS.primary },
  testChipText: { color: COLORS.textPrimary },
  testChipTextSelected: { color: COLORS.textOnPrimary },
  testName: { fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
  flagDot: { width: 8, height: 8, borderRadius: 4 },
  moreTests: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, color: COLORS.textPrimary },
  textArea: { minHeight: 80 },
  sectionTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
  testsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  priorityRow: { gap: theme.spacing.sm },
  label: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  priorityChips: { flexDirection: 'row', gap: theme.spacing.sm },
  priorityChip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, backgroundColor: COLORS.background, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: COLORS.border },
  priorityChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  priorityChipText: { color: COLORS.textPrimary, fontWeight: '600' },
  priorityChipTextSelected: { color: COLORS.textOnPrimary },
  submitButton: { backgroundColor: COLORS.primary, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center', marginTop: theme.spacing.lg },
  submitButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: theme.typography.fontSize.md },
  detailContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.xl },
  detailSection: { gap: theme.spacing.xs },
  detailLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  detailValue: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' },
  statusAction: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md },
  resultCard: { backgroundColor: COLORS.background, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  resultName: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: theme.spacing.sm },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  resultLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  resultValue: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textPrimary },
  flagBadge: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  flagText: { fontSize: theme.typography.fontSize.xs, fontWeight: '700', color: COLORS.textOnPrimary },
  addResultButton: { backgroundColor: COLORS.primary, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center', marginTop: theme.spacing.sm },
  addResultText: { color: COLORS.textOnPrimary, fontWeight: '600' },
});