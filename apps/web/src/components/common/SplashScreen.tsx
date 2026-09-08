'use client';

import React, { useState, useEffect } from 'react';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this session
    const shown = sessionStorage.getItem('medisync_splash_shown');
    if (shown) {
      setVisible(false);
      return;
    }

    // Auto-dismiss after 2.2 seconds
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1800);

    const removeTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('medisync_splash_shown', 'true');
    }, 2300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      onClick={() => {
        setFading(true);
        setTimeout(() => {
          setVisible(false);
          sessionStorage.setItem('medisync_splash_shown', 'true');
        }, 300);
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-500 cursor-pointer select-none ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center justify-center flex-1">
        {/* Animated Logo Container with Spring Scale */}
        <div className="w-48 h-48 sm:w-56 sm:h-56 relative animate-[bounce_1.5s_ease-out]">
          <img
            src="/medisync-logo.png"
            alt="MediSync Logo"
            className="w-full h-full object-contain rounded-2xl drop-shadow-md"
          />
        </div>

        {/* Tagline */}
        <p className="mt-6 text-base sm:text-lg font-medium text-[#00695C] tracking-wide text-center px-4">
          Bridging Rural Healthcare with AI
        </p>
      </div>

      {/* Footer */}
      <div className="pb-12 flex flex-col items-center gap-2.5">
        <p className="text-xs text-[#9E9E9E] tracking-wider uppercase font-medium">
          Powered by AI • PS26133
        </p>
        <div className="bg-[#00695C] px-5 py-1.5 rounded-full shadow-sm">
          <span className="text-white text-xs font-bold tracking-widest uppercase">
            SIH 2026
          </span>
        </div>
      </div>
    </div>
  );
}
