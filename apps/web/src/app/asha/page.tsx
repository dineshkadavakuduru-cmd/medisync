'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/common/Toast';

interface FollowUp {
  id: string;
  name: string;
  age: number;
  type: 'ANC' | 'CHRONIC';
  condition: string;
  nextDue: string;
  priority: 'high' | 'medium' | 'low';
  village: string;
}

interface SyncItem {
  id: string;
  type: string;
  patient: string;
  queuedAt: string;
  size: string;
}

const FOLLOW_UPS: FollowUp[] = [
  { id: 'f1', name: 'Sunita Pawar', age: 26, type: 'ANC', condition: 'Pregnancy 28 weeks', nextDue: 'Today', priority: 'high', village: 'Khed' },
  { id: 'f2', name: 'Lata Sawant', age: 24, type: 'ANC', condition: 'Pregnancy 16 weeks', nextDue: 'In 2 days', priority: 'medium', village: 'Chakan' },
  { id: 'f3', name: 'Bhausaheb Patil', age: 67, type: 'CHRONIC', condition: 'Hypertension', nextDue: 'Tomorrow', priority: 'high', village: 'Khed' },
  { id: 'f4', name: 'Rukmini Deshmukh', age: 71, type: 'CHRONIC', condition: 'Type 2 Diabetes', nextDue: 'In 3 days', priority: 'medium', village: 'Alandi' },
  { id: 'f5', name: 'Meera Joshi', age: 30, type: 'ANC', condition: 'Post-natal day 7', nextDue: 'Overdue 1d', priority: 'high', village: 'Khed' },
];

const SYNC_QUEUE: SyncItem[] = [
  { id: 's1', type: 'Vitals upload', patient: 'Suresh Mane', queuedAt: '2m ago', size: '12 KB' },
  { id: 's2', type: 'Patient registration', patient: 'Anita Kamble', queuedAt: '5m ago', size: '4 KB' },
  { id: 's3', type: 'ANC visit note', patient: 'Sunita Pawar', queuedAt: '11m ago', size: '8 KB' },
];

const QUICK_PHRASES = [
  { mr: 'तुमच्या प्रकृतीची काळजी घ्या', hi: 'अपना खयाल रखें', en: 'Take care of your health' },
  { mr: 'औषध वेळेवर घ्या', hi: 'दवाई समय पर लें', en: 'Take medicines on time' },
  { mr: 'पुढच्या भेटीसाठी या', hi: 'अगली मुलाकात के लिए आएं', en: 'Come for next visit' },
];

export default function AshaDashboard() {
  const { user } = useAuth();
  const [online, setOnline] = useState(true);
  const [synced, setSynced] = useState(42);
  const [pending, setPending] = useState(SYNC_QUEUE.length);
  const [showRegister, setShowRegister] = useState(false);
  const [showTriage, setShowTriage] = useState(false);
  const [reg, setReg] = useState({ name: '', phone: '', village: 'Khed', gender: 'F' });
  const [vitals, setVitals] = useState({ bp: '', spo2: '', pulse: '', sugar: '' });
  const [triageResult, setTriageResult] = useState<null | { level: 'GREEN' | 'YELLOW' | 'RED'; message: string }>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const syncNow = () => {
    if (!online) {
      showToast('Offline — sync will resume when network returns.', 'warning');
      return;
    }
    setSynced((s) => s + pending);
    setPending(0);
    showToast(`Synced ${SYNC_QUEUE.length} pending records to MediSync server.`, 'success');
  };

  const submitRegistration = () => {
    if (!reg.name || !reg.phone) {
      showToast('Name and phone are required.', 'warning');
      return;
    }
    showToast(`✅ ABHA created for ${reg.name} (${reg.village}). Saved offline.`, 'success');
    setShowRegister(false);
    setReg({ name: '', phone: '', village: 'Khed', gender: 'F' });
    setPending((p) => p + 1);
  };

  const runTriage = () => {
    const sbp = parseInt(vitals.bp.split('/')[0] || '0', 10);
    const spo2v = parseInt(vitals.spo2 || '0', 10);
    const sugar = parseInt(vitals.sugar || '0', 10);
    let level: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    let message = 'GREEN — Routine follow-up at PHC within 7 days.';
    if (sbp >= 160 || spo2v < 92 || sugar >= 250) {
      level = 'RED';
      message = '🚨 RED — Critical. Request doctor teleconsult immediately and prep ambulance referral.';
    } else if (sbp >= 140 || spo2v < 95 || sugar >= 180) {
      level = 'YELLOW';
      message = '⚠️ YELLOW — Needs PHC visit within 24 hours. Refer to PHC Khed.';
    }
    setTriageResult({ level, message });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Namaskar,</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{user.name} 🙏</h1>
          <p className="text-sm text-gray-500 mt-1">{user.title} • {user.facilityOrLocation}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowRegister(true)} className="px-4 py-2 bg-[#7B1FA2] text-white rounded-lg text-sm font-semibold hover:bg-[#6A1B9A]">
            ➕ Quick Register
          </button>
          <button onClick={() => setShowTriage(true)} className="px-4 py-2 bg-[#00695C] text-white rounded-lg text-sm font-semibold hover:bg-[#004D40]">
            🤖 AI Triage
          </button>
          <Link href="/teleconsult" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
            📹 Request Doctor
          </Link>
        </div>
      </div>

      {/* Sync Status + Network */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500">Network</p>
          <p className={`text-xl font-bold ${online ? 'text-green-600' : 'text-red-600'}`}>{online ? '📶 Online' : '📵 Offline'}</p>
          <p className="text-xs text-gray-500 mt-1">Auto-sync enabled</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Synced Today</p>
          <p className="text-3xl font-bold text-gray-800">{synced}</p>
          <p className="text-xs text-green-600 mt-1">↑ records uploaded</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Pending Sync</p>
          <p className="text-3xl font-bold text-orange-600">{pending}</p>
          <p className="text-xs text-gray-500 mt-1">in local queue</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Households Mapped</p>
          <p className="text-3xl font-bold text-gray-800">187</p>
          <p className="text-xs text-gray-500 mt-1">3 villages</p>
        </div>
      </div>

      {/* Pending Sync Queue */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-800">📥 Pending Sync Queue (IndexedDB)</h3>
          <button onClick={syncNow} disabled={pending === 0} className="px-3 py-1.5 bg-[#00695C] text-white text-xs rounded-lg font-semibold hover:bg-[#004D40] disabled:bg-gray-300">
            Sync Now →
          </button>
        </div>
        {pending === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">✅ All records synced.</p>
        ) : (
          <div className="space-y-2">
            {SYNC_QUEUE.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.type} — {s.patient}</p>
                  <p className="text-xs text-gray-500">Queued {s.queuedAt} • {s.size}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-orange-200 text-orange-800 rounded-full font-semibold">Waiting</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Follow-up list */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">🤰 High-Risk Follow-ups</h3>
            <Link href="/patients" className="text-xs text-[#00695C] font-semibold hover:underline">All patients →</Link>
          </div>
          <div className="space-y-2">
            {FOLLOW_UPS.map((f) => {
              const color = f.priority === 'high' ? 'red' : f.priority === 'medium' ? 'yellow' : 'gray';
              return (
                <div key={f.id} className={`p-3 rounded-lg border-l-4 ${
                  color === 'red' ? 'bg-red-50 border-red-500' :
                  color === 'yellow' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{f.name} <span className="text-xs text-gray-500">({f.age}y • {f.village})</span></p>
                      <p className="text-xs text-gray-600">{f.type === 'ANC' ? '🤰' : '💊'} {f.condition}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        color === 'red' ? 'bg-red-200 text-red-800' :
                        color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-gray-200 text-gray-700'
                      }`}>{f.nextDue}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick phrases & field tools */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-3">🗣️ Quick Phrases (MR/HI/EN)</h3>
          <div className="space-y-2">
            {QUICK_PHRASES.map((p, i) => (
              <div key={i} className="p-3 bg-[#F3E5F5] rounded-lg">
                <p className="text-sm font-semibold text-gray-800">{p.mr}</p>
                <p className="text-xs text-gray-600">{p.hi}</p>
                <p className="text-xs text-gray-500 italic mt-0.5">{p.en}</p>
              </div>
            ))}
          </div>
          <button onClick={() => showToast('Voice recording started (demo).', 'info')} className="mt-3 w-full py-2 bg-[#7B1FA2] text-white rounded-lg text-sm font-semibold hover:bg-[#6A1B9A]">
            🎤 Record Voice Note
          </button>
        </div>
      </div>

      {/* Quick Register modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-1">➕ Quick Patient Registration</h3>
            <p className="text-xs text-gray-500 mb-4">Auto-creates ABHA ID • Works offline</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
            <input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3" placeholder="Patient name" />
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
            <input value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3" placeholder="+91 ..." />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Village</label>
                <select value={reg.village} onChange={(e) => setReg({ ...reg, village: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Khed</option>
                  <option>Chakan</option>
                  <option>Alandi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
                <select value={reg.gender} onChange={(e) => setReg({ ...reg, gender: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowRegister(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold">Cancel</button>
              <button onClick={submitRegistration} className="flex-1 py-2 bg-[#7B1FA2] text-white rounded-lg font-semibold">Register</button>
            </div>
          </div>
        </div>
      )}

      {/* Triage modal */}
      {showTriage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowTriage(false); setTriageResult(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-1">🤖 AI Symptom Triage</h3>
            <p className="text-xs text-gray-500 mb-4">Enter field vitals. AI will recommend action.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">BP (mmHg)</label>
                <input value={vitals.bp} onChange={(e) => setVitals({ ...vitals, bp: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="120/80" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SpO2 (%)</label>
                <input value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="98" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pulse (bpm)</label>
                <input value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="72" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sugar (mg/dL)</label>
                <input value={vitals.sugar} onChange={(e) => setVitals({ ...vitals, sugar: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="110" />
              </div>
            </div>
            <button onClick={runTriage} className="mt-5 w-full py-2.5 bg-[#00695C] text-white rounded-lg font-semibold">Run AI Triage</button>
            {triageResult && (
              <div className={`mt-4 p-3 rounded-lg border-l-4 ${
                triageResult.level === 'RED' ? 'bg-red-50 border-red-500' :
                triageResult.level === 'YELLOW' ? 'bg-yellow-50 border-yellow-500' :
                'bg-green-50 border-green-500'
              }`}>
                <p className="text-sm font-semibold">{triageResult.message}</p>
                {triageResult.level === 'RED' && (
                  <button onClick={() => { setShowTriage(false); setTriageResult(null); showToast('Escalating to PHC doctor for teleconsult.', 'warning'); }} className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded font-semibold">
                    📹 Request Teleconsult Now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}