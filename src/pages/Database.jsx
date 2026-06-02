import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function Database() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // 🛑 RBAC (Role-Based Access Control)
  const userRole = localStorage.getItem('userRole') || 'BME';
  const isAdmin = userRole === 'Admin';

  // 🎯 TARGET TRACKER STATE
  const [targetTurnover, setTargetTurnover] = useState(150000000);

  // 🏃 DYNAMIC RUNNER STATE
  const [runnerSpeed, setRunnerSpeed] = useState(0.4);
  const runnerRef = useRef(null);

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  const fetchDatabaseData = async () => {
    setIsLoading(true);

    try {
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'yearly_target')
        .single();

      if (settingsData) {
        setTargetTurnover(Number(settingsData.value));
      }

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uniqueLeads = data.filter(
        (lead, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.name?.toLowerCase() === lead.name?.toLowerCase() &&
              t.requirement?.toLowerCase() ===
                lead.requirement?.toLowerCase()
          )
      );

      setLeads(uniqueLeads);
    } catch (err) {
      console.error('Error fetching data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ⚡ AUTO SAVE TARGET
  const handleTargetBlur = async (e) => {
    const val = e.target.value;
    setTargetTurnover(val);

    try {
      await supabase
        .from('settings')
        .upsert({ key: 'yearly_target', value: val });
    } catch (err) {
      console.error('Failed to save target:', err.message);
    }
  };

  // 🧨 PURGE LOGIC (Admin Only)
  const handleWipeDatabase = async () => {
    const confirmText = window.prompt(
      "⚠️ Type 'DELETE' to confirm full database wipe:"
    );

    if (confirmText !== 'DELETE') return;

    try {
      setIsWiping(true);
      await supabase.from('leads').delete().not('id', 'is', null);
      alert('✅ Database successfully wiped.');
      fetchDatabaseData();
      setShowAdmin(false);
    } catch (err) {
      alert('❌ Failed to wipe database.');
    } finally {
      setIsWiping(false);
    }
  };

  // 🖱️ CURSOR PROXIMITY HANDLER FOR RUNNER
  const handleRunnerMouseMove = (e) => {
    const runnerEl = runnerRef.current;
    if (!runnerEl) return;

    const runnerRect = runnerEl.getBoundingClientRect();
    const runnerCenter = {
      x: runnerRect.left + runnerRect.width / 2,
      y: runnerRect.top + runnerRect.height / 2,
    };

    const dist = Math.hypot(e.clientX - runnerCenter.x, e.clientY - runnerCenter.y);

    // Map distance (0–400px) to animation duration (0.1s fast → 0.8s slow)
    const maxDist = 400;
    const fastSpeed = 0.1;
    const slowSpeed = 0.8;
    const t = Math.min(dist, maxDist) / maxDist;
    const newSpeed = fastSpeed + t * (slowSpeed - fastSpeed);

    setRunnerSpeed(newSpeed);
  };

  // ==========================================
  // 📊 ANALYTICS CALCULATIONS
  // ==========================================

  const activeLeads = leads.filter((l) => l.status !== 'Closed - Lost');

  const dealsWonValue = leads
    .filter((l) => l.status === 'Closed - Won')
    .reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);

  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);

  const hotPipelineValue = activeLeads
    .filter((l) => l.lead_temp === 'Hot')
    .reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const hotPipelineCount = activeLeads.filter((l) => l.lead_temp === 'Hot').length;

  const warmPipelineValue = activeLeads
    .filter((l) => l.lead_temp === 'Warm')
    .reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const warmPipelineCount = activeLeads.filter((l) => l.lead_temp === 'Warm').length;

  const coldPipelineValue = activeLeads
    .filter((l) => l.lead_temp === 'Cold' || !l.lead_temp)
    .reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const coldPipelineCount = activeLeads.filter((l) => l.lead_temp === 'Cold' || !l.lead_temp).length;

  const pieData = [
    { name: '🔥 Hot Deals', value: hotPipelineCount, color: '#e11d48' },
    { name: '🌡️ Warm Deals', value: warmPipelineCount, color: '#f59e0b' },
    { name: '❄️ Cold Deals', value: coldPipelineCount, color: '#0284c7' }
  ].filter((d) => d.value > 0);

  // 🎯 ACHIEVEMENT %
  const achievementPercentage = targetTurnover > 0 ? Math.min((dealsWonValue / targetTurnover) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans">

      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[140px] pointer-events-none"></div>

      {/* CSS ANIMATIONS */}
      <style>{`
        @keyframes gridScrollFast {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 0 60px, 0 0; }
        }
        @keyframes gridScrollSlow {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 0 20px, 0 0; }
        }
        @keyframes runBounce {
          0%, 100% { transform: translateY(0) rotate(4deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
        @keyframes motionTrail {
          0% { opacity: 0.6; transform: scale(1) translateX(0); }
          100% { opacity: 0; transform: scale(0.9) translateX(-40px); }
        }
        @keyframes lightSpeed {
          0% { transform: translateX(100vw); opacity: 1; }
          100% { transform: translateX(-100vw); opacity: 0.2; }
        }
        @keyframes auraPulse {
          0%, 100% { transform: scale(0.9); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0.1; }
        }
      `}</style>

      {/* NAVIGATION */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-slate-600 hover:text-purple-900 font-black text-base uppercase tracking-widest transition-colors flex items-center gap-3 bg-white px-6 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Routing
        </button>

        <div className="flex items-center gap-4">
          <button onClick={fetchDatabaseData} className="text-slate-700 hover:text-purple-900 font-black text-sm uppercase px-6 py-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl transition-colors shadow-sm">
            Refresh Data
          </button>

          {isAdmin && (
            <button onClick={() => setShowAdmin(!showAdmin)} className={`font-black text-sm uppercase tracking-widest px-6 py-4 rounded-xl border transition-colors shadow-sm ${showAdmin ? 'bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200' : 'bg-white border-slate-300 text-slate-700 hover:text-purple-900 hover:border-[#EBA7FF]'}`}>
              {showAdmin ? 'Close Admin' : 'Admin Access'}
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="bg-white w-full max-w-[95%] xl:max-w-7xl p-10 relative z-10 flex flex-col gap-10 shadow-2xl shadow-slate-200/60 rounded-3xl border border-slate-300">

        {showAdmin && isAdmin && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
            <div className="flex-1 w-full">
              <h3 className="text-rose-700 font-black text-lg uppercase tracking-widest mb-2 flex items-center gap-3">⚠️ System Purge Protocol</h3>
              <p className="text-rose-600/80 font-medium text-base">Permanently delete all leads from the database. This cannot be undone.</p>
            </div>
            <button onClick={handleWipeDatabase} disabled={isWiping} className="bg-rose-600 hover:bg-rose-700 text-white font-black text-base uppercase tracking-widest px-8 py-4 rounded-xl shadow-md transition-colors whitespace-nowrap">
              {isWiping ? 'Wiping...' : 'PURGE DATABASE'}
            </button>
          </div>
        )}

        {/* HEADER */}
        <div className="border-b border-slate-200 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-center gap-5">
            <h1 className="text-5xl font-black text-slate-900 tracking-tight">
              {isAdmin ? 'CRM Analytics' : 'CRM Dashboard'}
            </h1>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-lg font-mono text-xs font-bold tracking-widest uppercase shadow-sm mt-2 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Live Grid
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-6 text-slate-500 font-bold tracking-widest text-xl uppercase">
            <svg className="w-16 h-16 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Loading Analytics...
          </div>
        ) : !isAdmin ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
            <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center border-4 border-white shadow-md">
              <svg className="w-12 h-12 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <div className="max-w-xl space-y-4">
              <h2 className="text-3xl font-black text-slate-900">Access Restricted</h2>
              <p className="text-lg text-slate-600 font-medium leading-relaxed">
                You are currently logged in as a <strong className="text-purple-700">Business Management Executive (BME)</strong>. Financial overviews and high-level analytics are hidden.
              </p>
            </div>
            <button onClick={() => navigate('/leadmanager')} className="mt-4 bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white font-black text-lg tracking-widest uppercase px-12 py-5 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(235,167,255,0.6)] flex items-center gap-3">
              Open Lead Manager Table
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        ) : (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-slate-500 font-black text-sm uppercase tracking-widest mb-3">Total Pipeline</div>
                <div className="text-4xl font-black text-slate-900 tabular-nums tracking-tight">₹{totalValue.toLocaleString('en-IN')}</div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 transform origin-left group-hover:scale-x-100 transition-transform"></div>
                <div className="flex justify-between items-start mb-3">
                  <p className="text-rose-700 font-black text-sm uppercase tracking-widest">🔥 Hot Pipeline</p>
                  <span className="font-bold text-xs text-rose-500/70 tracking-widest uppercase mt-0.5 bg-white px-2 py-1 rounded-md border border-rose-100">{hotPipelineCount} leads</span>
                </div>
                <p className="text-4xl font-black text-rose-600 tracking-tight tabular-nums">₹{hotPipelineValue.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500 transform origin-left group-hover:scale-x-100 transition-transform"></div>
                <div className="flex justify-between items-start mb-3">
                  <p className="text-amber-700 font-black text-sm uppercase tracking-widest">🌡️ Warm Pipeline</p>
                  <span className="font-bold text-xs text-amber-600/70 tracking-widest uppercase mt-0.5 bg-white px-2 py-1 rounded-md border border-amber-100">{warmPipelineCount} leads</span>
                </div>
                <p className="text-4xl font-black text-amber-600 tracking-tight tabular-nums">₹{warmPipelineValue.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-cyan-500 transform origin-left group-hover:scale-x-100 transition-transform"></div>
                <div className="flex justify-between items-start mb-3">
                  <p className="text-cyan-700 font-black text-sm uppercase tracking-widest">❄️ Cold Pipeline</p>
                  <span className="font-bold text-xs text-cyan-600/70 tracking-widest uppercase mt-0.5 bg-white px-2 py-1 rounded-md border border-cyan-100">{coldPipelineCount} leads</span>
                </div>
                <p className="text-4xl font-black text-cyan-600 tracking-tight tabular-nums">₹{coldPipelineValue.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {pieData.length > 0 && (
              <div className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center h-[550px] relative overflow-hidden shadow-inner">
                <span className="text-slate-600 font-black text-base uppercase tracking-widest mb-6 z-10">Active Lead Temperature Distribution</span>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={130} outerRadius={170} paddingAngle={5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-6xl font-black">{activeLeads.length}</text>
                    <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-sm font-bold uppercase tracking-widest">ACTIVE DEALS</text>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', padding: '12px 20px' }} itemStyle={{ color: '#0f172a' }} />
                    <Legend wrapperStyle={{ fontWeight: 'bold', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ========================================== */}
            {/* DYNAMIC PARALLAX REVENUE TARGET PROGRESS (ENHANCED) */}
            {/* ========================================== */}
            <div
              className="relative overflow-hidden rounded-3xl border-2 border-slate-900 bg-slate-900 shadow-2xl"
              onMouseMove={handleRunnerMouseMove}
              onMouseLeave={() => setRunnerSpeed(0.8)}
            >
              {/* THE PARALLAX ANIMATION BACKGROUND */}
              <div className="absolute inset-0 z-0">
                {/* Deep horizon sky */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-indigo-950"></div>

                {/* Glowing horizon line */}
                <div className="absolute top-[40%] left-0 w-full h-[20%] bg-[#EBA7FF]/30 blur-[40px]"></div>

                {/* SLOW BACKGROUND GRID */}
                <div className="absolute bottom-[20%] left-[-50%] w-[200%] h-[80%]" style={{
                  backgroundImage: `linear-gradient(to bottom, transparent 38px, rgba(126,34,206,0.3) 40px), linear-gradient(to right, transparent 38px, rgba(126,34,206,0.2) 40px)`,
                  backgroundSize: '40px 40px',
                  transform: 'perspective(400px) rotateX(75deg)',
                  transformOrigin: 'top center',
                  animation: 'gridScrollSlow 3s linear infinite'
                }}></div>

                {/* FAST FOREGROUND ROAD GRID */}
                <div className="absolute bottom-[-10%] left-[-50%] w-[200%] h-[70%]" style={{
                  backgroundImage: `linear-gradient(to bottom, transparent 56px, rgba(235,167,255,0.6) 60px), linear-gradient(to right, transparent 56px, rgba(235,167,255,0.4) 60px)`,
                  backgroundSize: '60px 60px',
                  transform: 'perspective(300px) rotateX(75deg)',
                  transformOrigin: 'top center',
                  animation: 'gridScrollFast 0.4s linear infinite',
                  boxShadow: 'inset 0 40px 40px -20px rgba(15,23,42,1)'
                }}></div>

                {/* Speed lines passing by */}
                <div className="absolute top-[45%] w-[200px] h-[2px] bg-white/40 blur-[1px] rounded-full" style={{ animation: 'lightSpeed 1.2s linear infinite' }}></div>
                <div className="absolute top-[55%] w-[300px] h-[3px] bg-[#EBA7FF]/60 blur-[2px] rounded-full" style={{ animation: 'lightSpeed 0.8s linear infinite 0.4s' }}></div>

                {/* AURA BEHIND THE RUNNER */}
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" style={{ width: '120px', height: '120px' }}>
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(235,167,255,0.4) 0%, transparent 70%)',
                      animation: 'auraPulse 1s ease-in-out infinite',
                    }}
                  ></div>
                </div>

                {/* THE RUNNER AND TRAILS */}
                <div
                  ref={runnerRef}
                  className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
                >
                  {/* Trail 1 – primary ghost */}
                  <div className="absolute" style={{ animation: `runBounce ${runnerSpeed}s ease-in-out infinite` }}>
                    <svg
                      className="w-24 h-24 text-[#EBA7FF]"
                      style={{ animation: `motionTrail ${runnerSpeed}s linear infinite` }}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
                    </svg>
                  </div>

                  {/* Trail 2 – offset ghost for continuous blur effect */}
                  <div
                    className="absolute"
                    style={{
                      animation: `runBounce ${runnerSpeed}s ease-in-out infinite`,
                      animationDelay: `${runnerSpeed * 0.5}s`,
                    }}
                  >
                    <svg
                      className="w-24 h-24 text-[#EBA7FF]/70"
                      style={{
                        animation: `motionTrail ${runnerSpeed}s linear infinite`,
                        animationDelay: `${runnerSpeed * 0.5}s`,
                      }}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
                    </svg>
                  </div>

                  {/* Solid front runner */}
                  <svg
                    className="w-24 h-24 text-white relative z-10 drop-shadow-[0_0_25px_rgba(235,167,255,0.9)]"
                    style={{ animation: `runBounce ${runnerSpeed}s ease-in-out infinite` }}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
                  </svg>
                </div>
              </div>

              {/* OVERLAY CONTENT (The Actual Data) */}
              <div className="relative z-30 p-10 bg-gradient-to-t from-slate-900/90 to-transparent pt-40">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                  <div>
                    <p className="text-[#EBA7FF] font-black text-sm tracking-[0.3em] uppercase mb-3 drop-shadow-md">
                      Revenue Target Progress
                    </p>
                    <h2 className="text-7xl font-black text-white tracking-tight drop-shadow-lg">
                      {achievementPercentage.toFixed(1)}%
                    </h2>
                    <p className="text-slate-300 mt-3 text-lg font-bold">
                      Goal accomplishment status
                    </p>
                  </div>

                  <div className="flex flex-col gap-5 w-full md:w-1/2">
                    <div className="flex justify-between text-sm font-black uppercase tracking-widest text-white">
                      <span>Progress</span>
                      <span className="tabular-nums">₹{dealsWonValue.toLocaleString('en-IN')} / ₹{Number(targetTurnover).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="h-6 w-full rounded-full bg-slate-800/80 overflow-hidden border border-slate-700 shadow-inner backdrop-blur-sm">
                      <div
                        className="h-full rounded-full relative overflow-hidden"
                        style={{
                          width: `${Math.min(achievementPercentage, 100)}%`,
                          transition: 'width 1.5s ease-out',
                          background: 'linear-gradient(90deg, #7e22ce 0%, #EBA7FF 100%)'
                        }}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.5),transparent)] animate-pulse"></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-lg">
                        <div className="text-slate-300 text-xs font-black uppercase tracking-widest mb-2">✅ Won</div>
                        <div className="text-2xl font-black text-emerald-400 tabular-nums">₹{dealsWonValue.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-lg">
                        <div className="text-slate-300 text-xs font-black uppercase tracking-widest mb-2">🎯 Target</div>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 text-2xl font-black">₹</span>
                          <input type="number" defaultValue={targetTurnover} onBlur={handleTargetBlur}
                            className="bg-transparent text-white font-black text-2xl w-full focus:outline-none focus:border-b-2 focus:border-[#EBA7FF] transition-all tabular-nums" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* NAVIGATION BUTTONS */}
            <div className="flex flex-col md:flex-row justify-center items-center gap-6 mt-4">
              <button onClick={() => navigate('/analytics')} className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-purple-900 font-black text-base tracking-widest uppercase px-10 py-5 rounded-2xl transition-all flex items-center gap-3 shadow-sm hover:shadow-md">
                Detailed Analytics
              </button>

              <button onClick={() => navigate('/leadmanager')} className="bg-purple-900 hover:bg-[#EBA7FF] text-white hover:text-purple-950 font-black text-base tracking-widest uppercase px-10 py-5 rounded-2xl transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-[0_0_20px_rgba(235,167,255,0.6)]">
                Lead Manager
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
