'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/common/Toast';

type Triage = 'RED' | 'YELLOW' | 'GREEN';

interface QueuePatient {
  id: string;
  token: number;
  name: string;
  age: number;
  gender: string;
  condition: string;
  triage: Triage;
  source: 'OPD' | 'TELE' | 'REFERRAL';
  waiting: number;
}

interface TeleCall {
  id: string;
  patient: string;
  from: string;
  condition: string;
  triage: Triage;
  waiting: number;
}

interface LabReview {
  id: string;
  patient: string;
  test: string;
  result: string;
  flag: 'ABNORMAL' | 'CRITICAL';
  received: string;
}

const INITIAL_QUEUE: QueuePatient[] = [
  { id: 'q1', token: 1, name: 'Rajesh Kumar', age: 52, gender: 'M', condition: 'Diabetic Nephropathy Follow-up', triage: 'RED', source: 'REFERRAL', waiting: 0 },
  { id: 'q2', token: 2, name: 'Suresh Mane', age: 58, gender: 'M', condition: 'Severe Chest Pain', triage: 'RED', source: 'OPD', waiting: 0 },
  { id: 'q3', token: 3, name: 'Sunita Pawar', age: 26, gender: 'F', condition: 'Pregnancy 28w — High BP', triage: 'YELLOW', source: 'TELE', waiting: 4 },
  { id: 'q4', token: 4, name: 'Bhausaheb Patil', age: 67, gender: 'M', condition: 'Hypertension review', triage: 'YELLOW', source: 'OPD', waiting: 9 },
  { id: 'q5', token: 5, name: 'Lata Sawant', age: 24, gender: 'F', condition: 'ANC checkup', triage: 'GREEN', source: 'OPD', waiting: 14 },
  { id: 'q6', token: 6, name: 'Rukmini Deshmukh', age: 71, gender: 'F', condition: 'Diabetes follow-up', triage: 'GREEN', source: 'OPD', waiting: 21 },
];

const INITIAL_CALLS: TeleCall[] = [
  { id: 't1', patient: 'Meera Joshi (30F)', from: 'ASHA Khed — Sub-Centre', condition: 'Post-natal bleeding', triage: 'RED', waiting: 32 },
  { id: 't2', patient: 'Anita Kamble (45F)', from: 'PHC Chakan', condition: 'Acute abdominal pain', triage: 'YELLOW', waiting: 12 },
  { id: 't3', patient: 'Ganesh Yadav (12M)', from: 'Sub-Centre Alandi', condition: 'High fever, rash', triage: 'YELLOW', waiting: 6 },
];

const INITIAL_LABS: LabReview[] = [
  { id: 'lr1', patient: 'Rajesh Kumar', test: 'Serum Creatinine', result: '2.8 mg/dL (↑ High)', flag: 'CRITICAL', received: '8m ago' },
  { id: 'lr2', patient: 'Rajesh Kumar', test: 'HbA1c', result: '9.2% (↑ High)', flag: 'ABNORMAL', received: '12m ago' },
  { id: 'lr3', patient: 'Suresh Mane', test: 'Troponin-I', result: '0.9 ng/mL (Elevated)', flag: 'CRITICAL', received: '4m ago' },
];

const FACILITY_ALERTS = [
  { id: 'f1', facility: 'PHC Khed', bedAvail: '2/12', type: 'Bed Capacity Low', level: 'warning' },
  { id: 'f2', facility: 'District Hospital Pune', bedAvail: '38/120', type: 'ICU Occupied 92%', level: 'danger' },
  { id: 'f3', facility: 'Sub-Centre Alandi', bedAvail: '5/6', type: 'All beds available', level: 'success' },
];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueuePatient[]>(INITIAL_QUEUE);
  const [calls, setCalls] = useState<TeleCall[]>(INITIAL_CALLS);
  const [labs, setLabs] = useState<LabReview[]>(INITIAL_LABS);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showRxModal, setShowRxModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sortedQueue = [...queue].sort((a, b) => {
    const order: Record<Triage, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    if (order[a.triage] !== order[b.triage]) return order[a.triage] - order[b.triage];
    return a.token - b.token;
  });

  const acceptCall = (callId: string) => {
    const c = calls.find((x) => x.id === callId);
    if (!c) return;
    setActiveCallId(callId);
    setCalls((cs) => cs.filter((x) => x.id !== callId));
    setQueue((q) => [
      ...q,
      {
        id: `from-${callId}`,
        token: 99,
        name: c.patient.split(' (')[0],
        age: parseInt(c.patient.match(/\((\d+)/)?.[1] || '0', 10),
        gender: c.patient.match(/[FM]$/)?.[0] || 'F',
        condition: c.condition,
        triage: c.triage,
        source: 'TELE',
        waiting: 0,
      },
    ]);
    showToast(`📹 Teleconsult started with ${c.patient} from ${c.from}`, 'success');
  };

  const signOffLab = (id: string) => {
    const l = labs.find((x) => x.id === id);
    setLabs((ls) => ls.filter((x) => x.id !== id));
    showToast(`✅ Lab signed off for ${l?.patient} (${l?.test})`, 'success');
  };

  const startConsult = (p: QueuePatient) => {
    setSelectedPatient(p);
    setQueue((q) => q.filter((x) => x.id !== p.id));
    setShowRxModal(true);
  };

  const finishConsult = () => {
    setShowRxModal(false);
    setSelectedPatient(null);
    showToast('✅ Consultation complete. Digital prescription sent to patient ABHA.', 'success');
  };

  if (!user) return null;

  const pendingLabs = labs.length;
  const incomingCalls = calls.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Good morning,</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{user.name} 🩺</h1>
          <p className="text-sm text-gray-500 mt-1">{user.title} • {user.facilityOrLocation}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => showToast('Digital prescription form opened.', 'info')} className="px-4 py-2 bg-[#00695C] text-white rounded-lg text-sm font-semibold hover:bg-[#004D40]">💊 Issue Rx</button>
          <button onClick={() => showToast('Lab order form opened.', 'info')} className="px-4 py-2 bg-[#1565C0] text-white rounded-lg text-sm font-semibold hover:bg-[#0D47A1]">🔬 Order Lab</button>
          <button onClick={() => showToast('Referral form opened.', 'info')} className="px-4 py-2 bg-[#7B1FA2] text-white rounded-lg text-sm font-semibold hover:bg-[#6A1B9A]">🔁 Refer Patient</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card border-l-4 border-red-500">
          <p className="text-xs text-gray-500">🔴 Critical in Queue</p>
          <p className="text-3xl font-bold text-red-600">{queue.filter((p) => p.triage === 'RED').length}</p>
        </div>
        <div className="card border-l-4 border-yellow-500">
          <p className="text-xs text-gray-500">⏳ Pending Consults</p>
          <p className="text-3xl font-bold text-gray-800">{queue.length}</p>
        </div>
        <div className="card border-l-4 border-blue-500">
          <p className="text-xs text-gray-500">📹 Incoming Calls</p>
          <p className="text-3xl font-bold text-blue-600">{incomingCalls}</p>
        </div>
        <div className="card border-l-4 border-purple-500">
          <p className="text-xs text-gray-500">🔬 Labs to Sign Off</p>
          <p className="text-3xl font-bold text-purple-600">{pendingLabs}</p>
        </div>
      </div>

      {/* Active call banner */}
      {activeCallId && (
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-lg shadow-lg animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">📹 LIVE — Teleconsultation in progress</p>
              <p className="text-green-100 text-sm">Recording & transcription enabled • District Hospital Pune OPD-3</p>
            </div>
            <button onClick={() => setActiveCallId(null)} className="bg-white text-green-700 px-4 py-2 rounded-lg font-semibold hover:bg-green-50">End Call</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Patient queue */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">🧑‍⚕️ Today's OPD Queue (AI-prioritized)</h3>
            <Link href="/appointments" className="text-xs text-[#00695C] font-semibold hover:underline">Full schedule →</Link>
          </div>
          <div className="space-y-2">
            {sortedQueue.map((p) => {
              const ring = p.triage === 'RED' ? 'border-red-500 bg-red-50' :
                           p.triage === 'YELLOW' ? 'border-yellow-500 bg-yellow-50' :
                           'border-green-500 bg-green-50';
              return (
                <div key={p.id} className={`p-3 rounded-lg border-l-4 ${ring}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        p.triage === 'RED' ? 'bg-red-600 text-white' :
                        p.triage === 'YELLOW' ? 'bg-yellow-500 text-white' :
                        'bg-green-600 text-white'
                      }`}>{p.token}</span>
                      <div>
                        <p className="font-semibold text-gray-800">{p.name} <span className="text-xs text-gray-500">({p.age}y {p.gender})</span></p>
                        <p className="text-xs text-gray-600">{p.condition}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-white border border-gray-200 rounded font-semibold">{p.source}</span>
                      <span className="text-xs text-gray-500">{p.waiting > 0 ? `${p.waiting}m wait` : 'just arrived'}</span>
                      <button onClick={() => startConsult(p)} className="px-3 py-1.5 bg-[#00695C] text-white text-xs rounded-lg font-semibold hover:bg-[#004D40]">
                        Start Consult
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Incoming calls */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">📹 Incoming Teleconsults</h3>
            <Link href="/teleconsult" className="text-xs text-[#00695C] font-semibold hover:underline">All →</Link>
          </div>
          {calls.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No incoming calls.</p>
          ) : (
            <div className="space-y-3">
              {calls.map((c) => (
                <div key={c.id} className={`p-3 rounded-lg border-l-4 ${
                  c.triage === 'RED' ? 'bg-red-50 border-red-500' :
                  c.triage === 'YELLOW' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{c.patient}</p>
                      <p className="text-xs text-gray-600">{c.condition}</p>
                      <p className="text-xs text-gray-500 mt-1">📍 {c.from}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-gray-500">{Math.floor((now / 1000) % 60) % (c.waiting + 1)}s</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => acceptCall(c.id)} className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded font-semibold hover:bg-green-700">
                      ✓ Accept
                    </button>
                    <button onClick={() => { setCalls((cs) => cs.filter((x) => x.id !== c.id)); showToast('Call redirected to next available doctor.', 'info'); }} className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded font-semibold hover:bg-gray-300">
                      Redirect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lab reviews */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">🔬 Labs Requiring Sign-off</h3>
            <Link href="/diagnostics" className="text-xs text-[#00695C] font-semibold hover:underline">All →</Link>
          </div>
          {labs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">✅ All labs reviewed.</p>
          ) : (
            <div className="space-y-2">
              {labs.map((l) => (
                <div key={l.id} className={`p-3 rounded-lg border-l-4 ${
                  l.flag === 'CRITICAL' ? 'bg-red-50 border-red-500' : 'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{l.test} <span className="text-xs text-gray-500">— {l.patient}</span></p>
                      <p className="text-xs text-gray-600">{l.result}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Received {l.received}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => showToast(`Lab escalated to specialist.`, 'warning')} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded font-semibold hover:bg-gray-50">
                        Refer
                      </button>
                      <button onClick={() => signOffLab(l.id)} className="px-3 py-1.5 bg-[#00695C] text-white text-xs rounded font-semibold hover:bg-[#004D40]">
                        Sign Off
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Facility alerts */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-3">🏥 Facility Patient Alerts</h3>
          <div className="space-y-2">
            {FACILITY_ALERTS.map((f) => {
              const color = f.level === 'danger' ? 'red' : f.level === 'warning' ? 'yellow' : 'green';
              return (
                <div key={f.id} className={`p-3 rounded-lg border-l-4 bg-${color}-50 border-${color}-500`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{f.facility}</p>
                      <p className="text-xs text-gray-600">{f.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Beds</p>
                      <p className="text-sm font-bold">{f.bedAvail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/facilities" className="block mt-3 text-center text-xs text-[#00695C] font-semibold hover:underline">View all facilities →</Link>
        </div>
      </div>

      {/* Rx modal */}
      {showRxModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRxModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-1">💊 Digital Prescription</h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedPatient.name} • {selectedPatient.condition}
            </p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Diagnosis</label>
            <input defaultValue={selectedPatient.condition} className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3" />
            <label className="block text-xs font-semibold text-gray-600 mb-1">Medications (one per line)</label>
            <textarea
              rows={4}
              defaultValue={'Tab. Metformin 500mg — Morning & Night (after meals)\nTab. Amlodipine 5mg — Morning\nIron + Folic Acid — Noon'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm"
            />
            <label className="block text-xs font-semibold text-gray-600 mb-1">Advice / Follow-up</label>
            <textarea
              rows={2}
              defaultValue={'Repeat HbA1c after 3 months. Daily BP log. Low-sodium diabetic diet.'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowRxModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold">Cancel</button>
              <button onClick={finishConsult} className="flex-1 py-2 bg-[#00695C] text-white rounded-lg font-semibold">E-Sign & Send to ABHA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}