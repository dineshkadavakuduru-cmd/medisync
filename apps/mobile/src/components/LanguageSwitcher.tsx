import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { getCurrentLanguage, setLanguage } from '../i18n';

export const LanguageSwitcher: React.FC = () => {
  const [lang, setLang] = React.useState(getCurrentLanguage());

  const handlePress = async (l: 'en' | 'hi' | 'mr') => {
    await setLanguage(l);
    setLang(l);
  };

  const buttons: { label: string; value: 'en' | 'hi' | 'mr' }[] = [
    { label: 'EN', value: 'en' },
    { label: 'हिं', value: 'hi' },
    { label: 'मरा', value: 'mr' },
  ];

  return (
    <View style={styles.container}>
      {buttons.map((btn) => {
        const isActive = lang === btn.value;
        return (
          <TouchableOpacity
            key={btn.value}
            style={[styles.button, isActive ? styles.activeButton : styles.inactiveButton]}
            onPress={() => handlePress(btn.value)}
          >
            <Text style={[styles.text, isActive ? styles.activeText : styles.inactiveText]}>
              {btn.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: COLORS.primary,
  },
  inactiveButton: {
    backgroundColor: COLORS.cardBg,
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  activeText: {
    color: COLORS.textOnPrimary,
  },
  inactiveText: {
    color: COLORS.textPrimary,
  },
});