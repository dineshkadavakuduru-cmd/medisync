import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
        if (onboardingCompleted === 'true') {
          navigation.replace('MainTabs');
        } else {
          navigation.replace('Onboarding');
        }
      } catch (e) {
        navigation.replace('MainTabs');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>ArogyaSetu+</Text>
        <Text style={styles.subtitle}>आरोग्यसेतू+</Text>
        <Text style={styles.tagline}>Bridging Rural Healthcare</Text>
      </Animated.View>
      <View style={styles.footer}>
        <Text style={styles.powered}>Powered by AI</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SIH 2026</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00695C',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00695C',
    marginBottom: 16,
  },
  tagline: {
    fontSize: 14,
    color: '#757575',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 8,
  },
  powered: {
    fontSize: 12,
    color: '#757575',
  },
  badge: {
    backgroundColor: '#00695C',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
