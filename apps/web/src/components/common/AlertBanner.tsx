'use client';

import React from 'react';

interface AlertBannerProps {
  message?: string;
  onDismiss?: () => void;
}

export function AlertBanner({ message = 'Emergency Escalation Active', onDismiss }: AlertBannerProps) {
  return (
    <div className="bg-[var(--color-emergency)] text-white px-6 py-3 flex items-center justify-between rounded-lg mb-6 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🚨</span>
        <span className="font-semibold text-lg">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}