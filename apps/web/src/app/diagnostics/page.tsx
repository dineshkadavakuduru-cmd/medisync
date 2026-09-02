'use client';

import React, { useEffect, useState } from 'react';

interface DiagnosticOrder {
  id: string;
  patientName: string;
  facilityName: string;
  tests: string[];
  priority: string;
  status: string;
  results: { testName: string; testCode: string; value: string; unit: string; flag: string }[];
  createdAt: string;
  completedAt?: string;
}

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  ORDERED: { bg: 'bg-yellow-100 text-yellow-700', label: 'Ordered' },
  IN_PROGRESS: { bg: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-green-100 text-green-700', label: 'Completed' },
  CANCELLED: { bg: 'bg-gray-100 text-gray-700', label: 'Cancelled' },
};

const FLAG_CONFIG: Record<string, { bg: string; label: string }> = {
  NORMAL: { bg: 'bg-green-100 text-green-700', label: 'Normal' },
  ABNORMAL: { bg: 'bg-yellow-100 text-yellow-700', label: 'Abnormal' },
  CRITICAL: { bg: 'bg-red-100 text-red-700', label: 'Critical' },
};

export default function DiagnosticsPage() {
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/diagnostics/orders');
      const data = await res.json();
      setOrders(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddResult = async (orderId: string, testCode: string) => {
    const value = prompt('Enter test result value:');
    if (!value) return;
    const flag = prompt('Enter flag (NORMAL/ABNORMAL/CRITICAL):', 'NORMAL') || 'NORMAL';
    try {
      await fetch(`http://localhost:3001/api/diagnostics/orders/${orderId}/result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCode, value, unit: '', flag }),
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Diagnostic Coordination</h1>
        <p className="text-sm text-[var(--text-secondary)]">Manage lab orders and track results</p>
      </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setFilter('ALL')} className={`badge ${filter === 'ALL' ? 'badge-info' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>All</button>
                <button onClick={() => setFilter('ORDERED')} className={`badge ${filter === 'ORDERED' ? 'badge-warning' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>Ordered</button>
                <button onClick={() => setFilter('IN_PROGRESS')} className={`badge ${filter === 'IN_PROGRESS' ? 'badge-info' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>In Progress</button>
                <button onClick={() => setFilter('COMPLETED')} className={`badge ${filter === 'COMPLETED' ? 'badge-success' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>Completed</button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-[var(--text-secondary)]">No diagnostic orders found.</p>
              ) : (
                <div className="space-y-4">
                  {filtered.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.ORDERED;
                    return (
                      <div key={order.id} className="p-4 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-medium text-[var(--text-primary)]">{order.patientName}</span>
                            <span className="text-sm text-[var(--text-secondary)] ml-2">({order.facilityName})</span>
                          </div>
                          <span className={`badge ${statusConfig.bg}`}>{statusConfig.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {order.tests.map((test) => (
                            <span key={test} className="px-2 py-1 bg-gray-100 text-xs rounded">{test}</span>
                          ))}
                        </div>
                        {order.results.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {order.results.map((result) => {
                              const flagConfig = FLAG_CONFIG[result.flag] || FLAG_CONFIG.NORMAL;
                              return (
                                <div key={result.testCode} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-[var(--border)]">
                                  <span className="text-[var(--text-primary)]">{result.testName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{result.value} {result.unit}</span>
                                    <span className={`badge ${flagConfig.bg}`}>{flagConfig.label}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(order.status === 'ORDERED' || order.status === 'IN_PROGRESS') && (
                          <button
                            onClick={() => handleAddResult(order.id, order.tests[0])}
                            className="text-[var(--primary)] hover:underline text-sm"
                          >
                            + Add Result
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                  )}
               </div>
    </div>
  );
}
