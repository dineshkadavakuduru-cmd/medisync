import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

const POSITIVE_TAGS = ['helpful_staff', 'good_doctor', 'clean_facility', 'medicine_available', 'short_wait'];
const NEGATIVE_TAGS = ['long_wait', 'no_medicine', 'poor_hygiene', 'rude_staff'];

export const FeedbackScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const facilityId = route.params?.facilityId || 'facility-1';

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await api.submitFeedback({
        patientId: 'patient-1',
        facilityId,
        visitDate: new Date().toISOString(),
        rating: rating as 1 | 2 | 3 | 4 | 5,
        tags: selectedTags,
        comment: comment || undefined,
        language: 'en',
      });
      setSubmitted(true);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setTimeout(() => navigation.goBack(), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.successIcon}>✓</Text>
          </Animated.View>
          <Text style={styles.successTitle}>{t('feedback.thankYou')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('feedback.title')}</Text>
        <Text style={styles.subtitle}>{t('feedback.howWasVisit')}</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, rating >= star && styles.starActive]}>
                {rating >= star ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.tagsTitle}>{t('feedback.selectTags')}</Text>
        <View style={styles.tagsGrid}>
          {POSITIVE_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, isSelected ? styles.tagChipPositiveSelected : styles.tagChipPositive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                  {t(`feedback.tags.${tag}` as any)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.tagsGrid}>
          {NEGATIVE_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, isSelected ? styles.tagChipNegativeSelected : styles.tagChipNegative]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                  {t(`feedback.tags.${tag}` as any)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.commentInput}
          placeholder={t('feedback.addComment')}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          placeholderTextColor={COLORS.textSecondary}
        />

        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          <Text style={styles.submitButtonText}>{t('feedback.submit')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  star: {
    fontSize: 40,
    color: COLORS.border,
  },
  starActive: {
    color: COLORS.primary,
  },
  tagsTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  tagChipPositive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.surface,
  },
  tagChipPositiveSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  tagChipNegative: {
    borderColor: COLORS.severityRed,
    backgroundColor: COLORS.surface,
  },
  tagChipNegativeSelected: {
    borderColor: COLORS.severityRed,
    backgroundColor: COLORS.severityRed,
  },
  tagText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  tagTextSelected: {
    color: COLORS.textOnPrimary,
  },
  commentInput: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
});