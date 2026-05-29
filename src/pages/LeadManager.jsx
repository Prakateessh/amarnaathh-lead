import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

// ── BULLETPROOF NOTE UTILITIES ─────────────────────────────────────────────
const parseNoteLines = (notesStr) => {
  if (typeof notesStr !== 'string') return [];
  return notesStr.trim() ? notesStr.split('\n').filter(l => l.trim()) : [];
};

const parseNoteEntry = (line) => {
  if (typeof line !== 'string') return { timestamp: null, user: null, text: '' };
  const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] \[(.*?)\] ([\s\S]+)$/);
  return m ? { timestamp: m[1], user: m[2], text: m[3].trim() } : { timestamp: null, user: null, text: line };
};

const getLatestNotePreview = (notesStr) => {
  const lines = parseNoteLines(notesStr);
  if (!lines.length) return null;
  const parsed = parseNoteEntry(lines[lines.length - 1]);
  const text = parsed?.text || '';
  return text.length > 70 ? text.slice(0, 70) + '…' : text;
};

const getLatestNoteTimestamp = (notesStr) => {
  const lines = parseNoteLines(notesStr);
  if (!lines.length) return 0;
  const { timestamp } = parseNoteEntry(lines[lines.length - 1]);
  if (!timestamp) return 0;
  const time = new Date(timestamp).getTime();
  return isNaN(time) ? 0 : time;
};

// ── UI HELPERS ─────────────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// ── MINIMALIST "GHOST" BADGES ───────────────────────────────────────────
const STATUS_DOT = {
  'New':           'bg-slate-400',
  'Contacted':     'bg-blue-500',
  'Quoted / Demo': 'bg-amber-500',
  'Negotiation':   'bg-purple-500',
  'Closed - Won':  'bg-emerald-500',
  'Closed - Lost': 'bg-rose-500',
};

const StatusBadge = ({ status }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] uppercase tracking-wider shadow-sm whitespace-nowrap">
    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || STATUS_DOT['New']}`}></span>
    {status || 'New'}
  </span>
);

const TEMP_DOT = { 'Hot': 'bg-rose-500', 'Warm': 'bg-amber-500', 'Cold': 'bg-cyan-500' };

const TempBadge = ({ temp }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] uppercase tracking-wider shadow-sm whitespace-nowrap">
    <span className={`w-1.5 h-1.5 rounded-full ${TEMP_DOT[temp] || TEMP_DOT['Cold']}`}></span>
    {temp || 'Cold'}
  </span>
);

// ══════════════════════════════════════════════════════════════════════════════
export default function LeadManager() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // === REMINDERS & CALENDAR STATE ===
  const [showReminders, setShowReminders] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [todayPage, setTodayPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const ITEMS_PER_PAGE = 3;

  // === SORT & FILTER STATE ===
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({
    globalSearch: '',
    source: [], status: [], lead_temp: [],
    dateStart: '', dateEnd: '',
    priceMin: '', priceMax: '',
  });

  const [selectedLeads, setSelectedLeads] = useState([]);

  // === PROFILE MODAL STATE ===
  const [profileLead, setProfileLead] = useState(null); 
  const [editData, setEditData] = useState({});   
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [newNote, setNewNote] = useState('');
  const [isAppending, setIsAppending] = useState(false);
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
      
      const unique = (data || []).filter((l, i, a) =>
        i === a.findIndex(t => t.name?.toLowerCase() === l.name?.toLowerCase() && t.requirement?.toLowerCase() === l.requirement?.toLowerCase())
      );
      setLeads(unique);
    } catch (err) {
      console.error('Error fetching leads:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── SAFE ALERTS LOGIC ────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  let todayAlerts = [];
  let upcomingAlerts = [];

  leads.forEach(lead => {
    if (lead.tentative_call_date && !lead.call_attended) {
      const isUpcoming = String(lead.tentative_call_date) > todayStr;
      const targetArray = isUpcoming ? upcomingAlerts : todayAlerts;
      targetArray.push({ ...lead, alertType: 'Call', alertDate: lead.tentative_call_date });
    }
    if (lead.gmeet_date && !lead.gmeet_attended) {
      const gDate = String(lead.gmeet_date).split('T')[0];
      const isUpcoming = gDate > todayStr;
      const targetArray = isUpcoming ? upcomingAlerts : todayAlerts;
      targetArray.push({ ...lead, alertType: 'GMeet', alertDate: gDate });
    }
  });

  todayAlerts.sort((a, b) => new Date(a.alertDate || 0) - new Date(b.alertDate || 0));
  upcomingAlerts.sort((a, b) => new Date(a.alertDate || 0) - new Date(b.alertDate || 0));

  const urgentAlerts = [...todayAlerts, ...upcomingAlerts]; 

  const todayTotalPages = Math.ceil(todayAlerts.length / ITEMS_PER_PAGE);
  const upcomingTotalPages = Math.ceil(upcomingAlerts.length / ITEMS_PER_PAGE);
  const currentTodayAlerts = todayAlerts.slice((todayPage - 1) * ITEMS_PER_PAGE, todayPage * ITEMS_PER_PAGE);
  const currentUpcomingAlerts = upcomingAlerts.slice((upcomingPage - 1) * ITEMS_PER_PAGE, upcomingPage * ITEMS_PER_PAGE);

  const handleMarkAttended = async (leadId, alertType) => {
    const columnToUpdate = alertType === 'Call' ? 'call_attended' : 'gmeet_attended';
    try {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [columnToUpdate]: true } : l));
      await supabase.from('leads').update({ [columnToUpdate]: true }).eq('id', leadId);
    } catch (err) {
      console.error("Failed to update status:", err.message);
    }
  };

  const renderPagination = (currentPage, totalPages, setPage) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex gap-2 justify-center mt-3">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`w-7 h-7 rounded-md font-mono text-xs font-medium transition-all duration-300 ${
              currentPage === p ? 'bg-purple-900 text-white shadow-md ring-2 ring-[#EBA7FF]/50' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-[#EBA7FF]/10 hover:text-purple-900'
            }`}>
            {p}
          </button>
        ))}
      </div>
    );
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const daysInCurrentMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOffset = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const blanks = Array.from({ length: firstDayOffset }, (_, i) => i);
  const calendarDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ── PROFILE MODAL HANDLERS ─────────────────────────────────────────────────
  const openProfile = (lead) => {
    setProfileLead(lead);
    setEditData({ ...lead });
    setNewNote('');
    setSaveSuccess(false);
  };

  const closeProfile = () => {
    setProfileLead(null);
    setEditData({});
    setNewNote('');
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'status' && value !== 'Closed - Lost' ? { lost_reason: null } : {}),
    }));
  };

  const handleSaveChanges = async () => {
    if (!editData.id) return;
    setIsSaving(true);
    try {
      const payload = {
        name:                editData.name           || null,
        company_name:        editData.company_name   || null,
        phone:               editData.phone          || null,
        location:            editData.location       || null,
        requirement:         editData.requirement    || null,
        source:              editData.source         || null,
        date:                editData.date           || null,
        status:              editData.status         || 'New',
        lost_reason:         editData.status === 'Closed - Lost' ? (editData.lost_reason || null) : null,
        lead_temp:           editData.lead_temp      || 'Cold',
        price:               editData.price          || null,
        tentative_call_date: editData.tentative_call_date || null,
        gmeet_date:          editData.gmeet_date     || null,
      };

      const { error } = await supabase.from('leads').update(payload).eq('id', editData.id);
      if (error) throw error;

      setLeads(prev => prev.map(l => l.id === editData.id ? { ...l, ...payload } : l));
      setProfileLead(prev => ({ ...prev, ...payload }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppendNote = async () => {
    if (!newNote.trim() || !profileLead) return;
    setIsAppending(true);
    try {
      const now = new Date();
      const ts = `[${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}]`;
      const entry = `${ts} [${noteUser}] ${newNote.trim()}`;
      const updatedNotes = profileLead.notes ? `${profileLead.notes}\n${entry}` : entry;
      
      await supabase.from('leads').update({ notes: updatedNotes }).eq('id', profileLead.id);
      
      setProfileLead(prev => ({ ...prev, notes: updatedNotes }));
      setEditData(prev => ({ ...prev, notes: updatedNotes }));
      setLeads(prev => prev.map(l => l.id === profileLead.id ? { ...l, notes: updatedNotes } : l));
      setNewNote('');
    } catch (err) {
      alert(`Failed to append note: ${err.message}`);
    } finally {
      setIsAppending(false);
    }
  };

  // ── SAFE FILTER / SORT HELPERS ─────────────────────────────────────────────
  const uniqueSources = useMemo(() => [...new Set(leads.map(l => l.source).filter(Boolean))].sort(), [leads]);

  const processedLeads = useMemo(() => {
    let r = [...leads];

    if (filters.globalSearch.trim()) {
      const s = filters.globalSearch.toLowerCase();
      r = r.filter(l => [l.name, l.company_name, l.requirement, l.phone, l.location, l.source].some(v => String(v || '').toLowerCase().includes(s)));
    }
    if (filters.source.length)    r = r.filter(l => filters.source.includes(l.source || 'Website'));
    if (filters.status.length)    r = r.filter(l => filters.status.includes(l.status || 'New'));
    if (filters.lead_temp.length) r = r.filter(l => filters.lead_temp.includes(l.lead_temp || 'Cold'));
    if (filters.dateStart) r = r.filter(l => l.date && l.date >= filters.dateStart);
    if (filters.dateEnd)   r = r.filter(l => l.date && l.date <= filters.dateEnd);
    if (filters.priceMin !== '') r = r.filter(l => Number(l.price || 0) >= Number(filters.priceMin));
    if (filters.priceMax !== '') r = r.filter(l => Number(l.price || 0) <= Number(filters.priceMax));

    if (sortConfig.key) {
      r.sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (sortConfig.key === 'price')     return (Number(a.price || 0) - Number(b.price || 0)) * dir;
        if (sortConfig.key === 'status')    return (pipelineStages.indexOf(a.status || 'New') - pipelineStages.indexOf(b.status || 'New')) * dir;
        if (sortConfig.key === 'lead_temp') { const o = { Hot: 0, Warm: 1, Cold: 2 }; return ((o[a.lead_temp] ?? 2) - (o[b.lead_temp] ?? 2)) * dir; }
        const av = String(a[sortConfig.key] || '').toLowerCase();
        const bv = String(b[sortConfig.key] || '').toLowerCase();
        return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
      });
    } else {
      r.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        
        const validTimeA = isNaN(timeA) ? 0 : timeA;
        const validTimeB = isNaN(timeB) ? 0 : timeB;

        const lastActivityA = Math.max(getLatestNoteTimestamp(a.notes), validTimeA);
        const lastActivityB = Math.max(getLatestNoteTimestamp(b.notes), validTimeB);
        
        return lastActivityB - lastActivityA;
      });
    }

    return r;
  }, [leads, filters, sortConfig]);

  const filteredValue = useMemo(() => processedLeads.reduce((s, l) => s + (Number(l.price) || 0), 0), [processedLeads]);
  const activeFilterCount = useMemo(() => [
    filters.source.length > 0, filters.status.length > 0, filters.lead_temp.length > 0,
    !!filters.dateStart, !!filters.dateEnd, filters.priceMin !== '', filters.priceMax !== '',
  ].filter(Boolean).length, [filters]);

  const toggleFilter = (key, value) => setFilters(prev => ({
    ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value],
  }));

  const clearAllFilters = () => {
    setFilters({ globalSearch: '', source: [], status: [], lead_temp: [], dateStart: '', dateEnd: '', priceMin: '', priceMax: '' });
    setSortConfig({ key: null, direction: 'asc' });
  };

  const activeChips = useMemo(() => {
    const chips = [];
    filters.source.forEach(s    => chips.push({ label: `Source: ${s}`,  remove: () => toggleFilter('source', s) }));
    filters.status.forEach(s    => chips.push({ label: `Stage: ${s}`,   remove: () => toggleFilter('status', s) }));
    filters.lead_temp.forEach(t => chips.push({ label: `Temp: ${t}`,    remove: () => toggleFilter('lead_temp', t) }));
    if (filters.dateStart) chips.push({ label: `From: ${filters.dateStart}`, remove: () => setFilters(p => ({ ...p, dateStart: '' })) });
    if (filters.dateEnd)   chips.push({ label: `To: ${filters.dateEnd}`,     remove: () => setFilters(p => ({ ...p, dateEnd: '' })) });
    if (filters.priceMin !== '') chips.push({ label: `Min ₹${Number(filters.priceMin).toLocaleString('en-IN')}`, remove: () => setFilters(p => ({ ...p, priceMin: '' })) });
    if (filters.priceMax !== '') chips.push({ label: `Max ₹${Number(filters.priceMax).toLocaleString('en-IN')}`, remove: () => setFilters(p => ({ ...p, priceMax: '' })) });
    return chips;
  }, [filters]);

  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  
  const SortBtn = ({ col }) => (
    <button onClick={e => { e.stopPropagation(); handleSort(col); }}
      className={`ml-1.5 text-[11px] transition-all hover:scale-110 ${sortConfig.key === col ? 'text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}>
      {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
    </button>
  );

  // ── BULK SELECT / DELETE ───────────────────────────────────────────────────
  const handleSelectAll = (e) => setSelectedLeads(e.target.checked ? processedLeads.map(l => l.id) : []);
  const handleSelectLead = (id) => setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleDeleteSelected = async () => {
    if (!window.confirm(`⚠️ Permanently delete ${selectedLeads.length} lead(s)?`)) return;
    try {
      const { error } = await supabase.from('leads').delete().in('id', selectedLeads);
      if (error) throw error;
      if (profileLead && selectedLeads.includes(profileLead.id)) closeProfile();
      setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
      setSelectedLeads([]);
    } catch (err) { alert(`Delete failed: ${err.message}`); }
  };

  // ── EXPORT ─────────────────────────────────────────────────────────────────
  const handleDownloadExcel = () => {
    if (!processedLeads.length) return;
    const excelData = processedLeads.map(l => ({
      'Date': l.date || '', 'Source': l.source || '', 'Client Name': l.name || '',
      'Company': l.company_name || '', 'Phone': l.phone || '', 'Location': l.location || '',
      'Requirement': l.requirement || '', 'Tentative Call': l.tentative_call_date || '',
      'GMeet Date': l.gmeet_date || '', 'Pipeline Stage': l.status || 'New',
      'Temperature': l.lead_temp || 'Cold', 'Value (₹)': Number(l.price) || 0,
      'Lost Reason': l.lost_reason || '', 'Internal Notes': l.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 15 }, { wch: 18 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Leads');
    XLSX.writeFile(wb, `LeadManager_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans text-slate-800">
      
      {/* Subtle Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[140px] pointer-events-none" />

      {/* ════════════════════════════════════════════════════════════════════
          PROFILE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {profileLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col overflow-hidden"
               style={{ maxHeight: '92vh' }}>
            
            <div className="flex-shrink-0 flex justify-between items-start px-8 py-6 border-b border-slate-100 bg-white">
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <div className="min-w-0">
                  <p className="text-slate-400 font-medium text-xs uppercase tracking-widest mb-1.5">Lead Profile</p>
                  <h3 className="text-2xl font-semibold text-slate-900 truncate">{editData.name || '—'}</h3>
                  {editData.company_name && (
                    <p className="text-slate-500 text-[15px] mt-0.5 font-normal">{editData.company_name}</p>
                  )}
                </div>
                <div className="pt-6 flex-shrink-0">
                  <StatusBadge status={editData.status} />
                </div>
              </div>
              <button onClick={closeProfile} className="flex-shrink-0 ml-4 mt-1 text-slate-400 hover:text-slate-700 transition-colors bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-full shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-50/50">
              {/* LEFT: Edit Form */}
              <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 min-w-0">
                <section>
                  <p className="font-semibold text-sm text-slate-800 mb-4 border-b border-slate-200 pb-2">Contact Information</p>
                  <div className="grid grid-cols-2 gap-5">
                    {[
                      { label: 'Name',     field: 'name',         type: 'text' },
                      { label: 'Company',  field: 'company_name', type: 'text' },
                      { label: 'Phone',    field: 'phone',        type: 'text' },
                      { label: 'Location', field: 'location',     type: 'text' },
                    ].map(({ label, field, type }) => (
                      <div key={field} className="flex flex-col gap-1.5">
                        <label className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">{label}</label>
                        <input type={type} value={editData[field] || ''}
                          onChange={e => handleEditChange(field, e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] transition-shadow shadow-sm font-medium" />
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="font-semibold text-sm text-slate-800 mb-4 border-b border-slate-200 pb-2">Requirement</p>
                  <textarea value={editData.requirement || ''} rows={3}
                    onChange={e => handleEditChange('requirement', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] resize-none transition-shadow shadow-sm font-medium" />
                </section>

                <section>
                  <p className="font-semibold text-sm text-slate-800 mb-4 border-b border-slate-200 pb-2">Pipeline Details</p>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">Pipeline Stage</label>
                      <select value={editData.status || 'New'} onChange={e => handleEditChange('status', e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] cursor-pointer shadow-sm">
                        {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">Temperature</label>
                      <select value={editData.lead_temp || 'Cold'} onChange={e => handleEditChange('lead_temp', e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] cursor-pointer shadow-sm">
                        <option value="Cold">❄️ Cold</option>
                        <option value="Warm">🌡️ Warm</option>
                        <option value="Hot">🔥 Hot</option>
                      </select>
                    </div>
                    {editData.status === 'Closed - Lost' && (
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="font-medium text-[11px] text-rose-500 uppercase tracking-wider">Lost Reason</label>
                        <select value={editData.lost_reason || ''} onChange={e => handleEditChange('lost_reason', e.target.value)}
                          className="bg-white border border-rose-200 rounded-lg px-3 py-2.5 text-rose-700 font-medium text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 cursor-pointer shadow-sm">
                          <option value="">— Select reason —</option>
                          {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">Value (₹)</label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-[#EBA7FF] transition-shadow shadow-sm">
                        <span className="px-3 text-slate-400 font-mono text-sm bg-slate-50 border-r border-slate-200 py-2.5">₹</span>
                        <input type="number" value={editData.price || ''} onChange={e => handleEditChange('price', e.target.value)}
                          className="flex-1 bg-transparent py-2.5 px-3 text-slate-900 font-medium text-sm focus:outline-none tabular-nums" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">Source</label>
                      <select value={editData.source || 'Website'} onChange={e => handleEditChange('source', e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] cursor-pointer shadow-sm">
                        {['Website','YouTube','LinkedIn','Direct','Referral','Alibaba','IndiaMart','TradeIndia','Manual Entry'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="font-semibold text-sm text-slate-800 mb-4 border-b border-slate-200 pb-2">Schedule</p>
                  <div className="grid grid-cols-3 gap-5">
                    {[
                      { label: 'Lead Date',      field: 'date' },
                      { label: 'Tentative Call', field: 'tentative_call_date' },
                      { label: 'GMeet Date',     field: 'gmeet_date' },
                    ].map(({ label, field }) => (
                      <div key={field} className="flex flex-col gap-1.5">
                        <label className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">{label}</label>
                        <input type="date" value={editData[field] || ''} onChange={e => handleEditChange(field, e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 tabular-nums text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] transition-shadow cursor-pointer shadow-sm" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* RIGHT: Notes Feed */}
              <div className="w-[420px] flex-shrink-0 flex flex-col border-l border-slate-200 overflow-hidden bg-white">
                <div className="flex-shrink-0 p-6 border-b border-slate-100 bg-slate-50/50">
                  <p className="font-semibold text-sm text-slate-800 mb-3">Append Update</p>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Type update or interaction..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-800 font-normal text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] resize-none transition-shadow shadow-sm"
                    style={{ height: '90px' }} />
                  <div className="flex gap-2 mt-3">
                    <select value={noteUser} onChange={e => setNoteUser(e.target.value)}
                      className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] truncate cursor-pointer shadow-sm">
                      {users.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button onClick={handleAppendNote} disabled={isAppending || !newNote.trim()}
                      className="flex-shrink-0 bg-purple-900 hover:bg-[#EBA7FF] disabled:bg-slate-200 disabled:text-slate-400 hover:text-purple-950 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm">
                      {isAppending ? '…' : 'Add Note'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-slate-800">Activity Log</span>
                    <span className="bg-white text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-md text-[10px] tabular-nums font-medium shadow-sm">
                      {parseNoteLines(profileLead.notes).length} entries
                    </span>
                  </div>
                  {parseNoteLines(profileLead.notes).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8 text-center opacity-60">
                      <span className="text-4xl text-slate-300">📝</span>
                      <span className="text-slate-500 font-normal text-sm">No notes recorded yet.</span>
                    </div>
                  ) : (
                    [...parseNoteLines(profileLead.notes)].reverse().map((line, i) => {
                      const { timestamp, user, text } = parseNoteEntry(line);
                      const isFirst = i === 0;
                      return (
                        <div key={i}
                          className={`rounded-xl p-4 flex flex-col gap-2.5 border transition-all ${
                            isFirst ? 'bg-purple-50/50 border-[#EBA7FF]/50 shadow-sm' : 'bg-white border-slate-100 shadow-sm'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold text-[13px] truncate ${isFirst ? 'text-purple-900' : 'text-slate-700'}`}>
                              {user || 'Unknown'}
                            </span>
                            <span className="text-slate-400 tabular-nums text-[10px] font-medium flex-shrink-0">
                              {timestamp || '—'}
                            </span>
                          </div>
                          <p className={`text-[13px] leading-relaxed font-normal ${isFirst ? 'text-slate-800' : 'text-slate-600'}`}>{text}</p>
                          {isFirst && <span className="text-[9px] text-purple-600 uppercase tracking-widest mt-1 font-semibold">↑ Most Recent</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-t border-slate-200 bg-white">
              <span className="tabular-nums text-[10px] font-medium text-slate-400 tracking-wider">
                ID: {String(profileLead.id).slice(0, 8)}…
              </span>
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-emerald-600 font-medium text-xs flex items-center gap-1.5 animate-pulse bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved successfully
                  </span>
                )}
                <button onClick={closeProfile} className="px-5 py-2 font-medium text-sm text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors">
                  Discard
                </button>
                <button onClick={handleSaveChanges} disabled={isSaving}
                  className="px-6 py-2 bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-sm rounded-lg transition-colors shadow-sm flex items-center gap-2">
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REMINDERS & CALENDAR MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {showReminders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 p-8 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-5">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                📅 Schedule & Reminders
              </h3>
              <button onClick={() => setShowReminders(false)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors border border-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-100 pb-8">
              <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-5 rounded-xl">
                <h4 className="font-semibold text-sm text-slate-800 border-b border-slate-200 pb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Today & Overdue</span>
                  <span className="bg-white text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] tabular-nums font-medium shadow-sm">{todayAlerts.length}</span>
                </h4>
                
                {currentTodayAlerts.length > 0 ? (
                  <div className="flex flex-col gap-3 min-h-[380px]">
                    {currentTodayAlerts.map((alert, index) => (
                      <div key={index} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[10px] uppercase tracking-wider">
                              {alert.alertType}
                            </span>
                            <span className="text-rose-600 tabular-nums font-medium text-[11px]">
                              {alert.alertDate}
                            </span>
                          </div>
                          <p className="text-slate-900 font-semibold text-base truncate">{alert.name}</p>
                        </div>
                        <div className="flex gap-2 w-full mt-1">
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[11px] uppercase tracking-wider py-2 rounded-lg transition-colors shadow-sm">
                            Dismiss
                          </button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-medium text-[11px] uppercase tracking-wider py-2 rounded-lg transition-colors shadow-sm">
                            ✓ Attended
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-auto">
                      {renderPagination(todayPage, todayTotalPages, setTodayPage)}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[150px]">
                    <span className="text-slate-500 font-medium text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">✅ Clear for today</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-5 rounded-xl">
                <h4 className="font-semibold text-sm text-slate-800 border-b border-slate-200 pb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Tomorrow & Upcoming</span>
                  <span className="bg-white text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] tabular-nums font-medium shadow-sm">{upcomingAlerts.length}</span>
                </h4>
                
                {currentUpcomingAlerts.length > 0 ? (
                  <div className="flex flex-col gap-3 min-h-[380px]">
                    {currentUpcomingAlerts.map((alert, index) => (
                      <div key={index} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[10px] uppercase tracking-wider">
                              {alert.alertType}
                            </span>
                            <span className="text-slate-500 tabular-nums font-medium text-[11px]">
                              {alert.alertDate}
                            </span>
                          </div>
                          <p className="text-slate-900 font-semibold text-base truncate">{alert.name}</p>
                        </div>
                        <div className="flex gap-2 w-full mt-1">
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[11px] uppercase tracking-wider py-2 rounded-lg transition-colors shadow-sm">
                            Dismiss
                          </button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-medium text-[11px] uppercase tracking-wider py-2 rounded-lg transition-colors shadow-sm">
                            ✓ Attended
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-auto">
                      {renderPagination(upcomingPage, upcomingTotalPages, setUpcomingPage)}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[150px]">
                    <span className="text-slate-400 font-medium text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">No upcoming alerts</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-sm text-slate-800 uppercase tracking-widest">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm">{'<'}</button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-4 text-[11px] font-medium bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm tracking-wider">TODAY</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm">{'>'}</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center font-medium text-[11px] uppercase text-slate-400 py-1">{d}</div>
                ))}
                {blanks.map(b => <div key={`blank-${b}`} className="p-2"></div>)}
                {calendarDays.map(day => {
                  const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateString === todayStr;
                  
                  const dayCalls = leads.filter(l => l.tentative_call_date === dateString && !l.call_attended);
                  const dayMeets = leads.filter(l => {
                    const gDate = l.gmeet_date ? String(l.gmeet_date).split('T')[0] : null;
                    return gDate === dateString && !l.gmeet_attended;
                  });

                  return (
                    <div key={day} className={`min-h-[85px] p-2.5 border rounded-xl flex flex-col items-start gap-1.5 transition-colors ${isToday ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <span className={`tabular-nums text-xs ${isToday ? 'text-purple-700 font-semibold' : 'text-slate-600 font-medium'}`}>{day}</span>
                      <div className="flex flex-col gap-1 w-full overflow-hidden">
                        {dayCalls.length > 0 && (
                          <div className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1" title={`Calls: ${dayCalls.map(l=>l.name).join(', ')}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> {dayCalls.length} Call
                          </div>
                        )}
                        {dayMeets.length > 0 && (
                          <div className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1" title={`GMeets: ${dayMeets.map(l=>l.name).join(', ')}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> {dayMeets.length} Meet
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 mt-6 justify-center">
                <span className="flex items-center gap-1.5 font-medium text-[11px] text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Call Scheduled</span>
                <span className="flex items-center gap-1.5 font-medium text-[11px] text-slate-500"><span className="w-2 h-2 rounded-full bg-purple-400"></span> GMeet Scheduled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MAIN PAGE CONTENT
      ════════════════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-[95%] xl:max-w-[95%] flex justify-between items-center mb-6 relative z-10">
        <button onClick={() => navigate('/database')}
          className="text-slate-500 hover:text-slate-800 font-medium text-[13px] uppercase tracking-wider transition-colors flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Analytics
        </button>
        
        <div className="flex gap-3 items-center">
          <button onClick={() => setShowReminders(true)}
            className="relative text-slate-600 hover:text-purple-900 font-medium text-[13px] uppercase tracking-wider transition-all flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-[#EBA7FF] hover:bg-[#EBA7FF]/5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Reminders
            {urgentAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white"></span>
              </span>
            )}
          </button>
          
          <span className="font-medium text-[13px] text-white tracking-wider uppercase flex items-center gap-2 bg-purple-900 px-4 py-2 rounded-lg shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Lead Manager
          </span>
        </div>
      </div>

      <div className="bg-white w-full max-w-[95%] xl:max-w-[95%] p-2 relative z-10 flex flex-col shadow-sm rounded-2xl border border-slate-200">
        
        {/* Header Section */}
        <div className="px-6 pt-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Lead Manager</h1>
              <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-medium tracking-wider uppercase mt-1">
                Click row to view profile
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadExcel}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-medium text-[11px] tracking-widest uppercase px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Export{processedLeads.length !== leads.length ? ` (${processedLeads.length})` : ''}
            </button>
            <button onClick={fetchLeads} className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-[11px] uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors border border-slate-200 shadow-sm">
              Refresh
            </button>
          </div>
        </div>

        {/* ── SEARCH + FILTER BAR ───────────────────────────────────────────── */}
        <div className="px-6 pb-4 flex flex-col gap-3">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={filters.globalSearch}
                onChange={e => setFilters(p => ({ ...p, globalSearch: e.target.value }))}
                placeholder="Search name, company, requirement..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-8 py-2.5 text-slate-800 font-normal text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] transition-shadow placeholder:text-slate-400 shadow-sm" />
              {filters.globalSearch && (
                <button onClick={() => setFilters(p => ({ ...p, globalSearch: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
              )}
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-[11px] tracking-widest uppercase border transition-colors shadow-sm whitespace-nowrap ${
                showFilters || activeFilterCount > 0
                  ? 'bg-purple-50 border-[#EBA7FF]/50 text-purple-900 ring-1 ring-[#EBA7FF]/30'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-purple-900 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ml-1">{activeFilterCount}</span>
              )}
            </button>
            {(activeFilterCount > 0 || sortConfig.key) && (
              <button onClick={clearAllFilters} className="px-4 py-2.5 rounded-lg font-medium text-[11px] tracking-widest uppercase border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-sm">
                Clear
              </button>
            )}
          </div>
          
          {showFilters && (
            <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6 flex flex-col gap-6 mt-1 shadow-inner">
              <div className="flex flex-col gap-3">
                <span className="font-medium text-[10px] text-slate-500 uppercase tracking-wider">Source</span>
                <div className="flex flex-wrap gap-2">
                  {uniqueSources.map(src => (
                    <button key={src} onClick={() => toggleFilter('source', src)}
                      className={`px-3 py-1.5 rounded-md font-medium text-xs border transition-all shadow-sm ${filters.source.includes(src) ? 'bg-purple-900 border-purple-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {filters.source.includes(src) && '✓ '}{src}
                    </button>
                  ))}
                  {!uniqueSources.length && <span className="text-slate-400 font-normal text-sm">No sources loaded.</span>}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-medium text-[10px] text-slate-500 uppercase tracking-wider">Pipeline Stage</span>
                <div className="flex flex-wrap gap-2">
                  {pipelineStages.map(stage => {
                    const on = stage === 'Closed - Won' ? 'bg-emerald-600 border-emerald-600 text-white'
                             : stage === 'Closed - Lost' ? 'bg-rose-600 border-rose-600 text-white'
                             : 'bg-purple-900 border-purple-900 text-white';
                    return (
                      <button key={stage} onClick={() => toggleFilter('status', stage)}
                        className={`px-3 py-1.5 rounded-md font-medium text-xs border transition-all shadow-sm ${filters.status.includes(stage) ? on : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {filters.status.includes(stage) && '✓ '}{stage}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-medium text-[10px] text-slate-500 uppercase tracking-wider">Temperature</span>
                <div className="flex gap-2.5">
                  {[{ val:'Hot', label:'🔥 Hot', on:'bg-rose-600 border-rose-600 text-white' },
                    { val:'Warm', label:'🌡️ Warm', on:'bg-amber-500 border-amber-500 text-white' },
                    { val:'Cold', label:'❄️ Cold', on:'bg-cyan-600 border-cyan-600 text-white' }
                  ].map(({ val, label, on }) => (
                    <button key={val} onClick={() => toggleFilter('lead_temp', val)}
                      className={`px-3 py-1.5 rounded-md font-medium text-xs border transition-all shadow-sm ${filters.lead_temp.includes(val) ? on : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {filters.lead_temp.includes(val) && '✓ '}{label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-[10px] text-slate-500 uppercase tracking-wider">Date Range</span>
                  <div className="flex items-center gap-2">
                    <input type="date" value={filters.dateStart} onChange={e => setFilters(p => ({ ...p, dateStart: e.target.value }))}
                      className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-slate-800 tabular-nums font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] cursor-pointer shadow-sm" />
                    <span className="text-slate-300 font-medium text-sm">→</span>
                    <input type="date" value={filters.dateEnd} onChange={e => setFilters(p => ({ ...p, dateEnd: e.target.value }))}
                      className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-slate-800 tabular-nums font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] cursor-pointer shadow-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-[10px] text-slate-500 uppercase tracking-wider">Value Range (₹)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={filters.priceMin} onChange={e => setFilters(p => ({ ...p, priceMin: e.target.value }))}
                      placeholder="Min" className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-slate-800 tabular-nums font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] placeholder:text-slate-400 shadow-sm" />
                    <span className="text-slate-300 font-medium text-sm">→</span>
                    <input type="number" value={filters.priceMax} onChange={e => setFilters(p => ({ ...p, priceMax: e.target.value }))}
                      placeholder="Max" className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-slate-800 tabular-nums font-medium text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-[#EBA7FF] placeholder:text-slate-400 shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {activeChips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md font-medium text-[11px] shadow-sm">
                  {chip.label}
                  <button onClick={chip.remove} className="hover:text-slate-900 transition-colors text-sm leading-none bg-slate-200/50 hover:bg-slate-300 px-1.5 rounded">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── DATA TABLE (MINIMALIST DESIGN) ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto relative rounded-xl border border-slate-200 bg-white mx-6 mb-6">
          {selectedLeads.length > 0 && (
            <div className="absolute top-0 left-0 w-full bg-slate-800 border-b border-slate-900 p-3.5 flex justify-between items-center z-20 rounded-t-xl">
              <span className="text-white font-medium text-[13px] tracking-wider uppercase ml-4">{selectedLeads.length} Lead(s) Selected</span>
              <button onClick={handleDeleteSelected} className="bg-rose-500 hover:bg-rose-600 text-white font-medium text-[11px] tracking-wider uppercase px-4 py-2 rounded-md transition-colors shadow-sm">
                🗑️ Delete Selected
              </button>
            </div>
          )}
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-400 font-medium tracking-wider text-sm uppercase">
              <svg className="w-8 h-8 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading Database...
            </div>
          ) : processedLeads.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <span className="text-5xl opacity-20 text-slate-400">🔍</span>
              <span className="text-slate-500 font-medium text-sm">No leads match your current filters.</span>
              <button onClick={clearAllFilters} className="text-purple-600 hover:text-[#EBA7FF] font-medium text-xs uppercase tracking-wider underline underline-offset-4 transition-colors mt-1">Clear filters</button>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse min-w-[1500px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
                    <th className="py-4 px-5 w-12">
                      <input type="checkbox" onChange={handleSelectAll}
                        checked={selectedLeads.length === processedLeads.length && processedLeads.length > 0}
                        className="w-4 h-4 accent-purple-600 cursor-pointer rounded border-slate-300" />
                    </th>
                    <th className="py-4 px-4 w-52"><span className="flex items-center">Client Info <SortBtn col="name" /></span></th>
                    <th className="py-4 px-4 w-64">Requirement</th>
                    <th className="py-4 px-4 w-72">Latest Note</th>
                    <th className="py-4 px-4 text-center w-36"><span className="flex items-center justify-center">Stage <SortBtn col="status" /></span></th>
                    <th className="py-4 px-4 text-center w-28"><span className="flex items-center justify-center">Temp <SortBtn col="lead_temp" /></span></th>
                    <th className="py-4 px-4 text-right w-32"><span className="flex items-center justify-end">Value (₹) <SortBtn col="price" /></span></th>
                    <th className="py-4 px-4 text-center w-40">Call / Meet</th>
                    <th className="py-4 px-4 w-32"><span className="flex items-center">Date <SortBtn col="date" /></span></th>
                    <th className="py-4 px-4 w-32">Source</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {processedLeads.map((lead, idx) => {
                    const latestNote  = getLatestNotePreview(lead.notes);
                    const noteCount   = parseNoteLines(lead.notes).length;
                    return (
                      <tr key={lead.id}
                        onClick={() => openProfile(lead)}
                        className={`transition-colors duration-150 cursor-pointer group border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-[#EBA7FF]/5`}>
                        
                        <td className="py-5 px-5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedLeads.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            className="w-4 h-4 accent-purple-600 cursor-pointer rounded border-slate-300" />
                        </td>
                        
                        <td className="py-5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-medium text-xs shadow-sm">
                              {getInitials(lead.name)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-slate-900 font-semibold text-[14px] leading-tight">{lead.name || '—'}</span>
                              <span className="text-slate-500 text-[12px] font-normal mt-0.5">{lead.company_name || ''}</span>
                              <span className="text-slate-400 text-[11px] tabular-nums font-medium mt-0.5">{lead.phone || ''}</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-5 px-4">
                          <span className="text-slate-700 font-normal text-[13px] line-clamp-2 leading-relaxed">
                            {lead.requirement || <span className="text-slate-400 italic">No requirement</span>}
                          </span>
                        </td>
                        
                        <td className="py-5 px-4">
                          {latestNote ? (
                            <div className="flex flex-col gap-1.5">
                              <p className="text-slate-600 text-[13px] leading-relaxed line-clamp-2 italic font-normal">"{latestNote}"</p>
                              {noteCount > 1 && <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider">+{noteCount - 1} more</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal text-[12px] italic">No notes</span>
                          )}
                        </td>
                        
                        <td className="py-5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <StatusBadge status={lead.status} />
                            {lead.status === 'Closed - Lost' && lead.lost_reason && (
                              <span className="text-[10px] text-slate-500 font-normal truncate max-w-[120px]" title={lead.lost_reason}>
                                {lead.lost_reason}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-5 px-4 text-center">
                          <TempBadge temp={lead.lead_temp} />
                        </td>
                        
                        <td className="py-5 px-4 text-right">
                          <span className="text-slate-900 font-medium text-[14px] tabular-nums">
                            {lead.price ? `₹${Number(lead.price).toLocaleString('en-IN')}` : <span className="text-slate-300 font-sans text-sm">—</span>}
                          </span>
                        </td>
                        
                        <td className="py-5 px-4 text-center">
                          <div className="flex flex-col gap-1 items-start w-fit mx-auto min-w-[100px]">
                            {lead.tentative_call_date && <span className="tabular-nums text-[11px] text-slate-600 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> {lead.tentative_call_date}</span>}
                            {lead.gmeet_date && <span className="tabular-nums text-[11px] text-slate-600 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> {lead.gmeet_date}</span>}
                            {!lead.tentative_call_date && !lead.gmeet_date && <span className="text-slate-400 font-normal text-[11px] mx-auto italic">Unscheduled</span>}
                          </div>
                        </td>
                        
                        <td className="py-5 px-4">
                          <span className="text-slate-600 tabular-nums font-medium text-[12px]">{lead.date || '—'}</span>
                        </td>
                        
                        <td className="py-5 px-4">
                          <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md font-medium text-[10px] uppercase tracking-wider shadow-sm">
                            {lead.source || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-between items-center px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                <span className="font-normal text-[12px] text-slate-500">
                  Showing <strong className="text-slate-800 font-medium">{processedLeads.length}</strong> of <strong className="text-slate-800 font-medium">{leads.length}</strong> leads
                  {processedLeads.length !== leads.length && <span className="text-purple-600 font-medium"> (filtered)</span>}
                </span>
                <span className="font-medium text-[11px] text-slate-500 uppercase tracking-widest">
                  Total Value: <strong className="text-slate-900 text-[14px] ml-1.5 tracking-normal tabular-nums">₹{filteredValue.toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
