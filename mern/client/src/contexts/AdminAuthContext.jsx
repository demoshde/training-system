import { createContext, useContext, useState, useEffect } from 'react';
import { adminApi } from '../api';

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('adminToken');
      const savedAdmin = localStorage.getItem('admin');
      
      if (token && savedAdmin) {
        try {
          // Validate token by making a simple API call
          const res = await adminApi.get('/auth/me');
          // Update admin data with fresh data from server
          setAdmin(res.data);
          localStorage.setItem('admin', JSON.stringify(res.data));
        } catch (error) {
          // Token is invalid or expired - clear storage
          localStorage.removeItem('adminToken');
          localStorage.removeItem('admin');
          setAdmin(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await adminApi.post('/auth/login', { username, password });
      const { token, admin: adminData } = res.data;
      
      localStorage.setItem('adminToken', token);
      localStorage.setItem('admin', JSON.stringify(adminData));
      setAdmin(adminData);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Нэвтрэхэд алдаа гарлаа' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export default AdminAuthContext;
