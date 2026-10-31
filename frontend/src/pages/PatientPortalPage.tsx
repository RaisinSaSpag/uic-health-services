import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { Patient, Consultation } from '../types/hsms';

export function PatientPortalPage() {
  const { signOut } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch the patient's own profile
      const patientRes = await api.get<Patient>('/patients/me');
      setPatient(patientRes.data);

      // 2. Fetch their consultation history
      const consultRes = await api.get<any>('/consultations', { params: { per_page: 50 } });
      const data = Array.isArray(consultRes.data) ? consultRes.data : consultRes.data.data;
      setConsultations(data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load patient portal.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) return <div className="page"><p>Loading your records...</p></div>;
  
  if (!patient) {
    return (
      <div className="page">
        <section className="panel">
          <h2>No Profile Found</h2>
          <p className="muted">Your profile has not been created by the clinic yet. Please visit the Nurse's station.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      {/* HEADER */}
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Welcome, {userDisplayName(patient.user)}</h2>
            <p className="muted">Patient No: {patient.patient_number} · Campus: {patient.campus?.name}</p>
          </div>
          <button className="button ghost" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </section>

      {/* PROFILE SUMMARY */}
      <section className="panel" style={{ marginTop: '1rem' }}>
        <h3>My Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <p><strong>Email:</strong> {patient.user?.email}</p>
            <p><strong>Sex:</strong> {patient.sex}</p>
            <p><strong>Age:</strong> {patient.age ?? 'N/A'}</p>
          </div>
          <div>
            <p><strong>Program:</strong> {patient.course_program ?? 'N/A'}</p>
            <p><strong>Year Level:</strong> {patient.year_level ?? 'N/A'}</p>
            <p><strong>Section:</strong> {patient.section ?? 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* CONSULTATION HISTORY */}
      <section className="panel" style={{ marginTop: '1rem' }}>
        <h3>My Consultation History</h3>
        {consultations.length === 0 ? (
          <p className="empty-state">You have no past consultations.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Complaint</th>
                  <th>Diagnosis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateTime(c.submitted_at)}</td>
                    <td>{c.chief_complaint}</td>
                    <td>{c.diagnosis ?? 'N/A'}</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}