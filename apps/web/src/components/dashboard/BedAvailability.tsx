'use client';

import React from 'react';

interface BedData {
  facility: string;
  type: string;
  total: number;
  available: number;
  occupied: number;
  percentage: number;
}

const mockBedData: BedData[] = [
  { facility: 'District Hospital Pune', type: 'District Hospital', total: 500, available: 127, occupied: 373, percentage: 25 },
  { facility: 'CHC Maval', type: 'CHC', total: 50, available: 12, occupied: 38, percentage: 24 },
  { facility: 'PHC Khed', type: 'PHC', total: 10, available: 3, occupied: 7, percentage: 30 },
  { facility: 'Sub Centre Mulshi', type: 'Sub Centre', total: 2, available: 1, occupied: 1, percentage: 50 },
  { facility: 'PHC Bhor', type: 'PHC', total: 10, available: 0, occupied: 10, percentage: 0 },
  { facility: 'CHC Junnar', type: 'CHC', total: 50, available: 18, occupied: 32, percentage: 36 },
];

export function BedAvailability() {
  const totalBeds = mockBedData.reduce((sum, d) => sum + d.total, 0);
  const totalAvailable = mockBedData.reduce((sum, d) => sum + d.available, 0);
  const overallPercent = Math.round((totalAvailable / totalBeds) * 100);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Bed Availability</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-[var(--color-primary)]">{overallPercent}%</div>
          <div className="text-sm text-[var(--color-text-secondary)]">{totalAvailable}/{totalBeds} beds available</div>
        </div>
      </div>

      <div className="space-y-4">
        {mockBedData.map((data) => {
          const color = data.percentage > 30 ? 'var(--color-success)' : data.percentage > 10 ? 'var(--color-warning)' : 'var(--color-danger)';
          return (
            <div key={data.facility} className="p-4 bg-[var(--color-card-bg)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-[var(--color-text-primary)]">{data.facility}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{data.type}</div>
                </div>
                <span className="badge" style={{ backgroundColor: `${color}20`, color }}>
                  {data.percentage}% free
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${data.percentage}%`, backgroundColor: color }}
                  />
                </div>
                <div className="text-[var(--color-text-secondary)] w-32 text-right">
                  {data.available}/{data.total}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}