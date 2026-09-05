import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkBanner } from './src/components/NetworkBanner';

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
  return (
    <PaperProvider theme={theme}>
      <ErrorBoundary>
        <View style={styles.webContainer}>
          <View style={styles.appShell}>
            <AppNavigator />
            <NetworkBanner />
          </View>
        </View>
      </ErrorBoundary>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
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
