import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, workerApi } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('workerToken');
      const savedWorker = localStorage.getItem('worker');
      
      if (token && savedWorker) {
        try {
          // Validate token by making a simple API call
          const res = await workerApi.get('/me');
          // Update worker data with fresh data from server
          setWorker(res.data);
          localStorage.setItem('worker', JSON.stringify(res.data));
        } catch (error) {
          // Token is invalid or expired - clear storage
          localStorage.removeItem('workerToken');
          localStorage.removeItem('worker');
          setWorker(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  const login = async (sapId) => {
    try {
      const res = await authApi.post('/login', { sapId });
      const { token, worker: workerData } = res.data;
      
      localStorage.setItem('workerToken', token);
      localStorage.setItem('worker', JSON.stringify(workerData));
      setWorker(workerData);
      
      // Return worker data so caller knows login succeeded
      return { success: true, worker: workerData };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Нэвтрэхэд алдаа гарлаа' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('workerToken');
    localStorage.removeItem('worker');
    setWorker(null);
  };

  return (
    <AuthContext.Provider value={{ worker, loading, login, logout, isAuthenticated: !!worker }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
