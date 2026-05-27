import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function LeadManager() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // === SORT STATE ===
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // === FILTER STATE ===
  const [filters, setFilters] = useState({
    globalSearch: '',
    source: [],
    status: [],
    lead_temp: [],
    dateStart: '',
    dateEnd: '',
    priceMin: '',
    priceMax: '',
  });

  // === BULK SELECTION ===
  const [selectedLeads, setSelectedLeads] = useState([]);

  // === MODALS ===
  const [activeLead, setActiveLead] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [isAppending, setIsAppending] = useState(false);
  const [lostModal, setLostModal] = useState({ isOpen: false, leadId: null });
  const [noteUser, setNoteUser] = useState('Ritthik Kumar');

  const users = ['Ritthik Kumar', 'Soundararajan B', 'Business Management Executive (BME)'];
  const pipelineStages = ['New', 'Contacted', 'Quoted / Demo', 'Negotiation', 'Closed - Won', 'Closed - Lost'];
  const lostReasons = ['💸 Price too high', '🤝 Chose a Competitor', '👻 Ghosted / Unresponsive', '❌ Junk Lead', '🔧 Wrong Machine'];

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const uniqueLeads = data.filter((lead, index, self) =>
        index === self.findIndex((t) =>
          t.name?.toLowerCase() === lead.name?.toLowerCase() &&
          t.requirement?.toLowerCase() === lead.requirement?.toLowerCase()
        )
      );
      setLeads(uniqueLeads);
    } catch (err) {
      console.error('Error fetching leads:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // DERIVED: unique values for filter pills
  // ==========================================
  const uniqueSources = useMemo(() =>
    [...new Set(leads.map(l => l.source).filter(Boolean))].sort(),
    [leads]
  );

  // ==========================================
  // PROCESSED LEADS: filter + sort pipeline
  // ==========================================
  const processedLeads = useMemo(() => {
    let result = [...leads];

    // Global text search
    if (filters.globalSearch.trim()) {
      const s = filters.globalSearch.toLowerCase();
      result = result.filter(l =>
        [l.name, l.company_name, l.requirement, l.phone, l.location, l.source]
          .some(v => v?.toLowerCase().includes(s))
      );
    }

    // Multi-select filters
    if (filters.source.length)    result = result.filter(l => filters.source.includes(l.source || 'Website'));
    if (filters.status.length)    result = result.filter(l => filters.status.includes(l.status || 'New'));
    if (filters.lead_temp.length) result = result.filter(l => filters.lead_temp.includes(l.lead_temp || 'Cold'));

    // Date range
    if (filters.dateStart) result = result.filter(l => l.date && l.date >= filters.dateStart);
    if (filters.dateEnd)   result = result.filter(l => l.date && l.date <= filters.dateEnd);

    // Value range
    if (filters.priceMin !== '') result = result.filter(l => Number(l.price || 0) >= Number(filters.priceMin));
    if (filters.priceMax !== '') result = result.filter(l => Number(l.price || 0) <= Number(filters.priceMax));

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;

        if (sortConfig.key === 'price') {
          return (Number(a.price || 0) - Number(b.price || 0)) * dir;
        }
        if (sortConfig.key === 'status') {
          return (pipelineStages.indexOf(a.status || 'New') - pipelineStages.indexOf(b.status || 'New')) * dir;
        }
        if (sortConfig.key === 'lead_temp') {
          const order = { Hot: 0, Warm: 1, Cold: 2 };
          return ((order[a.lead_temp] ?? 2) - (order[b.lead_temp] ?? 2)) * dir;
        }

        const aVal = String(a[sortConfig.key] ?? '').toLowerCase();
        const bVal = String(b[sortConfig.key] ?? '').toLowerCase();
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }

    return result;
  }, [leads, filters, sortConfig]);

  const filteredValue = useMemo(() =>
    processedLeads.reduce((sum, l) => sum + (Number(l.price) || 0), 0),
    [processedLeads]
  );

  // Active filter count badge
  const activeFilterCount = useMemo(() => [
    filters.source.length > 0,
    filters.status.length > 0,
    filters.lead_temp.length > 0,
    !!filters.dateStart,
    !!filters.dateEnd,
    filters.priceMin !== '',
    filters.priceMax !== '',
  ].filter(Boolean).length, [filters]);

  // ==========================================
  // FILTER HELPERS
  // ==========================================
  const toggleFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value],
    }));
  };

  const clearAllFilters = () => {
    setFilters({ globalSearch: '', source: [], status: [], lead_temp: [], dateStart: '', dateEnd: '', priceMin: '', priceMax: '' });
    setSortConfig({ key: null, direction: 'asc' });
  };

  const activeChips = useMemo(() => {
    const chips = [];
    filters.source.forEach(s   => chips.push({ label: `Source: ${s}`,  remove: () => toggleFilter('source', s) }));
    filters.status.forEach(s   => chips.push({ label: `Stage: ${s}`,   remove: () => toggleFilter('status', s) }));
    filters.lead_temp.forEach(t => chips.push({ label: `Temp: ${t}`,   remove: () => toggleFilter('lead_temp', t) }));
    if (filters.dateStart) chips.push({ label: `From: ${filters.dateStart}`, remove: () => setFilters(p => ({ ...p, dateStart: '' })) });
    if (filters.dateEnd)   chips.push({ label: `To: ${filters.dateEnd}`,     remove: () => setFilters(p => ({ ...p, dateEnd: '' })) });
    if (filters.priceMin !== '') chips.push({ label: `Min ₹${Number(filters.priceMin).toLocaleString('en-IN')}`, remove: () => setFilters(p => ({ ...p, priceMin: '' })) });
    if (filters.priceMax !== '') chips.push({ label: `Max ₹${Number(filters.priceMax).toLocaleString('en-IN')}`, remove: () => setFilters(p => ({ ...p, priceMax: '' })) });
    return chips;
  }, [filters]);

  // ==========================================
  // SORT HELPER
  // ==========================================
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortBtn = ({ col }) => (
    <button
      onClick={() => handleSort(col)}
      title={`Sort by ${col}`}
      className={`ml-1 text-[11px] transition-all ${sortConfig.key === col ? 'text-primary' : 'text-white/25 hover:text-white/60'}`}
    >
      {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
    </button>
  );

  // ==========================================
  // BULK SELECT / DELETE
  // ==========================================
  const handleSelectAll = (e) => {
    setSelectedLeads(e.target.checked ? processedLeads.map(l => l.id) : []);
  };

  const handleSelectLead = (id) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`⚠️ Permanently delete ${selectedLeads.length} lead(s)?`)) return;
    try {
      const { error } = await supabase.from('leads').delete().in('id', selectedLeads);
      if (error) throw error;
      setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
      setSelectedLeads([]);
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  // ==========================================
  // CELL EDIT / LOST REASON
  // ==========================================
  const handleCellEdit = async (id, field, value) => {
    if (field === 'status' && value === 'Closed - Lost') {
      setLostModal({ isOpen: true, leadId: id });
      return;
    }
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'status') updated.lost_reason = null;
      return updated;
    }));
    try {
      const payload = { [field]: value };
      if (field === 'status') payload.lost_reason = null;
      const { error } = await supabase.from('leads').update(payload).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Auto-save failed:', err.message);
    }
  };

  const handleLostReasonSelect = async (reason) => {
    const targetId = lostModal.leadId;
    setLeads(prev => prev.map(l => l.id === targetId ? { ...l, status: 'Closed - Lost', lost_reason: reason } : l));
    setLostModal({ isOpen: false, leadId: null });
    try {
      await supabase.from('leads').update({ status: 'Closed - Lost', lost_reason: reason }).eq('id', targetId);
    } catch (err) {
      console.error('Auto-save failed:', err.message);
    }
  };

  // ==========================================
  // NOTES
  // ==========================================
  const handleAppendNote = async () => {
    if (!newNote.trim() || !activeLead) return;
    setIsAppending(true);
    try {
      const now = new Date();
      const ts = `[${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}] [${noteUser}]`;
      const updatedNotes = activeLead.notes ? `${activeLead.notes}\n${ts} ${newNote.trim()}` : `${ts} ${newNote.trim()}`;
      await supabase.from('leads').update({ notes: updatedNotes }).eq('id', activeLead.id);
      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, notes: updatedNotes } : l));
      setActiveLead(prev => ({ ...prev, notes: updatedNotes }));
      setNewNote('');
    } catch (err) {
      alert(`Failed to append note: ${err.message}`);
    } finally {
      setIsAppending(false);
    }
  };

  // ==========================================
  // EXPORT (exports currently filtered view)
  // ==========================================
  const handleDownloadExcel = () => {
    if (processedLeads.length === 0) return;
    const excelData = processedLeads.map(lead => ({
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
      'Internal Notes': lead.notes || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 50 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered Leads');
    XLSX.writeFile(workbook, `LeadManager_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* ── MODAL: NOTES ────────────────────────────────────────── */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy border border-white/20 p-6 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">📝 Lead Dossier: {activeLead.name}</h3>
                <p className="text-sm text-secondary font-mono mt-1">{activeLead.company_name || activeLead.phone}</p>
              </div>
              <button onClick={() => { setActiveLead(null); setNewNote(''); }} className="text-secondary hover:text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-black/30 rounded border border-white/5 p-4 h-64 overflow-y-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
              {activeLead.notes || 'No notes recorded yet.'}
            </div>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Type new update here..." className="bg-white/5 border border-white/20 rounded p-3 text-white font-sans focus:outline-none focus:border-primary resize-none h-24" />
            <div className="flex gap-4">
              <select value={noteUser} onChange={e => setNoteUser(e.target.value)} className="bg-navy border border-white/20 px-4 py-3 rounded text-white font-mono text-sm focus:outline-none focus:border-primary max-w-xs truncate">
                {users.map(u => <option key={u} value={u} className="bg-slate-900 text-white">{u}</option>)}
              </select>
              <button onClick={handleAppendNote} disabled={isAppending || !newNote.trim()} className="flex-1 bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-mono text-sm tracking-widest uppercase py-3 rounded transition-colors">
                {isAppending ? 'Appending...' : '📌 Append Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: LOST REASON ─────────────────────────────────── */}
      {lostModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy border border-red-500/30 p-6 rounded-lg shadow-2xl max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2">Deal Lost</h2>
            <p className="text-secondary text-sm mb-6">Select the primary reason this deal was lost.</p>
            <div className="flex flex-col gap-3">
              {lostReasons.map(reason => (
                <button key={reason} onClick={() => handleLostReasonSelect(reason)} className="bg-white/5 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 border border-white/10 text-white text-left px-4 py-3 rounded transition-colors text-sm font-medium">
                  {reason}
                </button>
              ))}
            </div>
            <button onClick={() => { setLostModal({ isOpen: false, leadId: null }); fetchLeads(); }} className="mt-6 w-full py-3 text-secondary hover:text-white font-mono text-xs tracking-widest uppercase transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/database')} className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Analytics
        </button>
        <span className="font-mono text-xs text-purple-400 tracking-widest uppercase flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Lead Manager
        </span>
      </div>

      <div className="glass-modal w-full max-w-[95%] xl:max-w-7xl p-8 relative z-10 flex flex-col gap-6 shadow-2xl">

        {/* Header */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Lead Manager</h1>
              <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase animate-pulse">Auto-Save Active</span>
            </div>
            <p className="text-secondary text-sm mt-1">Sort, filter, search and inline-edit any field.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadExcel} className="border border-white/20 hover:border-white/50 text-white font-mono text-sm tracking-widest uppercase px-4 py-2 rounded transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Export{processedLeads.length !== leads.length ? ` (${processedLeads.length})` : ''}
            </button>
            <button onClick={fetchLeads} className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded">Refresh</button>
          </div>
        </div>

        {/* ════════════════════════════════════════
            SEARCH + FILTER BAR
        ════════════════════════════════════════ */}
        <div className="flex flex-col gap-3">

          {/* Row 1: Global search + filter toggle */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={filters.globalSearch}
                onChange={e => setFilters(p => ({ ...p, globalSearch: e.target.value }))}
                placeholder="Search name, company, requirement, phone, location..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-8 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-secondary/40"
              />
              {filters.globalSearch && (
                <button onClick={() => setFilters(p => ({ ...p, globalSearch: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-white text-lg leading-none">×</button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs tracking-widest uppercase border transition-colors whitespace-nowrap ${
                showFilters || activeFilterCount > 0
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/20'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>

            {(activeFilterCount > 0 || sortConfig.key) && (
              <button onClick={clearAllFilters} className="px-3 py-2.5 rounded-lg font-mono text-[10px] tracking-widest uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap">
                Clear All
              </button>
            )}
          </div>

          {/* Row 2: Expandable filter panel */}
          {showFilters && (
            <div className="bg-black/20 border border-white/10 rounded-xl p-5 flex flex-col gap-5">

              {/* Source */}
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Source</span>
                <div className="flex flex-wrap gap-2">
                  {uniqueSources.map(src => (
                    <button key={src} onClick={() => toggleFilter('source', src)}
                      className={`px-3 py-1 rounded-full font-mono text-xs border transition-all ${
                        filters.source.includes(src)
                          ? 'bg-primary/25 border-primary text-white shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                          : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/25'
                      }`}>
                      {filters.source.includes(src) && <span className="mr-1">✓</span>}{src}
                    </button>
                  ))}
                  {uniqueSources.length === 0 && <span className="text-secondary font-mono text-xs">No leads loaded yet.</span>}
                </div>
              </div>

              {/* Pipeline Stage */}
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Pipeline Stage</span>
                <div className="flex flex-wrap gap-2">
                  {pipelineStages.map(stage => {
                    const activeClass =
                      stage === 'Closed - Won'  ? 'bg-green-500/20 border-green-500 text-green-300' :
                      stage === 'Closed - Lost' ? 'bg-red-500/20 border-red-500 text-red-300' :
                      stage === 'Negotiation'   ? 'bg-purple-500/20 border-purple-500 text-purple-300' :
                      'bg-primary/20 border-primary text-white';
                    return (
                      <button key={stage} onClick={() => toggleFilter('status', stage)}
                        className={`px-3 py-1 rounded-full font-mono text-xs border transition-all ${
                          filters.status.includes(stage) ? activeClass : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/25'
                        }`}>
                        {filters.status.includes(stage) && <span className="mr-1">✓</span>}{stage}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temperature */}
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Temperature</span>
                <div className="flex gap-2">
                  {[
                    { val: 'Hot',  label: '🔥 Hot',      active: 'bg-red-500/20 border-red-500 text-red-300' },
                    { val: 'Warm', label: '🌡️ Warm',     active: 'bg-amber-500/20 border-amber-500 text-amber-300' },
                    { val: 'Cold', label: '❄️ Cold',     active: 'bg-cyan-500/20 border-cyan-500 text-cyan-300' },
                  ].map(({ val, label, active }) => (
                    <button key={val} onClick={() => toggleFilter('lead_temp', val)}
                      className={`px-4 py-1.5 rounded-full font-mono text-xs border transition-all ${
                        filters.lead_temp.includes(val) ? active : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/25'
                      }`}>
                      {filters.lead_temp.includes(val) && <span className="mr-1">✓</span>}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range + Value Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Date Range</span>
                  <div className="flex items-center gap-2">
                    <input type="date" value={filters.dateStart} onChange={e => setFilters(p => ({ ...p, dateStart: e.target.value }))}
                      className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary" />
                    <span className="text-secondary font-mono text-xs">→</span>
                    <input type="date" value={filters.dateEnd} onChange={e => setFilters(p => ({ ...p, dateEnd: e.target.value }))}
                      className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Value Range (₹)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={filters.priceMin} onChange={e => setFilters(p => ({ ...p, priceMin: e.target.value }))}
                      placeholder="Min" className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary placeholder:text-secondary/30" />
                    <span className="text-secondary font-mono text-xs">→</span>
                    <input type="number" value={filters.priceMax} onChange={e => setFilters(p => ({ ...p, priceMax: e.target.value }))}
                      placeholder="Max" className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary placeholder:text-secondary/30" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-primary/15 border border-primary/30 text-primary px-3 py-1 rounded-full font-mono text-xs">
                  {chip.label}
                  <button onClick={chip.remove} className="hover:text-white transition-colors text-base leading-none">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════
            DATA GRID
        ════════════════════════════════════════ */}
        <div className="overflow-x-auto relative">

          {selectedLeads.length > 0 && (
            <div className="absolute top-0 left-0 w-full bg-red-900/90 backdrop-blur border-b border-red-500/50 p-3 flex justify-between items-center z-20 shadow-xl rounded-t">
              <span className="text-red-200 font-mono text-sm tracking-widest uppercase ml-4">{selectedLeads.length} Lead(s) Selected</span>
              <button onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs tracking-widest uppercase px-4 py-2 rounded transition-colors">🗑️ Delete Selected</button>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-secondary font-mono">LOADING DATA...</div>
          ) : processedLeads.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <span className="text-4xl">🔍</span>
              <span className="text-secondary font-mono text-sm">No leads match your current filters.</span>
              <button onClick={clearAllFilters} className="text-primary font-mono text-xs uppercase tracking-widest underline underline-offset-2">Clear filters</button>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse min-w-[1200px] mt-2">
                <thead>
                  <tr className="border-b border-white/10 text-secondary font-mono text-xs uppercase tracking-wider">
                    <th className="py-4 px-4 w-10">
                      <input type="checkbox" onChange={handleSelectAll} checked={selectedLeads.length === processedLeads.length && processedLeads.length > 0} className="w-4 h-4 accent-primary cursor-pointer" />
                    </th>
                    <th className="py-4 px-2 font-medium">
                      <span className="flex items-center">Date / Source <SortBtn col="date" /></span>
                    </th>
                    <th className="py-4 px-2 font-medium">
                      <span className="flex items-center">Client Info <SortBtn col="name" /></span>
                    </th>
                    <th className="py-4 px-2 font-medium">Requirement</th>
                    <th className="py-4 px-2 font-medium text-center">
                      <span className="flex items-center justify-center">Stage <SortBtn col="status" /></span>
                    </th>
                    <th className="py-4 px-2 font-medium text-center">
                      <span className="flex items-center justify-center">Temp <SortBtn col="lead_temp" /></span>
                    </th>
                    <th className="py-4 px-4 font-medium text-right">
                      <span className="flex items-center justify-end">Value (₹) <SortBtn col="price" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {processedLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-white/5 transition-colors group">

                      <td className="py-4 px-4">
                        <input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => handleSelectLead(lead.id)} className="w-4 h-4 accent-primary cursor-pointer" />
                      </td>

                      <td className="py-4 px-2">
                        <div className="flex flex-col gap-1 w-32">
                          <input type="date" defaultValue={lead.date} onBlur={e => { if (e.target.value !== lead.date) handleCellEdit(lead.id, 'date', e.target.value); }} className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-white font-mono text-sm outline-none transition-colors" />
                          <select value={lead.source || 'Website'} onChange={e => handleCellEdit(lead.id, 'source', e.target.value)}
                            className={`bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded font-mono text-[10px] tracking-widest uppercase outline-none transition-colors cursor-pointer ${
                              lead.source === 'IndiaMart' ? 'text-blue-400' : lead.source === 'TradeIndia' ? 'text-amber-400' : lead.source === 'Alibaba' ? 'text-orange-400' : 'text-secondary'
                            }`}>
                            {['Website','YouTube','LinkedIn','Direct','Referral','Alibaba','IndiaMart','TradeIndia','Manual Entry'].map(s => (
                              <option key={s} className="bg-slate-900 text-white" value={s}>{s.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="py-4 px-2">
                        <div className="flex flex-col gap-1 w-48">
                          <input type="text" defaultValue={lead.name} placeholder="Client Name" onBlur={e => { if (e.target.value !== lead.name) handleCellEdit(lead.id, 'name', e.target.value); }} className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-white font-medium outline-none transition-colors text-sm" />
                          <input type="text" defaultValue={lead.company_name} placeholder="Company" onBlur={e => { if (e.target.value !== lead.company_name) handleCellEdit(lead.id, 'company_name', e.target.value); }} className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-onSurfaceVariant text-xs outline-none transition-colors w-full" />
                          <input type="text" defaultValue={lead.phone} placeholder="Phone" onBlur={e => { if (e.target.value !== lead.phone) handleCellEdit(lead.id, 'phone', e.target.value); }} className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-1 py-0.5 rounded text-onSurfaceVariant text-xs outline-none transition-colors w-full" />
                        </div>
                      </td>

                      <td className="py-4 px-2">
                        <div className="flex flex-col items-start gap-2 w-64">
                          <textarea defaultValue={lead.requirement} placeholder="Machine Requirement..." onBlur={e => { if (e.target.value !== lead.requirement) handleCellEdit(lead.id, 'requirement', e.target.value); }} className="bg-transparent border border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 px-2 py-1 rounded text-white font-medium outline-none transition-colors text-sm resize-none w-full h-12" />
                          <button onClick={() => setActiveLead(lead)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-secondary hover:text-white px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors">
                            📝 {lead.notes?.includes('[') ? 'View/Add Notes' : '+ Add Note'}
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-2 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <select value={lead.status || 'New'} onChange={e => handleCellEdit(lead.id, 'status', e.target.value)}
                            className={`bg-navy border px-2 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors w-32 cursor-pointer ${
                              lead.status === 'Closed - Won'  ? 'border-green-500/50 text-green-400' :
                              lead.status === 'Closed - Lost' ? 'border-red-500/50 text-red-400' :
                              lead.status === 'Negotiation'   ? 'border-purple-500/50 text-purple-400' :
                              'border-white/20 text-white'
                            }`}>
                            {pipelineStages.map(s => <option key={s} className="bg-slate-900 text-white" value={s}>{s}</option>)}
                          </select>
                          {lead.status === 'Closed - Lost' && lead.lost_reason && (
                            <span className="text-[9px] text-red-400/80 font-mono truncate max-w-[120px]" title={lead.lost_reason}>↳ {lead.lost_reason}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-2 text-center">
                        <select value={lead.lead_temp || 'Cold'} onChange={e => handleCellEdit(lead.id, 'lead_temp', e.target.value)}
                          className={`bg-navy border px-2 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-primary transition-colors cursor-pointer ${
                            lead.lead_temp === 'Hot'  ? 'border-red-500/50 text-red-400' :
                            lead.lead_temp === 'Warm' ? 'border-amber-500/50 text-amber-400' :
                            'border-cyan-500/50 text-cyan-400'
                          }`}>
                          <option className="bg-slate-900 text-white" value="Cold">❄️ Cold</option>
                          <option className="bg-slate-900 text-white" value="Warm">🌡️ Warm</option>
                          <option className="bg-slate-900 text-white" value="Hot">🔥 Hot</option>
                        </select>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-green-500 font-mono text-sm">₹</span>
                          <input type="number" defaultValue={lead.price || ''} placeholder="0" onBlur={e => { if (e.target.value !== String(lead.price)) handleCellEdit(lead.id, 'price', e.target.value); }} className="bg-transparent border border-transparent hover:border-white/20 focus:bg-navy focus:border-green-500 px-2 py-1.5 rounded font-mono text-sm text-green-400 focus:outline-none w-24 text-right transition-colors" />
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table footer */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                <span className="font-mono text-xs text-secondary">
                  Showing <strong className="text-white">{processedLeads.length}</strong> of <strong className="text-white">{leads.length}</strong> leads
                  {processedLeads.length !== leads.length && <span className="text-primary"> (filtered)</span>}
                  {sortConfig.key && <span className="text-secondary"> · sorted by <strong className="text-white">{sortConfig.key}</strong> {sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                </span>
                <span className="font-mono text-xs text-secondary">
                  Filtered value: <strong className="text-green-400">₹{filteredValue.toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



