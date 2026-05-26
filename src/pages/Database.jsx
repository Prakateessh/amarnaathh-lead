import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Database() {
  const navigate = useNavigate();
  
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // === NEW: NOTES MODAL STATE ===
  const [activeLead, setActiveLead] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [isAppending, setIsAppending] = useState(false);

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

  const handleCellEdit = (id, field, value) => {
    setLeads(prevLeads => prevLeads.map(lead => 
      lead.id === id ? { ...lead, [field]: value } : lead
    ));
    setHasUnsavedChanges(true);
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

  // === NEW: TIMESTAMPED NOTE APPENDER ===
  const handleAppendNote = async () => {
    if (!newNote.trim() || !activeLead) return;

    try {
      setIsAppending(true);
      
      // 1. Generate Timestamp [YYYY-MM-DD HH:MM]
      const now = new Date();
      const timestamp = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
      
      // 2. Combine old notes with new note
      const updatedNotes = activeLead.notes 
        ? `${activeLead.notes}\n${timestamp} ${newNote.trim()}`
        : `${timestamp} ${newNote.trim()}`;

      // 3. Save directly to Supabase immediately
      const { error } = await supabase
        .from('leads')
        .update({ notes: updatedNotes })
        .eq('id', activeLead.id);

      if (error) throw error;

      // 4. Update local state so UI updates instantly
      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, notes: updatedNotes } : l));
      
      // 5. Cleanup
      setNewNote("");
      setActiveLead(null); // Closes Modal

    } catch (error) {
      alert(`Failed to append note: ${error.message}`);
    } finally {
      setIsAppending(false);
    }
  };

  // --- KPI CALCULATIONS ---
  const hotCount = leads.filter(l => l.lead_temp === 'Hot').length;
  const warmCount = leads.filter(l => l.lead_temp === 'Warm').length;
  const coldCount = leads.filter(l => l.lead_temp === 'Cold' || !l.lead_temp).length;
  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);
  const hotValue = leads.filter(l => l.lead_temp === 'Hot').reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const warmValue = leads.filter(l => l.lead_temp === 'Warm').reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const coldValue = leads.filter(l => l.lead_temp === 'Cold' || !l.lead_temp).reduce((sum, l) => sum + (Number(l.price) || 0), 0);

  const pieData = [
    { name: 'Hot', value: hotCount, color: '#ef4444' },
    { name: 'Warm', value: warmCount, color: '#f59e0b' },
    { name: 'Cold', value: coldCount, color: '#06b6d4' }
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Hot', value: hotValue, fill: '#ef4444' },
    { name: 'Warm', value: warmValue, fill: '#f59e0b' },
    { name: 'Cold', value: coldValue, fill: '#06b6d4' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* --- NEW: NOTES MODAL OVERLAY --- */}
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

            {/* Note History Area */}
            <div className="bg-black/30 rounded border border-white/5 p-4 h-64 overflow-y-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
              {activeLead.notes ? activeLead.notes : "No notes recorded yet."}
            </div>

            {/* Input Area */}
            <textarea 
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type new update here..."
              className="bg-white/5 border border-white/20 rounded p-3 text-white font-sans focus:outline-none focus:border-primary resize-none h-24"
            />
            
            <button 
              onClick={handleAppendNote}
              disabled={isAppending || !newNote.trim()}
              className="bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-mono text-sm tracking-widest uppercase py-3 rounded transition-colors flex justify-center items-center"
            >
              {isAppending ? 'Appending...' : '📌 Append Note'}
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
          <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 w-full">
              <h3 className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">System Purge Protocol</h3>
              <p className="text-onSurfaceVariant text-xs">Danger: Wiping the database is permanent and cannot be undone.</p>
            </div>
            <button onClick={handleWipeDatabase} disabled={isWiping} className="bg-red-600 hover:bg-red-500 text-white font-mono text-sm uppercase px-6 py-3 rounded whitespace-nowrap">
              {isWiping ? 'Wiping...' : 'PURGE DATABASE'}
            </button>
          </div>
        )}

        <div className="border-b border-white/10 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Central CRM Analytics</h1>
          </div>
          <div className="flex gap-4">
            {hasUnsavedChanges && (
              <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-mono text-sm tracking-widest uppercase px-6 py-2 rounded animate-pulse">
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}
            <button onClick={fetchLeads} className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded">Refresh DB</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-5">
            <div className="text-secondary font-mono text-xs uppercase tracking-wider mb-2">Total Pipeline</div>
            <div className="text-3xl font-bold text-white">₹{totalValue.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-5">
            <div className="text-red-400 font-mono text-xs uppercase tracking-wider mb-2">🔥 Hot Value</div>
            <div className="text-3xl font-bold text-white">₹{hotValue.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-5">
            <div className="text-amber-500 font-mono text-xs uppercase tracking-wider mb-2">🌡️ Warm Value</div>
            <div className="text-3xl font-bold text-white">₹{warmValue.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-5">
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-wider mb-2">❄️ Cold Value</div>
            <div className="text-3xl font-bold text-white">₹{coldValue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* CHARTS */}
        {leads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col">
              <span className="text-secondary font-mono text-xs uppercase tracking-wider mb-2 text-center">Lead Temperature</span>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col">
              <span className="text-secondary font-mono text-xs uppercase tracking-wider mb-2 text-center">Pipeline Value</span>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* DATA GRID */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-secondary font-mono">LOADING DATA...</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/10 text-secondary font-mono text-xs uppercase tracking-wider">
                  <th className="py-4 px-4 font-medium">Date</th>
                  <th className="py-4 px-4 font-medium">Client Info</th>
                  <th className="py-4 px-4 font-medium">Requirement</th>
                  <th className="py-4 px-4 font-medium text-center">Temperature</th>
                  <th className="py-4 px-4 font-medium text-right">Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="text-white font-mono text-sm">{lead.date}</span>
                      <div className={`mt-1 text-[9px] font-mono uppercase tracking-widest inline-block px-1 rounded border ${lead.source === 'IndiaMart' ? 'text-blue-400 border-blue-500/30' : lead.source === 'TradeIndia' ? 'text-amber-400 border-amber-500/30' : 'text-secondary border-white/20'}`}>
                        {lead.source}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-white font-medium">{lead.name}</div>
                      <div className="text-onSurfaceVariant text-xs mt-1">{lead.company_name || '—'} | {lead.phone}</div>
                    </td>
                    
                    {/* --- NEW: NOTES TRIGGER IN REQUIREMENT COLUMN --- */}
                    <td className="py-4 px-4 max-w-xs">
                      <div className="text-white font-medium truncate mb-2">{lead.requirement}</div>
                      <button 
                        onClick={() => setActiveLead(lead)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-secondary hover:text-white px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1"
                      >
                        📝 {lead.notes && lead.notes.includes('[') ? 'View/Add Notes' : '+ Add Note'}
                      </button>
                    </td>
                    
                    <td className="py-4 px-4 text-center">
                      <select 
                        value={lead.lead_temp || 'Cold'} 
                        onChange={(e) => handleCellEdit(lead.id, 'lead_temp', e.target.value)}
                        className={`bg-navy border px-3 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors ${
                          lead.lead_temp === 'Hot' ? 'border-red-500/50 text-red-400' : 
                          lead.lead_temp === 'Warm' ? 'border-amber-500/50 text-amber-400' : 
                          'border-cyan-500/50 text-cyan-400'
                        }`}
                      >
                        <option value="Cold">❄️ Cold</option>
                        <option value="Warm">🌡️ Warm</option>
                        <option value="Hot">🔥 Hot</option>
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
                          className="bg-navy border border-white/10 px-3 py-1.5 rounded font-mono text-sm text-green-400 focus:outline-none focus:border-green-500 w-28 text-right transition-colors hover:border-white/30"
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