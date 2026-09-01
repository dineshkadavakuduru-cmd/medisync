import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@medisync/shared';
import { initDemoMode, isDemoActive as checkDemoActive } from '../services/demoMode';

export const DemoBadge: React.FC = () => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    initDemoMode().then(() => setActive(checkDemoActive()));
  }, []);

  if (!active) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>DEMO</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 48,
    right: 16,
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
