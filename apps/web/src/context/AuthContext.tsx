'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type UserRole = 'PATIENT' | 'ASHA' | 'DOCTOR' | 'ADMIN';

export interface Persona {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  facilityOrLocation: string;
  avatar: string;
  abhaId?: string;
  phone?: string;
  description: string;
  accent: string;
}

export const DEMO_PERSONAS: Persona[] = [
  {
    id: 'patient-rajesh',
    name: 'Rajesh Kumar',
    role: 'PATIENT',
    title: 'Patient • Beneficiary',
    facilityOrLocation: 'Khed Village, Pune Rural',
    avatar: '👨‍🌾',
    abhaId: 'ABHA-1234-5678-9012',
    phone: '+91 98221 33445',
    description: 'Active prescription & referral. Has teleconsult session scheduled.',
    accent: '#1565C0',
  },
  {
    id: 'asha-khedkar',
    name: 'Asha Khedkar',
    role: 'ASHA',
    title: 'ASHA Field Worker',
    facilityOrLocation: 'Sub-Centre Khed, Pune',
    avatar: '👩‍⚕️',
    phone: '+91 98765 12340',
    description: 'Field triage, maternal ANC follow-up & offline sync.',
    accent: '#7B1FA2',
  },
  {
    id: 'doctor-deshmukh',
    name: 'Dr. Anita Deshmukh',
    role: 'DOCTOR',
    title: 'Medical Officer (MBBS, MD)',
    facilityOrLocation: 'District Hospital Pune',
    avatar: '👨‍⚕️',
    phone: '+91 99876 54321',
    description: 'OPD queue, teleconsult sessions, lab review.',
    accent: '#00695C',
  },
  {
    id: 'admin-dho',
    name: 'District Health Officer',
    role: 'ADMIN',
    title: 'District Health Officer',
    facilityOrLocation: 'Pune District Command Centre',
    avatar: '🏛️',
    phone: '+91 20 2612 3456',
    description: 'Bed & drug stock monitoring, outbreak alerts, district KPIs.',
    accent: '#C62828',
  },
];

export interface AuthUser {
  personaId: string;
  name: string;
  role: UserRole;
  title: string;
  facilityOrLocation: string;
  avatar: string;
  abhaId?: string;
  phone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loginAsPersona: (personaId: string) => void;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  personas: Persona[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'medisync.activePersonaId';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const persona = DEMO_PERSONAS.find((p) => p.id === stored);
        if (persona) {
          setUser({
            personaId: persona.id,
            name: persona.name,
            role: persona.role,
            title: persona.title,
            facilityOrLocation: persona.facilityOrLocation,
            avatar: persona.avatar,
            abhaId: persona.abhaId,
            phone: persona.phone,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  const persist = useCallback((personaId: string | null) => {
    try {
      if (typeof window === 'undefined') return;
      if (personaId) window.localStorage.setItem(STORAGE_KEY, personaId);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const loginAsPersona = useCallback(
    (personaId: string) => {
      const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
      if (!persona) return;
      const next: AuthUser = {
        personaId: persona.id,
        name: persona.name,
        role: persona.role,
        title: persona.title,
        facilityOrLocation: persona.facilityOrLocation,
        avatar: persona.avatar,
        abhaId: persona.abhaId,
        phone: persona.phone,
      };
      setUser(next);
      persist(persona.id);
    },
    [persist],
  );

  const switchRole = useCallback(
    (role: UserRole) => {
      const persona = DEMO_PERSONAS.find((p) => p.role === role);
      if (!persona) return;
      loginAsPersona(persona.id);
    },
    [loginAsPersona],
  );

  const logout = useCallback(() => {
    setUser(null);
    persist(null);
  }, [persist]);

  const value: AuthContextValue = {
    user,
    role: user?.role ?? null,
    isAuthenticated: !!user,
    loginAsPersona,
    switchRole,
    logout,
    personas: DEMO_PERSONAS,
  };

  if (!hydrated) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function roleHomePath(role: UserRole | null | undefined): string {
  switch (role) {
    case 'PATIENT':
      return '/patient';
    case 'ASHA':
      return '/asha';
    case 'DOCTOR':
      return '/doctor';
    case 'ADMIN':
    default:
      return '/';
  }
}