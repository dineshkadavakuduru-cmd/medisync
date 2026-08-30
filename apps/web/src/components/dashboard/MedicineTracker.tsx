'use client';

import React from 'react';

interface MedicineData {
  name: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
  facilities: Array<{
    name: string;
    stock: number;
    status: 'adequate' | 'low' | 'critical';
  }>;
}

const mockMedicines: MedicineData[] = [
  {
    name: 'Paracetamol 500mg',
    category: 'Analgesic',
    stock: 12450,
    threshold: 5000,
    unit: 'tablets',
    facilities: [
      { name: 'District Hospital Pune', stock: 5000, status: 'adequate' },
      { name: 'CHC Maval', stock: 800, status: 'low' },
      { name: 'PHC Khed', stock: 150, status: 'critical' },
      { name: 'Sub Centre Mulshi', stock: 50, status: 'critical' },
    ],
  },
  {
    name: 'Amoxicillin 250mg',
    category: 'Antibiotic',
    stock: 8200,
    threshold: 3000,
    unit: 'capsules',
    facilities: [
      { name: 'District Hospital Pune', stock: 3500, status: 'adequate' },
      { name: 'CHC Maval', stock: 1200, status: 'adequate' },
      { name: 'PHC Khed', stock: 400, status: 'low' },
      { name: 'Sub Centre Mulshi', stock: 100, status: 'critical' },
    ],
  },
  {
    name: 'ORS Packets',
    category: 'Rehydration',
    stock: 3200,
    threshold: 2000,
    unit: 'packets',
    facilities: [
      { name: 'District Hospital Pune', stock: 1500, status: 'adequate' },
      { name: 'CHC Maval', stock: 500, status: 'adequate' },
      { name: 'PHC Khed', stock: 200, status: 'low' },
      { name: 'Sub Centre Mulshi', stock: 50, status: 'critical' },
    ],
  },
  {
    name: 'Iron Folic Acid',
    category: 'Supplement',
    stock: 15000,
    threshold: 5000,
    unit: 'tablets',
    facilities: [
      { name: 'District Hospital Pune', stock: 6000, status: 'adequate' },
      { name: 'CHC Maval', stock: 2000, status: 'adequate' },
      { name: 'PHC Khed', stock: 800, status: 'adequate' },
      { name: 'Sub Centre Mulshi', stock: 300, status: 'adequate' },
    ],
  },
];

const statusColors = {
  adequate: 'var(--color-success)',
  low: 'var(--color-warning)',
  critical: 'var(--color-danger)',
};

const statusLabels = {
  adequate: 'Adequate',
  low: 'Low Stock',
  critical: 'Critical',
};

export function MedicineTracker() {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">Medicine Stock Tracker</h3>

      <div className="space-y-6">
        {mockMedicines.map((medicine) => {
          const overallPercent = Math.min(100, Math.round((medicine.stock / medicine.threshold) * 100));
          const overallStatus = overallPercent >= 100 ? 'adequate' : overallPercent >= 50 ? 'low' : 'critical';

          return (
            <div key={medicine.name} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="p-4 bg-[var(--color-card-bg)] border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-[var(--color-text-primary)]">{medicine.name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{medicine.category}</div>
                  </div>
                  <span
                    className="badge"
                    style={{ backgroundColor: `${statusColors[overallStatus]}20`, color: statusColors[overallStatus] }}
                  >
                    {statusLabels[overallStatus]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, overallPercent)}%`, backgroundColor: statusColors[overallStatus] }}
                    />
                  </div>
                  <div className="text-[var(--color-text-secondary)] w-24 text-right">
                    {medicine.stock.toLocaleString()} {medicine.unit}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {medicine.facilities.map((facility) => (
                    <div
                      key={facility.name}
                      className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg"
                    >
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">{facility.name}</div>
                      <div className="font-mono font-medium text-[var(--color-text-primary)]">
                        {facility.stock.toLocaleString()}
                      </div>
                      <span
                        className="badge badge-xs mt-1"
                        style={{
                          backgroundColor: `${statusColors[facility.status]}20`,
                          color: statusColors[facility.status],
                        }}
                      >
                        {statusLabels[facility.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}