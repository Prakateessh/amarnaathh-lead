import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function Database() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // 🎯 TARGET TRACKER STATE
  const [targetTurnover, setTargetTurnover] = useState(150000000);

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  const fetchDatabaseData = async () => {
    setIsLoading(true);
    try {
      const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'yearly_target').single();
      if (settingsData) setTargetTurnover(Number(settingsData.value));

      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      const uniqueLeads = data.filter((lead, index, self) =>
        index === self.findIndex((t) => (
          t.name?.toLowerCase() === lead.name?.toLowerCase() &&
          t.requirement?.toLowerCase() === lead.requirement?.toLowerCase()
        ))
      );

      setLeads(uniqueLeads);
    } catch (err) {
      console.error("Error fetching data:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ⚡ AUTO-SAVE: TARGET TURNOVER TO DATABASE
  const handleTargetBlur = async (e) => {
    const val = e.target.value;
    setTargetTurnover(val);
    try {
      await supabase.from('settings').upsert({ key: 'yearly_target', value: val });
    } catch (err) {
      console.error("Failed to save target:", err.message);
    }
  };

  // PURGE LOGIC
  const handleWipeDatabase = async () => {
    const confirmText = window.prompt("⚠️ Type 'DELETE' to confirm full database wipe:");
    if (confirmText !== "DELETE") return;
    try {
      setIsWiping(true);
      await supabase.from('leads').delete().not('id', 'is', null);
      alert("✅ Database successfully wiped.");
      fetchDatabaseData();
      setShowAdmin(false);
    } catch (err) {
      alert("❌ Failed to wipe database.");
    } finally {
      setIsWiping(false);
    }
  };

  // ==========================================
  // 📊 DATA ANALYTICS CALCULATIONS
  // ==========================================

  const activeLeads = leads.filter(l => l.status !== 'Closed - Lost');

  const dealsWonValue = leads
    .filter(l => l.status === 'Closed - Won')
    .reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);

  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);

  const hotPipelineValue = activeLeads.filter(l => l.lead_temp === 'Hot').reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const hotPipelineCount = activeLeads.filter(l => l.lead_temp === 'Hot').length;

  const warmPipelineValue = activeLeads.filter(l => l.lead_temp === 'Warm').reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const warmPipelineCount = activeLeads.filter(l => l.lead_temp === 'Warm').length;

  const coldPipelineValue = activeLeads.filter(l => l.lead_temp === 'Cold' || !l.lead_temp).reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const coldPipelineCount = activeLeads.filter(l => l.lead_temp === 'Cold' || !l.lead_temp).length;

  const pieData = [
    { name: '🔥 Hot Deals', value: hotPipelineCount, color: '#ef4444' },
    { name: '🌡️ Warm Deals', value: warmPipelineCount, color: '#f59e0b' },
    { name: '❄️ Cold Deals', value: coldPipelineCount, color: '#06b6d4' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Routing
        </button>
        <div className="flex items-center gap-4">
          <button onClick={fetchDatabaseData} className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded">
            Refresh
          </button>
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className={`font-mono text-xs uppercase tracking-widest px-3 py-1 rounded border transition-colors ${showAdmin ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-secondary hover:text-white'}`}
          >
            {showAdmin ? 'Close Admin' : 'Admin Access'}
          </button>
        </div>
      </div>

      <div className="glass-modal w-full max-w-[95%] xl:max-w-7xl p-8 relative z-10 flex flex-col gap-8 shadow-2xl">

        {/* === ADMIN PANEL === */}
        {showAdmin && (
          <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in">
            <div className="flex-1 w-full">
              <h3 className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">System Purge Protocol</h3>
            </div>
            <button onClick={handleWipeDatabase} disabled={isWiping} className="bg-red-600 hover:bg-red-500 text-white font-mono text-sm uppercase px-6 py-3 rounded whitespace-nowrap">
              {isWiping ? 'Wiping...' : 'PURGE DATABASE'}
            </button>
          </div>
        )}

        {/* HEADER */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-sans font-bold text-white tracking-tight">CRM Analytics</h1>
            <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase animate-pulse">
              Live Data
            </span>
          </div>
        </div>

        {/* ========================================== */}
        {/* KPI DASHBOARD CARDS                        */}
        {/* ========================================== */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-secondary font-mono">LOADING DATA...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                <div className="text-secondary font-mono text-xs uppercase tracking-wider mb-2">Total Pipeline</div>
                <div className="text-3xl font-bold text-white">₹{totalValue.toLocaleString('en-IN')}</div>
              </div>

              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-5 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60"></div>
                <div className="flex justify-between items-start mb-2">
                  <p className="text-orange-400 font-mono text-xs uppercase tracking-wider">🔥 Hot Pipeline</p>
                  <span className="font-mono text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">{hotPipelineCount} leads</span>
                </div>
                <p className="text-3xl font-bold text-red-300 tracking-tight">₹{hotPipelineValue.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-5 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60"></div>
                <div className="flex justify-between items-start mb-2">
                  <p className="text-amber-400 font-mono text-xs uppercase tracking-wider">🌡️ Warm Pipeline</p>
                  <span className="font-mono text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">{warmPipelineCount} leads</span>
                </div>
                <p className="text-3xl font-bold text-amber-300 tracking-tight">₹{warmPipelineValue.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-5 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60"></div>
                <div className="flex justify-between items-start mb-2">
                  <p className="text-cyan-400 font-mono text-xs uppercase tracking-wider">❄️ Cold Pipeline</p>
                  <span className="font-mono text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">{coldPipelineCount} leads</span>
                </div>
                <p className="text-3xl font-bold text-cyan-300 tracking-tight">₹{coldPipelineValue.toLocaleString('en-IN')}</p>
              </div>

            </div>

            {/* ========================================== */}
            {/* TEMPERATURE DONUT CHART                    */}
            {/* ========================================== */}
            {pieData.length > 0 && (
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center h-[500px] relative overflow-hidden shadow-2xl">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-white/5 rounded-full blur-[80px] pointer-events-none"></div>

                <span className="text-secondary font-mono text-sm uppercase tracking-widest mb-4 z-10">
                  Active Lead Temperature Distribution
                </span>

                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={110} outerRadius={140} paddingAngle={6} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 10px ${entry.color}80)` }} />
                      ))}
                    </Pie>

                    <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-5xl font-bold tracking-tighter">
                      {activeLeads.length}
                    </text>
                    <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-secondary text-xs font-mono tracking-widest">
                      ACTIVE DEALS
                    </text>

                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} itemStyle={{ color: '#fff', fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ========================================== */}
            {/* TARGET TRACKER & PAGE NAVIGATION           */}
            {/* ========================================== */}
            <div className="w-full flex flex-col gap-6 py-6 border-y border-white/5 bg-gradient-to-r from-transparent via-white/5 to-transparent">

              <div className="flex flex-col md:flex-row justify-center items-center gap-6">
                <div className="bg-black/20 border border-green-500/30 px-6 py-3 rounded-lg flex items-center gap-4 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                  <span className="text-secondary text-xs font-mono uppercase tracking-widest">✅ Total Revenue Won</span>
                  <span className="text-green-400 font-bold text-2xl">₹{dealsWonValue.toLocaleString('en-IN')}</span>
                </div>

                <div className="text-white/20 font-bold text-2xl hidden md:block">/</div>

                <div className="bg-black/20 border border-blue-500/30 px-6 py-3 rounded-lg flex items-center gap-4 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                  <span className="text-secondary text-xs font-mono uppercase tracking-widest">🎯 Target Turnover</span>
                  <div className="flex items-center gap-1">
                    <span className="text-blue-300 font-bold text-2xl">₹</span>
                    <input
                      type="number"
                      defaultValue={targetTurnover}
                      onBlur={handleTargetBlur}
                      className="bg-navy border border-blue-500/50 px-3 py-1 rounded text-blue-300 font-bold text-2xl w-56 focus:outline-none focus:border-blue-400 text-center transition-colors hover:bg-white/5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-center items-center gap-6">
                <button
                  onClick={() => navigate('/analytics')}
                  className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 hover:text-white font-mono text-sm tracking-widest uppercase px-8 py-4 rounded-lg transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] group w-full md:w-auto justify-center"
                >
                  <svg className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Detailed Analytics
                </button>

                <button
                  onClick={() => navigate('/leadmanager')}
                  className="bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 hover:text-white font-mono text-sm tracking-widest uppercase px-8 py-4 rounded-lg transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] group w-full md:w-auto justify-center"
                >
                  <svg className="w-5 h-5 text-purple-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Lead Manager
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
