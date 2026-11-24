import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../i18n';

const SLIDES = [
  {
    icon: '🏥',
    titleKey: 'onboarding.unifiedHealthcare',
    descriptionKey: 'onboarding.unifiedHealthcareDesc',
    tint: '#E0F2F1',
  },
  {
    icon: '🤖',
    titleKey: 'onboarding.aiTriage',
    descriptionKey: 'onboarding.aiTriageDesc',
    tint: '#E3F2FD',
  },
  {
    icon: '🚨',
    titleKey: 'onboarding.emergencyResponse',
    descriptionKey: 'onboarding.emergencyResponseDesc',
    tint: '#FFEBEE',
  },
];

export const OnboardingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const slideIndex = useRef(0);
  const web = Platform.OS === 'web';
  const wide = web && width >= 760;

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: slideIndex.current * width, animated: false });
  }, [width]);

  const showSlide = (index: number) => {
    const next = Math.max(0, Math.min(index, SLIDES.length - 1));
    slideIndex.current = next;
    setCurrentIndex(next);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: !web });
      showSlide(currentIndex + 1);
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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    showSlide(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const renderSlide = (slide: typeof SLIDES[number]) => (
    <>
      <View aria-hidden style={[styles.art, { backgroundColor: slide.tint }, wide && styles.wideArt]}>
        <Text style={styles.icon}>{slide.icon}</Text>
      </View>
      <View style={[styles.copy, wide && styles.wideCopy]}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, wide && styles.leftAligned]}>{t(slide.titleKey)}</Text>
        <Text style={[styles.description, wide && styles.leftAligned]}>{t(slide.descriptionKey)}</Text>
      </View>
    </>
  );

  return (
    <View style={styles.container} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <TouchableOpacity accessibilityRole="button" style={styles.skip} onPress={completeOnboarding}>
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={web ? handleScroll : undefined}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {width > 0 && SLIDES.map((slide, index) => (
          <View key={slide.titleKey} style={{ width }} aria-hidden={index !== currentIndex}>
            {web ? (
              <ScrollView contentContainerStyle={[styles.slide, styles.webSlide, wide && styles.wideSlide]}>
                {renderSlide(slide)}
              </ScrollView>
            ) : (
              <View style={[styles.slide, styles.nativeSlide]}>{renderSlide(slide)}</View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} aria-hidden>
        {SLIDES.map((_, index) => (
          <View key={index} style={[styles.dot, currentIndex === index && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity accessibilityRole="button" style={[styles.button, wide && styles.wideButton]} onPress={handleNext}>
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
    alignSelf: 'flex-end',
    marginHorizontal: theme.layout.screenPadding,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
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
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.lg,
  },
  webSlide: { flexGrow: 1, paddingVertical: theme.spacing.md },
  nativeSlide: { flex: 1 },
  wideSlide: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 48, gap: 40 },
  art: { width: 144, height: 144, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  wideArt: { flex: 1, minHeight: 220 },
  icon: { fontSize: 72 },
  copy: { maxWidth: 440 },
  wideCopy: { flex: 1, minWidth: 0 },
  leftAligned: { textAlign: 'left' },
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
    marginBottom: theme.spacing.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  wideButton: { alignSelf: 'center', minWidth: 240, paddingHorizontal: theme.spacing.xl },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
