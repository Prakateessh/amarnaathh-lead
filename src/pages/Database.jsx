import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';

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
  const [lostModal, setLostModal] = useState({ isOpen: false, leadId: null });
  
  // NEW: User Note Selection
  const [noteUser, setNoteUser] = useState("Ritthik Kumar");
  const users = ["Ritthik Kumar", "Soundararajan B", "BDE"];

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

  // 📝 UPDATED APPEND NOTE LOGIC
  const handleAppendNote = async () => {
    if (!newNote.trim() || !activeLead) return;
    try {
      setIsAppending(true);
      const now = new Date();
      // Added [User X] stamp to the timestamp!
      const timestamp = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}] [${noteUser}]`;
      
      const updatedNotes = activeLead.notes 
        ? `${activeLead.notes}\n${timestamp} ${newNote.trim()}`
        : `${timestamp} ${newNote.trim()}`;

      const { error } = await supabase.from('leads').update({ notes: updatedNotes }).eq('id', activeLead.id);
      if (error) throw error;

      // Update background list
      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, notes: updatedNotes } : l));
      
      // Update the active modal immediately so we don't have to close it!
      setActiveLead(prev => ({ ...prev, notes: updatedNotes }));
      
      setNewNote("");
      // Notice: We NO LONGER call setActiveLead(null) so the modal stays wide open.
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
    worksheet['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 50 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Master Pipeline");
    XLSX.writeFile(workbook, `CRM_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ==========================================
  // 📊 DATA ANALYTICS & GRAPH CALCULATIONS
  // ==========================================

  const activeLeads = leads.filter(l => l.status !== 'Closed - Lost');
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

      {/* --- MODAL 1: NOTES OVERLAY --- */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy border border-white/20 p-6 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">📝 Lead Dossier: {activeLead.name}</h3>
                <p className="text-sm text-secondary font-mono mt-1">{activeLead.company_name || activeLead.phone}</p>
              </div>
              <button onClick={() => {setActiveLead(null); setNewNote("");}} className="text-secondary hover:text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="bg-black/30 rounded border border-white/5 p-4 h-64 overflow-y-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
              {activeLead.notes ? activeLead.notes : "No notes recorded yet."}
            </div>
            
            <textarea 
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type new update here..."
              className="bg-white/5 border border-white/20 rounded p-3 text-white font-sans focus:outline-none focus:border-primary resize-none h-24"
            />
            
            {/* NEW: User Selection and Append Button Row */}
            <div className="flex gap-4">
              <select 
                value={noteUser} 
                onChange={(e) => setNoteUser(e.target.value)}
                className="bg-navy border border-white/20 px-4 py-3 rounded text-white font-mono text-sm focus:outline-none focus:border-primary w-40 transition-colors"
              >
                {users.map(u => (
                  <option key={u} value={u} className="bg-slate-900 text-white">{u}</option>
                ))}
              </select>

              <button 
                onClick={handleAppendNote}
                disabled={isAppending || !newNote.trim()}
                className="flex-1 bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-mono text-sm tracking-widest uppercase py-3 rounded transition-colors"
              >
                {isAppending ? 'Appending...' : '📌 Append Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: LOST REASON OVERLAY --- */}
      {lostModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy border border-red-500/30 p-6 rounded-lg shadow-2xl max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2">Deal Lost</h2>
            <p className="text-secondary text-sm mb-6">Select the primary reason this deal was lost to update your analytics.</p>
            <div className="flex flex-col gap-3">
              {lostReasons.map(reason => (
                <button 
                  key={reason}
                  onClick={() => handleLostReasonSelect(reason)}
                  className="bg-white/5 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 border border-white/10 text-white text-left px-4 py-3 rounded transition-colors text-sm font-medium"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button 
              onClick={() => {
                setLostModal({ isOpen: false, leadId: null });
                fetchLeads(); 
              }}
              className="mt-6 w-full py-3 text-secondary hover:text-white font-mono text-xs tracking-widest uppercase transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Routing
        </button>
        <button onClick={() => setShowAdmin(!showAdmin)} className={`font-mono text-xs uppercase tracking-widest px-3 py-1 rounded border transition-colors ${showAdmin ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-secondary hover:text-white'}`}>
          {showAdmin ? 'Close Admin' : 'Admin Access'}
        </button>
      </div>

      <div className="glass-modal w-full max-w-7xl p-8 relative z-10 flex flex-col gap-8 shadow-2xl">
        
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

        {/* HEADER CONTROLS */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Master CRM Analytics</h1>
          </div>
          <div className="flex gap-4">
            <button onClick={handleDownloadExcel} className="border border-white/20 hover:border-white/50 text-white font-mono text-sm tracking-widest uppercase px-4 py-2 rounded transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Export Data
            </button>
            {hasUnsavedChanges && (
              <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-mono text-sm tracking-widest uppercase px-6 py-2 rounded animate-pulse">
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}
            <button onClick={fetchLeads} className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded">Refresh DB</button>
          </div>
        </div>

        {/* ========================================== */}
        {/* KPI DASHBOARD CARDS                        */}
        {/* ========================================== */}
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
            <p className="text-3xl font-bold text-red-300 tracking-tight">
              ₹{hotPipelineValue.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-5 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60"></div>
            <div className="flex justify-between items-start mb-2">
              <p className="text-amber-400 font-mono text-xs uppercase tracking-wider">🌡️ Warm Pipeline</p>
              <span className="font-mono text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">{warmPipelineCount} leads</span>
            </div>
            <p className="text-3xl font-bold text-amber-300 tracking-tight">
              ₹{warmPipelineValue.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-5 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60"></div>
            <div className="flex justify-between items-start mb-2">
              <p className="text-cyan-400 font-mono text-xs uppercase tracking-wider">❄️ Cold Pipeline</p>
              <span className="font-mono text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">{coldPipelineCount} leads</span>
            </div>
            <p className="text-3xl font-bold text-cyan-300 tracking-tight">
              ₹{coldPipelineValue.toLocaleString('en-IN')}
            </p>
          </div>

        </div>

        {/* ========================================== */}
        {/* FULL WIDTH TEMPERATURE DONUT CHART         */}
        {/* ========================================== */}
        {leads.length > 0 && pieData.length > 0 && (
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center h-[500px] mb-2 relative overflow-hidden shadow-2xl">
            {/* Background ambient glow behind the chart */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-white/5 rounded-full blur-[80px] pointer-events-none"></div>

            <span className="text-secondary font-mono text-sm uppercase tracking-widest mb-4 z-10">
              Active Lead Temperature Distribution
            </span>
            
            <ResponsiveContainer width="100%" height="100%">
              {/* 🛠️ FIX: Added large margins so the shadow/edges never touch the box boundary and clip */}
              <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                <Pie 
                  data={pieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={110} 
                  outerRadius={140} 
                  paddingAngle={6} 
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      style={{ filter: `drop-shadow(0px 0px 10px ${entry.color}80)` }} // Glowing CSS shadow
                    />
                  ))}
                </Pie>

                {/* Central Labels inside the Donut */}
                <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-5xl font-bold tracking-tighter">
                  {activeLeads.length}
                </text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-secondary text-xs font-mono tracking-widest">
                  ACTIVE DEALS
                </text>

                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} 
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ========================================== */}
        {/* 🚀 DETAILED ANALYTICS NAVIGATION           */}
        {/* ========================================== */}
        <div className="w-full flex justify-center items-center py-6 mb-4 border-y border-white/5 bg-gradient-to-r from-transparent via-blue-900/10 to-transparent">
          <button 
            onClick={() => navigate('/analytics')}
            className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 hover:text-white font-mono text-sm tracking-widest uppercase px-8 py-4 rounded-lg transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] group"
          >
            <svg className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Open Detailed Analytics Portal
          </button>
        </div>

        {/* ========================================== */}
        {/* DATA GRID WITH NEW PIPELINE DROPDOWN       */}
        {/* ========================================== */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-secondary font-mono">LOADING DATA...</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b border-white/10 text-secondary font-mono text-xs uppercase tracking-wider">
                  <th className="py-4 px-4 font-medium">Date/Source</th>
                  <th className="py-4 px-4 font-medium">Client Info</th>
                  <th className="py-4 px-4 font-medium">Requirement</th>
                  <th className="py-4 px-4 font-medium text-center">Pipeline Stage</th>
                  <th className="py-4 px-4 font-medium text-center">Temp</th>
                  <th className="py-4 px-4 font-medium text-right">Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="text-white font-mono text-sm">{lead.date}</span>
                      <div className={`mt-1 text-[9px] font-mono uppercase tracking-widest inline-block px-1 rounded border ${
                        lead.source === 'IndiaMart' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 
                        lead.source === 'TradeIndia' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 
                        lead.source === 'Alibaba' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                        'text-secondary border-white/20'
                      }`}>
                        {lead.source}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-white font-medium">{lead.name}</div>
                      <div className="text-onSurfaceVariant text-xs mt-1">{lead.company_name || '—'} | {lead.phone}</div>
                    </td>
                    
                    <td className="py-4 px-4 max-w-[250px]">
                      <div className="text-white font-medium truncate mb-2">{lead.requirement}</div>
                      <button 
                        onClick={() => setActiveLead(lead)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-secondary hover:text-white px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1"
                      >
                        📝 {lead.notes && lead.notes.includes('[') ? 'View/Add Notes' : '+ Add Note'}
                      </button>
                    </td>
                    
                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <select 
                          value={lead.status || 'New'}
                          onChange={(e) => handleCellEdit(lead.id, 'status', e.target.value)}
                          className={`bg-navy border px-2 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors w-32 ${
                            lead.status === 'Closed - Won' ? 'border-green-500/50 text-green-400' : 
                            lead.status === 'Closed - Lost' ? 'border-red-500/50 text-red-400' : 
                            lead.status === 'Negotiation' ? 'border-purple-500/50 text-purple-400' :
                            'border-white/20 text-white'
                          }`}
                        >
                          {pipelineStages.map(stage => (
                            <option className="bg-slate-900 text-white" key={stage} value={stage}>{stage}</option>
                          ))}
                        </select>
                        {lead.status === 'Closed - Lost' && lead.lost_reason && (
                          <span className="text-[9px] text-red-400/80 font-mono truncate max-w-[120px]" title={lead.lost_reason}>
                            ↳ {lead.lost_reason}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <select 
                        value={lead.lead_temp || 'Cold'} 
                        onChange={(e) => handleCellEdit(lead.id, 'lead_temp', e.target.value)}
                        className={`bg-navy border px-2 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors ${
                          lead.lead_temp === 'Hot' ? 'border-red-500/50 text-red-400' : 
                          lead.lead_temp === 'Warm' ? 'border-amber-500/50 text-amber-400' : 
                          'border-cyan-500/50 text-cyan-400'
                        }`}
                      >
                        <option className="bg-slate-900 text-white" value="Cold">❄️ Cold</option>
                        <option className="bg-slate-900 text-white" value="Warm">🌡️ Warm</option>
                        <option className="bg-slate-900 text-white" value="Hot">🔥 Hot</option>
                      </select>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-green-500 font-mono text-sm">₹</span>
                        <input 
                          type="number" 
                          value={lead.price || ''}
                          onChange={(e) => handleCellEdit(lead.id, 'price', e.target.value)}
                          placeholder="0"
                          className="bg-navy border border-white/10 px-3 py-1.5 rounded font-mono text-sm text-green-400 focus:outline-none focus:border-green-500 w-24 text-right transition-colors hover:border-white/30"
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
  );
}
