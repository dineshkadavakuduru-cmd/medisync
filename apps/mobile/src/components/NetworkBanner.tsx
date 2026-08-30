import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import NetInfo from '@react-native-community/netinfo';

export const NetworkBanner: React.FC = () => {
  const [bannerType, setBannerType] = useState<'offline' | 'online' | null>(null);
  const isOnlineRef = useRef(true);
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    NetInfo.fetch().then(state => {
      const connected = state.isConnected ?? true;
      isOnlineRef.current = connected;
      if (!connected) {
        setBannerType('offline');
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      const wasOffline = !isOnlineRef.current;
      isOnlineRef.current = connected;

      if (!connected) {
        setBannerType('offline');
      } else if (connected && wasOffline) {
        setBannerType('online');
        setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -50,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setBannerType(null));
        }, 3000);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (bannerType) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [bannerType]);

  if (!bannerType) return null;

  const isOffline = bannerType === 'offline';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isOffline ? COLORS.emergency : COLORS.success,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.text}>
        {isOffline ? "📴 You're offline — data will sync when connected" : '✅ Back online — syncing data...'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  text: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
});
