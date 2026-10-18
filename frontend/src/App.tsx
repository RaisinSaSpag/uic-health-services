import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { ChatPage } from './pages/ChatPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
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
import { PatientPortalPage } from './pages/PatientPortalPage';
import { RoleLandingPage } from './pages/RoleLandingPage';
import { NurseInventoryHistoryPage } from './pages/NurseInventoryHistoryPage';
import { NurseInventoryAboutPage } from './pages/NurseInventoryAboutPage';
import { NurseInventoryReportsPage } from './pages/NurseInventoryReportsPage';



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
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseQueuePage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/records/:patientType"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseRecordsPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/print-prescription"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NursePrintPrescriptionPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/reports"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseReportsPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/about"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseAboutPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/patients/:patientId"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NursePatientDetailPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/patients/:patientId/new-consultation"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseConsultationTypePage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/patients/:patientId/new-consultation/:consultationType"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseConsultationFormPage />
              </RoleRoute>
            }
          />

          {/* ============ Inventory Module ============ */}
          <Route
            path="nurse/inventory"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseInventoryDashboardPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/inventory/stocks"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseInventoryStocksPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/inventory/requests"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseInventoryRequestsPage />
              </RoleRoute>
            }
          />
          <Route
            path="nurse/inventory/history"
           element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseInventoryHistoryPage />
            </RoleRoute>
            }
          />
          <Route
            path="nurse/inventory/about"
             element={
             <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
               <NurseInventoryAboutPage />
             </RoleRoute>
             }
           />

          <Route
            path="nurse/inventory/reports"
              element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseInventoryReportsPage />
              </RoleRoute>
             }
           />

          {/* ============ Doctor Module ============ */}
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

                    {/* ============ Doctor Inventory (read-only) ============ */}
          <Route
            path="doctor/inventory"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NurseInventoryDashboardPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/inventory/stocks"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NurseInventoryStocksPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/inventory/requests"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NurseInventoryRequestsPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/inventory/history"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NurseInventoryHistoryPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/inventory/reports"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NurseInventoryReportsPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/inventory/about"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NurseInventoryAboutPage />
              </RoleRoute>
            }
          />


          <Route
            path="nurse/referrals"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NurseReferralsPage />
              </RoleRoute>
            }
          />

          <Route
            path="nurse/referrals/:referralId"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
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
                    <Route
            path="nurse/chat"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <ChatPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/chat"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <ChatPage />
              </RoleRoute>
            }
          />

                    <Route
            path="nurse/notifications"
            element={
              <RoleRoute roles={['nurse', 'coordinator', 'admin']}>
                <NotificationPage />
              </RoleRoute>
            }
          />

          <Route
            path="doctor/notifications"
            element={
              <RoleRoute roles={['doctor', 'admin']}>
                <NotificationPage />
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