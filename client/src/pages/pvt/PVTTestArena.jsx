import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { pvtApi, pvtGuestApi } from '../../api/pvt';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rand6 = () => Array.from({length:6}, () => Math.floor(Math.random()*10)).join('');
const rand4 = () => {
  const digits = [0,1,2,3,4,5,6,7,8,9].sort(() => Math.random()-.5).slice(0,4);
  return digits.sort(() => Math.random()-.5).join('');
};
const ascending = (str) => str.split('').sort((a,b)=>a-b).join('');
const median = (arr) => {
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length%2===0 ? (s[m-1]+s[m])/2 : s[m];
};
const fmtDateTime = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
};
function computeStatus(s1Pass, s2Pass, meanRT, lapses, falseStarts, t) {
  if ((!s1Pass && !s2Pass) || meanRT >= t.meanRtFail || lapses >= t.maxLapses || falseStarts >= t.maxFalseStarts) return 'HIGH_RISK';
  return 'LOW_RISK';
}
const TOTAL_TRIALS = 10;
const DEFAULT_THRESHOLDS = { meanRtFail:560, lapseRt:560, maxLapses:3, falseStartRt:100, maxFalseStarts:2, normalRt:350 };

// ─── Status UI config ──────────────────────────────────────────
const statusConfig = {
  LOW_RISK:      { label:'ТЭНЦСЭН',      color:'text-emerald-400', bg:'bg-emerald-500/10', border:'border-emerald-500/40', badge:'bg-emerald-600' },
  HIGH_RISK:     { label:'ТЭНЦЭХГҮЙ',    color:'text-red-400',     bg:'bg-red-500/10',     border:'border-red-500/40',     badge:'bg-red-600' },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function PVTTestArena({ guest = false }) {
  const navigate = useNavigate();
  const { worker, logout } = useAuth();

  // Guest mode: person takes the test with only a SAP number, no account needed
  const [guestSap, setGuestSap] = useState('');

  // Derive display names from worker (registered) or the entered SAP (guest)
  const driverName  = guest ? (guestSap ? `SAP: ${guestSap}` : '') : (worker ? `${worker.firstName} ${worker.lastName}` : '');
  const companyName = guest ? '' : (worker?.company?.name || '');

  // stage: 'sap_entry' | 'shift_select' | 'welcome' | 'stage1_show' | 'stage1_input' | 'stage1_result'
  //      | 'stage2_show' | 'stage2_input' | 'stage2_result'
  //      | 'stage3_idle' | 'stage3_armed' | 'stage3_running' | 'stage3_recovery' | 'stage3_done'
  //      | 'final_results' | 'submitted'
  const [stage,   setStage]   = useState(guest ? 'sap_entry' : 'shift_select');
  const [testShift, setTestShift]   = useState('');
  const [shiftMain, setShiftMain]   = useState('');   // Өдөр | Шөнө | Цуваа
  const [countdown, setCd]    = useState(5);

  // Stage 1
  const [s1Digit, setS1Digit]   = useState('');
  const [s1Input, setS1Input]   = useState('');
  const [s1Pass,  setS1Pass]    = useState(false);

  // Stage 2
  const [s2Digit, setS2Digit]   = useState('');
  const [s2Input, setS2Input]   = useState('');
  const [s2Pass,  setS2Pass]    = useState(false);

  // Stage 3
  const [trialIndex, setTrialIndex] = useState(0);
  const [trials, setTrials]         = useState([]);   // { rt, isFalseStart, isLapse }
  const [lastRT, setLastRT]         = useState(null);
  const [pvtStats, setPvtStats]     = useState(null);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  // Final
  const [finalStatus, setFinalStatus] = useState(null);
  const [completedAt, setCompletedAt] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  const timerRef   = useRef(null);
  const startRef   = useRef(null); // performance.now() when green shows
  const cdRef      = useRef(null);

  // Guard: redirect if not logged in as worker (skip in guest mode)
  useEffect(() => {
    if (!guest && !worker) navigate('/login');
  }, [guest, worker, navigate]);

  // Load admin-configured scoring thresholds (falls back to defaults)
  useEffect(() => {
    pvtGuestApi.get('/settings')
      .then(({ data }) => setThresholds(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearInterval(cdRef.current);
  }, []);

  // ── Stage 1 ──────────────────────────────────────────────────────────────
  function startStage1() {
    const d = rand6(); setS1Digit(d);
    setStage('stage1_show'); setCd(5);
    let c = 5;
    cdRef.current = setInterval(() => {
      c--; setCd(c);
      if (c === 0) {
        clearInterval(cdRef.current);
        setStage('stage1_input');
      }
    }, 1000);
  }

  function submitS1() {
    const passed = s1Input.trim() === s1Digit;
    setS1Pass(passed);
    setStage('stage1_result');
  }

  // ── Stage 2 ──────────────────────────────────────────────────────────────
  function startStage2() {
    const d = rand4(); setS2Digit(d);
    setS2Input('');
    setStage('stage2_show'); setCd(5);
    let c = 5;
    cdRef.current = setInterval(() => {
      c--; setCd(c);
      if (c === 0) {
        clearInterval(cdRef.current);
        setStage('stage2_input');
      }
    }, 1000);
  }

  function submitS2() {
    const expected = ascending(s2Digit);
    const passed = s2Input.trim() === expected;
    setS2Pass(passed);
    setStage('stage2_result');
  }

  // ── Stage 3 ──────────────────────────────────────────────────────────────
  function startStage3() {
    setTrialIndex(0); setTrials([]);
    setStage('stage3_idle');
    setTimeout(() => armNextTrial([]), 800);
  }

  const armNextTrial = useCallback((currentTrials) => {
    setStage('stage3_armed');
    const delay = 2000 + Math.random() * 5000; // 2-7s
    timerRef.current = setTimeout(() => {
      startRef.current = window.performance.now();
      setStage('stage3_running');
    }, delay);
  }, []);

  function handlePVTClick(currentTrials) {
    const now = window.performance.now();
    if (stage === 'stage3_armed') {
      // False start — clicked before green
      const newTrial = { rt: 0, isFalseStart: true, isLapse: false };
      clearTimeout(timerRef.current);
      const updated = [...currentTrials, newTrial];
      setTrials(updated); setLastRT('FALSE START');
      advanceTrial(updated);
    } else if (stage === 'stage3_running') {
      const rt = now - startRef.current;
      const isFalseStart = rt < thresholds.falseStartRt;
      const isLapse = rt >= thresholds.lapseRt;
      const newTrial = { rt: Math.round(rt), isFalseStart, isLapse };
      const updated = [...currentTrials, newTrial];
      setTrials(updated);
      setLastRT(isFalseStart ? 'FALSE START' : Math.round(rt));
      advanceTrial(updated);
    }
  }

  function advanceTrial(updated) {
    setStage('stage3_recovery');
    if (updated.length >= TOTAL_TRIALS) {
      // All done — compute stats
      setTimeout(() => finishStage3(updated), 1200);
    } else {
      setTrialIndex(updated.length);
      setTimeout(() => armNextTrial(updated), 1200);
    }
  }

  function finishStage3(finalTrials) {
    const valid = finalTrials.filter(t => !t.isFalseStart && t.rt > 0).map(t => t.rt);
    const meanRT   = valid.length ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 999;
    const medianRT = valid.length ? Math.round(median(valid)) : 999;
    const lapses      = finalTrials.filter(t => t.isLapse).length;
    const falseStarts = finalTrials.filter(t => t.isFalseStart).length;
    const stats = { meanRT, medianRT, lapses, falseStarts };
    setPvtStats(stats);
    const status = computeStatus(s1Pass, s2Pass, meanRT, lapses, falseStarts, thresholds);
    setFinalStatus(status);
    setCompletedAt(new Date());
    setStage('final_results');
    // Auto-submit — pass all values directly to avoid stale closure issues
    doSubmit(s1Digit, s1Input, s1Pass, s2Digit, s2Input, s2Pass, finalTrials, stats);
  }

  // ── Submit to backend (called automatically) ──────────────────────────────
  async function doSubmit(sd1, si1, p1, sd2, si2, p2, finalTrials, stats) {
    setSubmitting(true); setSubmitError('');
    try {
      const payload = {
        stage1: { shownSequence: sd1, enteredSequence: si1, passed: p1 },
        stage2: { shownNumber:   sd2, enteredSequence: si2, passed: p2 },
        stage3: {
          trials: finalTrials.map(t => ({
            reactionTime: t.rt,
            isFalseStart: t.isFalseStart,
            isLapse:      t.isLapse
          })),
          ...stats
        },
        testShift
      };
      if (guest) {
        await pvtGuestApi.post('/tests/guest', { ...payload, sapId: guestSap });
      } else {
        await pvtApi.post('/tests', payload);
      }
      setStage('submitted');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      setSubmitError(`Илгээхэд алдаа: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  const trialsRef = useRef(trials);
  useEffect(() => { trialsRef.current = trials; }, [trials]);

  const sc = finalStatus ? statusConfig[finalStatus] : null;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col bg-[#0b0f14] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),_transparent_55%)] text-gray-100"
      onClick={['stage3_armed','stage3_running'].includes(stage) ? () => handlePVTClick(trialsRef.current) : undefined}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 sm:h-16 border-b border-white/5 bg-gray-900/60 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
            </svg>
          </div>
          <div className="leading-tight min-w-0">
            <span className="block text-white font-semibold text-sm sm:text-base tracking-tight truncate">FleetGuard PVT</span>
            <span className="hidden sm:block text-gray-500 text-xs">Сэргэг байдлын шалгалт</span>
          </div>
        </div>
        <div className="text-right min-w-0">
          <p className="text-white text-sm sm:text-base font-medium truncate">{driverName}</p>
          <p className="text-emerald-400 text-xs sm:text-sm truncate">{companyName}</p>
        </div>
      </div>

      {/* Stage progress stepper */}
      <div className="flex justify-center px-4 py-5 sm:py-6 bg-gray-900/30 border-b border-white/5">
        <div className="flex items-center w-full max-w-2xl">
          {['Санах ой','Эрэмбэлэлт','Хурд'].map((lbl, i) => {
            const stageNums  = ['stage1', 'stage2', 'stage3'];
            const isCurrent  = stage.startsWith(stageNums[i]);
            const isDone     = (i===0 && (stage.startsWith('stage2')||stage.startsWith('stage3')||stage==='final_results'||stage==='submitted'))
                             || (i===1 && (stage.startsWith('stage3')||stage==='final_results'||stage==='submitted'))
                             || (i===2 && (stage==='final_results'||stage==='submitted'));
            return (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ring-4
                    ${isCurrent ? 'bg-emerald-500 text-white ring-emerald-500/20'
                    : isDone    ? 'bg-emerald-600/80 text-white ring-transparent'
                    :             'bg-gray-800 text-gray-500 ring-transparent'}`}>
                    {isDone ? '✓' : i+1}
                  </span>
                  <span className={`text-xs font-medium whitespace-nowrap transition-colors
                    ${isCurrent ? 'text-emerald-300' : isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                    {lbl}
                  </span>
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 mx-1 sm:mx-2 -mt-6 rounded-full transition-colors duration-300
                    ${isDone ? 'bg-emerald-600/70' : 'bg-gray-800'}`}/>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:p-6">

        {/* ─── SAP entry (guest mode) ─── */}
        {stage === 'sap_entry' && (
          <div className="w-full max-w-sm">
            <div className="bg-gray-900/50 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/30 backdrop-blur-sm space-y-6 text-center">
              <div>
                <p className="text-emerald-400 uppercase text-sm tracking-[0.2em] font-bold mb-2">Бүртгэлгүй шалгалт</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">SAP дугаараа оруулна уу</h2>
              </div>
              <input
                type="text" inputMode="numeric" value={guestSap}
                onChange={e => setGuestSap(e.target.value.trim())}
                onKeyDown={e => { if (e.key === 'Enter' && guestSap.trim()) setStage('shift_select'); }}
                placeholder="SAP дугаар"
                className="w-full bg-gray-900 border-2 border-gray-700 text-white text-center text-2xl sm:text-3xl font-mono tracking-widest rounded-2xl py-5 focus:outline-none focus:border-emerald-500 placeholder-gray-700"
                autoFocus
              />
              <button onClick={() => setStage('shift_select')} disabled={!guestSap.trim()}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]">
                Үргэлжлүүлэх
              </button>
              <button onClick={() => navigate('/login')}
                className="block w-full text-gray-500 hover:text-gray-300 text-sm transition-colors">
                ← Буцах
              </button>
            </div>
          </div>
        )}

        {/* ─── Ээлж сонгох ─── */}
        {stage === 'shift_select' && (
          <div className="w-full max-w-sm">
            <div className="bg-gray-900/50 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/30 backdrop-blur-sm">
            {shiftMain === '' ? (
              /* Step 1: Choose main shift type */
              <div className="space-y-7 text-center">
                <div>
                  <p className="text-emerald-400 uppercase text-sm tracking-[0.2em] font-bold mb-2">Өнөөдөрийн ээлж</p>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Ээлжээ сонгоно уу</h2>
                </div>
                <div className="space-y-3">
                  {['\u04e8\u0434\u04e9\u0440', '\u0428\u04e9\u043d\u04e9', '\u0426\u0443\u0432\u0430\u0430'].map(s => (
                    <button key={s}
                      onClick={() => {
                        if (s === '\u0426\u0443\u0432\u0430\u0430') { setShiftMain('\u0426\u0443\u0432\u0430\u0430'); }
                        else { setTestShift(s); setStage('welcome'); }
                      }}
                      className="w-full py-5 bg-gray-800/80 hover:bg-emerald-600 border border-white/10 hover:border-emerald-500 text-white text-lg font-bold rounded-2xl transition-all duration-150 active:scale-[0.98] shadow-sm">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Step 2: Choose convoy number */
              <div className="space-y-7 text-center">
                <div>
                  <button onClick={() => setShiftMain('')}
                    className="text-gray-500 hover:text-gray-300 text-sm mb-4 flex items-center gap-1 transition-colors">
                    ← Буцах
                  </button>
                  <p className="text-emerald-400 uppercase text-sm tracking-[0.2em] font-bold mb-2">Цуваа дугаар</p>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Цуваагаа сонгоно уу</h2>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[1,2,3,4,5,6,7].map(n => (
                    <button key={n}
                      onClick={() => { setTestShift(`\u0426\u0443\u0432\u0430\u0430-${n}`); setStage('welcome'); }}
                      className="py-5 bg-gray-800/80 hover:bg-emerald-600 border border-white/10 hover:border-emerald-500 text-white text-xl font-black rounded-2xl transition-all duration-150 active:scale-[0.95] shadow-sm">
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ─── Welcome ─── */}
        {stage === 'welcome' && (
          <div className="text-center max-w-xl space-y-6 sm:space-y-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">Сэргэг Байдлын Шалгалт</h2>
            <p className="text-gray-300 text-lg sm:text-xl leading-relaxed">
              Та <span className="text-white font-semibold">гурван дараалсан шат</span> дуусгах шаардлагатай:
              санах ойн шалгалт, тоо эрэмбэлэлт, болон үйлдэл хийх хурдны шалгалт (10 удаа).
              Үргэлжлүүлэхийн өмнө заавар бүрийг анхааралтай уншина уу.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-left">
              <p className="text-amber-300 text-base sm:text-lg font-bold mb-2">⚠ Анхаарал</p>
              <p className="text-amber-200/80 text-base sm:text-lg leading-relaxed">
                Гурван шатыг тасалдалгүй дуусгана уу.
              </p>
            </div>
            <button onClick={startStage1}
              className="w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-lg sm:text-xl transition-colors shadow-lg shadow-emerald-500/20 active:scale-[0.98]">
              Шалгалт эхлэх
            </button>
          </div>
        )}

        {/* ─── Stage 1: Show digits ─── */}
        {stage === 'stage1_show' && (
          <div className="text-center space-y-6 sm:space-y-8 w-full">
            <p className="text-emerald-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">1-р шат — Санах ойн шалгалт</p>
            <p className="text-gray-200 text-xl sm:text-2xl font-medium px-2">Дарааллыг цээжлэ. <span className="text-white font-bold">{countdown}с</span>-ийн дараа алга болно.</p>
            <div className="bg-gray-900 border border-emerald-500/40 rounded-3xl px-4 sm:px-14 py-8 sm:py-10 shadow-lg shadow-emerald-500/5">
              <p className="text-6xl sm:text-8xl font-mono font-black tracking-[0.15em] sm:tracking-[0.3em] text-emerald-400 select-none">{s1Digit}</p>
            </div>
            <div className="flex gap-2 justify-center">
              {[...Array(5)].map((_,i) => (
                <div key={i} className={`h-2 w-8 sm:w-10 rounded-full transition-all duration-1000
                  ${i < countdown ? 'bg-emerald-500' : 'bg-gray-700'}`}/>
              ))}
            </div>
          </div>
        )}

        {/* ─── Stage 1: Input ─── */}
        {stage === 'stage1_input' && (
          <div className="text-center space-y-6 sm:space-y-8 w-full max-w-md">
            <p className="text-emerald-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">1-р шат — Санан бич</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">Харсан 6 оронтой дарааллыг бич</p>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={s1Input}
              onChange={e => setS1Input(e.target.value.replace(/\D/g,''))}
              placeholder="_ _ _ _ _ _"
              className="w-full bg-gray-900 border-2 border-gray-700 text-white text-center text-4xl sm:text-5xl font-mono tracking-[0.2em] sm:tracking-[0.4em] rounded-2xl py-6 sm:py-7 focus:outline-none focus:border-emerald-500 placeholder-gray-700"
              autoFocus
            />
            <button onClick={submitS1} disabled={s1Input.length !== 6}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]">
              Дараалал баталгаажуулах
            </button>
          </div>
        )}

        {/* ─── Stage 1: Result ─── */}
        {stage === 'stage1_result' && (
          <div className="text-center space-y-6 w-full max-w-md">
            <p className="text-emerald-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">1-р шат — Үр дүн</p>
            <div className={`rounded-2xl border p-5 sm:p-6 ${s1Pass ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
              <p className={`text-4xl sm:text-5xl font-black mb-2 ${s1Pass ? 'text-emerald-400' : 'text-red-400'}`}>
                {s1Pass ? 'ТЭНЦСЭН' : 'ТЭНЦСЭНГҮЙ'}
              </p>
              <p className="text-gray-300 text-base">
                Харуулсан: <span className="font-mono text-white tracking-widest">{s1Digit}</span>
                &nbsp;|&nbsp; Оруулсан: <span className="font-mono text-white tracking-widest">{s1Input}</span>
              </p>
            </div>
            <button onClick={startStage2}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
              2-р шат руу үргэлжлэх →
            </button>
          </div>
        )}

        {/* ─── Stage 2: Show ─── */}
        {stage === 'stage2_show' && (
          <div className="text-center space-y-6 sm:space-y-8 w-full">
            <p className="text-blue-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">2-р шат — Эрэмбэлэлтийн хурд</p>
            <p className="text-gray-200 text-xl sm:text-2xl font-medium px-2">Тоонуудыг цээжлэ. Өсөх дарааллаар эрэмбэлэх ёстой. <span className="text-white font-bold">{countdown}с</span>-ийн дараа алга болно.</p>
            <div className="bg-gray-900 border border-blue-500/40 rounded-3xl px-4 sm:px-14 py-8 sm:py-10">
              <p className="text-6xl sm:text-8xl font-mono font-black tracking-[0.15em] sm:tracking-[0.4em] text-blue-400 select-none">{s2Digit}</p>
            </div>
            <div className="flex gap-2 justify-center">
              {[...Array(5)].map((_,i) => (
                <div key={i} className={`h-2 w-8 sm:w-10 rounded-full transition-all duration-1000
                  ${i < countdown ? 'bg-blue-500' : 'bg-gray-700'}`}/>
              ))}
            </div>
          </div>
        )}

        {/* ─── Stage 2: Input ─── */}
        {stage === 'stage2_input' && (
          <div className="text-center space-y-6 sm:space-y-8 w-full max-w-md">
            <p className="text-blue-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">2-р шат — Өсөх дарааллаар эрэмбэлэх</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">Тоонуудыг хамгийн бага → хамгийн их дарааллаар бич</p>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={s2Input}
              onChange={e => setS2Input(e.target.value.replace(/\D/g,''))}
              placeholder="e.g. 1348"
              className="w-full bg-gray-900 border-2 border-gray-700 text-white text-center text-4xl sm:text-5xl font-mono tracking-[0.2em] sm:tracking-[0.4em] rounded-2xl py-6 sm:py-7 focus:outline-none focus:border-blue-500 placeholder-gray-700"
              autoFocus
            />
            <button onClick={submitS2} disabled={s2Input.length !== 4}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
              Эрэмбэлэсэн дараалал баталгаажуулах
            </button>
          </div>
        )}

        {/* ─── Stage 2: Result ─── */}
        {stage === 'stage2_result' && (
          <div className="text-center space-y-6 w-full max-w-md">
            <p className="text-blue-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">2-р шат — Үр дүн</p>
            <div className={`rounded-2xl border p-5 sm:p-6 ${s2Pass ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
              <p className={`text-4xl sm:text-5xl font-black mb-2 ${s2Pass ? 'text-emerald-400' : 'text-red-400'}`}>
                {s2Pass ? 'ТЭНЦСЭН' : 'ТЭНЦСЭНГҮЙ'}
              </p>
              <p className="text-gray-300 text-base">
                Харуулсан: <span className="font-mono text-white">{s2Digit}</span>
                &nbsp;→ Хүлээгдэж байгаа: <span className="font-mono text-white">{ascending(s2Digit)}</span>
                &nbsp;| Оруулсан: <span className="font-mono text-white">{s2Input}</span>
              </p>
            </div>
            <button onClick={startStage3}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]">
              3-р шат — Үйлдэл хийх хурдны шалгалт руу →
            </button>
          </div>
        )}

        {/* ─── Stage 3 ─── */}
        {['stage3_idle','stage3_armed','stage3_running','stage3_recovery'].includes(stage) && (
          <div className="text-center w-full max-w-md space-y-6 select-none">
            <p className="text-purple-400 uppercase text-sm sm:text-base tracking-[0.2em] font-bold">
              3-р шат — Үйлдэл хийх хурд &nbsp;|&nbsp; Туршилт {trialIndex+1} / {TOTAL_TRIALS}
            </p>

            {/* Reaction pad */}
            <div
              className={`w-full aspect-square max-w-[17rem] sm:max-w-xs mx-auto rounded-3xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-150 shadow-2xl px-4
                ${stage==='stage3_idle'     ? 'bg-gray-800 border-gray-700'
                : stage==='stage3_armed'    ? 'bg-gray-900 border-amber-500/50 shadow-amber-500/10'
                : stage==='stage3_running'  ? 'bg-emerald-500 border-emerald-400 shadow-emerald-500/40 scale-[1.02]'
                :                             'bg-gray-800 border-gray-700'}`}
            >
              {stage==='stage3_idle' && <p className="text-gray-500 text-lg sm:text-xl font-medium">Бэлтгэж байна...</p>}
              {stage==='stage3_armed' && (
                <>
                  <p className="text-amber-400 text-xl sm:text-2xl font-black">НОГООН ГЭРЛИЙГ ХҮЛЭЭ</p>
                  <p className="text-gray-300 text-base sm:text-lg mt-3 px-2">Ногоон болмогц аль болох хурдан дарна уу</p>
                </>
              )}
              {stage==='stage3_running' && (
                <>
                  <p className="text-white text-5xl sm:text-6xl font-black drop-shadow-lg">ДАРНА УУ!</p>
                  <p className="text-emerald-100 text-base sm:text-lg mt-3 font-medium">Хаана ч дарна уу</p>
                </>
              )}
              {stage==='stage3_recovery' && (
                <div className="text-center">
                  <p className={`text-3xl sm:text-4xl font-black
                    ${lastRT==='FALSE START' ? 'text-red-400'
                    : typeof lastRT==='number' && lastRT>=thresholds.lapseRt ? 'text-amber-400'
                    : 'text-white'}`}>
                    {lastRT === 'FALSE START' ? '⚡ ТҮРҮҮЛЖ ДАРСАН' : `${lastRT}мс`}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">Дараагийн туршилт...</p>
                </div>
              )}
            </div>

            {/* Trial dots */}
            <div className="flex gap-2 justify-center flex-wrap">
              {Array.from({length:TOTAL_TRIALS}).map((_,i) => {
                const t = trials[i];
                return (
                  <div key={i} className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold
                    ${!t ? 'bg-gray-800 border border-gray-700'
                    : t.isFalseStart ? 'bg-red-500 text-white'
                    : t.isLapse      ? 'bg-amber-500 text-white'
                    :                  'bg-emerald-500 text-white'}`}>
                    {t ? (t.isFalseStart ? '!' : '✓') : i+1}
                  </div>
                );
              })}
            </div>
            <p className="text-gray-400 text-sm">🔴 Түрүүлж дарсан &nbsp;|&nbsp; 🟡 Хоцролт (≥{thresholds.lapseRt}мс) &nbsp;|&nbsp; 🟢 Амжилттай</p>
          </div>
        )}

        {/* ─── Final Results ─── */}
        {(stage==='final_results'||stage==='submitted') && sc && pvtStats && (
          <div className="w-full max-w-lg space-y-4 pb-6">

            {/* Header label */}
            <p className="text-center text-gray-400 uppercase text-xs tracking-widest font-semibold">
              Шалгалт дууссан — Эцсийн дүн
            </p>

            {/* Main status card */}
            <div className={`rounded-2xl border-2 p-6 sm:p-8 text-center ${sc.bg} ${sc.border}`}>
              <div className="text-5xl mb-3">
                {finalStatus==='LOW_RISK' ? '✅' : '🚫'}
              </div>
              <p className={`text-2xl sm:text-3xl font-black ${sc.color}`}>{sc.label}</p>
              <div className="mt-5 pt-4 border-t border-white/10 flex flex-col items-center gap-1">
                <p className="text-white font-bold text-lg">{driverName}</p>
                <p className="text-gray-400 text-sm">{companyName}</p>
                {completedAt && (
                  <p className="text-gray-400 text-sm font-mono mt-0.5">🕒 {fmtDateTime(completedAt)}</p>
                )}
                {testShift && (
                  <span className="mt-1 text-xs font-semibold px-3 py-1 bg-white/10 rounded-full text-gray-300">
                    Ээлж: {testShift}
                  </span>
                )}
              </div>
            </div>

            {/* Stage 1 & 2 results */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { num:'1', title:'Санах ойн шалгалт', pass: s1Pass },
                { num:'2', title:'Эрэмбэлэлт', pass: s2Pass },
              ].map(s => (
                <div key={s.num}
                  className={`rounded-xl border p-4 ${s.pass ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p className="text-gray-500 text-xs mb-2">{s.num}-р шат · {s.title}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl ${s.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.pass ? '✓' : '✗'}
                    </span>
                    <p className={`text-base font-black ${s.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.pass ? 'Тэнцсэн' : 'Тэнцсэнгүй'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stage 3 — reaction stats */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-4">3-р шат · Үйлдэл хийх хурд</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  { label:'Дундаж хурд', value:`${pvtStats.meanRT}`, unit:'мс',
                    sub: pvtStats.meanRT<thresholds.normalRt ? '● Хэвийн' : pvtStats.meanRT<thresholds.meanRtFail ? '● Сануулга' : '● Удаан',
                    color: pvtStats.meanRT<thresholds.normalRt?'text-emerald-400':pvtStats.meanRT<thresholds.meanRtFail?'text-amber-400':'text-red-400' },
                  { label:'Голч хурд', value:`${pvtStats.medianRT}`, unit:'мс', sub:'', color:'text-white' },
                  { label:'Хоцролт', value:`${pvtStats.lapses}`, unit:'удаа', sub:`≥${thresholds.lapseRt}мс`,
                    color: pvtStats.lapses===0?'text-emerald-400':pvtStats.lapses<thresholds.maxLapses?'text-amber-400':'text-red-400' },
                  { label:'Түрүүлж дарсан', value:`${pvtStats.falseStarts}`, unit:'удаа', sub:`<${thresholds.falseStartRt}мс`,
                    color: pvtStats.falseStarts===0?'text-emerald-400':pvtStats.falseStarts<thresholds.maxFalseStarts?'text-amber-400':'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-start justify-between border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-gray-400 text-xs font-medium">{s.label}</p>
                      {s.sub && <p className={`text-xs mt-0.5 ${s.color} opacity-70`}>{s.sub}</p>}
                    </div>
                    <p className={`text-2xl font-black ${s.color}`}>
                      {s.value}<span className="text-sm font-normal ml-0.5 opacity-70">{s.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trial visual summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                <p className="text-gray-500 text-xs uppercase tracking-wide">10 туршилтын тойм</p>
                <div className="flex gap-3 text-xs text-gray-600">
                  <span>🔴 Түрүүлсэн</span>
                  <span>🟡 Хоцорсон</span>
                  <span>🟢 Хэвийн</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {trials.map((t, i) => (
                  <div key={i} className={`flex-1 min-w-[24px] sm:min-w-[28px] h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold
                    ${t.isFalseStart ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                    : t.isLapse      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                    :                  'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'}`}>
                    <span>{i+1}</span>
                    <span className="text-[9px] opacity-70">{t.isFalseStart ? '!' : t.rt+'м'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit state */}
            {stage === 'final_results' && (
              submitting ? (
                <div className="flex items-center justify-center gap-2 text-gray-400 py-2">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm">Үр дүнг илгээж байна...</span>
                </div>
              ) : submitError ? (
                <div className="space-y-3 text-center">
                  <p className="text-red-400 text-sm">{submitError}</p>
                  <button onClick={() => doSubmit(s1Digit, s1Input, s1Pass, s2Digit, s2Input, s2Pass, trials, pvtStats)}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors">
                    Дахин оролдох
                  </button>
                  <button onClick={() => navigate('/')}
                    className="block w-full py-3 text-gray-500 hover:text-gray-300 text-sm transition-colors">
                    Гарах
                  </button>
                </div>
              ) : null
            )}

            {stage === 'submitted' && (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-emerald-400 font-semibold text-lg">✓ Үр дүн амжилттай хадгалагдлаа</p>
                  <p className="text-gray-500 text-sm mt-1">Та шалгалтаа дуусгалаа</p>
                </div>
                <button onClick={() => navigate('/')}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-2xl transition-colors flex items-center justify-center gap-2">
                  <span>🏠</span> Нүүр хуудас руу буцах
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
