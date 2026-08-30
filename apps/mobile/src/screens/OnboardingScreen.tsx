import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../i18n';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🏥',
    titleKey: 'onboarding.unifiedHealthcare',
    descriptionKey: 'onboarding.unifiedHealthcareDesc',
    gradient: ['#E0F2F1', '#00695C'],
  },
  {
    icon: '🤖',
    titleKey: 'onboarding.aiTriage',
    descriptionKey: 'onboarding.aiTriageDesc',
    gradient: ['#E3F2FD', '#1565C0'],
  },
  {
    icon: '🚨',
    titleKey: 'onboarding.emergencyResponse',
    descriptionKey: 'onboarding.emergencyResponseDesc',
    gradient: ['#FFEBEE', '#C62828'],
  },
];

export const OnboardingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    } catch (e) {
      console.error(e);
    }
    navigation.replace('MainTabs');
  };

  const skip = async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    } catch (e) {
      console.error(e);
    }
    navigation.replace('MainTabs');
  };

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={skip}>
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{slide.icon}</Text>
            <Text style={styles.title}>{t(slide.titleKey)}</Text>
            <Text style={styles.description}>{t(slide.descriptionKey)}</Text>
            <View style={[styles.gradient, { backgroundColor: slide.gradient[0] }]} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, index) => (
          <View key={index} style={[styles.dot, currentIndex === index && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>
          {currentIndex === SLIDES.length - 1 ? `${t('onboarding.getStarted')} →` : `${t('onboarding.next')} →`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  skip: {
    position: 'absolute',
    top: theme.spacing.lg,
    right: theme.layout.screenPadding,
    zIndex: 10,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.layout.screenPadding,
  },
  icon: {
    fontSize: 80,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: theme.spacing.xl,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    opacity: 0.3,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  button: {
    marginHorizontal: theme.layout.screenPadding,
    marginBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
