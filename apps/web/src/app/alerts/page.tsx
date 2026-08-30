'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { showToast } from '@/components/common/Toast';
import { wsClient, setupEmergencyListeners } from '@/lib/websocket';
import {
  Emergency,
  EmergencyEvent,
  Ambulance,
  EmergencyStats,
  EmergencyProtocolLevel,
  EmergencyStatus,
} from '@arogyasetu/shared';

const LEVEL_COLORS: Record<EmergencyProtocolLevel, string> = {
  LEVEL_1: '#C62828',
  LEVEL_2: '#FF8F00',
  LEVEL_3: '#1565C0',
};

const STATUS_COLORS: Record<EmergencyStatus, string> = {
  INITIATED: '#C62828',
  ACKNOWLEDGED: '#FF8F00',
  AMBULANCE_DISPATCHED: '#1565C0',
  AMBULANCE_EN_ROUTE: '#00838F',
  PATIENT_PICKED_UP: '#00838F',
  EN_ROUTE_TO_HOSPITAL: '#00695C',
  ARRIVED: '#2E7D32',
  UNDER_TREATMENT: '#2E7D32',
  RESOLVED: '#2E7D32',
  ESCALATED: '#C62828',
};

const AMBULANCE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#2E7D32',
  DISPATCHED: '#FF8F00',
  EN_ROUTE: '#1565C0',
  AT_PICKUP: '#00838F',
  TRANSPORTING: '#00838F',
  RETURNING: '#757575',
};

const PROTOCOL_MAX_MINUTES: Record<EmergencyProtocolLevel, number> = {
  LEVEL_1: 10,
  LEVEL_2: 30,
  LEVEL_3: 60,
};

const PROTOCOL_REQUIRES_AMBULANCE: Record<EmergencyProtocolLevel, boolean> = {
  LEVEL_1: true,
  LEVEL_2: false,
  LEVEL_3: false,
};

const VALID_TRANSITIONS: Record<EmergencyStatus, EmergencyStatus[]> = {
  INITIATED: ['ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'],
  ACKNOWLEDGED: ['AMBULANCE_DISPATCHED', 'ESCALATED', 'RESOLVED'],
  AMBULANCE_DISPATCHED: ['AMBULANCE_EN_ROUTE', 'RESOLVED'],
  AMBULANCE_EN_ROUTE: ['PATIENT_PICKED_UP', 'RESOLVED'],
  PATIENT_PICKED_UP: ['EN_ROUTE_TO_HOSPITAL', 'RESOLVED'],
  EN_ROUTE_TO_HOSPITAL: ['ARRIVED', 'RESOLVED'],
  ARRIVED: ['UNDER_TREATMENT', 'RESOLVED'],
  UNDER_TREATMENT: ['RESOLVED'],
  RESOLVED: [],
  ESCALATED: ['ACKNOWLEDGED', 'RESOLVED'],
};

interface MockHistoryItem {
  id: string;
  createdAt: string;
  condition: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  originFacilityId: string;
  protocolLevel: EmergencyProtocolLevel;
  responseTimeMinutes: number;
  totalTimeMinutes: number;
}

const MOCK_HISTORY: MockHistoryItem[] = [
  {
    id: 'mock-1',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    condition: 'cardiac_arrest',
    patientName: 'Suresh Kumar',
    patientAge: 62,
    patientGender: 'M',
    originFacilityId: 'facility-6',
    protocolLevel: 'LEVEL_1',
    responseTimeMinutes: 8,
    totalTimeMinutes: 45,
  },
  {
    id: 'mock-2',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    condition: 'severe_dehydration',
    patientName: 'Baby of Sunita More',
    patientAge: 2,
    patientGender: 'F',
    originFacilityId: 'facility-1',
    protocolLevel: 'LEVEL_2',
    responseTimeMinutes: 12,
    totalTimeMinutes: 30,
  },
  {
    id: 'mock-3',
    createdAt: new Date(Date.now() - 200000000).toISOString(),
    condition: 'fracture',
    patientName: 'Rahul Patil',
    patientAge: 34,
    patientGender: 'M',
    originFacilityId: 'facility-2',
    protocolLevel: 'LEVEL_3',
    responseTimeMinutes: 25,
    totalTimeMinutes: 60,
  },
  {
    id: 'mock-4',
    createdAt: new Date(Date.now() - 250000000).toISOString(),
    condition: 'severe_abdominal_pain',
    patientName: 'Anita Desai',
    patientAge: 28,
    patientGender: 'F',
    originFacilityId: 'facility-3',
    protocolLevel: 'LEVEL_2',
    responseTimeMinutes: 18,
    totalTimeMinutes: 40,
  },
  {
    id: 'mock-5',
    createdAt: new Date(Date.now() - 300000000).toISOString(),
    condition: 'high_bp_crisis',
    patientName: 'Kishore Jadhav',
    patientAge: 45,
    patientGender: 'M',
    originFacilityId: 'facility-5',
    protocolLevel: 'LEVEL_3',
    responseTimeMinutes: 35,
    totalTimeMinutes: 55,
  },
];

export default function EmergencyCommandCentre() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [timeline, setTimeline] = useState<EmergencyEvent[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [stats, setStats] = useState<EmergencyStats | null>(null);
  const [facilities, setFacilities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [historySort, setHistorySort] = useState<'date' | 'response' | 'total'>('date');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');

  const getFacilityName = useCallback((id: string) => facilities[id] || id, [facilities]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emgRes, statsRes, ambRes, facRes] = await Promise.all([
        fetch('http://localhost:3001/api/emergencies?status=active').then((r) => {
          if (!r.ok) throw new Error('Failed to fetch emergencies');
          return r.json();
        }),
        fetch('http://localhost:3001/api/emergencies/stats').then((r) => {
          if (!r.ok) throw new Error('Failed to fetch stats');
          return r.json();
        }),
        fetch('http://localhost:3001/api/ambulances').then((r) => {
          if (!r.ok) throw new Error('Failed to fetch ambulances');
          return r.json();
        }),
        fetch('http://localhost:3001/api/facilities').then((r) => {
          if (!r.ok) throw new Error('Failed to fetch facilities');
          return r.json();
        }),
      ]);
      if (emgRes.success) {
        const sorted = (emgRes.data || []).sort((a: Emergency, b: Emergency) => {
          const levelOrder: Record<EmergencyProtocolLevel, number> = { LEVEL_1: 0, LEVEL_2: 1, LEVEL_3: 2 };
          if (levelOrder[a.protocolLevel] !== levelOrder[b.protocolLevel]) return levelOrder[a.protocolLevel] - levelOrder[b.protocolLevel];
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        setEmergencies(sorted);
      }
      if (statsRes.success) setStats(statsRes.data);
      if (ambRes.success) setAmbulances(ambRes.data || []);
      if (facRes.success) {
        const map: Record<string, string> = {};
        (facRes.data || []).forEach((f: any) => {
          map[f.id] = f.name;
        });
        setFacilities(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (selectedEmergency) {
      fetch(`http://localhost:3001/api/emergencies/${selectedEmergency.id}/timeline`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setTimeline((data.data?.timeline || []).reverse());
        })
        .catch(() => setTimeline([]));
    }
  }, [selectedEmergency]);

  useEffect(() => {
    wsClient.connect();
    const cleanup = setupEmergencyListeners({
      onNew: (data) => {
        const d = data as any;
        showToast(`🚨 New Emergency: ${d?.condition || 'Unknown'} at ${getFacilityName(d?.originFacilityId || '')}`, 'danger');
      },
      onUpdate: (data) => {
        const d = data as any;
        showToast(`Emergency updated: ${d?.status || 'status changed'}`, 'info');
      },
      onEscalated: () => {
        showToast('🚨🚨 EMERGENCY ESCALATED — No response received. District officer notified.', 'danger');
      },
      onAmbulanceDispatched: (data) => {
        const d = data as any;
        showToast(`🚑 Ambulance dispatched to ${getFacilityName(d?.originFacilityId || d?.facilityId || '')}`, 'warning');
      },
      onRefetch: loadData,
    });
    return cleanup;
  }, [loadData, getFacilityName]);

  const handleAction = async (id: string, action: () => Promise<Response>) => {
    setActingId(id);
    try {
      const res = await action();
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Action failed');
      }
      showToast('Action completed', 'success');
      loadData();
      if (selectedEmergency?.id === id) {
        const tRes = await fetch(`http://localhost:3001/api/emergencies/${id}/timeline`);
        if (tRes.ok) {
          const tData = await tRes.json();
          if (tData.success) setTimeline((tData.data?.timeline || []).reverse());
        }
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed', 'danger');
    } finally {
      setActingId(null);
    }
  };

  const handleAcknowledge = (id: string) => handleAction(id, () =>
    fetch(`http://localhost:3001/api/emergencies/${id}/acknowledge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'admin-web' }),
    })
  );

  const handleDispatch = (id: string) => handleAction(id, () =>
    fetch(`http://localhost:3001/api/emergencies/${id}/dispatch`, { method: 'POST' })
  );

  const handleStatusUpdate = (id: string, status: EmergencyStatus) => handleAction(id, () =>
    fetch(`http://localhost:3001/api/emergencies/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, userId: 'admin-web' }),
    })
  );

  const handleResolve = (id: string) => handleAction(id, () =>
    fetch(`http://localhost:3001/api/emergencies/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED', userId: 'admin-web', notes: 'Resolved from web dashboard' }),
    })
  );

  const getTimeAgo = (dateString: string) => {
    const diff = now - new Date(dateString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  const formatCondition = (condition: string) => {
    return condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const activeLevel1 = stats?.active.level1 || 0;
  const activeTotal = stats?.active.total || 0;
  const availableAmbs = ambulances.filter((a) => a.status === 'AVAILABLE').length;
  const totalAmbs = ambulances.length;

  const sortedHistory = [...MOCK_HISTORY].sort((a, b) => {
    let cmp = 0;
    if (historySort === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    else if (historySort === 'response') cmp = a.responseTimeMinutes - b.responseTimeMinutes;
    else if (historySort === 'total') cmp = a.totalTimeMinutes - b.totalTimeMinutes;
    return historySortDir === 'asc' ? cmp : -cmp;
  });

  const renderStatusBadge = (status: EmergencyStatus) => {
    const color = STATUS_COLORS[status] || '#757575';
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const renderAmbulanceStatusBadge = (status: string) => {
    const color = AMBULANCE_STATUS_COLORS[status] || '#757575';
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading && emergencies.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card">Loading emergency data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes statsBarPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(198, 40, 40, 0.4); }
          50% { box-shadow: 0 0 20px 4px rgba(198, 40, 40, 0.2); }
        }
        .stats-bar-pulse {
          animation: statsBarPulse 2s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
        }
      `}</style>

      <div className={`rounded-xl p-6 text-white ${activeLevel1 > 0 ? 'stats-bar-pulse' : ''}`} style={{ background: 'linear-gradient(135deg, #C62828, #B71C1C)' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-3xl font-bold">{activeTotal}</div>
            <div className="text-red-100 text-sm">Active Emergencies</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats?.today.avgResponseMinutes || 0} min</div>
            <div className="text-red-100 text-sm">Avg Response Time</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{availableAmbs}/{totalAmbs}</div>
            <div className="text-red-100 text-sm">Ambulances Available</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats?.today.resolved || 0}</div>
            <div className="text-red-100 text-sm">Resolved Today</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border border-red-200 text-red-700">
          Failed to load: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Active Emergencies</h2>
            {activeTotal > 0 && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>

          {emergencies.length === 0 ? (
            <div className="card text-center py-12 bg-green-50 border border-green-200">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No active emergencies — all clear</h3>
              <p className="text-[var(--text-secondary)]">All emergencies have been resolved.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emergencies.map((emergency) => (
                <div
                  key={emergency.id}
                  className={`cursor-pointer transition-all ${
                    selectedEmergency?.id === emergency.id ? 'ring-2 ring-red-500' : ''
                  }`}
                  style={{
                    borderLeft: `6px solid ${LEVEL_COLORS[emergency.protocolLevel]}`,
                    backgroundColor: emergency.protocolLevel === 'LEVEL_1' ? '#FFF5F5' : '#FFFFFF',
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    padding: 20,
                  }}
                  onClick={() => setSelectedEmergency(emergency)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: LEVEL_COLORS[emergency.protocolLevel] }}>
                        {emergency.protocolLevel}
                      </span>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontSize: 20 }}>
                        {formatCondition(emergency.condition)}
                      </h3>
                    </div>
                    {emergency.protocolLevel === 'LEVEL_1' && (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div>
                      <span className="text-[var(--text-secondary)]">Patient:</span>{' '}
                      <span className="font-medium text-[var(--text-primary)]">
                        {emergency.patientName}, {emergency.patientAge}
                        {emergency.patientGender}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Facility:</span>{' '}
                      <span className="font-medium text-[var(--text-primary)]">📍 {getFacilityName(emergency.originFacilityId)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Status:</span>{' '}
                      {renderStatusBadge(emergency.status)}
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Time:</span>{' '}
                      <span className="font-medium text-[var(--text-primary)]">{getTimeAgo(emergency.createdAt)}</span>
                    </div>
                  </div>

                  {emergency.estimatedArrivalMinutes && emergency.status !== 'RESOLVED' && (
                    <div className="text-teal-700 px-3 py-2 rounded-lg text-sm font-medium mb-3" style={{ backgroundColor: '#E0F2F1' }}>
                      🚑 ETA: {emergency.estimatedArrivalMinutes} min
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {emergency.status === 'INITIATED' && (
                      <button
                        disabled={actingId === emergency.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(emergency.id);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{ backgroundColor: '#00838F' }}
                      >
                        {actingId === emergency.id && <span className="spinner"></span>}
                        Acknowledge
                      </button>
                    )}
                    {!emergency.ambulanceId && PROTOCOL_REQUIRES_AMBULANCE[emergency.protocolLevel] && (
                      <button
                        disabled={actingId === emergency.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDispatch(emergency.id);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{ backgroundColor: '#FF8F00' }}
                      >
                        {actingId === emergency.id && <span className="spinner"></span>}
                        Dispatch Ambulance
                      </button>
                    )}
                    <select
                      disabled={actingId === emergency.id}
                      className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm disabled:opacity-50"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleStatusUpdate(emergency.id, e.target.value as EmergencyStatus);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Update Status...</option>
                      {(VALID_TRANSITIONS[emergency.status] || []).map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    {(emergency.status === 'UNDER_TREATMENT' || emergency.status === 'ARRIVED') && (
                      <button
                        disabled={actingId === emergency.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(emergency.id);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{ backgroundColor: '#2E7D32' }}
                      >
                        {actingId === emergency.id && <span className="spinner"></span>}
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Emergency Timeline</h3>
            {selectedEmergency ? (
              <div className="space-y-0 max-h-[500px] overflow-y-auto">
                {timeline.length === 0 ? (
                  <p className="text-[var(--text-secondary)] text-sm">No timeline events yet.</p>
                ) : (
                  timeline.map((event, index) => {
                    const isAutomated = event.automated;
                    const isCritical = event.event.includes('ESCALATED') || event.event.includes('AMBULANCE') || event.event.includes('EMERGENCY');
                    const dotColor = isAutomated ? '#9E9E9E' : isCritical ? '#C62828' : '#00838F';
                    return (
                      <div key={event.id || index} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor }} />
                          {index < timeline.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="text-sm font-medium text-[var(--text-primary)]" style={isAutomated ? { fontStyle: 'italic' } : {}}>
                            {event.description}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1">
                            {new Date(event.timestamp).toLocaleTimeString('en-GB')}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="text-[var(--text-secondary)] text-sm">Select an emergency to view timeline.</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Ambulance Fleet</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Vehicle #</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Driver</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Phone</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Status</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Assigned Emergency</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Home Base</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {ambulances.map((amb) => {
                    const isAvailable = amb.status === 'AVAILABLE';
                    const isDispatched = amb.status === 'DISPATCHED' || amb.status === 'EN_ROUTE';
                    return (
                      <tr key={amb.id} className={isAvailable ? 'bg-green-50' : isDispatched ? 'bg-amber-50' : ''}>
                        <td className="px-2 py-2 font-medium">{amb.vehicleNumber}</td>
                        <td className="px-2 py-2">{amb.driverName}</td>
                        <td className="px-2 py-2">{amb.driverPhone}</td>
                        <td className="px-2 py-2">{renderAmbulanceStatusBadge(amb.status)}</td>
                        <td className="px-2 py-2 text-xs">{amb.assignedEmergencyId || '-'}</td>
                        <td className="px-2 py-2 text-xs">{getFacilityName(amb.facilityId)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Emergency History</h3>
          <span className="text-[var(--text-secondary)]">{historyOpen ? 'Hide History ▲' : 'Show History ▼'}</span>
        </button>
        {historyOpen && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th
                    className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                    onClick={() => {
                      setHistorySort('date');
                      setHistorySortDir(historySort === 'date' && historySortDir === 'desc' ? 'asc' : 'desc');
                    }}
                  >
                    Date/Time {historySort === 'date' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Condition</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Patient</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Facility</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">Protocol</th>
                  <th
                    className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                    onClick={() => {
                      setHistorySort('response');
                      setHistorySortDir(historySort === 'response' && historySortDir === 'desc' ? 'asc' : 'desc');
                    }}
                  >
                    Response Time {historySort === 'response' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th
                    className="px-2 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                    onClick={() => {
                      setHistorySort('total');
                      setHistorySortDir(historySort === 'total' && historySortDir === 'desc' ? 'asc' : 'desc');
                    }}
                  >
                    Total Time {historySort === 'total' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedHistory.map((item) => {
                  const maxMinutes = PROTOCOL_MAX_MINUTES[item.protocolLevel];
                  const responseWithinLimit = item.responseTimeMinutes <= maxMinutes;
                  return (
                    <tr key={item.id}>
                      <td className="px-2 py-2 text-xs">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2">{formatCondition(item.condition)}</td>
                      <td className="px-2 py-2">
                        {item.patientName}, {item.patientAge}
                        {item.patientGender}
                      </td>
                      <td className="px-2 py-2">{getFacilityName(item.originFacilityId)}</td>
                      <td className="px-2 py-2">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: LEVEL_COLORS[item.protocolLevel] }}>
                          {item.protocolLevel}
                        </span>
                      </td>
                      <td className={`px-2 py-2 font-medium ${responseWithinLimit ? 'text-green-600' : 'text-red-600'}`}>
                        {item.responseTimeMinutes} min
                      </td>
                      <td className="px-2 py-2">{item.totalTimeMinutes} min</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
