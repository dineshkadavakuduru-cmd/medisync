import React, { useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, ParamListBase } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@medisync/shared';
import { useTranslation } from '../i18n';
import { getActivePersona, onPersonaChange } from '../services/personas';
import { theme } from '../styles/theme';

const TOOLS = [
  { route: 'Diagnostics', key: 'diagnostics', icon: 'test-tube' },
  { route: 'TeleconsultList', key: 'teleconsult', icon: 'video-outline' },
  { route: 'Queue', key: 'appointments', icon: 'calendar-clock-outline' },
  { route: 'Emergency', key: 'emergency', icon: 'alarm-light-outline' },
  { route: 'AshaHomeVisit', key: 'ashahomevisit', icon: 'home-outline', role: 'ASHA' },
  { route: 'Inventory', key: 'inventory', icon: 'package-variant', role: 'PHARMACIST' },
] as const;

export const MoreScreen: React.FC<{ navigation: NavigationProp<ParamListBase> }> = ({ navigation }) => {
  const { t } = useTranslation();
  const persona = useSyncExternalStore(onPersonaChange, getActivePersona, getActivePersona);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('common.more')}</Text>
        <Text style={styles.subtitle}>{t('more.description')}</Text>
        {TOOLS.filter(tool => !('role' in tool) || tool.role === persona.role).map(tool => (
          <TouchableOpacity
            key={tool.route}
            testID={`more-${tool.key}`}
            accessibilityRole="button"
            style={styles.button}
            activeOpacity={0.75}
            onPress={() => navigation.navigate(tool.route)}
          >
            <View style={styles.icon}>
              <MaterialCommunityIcons name={tool.icon} size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.label}>{t(`common.${tool.key}`)}</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: theme.layout.screenPadding, gap: 12, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, marginBottom: 8 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, padding: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, ...theme.shadows.sm },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E0F2F1', alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
});
