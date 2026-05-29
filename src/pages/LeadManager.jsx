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

// ── STRIKING VIBRANT BADGES ───────────────────────────────────────────
const STATUS_STYLE = {
  'New':           'bg-slate-500 text-white',
  'Contacted':     'bg-blue-500 text-white',
  'Quoted / Demo': 'bg-amber-500 text-white',
  'Negotiation':   'bg-purple-500 text-white',
  'Closed - Won':  'bg-emerald-500 text-white',
  'Closed - Lost': 'bg-rose-500 text-white',
};

const StatusBadge = ({ status }) => (
  <span className={`px-3.5 py-1.5 rounded-md font-sans text-xs font-bold uppercase tracking-wider shadow-sm whitespace-nowrap ${STATUS_STYLE[status] || STATUS_STYLE['New']}`}>
    {status || 'New'}
  </span>
);

const TempBadge = ({ temp }) => {
  const cfg = { Hot: '🔥 Hot', Warm: '🌡️ Warm', Cold: '❄️ Cold' };
  const cls = temp === 'Hot' ? 'bg-rose-500 text-white'
            : temp === 'Warm' ? 'bg-amber-500 text-white'
            : 'bg-cyan-500 text-white';
  return (
    <span className={`px-3.5 py-1.5 rounded-md font-sans text-xs font-bold uppercase tracking-wider shadow-sm whitespace-nowrap ${cls}`}>
      {cfg[temp] || '❄️ Cold'}
    </span>
  );
};

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
            className={`w-8 h-8 rounded-md font-mono text-sm transition-colors ${
              currentPage === p ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 border border-slate-300 text-slate-700 hover:bg-slate-300'
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
      className={`ml-1.5 text-[11px] transition-all hover:scale-110 ${sortConfig.key === col ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
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
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans text-slate-800">
      
      {/* ════════════════════════════════════════════════════════════════════
          PROFILE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {profileLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col overflow-hidden"
               style={{ maxHeight: '92vh' }}>
            
            <div className="flex-shrink-0 flex justify-between items-start px-8 py-6 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <div className="min-w-0">
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1.5">Lead Profile</p>
                  <h3 className="text-3xl font-black text-slate-900 truncate">{editData.name || '—'}</h3>
                  {editData.company_name && (
                    <p className="text-slate-600 text-base mt-1 font-medium">{editData.company_name}</p>
                  )}
                </div>
                <div className="pt-7 flex-shrink-0">
                  <StatusBadge status={editData.status} />
                </div>
              </div>
              <button onClick={closeProfile} className="flex-shrink-0 ml-4 mt-1 text-slate-400 hover:text-slate-700 transition-colors bg-white border border-slate-200 hover:bg-slate-100 p-2.5 rounded-full shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-50/30">
              <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 min-w-0">
                <section>
                  <p className="font-bold text-base text-slate-800 mb-4 border-b border-slate-200 pb-2">Contact Information</p>
                  <div className="grid grid-cols-2 gap-5">
                    {[
                      { label: 'Name',     field: 'name',         type: 'text' },
                      { label: 'Company',  field: 'company_name', type: 'text' },
                      { label: 'Phone',    field: 'phone',        type: 'text' },
                      { label: 'Location', field: 'location',     type: 'text' },
                    ].map(({ label, field, type }) => (
                      <div key={field} className="flex flex-col gap-2">
                        <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">{label}</label>
                        <input type={type} value={editData[field] || ''}
                          onChange={e => handleEditChange(field, e.target.value)}
                          className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow shadow-sm font-medium" />
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="font-bold text-base text-slate-800 mb-4 border-b border-slate-200 pb-2">Requirement</p>
                  <textarea value={editData.requirement || ''} rows={3}
                    onChange={e => handleEditChange('requirement', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-shadow shadow-sm font-medium" />
                </section>

                <section>
                  <p className="font-bold text-base text-slate-800 mb-4 border-b border-slate-200 pb-2">Pipeline Details</p>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Pipeline Stage</label>
                      <select value={editData.status || 'New'} onChange={e => handleEditChange('status', e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm">
                        {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Temperature</label>
                      <select value={editData.lead_temp || 'Cold'} onChange={e => handleEditChange('lead_temp', e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm">
                        <option value="Cold">❄️ Cold</option>
                        <option value="Warm">🌡️ Warm</option>
                        <option value="Hot">🔥 Hot</option>
                      </select>
                    </div>
                    {editData.status === 'Closed - Lost' && (
                      <div className="col-span-2 flex flex-col gap-2">
                        <label className="font-bold text-xs text-rose-600 uppercase tracking-wider">Lost Reason</label>
                        <select value={editData.lost_reason || ''} onChange={e => handleEditChange('lost_reason', e.target.value)}
                          className="bg-rose-50 border border-rose-300 rounded-lg px-4 py-3 text-rose-800 font-bold text-[15px] focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer shadow-sm">
                          <option value="">— Select reason —</option>
                          {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Value (₹)</label>
                      <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-shadow shadow-sm">
                        <span className="px-4 text-emerald-700 font-mono font-bold text-[15px] bg-slate-50 border-r border-slate-200 py-3">₹</span>
                        <input type="number" value={editData.price || ''} onChange={e => handleEditChange('price', e.target.value)}
                          className="flex-1 bg-transparent py-3 px-3 text-slate-900 font-mono font-bold text-[15px] focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Source</label>
                      <select value={editData.source || 'Website'} onChange={e => handleEditChange('source', e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm">
                        {['Website','YouTube','LinkedIn','Direct','Referral','Alibaba','IndiaMart','TradeIndia','Manual Entry'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="font-bold text-base text-slate-800 mb-4 border-b border-slate-200 pb-2">Schedule</p>
                  <div className="grid grid-cols-3 gap-5">
                    {[
                      { label: 'Lead Date',      field: 'date' },
                      { label: 'Tentative Call', field: 'tentative_call_date' },
                      { label: 'GMeet Date',     field: 'gmeet_date' },
                    ].map(({ label, field }) => (
                      <div key={field} className="flex flex-col gap-2">
                        <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">{label}</label>
                        <input type="date" value={editData[field] || ''} onChange={e => handleEditChange(field, e.target.value)}
                          className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow cursor-pointer shadow-sm" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="w-[440px] flex-shrink-0 flex flex-col border-l border-slate-200 overflow-hidden bg-white">
                <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-slate-50">
                  <p className="font-bold text-base text-slate-800 mb-3">Append Update</p>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Type update or interaction..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-4 text-slate-900 font-medium text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-shadow shadow-sm"
                    style={{ height: '110px' }} />
                  <div className="flex gap-3 mt-4">
                    <select value={noteUser} onChange={e => setNoteUser(e.target.value)}
                      className="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-3 py-3 text-slate-800 font-bold text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 truncate cursor-pointer shadow-sm">
                      {users.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button onClick={handleAppendNote} disabled={isAppending || !newNote.trim()}
                      className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-[15px] px-6 py-3 rounded-lg transition-colors shadow-md">
                      {isAppending ? '…' : 'Add Note'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base text-slate-800">Activity Log</span>
                    <span className="bg-slate-200 text-slate-600 border border-slate-300 px-3 py-1 rounded-full text-[11px] font-mono font-bold">
                      {parseNoteLines(profileLead.notes).length} entries
                    </span>
                  </div>
                  {parseNoteLines(profileLead.notes).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 text-center opacity-60">
                      <span className="text-5xl text-slate-300">📝</span>
                      <span className="text-slate-500 font-medium text-base">No notes recorded yet.</span>
                    </div>
                  ) : (
                    [...parseNoteLines(profileLead.notes)].reverse().map((line, i) => {
                      const { timestamp, user, text } = parseNoteEntry(line);
                      const isFirst = i === 0;
                      return (
                        <div key={i}
                          className={`rounded-xl p-5 flex flex-col gap-3 border transition-all ${
                            isFirst ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white border-slate-200 shadow-sm'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold text-[15px] truncate ${isFirst ? 'text-blue-800' : 'text-slate-800'}`}>
                              {user || 'Unknown'}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px] font-medium flex-shrink-0">
                              {timestamp || '—'}
                            </span>
                          </div>
                          <p className={`text-[15px] leading-relaxed font-medium ${isFirst ? 'text-blue-900' : 'text-slate-700'}`}>{text}</p>
                          {isFirst && <span className="font-mono text-[11px] text-blue-600 uppercase tracking-widest mt-1 font-bold">↑ Most Recent</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-8 py-5 border-t border-slate-200 bg-slate-100">
              <span className="font-mono text-xs font-bold text-slate-400 tracking-wider">
                ID: {String(profileLead.id).slice(0, 8)}…
              </span>
              <div className="flex items-center gap-4">
                {saveSuccess && (
                  <span className="text-emerald-700 font-bold text-base flex items-center gap-2 animate-pulse bg-emerald-100 px-4 py-2 rounded-lg border border-emerald-300 shadow-sm">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved successfully
                  </span>
                )}
                <button onClick={closeProfile} className="px-6 py-3 font-bold text-[15px] text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm transition-colors">
                  Discard
                </button>
                <button onClick={handleSaveChanges} disabled={isSaving}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-[15px] rounded-lg transition-colors shadow-md flex items-center gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 p-8 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-5">
              <h3 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                📅 Schedule & Reminders
              </h3>
              <button onClick={() => setShowReminders(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-3 rounded-full transition-colors border border-slate-200 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-200 pb-8">
              <div className="flex flex-col gap-4 bg-rose-50/50 border border-rose-200 p-6 rounded-xl shadow-sm">
                <h4 className="font-bold text-base text-rose-700 border-b border-rose-200 pb-3 flex items-center gap-2">
                  <span>⚠️ Today & Overdue</span>
                  <span className="bg-rose-200 text-rose-800 px-3 py-1 rounded-full text-xs font-mono">{todayAlerts.length}</span>
                </h4>
                
                {currentTodayAlerts.length > 0 ? (
                  <div className="flex flex-col gap-4 min-h-[380px]">
                    {currentTodayAlerts.map((alert, index) => (
                      <div key={index} className="bg-white border border-rose-300 p-5 rounded-xl flex flex-col justify-between gap-3 shadow-md">
                        <div>
                          <div className="flex items-center gap-3 mb-2.5">
                            <span className={`px-3 py-1 rounded-md font-mono text-[11px] font-bold uppercase tracking-widest ${alert.alertType === 'Call' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-purple-100 text-purple-700 border border-purple-300'}`}>
                              {alert.alertType}
                            </span>
                            <span className="text-rose-800 font-mono font-bold text-xs bg-rose-100 border border-rose-300 px-3 py-1 rounded-md">
                              {alert.alertDate}
                            </span>
                          </div>
                          <p className="text-slate-900 font-bold text-lg truncate">{alert.name}</p>
                        </div>
                        <div className="flex gap-3 w-full mt-2">
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors shadow-sm">
                            Dismiss
                          </button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors shadow-md">
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
                    <span className="text-emerald-600 font-bold text-base bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-200 shadow-sm">✅ Clear for today</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-6 rounded-xl shadow-sm">
                <h4 className="font-bold text-base text-slate-700 border-b border-slate-200 pb-3 flex items-center gap-2">
                  <span>📅 Tomorrow & Upcoming</span>
                  <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-mono">{upcomingAlerts.length}</span>
                </h4>
                
                {currentUpcomingAlerts.length > 0 ? (
                  <div className="flex flex-col gap-4 min-h-[380px]">
                    {currentUpcomingAlerts.map((alert, index) => (
                      <div key={index} className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col justify-between gap-3 shadow-md">
                        <div>
                          <div className="flex items-center gap-3 mb-2.5">
                            <span className={`px-3 py-1 rounded-md font-mono text-[11px] font-bold uppercase tracking-widest ${alert.alertType === 'Call' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-purple-100 text-purple-700 border border-purple-300'}`}>
                              {alert.alertType}
                            </span>
                            <span className="text-slate-700 font-mono font-bold text-xs bg-slate-100 border border-slate-300 px-3 py-1 rounded-md">
                              {alert.alertDate}
                            </span>
                          </div>
                          <p className="text-slate-900 font-bold text-lg truncate">{alert.name}</p>
                        </div>
                        <div className="flex gap-3 w-full mt-2">
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors shadow-sm">
                            Dismiss
                          </button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors shadow-md">
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
                    <span className="text-slate-500 font-bold text-base bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm">No upcoming alerts</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-base text-slate-800 uppercase tracking-widest">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm">{'<'}</button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-5 font-mono text-sm font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm">TODAY</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm">{'>'}</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center font-bold text-sm uppercase text-slate-400 py-2">{d}</div>
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
                    <div key={day} className={`min-h-[100px] p-3 border rounded-xl flex flex-col items-start gap-2 transition-colors ${isToday ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:bg-slate-50 shadow-sm'}`}>
                      <span className={`font-mono text-sm ${isToday ? 'text-blue-700 font-black' : 'text-slate-500 font-bold'}`}>{day}</span>
                      <div className="flex flex-col gap-1.5 w-full overflow-hidden">
                        {dayCalls.length > 0 && (
                          <div className="text-xs bg-blue-100 text-blue-800 border border-blue-300 px-2 py-1 rounded-md truncate font-bold shadow-sm" title={`Calls: ${dayCalls.map(l=>l.name).join(', ')}`}>
                            📞 {dayCalls.length} Call(s)
                          </div>
                        )}
                        {dayMeets.length > 0 && (
                          <div className="text-xs bg-purple-100 text-purple-800 border border-purple-300 px-2 py-1 rounded-md truncate font-bold shadow-sm" title={`GMeets: ${dayMeets.map(l=>l.name).join(', ')}`}>
                            📹 {dayMeets.length} Meet(s)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 mt-8 justify-center">
                <span className="flex items-center gap-2 font-bold text-xs text-slate-500"><span className="w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-400 shadow-sm"></span> Call Scheduled</span>
                <span className="flex items-center gap-2 font-bold text-xs text-slate-500"><span className="w-4 h-4 rounded-full bg-purple-100 border-2 border-purple-400 shadow-sm"></span> GMeet Scheduled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MAIN PAGE CONTENT
      ════════════════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-[95%] xl:max-w-[95%] flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/database')}
          className="text-slate-500 hover:text-blue-600 font-bold text-[15px] uppercase tracking-widest transition-colors flex items-center gap-2 bg-white px-5 py-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Analytics
        </button>
        
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowReminders(true)}
            className="relative text-slate-700 hover:text-blue-700 font-bold text-[15px] uppercase tracking-widest transition-colors flex items-center gap-2 bg-white px-6 py-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Reminders
            {urgentAlerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white"></span>
              </span>
            )}
          </button>
          
          <span className="font-bold text-[15px] text-blue-700 tracking-widest uppercase flex items-center gap-2 bg-blue-100 px-6 py-3 rounded-lg border border-blue-300 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Lead Manager
          </span>
        </div>
      </div>

      <div className="bg-white w-full max-w-[95%] xl:max-w-[95%] p-8 relative z-10 flex flex-col gap-8 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200">
        
        {/* Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Lead Manager</h1>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-md font-mono text-[10px] font-bold tracking-widest uppercase shadow-sm mt-1">
                Click row to view profile
              </span>
            </div>
            <p className="text-slate-500 font-medium text-base mt-2">Sort, filter, and search leads. Table is view-only.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleDownloadExcel}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-bold text-[13px] tracking-widest uppercase px-6 py-3.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Export{processedLeads.length !== leads.length ? ` (${processedLeads.length})` : ''}
            </button>
            <button onClick={fetchLeads} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] uppercase tracking-widest px-6 py-3.5 rounded-lg transition-colors border border-slate-300 shadow-sm">
              Refresh
            </button>
          </div>
        </div>

        {/* ── SEARCH + FILTER BAR ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={filters.globalSearch}
                onChange={e => setFilters(p => ({ ...p, globalSearch: e.target.value }))}
                placeholder="Search name, company, requirement, phone, location..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-12 pr-10 py-4 text-slate-900 font-medium text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-shadow placeholder:text-slate-400 shadow-sm" />
              {filters.globalSearch && (
                <button onClick={() => setFilters(p => ({ ...p, globalSearch: '' }))} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">×</button>
              )}
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-sm tracking-widest uppercase border transition-colors shadow-sm whitespace-nowrap ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-100'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-[12px] font-black rounded-md px-2 py-0.5 ml-1">{activeFilterCount}</span>
              )}
            </button>
            {(activeFilterCount > 0 || sortConfig.key) && (
              <button onClick={clearAllFilters} className="px-6 py-4 rounded-xl font-bold text-[13px] tracking-widest uppercase border border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors whitespace-nowrap shadow-sm">
                Clear All
              </button>
            )}
          </div>
          
          {showFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-7 flex flex-col gap-8 mt-2 shadow-inner">
              <div className="flex flex-col gap-3.5">
                <span className="font-bold text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Source</span>
                <div className="flex flex-wrap gap-2.5">
                  {uniqueSources.map(src => (
                    <button key={src} onClick={() => toggleFilter('source', src)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm border transition-all shadow-sm ${filters.source.includes(src) ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-100'}`}>
                      {filters.source.includes(src) && '✓ '}{src}
                    </button>
                  ))}
                  {!uniqueSources.length && <span className="text-slate-400 font-medium text-base">No sources loaded.</span>}
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                <span className="font-bold text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Pipeline Stage</span>
                <div className="flex flex-wrap gap-2.5">
                  {pipelineStages.map(stage => {
                    const on = stage === 'Closed - Won' ? 'bg-emerald-600 border-emerald-700 text-white shadow-md'
                             : stage === 'Closed - Lost' ? 'bg-rose-600 border-rose-700 text-white shadow-md'
                             : stage === 'Negotiation' ? 'bg-purple-600 border-purple-700 text-white shadow-md'
                             : 'bg-blue-600 border-blue-700 text-white shadow-md';
                    return (
                      <button key={stage} onClick={() => toggleFilter('status', stage)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm border transition-all shadow-sm ${filters.status.includes(stage) ? on : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-100'}`}>
                        {filters.status.includes(stage) && '✓ '}{stage}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                <span className="font-bold text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Temperature</span>
                <div className="flex gap-3">
                  {[{ val:'Hot', label:'🔥 Hot', on:'bg-rose-600 border-rose-700 text-white shadow-md' },
                    { val:'Warm', label:'🌡️ Warm', on:'bg-amber-500 border-amber-600 text-white shadow-md' },
                    { val:'Cold', label:'❄️ Cold', on:'bg-cyan-600 border-cyan-700 text-white shadow-md' }
                  ].map(({ val, label, on }) => (
                    <button key={val} onClick={() => toggleFilter('lead_temp', val)}
                      className={`px-5 py-2.5 rounded-lg font-bold text-[15px] border transition-all shadow-sm ${filters.lead_temp.includes(val) ? on : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-100'}`}>
                      {filters.lead_temp.includes(val) && '✓ '}{label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2 border-t border-slate-200 pt-8">
                <div className="flex flex-col gap-3">
                  <span className="font-bold text-xs text-slate-500 uppercase tracking-widest">Date Range</span>
                  <div className="flex items-center gap-3">
                    <input type="date" value={filters.dateStart} onChange={e => setFilters(p => ({ ...p, dateStart: e.target.value }))}
                      className="flex-1 bg-white border border-slate-300 px-4 py-3.5 rounded-xl text-slate-900 font-mono font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 cursor-pointer shadow-sm" />
                    <span className="text-slate-400 font-black text-xl">→</span>
                    <input type="date" value={filters.dateEnd} onChange={e => setFilters(p => ({ ...p, dateEnd: e.target.value }))}
                      className="flex-1 bg-white border border-slate-300 px-4 py-3.5 rounded-xl text-slate-900 font-mono font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 cursor-pointer shadow-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="font-bold text-xs text-slate-500 uppercase tracking-widest">Value Range (₹)</span>
                  <div className="flex items-center gap-3">
                    <input type="number" value={filters.priceMin} onChange={e => setFilters(p => ({ ...p, priceMin: e.target.value }))}
                      placeholder="Min" className="flex-1 bg-white border border-slate-300 px-4 py-3.5 rounded-xl text-slate-900 font-mono font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400 shadow-sm" />
                    <span className="text-slate-400 font-black text-xl">→</span>
                    <input type="number" value={filters.priceMax} onChange={e => setFilters(p => ({ ...p, priceMax: e.target.value }))}
                      placeholder="Max" className="flex-1 bg-white border border-slate-300 px-4 py-3.5 rounded-xl text-slate-900 font-mono font-bold text-[15px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400 shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mt-3">
              {activeChips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-2 bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm shadow-sm">
                  {chip.label}
                  <button onClick={chip.remove} className="hover:text-blue-900 transition-colors text-lg leading-none bg-blue-200/50 hover:bg-blue-300 px-2 rounded">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── DATA TABLE ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto relative rounded-xl border border-slate-300 bg-white shadow-sm mt-2">
          {selectedLeads.length > 0 && (
            <div className="absolute top-0 left-0 w-full bg-rose-50 border-b border-rose-200 p-4 flex justify-between items-center z-20 shadow-md rounded-t-xl">
              <span className="text-rose-800 font-bold text-base tracking-widest uppercase ml-4">{selectedLeads.length} Lead(s) Selected</span>
              <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[13px] tracking-widest uppercase px-6 py-3 rounded-lg transition-colors shadow-sm">
                🗑️ Delete Selected
              </button>
            </div>
          )}
          {isLoading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-6 text-slate-500 font-bold tracking-widest text-lg">
              <svg className="w-12 h-12 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              LOADING DATABASE...
            </div>
          ) : processedLeads.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center gap-5">
              <span className="text-7xl opacity-30 text-slate-400">🔍</span>
              <span className="text-slate-600 font-bold text-xl">No leads match your current filters.</span>
              <button onClick={clearAllFilters} className="text-blue-600 hover:text-blue-800 font-bold text-base uppercase tracking-widest underline underline-offset-4 transition-colors mt-2">Clear filters</button>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse min-w-[1720px]">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="py-5 px-6 w-14">
                      <input type="checkbox" onChange={handleSelectAll}
                        checked={selectedLeads.length === processedLeads.length && processedLeads.length > 0}
                        className="w-5 h-5 accent-blue-600 cursor-pointer" />
                    </th>
                    <th className="py-5 px-4 w-52"><span className="flex items-center">Client Info <SortBtn col="name" /></span></th>
                    <th className="py-5 px-4 w-64">Requirement</th>
                    <th className="py-5 px-4 w-72">Latest Note</th>
                    <th className="py-5 px-4 text-center w-44"><span className="flex items-center justify-center">Stage <SortBtn col="status" /></span></th>
                    <th className="py-5 px-4 text-center w-36"><span className="flex items-center justify-center">Temp <SortBtn col="lead_temp" /></span></th>
                    <th className="py-5 px-4 text-right w-44"><span className="flex items-center justify-end">Value (₹) <SortBtn col="price" /></span></th>
                    <th className="py-5 px-4 text-center w-48">Call / Meet</th>
                    <th className="py-5 px-4 w-44"><span className="flex items-center">Date <SortBtn col="date" /></span></th>
                    <th className="py-5 px-4 w-36">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {processedLeads.map(lead => {
                    const latestNote  = getLatestNotePreview(lead.notes);
                    const noteCount   = parseNoteLines(lead.notes).length;
                    return (
                      <tr key={lead.id}
                        onClick={() => openProfile(lead)}
                        className="bg-white even:bg-slate-50 border-l-4 border-transparent hover:bg-blue-50/60 hover:border-blue-500 transition-colors cursor-pointer group">
                        
                        <td className="py-5 px-6" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedLeads.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            className="w-5 h-5 accent-blue-600 cursor-pointer" />
                        </td>
                        
                        <td className="py-5 px-4">
                          <div className="flex flex-col gap-1.5">
                            {/* 🔥 BUMPED FONT: Client Name */}
                            <span className="text-slate-900 font-black text-lg">{lead.name || '—'}</span>
                            {/* 🔥 BUMPED FONT: Company */}
                            <span className="text-slate-600 text-[15px] font-bold">{lead.company_name || ''}</span>
                            {/* 🔥 BUMPED FONT: Phone */}
                            <span className="text-blue-700 text-[14px] font-mono font-medium mt-0.5">{lead.phone || ''}</span>
                          </div>
                        </td>
                        
                        <td className="py-5 px-4">
                          {/* 🔥 BUMPED FONT: Requirement */}
                          <span className="text-slate-700 font-medium text-base line-clamp-2 leading-relaxed">
                            {lead.requirement || <span className="text-slate-400 italic">No requirement provided</span>}
                          </span>
                        </td>
                        
                        <td className="py-5 px-4">
                          {latestNote ? (
                            <div className="flex flex-col gap-2 bg-slate-100/80 group-hover:bg-white p-3.5 rounded-lg border border-slate-200 transition-colors shadow-sm">
                              {/* 🔥 BUMPED FONT: Latest Note */}
                              <p className="text-slate-800 text-[15px] leading-relaxed line-clamp-2 italic font-medium">"{latestNote}"</p>
                              {noteCount > 1 && <span className="text-blue-700 font-bold text-[10px] uppercase tracking-wider">+{noteCount - 1} earlier entr{noteCount - 1 === 1 ? 'y' : 'ies'}</span>}
                            </div>
                          ) : (
                            /* 🔥 BUMPED FONT: No Note State */
                            <span className="text-slate-500 font-bold text-[13px] italic bg-slate-100 px-4 py-2.5 rounded-lg border border-slate-200">No notes recorded</span>
                          )}
                        </td>
                        
                        <td className="py-5 px-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <StatusBadge status={lead.status} />
                            {lead.status === 'Closed - Lost' && lead.lost_reason && (
                              <span className="text-[10px] text-rose-700 font-bold font-mono truncate max-w-[140px] px-2.5 py-1 bg-rose-100 rounded-md border border-rose-300 shadow-sm" title={lead.lost_reason}>
                                ↳ {lead.lost_reason}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-5 px-4 text-center">
                          <TempBadge temp={lead.lead_temp} />
                        </td>
                        
                        <td className="py-5 px-4 text-right">
                          <span className="text-emerald-700 font-mono text-lg font-black">
                            {lead.price ? `₹${Number(lead.price).toLocaleString('en-IN')}` : <span className="text-slate-300 font-sans text-base">—</span>}
                          </span>
                        </td>
                        
                        <td className="py-5 px-4 text-center">
                          <div className="flex flex-col gap-2 items-start bg-slate-100 p-2.5 rounded-lg border border-slate-200 w-fit mx-auto min-w-[120px] shadow-sm">
                            {lead.tentative_call_date && <span className="font-mono text-xs text-blue-800 font-bold flex items-center gap-2">📞 {lead.tentative_call_date}</span>}
                            {lead.gmeet_date && <span className="font-mono text-xs text-purple-800 font-bold flex items-center gap-2">📹 {lead.gmeet_date}</span>}
                            {!lead.tentative_call_date && !lead.gmeet_date && <span className="text-slate-500 font-bold text-sm mx-auto py-1 italic">Unscheduled</span>}
                          </div>
                        </td>
                        
                        <td className="py-5 px-4">
                          <span className="text-slate-600 font-mono font-bold text-sm">{lead.date || '—'}</span>
                        </td>
                        
                        <td className="py-5 px-4">
                          <span className={`font-mono text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-md border shadow-sm ${
                            lead.source === 'IndiaMart' ? 'text-blue-800 border-blue-300 bg-blue-100' : 
                            lead.source === 'TradeIndia' ? 'text-amber-800 border-amber-300 bg-amber-100' : 
                            lead.source === 'Alibaba' ? 'text-orange-800 border-orange-300 bg-orange-100' : 
                            'text-slate-700 border-slate-300 bg-slate-200'
                          }`}>
                            {lead.source || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-between items-center px-8 py-5 bg-slate-50 border-t border-slate-300 rounded-b-xl">
                <span className="font-medium text-sm text-slate-500">
                  Showing <strong className="text-slate-900 font-black">{processedLeads.length}</strong> of <strong className="text-slate-900 font-black">{leads.length}</strong> leads
                  {processedLeads.length !== leads.length && <span className="text-blue-600 font-bold"> (filtered)</span>}
                  {sortConfig.key && <span> · sorted by <strong className="text-slate-900 font-bold">{sortConfig.key}</strong> {sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                  <span className="ml-5 text-slate-400 hidden md:inline">· Scroll right to see Date / Source</span>
                </span>
                <span className="font-bold text-[13px] text-slate-600 uppercase tracking-widest">
                  Filtered Pipeline Value: <strong className="text-emerald-700 text-lg ml-2 tracking-normal font-black">₹{filteredValue.toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
