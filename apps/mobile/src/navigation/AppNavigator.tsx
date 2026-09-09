import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef, ParamListBase } from '@react-navigation/native';
import { COLORS } from '@medisync/shared';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomNav } from '../components/BottomNav';
import { TriageFlowScreen } from '../screens/TriageFlowScreen';
import { PatientDetailScreen } from '../screens/PatientDetailScreen';
import { FacilityDetailScreen } from '../screens/FacilityDetailScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { ReferralSuccessScreen } from '../screens/ReferralSuccessScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { EmergencyCreateScreen } from '../screens/EmergencyCreateScreen';
import { EmergencyDetailScreen } from '../screens/EmergencyDetailScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { TeleconsultListScreen } from '../screens/TeleconsultListScreen';
import { TeleconsultJoinScreen } from '../screens/TeleconsultJoinScreen';
import { AppointmentBookScreen } from '../screens/AppointmentBookScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';
import { AshaHomeVisitScreen } from '../screens/AshaHomeVisitScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { initActivePersona } from '../services/personas';
import { useTranslation } from '../i18n';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<ParamListBase>();

export const AppNavigator: React.FC = () => {
  const { t } = useTranslation();
  const [showSos, setShowSos] = useState(false);
  const updateRoute = () => {
    const route = navigationRef.getCurrentRoute()?.name;
    setShowSos(!!route && route !== 'Splash' && route !== 'Onboarding');
  };
  useEffect(() => {
    void initActivePersona();
  }, []);

  return (
    <NavigationContainer ref={navigationRef} onReady={updateRoute} onStateChange={updateRoute}>
      <View style={styles.container}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#00695C',
          },
          headerTintColor: '#FFFFFF',
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="MainTabs" component={BottomNav} options={{ headerShown: false }} />
        <Stack.Screen name="TriageFlow" component={TriageFlowScreen} options={{ title: t('triage.title') }} />
        <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: t('navigation.patientDetail') }} />
        <Stack.Screen name="FacilityDetail" component={FacilityDetailScreen} options={{ title: t('navigation.facilityDetail') }} />
        <Stack.Screen name="ReferralSuccess" component={ReferralSuccessScreen} options={{ title: t('navigation.referralStatus') }} />
        <Stack.Screen name="Referral" component={ReferralScreen} options={{ title: t('navigation.referral') }} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ title: t('common.emergency') }} />
        <Stack.Screen
          name="EmergencyCreate"
          component={EmergencyCreateScreen}
          options={{
            title: t('navigation.newEmergency'),
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="EmergencyDetail" component={EmergencyDetailScreen} options={{ title: t('navigation.emergencyDetail') }} />
        <Stack.Screen name="TeleconsultList" component={TeleconsultListScreen} options={{ title: t('common.teleconsult') }} />
        <Stack.Screen name="Teleconsult" component={TeleconsultListScreen} options={{ title: t('common.teleconsult') }} />
        <Stack.Screen name="TeleconsultJoin" component={TeleconsultJoinScreen} options={{ title: t('common.teleconsult') }} />
        <Stack.Screen name="AppointmentBook" component={AppointmentBookScreen} options={{ title: t('navigation.bookAppointment') }} />
        <Stack.Screen name="Queue" component={QueueScreen} options={{ title: t('dashboard.queueManagement') }} />
        <Stack.Screen name="Appointments" component={QueueScreen} options={{ title: t('common.appointments') }} />
        <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: t('common.diagnostics') }} />
        <Stack.Screen name="AshaHomeVisit" component={AshaHomeVisitScreen} options={{ title: t('common.ashahomevisit') }} />
        <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: t('common.inventory') }} />
        <Stack.Screen
          name="Feedback"
          component={FeedbackScreen}
          options={{
            title: t('feedback.title'),
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
      {showSos && (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sosRow}>
          <Text style={styles.sosHint}>{t('emergency.sosHint')}</Text>
          <TouchableOpacity
            testID="global-sos"
            accessibilityRole="button"
            accessibilityLabel={t('emergency.openSos')}
            style={styles.sosButton}
            onPress={() => { if (navigationRef.isReady()) navigationRef.navigate('EmergencyCreate'); }}
          >
            <Text style={styles.sosText}>{t('emergency.sosButton')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  sosRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  sosHint: { flex: 1, fontSize: 12, lineHeight: 17, color: COLORS.textSecondary },
  sosButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.emergency, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: COLORS.emergency, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
  sosText: { color: COLORS.textOnPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
