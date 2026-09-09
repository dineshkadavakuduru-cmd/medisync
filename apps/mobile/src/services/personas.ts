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
  dataLabel: string;
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
    dataLabel: 'Demo persona - synthetic data',
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
    dataLabel: 'Demo persona - synthetic data',
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
    shiftOrAbha: 'Demo ABHA - not verified',
    dataLabel: 'Demo persona - PHR not connected',
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
    dataLabel: 'Demo persona - synthetic data',
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
    dataLabel: 'Demo persona - synthetic data',
    avatarColor: '#FF6F00',
    accent: '#FF6F00',
    greetingTitle: 'Good Morning, Rajesh 👨‍🔬',
    badgeRole: 'Pharmacist',
  },
};

const ACTIVE_PERSONA_KEY = 'medisync_active_persona';

let currentRole: UserRole = 'DOCTOR';
const listeners: Array<(persona: Persona) => void> = [];
let initialization: Promise<Persona> | undefined;
let roleRevision = 0;
let pendingSave: Promise<void> = Promise.resolve();

export function initActivePersona(): Promise<Persona> {
  if (!initialization) {
    const revision = roleRevision;
    initialization = (async () => {
      try {
        const saved = await AsyncStorage.getItem(ACTIVE_PERSONA_KEY);
        // A delayed storage read must not undo a role chosen during startup.
        if (revision === roleRevision && saved && Object.prototype.hasOwnProperty.call(PERSONAS, saved)) {
          currentRole = saved as UserRole;
          listeners.forEach((listener) => listener(getActivePersona()));
        }
      } catch {
        // Keep the current session persona when storage is unavailable.
      }
      return getActivePersona();
    })();
  }
  return initialization;
}

export function getActivePersona(): Persona {
  return PERSONAS[currentRole];
}

export async function setActivePersona(role: UserRole): Promise<Persona> {
  roleRevision += 1;
  currentRole = role;
  const persona = PERSONAS[role];
  listeners.forEach((l) => l(persona));
  // Publish immediately; serialize persistence so rapid selections save in order.
  pendingSave = pendingSave.then(() => AsyncStorage.setItem(ACTIVE_PERSONA_KEY, role)).catch(() => {
    console.warn('Could not save demo persona; the selection applies to this session only.');
  });
  await pendingSave;
  return getActivePersona();
}

export function onPersonaChange(fn: (persona: Persona) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
