import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { HomeScreen } from '../screens/HomeScreen';
import { TriageScreen } from '../screens/TriageScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { FacilityScreen } from '../screens/FacilityScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { TeleconsultListScreen } from '../screens/TeleconsultListScreen';
import { AppointmentBookScreen } from '../screens/AppointmentBookScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { useTranslation } from '../i18n';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  focused: boolean;
  icon: string;
  label: string;
}

const TabIcon: React.FC<TabIconProps> = ({ focused, icon, label }) => {
  const color = focused ? COLORS.primary : COLORS.textSecondary;
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, { color, fontSize: focused ? 26 : 24 }]}>{icon}</Text>
      <Text style={[styles.label, { color, fontWeight: focused ? '600' : '400' }]}>{label}</Text>
    </View>
  );
};

export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const icons: Record<string, string> = {
            Home: '🏠',
            Triage: '🤖',
            Teleconsult: '📹',
            Appointments: '📅',
            Patients: '👥',
            Facility: '🏥',
            Emergency: '🚨',
          };
          return (
            <TabIcon
              focused={focused}
              icon={icons[route.name]}
              label={t(`common.${route.name.toLowerCase()}` as any) || route.name}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Triage" component={TriageScreen} />
      <Tab.Screen name="Teleconsult" component={TeleconsultListScreen} />
      <Tab.Screen name="Appointments" component={QueueScreen} />
      <Tab.Screen name="Patients" component={PatientsScreen} />
      <Tab.Screen name="Facility" component={FacilityScreen} />
      <Tab.Screen name="Emergency" component={EmergencyScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 8,
    paddingTop: 6,
    height: 68,
    ...theme.shadows.lg,
  },
  iconContainer: {
    alignItems: 'center',
    gap: 2,
  },
  icon: {},
  label: {},
});