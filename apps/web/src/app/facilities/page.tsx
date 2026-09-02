'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Facility, FacilityType } from '@medisync/shared';
import { wsClient, WSMessageType } from '@/lib/websocket';
import { showToast } from '@/components/common/Toast';

interface FacilityAnalytics {
  id: string;
  name: string;
  type: FacilityType;
  bedOccupancy: number;
  medicineAvailability: number;
  staffOnDuty: number;
  todayPatients: number;
  pendingReferrals: number;
  performanceScore: number;
}

interface DistrictSummary {
  totalBeds: number;
  availableBeds: number;
  avgMedicineAvailability: number;
  totalStaffOnDuty: number;
  facilitiesWithCriticalStock: number;
}

export default function FacilitiesPage() {
  const router = useRouter();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [analytics, setAnalytics] = useState<FacilityAnalytics[]>([]);
  const [districtSummary, setDistrictSummary] = useState<DistrictSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');

  const loadData = async () => {
    setLoading(true);
    try {
      const [facRes, analyticsRes] = await Promise.all([
        fetch('http://localhost:3001/api/facilities'),
        fetch('http://localhost:3001/api/analytics/facilities'),
      ]);
      const facData = await facRes.json();
      const analyticsData = await analyticsRes.json();
      if (facData.success) setFacilities(facData.data || []);
      if (analyticsData.success && analyticsData.data) {
        setAnalytics(analyticsData.data.facilities || []);
        setDistrictSummary(analyticsData.data.districtSummary || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    wsClient.connect();
    const handleUpdate = (msg: any) => {
      loadData();
      let text = '';
      if (msg.type === 'BED_UPDATE') text = `🛏️ Bed update at ${msg.facilityId}`;
      else if (msg.type === 'MEDICINE_UPDATE') text = `💊 Stock update: ${msg.data?.name || 'medicine'}`;
      else if (msg.type === 'STAFF_UPDATE') text = `👨‍⚕️ Staff duty changed`;
      else if (msg.type === 'ALERT_NEW') text = `🚨 New alert at ${msg.facilityId}`;
      if (text) showToast(text, msg.type === 'ALERT_NEW' ? 'danger' : msg.type === 'MEDICINE_UPDATE' && msg.data?.status === 'CRITICAL' ? 'warning' : 'info');
    };
    wsClient.on('BED_UPDATE', handleUpdate);
    wsClient.on('MEDICINE_UPDATE', handleUpdate);
    wsClient.on('STAFF_UPDATE', handleUpdate);
    wsClient.on('ALERT_NEW', handleUpdate);
    return () => wsClient.disconnect();
  }, [loadData]);

  const facilityMap = useMemo(() => {
    const map = new Map<string, FacilityAnalytics>();
    analytics.forEach((a) => map.set(a.id, a));
    return map;
  }, [analytics]);

  const filtered = useMemo(() => {
    let list = facilities.filter((f) => {
      const matchesType = filterType === 'ALL' || f.type === filterType;
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });

    list.sort((a, b) => {
      const aData = facilityMap.get(a.id);
      const bData = facilityMap.get(b.id);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'bedOccupancy') return (bData?.bedOccupancy || 0) - (aData?.bedOccupancy || 0);
      if (sortBy === 'medicineAvailability') return (bData?.medicineAvailability || 0) - (aData?.medicineAvailability || 0);
      if (sortBy === 'performanceScore') return (bData?.performanceScore || 0) - (aData?.performanceScore || 0);
      return 0;
    });

    return list;
  }, [facilities, filterType, searchQuery, sortBy, facilityMap]);

  const typeColors: Record<FacilityType, string> = {
    SUB_CENTRE: 'var(--success)',
    PHC: 'var(--info)',
    CHC: 'var(--warning)',
    DISTRICT_HOSPITAL: 'var(--danger)',
  };

  const getStatusColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getStatusLabel = (score: number) => {
    if (score >= 80) return '🟢 Normal';
    if (score >= 60) return '🟡 Attention';
    return '🔴 Critical';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Healthcare Facilities</h1>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-[var(--primary)] to-[#004d43] p-4 sm:p-6 text-white">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{districtSummary?.totalBeds || 0}</div>
              <div className="text-xs opacity-80 mt-1">Total Beds</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{districtSummary?.availableBeds || 0}</div>
              <div className="text-xs opacity-80 mt-1">Available Beds</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{districtSummary?.avgMedicineAvailability || 0}%</div>
              <div className="text-xs opacity-80 mt-1">Avg Medicine</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{districtSummary?.totalStaffOnDuty || 0}</div>
              <div className="text-xs opacity-80 mt-1">Staff On Duty</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{districtSummary?.facilitiesWithCriticalStock || 0}</div>
              <div className="text-xs opacity-80 mt-1">Critical Stock</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{facilities.length}</div>
              <div className="text-xs opacity-80 mt-1">Facilities</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 items-stretch sm:items-center">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
          >
            <option value="ALL">All Types</option>
            <option value="SUB_CENTRE">Sub-Centre</option>
            <option value="PHC">PHC</option>
            <option value="CHC">CHC</option>
            <option value="DISTRICT_HOSPITAL">District Hospital</option>
          </select>
          <input
            type="text"
            placeholder="Search facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm flex-1 min-w-0"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
          >
            <option value="name">Sort: Name</option>
            <option value="bedOccupancy">Sort: Bed Occupancy</option>
            <option value="medicineAvailability">Sort: Medicine</option>
            <option value="performanceScore">Sort: Performance</option>
          </select>
          <span className="text-sm text-[var(--text-secondary)] sm:ml-auto text-center sm:text-right">
            {filtered.length} of {facilities.length} facilities
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading facilities...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Facility</th>
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Type</th>
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Beds</th>
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Medicine</th>
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Staff On Duty</th>
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Performance</th>
                <th className="py-3 px-4 font-semibold text-[var(--text-secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((facility) => {
                const data = facilityMap.get(facility.id);
                const bedPercent = Math.round((facility.beds.available / facility.beds.total) * 100);
                const score = data?.performanceScore || 0;
                const medAvail = data?.medicineAvailability || facility.medicineAvailability;
                return (
                  <tr
                    key={facility.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--background)] cursor-pointer transition-colors"
                    onClick={() => router.push(`/facilities/${facility.id}`)}
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-[var(--text-primary)]">{facility.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{facility.district}, {facility.taluka}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="badge" style={{ backgroundColor: `${typeColors[facility.type]}20`, color: typeColors[facility.type] }}>
                        {facility.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-[var(--text-primary)] font-medium">{facility.beds.available}/{facility.beds.total}</div>
                      <div className="w-24 bg-[var(--border)] rounded-full h-1.5 mt-1">
                        <div className="h-1.5 rounded-full" style={{ width: `${bedPercent}%`, backgroundColor: bedPercent > 50 ? 'var(--success)' : bedPercent > 20 ? 'var(--warning)' : 'var(--danger)' }} />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{medAvail}%</span>
                        <div className="w-16 bg-[var(--border)] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${medAvail}%`, backgroundColor: medAvail > 60 ? 'var(--success)' : medAvail > 30 ? 'var(--warning)' : 'var(--danger)' }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[var(--text-primary)]">{data?.staffOnDuty ?? '-'}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: getStatusColor(score) }}>{score}</span>
                        <span className="text-xs text-[var(--text-secondary)]">/ 100</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm" style={{ color: getStatusColor(score) }}>{getStatusLabel(score)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
