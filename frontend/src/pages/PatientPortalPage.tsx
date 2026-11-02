import { useCallback, useEffect, useState } from 'react';
import { Edit3, X } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
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

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

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

  const openEditModal = () => {
    if (!patient) return;
    setFormData({
      contact_number: patient.contact_number || '',
      address: patient.address || '',
      emergency_contact_name: patient.emergency_contact_name || '',
      emergency_contact_number: patient.emergency_contact_number || '',
      emergency_contact_relationship: patient.emergency_contact_relationship || '',
      allergies: patient.allergies || '',
      existing_medical_condition: patient.existing_medical_condition || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch('/patients/me', formData);
      void notifySuccess('Profile updated successfully.', 'Success');
      setIsEditModalOpen(false);
      void loadData(); // Reload to show new data
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to update profile.'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>My Profile</h3>
          <button className="button secondary" onClick={openEditModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 size={16} /> Edit Profile
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <p><strong>Email:</strong> {patient.user?.email}</p>
            <p><strong>Sex:</strong> {patient.sex || 'N/A'}</p>
            <p><strong>Age:</strong> {patient.age ?? 'N/A'}</p>
            <p><strong>Contact Number:</strong> {patient.contact_number || 'N/A'}</p>
            <p><strong>Address:</strong> {patient.address || 'N/A'}</p>
          </div>
          <div>
            <p><strong>Program:</strong> {patient.course_program ?? 'N/A'}</p>
            <p><strong>Year Level:</strong> {patient.year_level ?? 'N/A'}</p>
            <p><strong>Emergency Contact:</strong> {patient.emergency_contact_name ? `${patient.emergency_contact_name} (${patient.emergency_contact_relationship}) - ${patient.emergency_contact_number}` : 'N/A'}</p>
            <p><strong>Allergies:</strong> {patient.allergies || 'N/A'}</p>
            <p><strong>Medical Conditions:</strong> {patient.existing_medical_condition || 'N/A'}</p>
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

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setIsEditModalOpen(false)}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit My Profile</h2>
              <button className="button ghost" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="field">
                  <span>Contact Number</span>
                  <input type="text" name="contact_number" value={formData.contact_number} onChange={handleInputChange} placeholder="e.g. 09123456789" />
                </label>
                <label className="field">
                  <span>Address</span>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Your address" />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="field">
                  <span>Emergency Contact Name</span>
                  <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleInputChange} placeholder="Parent or Guardian" />
                </label>
                <label className="field">
                  <span>Emergency Contact Number</span>
                  <input type="text" name="emergency_contact_number" value={formData.emergency_contact_number} onChange={handleInputChange} placeholder="Contact number" />
                </label>
              </div>

              <label className="field">
                <span>Relationship to Emergency Contact</span>
                <input type="text" name="emergency_contact_relationship" value={formData.emergency_contact_relationship} onChange={handleInputChange} placeholder="e.g. Mother, Father, Sibling" />
              </label>

              <label className="field">
                <span>Allergies</span>
                <textarea name="allergies" value={formData.allergies} onChange={handleInputChange} placeholder="List any known allergies" rows={2} />
              </label>

              <label className="field">
                <span>Existing Medical Conditions</span>
                <textarea name="existing_medical_condition" value={formData.existing_medical_condition} onChange={handleInputChange} placeholder="List any existing conditions (e.g. Asthma)" rows={2} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="button ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}