import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';

export default function Database() {
  const navigate = useNavigate();
  
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // === BULK SELECTION STATE ===
  const [selectedLeads, setSelectedLeads] = useState([]);

  // === MODAL STATES ===
  const [activeLead, setActiveLead] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [isAppending, setIsAppending] = useState(false);
  const [lostModal, setLostModal] = useState({ isOpen: false, leadId: null });
  
  // 📝 UPDATED: User Dropdown Names
  const [noteUser, setNoteUser] = useState("Ritthik Kumar");
  const users = [
    "Ritthik Kumar", 
    "Soundararajan B", 
    "Business Management Executive (BME)"
  ];

  // 🎯 UPDATED: TARGET TRACKER STATE (Turnover instead of Count)
  const [targetTurnover, setTargetTurnover] = useState(5000000); // Default to 50 Lakhs

  const pipelineStages = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won', 'Closed - Lost'];
  const lostReasons = ['💸 Price too high', '🤝 Chose a Competitor', '👻 Ghosted / Unresponsive', '❌ Junk Lead', '🔧 Wrong Machine'];

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  const fetchDatabaseData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Target Turnover from Settings Table
      const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'yearly_target').single();
      if (settingsData) setTargetTurnover(Number(settingsData.value));

      // 2. Fetch Leads
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      // Deduplicate leads for safety
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

  // ⚡ AUTO-SAVE: INLINE CELL EDITING
  const handleCellEdit = async (id, field, value) => {
    if (field === 'status' && value === 'Closed - Lost') {
      setLostModal({ isOpen: true, leadId: id });
      return;
    }

    // Optimistic UI Update
    setLeads(prevLeads => prevLeads.map(lead => {
      if (lead.id === id) {
        let updatedLead = { ...lead, [field]: value };
        if (field === 'status') updatedLead.lost_reason = null;
        return updatedLead;
      }
      return lead;
    }));

    // Background Auto-Save to Supabase
    try {
      const updatePayload = { [field]: value };
      if (field === 'status') updatePayload.lost_reason = null;

      const { error } = await supabase.from('leads').update(updatePayload).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error("Auto-save failed:", error.message);
    }
  };

  // ⚡ AUTO-SAVE: LOST REASON SELECTION
  const handleLostReasonSelect = async (reason) => {
    const targetId = lostModal.leadId;
    setLeads(prevLeads => prevLeads.map(lead => lead.id === targetId ? { ...lead, status: 'Closed - Lost', lost_reason: reason } : lead));
    setLostModal({ isOpen: false, leadId: null });

    try {
      await supabase.from('leads').update({ status: 'Closed - Lost', lost_reason: reason }).eq('id', targetId);
    } catch (error) {
      console.error("Auto-save failed:", error.message);
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

  // 🗑️ BULK DELETION LOGIC
  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedLeads(leads.map(l => l.id));
    else setSelectedLeads([]);
  };

  const handleSelectLead = (id) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    const confirm = window.confirm(`⚠️ Are you sure you want to permanently delete ${selectedLeads.length} leads?`);
    if (!confirm) return;

    try {
      const { error } = await supabase.from('leads').delete().in('id', selectedLeads);
      if (error) throw error;
      
      setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
      setSelectedLeads([]);
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
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

  // APPEND NOTES LOGIC
  const handleAppendNote = async () => {
    if (!newNote.trim() || !activeLead) return;
    try {
      setIsAppending(true);
      const now = new Date();
      const timestamp = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}] [${noteUser}]`;
      
      const updatedNotes = activeLead.notes ? `${activeLead.notes}\n${timestamp} ${newNote.trim()}` : `${timestamp} ${newNote.trim()}`;

      await supabase.from('leads').update({ notes: updatedNotes }).eq('id', activeLead.id);
      
      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, notes: updatedNotes } : l));
      setActiveLead(prev => ({ ...prev, notes: updatedNotes }));
      setNewNote("");
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
  
  // 💰 UPDATED: Calculate Total Revenue of "Closed - Won" deals instead of just count
  const dealsWonValue = leads.filter(l => l.status === 'Closed - Won').reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);
  
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
            
            <div className="flex gap-4">
              {/* UPDATED: Dynamic width for larger names */}
              <select 
                value={noteUser} 
                onChange={(e) => setNoteUser(e.target.value)}
                className="bg-navy border border-white/20 px-4 py-3 rounded text-white font-mono text-sm focus:outline-none focus:border-primary max-w-xs truncate transition-colors"
              >
                {users.map(u => <option key={u} value={u} className="bg-slate-900 text-white">{u}</option>)}
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
            <p className="text-secondary text-sm mb-6">Select the primary reason this deal was lost.</p>
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
              onClick={() => { setLostModal({ isOpen: false, leadId: null }); fetchDatabaseData(); }}
              className="mt-6 w-full py-3 text-secondary hover:text-white font-mono text-xs tracking-widest uppercase transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Routing
        </button>
        <button onClick={() => setShowAdmin(!showAdmin)} className={`font-mono text-xs uppercase tracking-widest px-3 py-1 rounded border transition-colors ${showAdmin ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-secondary hover:text-white'}`}>
          {showAdmin ? 'Close Admin' : 'Admin Access'}
        </button>
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

        {/* HEADER CONTROLS */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Master CRM Analytics</h1>
              <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase animate-pulse">
                Auto-Save Active
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={handleDownloadExcel} className="border border-white/20 hover:border-white/50 text-white font-mono text-sm tracking-widest uppercase px-4 py-2 rounded transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Export Data
            </button>
            <button onClick={fetchDatabaseData} className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded">Refresh DB</button>
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
        {/* FULL WIDTH TEMPERATURE DONUT CHART         */}
        {/* ========================================== */}
        {leads.length > 0 && pieData.length > 0 && (
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
        {/* 🚀 TARGET TRACKER & PAGE NAVIGATION        */}
        {/* ========================================== */}
        <div className="w-full flex flex-col gap-6 py-6 border-y border-white/5 bg-gradient-to-r from-transparent via-white/5 to-transparent">
          
          <div className="flex flex-col md:flex-row justify-center items-center gap-6">
            <div className="bg-black/20 border border-green-500/30 px-6 py-3 rounded-lg flex items-center gap-4 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <span className="text-secondary text-xs font-mono uppercase tracking-widest">✅ Total Revenue Won</span>
              {/* UPDATED: Displays formatted currency sum of won deals */}
              <span className="text-green-400 font-bold text-2xl">₹{dealsWonValue.toLocaleString('en-IN')}</span>
            </div>
            
            <div className="text-white/20 font-bold text-2xl hidden md:block">/</div>

            <div className="bg-black/20 border border-blue-500/30 px-6 py-3 rounded-lg flex items-center gap-4 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <span className="text-secondary text-xs font-mono uppercase tracking-widest">🎯 Target Turnover</span>
              <div className="flex items-center gap-1">
                <span className="text-blue-300 font-bold text-2xl">₹</span>
                {/* UPDATED: Much wider input to handle large monetary values */}
                <input 
                  type="number" 
                  defaultValue={targetTurnover}
                  onBlur={handleTargetBlur}
                  className="bg-navy border border-blue-500/50 px-3 py-1 rounded text-blue-300 font-bold text-2xl w-40 focus:outline-none focus:border-blue-400 text-center transition-colors hover:bg-white/5"
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

        {/* ========================================== */}
        {/* DATA GRID WITH INLINE EDITING & BULK DELETE */}
        {/* ========================================== */}
        <div className="overflow-x-auto relative">
          
          {selectedLeads.length > 0 && (
            <div className="absolute top-0 left-0 w-full bg-red-900/90 backdrop-blur border-b border-red-500/50 p-3 flex justify-between items-center z-20 shadow-xl rounded-t">
              <span className="text-red-200 font-mono text-sm tracking-widest uppercase ml-4">
                {selectedLeads.length} Lead(s) Selected
              </span>
              <button 
                onClick={handleDeleteSelected}
                className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs tracking-widest uppercase px-4 py-2 rounded transition-colors"
              >
                🗑️ Delete Selected
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-secondary font-mono">LOADING DATA...</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1200px] mt-2">
              <thead>
                <tr className="border-b border-white/10 text-secondary font-mono text-xs uppercase tracking-wider">
                  <th className="py-4 px-4 w-10">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-2 font-medium">Date/Source</th>
                  <th className="py-4 px-2 font-medium">Client Info</th>
                  <th className="py-4 px-2 font-medium">Requirement</th>
                  <th className="py-4 px-2 font-medium text-center">Pipeline Stage</th>
                  <th className="py-4 px-2 font-medium text-center">Temp</th>
                  <th className="py-4 px-4 font-medium text-right">Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                    
                    <td className="py-4 px-4">
                      <input 
                        type="checkbox" 
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>

                    <td className="py-4 px-2">
                      <div className="flex flex-col gap-1 w-32">
                        <input 
                          type="date"
                          defaultValue={lead.date}
                          onBlur={(e) => { if(e.target.value !== lead.date) handleCellEdit(lead.id, 'date', e.target.value) }}
                          className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-white font-mono text-sm outline-none transition-colors"
                        />
                        <select
                          value={lead.source || 'Website'}
                          onChange={(e) => handleCellEdit(lead.id, 'source', e.target.value)}
                          className={`bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded font-mono text-[10px] tracking-widest uppercase outline-none transition-colors cursor-pointer ${
                            lead.source === 'IndiaMart' ? 'text-blue-400' : 
                            lead.source === 'TradeIndia' ? 'text-amber-400' : 
                            lead.source === 'Alibaba' ? 'text-orange-400' :
                            'text-secondary'
                          }`}
                        >
                          <option className="bg-slate-900 text-white" value="Website">WEBSITE</option>
                          <option className="bg-slate-900 text-white" value="YouTube">YOUTUBE</option>
                          <option className="bg-slate-900 text-white" value="LinkedIn">LINKEDIN</option>
                          <option className="bg-slate-900 text-white" value="Direct">DIRECT</option>
                          <option className="bg-slate-900 text-white" value="Referral">REFERRAL</option>
                          <option className="bg-slate-900 text-white" value="Alibaba">ALIBABA</option>
                          <option className="bg-slate-900 text-white" value="IndiaMart">INDIAMART</option>
                          <option className="bg-slate-900 text-white" value="TradeIndia">TRADEINDIA</option>
                          <option className="bg-slate-900 text-white" value="Manual Entry">MANUAL ENTRY</option>
                        </select>
                      </div>
                    </td>

                    <td className="py-4 px-2">
                      <div className="flex flex-col gap-1 w-48">
                        <input 
                          type="text"
                          defaultValue={lead.name}
                          placeholder="Client Name"
                          onBlur={(e) => { if(e.target.value !== lead.name) handleCellEdit(lead.id, 'name', e.target.value) }}
                          className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-white font-medium outline-none transition-colors text-sm"
                        />
                        <div className="flex items-center gap-1">
                          <input 
                            type="text"
                            defaultValue={lead.company_name}
                            placeholder="Company"
                            onBlur={(e) => { if(e.target.value !== lead.company_name) handleCellEdit(lead.id, 'company_name', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-onSurfaceVariant text-xs outline-none transition-colors w-full"
                          />
                        </div>
                        <input 
                          type="text"
                          defaultValue={lead.phone}
                          placeholder="Phone"
                          onBlur={(e) => { if(e.target.value !== lead.phone) handleCellEdit(lead.id, 'phone', e.target.value) }}
                          className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-onSurfaceVariant text-xs outline-none transition-colors w-full"
                        />
                      </div>
                    </td>
                    
                    <td className="py-4 px-2">
                      <div className="flex flex-col items-start gap-2 w-64">
                        <textarea 
                          defaultValue={lead.requirement}
                          placeholder="Machine Requirement..."
                          onBlur={(e) => { if(e.target.value !== lead.requirement) handleCellEdit(lead.id, 'requirement', e.target.value) }}
                          className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-2 py-1 rounded text-white font-medium outline-none transition-colors text-sm resize-none w-full h-12"
                        />
                        <button 
                          onClick={() => setActiveLead(lead)}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-secondary hover:text-white px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1"
                        >
                          📝 {lead.notes && lead.notes.includes('[') ? 'View/Add Notes' : '+ Add Note'}
                        </button>
                      </div>
                    </td>
                    
                    <td className="py-4 px-2 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <select 
                          value={lead.status || 'New'}
                          onChange={(e) => handleCellEdit(lead.id, 'status', e.target.value)}
                          className={`bg-navy border px-2 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors w-32 cursor-pointer ${
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

                    <td className="py-4 px-2 text-center">
                      <select 
                        value={lead.lead_temp || 'Cold'} 
                        onChange={(e) => handleCellEdit(lead.id, 'lead_temp', e.target.value)}
                        className={`bg-navy border px-2 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors cursor-pointer ${
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
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-green-500 font-mono text-sm">₹</span>
                        <input 
                          type="number" 
                          defaultValue={lead.price || ''}
                          onBlur={(e) => { if(e.target.value !== lead.price) handleCellEdit(lead.id, 'price', e.target.value) }}
                          placeholder="0"
                          className="bg-transparent border border-transparent hover:border-white/20 focus:bg-navy focus:border-green-500 px-2 py-1.5 rounded font-mono text-sm text-green-400 focus:outline-none w-24 text-right transition-colors"
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
