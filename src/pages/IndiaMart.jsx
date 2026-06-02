import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function IndiaMart() {
  const navigate = useNavigate();

  // 🧠 MEMORY: Dates
  const [dates, setDates] = useState(() => {
    const savedDates = sessionStorage.getItem('im_dates');
    if (savedDates) return JSON.parse(savedDates);
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      start: yesterday.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  });

  const [cookieString, setCookieString] = useState(localStorage.getItem('im_cookie') || "");
  const [showCookieInput, setShowCookieInput] = useState(false); 
  
  // 🧠 MEMORY: Leads
  const [leads, setLeads] = useState(() => {
    const savedLeads = sessionStorage.getItem('im_leads');
    return savedLeads ? JSON.parse(savedLeads) : [];
  });
  
  const [isFetching, setIsFetching] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // 🔍 SORT & FILTER STATE
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({ globalSearch: '', status: [] });

  const extractionStatuses = ['—', '✅ Qualified', '❌ Not Qualified', '🔒 Synced'];

  useEffect(() => { sessionStorage.setItem('im_dates', JSON.stringify(dates)); }, [dates]);
  useEffect(() => { sessionStorage.setItem('im_leads', JSON.stringify(leads)); }, [leads]);

  const handleCookieChange = (e) => {
    setCookieString(e.target.value);
    localStorage.setItem('im_cookie', e.target.value);
  };

  const normalizeCookie = (raw) => {
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

  const handleFetch = async () => {
    if (!cookieString.trim()) {
      setStatus({ type: 'error', message: '⚠️ Authentication Error: Please paste your IndiaMart Cookie.' });
      setShowCookieInput(true); 
      return;
    }
    if (new Date(dates.start) > new Date(dates.end)) {
      setStatus({ type: 'error', message: '⚠️ Start Date cannot be after End Date.' });
      return;
    }

    setIsFetching(true);
    setStatus({ type: '', message: '' });

    try {
      const finalCookie = normalizeCookie(cookieString);
      const response = await fetch(`https://python-backend-tdjw.onrender.com/api/scrape/indiamart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: dates.start, end: dates.end, cookie_string: finalCookie })
      });
      
      if (!response.ok) throw new Error(`Server Error: ${response.status}`);
      const result = await response.json();
      
      if (result.total === 0) {
        setStatus({ type: 'error', message: '❌ Zero leads found. Your cookie may have expired.' });
        setShowCookieInput(true);
      } else {
        setLeads(result.data);
        setStatus({ type: 'success', message: `✅ Successfully extracted ${result.total} leads from IndiaMart.` });
        setShowCookieInput(false); 
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setStatus({ type: 'error', message: '❌ Connection failed or Cookie invalid.' });
      setShowCookieInput(true); 
    } finally {
      setIsFetching(false);
    }
  };

  const updateLeadStatus = (id, newStatus) => {
    setLeads(leads.map(lead => lead.id === id ? { ...lead, status: newStatus } : lead));
  };

  const handleSendToCRM = async () => {
    const qualifiedLeads = leads.filter(l => l.status === "✅ Qualified");
    if (qualifiedLeads.length === 0) return;

    setStatus({ type: '', message: '' });

    try {
      const payload = qualifiedLeads.map(lead => ({
        date: lead.date,
        requirement: lead.requirement,
        name: lead.name,
        company_name: lead.company,
        phone: lead.phone,
        location: lead.location,
        price: 0, 
        source: "IndiaMart",
        notes: "[System] Auto-imported via IndiaMart API Integration."
      }));

      const { error } = await supabase.from('leads').insert(payload);
      if (error) throw error;

      setStatus({ type: 'success', message: `✅ ${qualifiedLeads.length} leads successfully injected into Master CRM!` });
      setLeads(leads.map(l => l.status === "✅ Qualified" ? { ...l, status: "🔒 Synced" } : l));
    } catch (error) {
      setStatus({ type: 'error', message: `❌ Failed to save to CRM: ${error.message}` });
    }
  };

  const processedLeads = useMemo(() => {
    let result = [...leads];
    if (filters.globalSearch.trim()) {
      const s = filters.globalSearch.toLowerCase();
      result = result.filter(l => [l.name, l.company, l.requirement, l.phone, l.location].some(v => v?.toLowerCase().includes(s)));
    }
    if (filters.status.length) result = result.filter(l => filters.status.includes(l.status || '—'));
    
    if (sortConfig.key) {
      result.sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        const aVal = String(a[sortConfig.key] || '').toLowerCase();
        const bVal = String(b[sortConfig.key] || '').toLowerCase();
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    return result;
  }, [leads, filters, sortConfig]);

  const toggleFilter = (value) => {
    setFilters(prev => ({
      ...prev, status: prev.status.includes(value) ? prev.status.filter(v => v !== value) : [...prev.status, value]
    }));
  };

  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  
  const SortBtn = ({ col }) => (
    <button onClick={() => handleSort(col)} className={`ml-2 text-sm transition-all hover:scale-125 ${sortConfig.key === col ? 'text-purple-700' : 'text-slate-400 hover:text-slate-600'}`}>
      {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
    </button>
  );

  const handleDownloadExcel = () => {
    if (processedLeads.length === 0) return;
    const excelData = processedLeads.map(lead => ({
      'Date': lead.date || '', 'Requirement': lead.requirement || '', 'Name': lead.name || '',
      'Company': lead.company || '', 'Phone': lead.phone || '', 'Location': lead.location || '', 'Status': lead.status || 'Pending'
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IndiaMart Leads");
    XLSX.writeFile(workbook, `IndiaMart_Leads_${dates.start}_to_${dates.end}.xlsx`);
  };

  const clearSession = () => {
    sessionStorage.removeItem('im_leads');
    setLeads([]);
    setStatus({ type: 'success', message: '🧹 Temporary leads cleared from memory.' });
  };

  const qualifiedCount = leads.filter(l => l.status === "✅ Qualified").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <div className="w-full max-w-[95%] xl:max-w-7xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-slate-600 hover:text-purple-900 font-black text-base uppercase tracking-widest transition-colors flex items-center gap-3 bg-white px-6 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Routing
        </button>
        <span className="font-black text-base text-purple-900 tracking-widest uppercase flex items-center gap-3 bg-[#EBA7FF]/30 px-7 py-4 rounded-xl border border-[#EBA7FF]/60 shadow-sm">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          IndiaMart Integration
        </span>
      </div>

      <div className="bg-white w-full max-w-[95%] xl:max-w-7xl p-10 relative z-10 flex flex-col gap-10 shadow-2xl shadow-slate-200/60 rounded-3xl border border-slate-300">
        
        {/* Header Section */}
        <div className="border-b border-slate-200 pb-8 flex flex-col gap-6">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
            <div className="w-full xl:w-1/2">
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">Data Extraction</h1>
              <p className="text-slate-500 font-medium text-lg mt-3 mb-6">Pull inbound requests directly from the IndiaMart vendor API.</p>
              
              {showCookieInput && (
                <div className="flex flex-col gap-3 animate-fade-in bg-rose-50 border border-rose-200 p-6 rounded-2xl shadow-inner">
                  <label className="font-bold text-sm text-rose-700 uppercase tracking-widest flex items-center gap-2">
                    Session Cookie Data <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    value={cookieString} 
                    onChange={handleCookieChange}
                    rows="4"
                    placeholder={"Paste your cookie here...\n'pop_mthd': 'FL%3D...', etc."} 
                    className="bg-white border border-rose-300 px-5 py-4 rounded-xl text-slate-900 font-mono text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none w-full resize-y shadow-sm" 
                  />
                  <span className="text-sm font-bold text-rose-600">Previous cookie expired. Paste the new array/string above to continue.</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-end gap-5 w-full xl:w-auto">
              <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Start Date</label>
                <input type="date" value={dates.start} onChange={(e) => setDates({...dates, start: e.target.value})} className="bg-slate-50 border border-slate-300 px-5 py-4 rounded-xl text-slate-900 font-mono font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm cursor-pointer" />
              </div>
              <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">End Date</label>
                <input type="date" value={dates.end} onChange={(e) => setDates({...dates, end: e.target.value})} className="bg-slate-50 border border-slate-300 px-5 py-4 rounded-xl text-slate-900 font-mono font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm cursor-pointer" />
              </div>
              <button onClick={handleFetch} disabled={isFetching} className={`w-full sm:w-auto px-10 py-4 font-black text-lg tracking-widest uppercase rounded-xl transition-all shadow-md ${isFetching ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white hover:shadow-[0_0_20px_rgba(235,167,255,0.6)]'}`}>
                {isFetching ? 'Fetching...' : 'Initialize'}
              </button>
            </div>
          </div>
        </div>

        {status.message && (
          <div className={`px-6 py-4 rounded-xl font-bold text-sm tracking-widest uppercase shadow-sm border flex justify-between items-center ${status.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <span>{status.message}</span>
            <button onClick={() => setStatus({type: '', message: ''})} className="text-xl leading-none opacity-50 hover:opacity-100 transition-opacity">×</button>
          </div>
        )}

        {leads.length > 0 && (
          <div className="flex flex-col gap-6">
            
            {/* 🔍 FILTER BAR */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-5 items-center">
                <div className="relative flex-1">
                  <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={filters.globalSearch} onChange={e => setFilters(p => ({ ...p, globalSearch: e.target.value }))} placeholder="Search name, company, requirement, phone..." 
                    className="w-full bg-white border border-slate-300 rounded-2xl pl-14 pr-12 py-5 text-slate-900 font-medium text-lg focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-shadow placeholder:text-slate-400 shadow-sm" />
                  {filters.globalSearch && <button onClick={() => setFilters(p => ({ ...p, globalSearch: '' }))} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 text-3xl font-black leading-none">×</button>}
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-3 px-8 py-5 rounded-2xl font-black text-base tracking-widest uppercase border transition-colors shadow-sm whitespace-nowrap ${showFilters || filters.status.length > 0 ? 'bg-purple-100 border-[#EBA7FF] text-purple-900 ring-2 ring-[#EBA7FF]/50' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg> Filters {filters.status.length > 0 && <span className="bg-purple-900 text-white text-sm font-black rounded-lg px-2.5 py-0.5 ml-2">{filters.status.length}</span>}
                </button>
                {(filters.status.length > 0 || sortConfig.key || filters.globalSearch) && (
                  <button onClick={() => { setFilters({globalSearch: '', status: []}); setSortConfig({key:null, direction:'asc'}); }} className="px-8 py-5 rounded-2xl font-black text-sm tracking-widest uppercase border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors whitespace-nowrap shadow-sm">Clear All</button>
                )}
              </div>

              {showFilters && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col gap-4 shadow-inner">
                  <span className="font-black text-sm text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2.5">Qualify Status</span>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {extractionStatuses.map(stage => {
                      const activeClass = 
                        stage === '✅ Qualified' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-md' :
                        stage === '❌ Not Qualified' ? 'bg-rose-100 border-rose-300 text-rose-800 shadow-md' :
                        stage === '🔒 Synced' ? 'bg-blue-100 border-blue-300 text-blue-800 shadow-md' :
                        'bg-slate-200 border-slate-300 text-slate-800 shadow-md';
                      return (
                        <button key={stage} onClick={() => toggleFilter(stage)} className={`px-5 py-2.5 rounded-xl font-bold text-base border transition-all ${filters.status.includes(stage) ? activeClass : 'bg-white border-slate-300 text-slate-700 hover:border-[#EBA7FF]/50 hover:bg-[#EBA7FF]/10 shadow-sm'}`}>
                          {filters.status.includes(stage) && '✓ '}{stage === '—' ? 'Pending (—)' : stage}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto relative rounded-2xl border border-slate-300 bg-white shadow-md">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-wider">
                    <th className="py-6 px-6"><span className="flex items-center">Date <SortBtn col="date" /></span></th>
                    <th className="py-6 px-6 w-96"><span className="flex items-center">Requirement <SortBtn col="requirement" /></span></th>
                    <th className="py-6 px-6"><span className="flex items-center">Client Info <SortBtn col="name" /></span></th>
                    <th className="py-6 px-6"><span className="flex items-center">Location <SortBtn col="location" /></span></th>
                    <th className="py-6 px-6"><span className="flex items-center">Qualify Status <SortBtn col="status" /></span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {processedLeads.length > 0 ? (
                    processedLeads.map((lead, idx) => (
                      <tr key={lead.id} className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-[#EBA7FF]/10`}>
                        <td className="py-5 px-6 text-slate-900 font-mono font-bold text-sm whitespace-nowrap">{lead.date}</td>
                        <td className="py-5 px-6 text-slate-800 font-medium text-base max-w-xs truncate" title={lead.requirement}>{lead.requirement}</td>
                        <td className="py-5 px-6">
                          <div className="text-slate-900 font-black text-lg">{lead.name}</div>
                          <div className="text-slate-600 text-sm font-bold mt-1">{lead.company || '—'} | <span className="text-blue-700">{lead.phone}</span></div>
                        </td>
                        <td className="py-5 px-6 text-slate-700 text-base font-medium">{lead.location}</td>
                        <td className="py-5 px-6">
                          <select 
                            value={lead.status || '—'}
                            disabled={lead.status === "🔒 Synced"}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                            className={`border px-4 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest focus:outline-none transition-shadow shadow-sm cursor-pointer ${
                              lead.status === '✅ Qualified' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:ring-2 focus:ring-emerald-200' : 
                              lead.status === '❌ Not Qualified' ? 'bg-rose-50 border-rose-300 text-rose-800 focus:ring-2 focus:ring-rose-200' : 
                              lead.status === '🔒 Synced' ? 'bg-blue-50 border-blue-200 text-blue-700 opacity-70 cursor-not-allowed' :
                              'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                            }`}
                          >
                            <option value="—">— Pending —</option>
                            <option value="✅ Qualified">✅ Qualified</option>
                            <option value="❌ Not Qualified">❌ Not Qualified</option>
                            {lead.status === "🔒 Synced" && <option value="🔒 Synced">🔒 Synced</option>}
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-20 text-center text-slate-500 font-bold text-xl uppercase tracking-widest">
                        No leads match your current search/filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="flex justify-between items-center px-8 py-5 bg-slate-100 border-t-2 border-slate-300 rounded-b-2xl font-bold text-sm text-slate-600">
                <span>Showing <strong className="text-slate-900 font-black">{processedLeads.length}</strong> of <strong className="text-slate-900 font-black">{leads.length}</strong> loaded leads</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 border border-slate-200 p-8 rounded-3xl shadow-inner gap-6">
              <span className="font-black text-xl text-slate-700 tracking-tight">
                {qualifiedCount > 0 ? <strong className="text-emerald-600 bg-emerald-100 px-4 py-2 rounded-xl border border-emerald-200 shadow-sm">{qualifiedCount} leads ready for ingestion</strong> : "Awaiting qualification."}
              </span>
              
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <button onClick={clearSession} className="px-6 py-4 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-black text-sm tracking-widest uppercase rounded-xl transition-colors shadow-sm w-full sm:w-auto">
                  Clear Memory
                </button>
                <button 
                  onClick={handleDownloadExcel}
                  className="px-6 py-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-black text-sm tracking-widest uppercase rounded-xl transition-colors flex items-center justify-center gap-3 shadow-sm w-full sm:w-auto"
                >
                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                  Export Data
                </button>
                <button 
                  onClick={handleSendToCRM}
                  disabled={qualifiedCount === 0} 
                  className={`px-8 py-4 font-black text-base tracking-widest uppercase rounded-xl transition-all w-full sm:w-auto shadow-md ${
                    qualifiedCount > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  📥 Send to Master CRM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
