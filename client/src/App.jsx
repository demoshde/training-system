import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { PVTProvider, usePVT } from './contexts/PVTContext';
import WorkerProtectedRoute from './components/WorkerProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';

// PVT pages
import PVTGateway from './pages/pvt/PVTGateway';
import PVTTestArena from './pages/pvt/PVTTestArena';
import PVTModeratorDashboard from './pages/pvt/PVTModeratorDashboard';
import PVTSuperAdmin from './pages/pvt/PVTSuperAdmin';

// Worker pages
import WorkerLogin from './pages/worker/Login';
import WorkerDashboard from './pages/worker/Dashboard';
import Training from './pages/worker/Training';
import Certificate from './pages/worker/Certificate';

// Supervisor page (standalone)
import SupervisorCheck from './pages/SupervisorCheck';

// Admin pages
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import Companies from './pages/admin/Companies';
import Workers from './pages/admin/Workers';
import Trainings from './pages/admin/Trainings';
import TrainingWizard from './pages/admin/TrainingWizard';
import Enrollments from './pages/admin/Enrollments';
import Admins from './pages/admin/Admins';
import WorkerCheck from './pages/admin/WorkerCheck';
import BulkProgress from './pages/admin/BulkProgress';
import News from './pages/admin/News';
import Polls from './pages/admin/Polls';
import Regulations from './pages/admin/Regulations';

// PVT protected route helper
function PVTRoute({ roles, element }) {
  const { pvtUser } = usePVT();
  if (!pvtUser || !roles.includes(pvtUser.role)) return <Navigate to="/pvt" replace />;
  return element;
}

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        {/* PVT portal routes are self-contained under /pvt */}
        <Routes>
          {/* ── PVT Portal ── */}
          <Route path="/pvt" element={<PVTProvider><PVTGateway /></PVTProvider>} />
          <Route path="/pvt/test" element={<PVTProvider><PVTRoute roles={['pvt_driver']} element={<PVTTestArena />} /></PVTProvider>} />
          <Route path="/pvt/moderator" element={<PVTProvider><PVTRoute roles={['pvt_moderator','pvt_super_admin']} element={<PVTModeratorDashboard />} /></PVTProvider>} />
          <Route path="/pvt/super-admin" element={<PVTProvider><PVTRoute roles={['pvt_super_admin']} element={<PVTSuperAdmin />} /></PVTProvider>} />

          {/* Supervisor route (standalone, PIN protected) */}
          <Route path="/supervisor" element={<SupervisorCheck />} />
          
          {/* Worker routes */}
          <Route path="/login" element={<WorkerLogin />} />
          <Route path="/" element={
            <WorkerProtectedRoute>
              <WorkerDashboard />
            </WorkerProtectedRoute>
          } />
          <Route path="/training/:trainingId" element={
            <WorkerProtectedRoute>
              <Training />
            </WorkerProtectedRoute>
          } />
          <Route path="/certificate/:trainingId" element={
            <WorkerProtectedRoute>
              <Certificate />
            </WorkerProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/companies" element={
            <AdminProtectedRoute>
              <Companies />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/workers" element={
            <AdminProtectedRoute>
              <Workers />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/trainings" element={
            <AdminProtectedRoute>
              <Trainings />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/trainings/new" element={
            <AdminProtectedRoute>
              <TrainingWizard />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/trainings/:id/edit" element={
            <AdminProtectedRoute>
              <TrainingWizard />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/enrollments" element={
            <AdminProtectedRoute>
              <Enrollments />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/admins" element={
            <AdminProtectedRoute>
              <Admins />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/check" element={
            <AdminProtectedRoute>
              <WorkerCheck />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/bulk-progress" element={
            <AdminProtectedRoute>
              <BulkProgress />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/news" element={
            <AdminProtectedRoute>
              <News />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/polls" element={
            <AdminProtectedRoute>
              <Polls />
            </AdminProtectedRoute>
          } />
          <Route path="/admin/regulations" element={
            <AdminProtectedRoute>
              <Regulations />
            </AdminProtectedRoute>
          } />
        </Routes>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
