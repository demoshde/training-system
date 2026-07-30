import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePVT } from '../../contexts/PVTContext';
import { pvtApi } from '../../api/pvt';

const INPUT = 'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors';

export default function PVTSuperAdmin() {
  const navigate = useNavigate();
  const { pvtUser, logout } = usePVT();

  const [tab, setTab]               = useState('companies');
  const [companies, setCompanies]   = useState([]);
  const [globalStats, setGStats]    = useState(null);
  const [allTests, setAllTests]     = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);
  const [loading, setLoading]       = useState(false);

  // Moderator SAP assignment
  const [editCompanyId, setEditCompanyId] = useState(null);
  const [sapInput, setSapInput]           = useState('');
  const [sapError, setSapError]           = useState('');
  const [sapSuccess, setSapSuccess]       = useState('');

  useEffect(() => {
    if (!pvtUser || pvtUser.role !== 'pvt_super_admin') navigate('/pvt');
  }, [pvtUser, navigate]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, t, d] = await Promise.all([
        pvtApi.get('/companies'),
        pvtApi.get('/global-stats'),
        pvtApi.get('/tests'),
        pvtApi.get('/drivers')
      ]);
      setCompanies(c.data);
      setGStats(s.data);
      setAllTests(t.data);
      setAllDrivers(d.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function assignModerator(companyId) {
    setSapError(''); setSapSuccess('');
    if (!sapInput.trim()) { setSapError('Enter a SAP code.'); return; }
    try {
      await pvtApi.put(`/companies/${companyId}/moderator`, { pvtSapCode: sapInput.trim() });
      setSapSuccess(`SAP code "${sapInput.trim().toUpperCase()}" assigned successfully.`);
      setSapInput('');
      await fetchAll();
      setTimeout(() => { setEditCompanyId(null); setSapSuccess(''); }, 2000);
    } catch(e) {
      setSapError(e.response?.data?.message || 'Failed to assign SAP code.');
    }
  }

  function exportCSV() { window.open('/api/pvt/export', '_blank'); }

  const STATUS_BADGE = {
    LOW_RISK:      'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
    MODERATE_RISK: 'bg-amber-600/20  text-amber-300  border-amber-500/30',
    HIGH_RISK:     'bg-red-600/20    text-red-300    border-red-500/30',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Super Admin Control Suite</h1>
              <p className="text-purple-400 text-xs font-medium">FleetGuard PVT — Global Access</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{pvtUser?.name}</span>
            <button onClick={() => { logout(); navigate('/pvt'); }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Global stats bar */}
      {globalStats && (
        <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-6">
            {[
              { label:'Companies',      value: globalStats.companies },
              { label:'Active Drivers', value: globalStats.drivers },
              { label:'Total Tests',    value: globalStats.totalTests },
              { label:'Tests Today',    value: globalStats.todayTests,  color:'text-blue-400' },
              { label:'HIGH RISK Today',value: globalStats.highRisk,
                color: globalStats.highRisk > 0 ? 'text-red-400' : 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`text-2xl font-black ${s.color||'text-white'}`}>{s.value}</span>
                <span className="text-gray-500 text-xs uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-gray-900 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[['companies','Transport Companies'],['drivers','All Drivers'],['tests','Global Test Records']].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab===key?'border-purple-500 text-purple-400':'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* ── COMPANIES ── */}
        {tab === 'companies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Transport Companies & Moderators</h2>
              <p className="text-gray-500 text-sm">{companies.length} companies registered</p>
            </div>
            <p className="text-gray-500 text-sm">
              Assign PVT SAP codes to company moderators. Moderators must already exist as Company Admins.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companies.map(c => (
                <div key={c._id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{c.name}</h3>
                      {c.description && <p className="text-gray-500 text-xs mt-0.5">{c.description}</p>}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full
                      ${c.moderator?.pvtSapCode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {c.moderator?.pvtSapCode ? 'SAP Assigned' : 'No SAP'}
                    </span>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Moderator</p>
                    {c.moderator ? (
                      <div className="flex items-center justify-between">
                        <p className="text-white text-sm font-medium">{c.moderator.name}</p>
                        <p className="font-mono text-emerald-400 text-sm">
                          {c.moderator.pvtSapCode || <span className="text-gray-600">Not set</span>}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm">No company admin configured</p>
                    )}
                  </div>

                  {c.moderator && (
                    <>
                      {editCompanyId === c._id ? (
                        <div className="space-y-2">
                          <input
                            className={INPUT} value={sapInput}
                            onChange={e => setSapInput(e.target.value.toUpperCase())}
                            placeholder="Enter new PVT SAP code (e.g. MOD-TC01)"
                            autoFocus
                          />
                          {sapError   && <p className="text-red-400 text-xs">{sapError}</p>}
                          {sapSuccess && <p className="text-emerald-400 text-xs">{sapSuccess}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => { setEditCompanyId(null); setSapError(''); setSapSuccess(''); setSapInput(''); }}
                              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => assignModerator(c._id)}
                              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors">
                              Assign
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setEditCompanyId(c._id); setSapInput(c.moderator.pvtSapCode||''); setSapError(''); setSapSuccess(''); }}
                          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
                          {c.moderator.pvtSapCode ? 'Update Moderator SAP Code' : 'Assign Moderator SAP Code'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ALL DRIVERS ── */}
        {tab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">All Registered Drivers</h2>
              <p className="text-gray-500 text-sm">{allDrivers.length} drivers across all companies</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['SAP','Full Name','Company','Shift','Track','Status'].map(h=>(
                      <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {allDrivers.map(d => (
                    <tr key={d._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-3 font-mono text-emerald-400 text-xs">{d.sapNumber}</td>
                      <td className="px-5 py-3 text-white">{d.fullName}</td>
                      <td className="px-5 py-3 text-gray-400">{d.company?.name}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{d.shiftType}</td>
                      <td className="px-5 py-3 text-gray-300 text-xs">{d.logisticsTrack}{d.convoyConfig && ` (${d.convoyConfig})`}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full
                          ${d.isActive?'bg-emerald-500/10 text-emerald-400':'bg-gray-700 text-gray-500'}`}>
                          {d.isActive?'Active':'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {allDrivers.length===0 && (
                    <tr><td colSpan={6} className="px-5 py-6 text-gray-600 text-center">No drivers registered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── GLOBAL TEST RECORDS ── */}
        {tab === 'tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Global Test Records</h2>
              <button onClick={exportCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
                Export All CSV
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Date','Driver','Company','S1','S2','Mean RT','Lapses','Status'].map(h=>(
                      <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {allTests.map(t => (
                    <tr key={t._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(t.testedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <p className="text-white">{t.driver?.fullName}</p>
                        <p className="text-gray-500 text-xs font-mono">{t.driver?.sapNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.company?.name}</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage1?.passed?'text-emerald-400':'text-red-400'}`}>
                        {t.stage1?.passed?'P':'F'}
                      </td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage2?.passed?'text-emerald-400':'text-red-400'}`}>
                        {t.stage2?.passed?'P':'F'}
                      </td>
                      <td className="px-4 py-3 font-mono text-white text-xs">{t.stage3?.meanRT?.toFixed(0)}ms</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.lapses>=3?'text-red-400':t.stage3?.lapses>0?'text-amber-400':'text-gray-500'}`}>
                        {t.stage3?.lapses}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>
                          {t.overallStatus?.replace('_',' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {allTests.length===0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-gray-600 text-center">No tests recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
