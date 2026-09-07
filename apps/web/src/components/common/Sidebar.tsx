'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  emergency?: boolean;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  PATIENT: [
    { name: 'My Health', href: '/patient', icon: '🩺' },
    { name: 'Medical Records & ABHA', href: '/patients', icon: '📂' },
    { name: 'Appointments & Queue', href: '/appointments', icon: '📅' },
    { name: 'Prescriptions & Meds', href: '/diagnostics', icon: '💊' },
    { name: 'Lab Reports', href: '/diagnostics', icon: '🔬' },
    { name: 'Teleconsult', href: '/teleconsult', icon: '📹' },
    { name: 'Emergency SOS', href: '/alerts', icon: '🚨', emergency: true },
  ],
  ASHA: [
    { name: 'Field Dashboard', href: '/asha', icon: '🩺' },
    { name: 'Register Patient', href: '/patients', icon: '➕' },
    { name: 'AI Symptom Triage', href: '/triage', icon: '🤖' },
    { name: 'Teleconsult Request', href: '/teleconsult', icon: '📹' },
    { name: 'Referrals', href: '/appointments', icon: '🔁' },
    { name: 'Facilities Map', href: '/facilities', icon: '🏥' },
    { name: 'Emergency Centre', href: '/alerts', icon: '🚨', emergency: true },
  ],
  DOCTOR: [
    { name: 'Clinical Cockpit', href: '/doctor', icon: '🩺' },
    { name: "Today's Patient Queue", href: '/appointments', icon: '🧑‍⚕️' },
    { name: 'Teleconsultations', href: '/teleconsult', icon: '📹' },
    { name: 'Diagnostics & Labs', href: '/diagnostics', icon: '🔬' },
    { name: 'Patient Records', href: '/patients', icon: '📂' },
    { name: 'Facilities', href: '/facilities', icon: '🏥' },
    { name: 'Emergency Centre', href: '/alerts', icon: '🚨', emergency: true },
  ],
  ADMIN: [
    { name: 'Command Centre', href: '/', icon: '🏠' },
    { name: 'AI Triage', href: '/triage', icon: '🤖' },
    { name: 'Teleconsult', href: '/teleconsult', icon: '📹' },
    { name: 'Appointments', href: '/appointments', icon: '📅' },
    { name: 'Diagnostics', href: '/diagnostics', icon: '🔬' },
    { name: 'Facilities', href: '/facilities', icon: '🏥' },
    { name: 'Patients', href: '/patients', icon: '👥' },
    { name: 'Analytics', href: '/analytics', icon: '📊' },
    { name: 'Emergency Centre', href: '/alerts', icon: '🚨', emergency: true },
  ],
};

const ROLE_BRAND: Record<UserRole, { title: string; subtitle: string; accent: string }> = {
  PATIENT: { title: 'MediSync', subtitle: 'Patient Portal', accent: '#1565C0' },
  ASHA: { title: 'MediSync', subtitle: 'ASHA Field Portal', accent: '#7B1FA2' },
  DOCTOR: { title: 'MediSync', subtitle: 'Clinical Cockpit', accent: '#00695C' },
  ADMIN: { title: 'MediSync', subtitle: 'District Command Centre', accent: '#00695C' },
};

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();
  const [activeTotal, setActiveTotal] = useState(0);
  const [activeLevel1, setActiveLevel1] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/emergencies/stats');
        const data = await res.json();
        if (data.success) {
          setActiveTotal(data.data.active.total);
          setActiveLevel1(data.data.active.level1);
        }
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const navRole: UserRole = role || 'ADMIN';
  const navigation = NAV_BY_ROLE[navRole];
  const brand = ROLE_BRAND[navRole];

  return (
    <aside className="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: brand.accent }}
          >
            <span className="text-white text-xl">🏥</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">{brand.title}</h1>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">{brand.subtitle}</p>
          </div>
        </div>
        <div
          className="h-0.5 rounded-full"
          style={{
            background: `linear-gradient(to right, ${brand.accent} 0%, transparent 100%)`,
          }}
        />
      </div>

      <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const isEmergency = item.emergency;
          return (
            <Link
              key={`${navRole}-${item.name}`}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors relative ${
                isActive
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-l-[3px]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg)] hover:text-[var(--color-text-primary)] border-l-[3px] border-l-transparent'
              }`}
              style={
                isActive
                  ? { borderLeftColor: brand.accent }
                  : undefined
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium flex-1">{item.name}</span>
              {isEmergency && activeTotal > 0 && (
                <>
                  <span className={`relative flex h-3 w-3 ${activeLevel1 > 0 ? 'animate-ping' : ''}`}>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className={`bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold ${activeLevel1 > 0 ? 'animate-pulse' : ''}`}>
                    {activeTotal}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 sm:p-4 border-t border-[var(--color-border)] space-y-2 sm:space-y-3">
        <div className="text-xs text-[var(--color-text-secondary)] text-center font-mono hidden sm:block">
          {formatDateTime(new Date(now))}
        </div>
        <Link href="/welcome" onClick={onClose} className="block text-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">
          View Landing Page →
        </Link>
        <div className="text-xs text-[var(--color-text-secondary)] text-center">
          SIH 2026 • PS26133
        </div>
        <div className="text-xs text-[var(--color-text-secondary)] text-center opacity-70">
          v1.0
        </div>
      </div>
    </aside>
  );
}