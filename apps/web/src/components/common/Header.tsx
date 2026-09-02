'use client';

import React, { useState, useEffect } from 'react';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const [now, setNow] = useState(Date.now());

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
    <header className="h-14 sm:h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-[var(--color-text-primary)] truncate">District Command Centre</h2>
        <span className="hidden sm:inline-flex px-2 sm:px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
          Pune District
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[var(--color-card-bg)] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Live</span>
        </div>

        <div className="hidden sm:block text-xs text-[var(--color-text-secondary)] font-mono">
          {formatDateTime(new Date(now))}
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <button className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors">
            🔔
          </button>
          <button className="hidden sm:block p-2 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors">
            🌐
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs sm:text-sm font-medium">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
