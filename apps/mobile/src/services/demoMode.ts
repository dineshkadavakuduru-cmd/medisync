import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO_MODE_KEY = 'demo_mode_active';

let demoActive = false;

export async function initDemoMode() {
  try {
    const val = await AsyncStorage.getItem(DEMO_MODE_KEY);
    demoActive = val === 'true';
  } catch (e) {
    demoActive = false;
  }
}

export function isDemoActive(): boolean {
  return demoActive;
}

export async function toggleDemoMode(): Promise<boolean> {
  demoActive = !demoActive;
  try {
    await AsyncStorage.setItem(DEMO_MODE_KEY, demoActive ? 'true' : 'false');
  } catch (e) {
    console.error(e);
  }
  return demoActive;
}

export function getDemoHeader(): Record<string, string> {
  return demoActive ? { 'X-Demo-Mode': 'true' } : {};
}
