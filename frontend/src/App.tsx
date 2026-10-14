import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DoctorAboutPage } from './pages/DoctorAboutPage';
import { DoctorDashboardPage } from './pages/DoctorDashboardPage';
import { DoctorReferralsPage } from './pages/DoctorReferralsPage';
import { LoginPage } from './pages/LoginPage';
import { NurseAboutPage } from './pages/NurseAboutPage';
import { NurseConsultationFormPage } from './pages/NurseConsultationFormPage';
import { NurseConsultationTypePage } from './pages/NurseConsultationTypePage';
import { NursePatientDetailPage } from './pages/NursePatientDetailPage';
import { NursePrintPrescriptionPage } from './pages/NursePrintPrescriptionPage';
import { NurseQueuePage } from './pages/NurseQueuePage';
import { NurseReferralsPage } from './pages/NurseReferralsPage';
import { NurseInventoryDashboardPage } from './pages/NurseInventoryDashboardPage';
import { NurseRecordsPage } from './pages/NurseRecordsPage';
import { NurseReportsPage } from './pages/NurseReportsPage';
import { PatientPortalPage } from './pages/PatientPortalPage';
import { RoleLandingPage } from './pages/RoleLandingPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<RoleLandingPage />} />

          <Route
            path="patient"
            element={
              <RoleRoute roles={['student', 'employee']}>
                <PatientPortalPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseQueuePage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/records/:patientType"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseRecordsPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/print-prescription"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NursePrintPrescriptionPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/reports"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseReportsPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/about"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseAboutPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/patients/:patientId"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NursePatientDetailPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/patients/:patientId/new-consultation"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseConsultationTypePage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/patients/:patientId/new-consultation/:consultationType"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseConsultationFormPage />
              </RoleRoute>
            }
          />
  <Route
  path="nurse/inventory"
  element={
    <RoleRoute roles={['nurse', 'admin']}>
      <NurseInventoryDashboardPage />
    </RoleRoute>
  }
/>

          <Route
            path="doctor"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <DoctorDashboardPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/referrals"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <DoctorReferralsPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/referrals/:referralId"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <DoctorReferralsPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/about"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <DoctorAboutPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/referrals"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseReferralsPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/referrals/:referralId"
            element={
              <RoleRoute roles={['nurse', 'admin']}>
                <NurseReferralsPage />
              </RoleRoute>
            }
          />

          <Route
            path="admin"
            element={
              <RoleRoute roles={['admin']}>
                <AdminAuditPage />
              </RoleRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
