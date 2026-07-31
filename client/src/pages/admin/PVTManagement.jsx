import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
const STATUS_LABEL = { LOW_RISK:'ТЭНЦЭНЭ', MODERATE_RISK:'ХЯНАЛТТАЙ ТЭНЦЭНЭ', HIGH_RISK:'ТЭНЦЭХГҮЙ' };

export default function PVTManagement() {
  const { admin } = useAdminAuth();
  const [tab, setTab]       = useState('overview');
  const [alerts, setAlerts] = useState([]);
  const [stats,  setStats]  = useState(null);
  const [tests,  setTests]  = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testError,    setTestError]    = useState('');
  const [shiftFilter,  setShiftFilter]  = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [dateFilter,   setDateFilter]   = useState(() => new Date().toISOString().slice(0,10));
  const [searchFilter,  setSearchFilter]  = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const pollRef  = useRef(null);
  const testsRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try { const { data } = await pvtAdminApi.get('/alerts?unread=true'); setAlerts(data); } catch {}
  }, []);
  const fetchStats = useCallback(async () => {
    try { const { data } = await pvtAdminApi.get('/dashboard'); setStats(data); } catch {}
  }, []);
  const fetchTests = useCallback(async () => {
    setLoadingTests(true); setTestError('');
    try {
      const { data } = await pvtAdminApi.get('/tests');
      setTests(data);
    } catch (err) {
      setTestError(err.response?.data?.message || err.message || 'Шалгалт татахад алдаа гарлаа');
    } finally {
      setLoadingTests(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(); fetchAlerts(); fetchTests();
    pollRef.current  = setInterval(fetchAlerts, 5000);
    testsRef.current = setInterval(fetchTests, 30000); // auto-refresh every 30s
    return () => { clearInterval(pollRef.current); clearInterval(testsRef.current); };
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
      { label:'Дундаж хариу (мс)', data: stats.last14Days.map(d => Math.round(d.avgRT||0)),
        borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.08)',
        tension:0.4, fill:true, pointBackgroundColor:'#10b981', pointRadius:4 },
      { label:'ӨНДӨР ЭРСДЭЛ', data: stats.last14Days.map(d => d.highRisk),
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
      y:{ ticks:{color:'#6b7280'}, grid:{color:'rgba(0,0,0,0.04)'}, title:{display:true,text:'Дундаж хариу (мс)',color:'#6b7280'} },
      y2:{ position:'right', ticks:{color:'#6b7280'}, grid:{display:false}, title:{display:true,text:'ӨНДӨР ЭРСДЭЛ',color:'#6b7280'} }
    }
  };

  const filteredTests = tests.filter(t => {
    if (companyFilter !== 'all' && (t.company?.name || '') !== companyFilter) return false;
    if (shiftFilter !== 'all') {
      if (shiftFilter === 'Цуваа') {
        if (!t.testShift?.startsWith('Цуваа')) return false;
      } else if (t.testShift !== shiftFilter) return false;
    }
    if (dateFilter) {
      const day = new Date(t.testedAt).toISOString().slice(0,10);
      if (day !== dateFilter) return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      const name = (t.driver?.firstName ? `${t.driver.firstName} ${t.driver.lastName}` : t.driverName || '').toLowerCase();
      const sap  = (t.driver?.sapId || t.driverSap || '').toLowerCase();
      if (!name.includes(q) && !sap.includes(q)) return false;
    }
    return true;
  });

  // Group by driver + day for compact view
  const groupedTests = useMemo(() => {
    const map = {};
    filteredTests.forEach(t => {
      const key = `${t.driverSap || t.driver?._id || 'x'}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.values(map).map(g => ({
      latest: g[0],
      all: g,
      key: `${g[0].driverSap || g[0].driver?._id}-${g[0].testedAt}`
    }));
  }, [filteredTests]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  // Day navigation
  const changeDay = (dir) => {
    if (!dateFilter) return;
    const d = new Date(dateFilter);
    d.setDate(d.getDate() + dir);
    setDateFilter(d.toISOString().slice(0,10));
  };

  // Unique companies from loaded tests
  const companyOptions = [...new Set(tests.map(t => t.company?.name).filter(Boolean))].sort();

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
                    🚨 АНХААРУУЛГА: Жолооч {a.driverName} (SAP: {a.driverSap}) — АЖИЛД ТЭНЦЭХГҮЙ. Яаралтай арга хэмжээ авна уу.
                  </p>
                  <button onClick={() => dismissAlert(a._id)} className="ml-auto text-red-400 hover:text-red-700">✕</button>
                </div>
              ))}
            </div>
            {alerts.length > 1 && (
              <button onClick={dismissAll} className="text-red-500 hover:text-red-700 text-xs font-medium flex-shrink-0">Бүгдийг хаах</button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[['overview','Тойм'],['history','Шалгалтын түүх'],['analytics','Шинжилгээ']].map(([key,lbl]) => (
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
              { label:'Идэвхтэй жолооч нар', value:stats?.totalDrivers??'—', color:'text-gray-900' },
              { label:'Өнөөдөрийн шалгалт',      value:stats?.testsToday??'—',   color:'text-blue-600' },
              { label:'Өнөөдөр ӨНДӨР ЭРСДЭЛ',  value:stats?.highRiskToday??'—', color:(stats?.highRiskToday>0)?'text-red-600':'text-green-600' },
              { label:'Шинэ анхааруулга',    value:stats?.unreadAlerts??'—', color:(stats?.unreadAlerts>0)?'text-red-600':'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`text-4xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Сүүлийн шалгалтын үйл ажиллагаа</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {tests.slice(0,8).map(t => (
                <div key={t._id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-gray-800 text-sm font-medium">
                      {t.driver?.firstName
                        ? `${t.driver.firstName} ${t.driver.lastName}`
                        : t.driverName || '—'}
                    </p>
                    <p className="text-gray-400 text-xs">{t.driver?.sapId || t.driverSap}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>
                      {STATUS_LABEL[t.overallStatus]}
                    </span>
                    <p className="text-gray-400 text-xs mt-1">{new Date(t.testedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {tests.length===0 && !loadingTests && !testError && <p className="text-gray-400 text-sm px-5 py-4 text-center">Шалгалтын бүртгэл байхгүй байна.</p>}
              {loadingTests && <p className="text-gray-400 text-sm px-5 py-4 text-center">Уншиж байна...</p>}
              {testError && <p className="text-red-500 text-sm px-5 py-4 text-center">⚠ {testError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* TEST HISTORY */}
      {tab==='history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Шалгалтын түүх
              <span className="text-gray-400 text-sm font-normal ml-2">({groupedTests.length} жолооч · {filteredTests.length} шалгалт)</span>
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Search by name or SAP */}
              <div className="relative">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Нэр эсвэл SAP хайх..."
                  className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-700 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs">🔍</span>
                {searchFilter && (
                  <button onClick={() => setSearchFilter('')}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => changeDay(-1)}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition-colors">‹</button>
                <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => changeDay(1)}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition-colors">›</button>
                <button onClick={() => setDateFilter('')}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg text-xs transition-colors" title="Бүх огноо">✕</button>
              </div>

              {/* Company filter */}
              {companyOptions.length > 1 && (
                <select value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">Бүх компани</option>
                  {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              {/* Shift filter */}
              <select value={shiftFilter} onChange={e=>setShiftFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">Бүх ээлж</option>
                <option value="Өдөр">Өдөр</option>
                <option value="Шөнө">Шөнө</option>
                <optgroup label="Цуваа">
                  <option value="Цуваа">Цуваа (бүх)</option>
                  {[1,2,3,4,5,6,7].map(n => (
                    <option key={n} value={`Цуваа-${n}`}>Цуваа-{n}</option>
                  ))}
                </optgroup>
              </select>

              <button onClick={fetchTests} disabled={loadingTests}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {loadingTests ? '⟳' : '⟳ Шинэчлэх'}
              </button>
              <button onClick={exportCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                ↓ CSV татах
              </button>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Огноо','Жолооч','Компани','Ээлж','Санах ойн шалгалт','Эрэмбэлэлт','Дундаж хугацаа','Хоцролт','Түрүүлж дарсан','Статус'].map(h=>(
                    <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedTests.map(({latest: t, all, key}) => {
                  const isExpanded = expandedGroups.has(key);
                  const multi = all.length > 1;
                  const rowClass = 'hover:bg-gray-50 transition-colors';
                  const renderRow = (r, isSubRow = false) => (
                    <tr key={r._id} className={`${rowClass} ${isSubRow ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {!isSubRow && multi && (
                          <button onClick={() => toggleGroup(key)}
                            className="mr-1 text-blue-500 font-bold hover:text-blue-700">
                            {isExpanded ? '▾' : '▸'} {all.length}
                          </button>
                        )}
                        {isSubRow && <span className="mr-3 text-gray-300">↳</span>}
                        {new Date(r.testedAt).toLocaleTimeString('mn-MN', {hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-800 font-medium text-sm">
                          {r.driver?.firstName ? `${r.driver.firstName} ${r.driver.lastName}` : r.driverName || '—'}
                        </p>
                        <p className="text-gray-400 text-xs">{r.driver?.sapId || r.driverSap}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{r.company?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{r.testShift || r.driver?.shiftType || '—'}</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${r.stage1?.passed?'text-green-600':'text-red-500'}`}>{r.stage1?.passed?'Тэнцсэн':'Тэнцсэнгүй'}</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${r.stage2?.passed?'text-green-600':'text-red-500'}`}>{r.stage2?.passed?'Тэнцсэн':'Тэнцсэнгүй'}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-800 text-xs">{r.stage3?.meanRT?.toFixed(0)}мс</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${r.stage3?.lapses>=3?'text-red-500':r.stage3?.lapses>0?'text-amber-500':'text-gray-400'}`}>{r.stage3?.lapses}</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${r.stage3?.falseStarts>=2?'text-red-500':r.stage3?.falseStarts>0?'text-amber-500':'text-gray-400'}`}>{r.stage3?.falseStarts}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[r.overallStatus]}`}>
                          {STATUS_LABEL[r.overallStatus]}
                        </span>
                      </td>
                    </tr>
                  );
                  return (
                    <React.Fragment key={key}>
                      {renderRow(t, false)}
                      {isExpanded && all.slice(1).map(r => renderRow(r, true))}
                    </React.Fragment>
                  );
                })}
                {groupedTests.length===0 && !loadingTests && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center">
                    {testError
                      ? <p className="text-red-500 text-sm">⚠ {testError}</p>
                      : <p className="text-gray-400 text-sm">Шалгалтын бүртгэл олдсонгүй. Шүүлтүүрийг шалгана уу.</p>}
                  </td></tr>
                )}
                {loadingTests && (
                  <tr><td colSpan={10} className="px-4 py-8 text-gray-400 text-sm text-center">Уншиж байна...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab==='analytics' && (() => {
        const total   = tests.length;
        const lr      = tests.filter(t => t.overallStatus === 'LOW_RISK').length;
        const mr      = tests.filter(t => t.overallStatus === 'MODERATE_RISK').length;
        const hr      = tests.filter(t => t.overallStatus === 'HIGH_RISK').length;
        const passRate = total ? Math.round(lr / total * 100) : 0;
        const validRTs = tests.map(t => t.stage3?.meanRT).filter(v => v > 0);
        const avgRT    = validRTs.length ? Math.round(validRTs.reduce((a,b)=>a+b,0)/validRTs.length) : 0;
        const s1pass   = total ? Math.round(tests.filter(t=>t.stage1?.passed).length/total*100) : 0;
        const s2pass   = total ? Math.round(tests.filter(t=>t.stage2?.passed).length/total*100) : 0;

        // Shift breakdown
        const shifts = [...new Set(tests.map(t => t.testShift || t.driver?.shiftType || 'Тодорхойгүй'))].sort();
        const shiftStats = shifts.map(s => {
          const st = tests.filter(t => (t.testShift || t.driver?.shiftType || 'Тодорхойгүй') === s);
          const rts = st.map(t=>t.stage3?.meanRT).filter(v=>v>0);
          return {
            shift: s, count: st.length,
            lr: st.filter(t=>t.overallStatus==='LOW_RISK').length,
            mr: st.filter(t=>t.overallStatus==='MODERATE_RISK').length,
            hr: st.filter(t=>t.overallStatus==='HIGH_RISK').length,
            avgRT: rts.length ? Math.round(rts.reduce((a,b)=>a+b,0)/rts.length) : 0,
          };
        });

        // Top drivers with most HIGH_RISK
        const driverMap = {};
        tests.forEach(t => {
          const key = t.driverSap || t.driver?.sapId || t._id;
          const name = t.driver?.firstName ? `${t.driver.firstName} ${t.driver.lastName}` : t.driverName || '—';
          if (!driverMap[key]) driverMap[key] = { name, sap: key, total:0, hr:0, rts:[] };
          driverMap[key].total++;
          if (t.overallStatus === 'HIGH_RISK') driverMap[key].hr++;
          if (t.stage3?.meanRT > 0) driverMap[key].rts.push(t.stage3.meanRT);
        });
        const topDrivers = Object.values(driverMap)
          .map(d => ({ ...d, avgRT: d.rts.length ? Math.round(d.rts.reduce((a,b)=>a+b,0)/d.rts.length) : 0 }))
          .sort((a,b) => b.hr - a.hr || b.avgRT - a.avgRT)
          .slice(0, 8);

        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Шинжилгээ — Нийт {total} шалгалт</h2>
              <button onClick={exportCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                ↓ CSV татах
              </button>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Тэнцсэн хувь', value: `${passRate}%`, sub: `${lr} / ${total}`, color: passRate>=70?'text-green-600':'text-amber-600' },
                { label: 'Дундаж хариу урвал', value: `${avgRT}мс`, sub: avgRT<350?'Хэвийн':avgRT<500?'Сануулга':'Өндөр', color: avgRT<350?'text-green-600':avgRT<500?'text-amber-600':'text-red-600' },
                { label: 'Санах ойн шалгалт', value: `${s1pass}%`, sub: 'Тэнцсэн хувь', color: s1pass>=70?'text-green-600':'text-amber-600' },
                { label: 'Эрэмбэлэлт', value: `${s2pass}%`, sub: 'Тэнцсэн хувь', color: s2pass>=70?'text-green-600':'text-amber-600' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Risk breakdown */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'АЖИЛД ТЭНЦЭНЭ', count: lr, pct: total?Math.round(lr/total*100):0, color:'bg-green-100 text-green-700 border-green-300' },
                { label: 'ХЯНАЛТТАЙ ТЭНЦЭНЭ', count: mr, pct: total?Math.round(mr/total*100):0, color:'bg-amber-100 text-amber-700 border-amber-300' },
                { label: 'АЖИЛД ТЭНЦЭХГҮЙ', count: hr, pct: total?Math.round(hr/total*100):0, color:'bg-red-100 text-red-700 border-red-300' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2">{s.label}</p>
                  <p className="text-4xl font-black">{s.count}</p>
                  <p className="text-sm font-semibold mt-1">{s.pct}%</p>
                  <div className="mt-2 bg-white/50 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-current opacity-60" style={{width:`${s.pct}%`}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Trend chart */}
            {chartData && chartData.labels.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Сүүлийн 14 хоногийн чиг хандлага</h3>
                <div style={{height:'260px'}}><Line data={chartData} options={chartOptions}/></div>
              </div>
            )}

            {/* Shift breakdown table */}
            {shiftStats.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Ээлжийн дүн шинжилгээ</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Ээлж','Нийт','Тэнцсэн','Хяналттай','Тэнцэхгүй','Тэнцсэн %','Дундаж RT'].map(h => (
                        <th key={h} className="text-left text-gray-500 text-xs tracking-wide font-semibold px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shiftStats.map(s => {
                      const pct = s.count ? Math.round(s.lr/s.count*100) : 0;
                      return (
                        <tr key={s.shift} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{s.shift}</td>
                          <td className="px-4 py-2.5 text-gray-600">{s.count}</td>
                          <td className="px-4 py-2.5 text-green-600 font-bold">{s.lr}</td>
                          <td className="px-4 py-2.5 text-amber-600 font-bold">{s.mr}</td>
                          <td className="px-4 py-2.5 text-red-600 font-bold">{s.hr}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${pct>=70?'bg-green-500':pct>=50?'bg-amber-500':'bg-red-500'}`} style={{width:`${pct}%`}}/>
                              </div>
                              <span className={`text-xs font-bold ${pct>=70?'text-green-600':pct>=50?'text-amber-600':'text-red-600'}`}>{pct}%</span>
                            </div>
                          </td>
                          <td className={`px-4 py-2.5 font-mono text-xs font-bold ${s.avgRT<350?'text-green-600':s.avgRT<500?'text-amber-600':'text-red-600'}`}>{s.avgRT}мс</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Top drivers attention list */}
            {topDrivers.some(d => d.hr > 0) && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Анхаарал шаардах жолооч нар <span className="text-gray-400 font-normal">(өндөр эрсдэл илүү их)</span></h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Жолооч','SAP','Нийт шалгалт','Тэнцэхгүй','Дундаж RT'].map(h => (
                        <th key={h} className="text-left text-gray-500 text-xs tracking-wide font-semibold px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topDrivers.filter(d=>d.hr>0).map(d => (
                      <tr key={d.sap} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{d.name}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{d.sap}</td>
                        <td className="px-4 py-2.5 text-gray-600">{d.total}</td>
                        <td className="px-4 py-2.5">
                          <span className="bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-2 py-0.5 rounded-full">{d.hr} удаа</span>
                        </td>
                        <td className={`px-4 py-2.5 font-mono text-xs font-bold ${d.avgRT<350?'text-green-600':d.avgRT<500?'text-amber-600':'text-red-600'}`}>{d.avgRT}мс</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tests.length === 0 && (
              <p className="text-gray-400 text-center py-12">Өгөгдөл байхгүй байна. Шалгалтын үр дүн энд харагдана.</p>
            )}
          </div>
        );
      })()}
    </AdminLayout>
  );
}
