import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePVT } from '../../contexts/PVTContext';

export default function PVTGateway() {
  const navigate = useNavigate();
  const { login, lookupSap, loginMod, loginDriver } = usePVT();

  const [step, setStep]         = useState('sap');   // 'sap' | 'password'
  const [sapNumber, setSapNumber] = useState('');
  const [password, setPassword] = useState('');
  const [sapInfo, setSapInfo]   = useState(null);    // { type, companyName, requiresPassword }
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSapSubmit(e) {
    e.preventDefault();
    if (!sapNumber.trim()) return;
    setError(''); setLoading(true);
    try {
      const { data } = await lookupSap(sapNumber.trim());
      setSapInfo(data);

      if (data.type === 'driver') {
        // Authenticate immediately
        const res = await loginDriver(sapNumber.trim());
        login({
          role: 'pvt_driver',
          driverName: res.data.driverName,
          companyName: res.data.companyName,
          driverId: res.data.driverId
        }, res.data.token);
        navigate('/pvt/test');
      } else {
        setStep('password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'SAP number not recognised.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setError(''); setLoading(true);
    try {
      const { data } = await loginMod(sapNumber.trim(), password);
      login({
        role: data.role,
        name: data.name,
        companyId: data.companyId,
        companyName: data.companyName
      }, data.token);

      if (data.role === 'pvt_super_admin') navigate('/pvt/super-admin');
      else navigate('/pvt/moderator');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FleetGuard Enterprise</h1>
          <p className="text-emerald-400 text-sm font-medium mt-1 tracking-widest uppercase">
            PVT Portal v3.0
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Cognitive Fitness & Reaction Assessment System
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">

          {step === 'sap' && (
            <form onSubmit={handleSapSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  SAP Control Pass
                </label>
                <input
                  value={sapNumber}
                  onChange={e => setSapNumber(e.target.value.toUpperCase())}
                  placeholder="Enter SAP Number"
                  className="w-full bg-gray-800 border border-gray-700 text-white text-center text-lg font-mono tracking-widest rounded-xl px-4 py-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-gray-600 transition-colors"
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sapNumber.trim()}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                    Verify Access
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'password' && sapInfo && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              {/* Identity badge */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                  {sapInfo.type === 'super_admin' ? 'Super Administrator' : 'Company Moderator'}
                </p>
                <p className="text-white font-semibold">
                  {sapInfo.type === 'super_admin' ? 'SAP-SUPER' : sapNumber}
                </p>
                {sapInfo.companyName && (
                  <p className="text-emerald-400 text-sm mt-1">{sapInfo.companyName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Security Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-gray-600 transition-colors"
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('sap'); setError(''); setPassword(''); }}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex-2 flex-grow py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                >
                  {loading ? 'Verifying…' : 'Authenticate'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs mt-6">
          FleetGuard Enterprise • Secure Multi-Tier PVT Portal • Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
