'use client';

import React, { useEffect, useState } from 'react';

interface TeleconsultSession {
  id: string;
  patientName: string;
  fromFacilityId: string;
  doctorName: string;
  scheduledTime: string;
  status: string;
  meetingLink: string;
}

interface Doctor {
  id: string;
  name: string;
  facilityId: string;
  specialty: string;
  languages: string[];
}

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  REQUESTED: { bg: 'bg-yellow-100 text-yellow-700', label: 'Requested' },
  ACCEPTED: { bg: 'bg-blue-100 text-blue-700', label: 'Accepted' },
  DECLINED: { bg: 'bg-red-100 text-red-700', label: 'Declined' },
  IN_PROGRESS: { bg: 'bg-green-100 text-green-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-gray-100 text-gray-700', label: 'Completed' },
  CANCELLED: { bg: 'bg-gray-100 text-gray-700', label: 'Cancelled' },
};

export default function TeleconsultPage() {
  const [sessions, setSessions] = useState<TeleconsultSession[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [patientName, setPatientName] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, doctorsRes] = await Promise.all([
        fetch('http://localhost:3001/api/teleconsult/sessions'),
        fetch('http://localhost:3001/api/teleconsult/doctors'),
      ]);
      const sessionsData = await sessionsRes.json();
      const doctorsData = await doctorsRes.json();
      setSessions(sessionsData.data || []);
      setDoctors(doctorsData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!selectedDoctor || !patientName || !scheduledTime) return;
    try {
      await fetch('http://localhost:3001/api/teleconsult/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          fromFacilityId: 'facility-2',
          doctorId: selectedDoctor,
          scheduledTime: new Date(scheduledTime).toISOString(),
        }),
      });
      setShowCreate(false);
      setSelectedDoctor('');
      setPatientName('');
      setScheduledTime('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await fetch(`http://localhost:3001/api/teleconsult/sessions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Teleconsultation</h1>
          <p className="text-sm text-[var(--text-secondary)]">Connect patients with specialists remotely</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary self-start sm:self-auto">
          + New Session
        </button>
      </div>

            {showCreate && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Create Teleconsultation Session</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg"
                      placeholder="Enter patient name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Doctor</label>
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Scheduled Time</label>
                    <input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleCreate} className="btn btn-primary">Create Session</button>
                  <button onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-[var(--text-secondary)]">No teleconsultation sessions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Patient</th>
                        <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Doctor</th>
                        <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Scheduled</th>
                        <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => {
                        const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.REQUESTED;
                        return (
                          <tr key={session.id} className="border-b border-[var(--border)] hover:bg-[var(--card-bg)]">
                            <td className="py-3 px-4 text-[var(--text-primary)]">{session.patientName}</td>
                            <td className="py-3 px-4 text-[var(--text-primary)]">{session.doctorName}</td>
                            <td className="py-3 px-4 text-[var(--text-primary)]">
                              {new Date(session.scheduledTime).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`badge ${statusConfig.bg}`}>{statusConfig.label}</span>
                            </td>
                            <td className="py-3 px-4">
                              {session.status === 'ACCEPTED' && (
                                <button
                                  onClick={() => handleStatusUpdate(session.id, 'IN_PROGRESS')}
                                  className="text-[var(--primary)] hover:underline mr-2"
                                >
                                  Start
                                </button>
                              )}
                              {session.status === 'IN_PROGRESS' && (
                                <button
                                  onClick={() => handleStatusUpdate(session.id, 'COMPLETED')}
                                  className="text-[var(--success)] hover:underline mr-2"
                                >
                                  Complete
                                </button>
                              )}
                              {session.status === 'REQUESTED' && (
                                <>
                                  <button
                                    onClick={() => handleStatusUpdate(session.id, 'ACCEPTED')}
                                    className="text-[var(--success)] hover:underline mr-2"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleStatusUpdate(session.id, 'DECLINED')}
                                    className="text-[var(--danger)] hover:underline"
                                  >
                                    Decline
                                  </button>
                                </>
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
    </div>
  );
}
