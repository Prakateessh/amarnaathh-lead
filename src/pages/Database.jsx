import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';

// ─── Inline style block for keyframes & premium micro-interactions ───────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700&display=swap');

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    50%       { box-shadow: 0 0 20px 4px rgba(59,130,246,0.25); }
  }
  @keyframes hotPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    50%       { box-shadow: 0 0 24px 6px rgba(239,68,68,0.3); }
  }
  @keyframes numberCount {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes borderPulse {
    0%, 100% { border-color: rgba(239,68,68,0.3); }
    50%       { border-color: rgba(239,68,68,0.7); }
  }
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.95) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes rowReveal {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .db-root * { font-family: 'Space Grotesk', sans-serif; }
  .db-root .mono { font-family: 'JetBrains Mono', monospace !important; }

  .kpi-card {
    animation: fadeSlideUp 0.45s cubic-bezier(.22,1,.36,1) both;
    transition: transform 0.22s cubic-bezier(.22,1,.36,1),
                box-shadow 0.22s ease,
                border-color 0.22s ease;
  }
  .kpi-card:hover {
    transform: translateY(-3px) scale(1.012);
    box-shadow: 0 12px 40px -8px rgba(0,0,0,0.5);
  }

  .hot-kpi {
    animation: hotPulse 2.8s ease-in-out infinite, fadeSlideUp 0.55s cubic-bezier(.22,1,.36,1) both;
    transition: transform 0.22s cubic-bezier(.22,1,.36,1);
  }
  .hot-kpi:hover { transform: translateY(-4px) scale(1.018); }

  .save-btn {
    animation: pulseGlow 1.8s ease-in-out infinite;
    transition: background 0.18s ease, transform 0.15s ease;
  }
  .save-btn:hover { transform: scale(1.04); }
  .save-btn:active { transform: scale(0.97); }

  .action-btn {
    transition: background 0.18s ease, border-color 0.22s ease,
                color 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
  }
  .action-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  .action-btn:active { transform: scale(0.97); }

  .table-row {
    animation: rowReveal 0.3s cubic-bezier(.22,1,.36,1) both;
    transition: background 0.18s ease;
  }
  .table-row:hover { background: rgba(255,255,255,0.04); }

  .modal-panel {
    animation: modalIn 0.3s cubic-bezier(.22,1,.36,1) both;
  }

  .chart-panel {
    transition: transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease;
    animation: fadeSlideUp 0.5s cubic-bezier(.22,1,.36,1) both;
  }
  .chart-panel:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px -4px rgba(0,0,0,0.45);
  }

  .stage-select, .temp-select {
    transition: border-color 0.2s ease, color 0.2s ease,
                background 0.18s ease, box-shadow 0.2s ease;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    padding-right: 22px !important;
  }
  .stage-select:hover, .temp-select:hover { box-shadow: 0 0 0 1px rgba(255,255,255,0.15); }
  .stage-select:focus, .temp-select:focus { box-shadow: 0 0 0 2px rgba(59,130,246,0.35); }

  .price-input {
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .price-input:hover { border-color: rgba(255,255,255,0.25); }
  .price-input:focus { 
    outline: none;
    border-color: rgba(34,197,94,0.6);
    box-shadow: 0 0 0 2px rgba(34,197,94,0.15);
  }

  .note-btn {
    transition: background 0.18s ease, color 0.18s ease,
                border-color 0.18s ease, transform 0.15s ease;
  }
  .note-btn:hover { transform: scale(1.04); }

  .lost-reason-btn {
    transition: background 0.18s ease, color 0.18s ease,
                border-color 0.18s ease, transform 0.14s ease;
  }
  .lost-reason-btn:hover {
    transform: translateX(4px);
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.4);
    color: #fca5a5;
  }

  .shine-loader {
    background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
    background-size: 400px 100%;
    animation: shimmer 1.5s infinite;
  }

  .glass-surface {
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.09);
    box-shadow: 0 8px 48px -12px rgba(0,0,0,0.6),
                inset 0 1px 0 rgba(255,255,255,0.07);
  }

  .section-label {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #64748b;
  }

  /* Scrollbar */
  .db-root ::-webkit-scrollbar { width: 5px; height: 5px; }
  .db-root ::-webkit-scrollbar-track { background: transparent; }
  .db-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
  .db-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

  /* Overlay */
  .modal-overlay {
    animation: fadeIn 0.2s ease both;
    background: rgba(2,8,20,0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
`;

// ─── Helper: Spinner ─────────────────────────────────────────────────────────
const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
    style={{ animation: 'spin 0.75s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}>
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="22" strokeDashoffset="8" strokeLinecap="round"/>
  </svg>
);

// ─── Custom Tooltip for Recharts ─────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px' }}>
      {label && <p style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#fff', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Database() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // === MODAL STATES ===
  const [activeLead, setActiveLead] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [isAppending, setIsAppending] = useState(false);

  // NEW: Lost Reason Modal State
  const [lostModal, setLostModal] = useState({ isOpen: false, leadId: null });

  // NEW: Hot pipeline KPI visibility toggle
  const [showHotPipeline, setShowHotPipeline] = useState(false);

  const pipelineStages = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won', 'Closed - Lost'];
  const lostReasons = ['💸 Price too high', '🤝 Chose a Competitor', '👻 Ghosted / Unresponsive', '❌ Junk Lead', '🔧 Wrong Machine'];

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uniqueLeads = data.filter((lead, index, self) =>
        index === self.findIndex((t) => (
          t.name.toLowerCase() === lead.name.toLowerCase() &&
          t.requirement.toLowerCase() === lead.requirement.toLowerCase()
        ))
      );

      setLeads(uniqueLeads);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Error fetching leads:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // === DATA EDITING HANDLERS ===
  const handleCellEdit = (id, field, value) => {
    if (field === 'status' && value === 'Closed - Lost') {
      setLostModal({ isOpen: true, leadId: id });
      return;
    }
    setLeads(prevLeads => prevLeads.map(lead => {
      if (lead.id === id) {
        let updatedLead = { ...lead, [field]: value };
        if (field === 'status') updatedLead.lost_reason = null;
        return updatedLead;
      }
      return lead;
    }));
    setHasUnsavedChanges(true);
  };

  const handleLostReasonSelect = (reason) => {
    setLeads(prevLeads => prevLeads.map(lead =>
      lead.id === lostModal.leadId ? { ...lead, status: 'Closed - Lost', lost_reason: reason } : lead
    ));
    setHasUnsavedChanges(true);
    setLostModal({ isOpen: false, leadId: null });
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      const { error } = await supabase.from('leads').upsert(leads);
      if (error) throw error;
      setHasUnsavedChanges(false);
    } catch (error) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWipeDatabase = async () => {
    const confirmText = window.prompt("⚠️ Type 'DELETE' to confirm full database wipe:");
    if (confirmText !== "DELETE") return;
    try {
      setIsWiping(true);
      const { error } = await supabase.from('leads').delete().not('id', 'is', null);
      if (error) throw error;
      alert("✅ Database successfully wiped.");
      fetchLeads();
      setShowAdmin(false);
    } catch (err) {
      alert("❌ Failed to wipe database.");
    } finally {
      setIsWiping(false);
    }
  };

  const handleAppendNote = async () => {
    if (!newNote.trim() || !activeLead) return;
    try {
      setIsAppending(true);
      const now = new Date();
      const timestamp = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;

      const updatedNotes = activeLead.notes
        ? `${activeLead.notes}\n${timestamp} ${newNote.trim()}`
        : `${timestamp} ${newNote.trim()}`;

      const { error } = await supabase.from('leads').update({ notes: updatedNotes }).eq('id', activeLead.id);
      if (error) throw error;

      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, notes: updatedNotes } : l));
      setNewNote("");
      setActiveLead(null);
    } catch (error) {
      alert(`Failed to append note: ${error.message}`);
    } finally {
      setIsAppending(false);
    }
  };

  const handleDownloadExcel = () => {
    if (leads.length === 0) return;
    const excelData = leads.map(lead => ({
      'Date Imported': lead.date || '',
      'Source': lead.source || '',
      'Client Name': lead.name || '',
      'Company': lead.company_name || '',
      'Phone': lead.phone || '',
      'Location': lead.location || '',
      'Requirement': lead.requirement || '',
      'Pipeline Stage': lead.status || 'New',
      'Temperature': lead.lead_temp || 'Cold',
      'Value (₹)': Number(lead.price) || 0,
      'Lost Reason': lead.lost_reason || '',
      'Internal Notes': lead.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 25 }, { wch: 50 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Master Pipeline");
    XLSX.writeFile(workbook, `CRM_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ==========================================
  // 📊 DATA ANALYTICS & GRAPH CALCULATIONS
  // ==========================================

  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);
  const activeLeads = leads.filter(l => l.status !== 'Closed - Lost');

  // NEW: Hot Pipeline Sum — active leads where lead_temp is 'Hot'
  const hotPipelineValue = activeLeads
    .filter(l => l.lead_temp === 'Hot')
    .reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const hotPipelineCount = activeLeads.filter(l => l.lead_temp === 'Hot').length;

  const pieData = [
    { name: 'Hot',  value: activeLeads.filter(l => l.lead_temp === 'Hot').length,                       color: '#ef4444' },
    { name: 'Warm', value: activeLeads.filter(l => l.lead_temp === 'Warm').length,                      color: '#f59e0b' },
    { name: 'Cold', value: activeLeads.filter(l => l.lead_temp === 'Cold' || !l.lead_temp).length,      color: '#06b6d4' }
  ].filter(d => d.value > 0);

  const barData = pieData.map(d => ({
    name: d.name,
    fill: d.color,
    value: activeLeads.filter(l => (l.lead_temp || 'Cold') === d.name).reduce((sum, l) => sum + (Number(l.price) || 0), 0)
  })).filter(d => d.value > 0);

  const funnelStages = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won'];
  const funnelData = funnelStages.map(stage => ({
    name: stage,
    count: leads.filter(l => (l.status || 'New') === stage).length
  }));

  const lostLeads = leads.filter(l => l.status === 'Closed - Lost' && l.lost_reason);
  const lostReasonCounts = lostLeads.reduce((acc, lead) => {
    acc[lead.lost_reason] = (acc[lead.lost_reason] || 0) + 1;
    return acc;
  }, {});

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#ec4899', '#64748b'];
  const lostReasonData = Object.keys(lostReasonCounts).map((key, index) => ({
    name: key.replace(/^[^\s]+\s/, ''),
    value: lostReasonCounts[key],
    color: COLORS[index % COLORS.length]
  }));

  const sources = [...new Set(leads.map(l => l.source || 'Unknown'))];
  const sourceQualityData = sources.map(source => {
    const sourceLeads = leads.filter(l => (l.source || 'Unknown') === source);
    return {
      name: source,
      Won:    sourceLeads.filter(l => l.status === 'Closed - Won').length,
      Active: sourceLeads.filter(l => l.status !== 'Closed - Won' && l.status !== 'Closed - Lost').length,
      Lost:   sourceLeads.filter(l => l.status === 'Closed - Lost').length,
    };
  });

  // ─── Stage badge helper ───────────────────────────────────────────────────
  const stageStyle = (status) => {
    if (status === 'Closed - Won')  return { border: '1px solid rgba(34,197,94,0.4)',  color: '#4ade80' };
    if (status === 'Closed - Lost') return { border: '1px solid rgba(239,68,68,0.4)',  color: '#f87171' };
    if (status === 'Negotiation')   return { border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' };
    return { border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0' };
  };

  const tempStyle = (temp) => {
    if (temp === 'Hot')  return { border: '1px solid rgba(239,68,68,0.45)',   color: '#f87171' };
    if (temp === 'Warm') return { border: '1px solid rgba(245,158,11,0.45)',  color: '#fbbf24' };
    return { border: '1px solid rgba(6,182,212,0.45)', color: '#22d3ee' };
  };

  return (
    <>
      <style>{globalStyles}</style>

      <div className="db-root min-h-screen flex flex-col items-center py-12 px-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #050d1f 0%, #060e22 55%, #04091a 100%)' }}>

        {/* Ambient glows */}
        <div style={{ position:'absolute', top:-120, right:'18%', width:520, height:520, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
        <div style={{ position:'absolute', bottom:80, left:'8%', width:380, height:380, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
        <div style={{ position:'absolute', top:'40%', right:0, width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle, rgba(239,68,68,0.04) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />

        {/* ── MODAL 1: NOTES OVERLAY ─────────────────────────────────────── */}
        {activeLead && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal-panel glass-surface p-6 rounded-2xl w-full max-w-2xl flex flex-col gap-5"
              style={{ boxShadow: '0 32px 80px -16px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)' }}>

              <div className="flex justify-between items-start pb-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                    📝 Lead Dossier
                  </h3>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {activeLead.name} {activeLead.company_name ? `· ${activeLead.company_name}` : ''} {activeLead.phone ? `· ${activeLead.phone}` : ''}
                  </p>
                </div>
                <button onClick={() => { setActiveLead(null); setNewNote(""); }}
                  style={{ color:'#475569', transition:'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color='#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color='#475569'}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', padding:'16px', height:240, overflowY:'auto', fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#94a3b8', whiteSpace:'pre-wrap', lineHeight:1.7 }}>
                {activeLead.notes || <span style={{ color: '#334155' }}>No notes recorded yet.</span>}
              </div>

              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Type new update here..."
                style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'12px 14px', color:'#e2e8f0', fontSize:13, resize:'none', height:90, outline:'none', transition:'border-color 0.2s, box-shadow 0.2s', fontFamily:'Space Grotesk, sans-serif' }}
                onFocus={e => { e.target.style.borderColor='rgba(59,130,246,0.5)'; e.target.style.boxShadow='0 0 0 2px rgba(59,130,246,0.12)'; }}
                onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.12)'; e.target.style.boxShadow='none'; }}
              />

              <button onClick={handleAppendNote} disabled={isAppending || !newNote.trim()}
                className="action-btn"
                style={{ background: isAppending || !newNote.trim() ? 'rgba(255,255,255,0.06)' : 'rgba(59,130,246,0.85)', color: '#fff', border: '1px solid rgba(59,130,246,0.3)', borderRadius:10, padding:'11px 0', fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase', cursor: isAppending || !newNote.trim() ? 'not-allowed' : 'pointer', transition:'background 0.18s, transform 0.15s' }}>
                {isAppending ? <><Spinner />Appending…</> : '📌 Append Note'}
              </button>
            </div>
          </div>
        )}

        {/* ── MODAL 2: LOST REASON OVERLAY ──────────────────────────────── */}
        {lostModal.isOpen && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal-panel glass-surface p-6 rounded-2xl max-w-md w-full"
              style={{ borderColor:'rgba(239,68,68,0.2)', boxShadow:'0 32px 80px -16px rgba(0,0,0,0.75), 0 0 0 1px rgba(239,68,68,0.12)' }}>
              <div style={{ marginBottom:6 }}>
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.18em', textTransform:'uppercase', color:'#f87171' }}>Pipeline Update</span>
              </div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', marginBottom:6 }}>Deal Lost</h2>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:24, lineHeight:1.6 }}>
                Select the primary reason this deal was lost to update your analytics.
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {lostReasons.map(reason => (
                  <button key={reason} onClick={() => handleLostReasonSelect(reason)}
                    className="lost-reason-btn"
                    style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#e2e8f0', textAlign:'left', padding:'12px 16px', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                    {reason}
                  </button>
                ))}
              </div>

              <button onClick={() => { setLostModal({ isOpen: false, leadId: null }); fetchLeads(); }}
                style={{ marginTop:22, width:'100%', padding:'11px 0', color:'#475569', fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', background:'none', border:'none', cursor:'pointer', transition:'color 0.18s' }}
                onMouseEnter={e => e.currentTarget.style.color='#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.color='#475569'}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── NAVIGATION ────────────────────────────────────────────────── */}
        <div style={{ width:'100%', maxWidth:1280, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32, position:'relative', zIndex:10 }}>
          <button onClick={() => navigate('/home')}
            className="action-btn mono"
            style={{ color:'#475569', fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:'6px 0' }}
            onMouseEnter={e => e.currentTarget.style.color='#60a5fa'}
            onMouseLeave={e => e.currentTarget.style.color='#475569'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Routing
          </button>

          <button onClick={() => setShowAdmin(!showAdmin)}
            className="action-btn mono"
            style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', padding:'7px 14px', borderRadius:8, cursor:'pointer', transition:'all 0.18s',
              background: showAdmin ? 'rgba(127,29,29,0.25)' : 'rgba(255,255,255,0.04)',
              border: showAdmin ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.1)',
              color: showAdmin ? '#f87171' : '#64748b' }}>
            {showAdmin ? 'Close Admin' : 'Admin Access'}
          </button>
        </div>

        {/* ── MAIN PANEL ────────────────────────────────────────────────── */}
        <div className="glass-surface w-full p-8 flex flex-col gap-8"
          style={{ maxWidth:1280, borderRadius:20, position:'relative', zIndex:10 }}>

          {/* ADMIN PANEL */}
          {showAdmin && (
            <div style={{ background:'rgba(127,29,29,0.12)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:14, padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, animation:'fadeSlideUp 0.3s ease both' }}>
              <div>
                <span className="section-label" style={{ color:'#f87171' }}>System Purge Protocol</span>
                <p style={{ color:'#94a3b8', fontSize:12, marginTop:4 }}>This action is irreversible. All lead data will be permanently erased.</p>
              </div>
              <button onClick={handleWipeDatabase} disabled={isWiping}
                className="action-btn mono"
                style={{ background:'rgba(220,38,38,0.8)', color:'#fff', border:'none', borderRadius:10, padding:'11px 22px', fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', cursor: isWiping ? 'not-allowed' : 'pointer', whiteSpace:'nowrap' }}>
                {isWiping ? <><Spinner />Wiping…</> : 'Purge Database'}
              </button>
            </div>
          )}

          {/* HEADER */}
          <div style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', paddingBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:16 }}>
            <div>
              <p className="section-label" style={{ marginBottom:6 }}>CRM Intelligence Suite</p>
              <h1 style={{ fontSize:28, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em', lineHeight:1.1 }}>
                Master Pipeline
              </h1>
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <button onClick={handleDownloadExcel}
                className="action-btn"
                style={{ border:'1px solid rgba(255,255,255,0.12)', color:'#e2e8f0', background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'9px 16px', fontSize:12, display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:500 }}>
                <svg className="w-4 h-4" style={{ color:'#4ade80' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                Export Data
              </button>

              {hasUnsavedChanges && (
                <button onClick={handleSaveChanges} disabled={isSaving}
                  className="save-btn"
                  style={{ background:'rgba(22,163,74,0.85)', color:'#fff', border:'1px solid rgba(34,197,94,0.3)', borderRadius:10, padding:'9px 20px', fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                  {isSaving ? <><Spinner />Saving…</> : '💾 Save Changes'}
                </button>
              )}

              <button onClick={fetchLeads}
                className="action-btn mono"
                style={{ color:'#64748b', border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'9px 14px', fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.13em', textTransform:'uppercase', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color='#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.color='#64748b'}>
                Refresh DB
              </button>
            </div>
          </div>

          {/* ── KPIs ──────────────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14 }}>

            {/* Total Pipeline */}
            <div className="kpi-card" style={{ animationDelay:'0ms', background:'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'20px 22px' }}>
              <p className="section-label" style={{ marginBottom:10 }}>Total Pipeline</p>
              <p style={{ fontSize:26, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em', animation:'numberCount 0.4s ease both' }}>
                ₹{totalValue.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Closed Won */}
            <div className="kpi-card" style={{ animationDelay:'60ms', background:'linear-gradient(135deg, rgba(21,128,61,0.18), rgba(21,128,61,0.06))', border:'1px solid rgba(34,197,94,0.18)', borderRadius:14, padding:'20px 22px' }}>
              <p className="section-label" style={{ color:'#4ade80', marginBottom:10 }}>✅ Closed Won</p>
              <p style={{ fontSize:26, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em' }}>
                {leads.filter(l => l.status === 'Closed - Won').length} <span style={{ fontSize:14, fontWeight:400, color:'#64748b' }}>Deals</span>
              </p>
            </div>

            {/* Active Leads */}
            <div className="kpi-card" style={{ animationDelay:'120ms', background:'linear-gradient(135deg, rgba(30,64,175,0.18), rgba(30,64,175,0.06))', border:'1px solid rgba(59,130,246,0.18)', borderRadius:14, padding:'20px 22px' }}>
              <p className="section-label" style={{ color:'#60a5fa', marginBottom:10 }}>💼 Active Leads</p>
              <p style={{ fontSize:26, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em' }}>{activeLeads.length}</p>
            </div>

            {/* Closed Lost */}
            <div className="kpi-card" style={{ animationDelay:'180ms', background:'linear-gradient(135deg, rgba(127,29,29,0.18), rgba(127,29,29,0.06))', border:'1px solid rgba(239,68,68,0.18)', borderRadius:14, padding:'20px 22px' }}>
              <p className="section-label" style={{ color:'#f87171', marginBottom:10 }}>❌ Closed Lost</p>
              <p style={{ fontSize:26, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em' }}>
                {lostLeads.length} <span style={{ fontSize:14, fontWeight:400, color:'#64748b' }}>Deals</span>
              </p>
            </div>

            {/* 🔥 HOT PIPELINE – NEW KPI CARD */}
            <div className="hot-kpi" style={{ animationDelay:'240ms', background:'linear-gradient(135deg, rgba(127,29,29,0.22), rgba(154,52,18,0.12))', border:'1px solid rgba(239,68,68,0.3)', borderRadius:14, padding:'20px 22px', cursor:'pointer', position:'relative', overflow:'hidden' }}
              onClick={() => setShowHotPipeline(v => !v)}
              title="Click to reveal / hide Hot Pipeline value">

              {/* Subtle fire shimmer strip */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), rgba(251,146,60,0.6), transparent)', borderRadius:'14px 14px 0 0' }} />

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <p className="section-label" style={{ color:'#fb923c', marginBottom:10 }}>🔥 Hot Pipeline</p>
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, color:'#64748b', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>
                  {hotPipelineCount} leads
                </span>
              </div>

              {showHotPipeline ? (
                <p style={{ fontSize:26, fontWeight:700, color:'#fca5a5', letterSpacing:'-0.02em', animation:'numberCount 0.35s ease both' }}>
                  ₹{hotPipelineValue.toLocaleString('en-IN')}
                </p>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <p style={{ fontSize:22, fontWeight:700, color:'#475569', letterSpacing:'0.08em', filter:'blur(5px)', userSelect:'none' }}>
                    ₹——————
                  </p>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, color:'#64748b', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                    tap to reveal
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* ── GRAPH ROW 1: FUNNEL & LOST REASONS ────────────────────── */}
          {leads.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              <div className="chart-panel" style={{ animationDelay:'80ms', background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'18px 20px', height:290, display:'flex', flexDirection:'column' }}>
                <p className="section-label" style={{ textAlign:'center', marginBottom:12 }}>The Sales Funnel</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ top:4, right:28, left:16, bottom:4 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={100} fontFamily="JetBrains Mono, monospace" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0,6,6,0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-panel" style={{ animationDelay:'120ms', background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'18px 20px', height:290, display:'flex', flexDirection:'column' }}>
                <p className="section-label" style={{ textAlign:'center', marginBottom:12 }}>Lost Reason Breakdown</p>
                <ResponsiveContainer width="100%" height="100%">
                  {lostReasonData.length > 0 ? (
                    <PieChart>
                      <Pie data={lostReasonData} cx="50%" cy="50%" innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value">
                        {lostReasonData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize:10, color:'#64748b', fontFamily:'JetBrains Mono, monospace' }} />
                    </PieChart>
                  ) : (
                    <div style={{ display:'flex', height:'100%', alignItems:'center', justifyContent:'center', color:'#334155', fontFamily:'JetBrains Mono, monospace', fontSize:11 }}>
                      No lost deals recorded yet.
                    </div>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── GRAPH ROW 2: SOURCES & TEMPERATURE ────────────────────── */}
          {leads.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:8 }}>

              <div className="chart-panel" style={{ animationDelay:'160ms', background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'18px 20px', height:290, display:'flex', flexDirection:'column' }}>
                <p className="section-label" style={{ textAlign:'center', marginBottom:12 }}>Lead Quality by Source</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceQualityData} margin={{ top:20, right:16, left:0, bottom:0 }}>
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} fontFamily="JetBrains Mono, monospace" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                    <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize:10, fontFamily:'JetBrains Mono, monospace' }} />
                    <Bar dataKey="Won"    stackId="a" fill="#22c55e" radius={[0,0,5,5]} />
                    <Bar dataKey="Active" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Lost"   stackId="a" fill="#ef4444" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-panel" style={{ animationDelay:'200ms', background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'18px 20px', height:290, display:'flex', flexDirection:'column' }}>
                <p className="section-label" style={{ textAlign:'center', marginBottom:12 }}>Active Lead Temperature</p>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={0} outerRadius={80} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize:10, color:'#64748b', fontFamily:'JetBrains Mono, monospace' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── DATA GRID ─────────────────────────────────────────────── */}
          <div style={{ overflowX:'auto' }}>
            {isLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'16px 0' }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="shine-loader" style={{ height:56, borderRadius:10, animationDelay:`${i * 80}ms` }} />
                ))}
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1100 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                    {['Date / Source', 'Client Info', 'Requirement', 'Pipeline Stage', 'Temp', 'Value (₹)'].map(col => (
                      <th key={col} className="section-label" style={{ padding:'10px 16px', fontWeight:500, textAlign: col === 'Value (₹)' ? 'right' : col === 'Pipeline Stage' || col === 'Temp' ? 'center' : 'left' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, idx) => (
                    <tr key={lead.id} className="table-row"
                      style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', animationDelay:`${Math.min(idx * 25, 300)}ms` }}>

                      {/* Date / Source */}
                      <td style={{ padding:'14px 16px', whiteSpace:'nowrap' }}>
                        <p style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#e2e8f0', marginBottom:5 }}>{lead.date}</p>
                        <span style={{
                          fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
                          padding:'2px 7px', borderRadius:5, display:'inline-block',
                          ...(lead.source === 'IndiaMart'  ? { color:'#60a5fa', background:'rgba(59,130,246,0.1)',  border:'1px solid rgba(59,130,246,0.2)' } :
                             lead.source === 'TradeIndia' ? { color:'#fbbf24', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)' } :
                             { color:'#94a3b8', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' })
                        }}>
                          {lead.source}
                        </span>
                      </td>

                      {/* Client Info */}
                      <td style={{ padding:'14px 16px' }}>
                        <p style={{ fontSize:13, fontWeight:600, color:'#f1f5f9', marginBottom:3 }}>{lead.name}</p>
                        <p style={{ fontSize:11, color:'#475569', fontFamily:'JetBrains Mono, monospace' }}>
                          {lead.company_name || '—'} · {lead.phone}
                        </p>
                      </td>

                      {/* Requirement + Notes */}
                      <td style={{ padding:'14px 16px', maxWidth:250 }}>
                        <p style={{ fontSize:13, color:'#e2e8f0', fontWeight:500, marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {lead.requirement}
                        </p>
                        <button onClick={() => setActiveLead(lead)}
                          className="note-btn"
                          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#64748b', padding:'4px 10px', borderRadius:7, fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}
                          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#94a3b8'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='#64748b'; }}>
                          📝 {lead.notes && lead.notes.includes('[') ? 'View/Add Notes' : '+ Add Note'}
                        </button>
                      </td>

                      {/* Pipeline Stage */}
                      <td style={{ padding:'14px 16px', textAlign:'center' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'center' }}>
                          <select value={lead.status || 'New'}
                            onChange={e => handleCellEdit(lead.id, 'status', e.target.value)}
                            className="stage-select mono"
                            style={{ background:'#070f22', borderRadius:8, padding:'7px 22px 7px 10px', fontFamily:'JetBrains Mono, monospace', fontSize:11, outline:'none', width:128, cursor:'pointer', ...stageStyle(lead.status || 'New') }}>
                            {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {lead.status === 'Closed - Lost' && lead.lost_reason && (
                            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, color:'rgba(248,113,113,0.7)', maxWidth:122, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={lead.lost_reason}>
                              ↳ {lead.lost_reason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Temperature */}
                      <td style={{ padding:'14px 16px', textAlign:'center' }}>
                        <select value={lead.lead_temp || 'Cold'}
                          onChange={e => handleCellEdit(lead.id, 'lead_temp', e.target.value)}
                          className="temp-select mono"
                          style={{ background:'#070f22', borderRadius:8, padding:'7px 22px 7px 10px', fontFamily:'JetBrains Mono, monospace', fontSize:11, outline:'none', cursor:'pointer', ...tempStyle(lead.lead_temp) }}>
                          <option value="Cold">❄️ Cold</option>
                          <option value="Warm">🌡️ Warm</option>
                          <option value="Hot">🔥 Hot</option>
                        </select>
                      </td>

                      {/* Value */}
                      <td style={{ padding:'14px 16px', textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                          <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:13, color:'#4ade80', fontWeight:600 }}>₹</span>
                          <input type="number"
                            value={lead.price || ''}
                            onChange={e => handleCellEdit(lead.id, 'price', e.target.value)}
                            placeholder="0"
                            className="price-input mono"
                            style={{ background:'#070f22', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'7px 10px', fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#4ade80', width:96, textAlign:'right' }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
