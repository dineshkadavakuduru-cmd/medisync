import { mockFacilities } from '../database/facilities.js';
import { FacilityPerformance } from '../types/index.js';
import { getStaff } from './staffService.js';
import { calculateFacilityMedicineAvailability } from './inventoryService.js';

const STRENGTHS_POOL = [
  '100% medicine availability',
  'Fastest emergency response in district',
  'Highest patient satisfaction score',
  'Best record digitization rate',
  'Zero staff absenteeism this week',
  'Complete specialist coverage',
  'Excellent referral turnaround time',
];

const IMPROVEMENTS_POOL = [
  'Patient satisfaction below district average',
  'Staff attendance needs improvement',
  'Medicine availability below target',
  'Record digitization below 80%',
  'Emergency response time above target',
  'Referral completion rate below district average',
  'Queue management efficiency can improve',
];

function getRandomItems(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getFacilityPerformance(): FacilityPerformance[] {
  const performances: FacilityPerformance[] = [];

  mockFacilities.forEach((facility, index) => {
    const medAvail = calculateFacilityMedicineAvailability(facility.id);
    const staff = getStaff(facility.id);
    const totalStaff = staff.length;
    const onDutyStaff = staff.filter((s) => s.isOnDuty).length;
    const staffAttendance = totalStaff > 0 ? Math.round((onDutyStaff / totalStaff) * 100) : 0;

    const referralCompletion = Math.min(100, Math.max(50, 72 + Math.floor(Math.random() * 20)));
    const emergencyResponse = Math.min(100, Math.max(40, 60 + Math.floor(Math.random() * 35)));
    const recordDigitization = Math.min(100, Math.max(30, 50 + Math.floor(Math.random() * 45)));
    const patientSatisfaction = Math.min(100, Math.max(40, 55 + Math.floor(Math.random() * 40)));

    const overall = Math.round(
      patientSatisfaction * 0.20 +
        referralCompletion * 0.20 +
        medAvail * 0.15 +
        staffAttendance * 0.15 +
        emergencyResponse * 0.15 +
        recordDigitization * 0.15
    );

    const trendRand = Math.random();
    const trend: 'improving' | 'stable' | 'declining' = trendRand > 0.6 ? 'improving' : trendRand > 0.3 ? 'stable' : 'declining';

    performances.push({
      facilityId: facility.id,
      facilityName: facility.name,
      facilityType: facility.type,
      scores: {
        overall,
        patientSatisfaction,
        referralCompletion,
        medicineAvailability: medAvail,
        staffAttendance,
        emergencyResponse,
        recordDigitization,
      },
      rank: 0,
      trend,
      strengths: getRandomItems(STRENGTHS_POOL, 2),
      improvements: getRandomItems(IMPROVEMENTS_POOL, 2),
    });
  });

  performances.sort((a, b) => b.scores.overall - a.scores.overall);
  performances.forEach((p, i) => {
    p.rank = i + 1;
  });

  return performances;
}

export function getSingleFacilityPerformance(facilityId: string): FacilityPerformance | undefined {
  return getFacilityPerformance().find((p) => p.facilityId === facilityId);
}