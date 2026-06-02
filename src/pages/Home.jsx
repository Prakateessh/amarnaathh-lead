import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// 1. Import your local assets here
import indiamartLogo from '../assets/icons/indiamart.png';
import tradeindiaLogo from '../assets/icons/tradeindia.png';

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

export default function Home() {
  const navigate = useNavigate();

  // === REMINDERS & CALENDAR STATE ===
  const [showReminders, setShowReminders] = useState(false);
  const [calendarLeads, setCalendarLeads] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Pagination State for Reminders
  const [todayPage, setTodayPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const ITEMS_PER_PAGE = 3;

  // Fetch leads for the calendar on load
  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, tentative_call_date, gmeet_date, call_attended, gmeet_attended');
      if (error) throw error;
      setCalendarLeads(data || []);
    } catch (err) {
      console.error("Error fetching calendar data:", err.message);
    }
  };

  // === DATE MATH & ADVANCED ALERT LOGIC ===
  const todayStr = new Date().toISOString().split('T')[0];

  let todayAlerts = [];
  let upcomingAlerts = [];

  calendarLeads.forEach(lead => {
    // Check Calls
    if (lead.tentative_call_date && !lead.call_attended) {
      const isUpcoming = String(lead.tentative_call_date) > todayStr;
      const targetArray = isUpcoming ? upcomingAlerts : todayAlerts;
      targetArray.push({ ...lead, alertType: 'Call', alertDate: lead.tentative_call_date });
    }
    // Check GMeets
    if (lead.gmeet_date && !lead.gmeet_attended) {
      const gDate = String(lead.gmeet_date).split('T')[0];
      const isUpcoming = gDate > todayStr;
      const targetArray = isUpcoming ? upcomingAlerts : todayAlerts;
      targetArray.push({ ...lead, alertType: 'GMeet', alertDate: gDate });
    }
  });

  // Sort ascending (closest dates at the top)
  todayAlerts.sort((a, b) => new Date(a.alertDate || 0) - new Date(b.alertDate || 0));
  upcomingAlerts.sort((a, b) => new Date(a.alertDate || 0) - new Date(b.alertDate || 0));

  const urgentAlerts = [...todayAlerts, ...upcomingAlerts]; 

  // Pagination Math
  const todayTotalPages = Math.ceil(todayAlerts.length / ITEMS_PER_PAGE);
  const upcomingTotalPages = Math.ceil(upcomingAlerts.length / ITEMS_PER_PAGE);
  const currentTodayAlerts = todayAlerts.slice((todayPage - 1) * ITEMS_PER_PAGE, todayPage * ITEMS_PER_PAGE);
  const currentUpcomingAlerts = upcomingAlerts.slice((upcomingPage - 1) * ITEMS_PER_PAGE, upcomingPage * ITEMS_PER_PAGE);

  // Action: Mark as attended in DB
  const handleMarkAttended = async (leadId, alertType) => {
    const columnToUpdate = alertType === 'Call' ? 'call_attended' : 'gmeet_attended';
    try {
      // Update local state instantly
      setCalendarLeads(prev => prev.map(l => l.id === leadId ? { ...l, [columnToUpdate]: true } : l));
      // Update database
      await supabase.from('leads').update({ [columnToUpdate]: true }).eq('id', leadId);
    } catch (err) {
      console.error("Failed to update status:", err.message);
    }
  };

  // Helper for Pagination Bubbles
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

  // Action: Logout properly
  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole'); // Clear role cache as well
    navigate('/');
  };

  // === CALENDAR GRID GENERATOR ===
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOffset = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const blanks = Array.from({ length: firstDayOffset }, (_, i) => i);
  const calendarDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // 2. Map the imported local variables to the image sources
  const dataSources = [
    {
      name: 'IndiaMart',
      path: '/indiamart',
      icon: <img src={indiamartLogo} alt="IndiaMart" className="w-14 h-14 object-contain rounded-md" />,
    },
    {
      name: 'TradeIndia',
      path: '/tradeindia',
      icon: <img src={tradeindiaLogo} alt="TradeIndia" className="w-14 h-14 object-contain rounded-md" />,
    },
    {
      name: 'Manual Entry',
      path: '/manual',
      icon: <svg className="w-14 h-14 text-purple-600 group-hover:text-purple-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" /></svg>,
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-20 px-4 relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Top Navbar */}
      <div className="absolute top-0 w-full p-8 flex justify-end gap-6 z-20 max-w-[95%] xl:max-w-7xl">
        
        {/* Reminders Button */}
        <button 
          onClick={() => setShowReminders(true)}
          className="relative text-slate-700 hover:text-purple-900 font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 bg-white px-7 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md hover:border-[#EBA7FF] hover:bg-[#EBA7FF]/10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          Reminders
          {urgentAlerts.length > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 border-2 border-white"></span>
            </span>
          )}
        </button>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="text-slate-700 hover:text-rose-700 font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 bg-white px-7 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md hover:border-rose-300 hover:bg-rose-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Terminate Session
        </button>
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-16 mt-10">
        
        {/* Section 1: Header & Description */}
        <div className="text-center space-y-5 max-w-3xl">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-100 border border-emerald-300 rounded-full mb-2 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-xs text-emerald-800 uppercase tracking-widest">Main Grid Online</span>
          </div>
          
          <h1 className="text-6xl font-black text-slate-900 tracking-tight">
            Lead Management Portal
          </h1>
          <p className="text-slate-500 text-xl font-medium px-4">
            Select an external data stream to route new leads into the CRM, or access the centralized operator database to view existing records.
          </p>
        </div>

        {/* Section 2: The Data Source Buttons */}
        <div className="flex flex-wrap justify-center gap-8 w-full">
          {dataSources.map((source) => (
            <button
              key={source.name}
              onClick={() => navigate(source.path)}
              className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-5 w-56 h-56 hover:border-[#EBA7FF] hover:bg-[#EBA7FF]/5 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(235,167,255,0.2)] transition-all duration-300 group shadow-md"
            >
              <div className="transition-colors duration-300">
                {source.icon}
              </div>
              <span className="font-black text-lg text-slate-700 group-hover:text-purple-900 tracking-widest text-center">
                {source.name}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full max-w-4xl h-px bg-slate-200 my-2"></div>

        {/* Section 3: The Database Button */}
        <button
          onClick={() => navigate('/database')}
          className="bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white font-black text-xl tracking-widest uppercase rounded-2xl w-full max-w-md h-20 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(235,167,255,0.6)] flex items-center justify-center gap-4"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          Access Master Database
        </button>
      </div>

      {/* ── MODAL: REMINDERS & CALENDAR (LIGHT THEME) ───────────────────────────── */}
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
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-sm">
                            Dismiss
                          </button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-md">
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
                          <button onClick={() => setShowReminders(false)} className="flex-1 bg-slate-100 hover:bg-[#EBA7FF]/20 border border-slate-300 text-slate-700 hover:text-purple-900 font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-sm">
                            Dismiss
                          </button>
                          <button onClick={() => handleMarkAttended(alert.id, alert.alertType)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider py-4 rounded-xl transition-colors shadow-md">
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
                  <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <span className="text-slate-500 font-black text-xl bg-white px-8 py-4 rounded-2xl border border-slate-200 shadow-sm">No upcoming alerts</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="font-black text-xl text-slate-800 uppercase tracking-widest">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
                <div className="flex gap-3">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm">{'<'}</button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-6 font-mono text-base font-black bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm">TODAY</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm">{'>'}</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center font-black text-base uppercase text-slate-500 py-3">{d}</div>
                ))}
                {blanks.map(b => <div key={`blank-${b}`} className="p-3"></div>)}
                {calendarDays.map(day => {
                  const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateString === todayStr;
                  
                  const dayCalls = calendarLeads.filter(l => l.tentative_call_date === dateString && !l.call_attended);
                  const dayMeets = calendarLeads.filter(l => {
                    const gDate = l.gmeet_date ? String(l.gmeet_date).split('T')[0] : null;
                    return gDate === dateString && !l.gmeet_attended;
                  });

                  return (
                    <div key={day} className={`min-h-[120px] p-4 border rounded-2xl flex flex-col items-start gap-2.5 transition-colors ${isToday ? 'border-purple-400 bg-purple-50 shadow-md ring-4 ring-purple-100' : 'border-slate-200 bg-white hover:bg-slate-50 shadow-sm'}`}>
                      <span className={`font-mono text-lg ${isToday ? 'text-purple-900 font-black' : 'text-slate-600 font-bold'}`}>{day}</span>
                      <div className="flex flex-col gap-2 w-full overflow-hidden">
                        {dayCalls.length > 0 && (
                          <div className="text-sm bg-blue-100 text-blue-900 border border-blue-300 px-3 py-1.5 rounded-lg truncate font-bold shadow-sm" title={`Calls: ${dayCalls.map(l=>l.name).join(', ')}`}>
                            📞 {dayCalls.length} Call(s)
                          </div>
                        )}
                        {dayMeets.length > 0 && (
                          <div className="text-sm bg-purple-100 text-purple-900 border border-purple-300 px-3 py-1.5 rounded-lg truncate font-bold shadow-sm" title={`GMeets: ${dayMeets.map(l=>l.name).join(', ')}`}>
                            📹 {dayMeets.length} Meet(s)
                          </div>
                        )}
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

    </div>
  );
}
