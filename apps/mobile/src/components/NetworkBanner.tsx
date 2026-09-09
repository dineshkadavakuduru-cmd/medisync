import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@medisync/shared';
import { syncService } from '../services/syncService';
import { useTranslation } from '../i18n';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';

const COPY = {
  en: {
    demo: 'Demo: synthetic data. Not for clinical use.',
    offline: 'Offline', online: 'Online', syncing: 'Syncing',
    pending: 'Local actions awaiting sync: ', failed: 'Failed actions: ',
    error: 'Sync or local storage unavailable. Please retry.',
    localOnly: 'Demo actions stay on this device; not sent to a server.',
    loading: 'Checking local sync status...',
    unconfigured: 'Server mode: backend not configured. Actions stay on this device.',
    paused: 'Demo mode: server sync paused.',
  },
  hi: {
    demo: 'डेमो: कृत्रिम डेटा। चिकित्सा उपयोग के लिए नहीं।',
    offline: 'ऑफलाइन', online: 'ऑनलाइन', syncing: 'सिंक जारी है',
    pending: 'सिंक की प्रतीक्षा में स्थानीय कार्य: ', failed: 'असफल कार्य: ',
    error: 'सिंक या स्थानीय स्टोरेज उपलब्ध नहीं है। फिर कोशिश करें।',
    localOnly: 'डेमो कार्य इसी डिवाइस पर हैं; सर्वर पर नहीं भेजे गए।',
    loading: 'स्थानीय सिंक स्थिति जाँची जा रही है...',
    unconfigured: 'सर्वर मोड: बैकएंड कॉन्फ़िगर नहीं है। कार्य इसी डिवाइस पर हैं।',
    paused: 'डेमो मोड: सर्वर सिंक रुका है।',
  },
  mr: {
    demo: 'डेमो: कृत्रिम डेटा. वैद्यकीय वापरासाठी नाही.',
    offline: 'ऑफलाइन', online: 'ऑनलाइन', syncing: 'सिंक सुरू आहे',
    pending: 'सिंकच्या प्रतीक्षेतील स्थानिक कृती: ', failed: 'अयशस्वी कृती: ',
    error: 'सिंक किंवा स्थानिक स्टोरेज उपलब्ध नाही. पुन्हा प्रयत्न करा.',
    localOnly: 'डेमो कृती याच उपकरणावर आहेत; सर्व्हरवर पाठवलेल्या नाहीत.',
    loading: 'स्थानिक सिंक स्थिती तपासत आहे...',
    unconfigured: 'सर्व्हर मोड: बॅकएंड कॉन्फिगर केलेला नाही. कृती याच उपकरणावर आहेत.',
    paused: 'डेमो मोड: सर्व्हर सिंक थांबवले आहे.',
  },
};

// The banner can remount; the service is initialized only once per app session.
let initialization: Promise<void> | undefined;

function readSyncStatus() {
  const actions = syncService.getActions();
  return {
    online: syncService.isOnline(),
    syncing: syncService.isSyncing(),
    pending: syncService.getPendingCount(),
    failed: actions.filter((action) => action.status === 'error' && !action.discarded).length,
    error: Boolean(syncService.lastError()),
  };
}

export const NetworkBanner: React.FC = () => {
  const { t, language } = useTranslation();
  const copy = COPY[language];
  const [isDemo, setIsDemo] = useState(isDemoActive);
  const unconfigured = !process.env.EXPO_PUBLIC_API_URL?.trim();
  const [status, setStatus] = useState({ online: false, syncing: false, pending: 0, failed: 0, error: false });
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (!mounted) return;
      try {
        setStatus(readSyncStatus());
      } catch {
        setStorageError(true);
      }
    };
    const unsubscribe = syncService.subscribe(refresh);
    const unsubscribeMode = onDemoModeChange(() => {
      setIsDemo(isDemoActive());
      refresh();
    });
    setIsDemo(isDemoActive());
    initialization ??= Promise.resolve().then(() => syncService.init());
    initialization.then(() => {
      if (!mounted) return;
      refresh();
      setReady(true);
    }).catch(() => {
      initialization = undefined;
      if (!mounted) return;
      refresh();
      setStorageError(true);
      setReady(true);
    });
    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeMode();
    };
  }, []);

  const retry = async () => {
    setRetrying(true);
    try {
      await syncService.init();
      await syncService.syncAll();
      setStatus(readSyncStatus());
      setStorageError(false);
    } catch {
      setStorageError(true);
    } finally {
      setRetrying(false);
    }
  };

  const hasError = storageError || status.error || status.failed > 0;
  const showSync = unconfigured || !ready || !status.online || status.syncing || status.pending > 0 || hasError;
  const retryDisabled = retrying || status.syncing || (!status.online && !storageError) || ((isDemo || unconfigured) && !storageError);
  if (!isDemo && !showSync) return null;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {isDemo && <Text style={styles.text}>{copy.demo}</Text>}
      {showSync && (
        <View style={styles.syncRow}>
          <View style={styles.details}>
            {!storageError && (
              <Text style={styles.text}>
                {!ready ? copy.loading : `${isDemo ? copy.paused : unconfigured ? copy.unconfigured : `${!status.online ? copy.offline : status.syncing ? copy.syncing : copy.online}.`} ${copy.pending}${status.pending}`}
              </Text>
            )}
            {status.failed > 0 && <Text style={styles.text}>{copy.failed}{status.failed}</Text>}
            {hasError && <Text style={styles.errorText}>{copy.error}</Text>}
          </View>
          {ready && (status.pending > 0 || hasError) && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: retryDisabled }}
              disabled={retryDisabled}
              onPress={retry}
              style={[styles.retry, retryDisabled && styles.disabled]}
            >
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8E1',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  details: { flex: 1, gap: 2 },
  text: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 18 },
  errorText: { color: COLORS.emergency, fontSize: 13, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  retryText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
