'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FacilityType, MedicineItemStatus, StaffRole } from '@medisync/shared';
import { wsClient, WSMessageType } from '@/lib/websocket';
import { showToast } from '@/components/common/Toast';

interface FacilitySummary {
  facility: {
    id: string;
    name: string;
    type: FacilityType;
    district: string;
    taluka: string;
    contactPhone: string;
  };
  beds: { total: number; available: number; occupied: number; occupancyRate: number };
  medicine: {
    overallAvailability: number;
    totalItems: number;
    adequate: number;
    low: number;
    critical: number;
    outOfStock: number;
    criticalItems: { name: string; currentStock: number; minThreshold: number }[];
  };
  staff: {
    total: number;
    onDuty: number;
    doctors: number;
    doctorsOnDuty: number;
    specialists: string[];
    specialistsOnDuty: string[];
  };
  recentReferralsIn: number;
  recentReferralsOut: number;
  activeAlerts: number;
}

interface MedicineItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  status: MedicineItemStatus;
  expiryDate?: string;
  lastRestocked: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  specialization?: string;
  phone: string;
  isOnDuty: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  languages: string[];
}

const TYPE_COLORS: Record<FacilityType, string> = {
  SUB_CENTRE: 'var(--success)',
  PHC: 'var(--info)',
  CHC: 'var(--warning)',
  DISTRICT_HOSPITAL: 'var(--danger)',
};

const TYPE_LABELS: Record<FacilityType, string> = {
  SUB_CENTRE: 'Sub-Centre',
  PHC: 'PHC',
  CHC: 'CHC',
  DISTRICT_HOSPITAL: 'District Hospital',
};

const STATUS_COLORS: Record<MedicineItemStatus, string> = {
  ADEQUATE: 'var(--success)',
  LOW: 'var(--warning)',
  CRITICAL: 'var(--danger)',
  'OUT_OF_STOCK': '#424242',
};

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facilityId = params.id as string;
  const [summary, setSummary] = useState<FacilitySummary | null>(null);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('just now');

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, medRes, staffRes] = await Promise.all([
        fetch(`http://localhost:3001/api/facilities/${facilityId}/summary`),
        fetch(`http://localhost:3001/api/facilities/${facilityId}/inventory`),
        fetch(`http://localhost:3001/api/facilities/${facilityId}/staff`),
      ]);
      const summaryData = await summaryRes.json();
      const medData = await medRes.json();
      const staffData = await staffRes.json();
      if (summaryData.success) setSummary(summaryData.data);
      if (medData.success) setMedicines(medData.data || []);
      if (staffData.success) setStaff(staffData.data || []);
      setLastUpdated('just now');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() % 3600000) / 60000);
      setLastUpdated(mins === 0 ? 'just now' : `${mins} min${mins > 1 ? 's' : ''} ago`);
    }, 60000);

    wsClient.connect(facilityId);
    wsClient.on('BED_UPDATE', () => { loadData(); showToast('🛏️ Bed data updated', 'info'); });
    wsClient.on('MEDICINE_UPDATE', () => { loadData(); showToast('💊 Medicine stock updated', 'info'); });
    wsClient.on('STAFF_UPDATE', () => { loadData(); showToast('👨‍⚕️ Staff duty updated', 'info'); });
    wsClient.on('ALERT_NEW', () => { loadData(); showToast('🚨 New alert received', 'danger'); });

    return () => clearInterval(interval);
  }, [loadData, facilityId]);

  if (loading || !summary) {
    return (
      <div className="card text-center py-12">
        <p className="text-[var(--text-secondary)]">Loading facility details...</p>
      </div>
    );
  }

  const f = summary.facility;
  const bedPercent = Math.round((summary.beds.available / summary.beds.total) * 100);
  const medPercent = summary.medicine.overallAvailability;

  const isExpiringSoon = (dateStr: string) => {
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays >= 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/facilities" className="text-[var(--primary)] hover:underline font-medium">← Back</Link>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{f.name}</h1>
        <span className="badge" style={{ backgroundColor: `${TYPE_COLORS[f.type]}20`, color: TYPE_COLORS[f.type] }}>{TYPE_LABELS[f.type]}</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <span>{f.district}, {f.taluka}</span>
        <span>•</span>
        <a href={`tel:${f.contactPhone}`} className="text-[var(--primary)] hover:underline">📞 {f.contactPhone}</a>
        <span>•</span>
        <span>Last updated: {lastUpdated}</span>
        <span className="w-2 h-2 rounded-full bg-[var(--success)] inline-block animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{summary.beds.available}/{summary.beds.total}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">Beds Available</div>
          <div className="text-xs text-[var(--text-secondary)]">{bedPercent}% occupancy</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{medPercent}%</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">Medicine Availability</div>
          <div className="text-xs text-[var(--text-secondary)]">{summary.medicine.totalItems} items tracked</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{summary.staff.onDuty}/{summary.staff.total}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">Staff On Duty</div>
          <div className="text-xs text-[var(--text-secondary)]">{summary.staff.doctors} doctors</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{summary.recentReferralsIn + summary.recentReferralsOut}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">Referrals Today</div>
          <div className="text-xs text-[var(--text-secondary)]">{summary.recentReferralsIn} in, {summary.recentReferralsOut} out</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Medicine Inventory</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Medicine</th>
                  <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Category</th>
                  <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Stock</th>
                  <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Threshold</th>
                  <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Status</th>
                  <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Last Restocked</th>
                </tr>
              </thead>
              <tbody>
                {medicines.sort((a, b) => {
                  const order: Record<MedicineItemStatus, number> = { 'OUT_OF_STOCK': 0, CRITICAL: 1, LOW: 2, ADEQUATE: 3 };
                  return (order[a.status] || 0) - (order[b.status] || 0);
                }).map((med) => {
                  const stockPercent = Math.round((med.currentStock / med.maxCapacity) * 100);
                  return (
                    <tr key={med.id} className={`border-b border-[var(--border)] ${med.status === 'OUT_OF_STOCK' ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="font-medium text-[var(--text-primary)]">{med.name}</div>
                        {med.expiryDate && isExpiringSoon(med.expiryDate) && (
                          <span className="text-xs text-[var(--warning)] font-semibold">⚠️ Expiring soon</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] capitalize">{med.category}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{med.currentStock}</span>
                          <div className="w-16 bg-[var(--border)] rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${stockPercent}%`, backgroundColor: STATUS_COLORS[med.status] }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{med.minThreshold}</td>
                      <td className="py-3 px-3">
                        <span className="badge" style={{ backgroundColor: `${STATUS_COLORS[med.status]}20`, color: STATUS_COLORS[med.status] }}>
                          {med.status === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : med.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{new Date(med.lastRestocked).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Bed Visualization</h2>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: summary.beds.total }).map((_, idx) => {
              const isOccupied = idx >= summary.beds.available;
              return (
                <div
                  key={idx}
                  className="w-5 h-5 rounded"
                  style={{ backgroundColor: isOccupied ? 'var(--danger)' : 'var(--success)' }}
                  title={isOccupied ? 'Occupied' : 'Available'}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--success)' }} /><span>Available</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--danger)' }} /><span>Occupied</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Staff Roster</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Name</th>
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Role</th>
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Specialization</th>
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">On Duty</th>
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Shift</th>
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Phone</th>
                <th className="py-2 px-3 font-semibold text-[var(--text-secondary)]">Languages</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)]">
                  <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{s.name}</td>
                  <td className="py-3 px-3">
                    <span className="badge badge-info">{s.role}</span>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{s.specialization || '-'}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.isOnDuty ? 'var(--success)' : 'var(--text-secondary)' }} />
                      <span className="text-[var(--text-primary)]">{s.isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{s.shiftStart && s.shiftEnd ? `${s.shiftStart} - ${s.shiftEnd}` : '-'}</td>
                  <td className="py-3 px-3">
                    <a href={`tel:${s.phone}`} className="text-[var(--primary)] hover:underline">{s.phone}</a>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {s.languages.map((l) => (
                        <span key={l} className="badge badge-info">{l}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {summary.medicine.criticalItems.length > 0 && (
        <div className="card border-l-4 border-[var(--danger)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">⚠️ Critical Items Needing Attention</h2>
          <ul className="list-disc pl-5 text-sm text-[var(--text-secondary)]">
            {summary.medicine.criticalItems.map((item, idx) => (
              <li key={idx}>{item.name}: {item.currentStock} remaining (threshold: {item.minThreshold})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
