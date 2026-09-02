'use client';

import React, { useEffect, useState } from 'react';

interface Appointment {
  id: string;
  patientName: string;
  facilityName: string;
  doctorName?: string;
  dateTime: string;
  type: string;
  status: string;
  priority: string;
  estimatedWaitMinutes: number;
}

interface QueueEntry {
  appointmentId: string;
  patientName: string;
  priority: string;
  position: number;
  estimatedWaitMinutes: number;
}

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  BOOKED: { bg: 'bg-blue-100 text-blue-700', label: 'Booked' },
  CHECKED_IN: { bg: 'bg-yellow-100 text-yellow-700', label: 'Checked In' },
  IN_PROGRESS: { bg: 'bg-green-100 text-green-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-gray-100 text-gray-700', label: 'Completed' },
  CANCELLED: { bg: 'bg-gray-100 text-gray-700', label: 'Cancelled' },
  NO_SHOW: { bg: 'bg-red-100 text-red-700', label: 'No Show' },
};

const PRIORITY_CONFIG: Record<string, { bg: string; label: string }> = {
  RED: { bg: 'bg-red-100 text-red-700', label: 'Critical' },
  YELLOW: { bg: 'bg-yellow-100 text-yellow-700', label: 'Moderate' },
  GREEN: { bg: 'bg-green-100 text-green-700', label: 'Mild' },
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [aptRes, queueRes] = await Promise.all([
        fetch('http://localhost:3001/api/appointments?facilityId=facility-2'),
        fetch('http://localhost:3001/api/appointments/queue/facility-2'),
      ]);
      const aptData = await aptRes.json();
      const queueData = await queueRes.json();
      setAppointments(aptData.data || []);
      setQueue(queueData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await fetch(`http://localhost:3001/api/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filter === 'ALL' ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Appointments & Queue</h1>
        <p className="text-sm text-[var(--text-secondary)]">Manage patient appointments and facility queues</p>
      </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setFilter('ALL')} className={`badge ${filter === 'ALL' ? 'badge-info' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>All</button>
                  <button onClick={() => setFilter('BOOKED')} className={`badge ${filter === 'BOOKED' ? 'badge-info' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>Booked</button>
                  <button onClick={() => setFilter('CHECKED_IN')} className={`badge ${filter === 'CHECKED_IN' ? 'badge-warning' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>Checked In</button>
                  <button onClick={() => setFilter('IN_PROGRESS')} className={`badge ${filter === 'IN_PROGRESS' ? 'badge-success' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'}`}>In Progress</button>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-[var(--text-secondary)]">No appointments found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Patient</th>
                          <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Doctor</th>
                          <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Date/Time</th>
                          <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Priority</th>
                          <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Status</th>
                          <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((apt) => {
                          const statusConfig = STATUS_CONFIG[apt.status] || STATUS_CONFIG.BOOKED;
                          const priorityConfig = PRIORITY_CONFIG[apt.priority] || PRIORITY_CONFIG.GREEN;
                          return (
                            <tr key={apt.id} className="border-b border-[var(--border)] hover:bg-[var(--card-bg)]">
                              <td className="py-3 px-4 text-[var(--text-primary)]">{apt.patientName}</td>
                              <td className="py-3 px-4 text-[var(--text-primary)]">{apt.doctorName || 'Unassigned'}</td>
                              <td className="py-3 px-4 text-[var(--text-primary)]">{new Date(apt.dateTime).toLocaleString()}</td>
                              <td className="py-3 px-4"><span className={`badge ${priorityConfig.bg}`}>{priorityConfig.label}</span></td>
                              <td className="py-3 px-4"><span className={`badge ${statusConfig.bg}`}>{statusConfig.label}</span></td>
                              <td className="py-3 px-4">
                                {apt.status === 'BOOKED' && (
                                  <button onClick={() => handleStatusUpdate(apt.id, 'CHECKED_IN')} className="text-[var(--primary)] hover:underline mr-2">Check In</button>
                                )}
                                {apt.status === 'CHECKED_IN' && (
                                  <button onClick={() => handleStatusUpdate(apt.id, 'IN_PROGRESS')} className="text-[var(--success)] hover:underline mr-2">Start</button>
                                )}
                                {apt.status === 'IN_PROGRESS' && (
                                  <button onClick={() => handleStatusUpdate(apt.id, 'COMPLETED')} className="text-[var(--success)] hover:underline mr-2">Complete</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Live Queue</h3>
                {queue.length === 0 ? (
                  <p className="text-[var(--text-secondary)]">No patients in queue.</p>
                ) : (
                  <div className="space-y-3">
                    {queue.map((entry) => {
                      const priorityConfig = PRIORITY_CONFIG[entry.priority] || PRIORITY_CONFIG.GREEN;
                      return (
                        <div key={entry.appointmentId} className="p-3 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-[var(--text-primary)]">{entry.patientName}</span>
                            <span className={`badge ${priorityConfig.bg}`}>{priorityConfig.label}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                            <span>Position: #{entry.position}</span>
                            <span>~{entry.estimatedWaitMinutes} min wait</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                 )}
               </div>
             </div>
    </div>
  );
}
