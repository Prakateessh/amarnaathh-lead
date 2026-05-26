import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function IndiaMart() {
  const navigate = useNavigate();

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [dates, setDates] = useState({
    start: yesterday.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  });

  const [cookieString, setCookieString] = useState(localStorage.getItem('im_cookie') || "");
  const [leads, setLeads] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleCookieChange = (e) => {
    setCookieString(e.target.value);
    localStorage.setItem('im_cookie', e.target.value);
  };

  const handleFetch = async () => {
    if (!cookieString.trim()) {
      setStatus({ type: 'error', message: '⚠️ Authentication Error: Please paste your IndiaMart Cookie.' });
      return;
    }

    if (new Date(dates.start) > new Date(dates.end)) {
      setStatus({ type: 'error', message: '⚠️ Start Date cannot be after End Date.' });
      return;
    }

    setIsFetching(true);
    setStatus({ type: '', message: '' });

    try {
      // FORCE A SOLID POST TRANSMISSION
      const response = await fetch(`https://python-backend-tdjw.onrender.com/api/scrape/indiamart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: dates.start,
          end: dates.end,
          cookie_string: cookieString.trim()
        })
      });
      
      if (!response.ok) throw new Error(`Server Error: ${response.status}`);
      const result = await response.json();
      
      if (result.total === 0) {
        setStatus({ type: 'error', message: '❌ Zero leads found. Your cookie may have expired.' });
      } else {
        setLeads(result.data);
        setStatus({ type: 'success', message: `✅ Successfully extracted ${result.total} leads from IndiaMart.` });
      }
      
    } catch (error) {
      console.error("Fetch Error:", error);
      setStatus({ type: 'error', message: '❌ Connection failed. Verify backend logs or network status.' });
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
      console.error("Supabase Error:", error.message);
      setStatus({ type: 'error', message: `❌ Failed to save to CRM: ${error.message}` });
    }
  };

  const handleDownloadExcel = () => {
    if (leads.length === 0) return;

    const excelData = leads.map(lead => ({
      'Date': lead.date || '',
      'Requirement': lead.requirement || '',
      'Name': lead.name || '',
      'Company': lead.company || '',
      'Phone': lead.phone || '',
      'Location': lead.location || '',
      'Status': lead.status || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const columnWidths = [
      { wch: 12 }, { wch: 40 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IndiaMart Leads");
    XLSX.writeFile(workbook, `IndiaMart_Leads_${dates.start}_to_${dates.end}.xlsx`);
  };

  const qualifiedCount = leads.filter(l => l.status === "✅ Qualified").length;

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-6xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Routing
        </button>
        <span className="font-mono text-xs text-blue-400 tracking-widest uppercase flex items-center gap-2">
          {/* FIXED TYPO FREE GLOBAL SVG ICON */}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          IndiaMart Integration
        </span>
      </div>

      <div className="glass-modal w-full max-w-6xl p-8 relative z-10 flex flex-col gap-8 shadow-2xl">
        <div className="border-b border-white/10 pb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="w-full md:w-1/2">
              <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Data Extraction</h1>
              <p className="text-onSurfaceVariant text-sm mt-2 mb-4">Pull inbound requests directly from the IndiaMart vendor API.</p>
              
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-secondary tracking-widest uppercase">
                  Session Cookie String <span className="text-red-400">*</span>
                </label>
                <input 
                  type="password" 
                  value={cookieString} 
                  onChange={handleCookieChange}
                  placeholder="Paste raw 'cookie' string from network tab here..." 
                  className="bg-black/30 border border-white/20 px-3 py-2 rounded text-white font-mono text-xs focus:border-primary focus:outline-none w-full" 
                />
              </div>
            </div>
            
            <div className="flex items-end gap-4 w-full md:w-auto">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-secondary tracking-widest uppercase">Start Date</label>
                <input type="date" value={dates.start} onChange={(e) => setDates({...dates, start: e.target.value})} className="bg-white/5 border border-white/20 px-3 py-2 rounded text-white font-mono focus:border-primary focus:outline-none" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-secondary tracking-widest uppercase">End Date</label>
                <input type="date" value={dates.end} onChange={(e) => setDates({...dates, end: e.target.value})} className="bg-white/5 border border-white/20 px-3 py-2 rounded text-white font-mono focus:border-primary focus:outline-none" />
              </div>
              <button onClick={handleFetch} disabled={isFetching} className={`h-[42px] px-6 font-mono text-sm tracking-widest uppercase rounded transition-colors ${isFetching ? 'bg-surface-bright text-secondary cursor-not-allowed' : 'btn-primary'}`}>
                {isFetching ? 'Fetching...' : 'Initialize'}
              </button>
            </div>
          </div>
        </div>

        {status.message && (
          <div className={`px-4 py-3 rounded-md font-mono text-sm border ${status.type === 'error' ? 'bg-red-900/50 border-red-500/50 text-red-200' : 'bg-blue-900/50 border-blue-500/50 text-blue-200'}`}>
            {status.message}
          </div>
        )}

        {leads.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr className="text-secondary font-mono text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Requirement</th>
                    <th className="py-3 px-4 font-medium">Client Info</th>
                    <th className="py-3 px-4 font-medium">Location</th>
                    <th className="py-3 px-4 font-medium">Qualify Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-mono text-sm whitespace-nowrap">{lead.date}</td>
                      <td className="py-3 px-4 text-white font-medium max-w-xs truncate" title={lead.requirement}>{lead.requirement}</td>
                      <td className="py-3 px-4">
                        <div className="text-white">{lead.name}</div>
                        <div className="text-onSurfaceVariant text-xs mt-1">{lead.company || '—'} | {lead.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">{lead.location}</td>
                      <td className="py-3 px-4">
                        <select 
                          value={lead.status || '—'}
                          disabled={lead.status === "🔒 Synced"}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className={`bg-navy border px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-primary ${
                            lead.status === '✅ Qualified' ? 'border-green-500 text-green-400' : 
                            lead.status === '❌ Not Qualified' ? 'border-red-500 text-red-400' : 
                            lead.status === '🔒 Synced' ? 'border-blue-500 text-blue-400 opacity-70 cursor-not-allowed' :
                            'border-white/20 text-white'
                          }`}
                        >
                          <option value="—">— Pending —</option>
                          <option value="✅ Qualified">✅ Qualified</option>
                          <option value="❌ Not Qualified">❌ Not Qualified</option>
                          {lead.status === "🔒 Synced" && <option value="🔒 Synced">🔒 Synced</option>}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-lg mt-2">
              <span className="font-mono text-sm text-secondary">
                {qualifiedCount > 0 ? <strong className="text-green-400">{qualifiedCount} leads ready for ingestion.</strong> : "Awaiting qualification."}
              </span>
              
              <div className="flex gap-4">
                <button 
                  onClick={handleDownloadExcel}
                  className="px-6 py-2 border border-white/20 hover:border-white/50 text-white font-mono text-sm tracking-widest uppercase rounded transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                  Export Excel
                </button>

                <button 
                  onClick={handleSendToCRM}
                  disabled={qualifiedCount === 0} 
                  className={`px-6 py-2 font-mono text-sm tracking-widest uppercase rounded transition-colors ${
                    qualifiedCount > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-surface-bright text-secondary cursor-not-allowed'
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
