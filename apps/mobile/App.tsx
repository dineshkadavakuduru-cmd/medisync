import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkBanner } from './src/components/NetworkBanner';
import { DemoBadge } from './src/components/DemoBadge';

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
        <AppNavigator />
        <NetworkBanner />
        <DemoBadge />
      </ErrorBoundary>
    </PaperProvider>
  );
}
