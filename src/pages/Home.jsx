import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import indiamartLogo from '../assets/icons/indiamart.png';
import tradeindiaLogo from '../assets/icons/tradeindia.png';

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
};

const normalizeCookie = (raw) => {
  if (!raw) return '';
  if (raw.includes(':') && (raw.includes("'") || raw.includes('"'))) {
    const lines = raw.split('\n');
    const formattedParts = [];
    lines.forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;
      let key = line.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
      let val = line.slice(colonIdx + 1).trim().replace(/,$/, '').trim().replace(/^['"]|['"]$/g, '');
      if (key) formattedParts.push(`${key}=${val}`);
    });
    return formattedParts.join('; ');
  }
  return raw.trim();
};

export default function Home() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'BME';
  const isAdmin = userRole === 'Admin';

  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [exportData, setExportData] = useState({ user1: [], user2: [], unclassified: [], date_range: '' });
  const [draggedItem, setDraggedItem] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const [showReminders, setShowReminders] = useState(false);
  const [calendarLeads, setCalendarLeads] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [todayPage, setTodayPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const ITEMS_PER_PAGE = 3;

  useEffect(() => { fetchCalendarData(); }, []);

  const fetchCalendarData = async () => {
    try {
      const { data, error } = await supabase.from('leads').select('id, name, tentative_call_date, gmeet_date, call_attended, gmeet_attended');
      if (error) throw error;
      setCalendarLeads(data || []);
    } catch (err) { console.error("Error fetching calendar data:", err.message); }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleInitiateExport = async (forceRefetch = false) => {
    if (isFetchingAI || isUploading) return;

    if (!forceRefetch) {
      const cachedData = sessionStorage.getItem('cachedExportData');
      if (cachedData) {
        setExportData(JSON.parse(cachedData));
        setIsReviewModalOpen(true);
        return;
      }
    }

    const rawCookie = localStorage.getItem('im_cookie') || '';
    const formattedCookie = normalizeCookie(rawCookie);

    setIsFetchingAI(true);
    setExportMsg('');
    setProgress({ current: 0, total: 0 });

    try {
      const res = await fetch('https://python-backend-tdjw.onrender.com/api/drive/fetch-and-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indiamart_cookie: formattedCookie }),
      });
      const data = await res.json();

      if (data.errors?.length > 0 && data.leads?.length === 0) {
        setExportMsg(`❌ ${data.errors[0]}`);
        setIsFetchingAI(false);
        return;
      }
      if (!data.leads || data.leads.length === 0) {
        setExportMsg('⚠️ No new leads found for Yesterday and Today.');
        setIsFetchingAI(false);
        return;
      }

      const allRawLeads = data.leads;
      const dateRange = data.date_range || '';

      setExportData({ user1: [], user2: [], unclassified: [], date_range: dateRange });
      setProgress({ current: 0, total: allRawLeads.length });
      setIsReviewModalOpen(true);

      const DELAY_MS = 5000;
      const MAX_RETRIES = 3;

      for (let i = 0; i < allRawLeads.length; i++) {
        const lead = allRawLeads[i];
        let classified = false;
        let retries = 0;

        while (!classified && retries <= MAX_RETRIES) {
          try {
            const classifyRes = await fetch('https://python-backend-tdjw.onrender.com/api/classify-single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requirement: lead.requirement, lead }),
            });

            if (classifyRes.status === 429) {
              retries++;
              const retryAfter = classifyRes.headers.get('Retry-After');
              const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : DELAY_MS * 2;
              console.warn(`Rate limited for lead "${lead.name}". Waiting ${waitTime}ms (retry ${retries}/${MAX_RETRIES})`);
              await sleep(waitTime);
              continue;
            }

            const result = await classifyRes.json();
            const category = result.category || 'Unclassified';
            const machineCode = result.machine_code || null;

            if (!lead.frontend_id) {
              lead.frontend_id = `${lead.source}-${lead.phone}-${lead.name}-${(lead.requirement || '').slice(0, 10)}-${Date.now()}-${i}`;
            }
            // attach machine code to lead object
            lead.machine_code = machineCode;

            setExportData(prev => {
              const updated = { ...prev };
              const target = category === 'User 1' ? 'user1' : category === 'User 2' ? 'user2' : 'unclassified';
              updated[target] = [...prev[target], lead];
              return updated;
            });
            classified = true;
          } catch (err) {
            if (retries >= MAX_RETRIES) {
              console.warn(`Classification failed after ${MAX_RETRIES} retries for lead: ${lead.name}`, err);
              if (!lead.frontend_id) {
                lead.frontend_id = `${lead.source}-${lead.phone}-${lead.name}-fail-${Date.now()}-${i}`;
              }
              setExportData(prev => ({
                ...prev,
                unclassified: [...prev.unclassified, lead],
              }));
              classified = true;
            } else {
              retries++;
              await sleep(DELAY_MS);
            }
          }
        }

        if (i < allRawLeads.length - 1) {
          await sleep(DELAY_MS);
        }

        setProgress({ current: i + 1, total: allRawLeads.length });
      }

      setExportData(prev => {
        sessionStorage.setItem('cachedExportData', JSON.stringify(prev));
        return prev;
      });

    } catch (err) {
      setExportMsg('❌ Failed to connect to server. Is Uvicorn running?');
    } finally {
      setIsFetchingAI(false);
    }
  };

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    try {
      const res = await fetch('https://python-backend-tdjw.onrender.com/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData),
      });
      const data = await res.json();
      setExportMsg(data.message || '✅ Upload started! Check Google Drive in ~30 sec.');
      setIsReviewModalOpen(false);
      sessionStorage.removeItem('cachedExportData');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete handler – removes a lead from its current column
  const handleDeleteLead = (leadId) => {
    setExportData(prev => {
      const newData = { ...prev };
      for (const col of ['user1', 'user2', 'unclassified']) {
        newData[col] = newData[col].filter(l => l.frontend_id !== leadId);
      }
      sessionStorage.setItem('cachedExportData', JSON.stringify(newData));
      return newData;
    });
  };

  const handleDragStart = (e, item, sourceList) => {
    setDraggedItem({ item, sourceList });
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { e.target.style.opacity = "0.4"; }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedItem(null);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const handleDrop = (e, targetList) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.sourceList === targetList) return;

    setExportData(prev => {
      const newData = { ...prev };
      newData[draggedItem.sourceList] = newData[draggedItem.sourceList].filter(l => l.frontend_id !== draggedItem.item.frontend_id);
      newData[targetList] = [...newData[targetList], draggedItem.item];
      sessionStorage.setItem('cachedExportData', JSON.stringify(newData));
      return newData;
    });
  };

  // Calendar logic unchanged ...
  const todayStr = new Date().toISOString().split('T')[0];
  let todayAlerts = []; let upcomingAlerts = [];

  calendarLeads.forEach(lead => {
    if (lead.tentative_call_date && !lead.call_attended) {
      const isUp = String(lead.tentative_call_date) > todayStr;
      (isUp ? upcomingAlerts : todayAlerts).push({ ...lead, alertType: 'Call', alertDate: lead.tentative_call_date });
    }
    if (lead.gmeet_date && !lead.gmeet_attended) {
      const gDate = String(lead.gmeet_date).split('T')[0];
      const isUp = gDate > todayStr;
      (isUp ? upcomingAlerts : todayAlerts).push({ ...lead, alertType: 'GMeet', alertDate: gDate });
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
    const col = alertType === 'Call' ? 'call_attended' : 'gmeet_attended';
    try {
      setCalendarLeads(prev => prev.map(l => l.id === leadId ? { ...l, [col]: true } : l));
      await supabase.from('leads').update({ [col]: true }).eq('id', leadId);
    } catch (err) { console.error("Failed to update status:", err.message); }
  };

  const renderPagination = (currentPage, totalPages, setPage) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex gap-3 justify-center mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => setPage(p)} className={`w-10 h-10 rounded-lg font-mono text-base font-bold transition-all duration-300 ${currentPage === p ? 'bg-purple-900 text-white shadow-md ring-2 ring-[#EBA7FF]/50' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-[#EBA7FF]/20 hover:text-purple-900'}`}>{p}</button>
        ))}
      </div>
    );
  };

  const handleLogout = () => { localStorage.removeItem('isLoggedIn'); localStorage.removeItem('userRole'); navigate('/'); };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const daysInCurrentMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOffset = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const blanks = Array.from({ length: firstDayOffset }, (_, i) => i);
  const calendarDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const dataSources = [
    { name: 'IndiaMart', path: '/indiamart', icon: <img src={indiamartLogo} alt="IndiaMart" className="w-14 h-14 object-contain rounded-md" /> },
    { name: 'TradeIndia', path: '/tradeindia', icon: <img src={tradeindiaLogo} alt="TradeIndia" className="w-14 h-14 object-contain rounded-md" /> },
    { name: 'Manual Entry', path: '/manual', icon: <svg className="w-14 h-14 text-purple-600 group-hover:text-purple-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" /></svg> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-20 px-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[150px] pointer-events-none" />

      <div className="absolute top-0 w-full p-8 flex justify-end gap-6 z-20 max-w-[95%] xl:max-w-7xl">
        <button onClick={() => setShowReminders(true)} className="relative text-slate-700 hover:text-purple-900 font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 bg-white px-7 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md hover:border-[#EBA7FF] hover:bg-[#EBA7FF]/10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> Reminders
          {urgentAlerts.length > 0 && <span className="absolute -top-2 -right-2 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 border-2 border-white"></span></span>}
        </button>
        <button onClick={handleLogout} className="text-slate-700 hover:text-rose-700 font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 bg-white px-7 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md hover:border-rose-300 hover:bg-rose-50">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg> Terminate Session
        </button>
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-16 mt-10">
        <div className="text-center space-y-5 max-w-3xl">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-100 border border-emerald-300 rounded-full mb-2 shadow-sm">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
            <span className="font-bold text-xs text-emerald-800 uppercase tracking-widest">Main Grid Online</span>
          </div>
          <h1 className="text-6xl font-black text-slate-900 tracking-tight">Lead Management Portal</h1>
          <p className="text-slate-500 text-xl font-medium px-4">Select an external data stream to route new leads into the CRM, or access the centralized operator database to view existing records.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 w-full">
          {dataSources.map((source) => (
            <button key={source.name} onClick={() => navigate(source.path)} className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-5 w-56 h-56 hover:border-[#EBA7FF] hover:bg-[#EBA7FF]/5 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(235,167,255,0.2)] transition-all duration-300 group shadow-md">
              <div className="transition-colors duration-300">{source.icon}</div>
              <span className="font-black text-xl text-slate-700 group-hover:text-purple-900 tracking-widest text-center">{source.name}</span>
            </button>
          ))}
        </div>

        <div className="w-full max-w-4xl h-px bg-slate-200 my-2"></div>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl justify-center items-start">
          <button onClick={() => navigate(isAdmin ? '/database' : '/leadmanager')} className="bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white font-black text-xl tracking-widest uppercase rounded-2xl w-full flex-1 h-20 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(235,167,255,0.6)] flex items-center justify-center gap-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg> Access Master Database
          </button>

          <div className="flex flex-col items-center gap-3 w-full flex-1">
            <button
              onClick={() => handleInitiateExport(false)}
              disabled={isFetchingAI || isUploading}
              className={`w-full h-20 font-black text-xl tracking-widest uppercase rounded-2xl transition-all duration-300 shadow-lg flex items-center justify-center gap-4 ${
                isFetchingAI || isUploading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]'
              }`}
            >
              {isFetchingAI ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {progress.total > 0
                    ? `Classifying ${progress.current}/${progress.total}`
                    : 'Fetching Leads...'}
                </>
              ) : isUploading ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58q0-1.95 1.17-3.48 1.18-1.53 3.08-1.95.51-2.29 2.39-3.72Q9.52 4 12 4q2.93 0 4.96 2.04Q19 8.07 19 11q1.73.2 2.86 1.5Q23 13.8 23 15.5q0 1.88-1.31 3.19T18.5 20zm-1-2h13q1.05 0 1.78-.72.72-.73.72-1.78 0-1.05-.72-1.78-.73-.72-1.78-.72H16v-2q0-2.07-1.46-3.54Q13.07 6 11 6 8.93 6 7.46 7.46 6 8.93 6 11h-.5q-1.25 0-2.12.88Q2.5 12.75 2.5 14t.88 2.12Q4.25 17 5.5 17zm6.5-5z" />
                  </svg>
                  Fetch & Export to Drive
                </>
              )}
            </button>
            {exportMsg && (
              <p className={`text-sm font-bold text-center px-5 py-3 rounded-xl border w-full ${
                exportMsg.startsWith('❌')
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : exportMsg.startsWith('⚠️')
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {exportMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal with delete buttons & machine badges */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-6">
          <div className="bg-slate-50 border border-slate-300 rounded-3xl w-full max-w-[95vw] h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            
            <div className="flex-shrink-0 flex justify-between items-center px-8 py-6 border-b border-slate-200 bg-white">
              <div>
                <h3 className="text-3xl font-black text-slate-900">Review & Sort Leads</h3>
                <p className="text-slate-500 font-bold mt-1 tracking-widest text-sm uppercase">
                  Date Range: {exportData.date_range} • Drag to reassign
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => handleInitiateExport(true)} disabled={isFetchingAI || isUploading} className="px-6 py-4 font-black tracking-widest text-m uppercase text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition-colors shadow-sm flex items-center gap-2">
                  {isFetchingAI ? 'Fetching...' : '🔄 Re-fetch Data'}
                </button>
                <button onClick={() => setIsReviewModalOpen(false)} className="px-8 py-4 font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors shadow-sm">Cancel</button>
                <button onClick={handleConfirmUpload} disabled={isUploading} className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-3">
                  {isUploading ? 'Uploading...' : 'Confirm & Upload'}
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden p-6 gap-6 bg-slate-100/50">
              {[
                { id: 'user1', title: 'USER 1', color: 'blue' },
                { id: 'user2', title: 'USER 2', color: 'purple' },
                { id: 'unclassified', title: 'UNCLASSIFIED', color: 'rose' }
              ].map(col => (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`flex flex-col flex-1 bg-white border-2 rounded-2xl overflow-hidden transition-colors ${
                    draggedItem && draggedItem.sourceList !== col.id
                      ? `border-${col.color}-300 bg-${col.color}-50/30`
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div className={`flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-${col.color}-50`}>
                    <span className={`font-black text-lg text-${col.color}-800 tracking-widest uppercase`}>{col.title}</span>
                    <span className={`font-mono font-bold text-${col.color}-900 bg-${col.color}-200 px-3 py-1 rounded-lg`}>
                      {exportData[col.id].length}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {exportData[col.id].map(lead => (
                      <div
                        key={lead.frontend_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead, col.id)}
                        onDragEnd={handleDragEnd}
                        className={`relative cursor-grab active:cursor-grabbing bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-${col.color}-400 hover:shadow-md transition-all flex flex-col gap-2`}
                      >
                        {/* delete button */}
                        <button
                          onClick={() => handleDeleteLead(lead.frontend_id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-100 border border-rose-300 text-rose-600 hover:bg-rose-200 font-bold flex items-center justify-center text-xs"
                          title="Delete lead"
                        >✕</button>

                        {/* machine code badge (if present) */}
                        {lead.machine_code && (
                          <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded text-xs font-bold bg-slate-100 border border-slate-300 text-slate-700 uppercase tracking-widest">
                            {lead.machine_code}
                          </span>
                        )}

                        <div className="flex justify-between items-start gap-2">
                          <span className="font-black text-slate-800 text-lg leading-tight">{lead.name || 'Unknown'}</span>
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">{lead.source}</span>
                        </div>
                        <span className="text-slate-600 font-medium text-sm line-clamp-3 leading-relaxed">
                          {lead.requirement || <span className="italic text-slate-400">No requirement listed</span>}
                        </span>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-blue-700 font-bold tabular-nums text-sm">{lead.phone || '—'}</span>
                          <span className="text-slate-400 font-bold tabular-nums text-xs">{lead.date}</span>
                        </div>
                      </div>
                    ))}
                    {exportData[col.id].length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-sm uppercase tracking-widest opacity-50 border-2 border-dashed border-slate-200 rounded-xl m-2">
                        Drop Leads Here
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reminders modal (unchanged) */}
      {showReminders && ( /* ... same as before ... */ )}
    </div>
  );
}
