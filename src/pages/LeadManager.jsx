import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

// ── NOTE UTILITIES ─────────────────────────────────────────────────────────────
const parseNoteLines = (notesStr) => notesStr?.trim() ? notesStr.split('\n').filter(l => l.trim()) : [];

const parseNoteEntry = (line) => {
  const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] \[(.*?)\] ([\s\S]+)$/);
  return m ? { timestamp: m[1], user: m[2], text: m[3].trim() } : { timestamp: null, user: null, text: line };
};

const getLatestNotePreview = (notesStr) => {
  const lines = parseNoteLines(notesStr);
  if (!lines.length) return null;
  const { text } = parseNoteEntry(lines[lines.length - 1]);
  return text.length > 72 ? text.slice(0, 72) + '…' : text;
};

// Extremely important for default sorting
const getLatestNoteTimestamp = (notesStr) => {
  const lines = parseNoteLines(notesStr);
  if (!lines.length) return 0;
  const { timestamp } = parseNoteEntry(lines[lines.length - 1]);
  return timestamp ? new Date(timestamp).getTime() : 0;
};

// ── BADGE COMPONENTS ───────────────────────────────────────────────────────────
const STATUS_STYLE = {
  'New':           'bg-slate-500/20 border-slate-400/40 text-slate-300',
  'Contacted':     'bg-blue-500/20 border-blue-400/40 text-blue-300',
  'Quoted / Demo': 'bg-amber-500/20 border-amber-400/40 text-amber-300',
  'Negotiation':   'bg-purple-500/20 border-purple-400/40 text-purple-300',
  'Closed - Won':  'bg-green-500/20 border-green-400/40 text-green-300',
  'Closed - Lost': 'bg-red-500/20 border-red-400/40 text-red-300',
};

const StatusBadge = ({ status }) => (
  <span className={`px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-widest border whitespace-nowrap ${STATUS_STYLE[status] || STATUS_STYLE['New']}`}>
    {status || 'New'}
  </span>
);

const TempBadge = ({ temp }) => {
  const cfg = { Hot: '🔥 Hot', Warm: '🌡️ Warm', Cold: '❄️ Cold' };
  const cls = temp === 'Hot' ? 'text-red-400 border-red-500/40 bg-red-500/10'
            : temp === 'Warm' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
            : 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10';
  return (
    <span className={`px-2 py-0.5 rounded font-mono text-[10px] border ${cls}`}>
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

  // Notes state
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
      const unique = data.filter((l, i, a) =>
        i === a.findIndex(t => t.name?.toLowerCase() === l.name?.toLowerCase() && t.requirement?.toLowerCase() === l.requirement?.toLowerCase())
      );
      setLeads(unique);
    } catch (err) {
      console.error('Error fetching leads:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── ALERTS & REMINDERS LOGIC ────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const urgentAlerts = [];
  leads.forEach(lead => {
    if (lead.tentative_call_date && !lead.call_attended && (lead.tentative_call_date === todayStr || lead.tentative_call_date === tomorrowStr)) {
      urgentAlerts.push({ ...lead, alertType: 'Call', alertDate: lead.tentative_call_date });
    }
    if (lead.gmeet_date && !lead.gmeet_attended && (lead.gmeet_date === todayStr || lead.gmeet_date === tomorrowStr)) {
      urgentAlerts.push({ ...lead, alertType: 'GMeet', alertDate: lead.gmeet_date });
    }
  });

  const handleMarkAttended = async (leadId, alertType) => {
    const columnToUpdate = alertType === 'Call' ? 'call_attended' : 'gmeet_attended';
    try {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [columnToUpdate]: true } : l));
      await supabase.from('leads').update({ [columnToUpdate]: true }).eq('id', leadId);
    } catch (err) {
      console.error("Failed to update status:", err.message);
    }
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

  // ── FILTER / SORT HELPERS ──────────────────────────────────────────────────
  const uniqueSources = useMemo(() => [...new Set(leads.map(l => l.source).filter(Boolean))].sort(), [leads]);

  const processedLeads = useMemo(() => {
    let r = [...leads];

    if (filters.globalSearch.trim()) {
      const s = filters.globalSearch.toLowerCase();
      r = r.filter(l => [l.name, l.company_name, l.requirement, l.phone, l.location, l.source].some(v => v?.toLowerCase().includes(s)));
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
        const av = String(a[sortConfig.key] ?? '').toLowerCase();
        const bv = String(b[sortConfig.key] ?? '').toLowerCase();
        return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
      });
    } else {
      // 🚀 DEFAULT SORT: Bubbles leads with the newest notes to the top!
      r.sort((a, b) => {
        const timeA = getLatestNoteTimestamp(a.notes);
        const timeB = getLatestNoteTimestamp(b.notes);
        if (timeA !== timeB) return timeB - timeA;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
      className={`ml-1 text-[11px] transition-all ${sortConfig.key === col ? 'text-primary' : 'text-white/25 hover:text-white/60'}`}>
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
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none" />

      {/* ════════════════════════════════════════════════════════════════════
          PROFILE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {profileLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#080d1a] border border-white/15 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col overflow-hidden"
               style={{ maxHeight: '92vh' }}>
            {/* ── Modal Header ── */}
            <div className="flex-shrink-0 flex justify-between items-start px-7 py-5 border-b border-white/10">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="min-w-0">
                  <p className="text-secondary font-mono text-[9px] uppercase tracking-[0.2em] mb-1">Lead Profile</p>
                  <h3 className="text-2xl font-bold text-white truncate">{editData.name || '—'}</h3>
                  {editData.company_name && (
                    <p className="text-secondary text-sm mt-0.5">{editData.company_name}</p>
                  )}
                </div>
                <div className="pt-5 flex-shrink-0">
                  <StatusBadge status={editData.status} />
                </div>
              </div>
              <button onClick={closeProfile} className="flex-shrink-0 ml-4 mt-1 text-secondary hover:text-red-400 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Modal Body ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              
              {/* LEFT: Edit Form */}
              <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-6 min-w-0">
                <section>
                  <p className="font-mono text-[9px] text-secondary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <span className="w-3 h-px bg-white/20"></span> Contact Information
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Name',     field: 'name',         type: 'text' },
                      { label: 'Company',  field: 'company_name', type: 'text' },
                      { label: 'Phone',    field: 'phone',        type: 'text' },
                      { label: 'Location', field: 'location',     type: 'text' },
                    ].map(({ label, field, type }) => (
                      <div key={field} className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] text-secondary uppercase tracking-wider">{label}</label>
                        <input type={type} value={editData[field] || ''}
                          onChange={e => handleEditChange(field, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="font-mono text-[9px] text-secondary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <span className="w-3 h-px bg-white/20"></span> Requirement
                  </p>
                  <textarea value={editData.requirement || ''} rows={3}
                    onChange={e => handleEditChange('requirement', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary resize-none transition-colors" />
                </section>

                <section>
                  <p className="font-mono text-[9px] text-secondary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <span className="w-3 h-px bg-white/20"></span> Pipeline Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-secondary uppercase tracking-wider">Pipeline Stage</label>
                      <select value={editData.status || 'New'} onChange={e => handleEditChange('status', e.target.value)}
                        className="bg-navy border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary cursor-pointer">
                        {pipelineStages.map(s => <option key={s} className="bg-slate-900" value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-secondary uppercase tracking-wider">Temperature</label>
                      <select value={editData.lead_temp || 'Cold'} onChange={e => handleEditChange('lead_temp', e.target.value)}
                        className="bg-navy border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary cursor-pointer">
                        <option className="bg-slate-900" value="Cold">❄️ Cold</option>
                        <option className="bg-slate-900" value="Warm">🌡️ Warm</option>
                        <option className="bg-slate-900" value="Hot">🔥 Hot</option>
                      </select>
                    </div>
                    {editData.status === 'Closed - Lost' && (
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="font-mono text-[9px] text-red-400 uppercase tracking-wider">Lost Reason</label>
                        <select value={editData.lost_reason || ''} onChange={e => handleEditChange('lost_reason', e.target.value)}
                          className="bg-navy border border-red-500/40 rounded-lg px-3 py-2 text-red-300 font-mono text-sm focus:outline-none focus:border-red-400 cursor-pointer">
                          <option className="bg-slate-900 text-white" value="">— Select reason —</option>
                          {lostReasons.map(r => <option key={r} className="bg-slate-900 text-white" value={r}>{r}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-secondary uppercase tracking-wider">Value (₹)</label>
                      <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-green-500 transition-colors">
                        <span className="px-3 text-green-500 font-mono text-sm">₹</span>
                        <input type="number" value={editData.price || ''} onChange={e => handleEditChange('price', e.target.value)}
                          className="flex-1 bg-transparent py-2 pr-3 text-green-400 font-mono text-sm focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-secondary uppercase tracking-wider">Source</label>
                      <select value={editData.source || 'Website'} onChange={e => handleEditChange('source', e.target.value)}
                        className="bg-navy border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary cursor-pointer">
                        {['Website','YouTube','LinkedIn','Direct','Referral','Alibaba','IndiaMart','TradeIndia','Manual Entry'].map(s => (
                          <option key={s} className="bg-slate-900 text-white" value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="font-mono text-[9px] text-secondary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <span className="w-3 h-px bg-white/20"></span> Schedule
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Lead Date',      field: 'date' },
                      { label: 'Tentative Call', field: 'tentative_call_date' },
                      { label: 'GMeet Date',     field: 'gmeet_date' },
                    ].map(({ label, field }) => (
                      <div key={field} className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] text-secondary uppercase tracking-wider">{label}</label>
                        <input type="date" value={editData[field] || ''} onChange={e => handleEditChange(field, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* RIGHT: Notes Feed */}
              <div className="w-[400px] flex-shrink-0 flex flex-col border-l border-white/10 overflow-hidden bg-white/[0.02]">
                <div className="flex-shrink-0 p-5 border-b border-white/10">
                  <p className="font-mono text-[9px] text-secondary uppercase tracking-[0.2em] mb-3">Add Note</p>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Type update or interaction..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-primary resize-none transition-colors"
                    style={{ height: '80px' }} />
                  <div className="flex gap-2 mt-2">
                    <select value={noteUser} onChange={e => setNoteUser(e.target.value)}
                      className="flex-1 min-w-0 bg-navy border border-white/10 rounded-lg px-2.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary truncate">
                      {users.map(u => <option key={u} value={u} className="bg-slate-900 text-white">{u}</option>)}
                    </select>
                    <button onClick={handleAppendNote} disabled={isAppending || !newNote.trim()}
                      className="flex-shrink-0 bg-primary hover:bg-blue-600 disabled:bg-white/5 disabled:text-white/20 text-white font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-colors">
                      {isAppending ? '…' : '+ Add'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                  <p className="font-mono text-[9px] text-secondary uppercase tracking-[0.2em] flex items-center justify-between">
                    <span>Activity Log</span>
                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-[8px]">
                      {parseNoteLines(profileLead.notes).length} entries
                    </span>
                  </p>
                  {parseNoteLines(profileLead.notes).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <span className="text-2xl opacity-30">📋</span>
                      <span className="text-secondary font-mono text-xs">No notes recorded yet.</span>
                    </div>
                  ) : (
                    [...parseNoteLines(profileLead.notes)].reverse().map((line, i) => {
                      const { timestamp, user, text } = parseNoteEntry(line);
                      const isFirst = i === 0;
                      return (
                        <div key={i}
                          className={`rounded-xl p-3 flex flex-col gap-1.5 border transition-all ${
                            isFirst ? 'bg-primary/10 border-primary/25 shadow-[0_0_12px_rgba(99,102,241,0.08)]' : 'bg-white/[0.04] border-white/[0.07]'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-mono text-[10px] font-semibold truncate ${isFirst ? 'text-primary' : 'text-blue-400/80'}`}>
                              {user || 'Unknown'}
                            </span>
                            <span className="text-secondary font-mono text-[9px] flex-shrink-0 opacity-70">
                              {timestamp || '—'}
                            </span>
                          </div>
                          <p className={`text-xs leading-relaxed ${isFirst ? 'text-white' : 'text-white/80'}`}>{text}</p>
                          {isFirst && <span className="font-mono text-[8px] text-primary/70 uppercase tracking-wider">↑ Most Recent</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── Modal Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-7 py-4 border-t border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[9px] text-white/20 tracking-wider">
                ID: {String(profileLead.id).slice(0, 8)}…
              </span>
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-green-400 font-mono text-xs flex items-center gap-1.5 animate-pulse">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved successfully
                  </span>
                )}
                <button onClick={closeProfile} className="px-5 py-2 font-mono text-xs uppercase tracking-wider border border-white/15 text-secondary hover:text-white rounded-lg transition-colors">
                  Discard & Close
                </button>
                <button onClick={handleSaveChanges} disabled={isSaving}
                  className="px-6 py-2 bg-primary hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white font-mono text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2">
                  {isSaving ? 'Saving…' : '💾 Save Changes'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#080d1a] border border-white/20 p-6 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6">
            
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                📅 Schedule & Reminders
              </h3>
              <button onClick={() => setShowReminders(false)} className="text-secondary hover:text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {urgentAlerts.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h4 className="font-mono text-xs text-red-400 uppercase tracking-widest">⚠️ Urgent Action Required</h4>
                {urgentAlerts.map((alert, index) => (
                  <div key={index} className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest ${alert.alertType === 'Call' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                          {alert.alertType}
                        </span>
                        <span className="text-white font-mono text-sm">
                          {alert.alertDate === todayStr ? 'TODAY' : 'TOMORROW'}
                        </span>
                      </div>
                      <p className="text-white font-medium text-lg">{alert.name}</p>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                      <button onClick={() => setShowReminders(false)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-mono text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors">
                        Will Attend Soon
                      </button>
                      <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-green-600/80 hover:bg-green-500 text-white font-mono text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                        ✓ Already Attended
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-900/10 border border-green-500/20 p-4 rounded-lg flex items-center justify-center">
                <span className="text-green-400 font-mono text-sm tracking-widest uppercase">✅ No urgent calls or meetings today.</span>
              </div>
            )}

            <div className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-mono text-sm text-secondary uppercase tracking-widest">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 bg-white/5 rounded text-white hover:bg-white/20">{'<'}</button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-2 font-mono text-xs bg-white/5 rounded text-white hover:bg-white/20">TODAY</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 bg-white/5 rounded text-white hover:bg-white/20">{'>'}</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center font-mono text-xs text-secondary py-2">{d}</div>
                ))}
                {blanks.map(b => <div key={`blank-${b}`} className="p-2"></div>)}
                {calendarDays.map(day => {
                  const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateString === todayStr;
                  const dayCalls = leads.filter(l => l.tentative_call_date === dateString);
                  const dayMeets = leads.filter(l => l.gmeet_date === dateString);

                  return (
                    <div key={day} className={`min-h-[80px] p-2 border rounded flex flex-col items-start gap-1 transition-colors ${isToday ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                      <span className={`font-mono text-xs ${isToday ? 'text-primary font-bold' : 'text-secondary'}`}>{day}</span>
                      <div className="flex flex-col gap-1 w-full overflow-hidden">
                        {dayCalls.length > 0 && (
                          <div className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded truncate" title={`Calls: ${dayCalls.map(l=>l.name).join(', ')}`}>
                            📞 {dayCalls.length} Call(s)
                          </div>
                        )}
                        {dayMeets.length > 0 && (
                          <div className="text-[9px] bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded truncate" title={`GMeets: ${dayMeets.map(l=>l.name).join(', ')}`}>
                            📹 {dayMeets.length} Meet(s)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 justify-center">
                <span className="flex items-center gap-2 font-mono text-[10px] text-secondary"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Call Scheduled</span>
                <span className="flex items-center gap-2 font-mono text-[10px] text-secondary"><span className="w-2 h-2 rounded-full bg-purple-400"></span> GMeet Scheduled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-[95%] flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/database')}
          className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Analytics
        </button>
        
        {/* NEW: Reminders Button Next to Navigation */}
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowReminders(true)}
            className="relative text-secondary hover:text-white font-mono text-xs uppercase tracking-widest transition-colors flex items-center gap-2 bg-white/5 px-4 py-2 rounded border border-white/10 hover:border-white/30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Reminders
            {urgentAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
          
          <span className="font-mono text-xs text-purple-400 tracking-widest uppercase flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Lead Manager
          </span>
        </div>
      </div>

      <div className="glass-modal w-full max-w-[95%] xl:max-w-[95%] p-8 relative z-10 flex flex-col gap-6 shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Lead Manager</h1>
            <p className="text-secondary text-sm mt-1">Sort, filter, and search leads. Click any row to view and edit the full profile.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadExcel}
              className="border border-white/20 hover:border-white/50 text-white font-mono text-sm tracking-widest uppercase px-4 py-2 rounded transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Export{processedLeads.length !== leads.length ? ` (${processedLeads.length})` : ''}
            </button>
            <button onClick={fetchLeads} className="text-secondary hover:text-primary font-mono text-xs uppercase px-4 py-2 border border-white/10 rounded">
              Refresh
            </button>
          </div>
        </div>

        {/* ── SEARCH + FILTER BAR ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={filters.globalSearch}
                onChange={e => setFilters(p => ({ ...p, globalSearch: e.target.value }))}
                placeholder="Search name, company, requirement, phone, location..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-8 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-secondary/40" />
              {filters.globalSearch && (
                <button onClick={() => setFilters(p => ({ ...p, globalSearch: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-white text-lg leading-none">×</button>
              )}
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs tracking-widest uppercase border transition-colors whitespace-nowrap ${
                showFilters || activeFilterCount > 0 ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/20'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg>
              Filters
              {activeFilterCount > 0 && <span className="bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>}
            </button>
            {(activeFilterCount > 0 || sortConfig.key) && (
              <button onClick={clearAllFilters} className="px-3 py-2.5 rounded-lg font-mono text-[10px] tracking-widest uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap">
                Clear All
              </button>
            )}
          </div>
          {showFilters && (
            <div className="bg-black/20 border border-white/10 rounded-xl p-5 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Source</span>
                <div className="flex flex-wrap gap-2">
                  {uniqueSources.map(src => (
                    <button key={src} onClick={() => toggleFilter('source', src)}
                      className={`px-3 py-1 rounded-full font-mono text-xs border transition-all ${filters.source.includes(src) ? 'bg-primary/25 border-primary text-white' : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/25'}`}>
                      {filters.source.includes(src) && '✓ '}{src}
                    </button>
                  ))}
                  {!uniqueSources.length && <span className="text-secondary font-mono text-xs">No sources loaded yet.</span>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Pipeline Stage</span>
                <div className="flex flex-wrap gap-2">
                  {pipelineStages.map(stage => {
                    const on = stage === 'Closed - Won' ? 'bg-green-500/20 border-green-500 text-green-300'
                             : stage === 'Closed - Lost' ? 'bg-red-500/20 border-red-500 text-red-300'
                             : stage === 'Negotiation' ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                             : 'bg-primary/20 border-primary text-white';
                    return (
                      <button key={stage} onClick={() => toggleFilter('status', stage)}
                        className={`px-3 py-1 rounded-full font-mono text-xs border transition-all ${filters.status.includes(stage) ? on : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/25'}`}>
                        {filters.status.includes(stage) && '✓ '}{stage}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Temperature</span>
                <div className="flex gap-2">
                  {[{ val:'Hot', label:'🔥 Hot', on:'bg-red-500/20 border-red-500 text-red-300' },
                    { val:'Warm', label:'🌡️ Warm', on:'bg-amber-500/20 border-amber-500 text-amber-300' },
                    { val:'Cold', label:'❄️ Cold', on:'bg-cyan-500/20 border-cyan-500 text-cyan-300' }
                  ].map(({ val, label, on }) => (
                    <button key={val} onClick={() => toggleFilter('lead_temp', val)}
                      className={`px-4 py-1.5 rounded-full font-mono text-xs border transition-all ${filters.lead_temp.includes(val) ? on : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:border-white/25'}`}>
                      {filters.lead_temp.includes(val) && '✓ '}{label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Date Range</span>
                  <div className="flex items-center gap-2">
                    <input type="date" value={filters.dateStart} onChange={e => setFilters(p => ({ ...p, dateStart: e.target.value }))}
                      className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary" />
                    <span className="text-secondary text-xs">→</span>
                    <input type="date" value={filters.dateEnd} onChange={e => setFilters(p => ({ ...p, dateEnd: e.target.value }))}
                      className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-secondary uppercase tracking-widest">Value Range (₹)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={filters.priceMin} onChange={e => setFilters(p => ({ ...p, priceMin: e.target.value }))}
                      placeholder="Min" className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary placeholder:text-secondary/30" />
                    <span className="text-secondary text-xs">→</span>
                    <input type="number" value={filters.priceMax} onChange={e => setFilters(p => ({ ...p, priceMax: e.target.value }))}
                      placeholder="Max" className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white font-mono text-xs focus:outline-none focus:border-primary placeholder:text-secondary/30" />
                  </div>
                </div>
              </div>
            </div>
          )}
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

        {/* ── DATA TABLE ────────────────────────────────────────────────────── */}
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
              <table className="w-full text-left border-collapse min-w-[1680px] mt-2">
                <thead>
                  <tr className="border-b border-white/10 text-secondary font-mono text-xs uppercase tracking-wider">
                    <th className="py-4 px-4 w-10">
                      <input type="checkbox" onChange={handleSelectAll}
                        checked={selectedLeads.length === processedLeads.length && processedLeads.length > 0}
                        className="w-4 h-4 accent-primary cursor-pointer" />
                    </th>
                    <th className="py-4 px-3 font-medium w-52"><span className="flex items-center">Client Info <SortBtn col="name" /></span></th>
                    <th className="py-4 px-3 font-medium w-64">Requirement</th>
                    <th className="py-4 px-3 font-medium w-72">Latest Note</th>
                    <th className="py-4 px-3 font-medium text-center w-40"><span className="flex items-center justify-center">Stage <SortBtn col="status" /></span></th>
                    <th className="py-4 px-3 font-medium text-center w-28"><span className="flex items-center justify-center">Temp <SortBtn col="lead_temp" /></span></th>
                    <th className="py-4 px-3 font-medium text-right w-36"><span className="flex items-center justify-end">Value (₹) <SortBtn col="price" /></span></th>
                    <th className="py-4 px-3 font-medium text-center w-44">Call / Meet</th>
                    {/* Far right columns */}
                    <th className="py-4 px-3 font-medium w-44"><span className="flex items-center">Date <SortBtn col="date" /></span></th>
                    <th className="py-4 px-3 font-medium w-36">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {processedLeads.map(lead => {
                    const latestNote  = getLatestNotePreview(lead.notes);
                    const noteCount   = parseNoteLines(lead.notes).length;
                    return (
                      <tr key={lead.id}
                        onClick={() => openProfile(lead)}
                        className="hover:bg-white/[0.06] transition-colors cursor-pointer group">
                        <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedLeads.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            className="w-4 h-4 accent-primary cursor-pointer" />
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white font-medium text-sm">{lead.name || '—'}</span>
                            <span className="text-secondary text-xs">{lead.company_name || ''}</span>
                            <span className="text-secondary/70 text-xs font-mono">{lead.phone || ''}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className="text-white text-sm line-clamp-2 leading-relaxed">
                            {lead.requirement || <span className="text-white/20 italic">No requirement</span>}
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          {latestNote ? (
                            <div className="flex flex-col gap-1">
                              <p className="text-white/75 text-xs leading-relaxed line-clamp-2">{latestNote}</p>
                              {noteCount > 1 && <span className="text-secondary font-mono text-[9px]">+{noteCount - 1} more entr{noteCount - 1 === 1 ? 'y' : 'ies'}</span>}
                            </div>
                          ) : (
                            <span className="text-white/15 font-mono text-[10px] italic">No notes</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusBadge status={lead.status} />
                            {lead.status === 'Closed - Lost' && lead.lost_reason && (
                              <span className="text-[9px] text-red-400/70 font-mono truncate max-w-[130px]" title={lead.lost_reason}>↳ {lead.lost_reason}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center"><TempBadge temp={lead.lead_temp} /></td>
                        <td className="py-4 px-3 text-right">
                          <span className="text-green-400 font-mono text-sm font-medium">
                            {lead.price ? `₹${Number(lead.price).toLocaleString('en-IN')}` : <span className="text-white/20">—</span>}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="flex flex-col gap-1 items-start">
                            {lead.tentative_call_date && <span className="font-mono text-[10px] text-blue-300/80 flex items-center gap-1">📞 {lead.tentative_call_date}</span>}
                            {lead.gmeet_date && <span className="font-mono text-[10px] text-purple-300/80 flex items-center gap-1">📹 {lead.gmeet_date}</span>}
                            {!lead.tentative_call_date && !lead.gmeet_date && <span className="text-white/15 font-mono text-[10px]">—</span>}
                          </div>
                        </td>
                        <td className="py-4 px-3"><span className="text-white/60 font-mono text-xs">{lead.date || '—'}</span></td>
                        <td className="py-4 px-3">
                          <span className={`font-mono text-[10px] uppercase tracking-wider ${
                            lead.source === 'IndiaMart' ? 'text-blue-400' : lead.source === 'TradeIndia' ? 'text-amber-400' : lead.source === 'Alibaba' ? 'text-orange-400' : 'text-secondary'
                          }`}>{lead.source || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                <span className="font-mono text-xs text-secondary">
                  Showing <strong className="text-white">{processedLeads.length}</strong> of <strong className="text-white">{leads.length}</strong> leads
                  {processedLeads.length !== leads.length && <span className="text-primary"> (filtered)</span>}
                  {sortConfig.key && <span> · sorted by <strong className="text-white">{sortConfig.key}</strong> {sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                  <span className="ml-3 text-white/20">· Scroll right to see Date / Source</span>
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
