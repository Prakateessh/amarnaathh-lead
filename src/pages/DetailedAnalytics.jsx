import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
} from 'recharts';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won'];
const STAGE_COLORS    = ['#6366f1', '#0ea5e9', '#f59e0b', '#a855f7', '#10b981']; // Adjusted for light theme contrast
const TEMP_COLORS     = { Hot: '#e11d48', Warm: '#f59e0b', Cold: '#0284c7' };

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

  // ── CUSTOM TOOLTIP (Light Theme) ──────────────────────────────────────────────
  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] font-sans min-w-[180px]">
        <p className="text-slate-900 text-lg font-black mb-3 border-b border-slate-100 pb-2">{label}</p>
        <div className="flex flex-col gap-2">
          {[...payload].reverse().map((p, i) => (
            <div key={i} className="flex justify-between items-center text-sm font-bold">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.fill }}></span>
                <span className="text-slate-600 uppercase tracking-widest text-[11px]">{p.name}</span>
              </span>
              <span className="text-slate-900 tabular-nums text-base">{p.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
          <span className="text-slate-400 font-black text-xs uppercase tracking-widest">Total</span>
          <span className="text-purple-700 font-black text-lg tabular-nums">{total}</span>
        </div>
      </div>
    );
  };

  // ── LABEL RENDERERS ───────────────────────────────────────────────────────────
  const InnerLabel = ({ x, y, width, height, value }) =>
    value > 0 ? (
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle"
        dominantBaseline="central" fill="white" fontSize={14}
        fontFamily="sans-serif" fontWeight="900">
        {value}
      </text>
    ) : null;

  const TopLabel = ({ x, y, width, value }) =>
    value > 0 ? (
      <text x={x + width / 2} y={y - 10} textAnchor="middle"
        fill="#64748b" fontSize={16} fontFamily="sans-serif" fontWeight="900">
        {value}
      </text>
    ) : null;

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
                <div key={kpi.label} className={`${kpi.bg} border rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow`}>
                  <p className="text-slate-500 font-black text-sm uppercase tracking-widest mb-3">
                    {kpi.label}
                  </p>
                  <p className={`text-5xl font-black tabular-nums tracking-tight ${kpi.textCls}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* ── TWO CHARTS ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

              {/* ════════════════════════════════════════════════
                  CHART 1 — SALES FUNNEL (SCALED UP)
              ════════════════════════════════════════════════ */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 flex flex-col gap-8 shadow-inner">
                <div className="pb-5 border-b border-slate-200">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sales Funnel</h2>
                  <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-2">
                    Pipeline stage progression &amp; conversion rates
                  </p>
                </div>

                <div className="flex flex-col items-center w-full gap-0 mt-4">
                  {funnelData.map((stage, index) => {
                    const widthPct  = Math.max((stage.count / funnelMax) * 100, 20); // Scaled from 20 to 100
                    const prevStage = index > 0 ? funnelData[index - 1] : null;
                    const advRate   = prevStage && prevStage.count > 0
                      ? Math.round((stage.count / prevStage.count) * 100)
                      : null;
                    const pctAll    = leads.length > 0
                      ? ((stage.count / leads.length) * 100).toFixed(1)
                      : '0';

                    return (
                      <div key={stage.name} className="flex flex-col items-center w-full">

                        {/* ── Connector + conversion label ── */}
                        {index > 0 && (
                          <div className="flex flex-col items-center py-2 w-full">
                            <svg width="100%" height="24" viewBox="0 0 200 24" preserveAspectRatio="none" className="opacity-40">
                              <line x1="50%" y1="0" x2="50%" y2="24" stroke={stage.color} strokeWidth="3" strokeDasharray="4 4" />
                            </svg>
                            <div className="flex items-center gap-2 mt-1 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm z-10 -translate-y-4">
                              <svg className="w-3 h-3" viewBox="0 0 12 8" fill="none">
                                <path d="M6 8L0 0h12L6 8z" fill={stage.color} />
                              </svg>
                              {advRate !== null && (
                                <span className="font-bold text-[11px] tracking-widest uppercase whitespace-nowrap text-slate-600">
                                  {advRate}% advance
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── Stage bar ── */}
                        <div
                          className={`flex items-center justify-between px-6 py-5 rounded-2xl cursor-default hover:scale-[1.02] transition-transform duration-300 shadow-md border-2`}
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: `${stage.color}15`, // Very light tint of the color
                            borderColor: `${stage.color}40`,
                          }}
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                                 style={{ backgroundColor: stage.color }} />
                            <span className="font-black text-xl text-slate-900 tracking-wide truncate">
                              {stage.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                            <span className="text-slate-500 font-bold text-xs uppercase tracking-widest hidden sm:block">
                              {pctAll}% Total
                            </span>
                            <span className="font-black text-4xl tabular-nums" style={{ color: stage.color }}>
                              {stage.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Lost pill ── */}
                  <div className="flex justify-center mt-8 w-full">
                    <div className="inline-flex items-center gap-6 px-8 py-5 rounded-2xl bg-rose-50 border-2 border-rose-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-rose-600 shadow-sm" />
                        <span className="text-rose-700 font-black text-lg tracking-widest uppercase">Closed — Lost</span>
                      </div>
                      <span className="text-rose-600 font-black text-4xl tabular-nums">{lostCount}</span>
                    </div>
                  </div>
                </div>

                {/* ── Stage colour legend ── */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-6 border-t border-slate-200 mt-4">
                  {funnelData.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-bold text-xs text-slate-600 uppercase tracking-widest truncate">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ════════════════════════════════════════════════
                  CHART 2 — SOURCE × TEMPERATURE STACKED BAR
              ════════════════════════════════════════════════ */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 flex flex-col gap-6 shadow-inner h-full">
                <div className="pb-5 border-b border-slate-200">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lead Volume by Source</h2>
                  <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-2">
                    Stacked by temperature — 🔥 Hot · 🌡️ Warm · ❄️ Cold
                  </p>
                </div>

                {sourceData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500 font-bold text-xl uppercase tracking-widest">
                    No source data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart
                      data={sourceData}
                      margin={{ top: 30, right: 10, left: -20, bottom: 80 }}
                      barCategoryGap="25%"
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="source"
                        tick={{ fill: '#475569', fontSize: 13, fontWeight: 800, fontFamily: 'sans-serif' }}
                        axisLine={false}
                        tickLine={false}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                        height={85}
                        dy={10}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: '#64748b', fontSize: 14, fontWeight: 800, fontFamily: 'sans-serif' }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip
                        content={<BarTooltip />}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={12}
                        wrapperStyle={{ fontSize: 14, fontWeight: 800, fontFamily: 'sans-serif', paddingTop: 20 }}
                        formatter={(value) => {
                          const map = { Hot: '🔥 Hot', Warm: '🌡️ Warm', Cold: '❄️ Cold' };
                          return <span style={{ color: TEMP_COLORS[value], marginLeft: 4 }}>{map[value]}</span>;
                        }}
                      />

                      {/* Cold — bottom segment */}
                      <Bar dataKey="Cold" name="Cold" stackId="t"
                           fill={TEMP_COLORS.Cold} radius={[0, 0, 6, 6]}>
                        <LabelList dataKey="Cold" content={InnerLabel} />
                      </Bar>

                      {/* Warm — middle segment */}
                      <Bar dataKey="Warm" name="Warm" stackId="t" fill={TEMP_COLORS.Warm}>
                        <LabelList dataKey="Warm" content={InnerLabel} />
                      </Bar>

                      {/* Hot — top segment + total above bar */}
                      <Bar dataKey="Hot" name="Hot" stackId="t"
                           fill={TEMP_COLORS.Hot} radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="Hot"   content={InnerLabel} />
                        <LabelList dataKey="total" content={TopLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Source summary text/table */}
                {sourceData.length > 0 && (
                  <div className="pt-6 border-t border-slate-200 mt-auto">
                    <p className="font-black text-xs text-slate-500 uppercase tracking-widest mb-4">
                      Source Distribution
                    </p>
                    <div className="flex flex-col gap-3">
                      {sourceData.map(src => {
                        const hotPct  = src.total > 0 ? Math.round((src.Hot  / src.total) * 100) : 0;
                        const warmPct = src.total > 0 ? Math.round((src.Warm / src.total) * 100) : 0;
                        const coldPct = 100 - hotPct - warmPct;
                        return (
                          <div key={src.source} className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <span className="font-black text-sm text-slate-700 w-32 truncate flex-shrink-0">
                              {src.source}
                            </span>
                            {/* Mini stacked progress bar */}
                            <div className="flex-1 h-4 rounded-full overflow-hidden bg-slate-100 flex shadow-inner">
                              {hotPct > 0  && <div className="h-full transition-all" style={{ width: `${hotPct}%`,  backgroundColor: TEMP_COLORS.Hot }} title={`${hotPct}% Hot`} />}
                              {warmPct > 0 && <div className="h-full transition-all" style={{ width: `${warmPct}%`, backgroundColor: TEMP_COLORS.Warm }} title={`${warmPct}% Warm`} />}
                              {coldPct > 0 && <div className="h-full transition-all" style={{ width: `${coldPct}%`, backgroundColor: TEMP_COLORS.Cold }} title={`${coldPct}% Cold`} />}
                            </div>
                            <span className="font-black text-lg tabular-nums text-slate-900 w-10 text-right flex-shrink-0">
                              {src.total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
