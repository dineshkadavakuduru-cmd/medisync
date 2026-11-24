import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '@medisync/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { HomeScreen } from '../screens/HomeScreen';
import { TriageScreen } from '../screens/TriageScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { FacilityScreen } from '../screens/FacilityScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { useTranslation } from '../i18n';

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
  Patients: 'account-group-outline',
  Facility: 'hospital-building',
  More: 'dots-horizontal',
};

const TabIcon: React.FC<TabIconProps> = ({ focused, routeName, label }) => {
  const color = focused ? COLORS.primary : COLORS.textSecondary;
  const iconName = TAB_ICONS[routeName] || 'circle-outline';

  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons name={iconName} size={22} color={color} />
      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>
        {label}
      </Text>
    </View>
  );
};

const FixedTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { t } = useTranslation();
  const web = Platform.OS === 'web';

  return (
    <View
      role={web ? 'navigation' : undefined}
      accessibilityLabel={web ? t('navigation.main') : undefined}
      testID="bottom-navigation"
      style={styles.tabBar}
    >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole={web ? 'button' : 'tab'}
              accessibilityState={web ? undefined : { selected: focused }}
              {...(web && focused ? { 'aria-current': 'page' } : {})}
              accessibilityLabel={options.tabBarAccessibilityLabel || t(`common.${route.name.toLowerCase()}`)}
              testID={options.tabBarTestID || `tab-${route.name.toLowerCase()}`}
              style={[styles.tabItem, focused && styles.currentTab]}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            >
              <TabIcon focused={focused} routeName={route.name} label={t(`common.${route.name.toLowerCase()}`)} />
            </TouchableOpacity>
          );
        })}
    </View>
  );
};

export const BottomNav: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <FixedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Triage" component={TriageScreen} />
      <Tab.Screen name="Patients" component={PatientsScreen} />
      <Tab.Screen name="Facility" component={FacilityScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 4,
    paddingTop: 4,
    minHeight: 62,
    ...theme.shadows.lg,
  },
  currentTab: { backgroundColor: COLORS.primaryLight },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center',
  },
});
