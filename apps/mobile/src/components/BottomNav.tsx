import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '@medisync/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { HomeScreen } from '../screens/HomeScreen';
import { TriageScreen } from '../screens/TriageScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { FacilityScreen } from '../screens/FacilityScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { TeleconsultListScreen } from '../screens/TeleconsultListScreen';
import { AppointmentBookScreen } from '../screens/AppointmentBookScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';
import { AshaHomeVisitScreen } from '../screens/AshaHomeVisitScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { useTranslation } from '../i18n';
import { getActivePersona } from '../services/personas';

const Tab = createBottomTabNavigator();

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface TabIconProps {
  focused: boolean;
  routeName: string;
  label: string;
}

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home-variant-outline',
  Triage: 'stethoscope',
  Teleconsult: 'video-outline',
  Appointments: 'calendar-clock-outline',
  Patients: 'account-group-outline',
  Facility: 'hospital-building',
  Emergency: 'alarm-light-outline',
  Diagnostics: 'test-tube',
  AshaHomeVisit: 'home-outline',
  Inventory: 'package-variant',
};

const TabIcon: React.FC<TabIconProps> = ({ focused, routeName, label }) => {
  const color = focused ? COLORS.primary : '#8E8E93';
  const iconName = TAB_ICONS[routeName] || 'circle-outline';

  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons name={iconName} size={22} color={color} />
      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const persona = getActivePersona();
  const isAsha = persona.role === 'ASHA';
  const isPharmacist = persona.role === 'PHARMACIST';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          return (
            <TabIcon
              focused={focused}
              routeName={route.name}
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
      <Tab.Screen name="Diagnostics" component={DiagnosticsScreen} />
      {isAsha && <Tab.Screen name="AshaHomeVisit" component={AshaHomeVisitScreen} />}
      {isPharmacist && <Tab.Screen name="Inventory" component={InventoryScreen} />}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 4,
    paddingTop: 4,
    height: 62,
    ...theme.shadows.lg,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontSize: 10,
    marginTop: 1,
  },
});