import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const WorkerProtectedRoute = ({ children }) => {
  const { worker, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!worker) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default WorkerProtectedRoute;
