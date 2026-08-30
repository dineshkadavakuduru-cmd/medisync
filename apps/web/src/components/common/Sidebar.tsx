'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'AI Triage', href: '/triage', icon: '🤖' },
  { name: 'Facilities', href: '/facilities', icon: '🏥' },
  { name: 'Patients', href: '/patients', icon: '👥' },
  { name: 'Analytics', href: '/analytics', icon: '📊' },
  { name: 'Emergency Centre', href: '/alerts', icon: '🚨' },
];

export function Sidebar() {
  const pathname = usePathname();
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

  return (
    <aside className="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-full">
      {/* Branding */}
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <span className="text-white text-xl">🏥</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">ArogyaSetu+</h1>
            <p className="text-xs text-[var(--color-text-secondary)]">District Command Centre</p>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#00695C] to-transparent rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const isEmergency = item.name === 'Emergency Centre';
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
                isActive
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-l-[3px] border-l-[#00695C]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg)] hover:text-[var(--color-text-primary)] border-l-[3px] border-l-transparent'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium flex-1">{item.name}</span>
              {isEmergency && activeTotal > 0 && (
                <>
                  <span className={`relative flex h-3 w-3 ${activeLevel1 > 0 ? 'animate-ping' : ''}`}>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${activeLevel1 > 0 ? 'bg-red-500' : 'bg-red-500'}`}></span>
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

      {/* Date/Time & Footer */}
      <div className="p-4 border-t border-[var(--color-border)] space-y-3">
        <div className="text-xs text-[var(--color-text-secondary)] text-center font-mono">
          {formatDateTime(new Date(now))}
        </div>
        <Link href="/welcome" className="block text-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">
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
