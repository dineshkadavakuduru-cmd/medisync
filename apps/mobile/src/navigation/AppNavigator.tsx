import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomNav } from '../components/BottomNav';
import { HomeScreen } from '../screens/HomeScreen';
import { TriageScreen } from '../screens/TriageScreen';
import { TriageFlowScreen } from '../screens/TriageFlowScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { PatientDetailScreen } from '../screens/PatientDetailScreen';
import { FacilityScreen } from '../screens/FacilityScreen';
import { FacilityDetailScreen } from '../screens/FacilityDetailScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { ReferralSuccessScreen } from '../screens/ReferralSuccessScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { EmergencyCreateScreen } from '../screens/EmergencyCreateScreen';
import { EmergencyDetailScreen } from '../screens/EmergencyDetailScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
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
        <Stack.Screen name="TriageFlow" component={TriageFlowScreen} options={{ title: 'AI Triage Flow' }} />
        <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: 'Patient Details' }} />
        <Stack.Screen name="FacilityDetail" component={FacilityDetailScreen} options={{ title: 'Facility Details' }} />
        <Stack.Screen name="ReferralSuccess" component={ReferralSuccessScreen} options={{ title: 'Referral Created' }} />
        <Stack.Screen name="Referral" component={ReferralScreen} options={{ title: 'Referral' }} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ title: 'Emergency' }} />
        <Stack.Screen
          name="EmergencyCreate"
          component={EmergencyCreateScreen}
          options={{
            title: 'New Emergency',
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="EmergencyDetail" component={EmergencyDetailScreen} options={{ title: 'Emergency Detail' }} />
        <Stack.Screen
          name="Feedback"
          component={FeedbackScreen}
          options={{
            title: 'Feedback',
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
