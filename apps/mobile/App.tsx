import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkBanner } from './src/components/NetworkBanner';
import { loadSavedLanguage } from './src/i18n';
import { initDemoMode } from './src/services/demoMode';

const theme = {
  colors: {
    primary: '#00695C',
    accent: '#C62828',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#212121',
    error: '#C62828',
  },
};

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void Promise.all([loadSavedLanguage(), initDemoMode()]).then(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
      <ErrorBoundary>
        <View style={styles.webContainer}>
          <View style={styles.appShell}>
            {ready ? <>
              <AppNavigator />
              <NetworkBanner />
            </> : <ActivityIndicator style={styles.loading} size="large" color={theme.colors.primary} />}
          </View>
        </View>
      </ErrorBoundary>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  webContainer: {
    flex: 1,
    backgroundColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appShell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
});
