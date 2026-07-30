import { createContext, useContext, useState, useCallback } from 'react';
import { pvtApi } from '../api/pvt';

const PVTContext = createContext(null);

export function PVTProvider({ children }) {
  const [pvtUser, setPvtUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pvtUser')); } catch { return null; }
  });

  const login = useCallback((userData, token) => {
    localStorage.setItem('pvtToken', token);
    localStorage.setItem('pvtUser', JSON.stringify(userData));
    setPvtUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pvtToken');
    localStorage.removeItem('pvtUser');
    setPvtUser(null);
  }, []);

  const lookupSap = (sapNumber) => pvtApi.post('/auth/lookup', { sapNumber });
  const loginMod  = (sapNumber, password) => pvtApi.post('/auth/login', { sapNumber, password });
  const loginDriver = (sapNumber) => pvtApi.post('/auth/driver', { sapNumber });

  return (
    <PVTContext.Provider value={{ pvtUser, login, logout, lookupSap, loginMod, loginDriver }}>
      {children}
    </PVTContext.Provider>
  );
}

export function usePVT() {
  const ctx = useContext(PVTContext);
  if (!ctx) throw new Error('usePVT must be used inside PVTProvider');
  return ctx;
}
