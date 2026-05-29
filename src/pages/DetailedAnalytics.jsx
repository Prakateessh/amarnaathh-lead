import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
} from 'recharts';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won'];
const STAGE_COLORS    = ['#6366f1', '#06b6d4', '#f59e0b', '#a855f7', '#10b981'];
const TEMP_COLORS     = { Hot: '#ef4444', Warm: '#f59e0b', Cold: '#06b6d4' };

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

  const lostCount  = leads.filter(l => l.status === 'Closed - Lost').length;
  const wonCount   = leads.filter(l => l.status === 'Closed - Won').length;
  const closedTotal = wonCount + lostCount;
  const winRate    = closedTotal > 0 ? ((wonCount / closedTotal) * 100).toFixed(1) : '—';
  const funnelMax  = Math.max(...funnelData.map(d => d.count), 1);

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

  // ── CUSTOM TOOLTIP ────────────────────────────────────────────────────────────
  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
    return (
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', fontFamily: 'monospace' }}>
        <p style={{ color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</p>
        {[...payload].reverse().map((p, i) => (
          <p key={i} style={{ color: p.fill, fontSize: 11, margin: '2px 0' }}>
            {p.name === 'Hot' ? '🔥' : p.name === 'Warm' ? '🌡️' : '❄️'} {p.name}: {p.value}
          </p>
        ))}
        <p style={{ color: '#64748b', fontSize: 11, marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          Total: {total}
        </p>
      </div>
    );
  };

  // ── LABEL RENDERERS ───────────────────────────────────────────────────────────
  const InnerLabel = ({ x, y, width, height, value }) =>
    value > 0 ? (
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle"
        dominantBaseline="central" fill="white" fontSize={9}
        fontFamily="monospace" fontWeight="bold">
        {value}
      </text>
    ) : null;

  const TopLabel = ({ x, y, width, value }) =>
    value > 0 ? (
      <text x={x + width / 2} y={y - 5} textAnchor="middle"
        fill="#94a3b8" fontSize={10} fontFamily="monospace">
        {value}
      </text>
    ) : null;

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button
          onClick={() => navigate('/database')}
          className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Analytics
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLeads}
            className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded"
          >
            Refresh
          </button>
          <span className="font-mono text-xs text-blue-400 tracking-widest uppercase flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Detailed Analytics
          </span>
        </div>
      </div>

      <div className="glass-modal w-full max-w-[95%] xl:max-w-7xl p-8 relative z-10 flex flex-col gap-8 shadow-2xl">

        {/* Header */}
        <div className="border-b border-white/10 pb-6">
          <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Detailed Analytics</h1>
          <p className="text-secondary text-sm mt-1">{leads.length} total leads — live from Supabase.</p>
        </div>

        {isLoading ? (
          <div className="py-32 text-center text-secondary font-mono animate-pulse text-sm tracking-widest">
            LOADING DATA...
          </div>
        ) : (
          <>
            {/* ── KPI CARDS ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Leads',  value: leads.length, textCls: 'text-white',       bg: 'bg-white/5 border-white/10' },
                { label: 'Deals Won',    value: wonCount,     textCls: 'text-green-300',    bg: 'bg-green-900/20 border-green-500/30' },
                { label: 'Deals Lost',   value: lostCount,    textCls: 'text-red-300',      bg: 'bg-red-900/20 border-red-500/30' },
                { label: 'Win Rate',     value: `${winRate}%`,textCls: 'text-blue-300',     bg: 'bg-blue-900/20 border-blue-500/30' },
              ].map(kpi => (
                <div key={kpi.label} className={`${kpi.bg} border rounded-xl p-5`}>
                  <p className="text-secondary font-mono text-[10px] uppercase tracking-widest mb-2">
                    {kpi.label}
                  </p>
                  <p className={`text-3xl font-bold ${kpi.textCls}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* ── TWO CHARTS ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

              {/* ════════════════════════════════════════════════
                  CHART 1 — SALES FUNNEL
              ════════════════════════════════════════════════ */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-6">
                <div className="pb-4 border-b border-white/5">
                  <h2 className="text-xl font-bold text-white tracking-tight">Sales Funnel</h2>
                  <p className="text-secondary font-mono text-[10px] uppercase tracking-widest mt-1">
                    Pipeline stage progression &amp; conversion rates
                  </p>
                </div>

                <div className="flex flex-col items-center w-full gap-0">
                  {funnelData.map((stage, index) => {
                    const widthPct  = Math.max((stage.count / funnelMax) * 88, 16);
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
                          <div className="flex flex-col items-center py-1.5 w-full">
                            {/* SVG funnel neck lines */}
                            <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none" className="opacity-30">
                              <line x1="50%" y1="0" x2="50%" y2="20" stroke={stage.color} strokeWidth="1.5" strokeDasharray="3 2" />
                            </svg>
                            <div className="flex items-center gap-2 -mt-1">
                              {/* downward chevron */}
                              <svg className="w-3 h-2.5" viewBox="0 0 12 8" fill="none">
                                <path d="M6 8L0 0h12L6 8z" fill={stage.color + 'cc'} />
                              </svg>
                              {advRate !== null && (
                                <span className="font-mono text-[10px] tracking-wider whitespace-nowrap"
                                  style={{ color: stage.color + 'cc' }}>
                                  {advRate}% advance rate
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── Stage bar ── */}
                        <div
                          className="flex items-center justify-between px-4 py-3 rounded-lg cursor-default
                                     hover:brightness-110 transition-all duration-200"
                          style={{
                            width: `${widthPct}%`,
                            background: `linear-gradient(135deg, ${stage.color}28, ${stage.color}12)`,
                            border:     `1px solid ${stage.color}55`,
                            boxShadow:  `0 0 20px ${stage.color}15`,
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                                 style={{ backgroundColor: stage.color }} />
                            <span className="font-mono text-xs text-white tracking-wide truncate">
                              {stage.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <span className="text-secondary font-mono text-[10px]">
                              {pctAll}% of all
                            </span>
                            <span className="font-bold text-2xl" style={{ color: stage.color }}>
                              {stage.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Lost pill ── */}
                  <div className="flex justify-center mt-5 w-full">
                    <div className="inline-flex items-center gap-4 px-5 py-3 rounded-xl"
                         style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-red-400 font-mono text-xs tracking-widest uppercase">Closed — Lost</span>
                      </div>
                      <span className="text-red-300 font-bold text-2xl">{lostCount}</span>
                      {leads.length > 0 && (
                        <span className="text-secondary font-mono text-[10px]">
                          {((lostCount / leads.length) * 100).toFixed(1)}% of all leads
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Stage colour legend ── */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-2 pt-4 border-t border-white/5">
                  {funnelData.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-mono text-[9px] text-secondary truncate">{s.name}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                    <span className="font-mono text-[9px] text-secondary">Closed — Lost</span>
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════════════
                  CHART 2 — SOURCE × TEMPERATURE STACKED BAR
              ════════════════════════════════════════════════ */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-6">
                <div className="pb-4 border-b border-white/5">
                  <h2 className="text-xl font-bold text-white tracking-tight">Lead Volume by Source</h2>
                  <p className="text-secondary font-mono text-[10px] uppercase tracking-widest mt-1">
                    Stacked by temperature — 🔥 Hot · 🌡️ Warm · ❄️ Cold
                  </p>
                </div>

                {sourceData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-secondary font-mono text-sm">
                    No source data available yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={370}>
                    <BarChart
                      data={sourceData}
                      margin={{ top: 26, right: 16, left: -10, bottom: 68 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="source"
                        tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        angle={-38}
                        textAnchor="end"
                        interval={0}
                        height={65}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: 'Leads',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#475569',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          dx: 12,
                        }}
                      />
                      <Tooltip
                        content={<BarTooltip />}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 6 }}
                        formatter={(value) => {
                          const map = { Hot: '🔥 Hot', Warm: '🌡️ Warm', Cold: '❄️ Cold' };
                          return <span style={{ color: TEMP_COLORS[value] }}>{map[value]}</span>;
                        }}
                      />

                      {/* Cold — bottom segment */}
                      <Bar dataKey="Cold" name="Cold" stackId="t"
                           fill={TEMP_COLORS.Cold} radius={[0, 0, 3, 3]}>
                        <LabelList dataKey="Cold" content={InnerLabel} />
                      </Bar>

                      {/* Warm — middle segment */}
                      <Bar dataKey="Warm" name="Warm" stackId="t" fill={TEMP_COLORS.Warm}>
                        <LabelList dataKey="Warm" content={InnerLabel} />
                      </Bar>

                      {/* Hot — top segment + total above bar */}
                      <Bar dataKey="Hot" name="Hot" stackId="t"
                           fill={TEMP_COLORS.Hot} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="Hot"   content={InnerLabel} />
                        <LabelList dataKey="total" content={TopLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Source summary table */}
                {sourceData.length > 0 && (
                  <div className="pt-4 border-t border-white/5">
                    <p className="font-mono text-[10px] text-secondary uppercase tracking-widest mb-3">
                      Source Breakdown
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {sourceData.map(src => {
                        const hotPct  = src.total > 0 ? Math.round((src.Hot  / src.total) * 100) : 0;
                        const warmPct = src.total > 0 ? Math.round((src.Warm / src.total) * 100) : 0;
                        const coldPct = 100 - hotPct - warmPct;
                        return (
                          <div key={src.source} className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-secondary w-24 truncate flex-shrink-0">
                              {src.source}
                            </span>
                            {/* Mini stacked progress bar */}
                            <div className="flex-1 h-3 rounded-full overflow-hidden bg-white/5 flex">
                              {hotPct > 0  && <div className="h-full" style={{ width: `${hotPct}%`,  backgroundColor: TEMP_COLORS.Hot }} />}
                              {warmPct > 0 && <div className="h-full" style={{ width: `${warmPct}%`, backgroundColor: TEMP_COLORS.Warm }} />}
                              {coldPct > 0 && <div className="h-full" style={{ width: `${coldPct}%`, backgroundColor: TEMP_COLORS.Cold }} />}
                            </div>
                            <span className="font-mono text-xs text-white font-bold w-6 text-right flex-shrink-0">
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
