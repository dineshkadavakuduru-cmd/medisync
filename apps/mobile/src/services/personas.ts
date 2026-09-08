import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'DOCTOR' | 'ASHA' | 'PATIENT' | 'ADMIN' | 'PHARMACIST';

export interface Persona {
  id: string;
  role: UserRole;
  name: string;
  initials: string;
  title: string;
  facility: string;
  staffId: string;
  shiftOrAbha: string;
  syncStatus: string;
  avatarColor: string;
  accent: string;
  greetingTitle: string;
  badgeRole: string;
}

export const PERSONAS: Record<UserRole, Persona> = {
  DOCTOR: {
    id: 'doctor',
    role: 'DOCTOR',
    name: 'Dr. Ananya Deshmukh',
    initials: 'AD',
    title: 'Chief Medical Officer (CMO)',
    facility: 'Mulshi PHC (Pune)',
    staffId: 'MH-PUN-DOC-401',
    shiftOrAbha: 'Night Duty (20:00 - 08:00)',
    syncStatus: '✓ 100% Synced',
    avatarColor: '#00695C',
    accent: '#00695C',
    greetingTitle: 'Good Morning, Dr. Sharma 🌅',
    badgeRole: 'Doctor / CMO',
  },
  ASHA: {
    id: 'asha',
    role: 'ASHA',
    name: 'Sunita Devi (Didi)',
    initials: 'SD',
    title: 'ASHA Community Health Worker',
    facility: 'Sub-Centre Khed (Velhe)',
    staffId: 'MH-PUN-ASHA-108',
    shiftOrAbha: 'Field Shift (08:00 - 16:00)',
    syncStatus: '✓ 100% Synced (18 Cached)',
    avatarColor: '#6A1B9A',
    accent: '#6A1B9A',
    greetingTitle: 'Good Morning, Sunita Didi 👩‍⚕️',
    badgeRole: 'ASHA Worker',
  },
  PATIENT: {
    id: 'patient',
    role: 'PATIENT',
    name: 'Ramesh Kumar Patel',
    initials: 'RP',
    title: 'Registered Beneficiary',
    facility: 'Mulshi PHC (Pune)',
    staffId: 'ABHA: 91-4231-8902-1245',
    shiftOrAbha: 'ABHA Card Verified',
    syncStatus: '✓ PHR Connected',
    avatarColor: '#1565C0',
    accent: '#1565C0',
    greetingTitle: 'Namaste, Ramesh Ji 🙏',
    badgeRole: 'Patient / Citizen',
  },
  ADMIN: {
    id: 'admin',
    role: 'ADMIN',
    name: 'Dr. Rajesh Kumar',
    initials: 'DHO',
    title: 'District Health Officer (DHO)',
    facility: 'Pune District Command Centre',
    staffId: 'MH-GOV-ADMIN-01',
    shiftOrAbha: 'Command Duty (24/7 Monitored)',
    syncStatus: '✓ 10 PHCs Connected',
    avatarColor: '#C62828',
    accent: '#C62828',
    greetingTitle: 'District Command Centre 🏛️',
    badgeRole: 'District Admin',
  },
  PHARMACIST: {
    id: 'pharmacist',
    role: 'PHARMACIST',
    name: 'Rajesh Patil',
    initials: 'RP',
    title: 'Pharmacist',
    facility: 'Mulshi PHC (Pune)',
    staffId: 'MH-PUN-PHA-001',
    shiftOrAbha: 'Morning Shift (08:00 - 16:00)',
    syncStatus: '✓ 100% Synced',
    avatarColor: '#FF6F00',
    accent: '#FF6F00',
    greetingTitle: 'Good Morning, Rajesh 👨‍🔬',
    badgeRole: 'Pharmacist',
  },
};

const ACTIVE_PERSONA_KEY = 'medisync_active_persona';

let currentRole: UserRole = 'DOCTOR';
const listeners: Array<(persona: Persona) => void> = [];

export async function initActivePersona(): Promise<Persona> {
  try {
    const saved = await AsyncStorage.getItem(ACTIVE_PERSONA_KEY);
    if (saved && (saved in PERSONAS)) {
      currentRole = saved as UserRole;
    }
  } catch (e) {
    // fallback to doctor
  }
  return PERSONAS[currentRole];
}

export function getActivePersona(): Persona {
  return PERSONAS[currentRole];
}

export async function setActivePersona(role: UserRole): Promise<Persona> {
  currentRole = role;
  try {
    await AsyncStorage.setItem(ACTIVE_PERSONA_KEY, role);
  } catch (e) {
    console.error(e);
  }
  const persona = PERSONAS[role];
  listeners.forEach((l) => l(persona));
  return persona;
}

export function onPersonaChange(fn: (persona: Persona) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
