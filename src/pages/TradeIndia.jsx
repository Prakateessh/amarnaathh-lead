import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function TradeIndia() {
  const navigate = useNavigate();

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [dates, setDates] = useState({
    start: yesterday.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  });

  const [leads, setLeads] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // EXTRACTION PROTOCOL (TradeIndia Endpoint)
  const handleFetch = async () => {
    if (new Date(dates.start) > new Date(dates.end)) {
      setStatus({ type: 'error', message: '⚠️ Start Date cannot be after End Date.' });
      return;
    }

    setIsFetching(true);
    setStatus({ type: '', message: '' });

    try {
      // 🔌 Pinging the NEW TradeIndia Endpoint
      const response = await fetch(`https://python-backend-tdjw.onrender.com/api/scrape/tradeindia?start=${dates.start}&end=${dates.end}`);
      
      if (!response.ok) {
        throw new Error(`Server Error: ${response.status}`);
      }

      const result = await response.json();
      
      setLeads(result.data);
      setStatus({ type: 'success', message: `✅ Successfully extracted ${result.total} leads from TradeIndia.` });
      
    } catch (error) {
      console.error("Fetch Error:", error);
      setStatus({ type: 'error', message: '❌ Failed to connect to Python server. Is Uvicorn running?' });
    } finally {
      setIsFetching(false);
    }
  };

  const updateLeadStatus = (id, newStatus) => {
    setLeads(leads.map(lead => lead.id === id ? { ...lead, status: newStatus } : lead));
  };

  // INGESTION PROTOCOL
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
        source: "TradeIndia", // Marks the source for Master DB sorting
        notes: "[System] Auto-imported via TradeIndia API Integration."
      }));

      const { error } = await supabase.from('leads').insert(payload);

      if (error) throw error;

      setStatus({ type: 'success', message: `✅ ${qualifiedLeads.length} leads successfully injected into Master CRM!` });
      setLeads(leads.map(l => l.status === "✅ Qualified" ? { ...l, status: "🔒 Synced" } : l));

    } catch (error) {
      setStatus({ type: 'error', message: `❌ Failed to save to CRM: ${error.message}` });
    }
  };

  const qualifiedCount = leads.filter(l => l.status === "✅ Qualified").length;

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      
      {/* Orange/Amber Background Glow for TradeIndia */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Navigation */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-8 relative z-10">
        <button onClick={() => navigate('/home')} className="text-secondary hover:text-amber-400 font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Routing
        </button>
        <span className="font-mono text-xs text-amber-500 tracking-widest uppercase flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /></svg>
          TradeIndia Integration
        </span>
      </div>

      <div className="glass-modal w-full max-w-6xl p-8 relative z-10 flex flex-col gap-8 shadow-2xl border-t border-amber-500/20">
        
        {/* Header & Date Pickers */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-end gap-6">
          <div>
            <h1 className="text-3xl font-sans font-bold text-white tracking-tight">TradeIndia Extraction</h1>
            <p className="text-onSurfaceVariant text-sm mt-2">Pull inbound requests directly from the TradeIndia vendor API.</p>
          </div>
          
          <div className="flex items-end gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">Start Date</label>
              <input type="date" value={dates.start} onChange={(e) => setDates({...dates, start: e.target.value})} className="bg-white/5 border border-white/20 px-3 py-2 rounded text-white font-mono focus:border-amber-500 focus:outline-none" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">End Date</label>
              <input type="date" value={dates.end} onChange={(e) => setDates({...dates, end: e.target.value})} className="bg-white/5 border border-white/20 px-3 py-2 rounded text-white font-mono focus:border-amber-500 focus:outline-none" />
            </div>
            <button onClick={handleFetch} disabled={isFetching} className={`h-[42px] px-6 font-mono text-sm tracking-widest uppercase rounded transition-colors ${isFetching ? 'bg-surface-bright text-secondary cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
              {isFetching ? 'Fetching...' : 'Initialize'}
            </button>
          </div>
        </div>

        {status.message && (
          <div className={`px-4 py-3 rounded-md font-mono text-sm border ${status.type === 'error' ? 'bg-red-900/50 border-red-500/50 text-red-200' : 'bg-amber-900/50 border-amber-500/50 text-amber-200'}`}>
            {status.message}
          </div>
        )}

        {/* Data Processing Grid */}
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
                          value={lead.status}
                          disabled={lead.status === "🔒 Synced"}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className={`bg-navy border px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-amber-500 ${
                            lead.status === '✅ Qualified' ? 'border-green-500 text-green-400' : 
                            lead.status === '❌ Not Qualified' ? 'border-red-500 text-red-400' : 
                            lead.status === '🔒 Synced' ? 'border-amber-500 text-amber-400 opacity-70 cursor-not-allowed' :
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

            {/* Action Bar */}
            <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-lg mt-2">
              <span className="font-mono text-sm text-secondary">
                {qualifiedCount > 0 ? <strong className="text-green-400">{qualifiedCount} leads ready for ingestion.</strong> : "Awaiting qualification."}
              </span>
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
        )}
      </div>
    </div>
  );
}
