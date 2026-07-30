import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { pvtAdminApi } from '../../api/pvt';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const STATUS_BADGE = {
  LOW_RISK:      'bg-emerald-100 text-emerald-700 border-emerald-300',
  MODERATE_RISK: 'bg-amber-100  text-amber-700  border-amber-300',
  HIGH_RISK:     'bg-red-100    text-red-700    border-red-300',
};
const STATUS_LABEL = { LOW_RISK:'FIT', MODERATE_RISK:'MONITOR', HIGH_RISK:'NOT FIT' };

export default function PVTManagement() {
  const { admin } = useAdminAuth();
  const [tab, setTab]       = useState('overview');
  const [alerts, setAlerts] = useState([]);
  const [stats,  setStats]  = useState(null);
  const [tests,  setTests]  = useState([]);
  const [trackFilter, setTrackFilter] = useState('all');
  const pollRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try { const { data } = await pvtAdminApi.get('/alerts?unread=true'); setAlerts(data); } catch {}
  }, []);
  const fetchStats = useCallback(async () => {
    try { const { data } = await pvtAdminApi.get('/dashboard'); setStats(data); } catch {}
  }, []);
  const fetchTests = useCallback(async () => {
    try { const { data } = await pvtAdminApi.get('/tests'); setTests(data); } catch {}
  }, []);

  useEffect(() => {
    fetchStats(); fetchAlerts(); fetchTests();
    pollRef.current = setInterval(fetchAlerts, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchStats, fetchAlerts, fetchTests]);

  const dismissAlert = async (id) => {
    await pvtAdminApi.put(`/alerts/${id}/read`);
    setAlerts(p => p.filter(a => a._id !== id));
  };
  const dismissAll = async () => {
    await pvtAdminApi.put('/alerts/read-all');
    setAlerts([]);
  };

  const exportCSV = () => window.open('/api/pvt/export', '_blank');

  const chartData = stats?.last14Days ? {
    labels: stats.last14Days.map(d => d._id.slice(5)),
    datasets: [
      { label:'Avg RT (ms)', data: stats.last14Days.map(d => Math.round(d.avgRT||0)),
        borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.08)',
        tension:0.4, fill:true, pointBackgroundColor:'#10b981', pointRadius:4 },
      { label:'HIGH RISK', data: stats.last14Days.map(d => d.highRisk),
        borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.05)',
        tension:0.4, fill:false, pointBackgroundColor:'#ef4444', pointRadius:4, yAxisID:'y2' }
    ]
  } : null;

  const chartOptions = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ labels:{ color:'#374151',font:{size:12} } },
              tooltip:{ backgroundColor:'#111827',titleColor:'#fff',bodyColor:'#9ca3af' } },
    scales:{
      x:{ ticks:{color:'#6b7280'}, grid:{color:'rgba(0,0,0,0.04)'} },
      y:{ ticks:{color:'#6b7280'}, grid:{color:'rgba(0,0,0,0.04)'}, title:{display:true,text:'Avg RT (ms)',color:'#6b7280'} },
      y2:{ position:'right', ticks:{color:'#6b7280'}, grid:{display:false}, title:{display:true,text:'HIGH RISK',color:'#6b7280'} }
    }
  };

  const filteredTests = trackFilter === 'all' ? tests
    : tests.filter(t => t.driver?.logisticsTrack === trackFilter);

  return (
    <AdminLayout>
      {/* HIGH RISK alert banner */}
      {alerts.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              {alerts.map(a => (
                <div key={a._id} className="flex items-center gap-2">
                  <span className="animate-pulse text-base">🚨</span>
                  <p className="text-red-700 text-sm font-semibold">
                    CRITICAL: Driver {a.driverName} (SAP: {a.driverSap}) — NOT FIT FOR DUTY. Action Required.
                  </p>
                  <button onClick={() => dismissAlert(a._id)} className="ml-auto text-red-400 hover:text-red-700">✕</button>
                </div>
              ))}
            </div>
            {alerts.length > 1 && (
              <button onClick={dismissAll} className="text-red-500 hover:text-red-700 text-xs font-medium flex-shrink-0">Dismiss All</button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[['overview','Overview'],['history','Test History'],['analytics','Analytics']].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab===key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {lbl}
            {key==='overview' && alerts.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==='overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Active Drivers',   value:stats?.totalDrivers??'—', color:'text-gray-900' },
              { label:'Tests Today',      value:stats?.testsToday??'—',   color:'text-blue-600' },
              { label:'HIGH RISK Today',  value:stats?.highRiskToday??'—', color:(stats?.highRiskToday>0)?'text-red-600':'text-green-600' },
              { label:'Unread Alerts',    value:stats?.unreadAlerts??'—', color:(stats?.unreadAlerts>0)?'text-red-600':'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`text-4xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Recent Test Activity</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {tests.slice(0,8).map(t => (
                <div key={t._id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-gray-800 text-sm font-medium">
                      {t.driver?.firstName} {t.driver?.lastName}
                    </p>
                    <p className="text-gray-400 text-xs">{t.driver?.sapId} · {t.driver?.logisticsTrack}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>
                      {STATUS_LABEL[t.overallStatus]}
                    </span>
                    <p className="text-gray-400 text-xs mt-1">{new Date(t.testedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {tests.length===0 && <p className="text-gray-400 text-sm px-5 py-4 text-center">No test records yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TEST HISTORY */}
      {tab==='history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Test History</h2>
            <div className="flex gap-3">
              <select value={trackFilter} onChange={e=>setTrackFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Tracks</option>
                <option value="Short Haul Driver">Short Haul</option>
                <option value="Convoy Driver">Convoy</option>
              </select>
              <button onClick={exportCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                ↓ Export CSV
              </button>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date','Driver','Track','S1','S2','Mean RT','Lapses','F.Starts','Status'].map(h=>(
                    <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTests.map(t=>(
                  <tr key={t._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(t.testedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800 font-medium">{t.driver?.firstName} {t.driver?.lastName}</p>
                      <p className="text-gray-400 text-xs">{t.driver?.sapId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.driver?.logisticsTrack}</td>
                    <td className={`px-4 py-3 font-bold text-xs ${t.stage1?.passed?'text-green-600':'text-red-500'}`}>{t.stage1?.passed?'P':'F'}</td>
                    <td className={`px-4 py-3 font-bold text-xs ${t.stage2?.passed?'text-green-600':'text-red-500'}`}>{t.stage2?.passed?'P':'F'}</td>
                    <td className="px-4 py-3 font-mono text-gray-800 text-xs">{t.stage3?.meanRT?.toFixed(0)}ms</td>
                    <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.lapses>=3?'text-red-500':t.stage3?.lapses>0?'text-amber-500':'text-gray-400'}`}>{t.stage3?.lapses}</td>
                    <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.falseStarts>=2?'text-red-500':t.stage3?.falseStarts>0?'text-amber-500':'text-gray-400'}`}>{t.stage3?.falseStarts}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>
                        {STATUS_LABEL[t.overallStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTests.length===0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-gray-400 text-center">No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab==='analytics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Fatigue Trend — Last 14 Days</h2>
            <button onClick={exportCSV}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
              Export Data to CSV
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            {chartData && chartData.labels.length > 0 ? (
              <div style={{height:'300px'}}><Line data={chartData} options={chartOptions}/></div>
            ) : (
              <p className="text-gray-400 text-center py-12">No data yet. Tests will appear here.</p>
            )}
          </div>

          {tests.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Short Haul Driver','Convoy Driver'].map(track => {
                const t = tests.filter(x=>x.driver?.logisticsTrack===track);
                const hr=t.filter(x=>x.overallStatus==='HIGH_RISK').length;
                const lr=t.filter(x=>x.overallStatus==='LOW_RISK').length;
                const mr=t.filter(x=>x.overallStatus==='MODERATE_RISK').length;
                return (
                  <div key={track} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-gray-800 font-semibold mb-4">{track}</h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-3xl font-black text-green-600">{lr}</p><p className="text-gray-500 text-xs mt-1">Low Risk</p></div>
                      <div><p className="text-3xl font-black text-amber-600">{mr}</p><p className="text-gray-500 text-xs mt-1">Moderate</p></div>
                      <div><p className="text-3xl font-black text-red-600">{hr}</p><p className="text-gray-500 text-xs mt-1">High Risk</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
