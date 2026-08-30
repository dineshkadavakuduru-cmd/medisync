'use client';

import React, { useEffect, useState } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'danger';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let addToast: ((message: string, type: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = 'info') {
  addToast?.(message, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToast = (message: string, type: ToastType) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { addToast = null; };
  }, []);

  const typeColors: Record<ToastType, string> = {
    info: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  };

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: 'var(--surface)',
            borderRadius: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            display: 'flex',
            animation: 'slideIn 0.3s ease-out',
            borderLeft: `4px solid ${typeColors[toast.type]}`,
          }}
        >
          <div style={{ padding: '14px 16px' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>{toast.message}</p>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
