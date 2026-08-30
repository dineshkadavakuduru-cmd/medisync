import { OutbreakAlert } from '../types/index.js';

const CONDITIONS_TO_MONITOR = ['malaria', 'dengue', 'typhoid', 'diarrhea', 'tuberculosis', 'covid_like', 'chikungunya', 'leptospirosis'];
const REGIONS = ['Mulshi', 'Velhe', 'Junnar', 'Ambegaon', 'Bhor', 'Khed', 'Maval', 'Haveli'];

const RECOMMENDATIONS: Record<string, Record<string, string>> = {
  OUTBREAK: {
    dengue: 'Activate district-wide dengue response protocol. Deploy fogging teams to affected taluka. Increase ORS and IV fluid stock at nearby Sub-Centres. Issue community awareness advisory.',
    malaria: 'Activate malaria rapid response team. Deploy vector control measures. Increase testing capacity at all facilities in region. Stock anti-malarial drugs.',
    typhoid: 'Issue boil-water advisory. Deploy water quality testing teams. Increase antibiotic stock. Launch hygiene awareness campaign.',
    diarrhea: 'Activate ORS distribution drive. Test water sources in affected villages. Increase oral rehydration and zinc stock at facilities.',
    tuberculosis: 'Initiate active case finding. Deploy mobile X-ray unit. Increase drug stock. Contact trace close contacts.',
    covid_like: 'Activate isolation protocol. Deploy testing teams. Increase PPE and oxygen stock. Issue public health advisory.',
    chikungunya: 'Deploy vector control teams. Increase pain management and anti-inflammatory stock. Issue community awareness on mosquito breeding prevention.',
    leptospirosis: 'Issue advisory against wading in flood water. Deploy testing kits. Increase antibiotic stock at PHCs.',
  },
  WARNING: {
    dengue: 'Increase dengue testing at regional facilities. Verify chloroquine and paracetamol stock. Schedule ASHA awareness drives in affected villages.',
    malaria: 'Increase malaria testing at regional facilities. Verify chloroquine stock. Schedule ASHA awareness drives in affected villages.',
    typhoid: 'Increase typhoid testing. Verify antibiotic stock. Monitor water quality reports.',
    diarrhea: 'Increase ORS stock. Check water quality reports for the taluka. Monitor for additional cases.',
    tuberculosis: 'Increase sputum testing. Review TB medication stock. Identify and screen contacts.',
    covid_like: 'Increase testing capacity. Verify oxygen and PPE stock. Monitor for cluster spread.',
    chikungunya: 'Increase testing. Verify pain management stock. Monitor vector indices.',
    leptospirosis: 'Increase testing in at-risk populations. Verify antibiotic stock. Issue public advisory.',
  },
  WATCH: {
    dengue: 'Monitor closely. Ensure ORS stock is adequate. Check water quality reports for the taluka.',
    malaria: 'Monitor closely. Ensure anti-malarial stock is adequate. Check vector indices.',
    typhoid: 'Monitor closely. Ensure antibiotic stock is adequate. Check water sources.',
    diarrhea: 'Monitor closely. Ensure ORS stock is adequate. Check water sources.',
    tuberculosis: 'Monitor closely. Ensure TB drug stock is adequate. Track new cases.',
    covid_like: 'Monitor closely. Ensure testing capacity is ready. Track symptoms.',
    chikungunya: 'Monitor closely. Ensure pain management stock is adequate.',
    leptospirosis: 'Monitor closely. Ensure antibiotic stock is adequate.',
  },
};

function generateWeeklyBaseline(baseMin: number, baseMax: number, weeks: number): number[] {
  const data: number[] = [];
  for (let i = 0; i < weeks; i++) {
    data.push(Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin);
  }
  return data;
}

function calculateStats(weeks: number[]): { avg: number; stdDev: number } {
  const n = weeks.length;
  const sum = weeks.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const variance = weeks.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  return { avg, stdDev };
}

function getSeverity(anomalyScore: number): 'WATCH' | 'WARNING' | 'OUTBREAK' {
  if (anomalyScore >= 2.0) return 'OUTBREAK';
  if (anomalyScore >= 1.5) return 'WARNING';
  if (anomalyScore >= 1.0) return 'WATCH';
  return 'WATCH';
}

function getTrend(weeks: number[]): 'RISING' | 'STABLE' | 'DECLINING' {
  const last3 = weeks.slice(-3);
  if (last3.length < 2) return 'STABLE';
  const diff = last3[last3.length - 1] - last3[0];
  if (diff > 1) return 'RISING';
  if (diff < -1) return 'DECLINING';
  return 'STABLE';
}

function getVillages(region: string): string[] {
  const villageMap: Record<string, string[]> = {
    Mulshi: ['Paud', 'Pavna', 'Kusgaon', 'Anturli'],
    Velhe: ['Velhe', 'Shiravali', 'Kanhe', 'Kusgaon'],
    Junnar: ['Junnar', 'Aptale', 'Mahalunge', 'Narayangaon'],
    Ambegaon: ['Ambegaon', 'Bhimashankar', 'Manchar', 'Kurund'],
    Bhor: ['Bhor', 'Velu', 'Nira', 'Rajgurunagar'],
    Khed: ['Khed', 'Rajmachi', 'Kusur', 'Talegaon'],
    Maval: ['Maval', 'Pimpri', 'Chinchwad', 'Talawade'],
    Haveli: ['Haveli', 'Hadapsar', 'Kharadi', 'Wadgaon'],
  };
  return villageMap[region] || ['Village A', 'Village B', 'Village C'];
}

export function detectOutbreaks(): OutbreakAlert[] {
  const alerts: OutbreakAlert[] = [];
  const now = new Date().toISOString();

  const activeOutbreaks: { condition: string; region: string; baseMin: number; baseMax: number; spike: number }[] = [
    { condition: 'dengue', region: 'Velhe', baseMin: 3, baseMax: 6, spike: 12 },
    { condition: 'malaria', region: 'Junnar', baseMin: 4, baseMax: 7, spike: 8 },
    { condition: 'diarrhea', region: 'Bhor', baseMin: 2, baseMax: 4, spike: 5 },
  ];

  const processedPairs = new Set<string>();

  for (const outbreak of activeOutbreaks) {
    const key = `${outbreak.condition}-${outbreak.region}`;
    if (processedPairs.has(key)) continue;
    processedPairs.add(key);

    const baseline = generateWeeklyBaseline(outbreak.baseMin, outbreak.baseMax, 12);
    baseline[baseline.length - 1] = outbreak.spike;
    const { avg, stdDev } = calculateStats(baseline.slice(0, -1));
    const current = outbreak.spike;
    const safeStdDev = Math.max(stdDev, 0.5);
    const anomalyScore = (current - avg) / safeStdDev;
    const severity = getSeverity(anomalyScore);
    const trend = getTrend(baseline);
    const facilityIds = ['facility-1', 'facility-2', 'facility-3'].filter(() => Math.random() > 0.3);
    const recommendation = RECOMMENDATIONS[severity]?.[outbreak.condition] || 'Monitor the situation and take appropriate action.';

    alerts.push({
      id: `alert-${outbreak.condition}-${outbreak.region}-${Date.now()}`,
      condition: outbreak.condition.charAt(0).toUpperCase() + outbreak.condition.slice(1),
      region: outbreak.region,
      facilityIds,
      caseCount: current,
      baselineAvg: Math.round(avg * 10) / 10,
      anomalyScore: Math.round(anomalyScore * 10) / 10,
      severity,
      trend,
      firstDetected: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: now,
      affectedDemographics: {
        avgAge: Math.floor(Math.random() * 30) + 20,
        genderSplit: {
          male: Math.floor(Math.random() * 30) + 35,
          female: Math.floor(Math.random() * 30) + 35,
        },
        mostAffectedVillages: getVillages(outbreak.region).slice(0, 3),
      },
      recommendation,
    });
  }

  return alerts;
}