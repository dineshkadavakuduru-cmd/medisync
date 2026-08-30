'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertBanner } from '@/components/common/AlertBanner';
import { showToast } from '@/components/common/Toast';
import { wsClient, setupEmergencyListeners } from '@/lib/websocket';

interface DashboardStats {
  todayReferrals: number;
  referralTrend: number;
  medicineAvailability: number;
  patientsWaiting: number;
  pendingHighRiskAlerts: number;
  totalPatients: number;
  facilitiesActive: number;
  avgResponseTimeMinutes: number;
  referralCompletionRate: number;
  topConditions: { name: string; count: number }[];
}

interface Alert {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  facilityId: string;
  isResolved: boolean;
  createdAt: string;
}

interface Facility {
  id: string;
  name: string;
  type: string;
  beds: { total: number; available: number };
  medicineAvailability: number;
  specialists: string[];
  contactPhone: string;
}

interface Emergency {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  condition: string;
  protocolLevel: string;
  status: string;
  originFacilityId: string;
  createdAt: string;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-12" />
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triageVolume, setTriageVolume] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());

  const facilityMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilities.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [facilities]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, alertsRes, facilitiesRes, emgRes] = await Promise.all([
        fetch('http://localhost:3001/api/analytics/dashboard').then((r) => r.json()),
        fetch('http://localhost:3001/api/alerts').then((r) => r.json()),
        fetch('http://localhost:3001/api/facilities').then((r) => r.json()),
        fetch('http://localhost:3001/api/emergencies?status=active').then((r) => r.json()),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data || []);
      setFacilities(facilitiesRes.data || []);
      setEmergencies(emgRes.success ? emgRes.data : []);
      setTriageVolume(Array.from({ length: 24 }, () => Math.floor(Math.random() * 6)));
    } catch (e) {
      setError('Failed to load dashboard data. Please try again.');
      console.error(e);
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
    wsClient.connect();
    const cleanup = setupEmergencyListeners({
      onNew: (data) => {
        const d = data as any;
        showToast(`🚨 New Emergency: ${d?.condition || 'Unknown'} at ${d?.originFacilityId || 'Unknown'}`, 'danger');
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
        showToast(`🚑 Ambulance dispatched to ${d?.originFacilityId || d?.facilityId || 'facility'}`, 'warning');
      },
      onRefetch: loadData,
    });
    return cleanup;
  }, [loadData]);

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Something went wrong</h3>
          <p className="text-[var(--text-secondary)]">{error}</p>
        </div>
        <button onClick={loadData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const maxTriage = Math.max(...triageVolume, 1);
  const totalTriage = triageVolume.reduce((a, b) => a + b, 0);
  const greenCount = Math.round(totalTriage * 0.6);
  const yellowCount = Math.round(totalTriage * 0.3);
  const redCount = totalTriage - greenCount - yellowCount;

  const activeLevel1 = emergencies.filter((e) => e.protocolLevel === 'LEVEL_1');
  const activeOther = emergencies.filter((e) => e.protocolLevel !== 'LEVEL_1');

  const formatCondition = (condition: string) => {
    return condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getActiveTime = (createdAt: string) => {
    const diff = now - new Date(createdAt).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const pageHeader = (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">District Command Centre</h1>
      <p className="text-sm text-[var(--text-secondary)] mt-1">Real-time overview of healthcare operations across the district</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {pageHeader}

      {activeLevel1.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-lg shadow-lg animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">🚨 ACTIVE LEVEL 1 EMERGENCY{activeLevel1.length > 1 ? 'S' : ''}</h3>
              {activeLevel1.map((e) => (
                <p key={e.id} className="text-red-100 text-sm">
                  {formatCondition(e.condition)} at {facilityMap[e.originFacilityId] || e.originFacilityId} — Active for {getActiveTime(e.createdAt)}
                </p>
              ))}
            </div>
            <a href="/alerts" className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-50 transition-colors">
              View Details →
            </a>
          </div>
        </div>
      )}

      {activeLevel1.length === 0 && activeOther.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">⚠️ {activeOther.length} Active Emergency{activeOther.length > 1 ? 'ies' : 'y'} Requiring Attention</h3>
            </div>
            <a href="/alerts" className="bg-white text-amber-600 px-4 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors">
              View →
            </a>
          </div>
        </div>
      )}

      <AlertBanner message={`Emergency Escalation Active - ${stats?.pendingHighRiskAlerts || 0} Critical Cases`} />

      {loading && !stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">Today&apos;s Referrals</div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats?.todayReferrals || 0}</div>
            <div className="text-sm text-[var(--success)]">↑{stats?.referralTrend || 0}</div>
          </div>
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">Patients Waiting</div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats?.patientsWaiting || 0}</div>
          </div>
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">Medicine Availability</div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats?.medicineAvailability || 0}%</div>
            <div className="w-full bg-[var(--border)] rounded-full h-2 mt-2">
              <div className="bg-[var(--primary)] h-2 rounded-full" style={{ width: `${stats?.medicineAvailability || 0}%` }} />
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">Active Alerts</div>
            <div className="text-3xl font-bold text-[var(--danger)]">{stats?.pendingHighRiskAlerts || 0}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recent Referrals</h3>
          {loading && !stats ? (
            <SkeletonBar />
          ) : (
            <p className="text-[var(--text-secondary)]">Referral data will appear here when available.</p>
          )}
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Alert Feed</h3>
          </div>
          {loading && alerts.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.priority === 'CRITICAL' ? 'bg-[#FFF5F5] border-[var(--danger)]' : 'border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge ${alert.priority === 'CRITICAL' ? 'badge-critical' : alert.priority === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                      {alert.priority}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-medium text-[var(--text-primary)]">{alert.title}</div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1">{alert.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Facility Status</h3>
          {loading && facilities.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {facilities.slice(0, 4).map((facility) => (
                <div key={facility.id} className="p-4 bg-[var(--card-bg)] rounded-lg">
                  <div className="font-medium text-[var(--text-primary)]">{facility.name}</div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1">{facility.type}</div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1">
                    {facility.beds.available}/{facility.beds.total} beds
                  </div>
                  <div className="w-full bg-[var(--border)] rounded-full h-2 mt-2">
                    <div
                      className="bg-[var(--primary)] h-2 rounded-full"
                      style={{ width: `${Math.round((facility.beds.available / facility.beds.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Top Conditions</h3>
          {loading && !stats ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {stats?.topConditions?.map((condition) => (
                <div key={condition.name} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-[var(--text-secondary)]">{condition.name}</div>
                  <div className="flex-1 bg-[var(--card-bg)] rounded-full h-3">
                    <div
                      className="bg-[var(--primary)] h-3 rounded-full"
                      style={{ width: `${(condition.count / (stats.topConditions[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm font-medium text-[var(--text-primary)] text-right">{condition.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Today&apos;s Triage Volume</h3>
          {loading && triageVolume.length === 0 ? (
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 bg-gray-200 rounded-t animate-pulse" style={{ height: '100%' }} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-32">
                {triageVolume.map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-[var(--primary)] rounded-t" style={{ height: `${(val / maxTriage) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-[var(--text-secondary)]">
                <span>00:00</span>
                <span>12:00</span>
                <span>23:00</span>
              </div>
            </>
          )}
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Severity Distribution</h3>
          {loading && totalTriage === 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 bg-gray-200 rounded-full animate-pulse" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32 rounded-full" style={{ background: `conic-gradient(var(--success) 0% ${(greenCount / Math.max(totalTriage, 1)) * 100}%, var(--warning) ${(greenCount / Math.max(totalTriage, 1)) * 100}% ${((greenCount + yellowCount) / Math.max(totalTriage, 1)) * 100}%, var(--danger) ${((greenCount + yellowCount) / Math.max(totalTriage, 1)) * 100}% 100%)` }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-[var(--surface)] rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-[var(--text-primary)]">{totalTriage}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[var(--success)]" /><span className="text-sm text-[var(--text-primary)]">GREEN ({greenCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[var(--warning)]" /><span className="text-sm text-[var(--text-primary)]">YELLOW ({yellowCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[var(--danger)]" /><span className="text-sm text-[var(--text-primary)]">RED ({redCount})</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
