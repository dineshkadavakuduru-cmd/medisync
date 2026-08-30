'use client';

import React, { useEffect, useState } from 'react';

interface Patient {
  id: string;
  name: string;
  abhaId: string;
  age: number;
  gender: string;
  village: string;
  district: string;
  createdAt: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/patients');
      const data = await res.json();
      setPatients(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = patients.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.abhaId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.village.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'All') return true;
    if (filter === 'Recent') return new Date(p.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Patients</h1>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search by name or ABHA ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
          />
          <div className="flex gap-2">
            {['All', 'Recent', 'High-Risk', 'Referred'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--border)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading patients...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card-bg)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">ABHA ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Age/Gender</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Village</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Last Visit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((patient) => (
                  <tr key={patient.id} className="hover:bg-[var(--card-bg)] transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{patient.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{patient.abhaId}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{patient.age} / {patient.gender}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{patient.village}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{new Date(patient.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-success">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
