import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
} from 'recharts';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won'];
// Option A Color Fix: "New" is now Charcoal/Slate (#475569) to separate from Negotiation
const STAGE_COLORS    = ['#475569', '#0ea5e9', '#f59e0b', '#a855f7', '#10b981']; 
const TEMP_COLORS     = { Hot: '#e11d48', Warm: '#ea580c', Cold: '#0284c7' };

export default function DetailedAnalytics() {
  const navigate = useNavigate();
  const [leads, setLeads]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('leads').select('*');
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── FUNNEL DATA ───────────────────────────────────────────────────────────────
  const funnelData = useMemo(() =>
    PIPELINE_STAGES.map((stage, i) => ({
      name:  stage,
      count: leads.filter(l => (l.status || 'New') === stage).length,
      color: STAGE_COLORS[i],
    })),
    [leads]
  );

  const lostCount   = leads.filter(l => l.status === 'Closed - Lost').length;
  const wonCount    = leads.filter(l => l.status === 'Closed - Won').length;
  const closedTotal = wonCount + lostCount;
  const winRate     = closedTotal > 0 ? ((wonCount / closedTotal) * 100).toFixed(1) : '—';
  const funnelMax   = Math.max(...funnelData.map(d => d.count), 1);

  // ── SOURCE × TEMPERATURE DATA ─────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const sources = [...new Set(leads.map(l => l.source).filter(Boolean))];
    return sources
      .map(src => {
        const sl = leads.filter(l => l.source === src);
        return {
          source: src,
          Hot:   sl.filter(l => l.lead_temp === 'Hot').length,
          Warm:  sl.filter(l => l.lead_temp === 'Warm').length,
          Cold:  sl.filter(l => l.lead_temp === 'Cold' || !l.lead_temp).length,
          total: sl.length,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  // ── CUSTOM TOOLTIP (Vibrant & Scaled) ──────────────────────────────────────────────
  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
    return (
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.12)] font-sans min-w-[200px] transform transition-all">
        <p className="text-slate-900 text-lg font-black mb-3 border-b border-slate-100 pb-2">{label}</p>
        <div className="flex flex-col gap-3">
          {[...payload].reverse().map((p, i) => (
            <div key={i} className="flex justify-between items-center text-sm font-bold">
              <span className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full shadow-inner" style={{ backgroundColor: TEMP_COLORS[p.name] || p.fill }}></span>
                <span className="text-slate-600 uppercase tracking-widest text-xs">{p.name}</span>
              </span>
              <span className="text-slate-900 tabular-nums text-base bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{p.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 -mx-5 -mb-5 px-5 py-4 rounded-b-xl">
          <span className="text-slate-500 font-black text-xs uppercase tracking-widest">Total Leads</span>
          <span className="text-purple-700 font-black text-2xl tabular-nums">{total}</span>
        </div>
      </div>
    );
  };

  // ── LABEL RENDERERS (With Halo Effect) ───────────────────────────────────────────────────────────
  const InnerLabel = ({ x, y, width, height, value }) =>
    value > 0 ? (
      <g>
        <circle cx={x + width / 2} cy={y + height / 2} r="14" fill="rgba(0,0,0,0.15)" />
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle"
          dominantBaseline="central" fill="#ffffff" fontSize={16}
          fontFamily="sans-serif" fontWeight="900">
          {value}
        </text>
      </g>
    ) : null;

  const TopLabel = ({ x, y, width, value }) =>
    value > 0 ? (
      <text x={x + width / 2} y={y - 12} textAnchor="middle"
        fill="#334155" fontSize={20} fontFamily="sans-serif" fontWeight="900">
        {value}
      </text>
    ) : null;

  // ── FUNNEL CARD RENDERER ──────────────────────────────────────────────────────
  const renderFunnelCard = (stage, prevStage) => {
    const widthPct = Math.max((stage.count / funnelMax) * 100, 2); 
    const advRate = prevStage && prevStage.count > 0 ? Math.round((stage.count / prevStage.count) * 100) : null;
    const pctAll = leads.length > 0 ? ((stage.count / leads.length) * 100).toFixed(1) : '0';

    return (
      <React.Fragment key={stage.name}>
        {/* Connector Arrow (Horizontal) */}
        {prevStage && (
          <div className="flex flex-col justify-center items-center px-1 lg:px-2 flex-shrink-0">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            {advRate !== null && (
              <span className="text-[11px] font-bold text-slate-500 mt-2 uppercase tracking-widest whitespace-nowrap bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                {advRate > 100 ? '>100' : advRate}%
              </span>
            )}
          </div>
        )}

        {/* Stage Card */}
        <div 
          className="flex-1 rounded-2xl overflow-hidden border-2 shadow-sm bg-white relative flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 min-w-[200px]"
          style={{ borderColor: `${stage.color}30` }}
        >
          <div className="absolute top-0 left-0 h-full transition-all duration-700" style={{ width: `${widthPct}%`, backgroundColor: `${stage.color}10` }} />
          <div className="h-2.5 w-full relative z-10" style={{ backgroundColor: stage.color }} />
          
          <div className="p-6 flex flex-col justify-between h-full gap-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: stage.color }} />
              <span className="font-bold text-base text-slate-700 uppercase tracking-widest leading-snug">
                {stage.name}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-black text-5xl tabular-nums tracking-tight" style={{ color: stage.color }}>
                {stage.count}
              </span>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest text-right leading-tight bg-slate-50 px-2 py-1 rounded border border-slate-100">
                {pctAll}%<br/>Total
              </span>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button
          onClick={() => navigate('/database')}
          className="text-slate-600 hover:text-purple-900 font-black text-base uppercase tracking-widest transition-colors flex items-center gap-3 bg-white px-6 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchLeads}
            className="text-slate-700 hover:text-purple-900 font-black text-sm uppercase px-8 py-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl transition-colors shadow-sm tracking-widest"
          >
            Refresh
          </button>
          <span className="font-black text-base text-purple-900 tracking-widest uppercase flex items-center gap-3 bg-[#EBA7FF]/30 px-7 py-4 rounded-xl border border-[#EBA7FF]/60 shadow-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Detailed Analytics
          </span>
        </div>
      </div>

      <div className="bg-white w-full max-w-[95%] xl:max-w-7xl p-10 relative z-10 flex flex-col gap-10 shadow-2xl shadow-slate-200/60 rounded-3xl border border-slate-300">

        {/* Header */}
        <div className="border-b border-slate-200 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-5xl font-black text-slate-900 tracking-tight">System Analytics</h1>
            <p className="text-slate-500 font-medium text-lg">{leads.length} total leads processed through the pipeline.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6 text-slate-500 font-bold tracking-widest text-xl uppercase">
            <svg className="w-16 h-16 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading Analytics...
          </div>
        ) : (
          <>
            {/* ── KPI CARDS ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Leads',  value: leads.length, textCls: 'text-slate-900', bg: 'bg-slate-50 border-slate-200' },
                { label: 'Deals Won',    value: wonCount,     textCls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                { label: 'Deals Lost',   value: lostCount,    textCls: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200' },
                { label: 'Win Rate',     value: `${winRate}%`,textCls: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
              ].map(kpi => (
                <div key={kpi.label} className={`${kpi.bg} border-2 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow`}>
                  <p className="text-slate-500 font-black text-sm uppercase tracking-widest mb-3">
                    {kpi.label}
                  </p>
                  <p className={`text-5xl font-black tabular-nums tracking-tight ${kpi.textCls}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* ════════════════════════════════════════════════
                3 OVER 2 SALES FUNNEL
            ════════════════════════════════════════════════ */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 flex flex-col gap-8 shadow-inner w-full">
              <div className="pb-5 border-b border-slate-200 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sales Funnel</h2>
                  <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-2">
                    Pipeline stage progression &amp; conversion rates
                  </p>
                </div>
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 shadow-sm">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                  <span className="text-rose-700 font-bold text-sm tracking-widest uppercase">Closed — Lost: </span>
                  <span className="text-rose-600 font-black text-xl tabular-nums">{lostCount}</span>
                </div>
              </div>

              <div className="flex flex-col gap-6 w-full mt-4">
                
                {/* ROW 1: Top 3 Stages */}
                <div className="flex items-stretch justify-between w-full gap-2">
                  {funnelData.slice(0, 3).map((stage, i) => 
                    renderFunnelCard(stage, i > 0 ? funnelData[i - 1] : null)
                  )}
                </div>

                {/* ROW CONNECTOR: Dropdown arrow from Stage 3 to 4 */}
                <div className="flex justify-center my-1 relative">
                  <div className="flex flex-col items-center bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-md z-10">
                    <svg className="w-6 h-6 text-slate-400 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="text-[11px] font-black text-slate-500 mt-1.5 uppercase tracking-widest">
                      {funnelData[2].count > 0 ? Math.round((funnelData[3].count / funnelData[2].count) * 100) : 0}% Advance
                    </span>
                  </div>
                </div>

                {/* ROW 2: Bottom 2 Stages (Centered) */}
                <div className="flex items-stretch justify-center w-full gap-2 xl:px-32">
                  {funnelData.slice(3, 5).map((stage, i) => 
                    renderFunnelCard(stage, i > 0 ? funnelData[i + 2] : null) // i+2 maps local idx 1 to global idx 3 (prev)
                  )}
                </div>

              </div>

              {/* Stage colour legend */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-8 border-t border-slate-200 mt-4">
                {funnelData.map(s => (
                  <div key={s.name} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-bold text-xs text-slate-600 uppercase tracking-widest truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ════════════════════════════════════════════════
                FULL-WIDTH SOURCE × TEMPERATURE STACKED BAR
            ════════════════════════════════════════════════ */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 flex flex-col gap-6 shadow-inner w-full">
              <div className="pb-5 border-b border-slate-200">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lead Volume by Source</h2>
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-2">
                  Stacked by temperature — 🔥 Hot · 🌡️ Warm · ❄️ Cold
                </p>
              </div>

              {sourceData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 font-bold text-xl uppercase tracking-widest py-32">
                  No source data available.
                </div>
              ) : (
                <div className="flex flex-col xl:flex-row gap-10 mt-4">
                  
                  {/* CHART SECTION */}
                  <div className="flex-1 min-w-0">
                    <ResponsiveContainer width="100%" height={500}>
                      <BarChart
                        data={sourceData}
                        margin={{ top: 40, right: 10, left: -10, bottom: 80 }}
                        barSize={80} // Massive, thick bars
                      >
                        <defs>
                          <linearGradient id="coldGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#0284c7" />
                          </linearGradient>
                          <linearGradient id="warmGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#ea580c" />
                          </linearGradient>
                          <linearGradient id="hotGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fb7185" />
                            <stop offset="100%" stopColor="#e11d48" />
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="8 8" stroke="#cbd5e1" vertical={false} />
                        <XAxis
                          dataKey="source"
                          tick={{ fill: '#334155', fontSize: 15, fontWeight: 900, fontFamily: 'sans-serif' }}
                          axisLine={false}
                          tickLine={false}
                          angle={-40}
                          textAnchor="end"
                          interval={0}
                          height={85}
                          dy={15}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: '#64748b', fontSize: 16, fontWeight: 900, fontFamily: 'sans-serif' }}
                          axisLine={false}
                          tickLine={false}
                          dx={-10}
                        />
                        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Legend
                          iconType="circle"
                          iconSize={14}
                          wrapperStyle={{ fontSize: 16, fontWeight: 800, fontFamily: 'sans-serif', paddingTop: 20 }}
                          formatter={(value) => {
                            const map = { Hot: '🔥 Hot', Warm: '🌡️ Warm', Cold: '❄️ Cold' };
                            return <span style={{ color: TEMP_COLORS[value], marginLeft: 4 }}>{map[value]}</span>;
                          }}
                        />

                        {/* Stack Segments */}
                        <Bar dataKey="Cold" name="Cold" stackId="t" fill="url(#coldGrad)" stroke="#ffffff" strokeWidth={3} radius={[0, 0, 8, 8]}>
                          <LabelList dataKey="Cold" content={InnerLabel} />
                        </Bar>
                        <Bar dataKey="Warm" name="Warm" stackId="t" fill="url(#warmGrad)" stroke="#ffffff" strokeWidth={3}>
                          <LabelList dataKey="Warm" content={InnerLabel} />
                        </Bar>
                        <Bar dataKey="Hot" name="Hot" stackId="t" fill="url(#hotGrad)" stroke="#ffffff" strokeWidth={3} radius={[8, 8, 0, 0]}>
                          <LabelList dataKey="Hot" content={InnerLabel} />
                          <LabelList dataKey="total" content={TopLabel} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* SUMMARY SECTION */}
                  <div className="w-full xl:w-96 flex-shrink-0 flex flex-col border-t xl:border-t-0 xl:border-l border-slate-200 pt-6 xl:pt-0 xl:pl-10">
                    <p className="font-black text-sm text-slate-500 uppercase tracking-widest mb-5">
                      Source Breakdown
                    </p>
                    <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-2">
                      {sourceData.map(src => {
                        const hotPct  = src.total > 0 ? Math.round((src.Hot  / src.total) * 100) : 0;
                        const warmPct = src.total > 0 ? Math.round((src.Warm / src.total) * 100) : 0;
                        const coldPct = 100 - hotPct - warmPct;
                        return (
                          <div key={src.source} className="flex flex-col gap-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-base text-slate-700 truncate">
                                {src.source}
                              </span>
                              <span className="font-black text-2xl tabular-nums text-purple-700 bg-purple-50 px-3 py-1 rounded-lg">
                                {src.total}
                              </span>
                            </div>
                            
                            {/* Mini stacked progress bar */}
                            <div className="w-full h-4 rounded-full overflow-hidden bg-slate-100 flex shadow-inner mt-2">
                              {hotPct > 0  && <div className="h-full transition-all border-r-2 border-white" style={{ width: `${hotPct}%`,  backgroundColor: TEMP_COLORS.Hot }} title={`${hotPct}% Hot`} />}
                              {warmPct > 0 && <div className="h-full transition-all border-r-2 border-white" style={{ width: `${warmPct}%`, backgroundColor: TEMP_COLORS.Warm }} title={`${warmPct}% Warm`} />}
                              {coldPct > 0 && <div className="h-full transition-all" style={{ width: `${coldPct}%`, backgroundColor: TEMP_COLORS.Cold }} title={`${coldPct}% Cold`} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
