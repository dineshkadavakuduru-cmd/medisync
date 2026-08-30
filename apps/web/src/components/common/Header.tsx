'use client';

import React, { useState, useEffect } from 'react';

export function Header() {
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
    <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">District Command Centre</h2>
        <span className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full text-sm font-medium">
          Pune District
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[var(--color-card-bg)] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Live</span>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)] font-mono">
          {formatDateTime(new Date(now))}
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors">
            🔔
          </button>
          <button className="p-2 rounded-lg hover:bg-[var(--color-card-bg)] transition-colors">
            🌐
          </button>
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-medium">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
