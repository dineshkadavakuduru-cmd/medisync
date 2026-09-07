'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth, roleHomePath } from '@/context/AuthContext';
import { showToast } from '@/components/common/Toast';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  timing: string[];
  instructions: string;
  doctor: string;
  refillIn: number;
}

interface LabReport {
  id: string;
  test: string;
  status: 'NORMAL' | 'ABNORMAL' | 'CRITICAL';
  date: string;
  facility: string;
  downloadUrl?: string;
}

interface Referral {
  id: string;
  from: string;
  to: string;
  status: 'in-transit' | 'accepted' | 'completed';
  transferCode: string;
  condition: string;
}

const MEDICATIONS: Medication[] = [
  {
    id: 'm1',
    name: 'Metformin',
    dosage: '500 mg',
    timing: ['Morning', 'Night'],
    instructions: 'After meals. Avoid alcohol.',
    doctor: 'Dr. Anita Deshmukh',
    refillIn: 5,
  },
  {
    id: 'm2',
    name: 'Amlodipine',
    dosage: '5 mg',
    timing: ['Morning'],
    instructions: 'For blood pressure control. Monitor BP daily.',
    doctor: 'Dr. Anita Deshmukh',
    refillIn: 12,
  },
  {
    id: 'm3',
    name: 'Iron + Folic Acid',
    dosage: '1 tab',
    timing: ['Noon'],
    instructions: 'Avoid tea/coffee within 1 hour.',
    doctor: 'Dr. Anita Deshmukh',
    refillIn: 18,
  },
];

const LABS: LabReport[] = [
  { id: 'l1', test: 'HbA1c', status: 'ABNORMAL', date: '2026-09-02', facility: 'District Hospital Pune' },
  { id: 'l2', test: 'Lipid Profile', status: 'NORMAL', date: '2026-09-02', facility: 'District Hospital Pune' },
  { id: 'l3', test: 'CBC', status: 'NORMAL', date: '2026-08-28', facility: 'PHC Khed' },
  { id: 'l4', test: 'Serum Creatinine', status: 'CRITICAL', date: '2026-09-05', facility: 'District Hospital Pune' },
];

const REFERRAL: Referral = {
  id: 'r1',
  from: 'Sub-Centre Khed',
  to: 'District Hospital Pune',
  status: 'accepted',
  transferCode: 'TX-9F2C-ABHA-7042',
  condition: 'Diabetic Nephropathy Follow-up',
};

export default function PatientDashboard() {
  const { user, switchRole } = useAuth();
  const [queueToken] = useState({ token: 7, ahead: 3, eta: 18, facility: 'PHC Khed' });
  const [now, setNow] = useState(Date.now());
  const [sosActive, setSosActive] = useState(false);
  const [sosStage, setSosStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sosActive) return;
    const stages = [0, 1, 2, 3];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % stages.length;
      setSosStage(i);
    }, 2500);
    return () => clearInterval(t);
  }, [sosActive]);

  const etaDisplay = useMemo(() => {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() + queueToken.eta);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, [now, queueToken.eta]);

  const triggerSOS = () => {
    setSosActive(true);
    setSosStage(0);
    showToast('🚨 SOS sent. Ambulance dispatched. Sharing GPS with district control.', 'danger');
  };

  const cancelSOS = () => {
    setSosActive(false);
    setSosStage(0);
    showToast('SOS cancelled.', 'info');
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Good day,</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{user.name} 🙏</h1>
          <p className="text-sm text-gray-500 mt-1">Your unified health portal • {user.facilityOrLocation}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/appointments" className="px-4 py-2 bg-[#00695C] text-white rounded-lg text-sm font-semibold hover:bg-[#004D40]">
            📅 My Appointments
          </Link>
          <Link href="/teleconsult" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
            📹 Teleconsult
          </Link>
        </div>
      </div>

      {/* ABHA Digital Health Locker */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />
        <div className="relative p-5 sm:p-6 text-white grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🪪</span>
              <span className="text-xs uppercase tracking-widest opacity-80">Ayushman Bharat Health Account</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold tracking-wider">{user.abhaId}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div>
                <p className="text-[10px] uppercase opacity-70">Name</p>
                <p className="font-semibold text-sm truncate">{user.name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-70">Blood Group</p>
                <p className="font-semibold text-sm">B+</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-70">Age / Gender</p>
                <p className="font-semibold text-sm">52 / Male</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-70">Emergency</p>
                <p className="font-semibold text-sm truncate">+91 98221 33445</p>
              </div>
            </div>
          </div>
          <div className="flex md:justify-end items-center">
            <div className="bg-white p-3 rounded-lg">
              {/* Faux QR */}
              <div className="grid grid-cols-8 gap-0.5 w-24 h-24">
                {Array.from({ length: 64 }).map((_, i) => {
                  const filled = ((i * 13 + 7) % 5) < 3;
                  return (
                    <div key={i} className={filled ? 'bg-black' : 'bg-white'} />
                  );
                })}
              </div>
              <p className="text-[10px] text-center text-gray-600 mt-1 font-mono">Scan at any facility</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live queue + SOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Live OPD Queue</p>
              <h3 className="text-lg font-bold text-gray-800 mt-1">Token #{queueToken.token} — {queueToken.facility}</h3>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">● Live</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="p-3 bg-[#E0F2F1] rounded-lg text-center">
              <p className="text-3xl font-bold text-[#00695C]">{queueToken.ahead}</p>
              <p className="text-xs text-gray-600 mt-1">Patients ahead</p>
            </div>
            <div className="p-3 bg-[#FFF8E1] rounded-lg text-center">
              <p className="text-3xl font-bold text-[#FF8F00]">~{queueToken.eta}m</p>
              <p className="text-xs text-gray-600 mt-1">Estimated wait</p>
            </div>
            <div className="p-3 bg-[#E3F2FD] rounded-lg text-center">
              <p className="text-lg font-bold text-[#1565C0]">{etaDisplay}</p>
              <p className="text-xs text-gray-600 mt-1">Expected time</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            📍 You&apos;re in queue for <strong>Dr. Anita Deshmukh</strong> — General Medicine. SMS reminders will be sent 5 minutes before your turn.
          </div>
        </div>

        <div className={`card border-2 ${sosActive ? 'border-red-500 bg-red-50' : 'border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🆘</span>
            <h3 className="font-bold text-gray-800">Emergency SOS</h3>
          </div>
          {!sosActive ? (
            <>
              <p className="text-sm text-gray-600 mb-4">1-tap ambulance dispatch with live GPS tracking to district control.</p>
              <button
                onClick={triggerSOS}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-base animate-pulse"
              >
                🚑 REQUEST AMBULANCE NOW
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-red-700 mb-3">🚨 SOS ACTIVE — Ambulance MH-12-AB-4421 dispatched</p>
              <div className="space-y-2 mb-3">
                {['📞 Connecting to control room', '🚑 Ambulance dispatched (ETA 7 min)', '📡 Live GPS shared', '🏥 District Hospital Pune alerted'].map((step, i) => (
                  <div key={i} className={`text-xs flex items-center gap-2 ${sosStage >= i ? 'text-green-700' : 'text-gray-400'}`}>
                    <span>{sosStage >= i ? '✅' : '⏳'}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <button onClick={cancelSOS} className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
                Cancel SOS
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active Prescriptions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">💊 Active Prescriptions</h3>
          <Link href="/diagnostics" className="text-xs text-[#00695C] font-semibold hover:underline">View history →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MEDICATIONS.map((m) => (
            <div key={m.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.dosage}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-[#E0F2F1] text-[#00695C] rounded-full font-semibold">
                  Refill in {m.refillIn}d
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {m.timing.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 bg-white border border-gray-200 rounded">{t}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">{m.instructions}</p>
              <p className="text-xs text-gray-400 mt-2">Prescribed by {m.doctor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Diagnostic Reports */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">🔬 Lab & Diagnostic Reports</h3>
          <Link href="/diagnostics" className="text-xs text-[#00695C] font-semibold hover:underline">All reports →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b">
                <th className="py-2">Test</th>
                <th className="py-2">Date</th>
                <th className="py-2">Facility</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {LABS.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-3 font-semibold text-gray-800">{l.test}</td>
                  <td className="py-3 text-gray-600">{l.date}</td>
                  <td className="py-3 text-gray-600">{l.facility}</td>
                  <td className="py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      l.status === 'NORMAL' ? 'bg-green-100 text-green-700' :
                      l.status === 'ABNORMAL' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700 animate-pulse'
                    }`}>{l.status}</span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => showToast(`Downloading ${l.test} report...`, 'info')} className="text-xs text-[#00695C] font-semibold hover:underline">⬇ Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Referral Tracker */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-800 mb-1">🔁 Active Referral</h3>
        <p className="text-xs text-gray-500 mb-4">{REFERRAL.condition}</p>

        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {[
            { label: REFERRAL.from, status: 'done' },
            { label: 'PHC Khed', status: 'done' },
            { label: REFERRAL.to, status: 'current' },
            { label: 'Specialist Consult', status: 'pending' },
          ].map((step, i, arr) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center min-w-[120px]">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  step.status === 'done' ? 'bg-green-500 text-white' :
                  step.status === 'current' ? 'bg-blue-500 text-white animate-pulse' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step.status === 'done' ? '✓' : i + 1}
                </div>
                <p className="text-xs text-center mt-2 font-semibold text-gray-700">{step.label}</p>
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-1 rounded ${step.status === 'done' ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-5 p-3 bg-[#E3F2FD] rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Inter-Facility Transfer Code</p>
            <p className="font-mono font-bold text-[#1565C0]">{REFERRAL.transferCode}</p>
          </div>
          <button
            onClick={() => showToast('Transfer code copied to clipboard.', 'success')}
            className="px-3 py-1.5 bg-[#1565C0] text-white text-xs rounded font-semibold hover:bg-[#0D47A1]"
          >
            Copy Code
          </button>
        </div>
      </div>

      {/* Teleconsult quick join */}
      <div className="card bg-gradient-to-r from-[#E0F2F1] to-white border border-[#00695C]/30">
        <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
          <div>
            <p className="text-xs uppercase text-[#00695C] font-bold">📹 Upcoming Teleconsult</p>
            <h3 className="text-lg font-bold text-gray-800 mt-1">Dr. Anita Deshmukh • Today 4:30 PM</h3>
            <p className="text-sm text-gray-600">Diabetes follow-up • 15 min slot</p>
          </div>
          <button
            onClick={() => { switchRole('DOCTOR'); }}
            className="px-5 py-2.5 bg-[#00695C] text-white rounded-lg font-semibold hover:bg-[#004D40] whitespace-nowrap"
          >
            Join 1-Click Video Call →
          </button>
        </div>
      </div>
    </div>
  );
}