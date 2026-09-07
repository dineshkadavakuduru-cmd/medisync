'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, roleHomePath, UserRole, DEMO_PERSONAS } from '@/context/AuthContext';

interface HeaderProps {
  onMenuToggle?: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  PATIENT: 'Patient Portal',
  ASHA: 'ASHA Field Portal',
  DOCTOR: 'Clinical Cockpit',
  ADMIN: 'District Command Centre',
};

export function Header({ onMenuToggle }: HeaderProps) {
  const [now, setNow] = useState(Date.now());
  const { user, role, switchRole, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

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

  const titleLabel = role ? ROLE_LABEL[role] : 'District Command Centre';
  const facilityLabel = user?.facilityOrLocation || 'Pune District';
  const initials = (user?.name || 'AD')
  .split(' ')
  .map((s) => s[0])
  .filter(Boolean)
  .slice(0, 2)
  .join('')
  .toUpperCase();

  const onSwitch = (r: UserRole) => {
    switchRole(r);
    setOpen(false);
    router.push(roleHomePath(r));
  };

  return (
    <header className="h-14 sm:h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-[var(--color-text-primary)] truncate">
          {titleLabel}
        </h2>
        <span className="hidden sm:inline-flex px-2 sm:px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
          {facilityLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[var(--color-card-bg)] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Live</span>
        </div>

        <div className="hidden lg:block text-xs text-[var(--color-text-secondary)] font-mono">
          {formatDateTime(new Date(now))}
        </div>

        {/* Persona switcher */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors"
            aria-label="Switch persona"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs sm:text-sm font-medium">
              {user?.avatar ? (
                <span aria-hidden>{user.avatar}</span>
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] truncate max-w-[140px]">
                {user?.name || 'District Admin'}
              </span>
              <span className="text-[10px] sm:text-xs text-[var(--color-text-secondary)]">
                {role ? ROLE_LABEL[role] : 'Admin'} • Switch ▾
              </span>
            </div>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-72 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-20">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)]">Switch active role</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {user?.name || 'Guest'}
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {DEMO_PERSONAS.map((p) => {
                  const active = p.role === role;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSwitch(p.role)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-card-bg)] transition-colors ${
                        active ? 'bg-[var(--color-primary-light)]' : ''
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                        style={{ background: `${p.accent}20`, color: p.accent }}
                      >
                        <span aria-hidden>{p.avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">
                          {p.title}
                        </p>
                      </div>
                      {active && (
                        <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase">Active</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center justify-between">
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                    router.push('/login');
                  }}
                  className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
                >
                  Sign out
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push('/login');
                  }}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  Change persona →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}