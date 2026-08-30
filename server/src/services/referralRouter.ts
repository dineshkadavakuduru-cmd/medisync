import { TriageSeverity, Facility } from '../types/index.js';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findBestFacility(
  severity: TriageSeverity,
  currentFacility: Facility,
  allFacilities: Facility[]
): { facility: Facility; distanceKm: number; reason: string } {
  const minType =
    severity === TriageSeverity.RED ? 'DISTRICT_HOSPITAL' :
    severity === TriageSeverity.YELLOW ? 'CHC' :
    'PHC';

  const facilityTypeRank: Record<string, number> = { SUB_CENTRE: 0, PHC: 1, CHC: 2, DISTRICT_HOSPITAL: 3 };

  const eligible = allFacilities.filter(f =>
    f.id !== currentFacility.id &&
    facilityTypeRank[f.type] >= facilityTypeRank[minType] &&
    f.beds.available > 0 &&
    f.isActive
  );

  if (eligible.length === 0) {
    const dh = allFacilities.find(f => f.type === 'DISTRICT_HOSPITAL');
    if (!dh) {
      return { facility: currentFacility, distanceKm: 0, reason: 'No suitable facility found' };
    }
    return { facility: dh, distanceKm: 0, reason: 'Emergency fallback — no beds available at preferred facilities' };
  }

  const withDistance = eligible.map(f => ({
    facility: f,
    distanceKm: haversineDistance(currentFacility.latitude, currentFacility.longitude, f.latitude, f.longitude),
  })).sort((a, b) => a.distanceKm - b.distanceKm);

  const best = withDistance[0];

  return {
    facility: best.facility,
    distanceKm: Math.round(best.distanceKm * 10) / 10,
    reason: `Nearest ${best.facility.type.replace('_', ' ')} with available beds (${best.distanceKm.toFixed(1)} km)`,
  };
}
