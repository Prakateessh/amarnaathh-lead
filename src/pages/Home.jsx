import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// 1. Import your local assets here
import indiamartLogo from '../assets/icons/indiamart.png';
import tradeindiaLogo from '../assets/icons/tradeindia.png';

export default function Home() {
  const navigate = useNavigate();

  // === REMINDERS & CALENDAR STATE ===
  const [showReminders, setShowReminders] = useState(false);
  const [calendarLeads, setCalendarLeads] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
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

  // === DATE MATH & ALERT LOGIC ===
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Filter out the urgent alerts
  const urgentAlerts = [];
  calendarLeads.forEach(lead => {
    // Check for urgent Calls
    if (lead.tentative_call_date && !lead.call_attended && (lead.tentative_call_date === todayStr || lead.tentative_call_date === tomorrowStr)) {
      urgentAlerts.push({ ...lead, alertType: 'Call', alertDate: lead.tentative_call_date });
    }
    // Check for urgent GMeets
    if (lead.gmeet_date && !lead.gmeet_attended && (lead.gmeet_date === todayStr || lead.gmeet_date === tomorrowStr)) {
      urgentAlerts.push({ ...lead, alertType: 'GMeet', alertDate: lead.gmeet_date });
    }
  });

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

  // Action: Logout properly
  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    navigate('/');
  };

  // === CALENDAR GRID GENERATOR ===
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOffset = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const blanks = Array.from({ length: firstDayOffset }, (_, i) => i);
  const days = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // 2. Map the imported local variables to the image sources
  const dataSources = [
    {
      name: 'IndiaMart',
      path: '/indiamart',
      icon: <img src={indiamartLogo} alt="IndiaMart" className="w-10 h-10 object-contain rounded-md shadow-[0_0_10px_rgba(255,255,255,0.1)]" />,
    },
    {
      name: 'TradeIndia',
      path: '/tradeindia',
      icon: <img src={tradeindiaLogo} alt="TradeIndia" className="w-10 h-10 object-contain rounded-md shadow-[0_0_10px_rgba(255,255,255,0.1)]" />,
    },
    {
      name: 'Manual Entry',
      path: '/manual',
      icon: <svg className="w-10 h-10 text-secondary group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" /></svg>,
    }
  ];

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-start py-20 px-4 relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Navbar */}
      <div className="absolute top-0 w-full p-6 flex justify-end gap-6 z-20 max-w-[1440px]">
        
        {/* Reminders Button */}
        <button 
          onClick={() => setShowReminders(true)}
          className="relative text-secondary hover:text-white font-mono text-xs uppercase tracking-widest transition-colors flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:border-white/30"
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

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="text-secondary hover:text-primary font-mono text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Terminate Session
        </button>
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-16">
        
        {/* Section 1: Header & Description */}
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="font-mono text-[10px] text-green-400 uppercase tracking-widest">Main Grid Online</span>
          </div>
          
          <h1 className="text-5xl font-sans font-bold text-white tracking-tight">
            Lead Management Portal
          </h1>
          <p className="text-onSurfaceVariant text-lg font-sans">
            Select an external data stream to route new leads into the CRM, or access the centralized operator database to view existing records.
          </p>
        </div>

        {/* Section 2: The 5 Data Source Buttons */}
        <div className="flex flex-wrap justify-center gap-6 w-full">
          {dataSources.map((source) => (
            <button
              key={source.name}
              onClick={() => navigate(source.path)}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-4 w-44 h-44 hover:bg-white/10 hover:border-primary/50 hover:shadow-glow-primary hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="text-secondary group-hover:text-primary transition-colors duration-300">
                {source.icon}
              </div>
              <span className="font-mono text-sm text-white tracking-wider font-medium text-center">
                {source.name}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>

        {/* Section 3: The Database Button */}
        <button
          onClick={() => navigate('/database')}
          className="btn-primary w-full max-w-md h-20 rounded-xl flex items-center justify-center gap-4 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
          <svg className="w-6 h-6 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <span className="font-mono text-base tracking-widest uppercase font-bold text-white relative z-10">
            Access Master Database
          </span>
        </button>
      </div>

      {/* ── MODAL: REMINDERS & CALENDAR ───────────────────────────── */}
      {showReminders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy border border-white/20 p-6 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                📅 Schedule & Reminders
              </h3>
              <button onClick={() => setShowReminders(false)} className="text-secondary hover:text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Urgent Alerts Section */}
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
                      <button 
                        onClick={() => setShowReminders(false)} 
                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-mono text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors"
                      >
                        Will Attend Soon
                      </button>
                      <button 
                        onClick={() => handleMarkAttended(alert.id, alert.alertType)}
                        className="flex-1 bg-green-600/80 hover:bg-green-500 text-white font-mono text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                      >
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

            {/* Calendar View Section */}
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
                {/* Days of Week */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center font-mono text-xs text-secondary py-2">{d}</div>
                ))}
                
                {/* Blank Offset Days */}
                {blanks.map(b => <div key={`blank-${b}`} className="p-2"></div>)}
                
                {/* Actual Days */}
                {days.map(day => {
                  const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateString === todayStr;
                  
                  // Check if this specific day has calls or meets
                  const dayCalls = calendarLeads.filter(l => l.tentative_call_date === dateString);
                  const dayMeets = calendarLeads.filter(l => l.gmeet_date === dateString);

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
              
              {/* Calendar Legend */}
              <div className="flex gap-4 mt-4 justify-center">
                <span className="flex items-center gap-2 font-mono text-[10px] text-secondary"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Call Scheduled</span>
                <span className="flex items-center gap-2 font-mono text-[10px] text-secondary"><span className="w-2 h-2 rounded-full bg-purple-400"></span> GMeet Scheduled</span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
