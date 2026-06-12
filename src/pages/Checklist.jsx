import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
};

export default function Checklist() {
  const navigate = useNavigate();

  // ── STATE: MAIN TABLE ──
  const [checklistLeads, setChecklistLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── STATE: MODAL & SEARCH ──
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [recentLeads, setRecentLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── STATE: SCHEDULING FORM ──
  const [selectedLead, setSelectedLead] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ call: '', gmeet: '', visit: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchChecklist();
  }, []);

  // 1. Fetch leads and filter intelligently (FIXED: created_at)
  const fetchChecklist = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, name, phone, category, 
          tentative_call_date, call_attended, 
          gmeet_date, gmeet_attended, 
          direct_visit_date, direct_visit_attended,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Bulletproof filtering
      const activeLeads = (data || []).filter(lead => 
        (lead.tentative_call_date && String(lead.tentative_call_date).trim() !== '') || 
        (lead.gmeet_date && String(lead.gmeet_date).trim() !== '') || 
        (lead.direct_visit_date && String(lead.direct_visit_date).trim() !== '')
      );
      
      setChecklistLeads(activeLeads);
      
    } catch (err) {
      console.error('Error fetching checklist:', err.message);
      alert(`Database Error: ${err.message}`); 
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Open Modal & Fetch 10 Recent Leads (FIXED: created_at)
  const handleOpenAddModal = async () => {
    setIsAddModalOpen(true);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedLead(null);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, company_name, phone, tentative_call_date, gmeet_date, direct_visit_date')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRecentLeads(data || []);
    } catch (err) {
      console.error('Error fetching recent leads:', err.message);
    }
  };

  // 3. Live Search Function 
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('id, name, company_name, phone, tentative_call_date, gmeet_date, direct_visit_date')
          .or(`name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .limit(10);
        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Search error:', err.message);
      } finally {
        setIsSearching(false);
      }
    }, 400); 
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // 4. Handle Checkbox/Status Toggle
  const handleToggleStatus = async (leadId, field, currentValue) => {
    try {
      setChecklistLeads(prev => prev.map(lead => 
        lead.id === leadId ? { ...lead, [field]: !currentValue } : lead
      ));
      
      const { error } = await supabase
        .from('leads')
        .update({ [field]: !currentValue })
        .eq('id', leadId);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error updating status:', err.message);
      fetchChecklist(); 
    }
  };

  // 5. Select a lead
  const handleSelectLead = (lead) => {
    setSelectedLead(lead);
    setScheduleForm({
      call: lead.tentative_call_date || '',
      gmeet: lead.gmeet_date || '',
      visit: lead.direct_visit_date || ''
    });
  };

  // 6. Save the new dates
  const handleSaveSchedule = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          tentative_call_date: scheduleForm.call || null,
          gmeet_date: scheduleForm.gmeet || null,
          direct_visit_date: scheduleForm.visit || null
        })
        .eq('id', selectedLead.id);

      if (error) throw error;
      
      setIsAddModalOpen(false);
      fetchChecklist();
    } catch (err) {
      console.error('Error saving schedule:', err.message);
      alert('Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  // ── RENDER HELPERS ──
  const renderStatusBadge = (date, isAttended, fieldName, leadId) => {
    if (!date) return <span className="text-slate-300 italic text-sm">Not Scheduled</span>;
    
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="font-mono text-sm text-slate-700 font-bold">{formatDisplayDate(date)}</span>
        <button 
          onClick={() => handleToggleStatus(leadId, fieldName, isAttended)}
          className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-md transition-all shadow-sm ${
            isAttended 
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200' 
              : 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200'
          }`}
        >
          {isAttended ? '✓ Attended' : 'Pending'}
        </button>
      </div>
    );
  };

  const listToDisplay = searchQuery.trim() ? searchResults : recentLeads;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-7xl relative z-10 mb-8 flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/home')} className="p-3 bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-900 rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Active Itinerary</h1>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Meeting & Visit Checklist</p>
          </div>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white font-black px-6 py-4 rounded-xl flex items-center gap-3 transition-all shadow-md"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Schedule Action
        </button>
      </div>

      <div className="w-full max-w-7xl relative z-10 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 text-sm font-black uppercase tracking-widest">
                <th className="p-6">Lead / Phone</th>
                <th className="p-6">Category</th>
                <th className="p-6 border-l border-slate-200 bg-blue-50/30">📞 Phone Call</th>
                <th className="p-6 border-l border-slate-200 bg-purple-50/30">📹 Google Meet</th>
                <th className="p-6 border-l border-slate-200 bg-rose-50/30">📍 Direct Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">
                    Loading itinerary...
                  </td>
                </tr>
              ) : checklistLeads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No active schedules found. Click "Schedule Action" to add one.
                  </td>
                </tr>
              ) : (
                checklistLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6">
                      <p className="font-black text-lg text-slate-800">{lead.name}</p>
                      <p className="text-sm font-bold text-slate-400">{lead.phone || 'No Phone'}</p>
                    </td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-black uppercase tracking-widest">
                        {lead.category || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-6 border-l border-slate-100 bg-blue-50/10">
                      {renderStatusBadge(lead.tentative_call_date, lead.call_attended, 'call_attended', lead.id)}
                    </td>
                    <td className="p-6 border-l border-slate-100 bg-purple-50/10">
                      {renderStatusBadge(lead.gmeet_date, lead.gmeet_attended, 'gmeet_attended', lead.id)}
                    </td>
                    <td className="p-6 border-l border-slate-100 bg-rose-50/10">
                      {renderStatusBadge(lead.direct_visit_date, lead.direct_visit_attended, 'direct_visit_attended', lead.id)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CUSTOM ADD MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-2xl font-black text-slate-800">
                {selectedLead ? 'Set Schedule' : 'Find Lead to Schedule'}
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* VIEW 1: Search & List */}
            {!selectedLead && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <input 
                    type="text"
                    placeholder="Search master CRM by name, company, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-800 px-6 py-4 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                  />
                  <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">
                    {searchQuery ? 'Search Results' : '10 Most Recently Added Leads'}
                  </p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {isSearching ? (
                    <p className="text-center text-slate-400 font-bold p-10">Searching...</p>
                  ) : listToDisplay.length === 0 ? (
                    <p className="text-center text-slate-400 font-bold p-10">No leads found.</p>
                  ) : (
                    listToDisplay.map(lead => (
                      <div 
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        className="p-4 border border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 cursor-pointer flex justify-between items-center transition-all group shadow-sm"
                      >
                        <div>
                          <p className="font-black text-lg text-slate-800 group-hover:text-purple-900">{lead.name}</p>
                          <p className="text-sm font-bold text-slate-500">{lead.company_name || lead.phone}</p>
                        </div>
                        <div className="flex gap-2">
                          {lead.tentative_call_date && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-black uppercase">Call</span>}
                          {lead.gmeet_date && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-black uppercase">Meet</span>}
                          {lead.direct_visit_date && <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-[10px] font-black uppercase">Visit</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: Scheduling Form */}
            {selectedLead && (
              <div className="p-8 flex flex-col gap-6">
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                  <p className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-1">Target Lead</p>
                  <p className="font-black text-xl text-purple-900">{selectedLead.name}</p>
                  <p className="text-purple-700 font-medium">{selectedLead.company_name || selectedLead.phone}</p>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="block text-sm font-black text-slate-600 uppercase tracking-widest mb-2">📞 Tentative Call Date</label>
                    <input type="date" value={scheduleForm.call} onChange={e => setScheduleForm({...scheduleForm, call: e.target.value})} className="w-full bg-white border border-slate-300 p-4 rounded-xl font-mono text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-600 uppercase tracking-widest mb-2">📹 Google Meet Date</label>
                    <input type="date" value={scheduleForm.gmeet} onChange={e => setScheduleForm({...scheduleForm, gmeet: e.target.value})} className="w-full bg-white border border-slate-300 p-4 rounded-xl font-mono text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-600 uppercase tracking-widest mb-2">📍 Direct Visit Date</label>
                    <input type="date" value={scheduleForm.visit} onChange={e => setScheduleForm({...scheduleForm, visit: e.target.value})} className="w-full bg-white border border-slate-300 p-4 rounded-xl font-mono text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" />
                  </div>
                </div>

                <div className="flex gap-4 mt-4 pt-6 border-t border-slate-200">
                  <button onClick={() => setSelectedLead(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-widest py-4 rounded-xl transition-colors">
                    Back
                  </button>
                  <button onClick={handleSaveSchedule} disabled={isSaving} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-md">
                    {isSaving ? 'Saving...' : 'Save & Add to Checklist'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}