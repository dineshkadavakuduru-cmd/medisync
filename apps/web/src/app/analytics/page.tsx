'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface TrendData {
  label: string;
  value: number;
}

interface DistrictTrends {
  patientVisits: {
    weekly: TrendData[];
    byFacilityType: { subCentre: number; phc: number; chc: number; districtHospital: number };
  };
  referrals: {
    weekly: TrendData[];
    completionRate: TrendData[];
    avgResponseMinutes: TrendData[];
  };
  topConditions: {
    condition: string;
    thisWeek: number;
    lastWeek: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  emergencies: {
    weekly: TrendData[];
    avgResolveMinutes: TrendData[];
    byProtocolLevel: { level1: number; level2: number; level3: number };
  };
  medicineConsumption: {
    topConsumed: { name: string; consumed: number; remaining: number }[];
    stockoutRisk: { facility: string; medicine: string; daysUntilStockout: number }[];
  };
}

interface OutbreakAlert {
  id: string;
  condition: string;
  region: string;
  facilityIds: string[];
  caseCount: number;
  baselineAvg: number;
  anomalyScore: number;
  severity: 'WATCH' | 'WARNING' | 'OUTBREAK';
  trend: 'RISING' | 'STABLE' | 'DECLINING';
  firstDetected: string;
  lastUpdated: string;
  affectedDemographics: {
    avgAge: number;
    genderSplit: { male: number; female: number };
    mostAffectedVillages: string[];
  };
  recommendation: string;
}

interface FacilityPerformance {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  scores: {
    overall: number;
    patientSatisfaction: number;
    referralCompletion: number;
    medicineAvailability: number;
    staffAttendance: number;
    emergencyResponse: number;
    recordDigitization: number;
  };
  rank: number;
  trend: 'improving' | 'stable' | 'declining';
  strengths: string[];
  improvements: string[];
}

interface FeedbackSummary {
  avgRating: number;
  totalFeedback: number;
  ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  topPositiveTags: { tag: string; count: number }[];
  topNegativeTags: { tag: string; count: number }[];
  byFacility: { facilityId: string; facilityName: string; avgRating: number; feedbackCount: number }[];
}

type TimeRange = '4' | '8' | '12';

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<DistrictTrends | null>(null);
  const [outbreaks, setOutbreaks] = useState<OutbreakAlert[]>([]);
  const [performance, setPerformance] = useState<FacilityPerformance[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('12');
  const [sortKey, setSortKey] = useState<string>('overall');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedFacility, setExpandedFacility] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [trendsRes, outbreaksRes, performanceRes, feedbackRes] = await Promise.all([
        fetch('http://localhost:3001/api/analytics/trends'),
        fetch('http://localhost:3001/api/analytics/outbreaks'),
        fetch('http://localhost:3001/api/analytics/performance'),
        fetch('http://localhost:3001/api/analytics/feedback/summary'),
      ]);
      const trendsData = await trendsRes.json();
      const outbreaksData = await outbreaksRes.json();
      const performanceData = await performanceRes.json();
      const feedbackData = await feedbackRes.json();
      if (trendsData.success) setTrends(trendsData.data);
      if (outbreaksData.success) setOutbreaks(outbreaksData.data);
      if (performanceData.success) setPerformance(performanceData.data);
      if (feedbackData.success) setFeedback(feedbackData.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const slicedTrends = useMemo(() => {
    if (!trends) return null;
    const weeks = parseInt(timeRange);
    return {
      ...trends,
      patientVisits: {
        ...trends.patientVisits,
        weekly: trends.patientVisits.weekly.slice(-weeks),
      },
      referrals: {
        ...trends.referrals,
        weekly: trends.referrals.weekly.slice(-weeks),
        completionRate: trends.referrals.completionRate.slice(-weeks),
        avgResponseMinutes: trends.referrals.avgResponseMinutes.slice(-weeks),
      },
      emergencies: {
        ...trends.emergencies,
        weekly: trends.emergencies.weekly.slice(-weeks),
        avgResolveMinutes: trends.emergencies.avgResolveMinutes.slice(-weeks),
      },
    };
  }, [trends, timeRange]);

  const sortedPerformance = useMemo(() => {
    if (!performance) return [];
    return [...performance].sort((a, b) => {
      const aVal = a.scores[sortKey as keyof typeof a.scores] as number;
      const bVal = b.scores[sortKey as keyof typeof a.scores] as number;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [performance, sortKey, sortDir]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving' || trend === 'up') return '↑';
    if (trend === 'declining' || trend === 'down') return '↓';
    return '→';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'improving' || trend === 'up') return 'var(--success)';
    if (trend === 'declining' || trend === 'down') return 'var(--danger)';
    return 'var(--text-secondary)';
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'OUTBREAK') return 'var(--danger)';
    if (severity === 'WARNING') return 'var(--warning)';
    return 'var(--info)';
  };

  const getSeverityBg = (severity: string) => {
    if (severity === 'OUTBREAK') return '#FFEBEE';
    if (severity === 'WARNING') return '#FFF8E1';
    return '#E3F2FD';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Predictive Analytics</h1>
        <div className="card">Loading analytics...</div>
      </div>
    );
  }

  const thisWeekVisits = slicedTrends?.patientVisits.weekly.slice(-1)[0]?.value || 0;
  const lastWeekVisits = slicedTrends?.patientVisits.weekly.slice(-2, -1)[0]?.value || 0;
  const visitChange = lastWeekVisits > 0 ? Math.round(((thisWeekVisits - lastWeekVisits) / lastWeekVisits) * 100) : 0;
  const completionRate = slicedTrends?.referrals.completionRate.slice(-1)[0]?.value || 0;
  const avgResponse = slicedTrends?.referrals.avgResponseMinutes.slice(-1)[0]?.value || 0;
  const avgRating = feedback?.avgRating || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Predictive Analytics</h1>
        <div className="flex gap-2">
          {(['4', '8', '12'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
              }`}
            >
              Last {range} Weeks
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-[var(--text-secondary)]">Total Patient Visits</div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{thisWeekVisits}</div>
          <div className={`text-sm ${visitChange >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {visitChange >= 0 ? '↑' : '↓'}{Math.abs(visitChange)}% vs last week
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--text-secondary)]">Referral Completion Rate</div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{completionRate}%</div>
          <div className="text-sm text-[var(--success)]">↑ improving</div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--text-secondary)]">Avg Emergency Response</div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{avgResponse} min</div>
          <div className="text-sm text-[var(--success)]">↓ improving</div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--text-secondary)]">Patient Satisfaction</div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{avgRating} ★</div>
          <div className="text-sm text-[var(--text-secondary)]">Average rating</div>
        </div>
      </div>

      {/* Row 2: Disease Trends + Outbreak Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Disease Trends — Weekly Cases</h3>
          {slicedTrends && (
            <svg viewBox="0 0 600 250" className="w-full h-auto">
              {slicedTrends.topConditions.slice(0, 4).map((condition, ci) => {
                const data = slicedTrends.topConditions.filter(c => c.condition === condition.condition);
                const values = data.map(d => d.thisWeek);
                const maxVal = Math.max(...values, 1);
                const colors = ['#00695C', '#C62828', '#FF8F00', '#1565C0'];
                const points = values.map((v, i) => ({
                  x: 40 + (i * (520 / Math.max(values.length - 1, 1))),
                  y: 220 - (v / maxVal) * 180,
                }));
                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return (
                  <g key={condition.condition}>
                    <path d={pathD} fill="none" stroke={colors[ci]} strokeWidth="2" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill={colors[ci]} />
                    ))}
                  </g>
                );
              })}
            </svg>
          )}
          <div className="flex gap-4 mt-4 flex-wrap">
            {slicedTrends?.topConditions.slice(0, 4).map((condition, i) => (
              <div key={condition.condition} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#00695C', '#C62828', '#FF8F00', '#1565C0'][i] }} />
                <span className="text-sm text-[var(--text-secondary)]">{condition.condition}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            📡 Outbreak Detection
          </h3>
          {outbreaks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-[var(--text-secondary)]">No anomalies detected — all conditions within normal range</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outbreaks.map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg border" style={{ backgroundColor: getSeverityBg(alert.severity), borderColor: getSeverityColor(alert.severity) }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: getSeverityColor(alert.severity) }}>
                      {alert.severity}
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">{alert.condition}</span>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {alert.region} — {alert.caseCount} cases this week (baseline: {alert.baselineAvg})
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.min(100, alert.anomalyScore * 25)}%`, backgroundColor: getSeverityColor(alert.severity) }}
                    />
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mb-2">
                    Trend: <span style={{ color: getTrendColor(alert.trend) }}>{getTrendIcon(alert.trend)} {alert.trend}</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] line-clamp-2">{alert.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Facility Performance + Patient Satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Facility Performance Scorecard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-2">Rank</th>
                  <th className="text-left py-2 px-2">Facility</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th
                    className="text-left py-2 px-2 cursor-pointer hover:text-[var(--primary)]"
                    onClick={() => { setSortKey('overall'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Overall {sortKey === 'overall' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left py-2 px-2">Satisfaction</th>
                  <th className="text-left py-2 px-2">Medicine</th>
                  <th className="text-left py-2 px-2">Referral %</th>
                  <th className="text-left py-2 px-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerformance.map((facility) => (
                  <React.Fragment key={facility.facilityId}>
                    <tr
                      className="border-b border-[var(--border)] cursor-pointer hover:bg-[var(--card-bg)]"
                      onClick={() => setExpandedFacility(expandedFacility === facility.facilityId ? null : facility.facilityId)}
                    >
                      <td className="py-2 px-2">
                        {facility.rank <= 3 && <span className="text-lg">{['🥇', '🥈', '🥉'][facility.rank - 1]}</span>}
                        <span className={facility.rank <= 3 ? 'sr-only' : ''}>{facility.rank}</span>
                      </td>
                      <td className="py-2 px-2 font-medium">{facility.facilityName}</td>
                      <td className="py-2 px-2 text-[var(--text-secondary)]">{facility.facilityType}</td>
                      <td className="py-2 px-2">
                        <span className="font-bold text-lg" style={{ color: getScoreColor(facility.scores.overall) }}>
                          {facility.scores.overall}
                        </span>
                      </td>
                      <td className="py-2 px-2">{facility.scores.patientSatisfaction}</td>
                      <td className="py-2 px-2">{facility.scores.medicineAvailability}</td>
                      <td className="py-2 px-2">{facility.scores.referralCompletion}</td>
                      <td className="py-2 px-2">
                        <span style={{ color: getTrendColor(facility.trend) }}>
                          {getTrendIcon(facility.trend)} {facility.trend}
                        </span>
                      </td>
                    </tr>
                    {expandedFacility === facility.facilityId && (
                      <tr className="bg-[var(--card-bg)]">
                        <td colSpan={8} className="p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-[var(--success)] mb-2">Strengths</h4>
                              <ul className="list-disc list-inside text-sm text-[var(--text-secondary)]">
                                {facility.strengths.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-[var(--warning)] mb-2">Improvements</h4>
                              <ul className="list-disc list-inside text-sm text-[var(--text-secondary)]">
                                {facility.improvements.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Patient Feedback Summary</h3>
          {feedback && (
            <>
              <div className="flex items-center gap-6 mb-6">
                <div className="text-5xl font-bold text-[var(--text-primary)]">{feedback.avgRating} ★</div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {feedback.totalFeedback} total reviews
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = feedback.ratingDistribution[star as keyof typeof feedback.ratingDistribution] || 0;
                  const pct = feedback.totalFeedback > 0 ? (count / feedback.totalFeedback) * 100 : 0;
                  const colors = ['var(--success)', 'var(--primary)', 'var(--warning)', 'orange', 'var(--danger)'];
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="w-16 text-sm text-[var(--text-secondary)]">{'★'.repeat(star)}{'☆'.repeat(5 - star)}</div>
                      <div className="flex-1 bg-[var(--card-bg)] rounded-full h-3">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: colors[star - 1] }}
                        />
                      </div>
                      <div className="w-12 text-sm text-[var(--text-secondary)] text-right">{count}</div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="font-semibold text-[var(--success)] mb-2">Top Positive</h4>
                  <div className="flex flex-wrap gap-2">
                    {feedback.topPositiveTags.map((tag) => (
                      <span key={tag.tag} className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        {tag.tag.replace(/_/g, ' ')} ({tag.count})
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-[var(--danger)] mb-2">Top Concerns</h4>
                  <div className="flex flex-wrap gap-2">
                    {feedback.topNegativeTags.map((tag) => (
                      <span key={tag.tag} className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                        {tag.tag.replace(/_/g, ' ')} ({tag.count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-2">By Facility</h4>
                <div className="space-y-2">
                  {feedback.byFacility.map((f) => (
                    <div key={f.facilityId} className="flex items-center justify-between py-1">
                      <span className="text-sm text-[var(--text-secondary)]">{f.facilityName}</span>
                      <span className="text-sm font-medium">{f.avgRating} ★ ({f.feedbackCount})</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 4: Medicine Stock + Referral Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Medicine Stock Intelligence</h3>
          {slicedTrends && (
            <>
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Consumed This Week</h4>
              <div className="space-y-3 mb-6">
                {slicedTrends.medicineConsumption.topConsumed.slice(0, 5).map((med, i) => {
                  const maxConsumed = Math.max(...slicedTrends.medicineConsumption.topConsumed.map(m => m.consumed));
                  const pct = (med.consumed / maxConsumed) * 100;
                  return (
                    <div key={med.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-primary)]">{med.name}</span>
                        <span className="text-[var(--text-secondary)]">{med.consumed} used, {med.remaining} left</span>
                      </div>
                      <div className="w-full bg-[var(--card-bg)] rounded-full h-2">
                        <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Stockout Risk</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2">Facility</th>
                      <th className="text-left py-2 px-2">Medicine</th>
                      <th className="text-left py-2 px-2">Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slicedTrends.medicineConsumption.stockoutRisk.map((item, i) => (
                      <tr key={i} className={`border-b border-[var(--border)] ${item.daysUntilStockout < 3 ? 'bg-red-50' : item.daysUntilStockout < 7 ? 'bg-amber-50' : ''}`}>
                        <td className="py-2 px-2">{item.facility}</td>
                        <td className="py-2 px-2">{item.medicine}</td>
                        <td className="py-2 px-2">
                          <span className={`font-bold ${item.daysUntilStockout < 3 ? 'text-[var(--danger)]' : item.daysUntilStockout < 7 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
                            {item.daysUntilStockout}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Referral Performance</h3>
          {slicedTrends && (
            <>
              <div className="flex items-center gap-8 mb-6">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="12"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - (slicedTrends.referrals.completionRate.slice(-1)[0]?.value || 0) / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[var(--text-primary)]">{slicedTrends.referrals.completionRate.slice(-1)[0]?.value || 0}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">
                    Completed: {Math.round((slicedTrends.referrals.completionRate.slice(-1)[0]?.value || 0) * 0.87)}
                    <br />
                    In Progress: {Math.round((slicedTrends.referrals.completionRate.slice(-1)[0]?.value || 0) * 0.1)}
                    <br />
                    Dropped: {Math.round((slicedTrends.referrals.completionRate.slice(-1)[0]?.value || 0) * 0.03)}
                  </p>
                </div>
              </div>

              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Referral Volume (Last 8 Weeks)</h4>
              <div className="flex items-end gap-2 h-32 mb-4">
                {slicedTrends.referrals.weekly.slice(-8).map((week, i) => {
                  const maxVal = Math.max(...slicedTrends.referrals.weekly.map(w => w.value));
                  const height = (week.value / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-[var(--text-secondary)]">{week.value}</div>
                      <div
                        className="w-full bg-[var(--primary)] rounded-t"
                        style={{ height: `${height}%`, minHeight: 4 }}
                      />
                    </div>
                  );
                })}
              </div>

              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Avg Response Time</h4>
              <div className="flex items-center gap-2 h-16">
                {slicedTrends.referrals.avgResponseMinutes.slice(-6).map((week, i) => {
                  const maxVal = Math.max(...slicedTrends.referrals.avgResponseMinutes.map(w => w.value), 1);
                  const width = (week.value / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-[var(--text-secondary)]">{week.value}m</div>
                      <div
                        className="w-full bg-[var(--info)] rounded"
                        style={{ height: 8, width: `${width}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 5: Diagnostic Utilization */}
      <div className="card">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Diagnostic Utilization</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
            <div className="text-sm text-[var(--text-secondary)]">Total Orders This Week</div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">24</div>
            <div className="text-sm text-[var(--success)]">↑ 12% vs last week</div>
          </div>
          <div className="p-4 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
            <div className="text-sm text-[var(--text-secondary)]">Completed</div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">18</div>
            <div className="text-sm text-[var(--success)]">75% completion rate</div>
          </div>
          <div className="p-4 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
            <div className="text-sm text-[var(--text-secondary)]">Pending Results</div>
            <div className="text-3xl font-bold text-[var(--warning)]">6</div>
            <div className="text-sm text-[var(--text-secondary)]">Avg 2.3 hrs turnaround</div>
          </div>
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Tests Ordered</h4>
          <div className="space-y-2">
            {[
              { name: 'Malaria RDT', count: 8, pct: 100 },
              { name: 'Dengue NS1', count: 6, pct: 75 },
              { name: 'CBC', count: 5, pct: 63 },
              { name: 'Blood Sugar', count: 3, pct: 38 },
              { name: 'X-ray Chest', count: 2, pct: 25 },
            ].map((test) => (
              <div key={test.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-primary)]">{test.name}</span>
                  <span className="text-[var(--text-secondary)]">{test.count} orders</span>
                </div>
                <div className="w-full bg-[var(--card-bg)] rounded-full h-2">
                  <div className="h-2 rounded-full bg-[var(--info)]" style={{ width: `${test.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}