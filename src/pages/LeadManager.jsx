import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

// ── DATE FORMATTING UTILITY ────────────────────────────────────────────────
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  // Manually parse YYYY-MM-DD to completely avoid Timezone shift bugs
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
};

// ── BULLETPROOF NOTE UTILITIES (UPGRADED EDITABLE PARSER) ──────────────────
const getParsedNotes = (notesStr) => {
  if (typeof notesStr !== 'string' || !notesStr.trim()) return [];
  // Split the giant string intelligently every time it sees a [YYYY-MM-DD HH:MM] timestamp
  const blocks = notesStr.split(/(?=\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] \[.*?\])/).filter(l => l.trim() !== '');
  
  return blocks.map((block, index) => {
    const m = block.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] \[(.*?)\] ([\s\S]*)$/);
    if (m) {
      return { index, timestamp: m[1], user: m[2], text: m[3].trim() };
    }
    // Safety Fallback: If a note is malformed, it won't disappear, it becomes a "System" note
    return { index, timestamp: 'Legacy/Unknown', user: 'System', text: block.trim() };
  });
};

const getLatestNotePreview = (notesStr) => {
  const parsed = getParsedNotes(notesStr);
  if (!parsed.length) return null;
  // Strip newlines just for the single-line table preview
  let text = parsed[parsed.length - 1].text.replace(/\n/g, ' '); 
  return text.length > 75 ? text.slice(0, 75) + '…' : text;
};

// ── UI HELPERS ─────────────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

// ── FLASHY VIBRANT BADGES ──────────────────────────────────────────────────────
const STATUS_STYLE = {
  'New':           'bg-slate-900 text-white shadow-md', // Midnight Black
  'Contacted':     'bg-blue-600 text-white shadow-md',
  'Quoted / Demo': 'bg-amber-500 text-white shadow-md',
  'Negotiation':   'bg-purple-600 text-white shadow-md',
  'Closed - Won':  'bg-emerald-600 text-white shadow-md',
  'Closed - Lost': 'bg-rose-600 text-white shadow-md',
};

const StatusBadge = ({ status }) => (
  <span className={`px-4 py-2 rounded-lg font-sans text-sm font-black uppercase tracking-widest shadow-md whitespace-nowrap ${STATUS_STYLE[status] || STATUS_STYLE['New']}`}>
    {status || 'New'}
  </span>
);

const TempBadge = ({ temp }) => {
  const cfg = { Hot: '🔥 HOT', Warm: '🌡️ WARM', Cold: '❄️ COLD' };
  const cls = temp === 'Hot' ? 'bg-rose-600 text-white'
            : temp === 'Warm' ? 'bg-amber-500 text-white'
            : 'bg-cyan-600 text-white';
  return (
    <span className={`px-4 py-2 rounded-lg font-sans text-sm font-black uppercase tracking-widest shadow-md whitespace-nowrap ${cls}`}>
      {cfg[temp] || '❄️ COLD'}
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
    globalSearch: '', source: [], status: [], lead_temp: [], dateStart: '', dateEnd: '', priceMin: '', priceMax: '',
  });
  const [selectedLeads, setSelectedLeads] = useState([]);

  // === PROFILE MODAL STATE ===
  const [profileLead, setProfileLead] = useState(null); 
  const [editData, setEditData] = useState({});   
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // === DEDICATED NOTES MODAL STATE ===
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isAppending, setIsAppending] = useState(false);
  const [noteUser, setNoteUser] = useState('Ritthik Kumar');
  
  // Edit Note State
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

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
    } catch (err) { console.error('Error fetching leads:', err.message); } 
    finally { setIsLoading(false); }
  };

  // ── SAFE ALERTS LOGIC ────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  let todayAlerts = [];
  let upcomingAlerts = [];

  leads.forEach(lead => {
    if (lead.tentative_call_date && !lead.call_attended) {
      const isUpcoming = String(lead.tentative_call_date) > todayStr;
      (isUpcoming ? upcomingAlerts : todayAlerts).push({ ...lead, alertType: 'Call', alertDate: lead.tentative_call_date });
    }
    if (lead.gmeet_date && !lead.gmeet_attended) {
      const gDate = String(lead.gmeet_date).split('T')[0];
      const isUpcoming = gDate > todayStr;
      (isUpcoming ? upcomingAlerts : todayAlerts).push({ ...lead, alertType: 'GMeet', alertDate: gDate });
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
    } catch (err) { console.error("Failed to update status:", err.message); }
  };

  const renderPagination = (currentPage, totalPages, setPage) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex gap-3 justify-center mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`w-10 h-10 rounded-lg font-mono text-base font-bold transition-all duration-300 ${
              currentPage === p ? 'bg-purple-900 text-white shadow-md ring-2 ring-[#EBA7FF]/50' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-[#EBA7FF]/20 hover:text-purple-900'
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
    setSaveSuccess(false);
  };

  const closeProfile = () => {
    setProfileLead(null);
    setEditData({});
    setShowNotesModal(false);
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev, [field]: value,
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
    } catch (err) { alert(`Save failed: ${err.message}`); } 
    finally { setIsSaving(false); }
  };

  // ── NOTES CRUD HANDLERS ───────────────────────────────────────────────────
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
      setLeads(prev => prev.map(l => l.id === profileLead.id ? { ...l, notes: updatedNotes } : l));
      setNewNote('');
    } catch (err) { alert(`Failed to append note: ${err.message}`); } 
    finally { setIsAppending(false); }
  };

  const handleEditNoteClick = (index, currentText) => {
    setEditingNoteIndex(index);
    setEditingNoteText(currentText);
  };

  const handleSaveEditedNote = async () => {
    if (!profileLead) return;
    try {
      const parsed = getParsedNotes(profileLead.notes);
      parsed[editingNoteIndex].text = editingNoteText.trim();
      
      // Stitch back together
      const newNotesStr = parsed.map(p => `[${p.timestamp}] [${p.user}] ${p.text}`).join('\n');
      
      await supabase.from('leads').update({ notes: newNotesStr }).eq('id', profileLead.id);
      setProfileLead(prev => ({ ...prev, notes: newNotesStr }));
      setLeads(prev => prev.map(l => l.id === profileLead.id ? { ...l, notes: newNotesStr } : l));
      setEditingNoteIndex(null);
    } catch (err) { alert(`Failed to edit note: ${err.message}`); }
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
        return timeB - timeA;
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

  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const SortBtn = ({ col }) => (
    <button onClick={e => { e.stopPropagation(); handleSort(col); }} className={`ml-2 text-sm transition-all hover:scale-125 ${sortConfig.key === col ? 'text-purple-700' : 'text-slate-400 hover:text-slate-600'}`}>
      {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
    </button>
  );

  const handleSelectAll = (e) => setSelectedLeads(e.target.checked ? processedLeads.map(l => l.id) : []);
  const handleSelectLead = (id) => setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleDeleteSelected = async () => {
    if (!window.confirm(`⚠️ Permanently delete ${selectedLeads.length} lead(s)?`)) return;
    try {
      await supabase.from('leads').delete().in('id', selectedLeads);
      if (profileLead && selectedLeads.includes(profileLead.id)) closeProfile();
      setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
      setSelectedLeads([]);
    } catch (err) { alert(`Delete failed: ${err.message}`); }
  };

  const handleDownloadExcel = () => {
    if (!processedLeads.length) return;
    const excelData = processedLeads.map(l => ({
      'Date': formatDisplayDate(l.date), 'Source': l.source || '', 'Client Name': l.name || '',
      'Company': l.company_name || '', 'Phone': l.phone || '', 'Location': l.location || '',
      'Requirement': l.requirement || '', 'Tentative Call': formatDisplayDate(l.tentative_call_date),
      'GMeet Date': formatDisplayDate(l.gmeet_date), 'Pipeline Stage': l.status || 'New',
      'Temperature': l.lead_temp || 'Cold', 'Value (₹)': Number(l.price) || 0,
      'Lost Reason': l.lost_reason || '', 'Internal Notes': l.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [{ wch: 15 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 15 }, { wch: 18 }, { wch: 38 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Leads');
    XLSX.writeFile(wb, `LeadManager_Export_${todayStr}.xlsx`);
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans text-slate-800">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[140px] pointer-events-none" />

      {/* ════════════════════════════════════════════════════════════════════
          PROFILE MODAL (CLEAN & CENTERED)
      ════════════════════════════════════════════════════════════════════ */}
      {profileLead && !showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>
            
            <div className="flex-shrink-0 flex justify-between items-start px-10 py-8 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-start gap-6 flex-1 min-w-0">
                <div className="min-w-0">
                  <p className="text-purple-900/60 font-bold text-sm uppercase tracking-widest mb-2">Lead Profile</p>
                  <h3 className="text-4xl font-black text-slate-900 truncate">{editData.name || '—'}</h3>
                  {editData.company_name && <p className="text-slate-600 text-xl mt-2 font-medium">{editData.company_name}</p>}
                </div>
                <div className="pt-8 flex-shrink-0"><StatusBadge status={editData.status} /></div>
              </div>
              <button onClick={closeProfile} className="flex-shrink-0 ml-4 mt-2 text-slate-400 hover:text-purple-900 transition-colors bg-white border border-slate-200 hover:bg-[#EBA7FF]/20 p-3 rounded-full shadow-sm">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-10 bg-white">
              <section>
                <p className="font-black text-xl text-slate-800 mb-5 border-b border-slate-200 pb-3">Contact Information</p>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: 'Name',     field: 'name',         type: 'text' },
                    { label: 'Company',  field: 'company_name', type: 'text' },
                    { label: 'Phone',    field: 'phone',        type: 'text' },
                    { label: 'Location', field: 'location',     type: 'text' },
                  ].map(({ label, field, type }) => (
                    <div key={field} className="flex flex-col gap-2.5">
                      <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">{label}</label>
                      <input type={type} value={editData[field] || ''} onChange={e => handleEditChange(field, e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm font-medium" />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="font-black text-xl text-slate-800 mb-5 border-b border-slate-200 pb-3">Requirement</p>
                <textarea value={editData.requirement || ''} rows={4} onChange={e => handleEditChange('requirement', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] resize-none transition-all shadow-sm font-medium leading-relaxed" />
              </section>

              <section>
                <p className="font-black text-xl text-slate-800 mb-5 border-b border-slate-200 pb-3">Pipeline Details</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2.5">
                    <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Pipeline Stage</label>
                    <select value={editData.status || 'New'} onChange={e => handleEditChange('status', e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] cursor-pointer shadow-sm transition-all">
                      {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Temperature</label>
                    <select value={editData.lead_temp || 'Cold'} onChange={e => handleEditChange('lead_temp', e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] cursor-pointer shadow-sm transition-all">
                      <option value="Cold">❄️ Cold</option>
                      <option value="Warm">🌡️ Warm</option>
                      <option value="Hot">🔥 Hot</option>
                    </select>
                  </div>
                  {editData.status === 'Closed - Lost' && (
                    <div className="col-span-2 flex flex-col gap-2.5">
                      <label className="font-bold text-sm text-rose-600 uppercase tracking-widest">Lost Reason</label>
                      <select value={editData.lost_reason || ''} onChange={e => handleEditChange('lost_reason', e.target.value)}
                        className="bg-rose-50 border border-rose-300 rounded-xl px-5 py-4 text-rose-800 font-bold text-lg focus:outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm transition-all">
                        <option value="">— Select reason —</option>
                        {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-2.5">
                    <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Value (₹)</label>
                    <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl overflow-hidden focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-300 transition-all shadow-sm">
                      <span className="px-5 text-emerald-700 font-mono font-black text-xl border-r border-slate-200 py-4">₹</span>
                      <input type="number" value={editData.price || ''} onChange={e => handleEditChange('price', e.target.value)} className="flex-1 bg-transparent py-4 px-4 text-slate-900 font-mono font-black text-xl focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Source</label>
                    <select value={editData.source || 'Website'} onChange={e => handleEditChange('source', e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] cursor-pointer shadow-sm transition-all">
                      {['Website','YouTube','LinkedIn','Direct','Referral','Alibaba','IndiaMart','TradeIndia','Manual Entry'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <p className="font-black text-xl text-slate-800 mb-5 border-b border-slate-200 pb-3">Schedule</p>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: 'Lead Date',      field: 'date' },
                    { label: 'Tentative Call', field: 'tentative_call_date' },
                    { label: 'GMeet Date',     field: 'gmeet_date' },
                  ].map(({ label, field }) => (
                    <div key={field} className="flex flex-col gap-2.5">
                      <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">{label}</label>
                      <input type="date" value={editData[field] || ''} onChange={e => handleEditChange(field, e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-mono font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all cursor-pointer shadow-sm" />
                    </div>
                  ))}
                </div>
              </section>
              
              {/* INTERACTION HISTORY BUTTON */}
              <button 
                onClick={() => setShowNotesModal(true)} 
                className="w-full mt-4 bg-purple-50 hover:bg-[#EBA7FF]/30 border-2 border-purple-200 hover:border-[#EBA7FF] text-purple-900 rounded-2xl px-8 py-6 flex justify-between items-center transition-all duration-300 shadow-sm"
              >
                <span className="font-black text-2xl flex items-center gap-3">💬 Interaction History</span>
                <span className="bg-white px-4 py-2 rounded-xl shadow-sm text-purple-700 font-black text-xl tabular-nums border border-purple-100">
                  {getParsedNotes(profileLead.notes).length} Notes
                </span>
              </button>

            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-10 py-6 border-t border-slate-200 bg-slate-100">
              <span className="font-mono text-sm font-bold text-slate-400 tracking-widest">ID: {String(profileLead.id).slice(0, 8)}…</span>
              <div className="flex items-center gap-5">
                {saveSuccess && (
                  <span className="text-emerald-700 font-bold text-lg flex items-center gap-2 animate-pulse bg-emerald-100 px-5 py-2.5 rounded-xl border border-emerald-300 shadow-sm">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Saved successfully
                  </span>
                )}
                <button onClick={closeProfile} className="px-8 py-4 font-bold text-lg text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition-colors">Discard</button>
                <button onClick={handleSaveChanges} disabled={isSaving} className="px-10 py-4 bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-lg rounded-xl transition-all duration-300 shadow-lg flex items-center gap-3 hover:shadow-[0_0_20px_rgba(235,167,255,0.6)]">
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          DEDICATED NOTES MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {showNotesModal && profileLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-7xl shadow-2xl flex flex-col h-[85vh] overflow-hidden">
            
            <div className="flex-shrink-0 flex justify-between items-center px-10 py-6 border-b border-slate-200 bg-slate-50">
              <div>
                <p className="text-purple-900/60 font-bold text-sm uppercase tracking-widest mb-1">Interaction History</p>
                <h3 className="text-3xl font-black text-slate-900">{profileLead.name}</h3>
              </div>
              <button onClick={() => setShowNotesModal(false)} className="text-slate-400 hover:text-purple-900 bg-white border border-slate-200 hover:bg-[#EBA7FF]/20 p-3 rounded-full shadow-sm transition-colors">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* LEFT: Append New Note */}
              <div className="w-1/3 flex-shrink-0 border-r border-slate-200 p-10 flex flex-col bg-white">
                <p className="font-black text-2xl text-slate-900 mb-6">Append Update</p>
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Type new update or interaction..."
                  className="w-full flex-1 bg-slate-50 border border-slate-300 rounded-2xl p-6 text-slate-900 font-medium text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] resize-none transition-all shadow-inner leading-relaxed mb-6" />
                <div className="flex flex-col gap-4">
                  <select value={noteUser} onChange={e => setNoteUser(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-800 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] cursor-pointer shadow-sm transition-all">
                    {users.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={handleAppendNote} disabled={isAppending || !newNote.trim()}
                    className="w-full bg-purple-900 hover:bg-[#EBA7FF] disabled:bg-slate-300 disabled:text-slate-500 hover:text-purple-950 text-white font-black text-xl px-6 py-5 rounded-xl transition-all duration-300 shadow-md">
                    {isAppending ? 'Appending…' : 'Add to History'}
                  </button>
                </div>
              </div>

              {/* RIGHT: Timeline Feed with Edit capabilities */}
              <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-8 bg-gradient-to-b from-slate-50 to-[#EBA7FF]/5">
                {getParsedNotes(profileLead.notes).length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-60">
                    <span className="text-7xl text-slate-300">💬</span>
                    <span className="text-slate-500 font-bold text-xl">No interaction history yet.</span>
                  </div>
                ) : (
                  [...getParsedNotes(profileLead.notes)].reverse().map((note, i) => {
                    const isFirst = i === 0;
                    const isEditing = editingNoteIndex === note.index;
                    
                    // Format display date for the notes feed correctly
                    let displayDate = note.timestamp;
                    if (note.timestamp !== 'Legacy/Unknown') {
                      const [dDate, dTime] = note.timestamp.split(' ');
                      displayDate = `${formatDisplayDate(dDate)} at ${dTime}`;
                    }

                    return (
                      <div key={note.index} className="flex flex-col gap-2 relative">
                        <div className={`absolute -left-4 top-8 w-2 h-2 rounded-full ${isFirst ? 'bg-purple-600' : 'bg-slate-300'}`}></div>
                        
                        <div className={`rounded-3xl p-8 flex flex-col gap-5 border transition-all ml-6 ${isFirst ? 'bg-white border-[#EBA7FF] shadow-[0_10px_30px_rgba(235,167,255,0.25)] ring-2 ring-[#EBA7FF]/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                          
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <span className={`font-black text-2xl truncate ${isFirst ? 'text-purple-900' : 'text-slate-800'}`}>
                              {note.user}
                            </span>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-500 font-mono text-xs font-bold uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded border border-slate-200 shadow-sm">
                                {displayDate}
                              </span>
                              {!isEditing && (
                                <button onClick={() => handleEditNoteClick(note.index, note.text)} className="text-slate-400 hover:text-purple-600 transition-colors p-1" title="Edit Note">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="flex flex-col gap-4 animate-fade-in">
                              <textarea value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)}
                                className="w-full bg-slate-50 border border-purple-300 rounded-xl p-5 text-slate-900 font-medium text-lg focus:ring-2 focus:ring-[#EBA7FF] resize-none shadow-inner leading-relaxed" rows={5} />
                              <div className="flex justify-end gap-3">
                                <button onClick={() => setEditingNoteIndex(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                                <button onClick={handleSaveEditedNote} className="px-6 py-3 bg-emerald-500 text-white font-black uppercase tracking-widest text-sm rounded-xl shadow-md hover:bg-emerald-600 transition-colors">Save Edits</button>
                              </div>
                            </div>
                          ) : (
                            <p className={`text-[17px] whitespace-pre-wrap leading-relaxed font-medium ${isFirst ? 'text-slate-900' : 'text-slate-700'}`}>
                              {note.text}
                            </p>
                          )}
                          
                          {isFirst && !isEditing && <span className="font-mono text-xs text-[#EBA7FF] uppercase tracking-widest mt-2 font-black">↑ Latest Update</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REMINDERS & CALENDAR MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {showReminders && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 p-10 rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-8">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-6">
              <h3 className="text-4xl font-black text-purple-900 flex items-center gap-4">
                📅 Schedule & Reminders
              </h3>
              <button onClick={() => setShowReminders(false)} className="text-slate-400 hover:text-purple-900 bg-slate-100 hover:bg-[#EBA7FF]/20 p-4 rounded-full transition-colors border border-slate-200 shadow-sm">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-slate-200 pb-10">
              <div className="flex flex-col gap-5 bg-rose-50 border border-rose-200 p-8 rounded-2xl shadow-sm">
                <h4 className="font-black text-xl text-rose-700 border-b border-rose-200 pb-4 flex items-center gap-3">
                  <span>⚠️ Today & Overdue</span>
                  <span className="bg-rose-200 text-rose-900 px-4 py-1.5 rounded-full text-sm font-mono">{todayAlerts.length}</span>
                </h4>
                {currentTodayAlerts.length > 0 ? (
                  <div className="flex flex-col gap-5 min-h-[420px]">
                    {currentTodayAlerts.map((alert, index) => (
                      <div key={index} className="bg-white border border-rose-300 p-6 rounded-2xl flex flex-col justify-between gap-4 shadow-md">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest shadow-sm ${alert.alertType === 'Call' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                              {alert.alertType}
                            </span>
                            <span className="text-rose-800 font-mono font-bold text-sm bg-rose-100 border border-rose-300 px-4 py-1.5 rounded-lg">
                              {formatDisplayDate(alert.alertDate)}
                            </span>
                          </div>
                          <p className="text-slate-900 font-black text-xl truncate">{alert.name}</p>
                        </div>
                        <div className="flex gap-4 w-full mt-3">
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-sm">Dismiss</button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-md">✓ Attended</button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-auto">{renderPagination(todayPage, todayTotalPages, setTodayPage)}</div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <span className="text-emerald-700 font-black text-xl bg-emerald-100 px-8 py-4 rounded-2xl border border-emerald-300 shadow-sm">✅ Clear for today</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-8 rounded-2xl shadow-sm">
                <h4 className="font-black text-xl text-slate-800 border-b border-slate-200 pb-4 flex items-center gap-3">
                  <span>📅 Tomorrow & Upcoming</span>
                  <span className="bg-slate-200 text-slate-800 px-4 py-1.5 rounded-full text-sm font-mono">{upcomingAlerts.length}</span>
                </h4>
                {currentUpcomingAlerts.length > 0 ? (
                  <div className="flex flex-col gap-5 min-h-[420px]">
                    {currentUpcomingAlerts.map((alert, index) => (
                      <div key={index} className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between gap-4 shadow-md">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest shadow-sm ${alert.alertType === 'Call' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                              {alert.alertType}
                            </span>
                            <span className="text-slate-700 font-mono font-bold text-sm bg-slate-100 border border-slate-300 px-4 py-1.5 rounded-lg">
                              {formatDisplayDate(alert.alertDate)}
                            </span>
                          </div>
                          <p className="text-slate-900 font-black text-xl truncate">{alert.name}</p>
                        </div>
                        <div className="flex gap-4 w-full mt-3">
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-slate-100 hover:bg-[#EBA7FF]/20 border border-slate-300 text-slate-700 hover:text-purple-900 font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-sm">Dismiss</button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-md">✓ Attended</button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-auto">{renderPagination(upcomingPage, upcomingTotalPages, setUpcomingPage)}</div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <span className="text-slate-500 font-black text-xl bg-white px-8 py-4 rounded-2xl border border-slate-200 shadow-sm">No upcoming alerts</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="font-black text-xl text-slate-800 uppercase tracking-widest">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h4>
                <div className="flex gap-3">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm">{'<'}</button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-6 font-mono text-base font-black bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm">TODAY</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm">{'>'}</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center font-black text-base uppercase text-slate-500 py-3">{d}</div>)}
                {blanks.map(b => <div key={`blank-${b}`} className="p-3"></div>)}
                {calendarDays.map(day => {
                  const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateString === todayStr;
                  const dayCalls = leads.filter(l => l.tentative_call_date === dateString && !l.call_attended);
                  const dayMeets = leads.filter(l => { const gDate = l.gmeet_date ? String(l.gmeet_date).split('T')[0] : null; return gDate === dateString && !l.gmeet_attended; });

                  return (
                    <div key={day} className={`min-h-[120px] p-4 border rounded-2xl flex flex-col items-start gap-2.5 transition-colors ${isToday ? 'border-purple-400 bg-purple-50 shadow-md ring-4 ring-purple-100' : 'border-slate-200 bg-white hover:bg-slate-50 shadow-sm'}`}>
                      <span className={`font-mono text-lg ${isToday ? 'text-purple-900 font-black' : 'text-slate-600 font-bold'}`}>{day}</span>
                      <div className="flex flex-col gap-2 w-full overflow-hidden">
                        {dayCalls.length > 0 && <div className="text-sm bg-blue-100 text-blue-900 border border-blue-300 px-3 py-1.5 rounded-lg truncate font-bold shadow-sm" title={`Calls: ${dayCalls.map(l=>l.name).join(', ')}`}>📞 {dayCalls.length} Call(s)</div>}
                        {dayMeets.length > 0 && <div className="text-sm bg-purple-100 text-purple-900 border border-purple-300 px-3 py-1.5 rounded-lg truncate font-bold shadow-sm" title={`GMeets: ${dayMeets.map(l=>l.name).join(', ')}`}>📹 {dayMeets.length} Meet(s)</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-8 mt-10 justify-center">
                <span className="flex items-center gap-3 font-bold text-sm text-slate-600"><span className="w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-400 shadow-sm"></span> Call Scheduled</span>
                <span className="flex items-center gap-3 font-bold text-sm text-slate-600"><span className="w-5 h-5 rounded-full bg-purple-100 border-2 border-purple-400 shadow-sm"></span> GMeet Scheduled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MAIN PAGE CONTENT
      ════════════════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-[95%] xl:max-w-[95%] flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/database')} className="text-slate-600 hover:text-purple-900 font-black text-base uppercase tracking-widest transition-colors flex items-center gap-3 bg-white px-6 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back to Analytics
        </button>
        <div className="flex gap-5 items-center">
          <button onClick={() => setShowReminders(true)} className="relative text-slate-700 hover:text-purple-900 font-black text-base uppercase tracking-widest transition-all flex items-center gap-3 bg-white px-7 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md hover:border-[#EBA7FF] hover:bg-[#EBA7FF]/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> Reminders
            {urgentAlerts.length > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-600 border-2 border-white"></span>
              </span>
            )}
          </button>
          <span className="font-black text-base text-purple-900 tracking-widest uppercase flex items-center gap-3 bg-[#EBA7FF]/30 px-7 py-4 rounded-xl border border-[#EBA7FF]/60 shadow-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> Lead Manager
          </span>
        </div>
      </div>

      <div className="bg-white w-full max-w-[95%] xl:max-w-[95%] p-4 relative z-10 flex flex-col shadow-2xl shadow-slate-200/60 rounded-3xl border border-slate-300">
        <div className="px-10 pt-10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-5">
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">Lead Manager</h1>
              <span className="bg-[#EBA7FF]/20 text-purple-900 border border-[#EBA7FF]/50 px-4 py-2 rounded-lg font-mono text-xs font-bold tracking-widest uppercase shadow-sm mt-2">Click row to view profile</span>
            </div>
            <p className="text-slate-600 font-medium text-lg mt-3">Sort, filter, and search leads. Table is view-only.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleDownloadExcel} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 hover:text-purple-900 font-black text-sm tracking-widest uppercase px-8 py-4 rounded-xl transition-colors flex items-center gap-3 shadow-sm">
              <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Export{processedLeads.length !== leads.length ? ` (${processedLeads.length})` : ''}
            </button>
            <button onClick={fetchLeads} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm uppercase tracking-widest px-8 py-4 rounded-xl transition-colors border border-slate-300 shadow-sm">Refresh</button>
          </div>
        </div>

        <div className="px-10 pb-6 flex flex-col gap-4">
          <div className="flex gap-5 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={filters.globalSearch} onChange={e => setFilters(p => ({ ...p, globalSearch: e.target.value }))} placeholder="Search name, company, requirement, phone, location..." className="w-full bg-white border border-slate-300 rounded-2xl pl-14 pr-12 py-5 text-slate-900 font-medium text-lg focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-shadow placeholder:text-slate-400 shadow-sm" />
              {filters.globalSearch && <button onClick={() => setFilters(p => ({ ...p, globalSearch: '' }))} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 text-3xl font-black leading-none">×</button>}
            </div>
            <button onClick={() => setShowFilters(v => !v)} className={`flex items-center gap-3 px-8 py-5 rounded-2xl font-black text-base tracking-widest uppercase border transition-colors shadow-sm whitespace-nowrap ${showFilters || activeFilterCount > 0 ? 'bg-purple-100 border-[#EBA7FF] text-purple-900 ring-2 ring-[#EBA7FF]/50' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg> Filters {activeFilterCount > 0 && <span className="bg-purple-900 text-white text-sm font-black rounded-lg px-2.5 py-0.5 ml-2">{activeFilterCount}</span>}
            </button>
            {(activeFilterCount > 0 || sortConfig.key) && <button onClick={clearAllFilters} className="px-8 py-5 rounded-2xl font-black text-sm tracking-widest uppercase border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors whitespace-nowrap shadow-sm">Clear All</button>}
          </div>
          
          {showFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col gap-8 mt-2 shadow-inner">
              <div className="flex flex-col gap-4">
                <span className="font-black text-sm text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2.5">Pipeline Stage</span>
                <div className="flex flex-wrap gap-3">
                  {pipelineStages.map(stage => {
                    const on = stage === 'Closed - Won' ? 'bg-emerald-600 border-emerald-700 text-white shadow-md' : stage === 'Closed - Lost' ? 'bg-rose-600 border-rose-700 text-white shadow-md' : stage === 'Negotiation' ? 'bg-purple-600 border-purple-700 text-white shadow-md' : stage === 'New' ? 'bg-slate-900 border-slate-950 text-white shadow-md' : 'bg-blue-600 border-blue-700 text-white shadow-md';
                    return <button key={stage} onClick={() => toggleFilter('status', stage)} className={`px-5 py-2.5 rounded-xl font-bold text-base border transition-all shadow-sm ${filters.status.includes(stage) ? on : 'bg-white border-slate-300 text-slate-700 hover:border-[#EBA7FF]/50 hover:bg-[#EBA7FF]/10'}`}>{filters.status.includes(stage) && '✓ '}{stage}</button>;
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <span className="font-black text-sm text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2.5">Temperature</span>
                <div className="flex gap-4">
                  {[{ val:'Hot', label:'🔥 Hot', on:'bg-rose-600 border-rose-700 text-white shadow-md' }, { val:'Warm', label:'🌡️ Warm', on:'bg-amber-500 border-amber-600 text-white shadow-md' }, { val:'Cold', label:'❄️ Cold', on:'bg-cyan-600 border-cyan-700 text-white shadow-md' }].map(({ val, label, on }) => (
                    <button key={val} onClick={() => toggleFilter('lead_temp', val)} className={`px-6 py-3 rounded-xl font-bold text-base border transition-all shadow-sm ${filters.lead_temp.includes(val) ? on : 'bg-white border-slate-300 text-slate-700 hover:border-[#EBA7FF]/50 hover:bg-[#EBA7FF]/10'}`}>{filters.lead_temp.includes(val) && '✓ '}{label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {activeChips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-3 bg-[#EBA7FF]/20 border border-[#EBA7FF]/50 text-purple-900 px-5 py-2.5 rounded-xl font-bold text-base shadow-sm">
                  {chip.label} <button onClick={chip.remove} className="hover:text-purple-950 transition-colors text-xl leading-none bg-purple-900/10 hover:bg-purple-900/20 px-2.5 rounded-md">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto relative rounded-2xl border border-slate-300 bg-white shadow-md mx-8 mb-8">
          {selectedLeads.length > 0 && (
            <div className="absolute top-0 left-0 w-full bg-slate-900 border-b border-slate-950 p-5 flex justify-between items-center z-20 rounded-t-2xl shadow-lg">
              <span className="text-white font-bold text-base tracking-widest uppercase ml-5">{selectedLeads.length} Lead(s) Selected</span>
              <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white font-black text-sm tracking-widest uppercase px-6 py-3 rounded-xl transition-colors shadow-sm">🗑️ Delete Selected</button>
            </div>
          )}
          {isLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-6 text-slate-500 font-bold tracking-widest text-xl uppercase">
              <svg className="w-16 h-16 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Loading Database...
            </div>
          ) : processedLeads.length === 0 ? (
            <div className="py-40 flex flex-col items-center justify-center gap-5">
              <span className="text-7xl opacity-20 text-slate-500">🔍</span>
              <span className="text-slate-600 font-bold text-xl">No leads match your current filters.</span>
              <button onClick={clearAllFilters} className="text-purple-700 hover:text-[#EBA7FF] font-black text-base uppercase tracking-widest underline underline-offset-8 transition-colors mt-2">Clear filters</button>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse min-w-[1800px]">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-wider">
                    <th className="py-6 px-6 w-16"><input type="checkbox" onChange={handleSelectAll} checked={selectedLeads.length === processedLeads.length && processedLeads.length > 0} className="w-6 h-6 accent-purple-700 cursor-pointer rounded border-slate-400" /></th>
                    <th className="py-6 px-5 w-72"><span className="flex items-center">Client Info <SortBtn col="name" /></span></th>
                    <th className="py-6 px-5 w-80">Requirement</th>
                    <th className="py-6 px-5 w-80">Latest Note</th>
                    <th className="py-6 px-5 text-center w-48"><span className="flex items-center justify-center">Stage <SortBtn col="status" /></span></th>
                    <th className="py-6 px-5 text-center w-36"><span className="flex items-center justify-center">Temp <SortBtn col="lead_temp" /></span></th>
                    <th className="py-6 px-5 text-right w-44"><span className="flex items-center justify-end">Value (₹) <SortBtn col="price" /></span></th>
                    <th className="py-6 px-5 text-center w-48">Call / Meet</th>
                    <th className="py-6 px-5 w-40"><span className="flex items-center">Date <SortBtn col="date" /></span></th>
                    <th className="py-6 px-5 w-40">Source</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {processedLeads.map((lead, idx) => {
                    const latestNote  = getLatestNotePreview(lead.notes);
                    const noteCount   = getParsedNotes(lead.notes).length;
                    return (
                      <tr key={lead.id} onClick={() => openProfile(lead)} className={`transition-colors duration-150 cursor-pointer group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-[#EBA7FF]/10`}>
                        <td className="py-6 px-6" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => handleSelectLead(lead.id)} className="w-6 h-6 accent-purple-700 cursor-pointer rounded border-slate-400" /></td>
                        <td className="py-6 px-5">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-900 to-[#EBA7FF] border-2 border-purple-700 flex items-center justify-center text-white font-black text-base shadow-sm">{getInitials(lead.name)}</div>
                            <div className="flex flex-col">
                              <span className="text-slate-900 font-black text-xl">{lead.name || '—'}</span>
                              <span className="text-slate-600 text-base font-bold mt-1">{lead.company_name || ''}</span>
                              <span className="text-blue-700 text-sm tabular-nums font-bold mt-0.5">{lead.phone || ''}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-5"><span className="text-slate-800 font-medium text-base line-clamp-3 leading-relaxed">{lead.requirement || <span className="text-slate-400 italic font-normal">No requirement provided</span>}</span></td>
                        <td className="py-6 px-5">
                          {latestNote ? (
                            <div className="flex flex-col gap-2 bg-slate-100/50 group-hover:bg-white p-4 rounded-xl border border-slate-200 transition-colors shadow-sm">
                              <p className="text-slate-700 text-base leading-relaxed line-clamp-2 italic font-medium truncate">"{latestNote}"</p>
                              {noteCount > 1 && <span className="text-purple-800 font-bold text-xs uppercase tracking-widest">+{noteCount - 1} earlier entr{noteCount - 1 === 1 ? 'y' : 'ies'}</span>}
                            </div>
                          ) : <span className="text-slate-400 font-medium text-sm italic">No notes recorded</span>}
                        </td>
                        <td className="py-6 px-5 text-center">
                          <div className="flex flex-col items-center gap-2.5">
                            <StatusBadge status={lead.status} />
                            {lead.status === 'Closed - Lost' && lead.lost_reason && <span className="text-xs text-rose-800 font-bold font-mono truncate max-w-[160px] px-3 py-1.5 bg-rose-100 rounded-lg border border-rose-300 shadow-sm" title={lead.lost_reason}>↳ {lead.lost_reason}</span>}
                          </div>
                        </td>
                        <td className="py-6 px-5 text-center"><TempBadge temp={lead.lead_temp} /></td>
                        <td className="py-6 px-5 text-right"><span className="text-emerald-600 font-mono text-xl font-black tabular-nums">{lead.price ? `₹${Number(lead.price).toLocaleString('en-IN')}` : <span className="text-slate-300 font-sans text-lg">—</span>}</span></td>
                        <td className="py-6 px-5 text-center">
                          <div className="flex flex-col gap-2 items-start bg-slate-100 group-hover:bg-white p-3.5 rounded-xl border border-slate-200 w-fit mx-auto min-w-[150px] transition-colors shadow-sm">
                            {lead.tentative_call_date && <span className="tabular-nums text-sm text-blue-800 font-bold flex items-center gap-2">📞 {formatDisplayDate(lead.tentative_call_date)}</span>}
                            {lead.gmeet_date && <span className="tabular-nums text-sm text-purple-800 font-bold flex items-center gap-2">📹 {formatDisplayDate(lead.gmeet_date)}</span>}
                            {!lead.tentative_call_date && !lead.gmeet_date && <span className="text-slate-400 font-medium text-sm mx-auto py-1 italic">Unscheduled</span>}
                          </div>
                        </td>
                        <td className="py-6 px-5"><span className="text-slate-700 tabular-nums font-bold text-base whitespace-nowrap">{formatDisplayDate(lead.date)}</span></td>
                        <td className="py-6 px-5"><span className="bg-slate-200 text-slate-800 border border-slate-300 px-3.5 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest shadow-sm">{lead.source || '—'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-between items-center px-8 py-6 bg-slate-100 border-t-2 border-slate-300 rounded-b-2xl">
                <span className="font-bold text-sm text-slate-600">Showing <strong className="text-slate-900 font-black">{processedLeads.length}</strong> of <strong className="text-slate-900 font-black">{leads.length}</strong> leads {processedLeads.length !== leads.length && <span className="text-purple-700 font-black"> (filtered)</span>}</span>
                <span className="font-black text-sm text-slate-700 uppercase tracking-widest">Total Value: <strong className="text-emerald-700 text-xl ml-2.5 tracking-normal tabular-nums">₹{filteredValue.toLocaleString('en-IN')}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
