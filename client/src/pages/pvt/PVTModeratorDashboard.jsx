import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { usePVT } from '../../contexts/PVTContext';
import { pvtApi } from '../../api/pvt';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_BADGE = {
  LOW_RISK:      'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
  MODERATE_RISK: 'bg-amber-600/20  text-amber-300  border-amber-500/30',
  HIGH_RISK:     'bg-red-600/20    text-red-300    border-red-500/30',
};
const STATUS_LABEL = {
  LOW_RISK:'FIT FOR DUTY', MODERATE_RISK:'MONITOR', HIGH_RISK:'NOT FIT'
};

const INPUT = 'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors';
const BTN_SM = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors';

const EMPTY_FORM = {
  sapNumber:'', fullName:'', age:'', shiftType:'Day',
  logisticsTrack:'Short Haul Driver', convoyConfig:'',
  accommodationUnit:'', roomCapacity:'Single'
};

export default function PVTModeratorDashboard() {
  const navigate = useNavigate();
  const { pvtUser, logout } = usePVT();

  const [tab, setTab]       = useState('overview');
  const [alerts, setAlerts] = useState([]);
  const [stats,  setStats]  = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [tests,   setTests]   = useState([]);
  const [loading, setLoading] = useState(false);

  // Driver form
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [formErr,  setFormErr]  = useState('');

  // Track filter
  const [trackFilter, setTrackFilter] = useState('all');

  const pollRef = useRef(null);

  // Guard
  useEffect(() => {
    if (!pvtUser || !['pvt_moderator','pvt_super_admin'].includes(pvtUser.role)) navigate('/pvt');
  }, [pvtUser, navigate]);

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await pvtApi.get('/alerts?unread=true');
      setAlerts(data);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try { const { data } = await pvtApi.get('/dashboard'); setStats(data); } catch {}
  }, []);

  const fetchDrivers = useCallback(async () => {
    try { const { data } = await pvtApi.get('/drivers'); setDrivers(data); } catch {}
  }, []);

  const fetchTests = useCallback(async () => {
    try { const { data } = await pvtApi.get('/tests'); setTests(data); } catch {}
  }, []);

  useEffect(() => {
    fetchStats(); fetchAlerts(); fetchDrivers(); fetchTests();
    // Poll for alerts every 5 seconds
    pollRef.current = setInterval(fetchAlerts, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchStats, fetchAlerts, fetchDrivers, fetchTests]);

  // ── Driver CRUD ──────────────────────────────────────────────────────────
  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setFormErr(''); setShowForm(true); }
  function openEdit(d) {
    setForm({
      sapNumber: d.sapNumber, fullName: d.fullName, age: d.age,
      shiftType: d.shiftType, logisticsTrack: d.logisticsTrack,
      convoyConfig: d.convoyConfig || '', accommodationUnit: d.accommodationUnit || '',
      roomCapacity: d.roomCapacity
    });
    setEditId(d._id); setFormErr(''); setShowForm(true);
  }
  async function saveDriver() {
    if (!form.sapNumber||!form.fullName||!form.age) { setFormErr('SAP, Name and Age are required.'); return; }
    setLoading(true); setFormErr('');
    try {
      if (editId) await pvtApi.put(`/drivers/${editId}`, form);
      else        await pvtApi.post('/drivers', form);
      await fetchDrivers();
      setShowForm(false);
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed.'); }
    finally { setLoading(false); }
  }
  async function deleteDriver(id) {
    if (!window.confirm('Remove this driver?')) return;
    try { await pvtApi.delete(`/drivers/${id}`); await fetchDrivers(); } catch {}
  }

  // ── Alerts ───────────────────────────────────────────────────────────────
  async function dismissAlert(id) {
    await pvtApi.put(`/alerts/${id}/read`);
    setAlerts(p => p.filter(a => a._id !== id));
  }
  async function dismissAllAlerts() {
    await pvtApi.put('/alerts/read-all');
    setAlerts([]);
  }

  // ── CSV Export ───────────────────────────────────────────────────────────
  function exportCSV() {
    window.open('/api/pvt/export', '_blank');
  }

  // ── Chart data ───────────────────────────────────────────────────────────
  const chartData = stats?.last14Days ? {
    labels: stats.last14Days.map(d => d._id.slice(5)),
    datasets: [
      {
        label: 'Avg RT (ms)',
        data: stats.last14Days.map(d => Math.round(d.avgRT || 0)),
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)',
        tension: 0.4, fill: true, pointBackgroundColor: '#10b981', pointRadius: 4
      },
      {
        label: 'HIGH RISK count',
        data: stats.last14Days.map(d => d.highRisk),
        borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)',
        tension: 0.4, fill: false, pointBackgroundColor: '#ef4444', pointRadius: 4,
        yAxisID: 'y2'
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color:'#9ca3af', font:{size:12} } },
               tooltip: { backgroundColor:'#111827', borderColor:'#374151', borderWidth:1, titleColor:'#fff', bodyColor:'#9ca3af' } },
    scales: {
      x: { ticks:{ color:'#6b7280' }, grid:{ color:'rgba(255,255,255,0.04)' } },
      y: { ticks:{ color:'#6b7280' }, grid:{ color:'rgba(255,255,255,0.04)' },
           title:{ display:true, text:'Avg RT (ms)', color:'#6b7280' } },
      y2:{ position:'right', ticks:{ color:'#6b7280' }, grid:{ display:false },
           title:{ display:true, text:'HIGH RISK', color:'#6b7280' } }
    }
  };

  const filteredTests = trackFilter === 'all'
    ? tests
    : tests.filter(t => t.driver?.logisticsTrack === trackFilter);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Alert banner ── */}
      {alerts.length > 0 && (
        <div className="sticky top-0 z-50 bg-red-600/95 border-b border-red-500 backdrop-blur px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              {alerts.map(a => (
                <div key={a._id} className="flex items-center gap-2">
                  <span className="animate-pulse text-base">🚨</span>
                  <p className="text-white text-sm font-semibold">
                    CRITICAL LOCKOUT ALERT: Driver {a.driverName} (SAP: {a.driverSap}) flagged NOT FIT FOR DUTY. Action Required.
                  </p>
                  <button onClick={() => dismissAlert(a._id)}
                    className="ml-auto text-red-200 hover:text-white text-xs flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
            {alerts.length > 1 && (
              <button onClick={dismissAllAlerts}
                className="text-red-100 hover:text-white text-xs font-medium whitespace-nowrap flex-shrink-0">
                Dismiss All
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Fleet Safety Dashboard</h1>
            <p className="text-emerald-400 text-xs font-medium mt-0.5">{pvtUser?.companyName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white text-sm">{pvtUser?.name}</p>
              <p className="text-gray-500 text-xs">Company Moderator</p>
            </div>
            <button onClick={() => { logout(); navigate('/pvt'); }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-800 bg-gray-900 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[['overview','Overview'],['drivers','Driver Registry'],['history','Test History'],['analytics','Analytics']].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab===key ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {lbl}
              {key==='overview' && alerts.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{alerts.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Active Drivers',    value: stats?.totalDrivers  ?? '—', color:'text-white' },
                { label:'Tests Today',       value: stats?.testsToday    ?? '—', color:'text-blue-400' },
                { label:'HIGH RISK Today',   value: stats?.highRiskToday ?? '—', color: (stats?.highRiskToday>0)?'text-red-400':'text-emerald-400' },
                { label:'Unread Alerts',     value: stats?.unreadAlerts  ?? '—', color: (stats?.unreadAlerts>0)?'text-red-400':'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">{s.label}</p>
                  <p className={`text-4xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Recent tests */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">Recent Test Activity</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {tests.slice(0,8).map(t => (
                  <div key={t._id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{t.driver?.fullName}</p>
                      <p className="text-gray-500 text-xs">{t.driver?.sapNumber} · {t.driver?.logisticsTrack}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>
                        {STATUS_LABEL[t.overallStatus]}
                      </span>
                      <p className="text-gray-600 text-xs mt-1">{new Date(t.testedAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {tests.length === 0 && <p className="text-gray-600 text-sm px-5 py-4">No test records yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── DRIVER REGISTRY ── */}
        {tab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Driver Registry</h2>
              <button onClick={openAdd}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add Driver
              </button>
            </div>

            {/* Add/Edit form */}
            {showForm && (
              <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-widest">
                  {editId ? 'Edit Driver' : 'Register New Driver'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">SAP Number *</label>
                    <input className={INPUT} value={form.sapNumber} disabled={!!editId}
                      onChange={e=>setForm(p=>({...p,sapNumber:e.target.value.toUpperCase()}))}
                      placeholder="e.g. DRV-001"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Full Name *</label>
                    <input className={INPUT} value={form.fullName}
                      onChange={e=>setForm(p=>({...p,fullName:e.target.value}))} placeholder="Full Name"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Age *</label>
                    <input className={INPUT} type="number" value={form.age} min={18} max={70}
                      onChange={e=>setForm(p=>({...p,age:e.target.value}))} placeholder="Age"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Shift Type</label>
                    <select className={INPUT} value={form.shiftType}
                      onChange={e=>setForm(p=>({...p,shiftType:e.target.value}))}>
                      <option>Day</option><option>Night</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Logistics Track</label>
                    <select className={INPUT} value={form.logisticsTrack}
                      onChange={e=>setForm(p=>({...p,logisticsTrack:e.target.value,convoyConfig:''}))}>
                      <option>Short Haul Driver</option>
                      <option>Convoy Driver</option>
                    </select>
                  </div>
                  {form.logisticsTrack === 'Convoy Driver' && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Convoy Config</label>
                      <select className={INPUT} value={form.convoyConfig}
                        onChange={e=>setForm(p=>({...p,convoyConfig:e.target.value}))}>
                        <option value="">Select convoy…</option>
                        {['Convoy-1','Convoy-2','Convoy-3','Convoy-4','Convoy-5'].map(c=>(
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                      Accommodation Unit <span className="text-gray-700">(internal)</span>
                    </label>
                    <input className={INPUT} value={form.accommodationUnit}
                      onChange={e=>setForm(p=>({...p,accommodationUnit:e.target.value}))} placeholder="Unit / Block / Room No."/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                      Room Capacity <span className="text-gray-700">(internal)</span>
                    </label>
                    <select className={INPUT} value={form.roomCapacity}
                      onChange={e=>setForm(p=>({...p,roomCapacity:e.target.value}))}>
                      <option>Single</option><option>2-person</option><option>3+ shared</option>
                    </select>
                  </div>
                </div>
                {formErr && <p className="text-red-400 text-sm">{formErr}</p>}
                <div className="flex gap-3">
                  <button onClick={()=>setShowForm(false)}
                    className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveDriver} disabled={loading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    {loading ? 'Saving…' : (editId ? 'Update Driver' : 'Register Driver')}
                  </button>
                </div>
              </div>
            )}

            {/* Driver table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['SAP Number','Full Name','Shift','Track / Convoy','Status','Actions'].map(h=>(
                      <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {drivers.map(d => (
                    <tr key={d._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-3 font-mono text-emerald-400">{d.sapNumber}</td>
                      <td className="px-5 py-3 text-white font-medium">{d.fullName}</td>
                      <td className="px-5 py-3 text-gray-400">{d.shiftType}</td>
                      <td className="px-5 py-3 text-gray-300">
                        {d.logisticsTrack}
                        {d.convoyConfig && <span className="ml-1 text-xs text-gray-500">({d.convoyConfig})</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${d.isActive?'bg-emerald-500/10 text-emerald-400':'bg-gray-700 text-gray-500'}`}>
                          {d.isActive?'Active':'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button onClick={()=>openEdit(d)}
                            className={`${BTN_SM} bg-blue-600/20 text-blue-400 hover:bg-blue-600/40`}>Edit</button>
                          <button onClick={()=>deleteDriver(d._id)}
                            className={`${BTN_SM} bg-red-600/20 text-red-400 hover:bg-red-600/40`}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {drivers.length===0 && (
                    <tr><td colSpan={6} className="px-5 py-6 text-gray-600 text-center">No drivers registered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TEST HISTORY ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Test History</h2>
              <div className="flex items-center gap-3">
                <select value={trackFilter} onChange={e=>setTrackFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="all">All Tracks</option>
                  <option value="Short Haul Driver">Short Haul</option>
                  <option value="Convoy Driver">Convoy</option>
                </select>
                <button onClick={exportCSV}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Date / Time','Driver','Track','S1','S2','Mean RT','Lapses','F.Starts','Status'].map(h=>(
                      <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredTests.map(t => (
                    <tr key={t._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(t.testedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{t.driver?.fullName}</p>
                        <p className="text-gray-500 text-xs font-mono">{t.driver?.sapNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.driver?.logisticsTrack}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${t.stage1?.passed?'text-emerald-400':'text-red-400'}`}>
                          {t.stage1?.passed?'P':'F'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${t.stage2?.passed?'text-emerald-400':'text-red-400'}`}>
                          {t.stage2?.passed?'P':'F'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-white text-xs">{t.stage3?.meanRT?.toFixed(0)}ms</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.lapses>=3?'text-red-400':t.stage3?.lapses>0?'text-amber-400':'text-gray-500'}`}>{t.stage3?.lapses}</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.falseStarts>=2?'text-red-400':t.stage3?.falseStarts>0?'text-amber-400':'text-gray-500'}`}>{t.stage3?.falseStarts}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>
                          {STATUS_LABEL[t.overallStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTests.length===0 && (
                    <tr><td colSpan={9} className="px-4 py-6 text-gray-600 text-center">No test records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Fatigue Trend Analytics — Last 14 Days</h2>
              <button onClick={exportCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
                Export Data to CSV
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              {chartData && chartData.labels.length > 0 ? (
                <div style={{height:'320px'}}>
                  <Line data={chartData} options={chartOptions}/>
                </div>
              ) : (
                <p className="text-gray-600 text-center py-12">No trend data available yet. Run tests to populate the chart.</p>
              )}
            </div>

            {/* Track breakdown */}
            {tests.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Short Haul Driver','Convoy Driver'].map(track => {
                  const t = tests.filter(x=>x.driver?.logisticsTrack===track);
                  const hr = t.filter(x=>x.overallStatus==='HIGH_RISK').length;
                  const lr = t.filter(x=>x.overallStatus==='LOW_RISK').length;
                  const mr = t.filter(x=>x.overallStatus==='MODERATE_RISK').length;
                  return (
                    <div key={track} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-white font-semibold mb-4">{track}</h3>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div><p className="text-3xl font-black text-emerald-400">{lr}</p><p className="text-gray-500 text-xs mt-1">Low Risk</p></div>
                        <div><p className="text-3xl font-black text-amber-400">{mr}</p><p className="text-gray-500 text-xs mt-1">Moderate</p></div>
                        <div><p className="text-3xl font-black text-red-400">{hr}</p><p className="text-gray-500 text-xs mt-1">High Risk</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
