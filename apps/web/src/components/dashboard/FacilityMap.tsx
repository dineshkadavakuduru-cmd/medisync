'use client';

import React from 'react';

interface FacilityMapProps {
  facilities?: Array<{
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    bedsAvailable: number;
    bedsTotal: number;
  }>;
}

export function FacilityMap({ facilities = [] }: FacilityMapProps) {
  return (
    <div className="card h-[500px] relative">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Facility Map</h3>
        <span className="badge badge-info">Leaflet Map Placeholder</span>
      </div>
      <div className="w-full h-[440px] bg-[var(--color-card-bg)] rounded-lg flex items-center justify-center relative overflow-hidden">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🗺️</div>
          <p className="text-[var(--color-text-secondary)] text-lg">Interactive Map with Leaflet</p>
          <p className="text-[var(--color-text-secondary)] text-sm mt-2">Shows facility locations, bed availability, and routing</p>
        </div>
        {facilities.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {facilities.slice(0, 4).map((f) => (
                <div key={f.id} className="text-center">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-[var(--color-text-secondary)]">
                    {f.bedsAvailable}/{f.bedsTotal} beds
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}