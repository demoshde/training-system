import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePVT } from '../../contexts/PVTContext';
import { pvtApi } from '../../api/pvt';

// ─── Shared styles ────────────────────────────────────────────────────────────
const INPUT = 'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-600';
const BTN_SM = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors';

const EMPTY_COMPANY = { name: '', description: '' };
const EMPTY_DRIVER = {
  sapNumber: '', fullName: '', age: '', companyId: '',
  shiftType: 'Day', logisticsTrack: 'Short Haul Driver',
  convoyConfig: '', accommodationUnit: '', roomCapacity: 'Single', isActive: true
};

const STATUS_BADGE = {
  LOW_RISK:      'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
  MODERATE_RISK: 'bg-amber-600/20  text-amber-300  border-amber-500/30',
  HIGH_RISK:     'bg-red-600/20    text-red-300    border-red-500/30',
};

export default function PVTSuperAdmin() {
  const navigate = useNavigate();
  const { pvtUser, logout } = usePVT();

  const [tab, setTab]             = useState('companies');
  const [companies, setCompanies] = useState([]);
  const [globalStats, setGStats]  = useState(null);
  const [allTests, setAllTests]   = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);
  const [loading, setLoading]     = useState(false);

  // ── Company form state ───────────────────────────────────────────────────
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editCompanyId,   setEditCompanyId]   = useState(null);
  const [companyForm,     setCompanyForm]     = useState(EMPTY_COMPANY);
  const [companyErr,      setCompanyErr]      = useState('');

  // ── Moderator SAP assignment ─────────────────────────────────────────────
  const [assigningModId, setAssigningModId] = useState(null);
  const [sapInput,       setSapInput]       = useState('');
  const [sapMsg,         setSapMsg]         = useState({ type: '', text: '' });

  // ── Driver form state ────────────────────────────────────────────────────
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editDriverId,   setEditDriverId]   = useState(null);
  const [driverForm,     setDriverForm]     = useState(EMPTY_DRIVER);
  const [driverErr,      setDriverErr]      = useState('');

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
      setCompanies(c.data); setGStats(s.data); setAllTests(t.data); setAllDrivers(d.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ COMPANY CRUD ════════════════════════════════════════════════════════
  function openAddCompany() { setCompanyForm(EMPTY_COMPANY); setEditCompanyId(null); setCompanyErr(''); setShowCompanyForm(true); }
  function openEditCompany(c) { setCompanyForm({ name: c.name, description: c.description||'' }); setEditCompanyId(c._id); setCompanyErr(''); setShowCompanyForm(true); }
  async function saveCompany() {
    if (!companyForm.name.trim()) { setCompanyErr('Company name is required.'); return; }
    setLoading(true); setCompanyErr('');
    try {
      if (editCompanyId) await pvtApi.put(`/companies/${editCompanyId}`, companyForm);
      else               await pvtApi.post('/companies', companyForm);
      await fetchAll(); setShowCompanyForm(false);
    } catch(e) { setCompanyErr(e.response?.data?.message || 'Save failed.'); }
    finally { setLoading(false); }
  }
  async function deleteCompany(id, name) {
    if (!window.confirm(`Remove "${name}" and ALL its drivers, tests, and alerts? This cannot be undone.`)) return;
    try { await pvtApi.delete(`/companies/${id}`); await fetchAll(); } catch {}
  }
  async function assignModerator(companyId) {
    setSapMsg({ type:'', text:'' });
    if (!sapInput.trim()) { setSapMsg({ type:'err', text:'Enter a SAP code.' }); return; }
    try {
      await pvtApi.put(`/companies/${companyId}/moderator`, { pvtSapCode: sapInput.trim() });
      setSapMsg({ type:'ok', text:`"${sapInput.trim().toUpperCase()}" assigned.` });
      setSapInput(''); await fetchAll();
      setTimeout(() => { setAssigningModId(null); setSapMsg({type:'',text:''}); }, 1800);
    } catch(e) { setSapMsg({ type:'err', text: e.response?.data?.message || 'Failed.' }); }
  }

  // ═══ DRIVER CRUD ═════════════════════════════════════════════════════════
  function openAddDriver() { setDriverForm({ ...EMPTY_DRIVER, companyId: companies[0]?._id||'' }); setEditDriverId(null); setDriverErr(''); setShowDriverForm(true); }
  function openEditDriver(d) {
    setDriverForm({ sapNumber:d.sapNumber, fullName:d.fullName, age:d.age, companyId:d.company?._id||d.company, shiftType:d.shiftType, logisticsTrack:d.logisticsTrack, convoyConfig:d.convoyConfig||'', accommodationUnit:d.accommodationUnit||'', roomCapacity:d.roomCapacity, isActive:d.isActive });
    setEditDriverId(d._id); setDriverErr(''); setShowDriverForm(true);
  }
  async function saveDriver() {
    if (!driverForm.sapNumber||!driverForm.fullName||!driverForm.age||!driverForm.companyId) { setDriverErr('SAP Number, Full Name, Age and Company are required.'); return; }
    setLoading(true); setDriverErr('');
    try {
      if (editDriverId) await pvtApi.put(`/drivers/${editDriverId}`, driverForm);
      else              await pvtApi.post('/drivers', driverForm);
      await fetchAll(); setShowDriverForm(false);
    } catch(e) { setDriverErr(e.response?.data?.message || 'Save failed.'); }
    finally { setLoading(false); }
  }
  async function deleteDriver(id, name) {
    if (!window.confirm(`Remove driver "${name}"?`)) return;
    try { await pvtApi.delete(`/drivers/${id}`); await fetchAll(); } catch {}
  }

  function exportCSV() { window.open('/api/pvt/export', '_blank'); }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Super Admin Control Suite</h1>
              <p className="text-purple-400 text-xs font-medium">FleetGuard PVT — Global Access</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{pvtUser?.name}</span>
            <button onClick={() => { logout(); navigate('/pvt'); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {globalStats && (
        <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-6">
            {[
              { label:'Companies', value:globalStats.companies },
              { label:'Active Drivers', value:globalStats.drivers },
              { label:'Total Tests', value:globalStats.totalTests },
              { label:'Tests Today', value:globalStats.todayTests, color:'text-blue-400' },
              { label:'HIGH RISK Today', value:globalStats.highRisk, color:globalStats.highRisk>0?'text-red-400':'text-emerald-400' },
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
          {[['companies','Transport Companies'],['drivers','All Drivers'],['tests','Test Records']].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab===key?'border-purple-500 text-purple-400':'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* ═══ COMPANIES ═══ */}
        {tab==='companies' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Transport Companies</h2>
              <button onClick={openAddCompany} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Add Company
              </button>
            </div>

            {showCompanyForm && (
              <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-widest">{editCompanyId?'Edit Company':'New Transport Company'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Company Name *</label>
                    <input className={INPUT} value={companyForm.name} onChange={e=>setCompanyForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Trans-Mongolian Logistics" autoFocus/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Description</label>
                    <input className={INPUT} value={companyForm.description} onChange={e=>setCompanyForm(p=>({...p,description:e.target.value}))} placeholder="Short description"/>
                  </div>
                </div>
                {companyErr && <p className="text-red-400 text-sm">{companyErr}</p>}
                <div className="flex gap-3">
                  <button onClick={()=>setShowCompanyForm(false)} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Cancel</button>
                  <button onClick={saveCompany} disabled={loading} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    {loading?'Saving…':(editCompanyId?'Update Company':'Create Company')}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companies.map(c => {
                const driverCount = allDrivers.filter(d=>(d.company?._id||d.company)===c._id).length;
                return (
                  <div key={c._id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate">{c.name}</h3>
                        {c.description && <p className="text-gray-500 text-xs mt-0.5">{c.description}</p>}
                        <p className="text-gray-600 text-xs mt-1">{driverCount} driver{driverCount!==1?'s':''} registered</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={()=>openEditCompany(c)} className={`${BTN_SM} bg-blue-600/20 text-blue-400 hover:bg-blue-600/40`}>Edit</button>
                        <button onClick={()=>deleteCompany(c._id,c.name)} className={`${BTN_SM} bg-red-600/20 text-red-400 hover:bg-red-600/40`}>Remove</button>
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-gray-500 text-xs uppercase tracking-wide">Moderator</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.moderator?.pvtSapCode?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400'}`}>
                          {c.moderator?.pvtSapCode?'SAP Assigned':'No SAP'}
                        </span>
                      </div>
                      {c.moderator ? (
                        <div className="flex items-center justify-between">
                          <p className="text-white text-sm">{c.moderator.name}</p>
                          <p className="font-mono text-emerald-400 text-sm">{c.moderator.pvtSapCode||<span className="text-gray-600 italic">not set</span>}</p>
                        </div>
                      ) : (
                        <p className="text-gray-600 text-xs">No company admin configured.</p>
                      )}
                      {c.moderator && (
                        assigningModId===c._id ? (
                          <div className="space-y-2 pt-1">
                            <input className={INPUT} value={sapInput} onChange={e=>setSapInput(e.target.value.toUpperCase())} placeholder="e.g. MOD-TC01" autoFocus/>
                            {sapMsg.text && <p className={`text-xs ${sapMsg.type==='ok'?'text-emerald-400':'text-red-400'}`}>{sapMsg.text}</p>}
                            <div className="flex gap-2">
                              <button onClick={()=>{setAssigningModId(null);setSapInput('');setSapMsg({type:'',text:''}); }} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded-lg transition-colors">Cancel</button>
                              <button onClick={()=>assignModerator(c._id)} className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">Assign</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={()=>{setAssigningModId(c._id);setSapInput(c.moderator.pvtSapCode||'');setSapMsg({type:'',text:''}); }} className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs font-medium rounded-lg transition-colors mt-1">
                            {c.moderator.pvtSapCode?'✏ Update Moderator SAP Code':'+ Assign Moderator SAP Code'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
              {companies.length===0 && !showCompanyForm && (
                <div className="col-span-2 bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
                  <p className="text-gray-600 mb-3">No companies yet.</p>
                  <button onClick={openAddCompany} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors">Add First Company</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ DRIVERS ═══ */}
        {tab==='drivers' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">All Registered Drivers</h2>
                <p className="text-gray-500 text-sm mt-0.5">{allDrivers.length} drivers across {companies.length} companies</p>
              </div>
              <button onClick={openAddDriver} disabled={companies.length===0}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Add Driver
              </button>
            </div>

            {showDriverForm && (
              <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-widest">{editDriverId?'Edit Driver':'Register New Driver'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">SAP Number *</label>
                    <input className={INPUT} value={driverForm.sapNumber} disabled={!!editDriverId}
                      onChange={e=>setDriverForm(p=>({...p,sapNumber:e.target.value.toUpperCase()}))} placeholder="e.g. DRV-001" autoFocus={!editDriverId}/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Full Name *</label>
                    <input className={INPUT} value={driverForm.fullName} onChange={e=>setDriverForm(p=>({...p,fullName:e.target.value}))} placeholder="Full Name"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Age *</label>
                    <input className={INPUT} type="number" min={18} max={70} value={driverForm.age} onChange={e=>setDriverForm(p=>({...p,age:e.target.value}))} placeholder="Age"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Company *</label>
                    <select className={INPUT} value={driverForm.companyId} onChange={e=>setDriverForm(p=>({...p,companyId:e.target.value}))}>
                      <option value="">Select company…</option>
                      {companies.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Shift</label>
                    <select className={INPUT} value={driverForm.shiftType} onChange={e=>setDriverForm(p=>({...p,shiftType:e.target.value}))}>
                      <option>Day</option><option>Night</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Logistics Track</label>
                    <select className={INPUT} value={driverForm.logisticsTrack} onChange={e=>setDriverForm(p=>({...p,logisticsTrack:e.target.value,convoyConfig:''}))}>
                      <option>Short Haul Driver</option><option>Convoy Driver</option>
                    </select>
                  </div>
                  {driverForm.logisticsTrack==='Convoy Driver' && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Convoy Config</label>
                      <select className={INPUT} value={driverForm.convoyConfig} onChange={e=>setDriverForm(p=>({...p,convoyConfig:e.target.value}))}>
                        <option value="">Select…</option>
                        {['Convoy-1','Convoy-2','Convoy-3','Convoy-4','Convoy-5'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Accommodation Unit <span className="text-gray-700">(internal)</span></label>
                    <input className={INPUT} value={driverForm.accommodationUnit} onChange={e=>setDriverForm(p=>({...p,accommodationUnit:e.target.value}))} placeholder="Unit / Block / Room"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Room Capacity <span className="text-gray-700">(internal)</span></label>
                    <select className={INPUT} value={driverForm.roomCapacity} onChange={e=>setDriverForm(p=>({...p,roomCapacity:e.target.value}))}>
                      <option>Single</option><option>2-person</option><option>3+ shared</option>
                    </select>
                  </div>
                  {editDriverId && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                      <select className={INPUT} value={driverForm.isActive?'active':'inactive'} onChange={e=>setDriverForm(p=>({...p,isActive:e.target.value==='active'}))}>
                        <option value="active">Active</option><option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}
                </div>
                {driverErr && <p className="text-red-400 text-sm">{driverErr}</p>}
                <div className="flex gap-3">
                  <button onClick={()=>setShowDriverForm(false)} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Cancel</button>
                  <button onClick={saveDriver} disabled={loading} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    {loading?'Saving…':(editDriverId?'Update Driver':'Register Driver')}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['SAP','Full Name','Company','Shift','Track','Status','Actions'].map(h=>(
                      <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {allDrivers.map(d=>(
                    <tr key={d._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-purple-400 text-xs">{d.sapNumber}</td>
                      <td className="px-4 py-3 text-white font-medium">{d.fullName}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.company?.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.shiftType}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{d.logisticsTrack}{d.convoyConfig&&<span className="ml-1 text-gray-600">({d.convoyConfig})</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.isActive?'bg-emerald-500/10 text-emerald-400':'bg-gray-700 text-gray-500'}`}>
                          {d.isActive?'Active':'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={()=>openEditDriver(d)} className={`${BTN_SM} bg-blue-600/20 text-blue-400 hover:bg-blue-600/40`}>Edit</button>
                          <button onClick={()=>deleteDriver(d._id,d.fullName)} className={`${BTN_SM} bg-red-600/20 text-red-400 hover:bg-red-600/40`}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allDrivers.length===0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-gray-600 text-center">No drivers yet. Add companies first, then register drivers.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TEST RECORDS ═══ */}
        {tab==='tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Global Test Records</h2>
              <button onClick={exportCSV} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Export All CSV
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Date','Driver','Company','S1','S2','Mean RT','Lapses','F.Starts','Status'].map(h=>(
                      <th key={h} className="text-left text-gray-500 uppercase text-xs tracking-wide font-semibold px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {allTests.map(t=>(
                    <tr key={t._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(t.testedAt).toLocaleString()}</td>
                      <td className="px-4 py-3"><p className="text-white">{t.driver?.fullName}</p><p className="text-gray-500 text-xs font-mono">{t.driver?.sapNumber}</p></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.company?.name}</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage1?.passed?'text-emerald-400':'text-red-400'}`}>{t.stage1?.passed?'P':'F'}</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage2?.passed?'text-emerald-400':'text-red-400'}`}>{t.stage2?.passed?'P':'F'}</td>
                      <td className="px-4 py-3 font-mono text-white text-xs">{t.stage3?.meanRT?.toFixed(0)}ms</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.lapses>=3?'text-red-400':t.stage3?.lapses>0?'text-amber-400':'text-gray-500'}`}>{t.stage3?.lapses}</td>
                      <td className={`px-4 py-3 font-bold text-xs ${t.stage3?.falseStarts>=2?'text-red-400':t.stage3?.falseStarts>0?'text-amber-400':'text-gray-500'}`}>{t.stage3?.falseStarts}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.overallStatus]}`}>{t.overallStatus?.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                  {allTests.length===0 && <tr><td colSpan={9} className="px-4 py-8 text-gray-600 text-center">No test records yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
