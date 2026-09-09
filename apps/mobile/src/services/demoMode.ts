import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO_MODE_KEY = 'demo_mode_active';

let demoActive = false;
const listeners = new Set<() => void>();
let initialization: Promise<void> | undefined;
let writes: Promise<unknown> = Promise.resolve();

export function initDemoMode(): Promise<void> {
  initialization ??= AsyncStorage.getItem(DEMO_MODE_KEY).then(val => {
    demoActive = val === null ? !process.env.EXPO_PUBLIC_API_URL : val === 'true';
    listeners.forEach(listener => listener());
  }).catch(error => { initialization = undefined; throw error; });
  return initialization;
}

export function onDemoModeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isDemoActive(): boolean {
  return demoActive;
}

export async function toggleDemoMode(): Promise<boolean> {
  await initDemoMode();
  const next = writes.then(async () => {
    const value = !demoActive;
    await AsyncStorage.setItem(DEMO_MODE_KEY, String(value));
    demoActive = value;
    listeners.forEach(listener => listener());
    return value;
  });
  writes = next.catch(() => undefined);
  return next;
}

export function getDemoHeader(): Record<string, string> {
  return demoActive ? { 'X-Demo-Mode': 'true' } : {};
}
