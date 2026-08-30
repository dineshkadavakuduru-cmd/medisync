'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';

interface TriageRecord {
  id: string;
  patientAge: number;
  patientGender: string;
  symptoms: string[];
  severity: string;
  confidence: number;
  needsReferral: boolean;
  aiSummary: string;
  createdAt: string;
}

export default function TriageManagementPage() {
  const [records, setRecords] = useState<TriageRecord[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/triage');
      const data = await res.json();
      const items = (data.data || []) as TriageRecord[];
      setRecords(items.reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'ALL' ? records : records.filter(r => r.severity === filter);

  const severityConfig: Record<string, { bg: string; text: string }> = {
    RED: { bg: 'bg-red-100 text-red-700', text: 'Critical' },
    YELLOW: { bg: 'bg-yellow-100 text-yellow-700', text: 'Moderate' },
    GREEN: { bg: 'bg-green-100 text-green-700', text: 'Mild' },
  };

  const stats = {
    total: records.length,
    avgResponse: '2.1s',
    redCount: records.filter(r => r.severity === 'RED').length,
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="container space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">AI Triage Management</h1>
                <p className="text-sm text-[var(--text-secondary)]">Monitor and review AI-powered triage assessments</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">Total Today</div>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.total}</div>
              </div>
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">Average Response Time</div>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.avgResponse}</div>
              </div>
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">RED Alerts</div>
                <div className="text-3xl font-bold text-[var(--danger)]">{stats.redCount}</div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setFilter('ALL')} className={`badge ${filter === 'ALL' ? 'badge-info' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>All</button>
                <button onClick={() => setFilter('RED')} className={`badge ${filter === 'RED' ? 'badge-danger' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>🔴 Critical</button>
                <button onClick={() => setFilter('YELLOW')} className={`badge ${filter === 'YELLOW' ? 'badge-warning' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>🟡 Moderate</button>
                <button onClick={() => setFilter('GREEN')} className={`badge ${filter === 'GREEN' ? 'badge-success' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>🟢 Mild</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Time</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Patient</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Age/Gender</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Symptoms</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Severity</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Confidence</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Referred?</th>
                      <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">AI Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record) => (
                      <tr key={record.id} className="border-b border-[var(--border)] hover:bg-[var(--card-bg)]">
                        <td className="py-3 px-4 text-[var(--text-primary)]">{new Date(record.createdAt).toLocaleTimeString()}</td>
                        <td className="py-3 px-4 text-[var(--text-primary)]">Patient #{record.id.slice(-4)}</td>
                        <td className="py-3 px-4 text-[var(--text-primary)]">{record.patientAge} / {record.patientGender}</td>
                        <td className="py-3 px-4 text-[var(--text-primary)]">{record.symptoms.slice(0, 3).join(', ')}</td>
                        <td className="py-3 px-4">
                          <span className={`badge ${severityConfig[record.severity]?.bg}`}>{severityConfig[record.severity]?.text}</span>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-primary)]">{Math.round(record.confidence * 100)}%</td>
                        <td className="py-3 px-4 text-[var(--text-primary)]">{record.needsReferral ? 'Yes' : 'No'}</td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] max-w-xs truncate" title={record.aiSummary}>{record.aiSummary}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="py-8 text-center text-[var(--text-secondary)]">No triage records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
