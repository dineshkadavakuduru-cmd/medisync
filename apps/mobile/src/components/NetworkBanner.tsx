import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import NetInfo from '@react-native-community/netinfo';
import { syncService } from '../services/syncService';

export const NetworkBanner: React.FC = () => {
  const [bannerType, setBannerType] = useState<'offline' | 'online' | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnlineRef = useRef(true);
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const heightAnim = useRef(new Animated.Value(32)).current;

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

  // Subscribe to sync service for pending count updates
  useEffect(() => {
    const unsubscribe = syncService.subscribe(() => {
      setPendingCount(syncService.getPendingCount());
    });
    setPendingCount(syncService.getPendingCount());
    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: pendingCount > 0 ? 56 : 32,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pendingCount]);

  if (!bannerType && pendingCount === 0) return null;

  const isOffline = bannerType === 'offline';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isOffline ? COLORS.emergency : COLORS.success,
          transform: [{ translateY: slideAnim }],
          height: heightAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>
          {isOffline
            ? "📴 You're offline — data will sync when connected"
            : '✅ Back online — syncing data...'}
        </Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingText}>
            ⏳ {pendingCount} {pendingCount === 1 ? 'action' : 'actions'} pending sync
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 8,
  },
  content: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  pendingText: {
    color: COLORS.textOnPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
});
