import { DistrictTrends, TrendData } from '../types/index.js';

function generateTrend(base: number, variance: number, count: number, trendDir = 0): TrendData[] {
  const data: TrendData[] = [];
  for (let i = 0; i < count; i++) {
    const seasonalFactor = i >= 5 && i <= 9 ? 1.3 : 1.0;
    const value = Math.max(0, Math.round((base + (i * trendDir) + (Math.random() - 0.5) * variance) * seasonalFactor));
    data.push({ label: `Week ${i + 1}`, value });
  }
  return data;
}

function generateSeasonalConditions(): { condition: string; thisWeek: number; lastWeek: number; change: number; trend: 'up' | 'down' | 'stable' }[] {
  const base = [
    { condition: 'Malaria', base: 45, trend: 'up' as const },
    { condition: 'Anemia', base: 38, trend: 'stable' as const },
    { condition: 'Pregnancy Care', base: 32, trend: 'stable' as const },
    { condition: 'Diabetes', base: 28, trend: 'up' as const },
    { condition: 'Dengue', base: 12, trend: 'up' as const },
    { condition: 'Typhoid', base: 8, trend: 'down' as const },
    { condition: 'Diarrhea', base: 6, trend: 'stable' as const },
  ];

  return base.map((c) => {
    const thisWeek = Math.max(0, c.base + Math.floor((Math.random() - 0.5) * 10));
    const lastWeek = Math.max(0, c.base + Math.floor((Math.random() - 0.5) * 8));
    const change = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
    return {
      condition: c.condition,
      thisWeek,
      lastWeek,
      change,
      trend: c.trend,
    };
  });
}

export function getDistrictTrends(weeks: number = 12): DistrictTrends {
  return {
    patientVisits: {
      weekly: generateTrend(320, 40, weeks, 2),
      byFacilityType: { subCentre: 120, phc: 180, chc: 90, districtHospital: 30 },
    },
    referrals: {
      weekly: generateTrend(14, 4, weeks, 0.1),
      completionRate: generateTrend(72, 5, weeks, 1.2).map((d) => ({ ...d, value: Math.min(100, d.value + 15) })),
      avgResponseMinutes: generateTrend(25, 5, weeks, -1),
    },
    topConditions: generateSeasonalConditions(),
    emergencies: {
      weekly: generateTrend(3, 2, weeks, 0.05),
      avgResolveMinutes: generateTrend(35, 8, weeks, -2),
      byProtocolLevel: { level1: 12, level2: 5, level3: 2 },
    },
    medicineConsumption: {
      topConsumed: [
        { name: 'ORS Sachets', consumed: 2450, remaining: 1800 },
        { name: 'Paracetamol 500mg', consumed: 1890, remaining: 3200 },
        { name: 'Amoxicillin 250mg', consumed: 1340, remaining: 900 },
        { name: 'Chloroquine Tablets', consumed: 980, remaining: 1500 },
        { name: 'Zinc Tablets', consumed: 760, remaining: 2100 },
      ],
      stockoutRisk: [
        { facility: 'Velhe PHC', medicine: 'ORS Sachets', daysUntilStockout: 2 },
        { facility: 'Junnar Sub-Centre', medicine: 'Amoxicillin 250mg', daysUntilStockout: 1 },
        { facility: 'Bhor PHC', medicine: 'Chloroquine Tablets', daysUntilStockout: 5 },
      ].sort((a, b) => a.daysUntilStockout - b.daysUntilStockout),
    },
  };
}