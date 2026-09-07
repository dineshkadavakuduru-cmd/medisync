'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEMO_PERSONAS, useAuth, roleHomePath, UserRole } from '@/context/AuthContext';

type Tab = 'demo' | 'standard';

export default function LoginPage() {
  const router = useRouter();
  const { loginAsPersona, switchRole, isAuthenticated, role } = useAuth();
  const [tab, setTab] = useState<Tab>('demo');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Standard login state
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [standardRole, setStandardRole] = useState<UserRole>('PATIENT');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && role) {
      router.replace(roleHomePath(role));
    }
  }, [isAuthenticated, role, router]);

  const onLoginPersona = (personaId: string) => {
    loginAsPersona(personaId);
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (persona) {
      router.push(roleHomePath(persona.role));
    }
  };

  const onSendOtp = () => {
    setError(null);
    if (!/^\+?\d{10,13}$/.test(phone.replace(/\s/g, ''))) {
      setError('Please enter a valid mobile number (10-13 digits).');
      return;
    }
    setOtpSent(true);
  };

  const onVerifyOtp = () => {
    setError(null);
    if (!/^\d{4,6}$/.test(otp)) {
      setError('OTP should be 4-6 digits.');
      return;
    }
    // Map role to demo persona for instant access
    const persona = DEMO_PERSONAS.find((p) => p.role === standardRole);
    if (persona) {
      switchRole(standardRole);
      router.push(roleHomePath(standardRole));
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #004D40 0%, #00695C 50%, #00897B 100%)' }}>
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between text-white">
        <Link href="/welcome" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
            <span className="text-white text-lg">🏥</span>
          </div>
          <span className="text-xl font-bold">MediSync</span>
        </Link>
        <Link href="/welcome" className="text-sm opacity-80 hover:opacity-100 transition-opacity">
          ← Back to landing
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center text-white mb-8">
          <p className="text-xs sm:text-sm uppercase tracking-widest opacity-80 mb-2">Smart India Hackathon 2026 • PS26133</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">Sign in to MediSync</h1>
          <p className="text-white/80 mt-3 max-w-2xl mx-auto text-sm sm:text-base">
            One unified platform for Patients, ASHA workers, Doctors and District Administrators.
            Choose your role to continue.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl mx-auto">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab('demo')}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm sm:text-base font-semibold transition-colors ${
                tab === 'demo' ? 'text-[#00695C] border-b-2 border-[#00695C]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🚀 1-Click SIH Jury Demo
            </button>
            <button
              onClick={() => setTab('standard')}
              className={`flex-1 px-4 sm:px-6 py-4 text-sm sm:text-base font-semibold transition-colors ${
                tab === 'standard' ? 'text-[#00695C] border-b-2 border-[#00695C]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🔐 Standard Phone Login
            </button>
          </div>

          <div className="p-5 sm:p-8">
            {tab === 'demo' && (
              <div>
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-bold text-gray-800">Pick a persona to demo</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Instantly sign in as a pre-built SIH jury persona — no typing required.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {DEMO_PERSONAS.map((p) => {
                    const selected = selectedPersonaId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPersonaId(p.id)}
                        onDoubleClick={() => onLoginPersona(p.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                          selected ? 'border-[#00695C] shadow-md bg-[#E0F2F1]' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                            style={{ background: `${p.accent}20`, color: p.accent }}
                          >
                            <span aria-hidden>{p.avatar}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500 truncate">{p.title}</p>
                            <p className="text-xs text-gray-400 mt-1 truncate">📍 {p.facilityOrLocation}</p>
                            {p.abhaId && (
                              <p className="text-xs text-gray-400 truncate">🆔 {p.abhaId}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mt-3 leading-relaxed">{p.description}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[#F5F5F5] rounded-xl">
                  <div className="text-sm text-gray-600">
                    {selectedPersonaId ? (
                      <>
                        Ready to sign in as{' '}
                        <span className="font-bold text-[#00695C]">
                          {DEMO_PERSONAS.find((p) => p.id === selectedPersonaId)?.name}
                        </span>
                      </>
                    ) : (
                      <>Select a persona above or tap a card to sign in instantly.</>
                    )}
                  </div>
                  <button
                    onClick={() => selectedPersonaId && onLoginPersona(selectedPersonaId)}
                    disabled={!selectedPersonaId}
                    className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${
                      selectedPersonaId
                        ? 'bg-[#00695C] text-white hover:bg-[#004D40]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Sign In & Continue →
                  </button>
                </div>
              </div>
            )}

            {tab === 'standard' && (
              <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Phone & OTP Login</h2>
                  <p className="text-sm text-gray-500 mt-1">Use your ABHA-linked mobile number.</p>
                </div>

                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mobile Number</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98XXXXXXXX"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00695C] focus:border-transparent text-gray-800"
                    disabled={otpSent}
                  />
                  {!otpSent ? (
                    <button
                      onClick={onSendOtp}
                      className="px-4 py-2.5 bg-[#00695C] text-white rounded-lg font-semibold hover:bg-[#004D40] transition-colors whitespace-nowrap"
                    >
                      Send OTP
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                      }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <label className="block text-xs font-semibold text-gray-600 mb-1.5 mt-4">I am signing in as</label>
                <select
                  value={standardRole}
                  onChange={(e) => setStandardRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00695C] focus:border-transparent text-gray-800 bg-white"
                >
                  <option value="PATIENT">👨‍🌾 Patient</option>
                  <option value="ASHA">👩‍⚕️ ASHA Field Worker</option>
                  <option value="DOCTOR">👨‍⚕️ Doctor</option>
                  <option value="ADMIN">🏛️ District Administrator</option>
                </select>

                {otpSent && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Enter OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00695C] focus:border-transparent text-gray-800 tracking-widest text-center text-lg font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Demo OTP <span className="font-mono font-semibold">123456</span> will be accepted.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 mt-3">⚠️ {error}</p>
                )}

                {otpSent && (
                  <button
                    onClick={onVerifyOtp}
                    className="mt-6 w-full px-6 py-3 bg-[#00695C] text-white rounded-lg font-semibold hover:bg-[#004D40] transition-colors"
                  >
                    Verify & Sign In →
                  </button>
                )}

                <p className="text-xs text-gray-500 mt-4 text-center">
                  By signing in you agree to MediSync&apos;s demo terms. This is a SIH jury demonstration environment.
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-white/70 text-xs mt-6">
          Built for SIH 2026 — PS26133 (Government of Maharashtra) • No real patient data is processed.
        </p>
      </div>
    </div>
  );
}