import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, StatusBar, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

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
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={require('../../assets/medisync-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.taglineContainer, { opacity: fadeAnim }]}>
        <Text style={styles.tagline}>Bridging Rural Healthcare with AI</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.powered}>Powered by AI • PS26133</Text>
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
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: 20,
  },
  taglineContainer: {
    marginTop: 24,
  },
  tagline: {
    fontSize: 15,
    color: '#00695C',
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 10,
  },
  powered: {
    fontSize: 12,
    color: '#9E9E9E',
    letterSpacing: 0.3,
  },
  badge: {
    backgroundColor: '#00695C',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
