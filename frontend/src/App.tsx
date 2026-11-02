import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { CoordinatorAuditPage } from './pages/CoordinatorAuditPage';
import { ChatPage } from './pages/ChatPage';
import { DoctorAboutPage } from './pages/DoctorAboutPage';
import { DoctorDashboardPage } from './pages/DoctorDashboardPage';
import { DoctorReferralsPage } from './pages/DoctorReferralsPage';
import { LoginPage } from './pages/LoginPage';
import { NotificationPage } from './pages/NotificationPage';
import { NurseAboutPage } from './pages/NurseAboutPage';
import { NurseConsultationFormPage } from './pages/NurseConsultationFormPage';
import { NurseConsultationTypePage } from './pages/NurseConsultationTypePage';
import { NurseInventoryDashboardPage } from './pages/NurseInventoryDashboardPage';
import { NurseInventoryRequestsPage } from './pages/NurseInventoryRequestsPage';
import { NurseInventoryStocksPage } from './pages/NurseInventoryStocksPage';
import { NursePatientDetailPage } from './pages/NursePatientDetailPage';
import { NursePrintPrescriptionPage } from './pages/NursePrintPrescriptionPage';
import { NurseQueuePage } from './pages/NurseQueuePage';
import { NurseRecordsPage } from './pages/NurseRecordsPage';
import { NurseReferralsPage } from './pages/NurseReferralsPage';
import { NurseReportsPage } from './pages/NurseReportsPage';
import { RoleLandingPage } from './pages/RoleLandingPage';
import { NurseInventoryHistoryPage } from './pages/NurseInventoryHistoryPage';
import { NurseInventoryAboutPage } from './pages/NurseInventoryAboutPage';
import { NurseInventoryReportsPage } from './pages/NurseInventoryReportsPage';
import { NurseWalkInRegistrationPage } from './pages/NurseWalkInRegistrationPage';
import { CoordinatorDashboardPage } from './pages/CoordinatorDashboardPage';
import { CoordinatorUsersPage } from './pages/CoordinatorUsersPage';
import { CoordinatorCampusReportPage } from './pages/CoordinatorCampusReportPage';
import { CoordinatorTermsPage } from './pages/CoordinatorTermsPage'; // <-- NEW IMPORT
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage';
import { PatientPortalPage } from './pages/PatientPortalPage';
import { useAuth } from './context/AuthContext';

// Guard component that must return an <Outlet /> to render child routes
function MustChangePasswordGuard() {
  const { user } = useAuth();

  if (user?.must_change_password) {
    return <ForcePasswordChangePage />;
  }

  return <AppShell />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>

        {/* Guard wraps the AppShell */}
        <Route element={<MustChangePasswordGuard />}>

          <Route index element={<RoleLandingPage />} />

          {/* ============ PATIENT PORTAL ============ */}
          <Route path="patient" element={
            <RoleRoute roles={['student', 'employee']}>
              <PatientPortalPage />
            </RoleRoute>
          } />

          {/* ============ NURSE MODULE ============ */}
          <Route path="nurse" element={<RoleRoute roles={['nurse']}><NurseQueuePage /></RoleRoute>} />
          <Route path="nurse/records/:patientType" element={<RoleRoute roles={['nurse']}><NurseRecordsPage /></RoleRoute>} />
          <Route path="nurse/print-prescription" element={<RoleRoute roles={['nurse']}><NursePrintPrescriptionPage /></RoleRoute>} />
          <Route path="nurse/reports" element={<RoleRoute roles={['nurse']}><NurseReportsPage /></RoleRoute>} />
          <Route path="nurse/about" element={<RoleRoute roles={['nurse']}><NurseAboutPage /></RoleRoute>} />
          <Route path="nurse/patients/:patientId" element={<RoleRoute roles={['nurse']}><NursePatientDetailPage /></RoleRoute>} />
          <Route path="nurse/patients/:patientId/new-consultation" element={<RoleRoute roles={['nurse']}><NurseConsultationTypePage /></RoleRoute>} />
          <Route path="nurse/patients/:patientId/new-consultation/:consultationType" element={<RoleRoute roles={['nurse']}><NurseConsultationFormPage /></RoleRoute>} />

          <Route path="nurse/walk-in" element={<RoleRoute roles={['nurse']}><NurseWalkInRegistrationPage /></RoleRoute>} />

          <Route path="nurse/inventory" element={<RoleRoute roles={['nurse']}><NurseInventoryDashboardPage /></RoleRoute>} />
          <Route path="nurse/inventory/stocks" element={<RoleRoute roles={['nurse']}><NurseInventoryStocksPage /></RoleRoute>} />
          <Route path="nurse/inventory/requests" element={<RoleRoute roles={['nurse']}><NurseInventoryRequestsPage /></RoleRoute>} />
          <Route path="nurse/inventory/history" element={<RoleRoute roles={['nurse']}><NurseInventoryHistoryPage /></RoleRoute>} />
          <Route path="nurse/inventory/about" element={<RoleRoute roles={['nurse']}><NurseInventoryAboutPage /></RoleRoute>} />
          <Route path="nurse/inventory/reports" element={<RoleRoute roles={['nurse']}><NurseInventoryReportsPage /></RoleRoute>} />

          <Route path="nurse/referrals" element={<RoleRoute roles={['nurse']}><NurseReferralsPage /></RoleRoute>} />
          <Route path="nurse/referrals/:referralId" element={<RoleRoute roles={['nurse']}><NurseReferralsPage /></RoleRoute>} />
          <Route path="nurse/chat" element={<RoleRoute roles={['nurse']}><ChatPage /></RoleRoute>} />
          <Route path="nurse/notifications" element={<RoleRoute roles={['nurse']}><NotificationPage /></RoleRoute>} />

          {/* ============ DOCTOR MODULE ============ */}
          <Route path="doctor" element={<RoleRoute roles={['doctor']}><DoctorDashboardPage /></RoleRoute>} />
          <Route path="doctor/referrals" element={<RoleRoute roles={['doctor']}><DoctorReferralsPage /></RoleRoute>} />
          <Route path="doctor/referrals/:referralId" element={<RoleRoute roles={['doctor']}><DoctorReferralsPage /></RoleRoute>} />
          <Route path="doctor/about" element={<RoleRoute roles={['doctor']}><DoctorAboutPage /></RoleRoute>} />
          <Route path="doctor/chat" element={<RoleRoute roles={['doctor']}><ChatPage /></RoleRoute>} />
          <Route path="doctor/notifications" element={<RoleRoute roles={['doctor']}><NotificationPage /></RoleRoute>} />

          {/* ============ COORDINATOR MODULE ============ */}
          <Route path="coordinator" element={<RoleRoute roles={['coordinator']}><CoordinatorDashboardPage /></RoleRoute>} />
          <Route path="coordinator/users" element={<RoleRoute roles={['coordinator']}><CoordinatorUsersPage /></RoleRoute>} />
          <Route path="coordinator/campus/:campusCode" element={<RoleRoute roles={['coordinator']}><CoordinatorCampusReportPage /></RoleRoute>} />
          <Route path="coordinator/terms" element={<RoleRoute roles={['coordinator']}><CoordinatorTermsPage /></RoleRoute>} /> {/* <-- NEW ROUTE */}
          <Route path="coordinator/audit-logs" element={<RoleRoute roles={['coordinator']}><CoordinatorAuditPage /></RoleRoute>} />
          <Route path="coordinator/chat" element={<RoleRoute roles={['coordinator']}><ChatPage /></RoleRoute>} />
          <Route path="coordinator/notifications" element={<RoleRoute roles={['coordinator']}><NotificationPage /></RoleRoute>} />

        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;