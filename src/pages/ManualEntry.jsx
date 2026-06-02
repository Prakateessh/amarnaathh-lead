import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx'; 

// ── DATE FORMATTING UTILITY ────────────────────────────────────────────────
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
};

export default function ManualEntry() {
  const navigate = useNavigate();

  // 1. React State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    requirement: '',
    name: '',
    company: '',
    phone: '',
    location: '',
    price: '',
    notes: '',
    source: 'Manual Entry', // Default
  });

  const [noteUser, setNoteUser] = useState('Ritthik Kumar');
  const users = ['Ritthik Kumar', 'Soundararajan B', 'Business Management Executive (BME)'];

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for the Data Viewer
  const [manualLeads, setManualLeads] = useState([]);
  const [isFetching, setIsFetching] = useState(true);

  // 2. Fetch Manually Added Leads on Load
  useEffect(() => {
    fetchManualLeads();
  }, []);

  const fetchManualLeads = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('source', ['Website', 'YouTube', 'LinkedIn', 'Direct', 'Referral','IndiaMart' , 'TradeIndia'])
        .order('created_at', { ascending: false })
        .limit(10); // 🚨 STRICTLY LIMIT TO LAST 10

      if (error) throw error;
      setManualLeads(data || []);
    } catch (error) {
      console.error("Error fetching manual leads:", error.message);
    } finally {
      setIsFetching(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setStatus({ type: '', message: '' }); 
  };

  // 3. Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.requirement) {
      setStatus({ type: 'error', message: '⚠️ Please fill out both Client Name and Requirement.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      let formattedNotes = null;
      if (formData.notes.trim() !== '') {
        // Format exactly like the LeadManager parser expects: [YYYY-MM-DD HH:MM] [User]
        const now = new Date();
        const ts = `[${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}]`;
        formattedNotes = `${ts} [${noteUser}] ${formData.notes.trim()}`;
      }

      const { error } = await supabase
        .from('leads')
        .insert([
          {
            date: formData.date,
            requirement: formData.requirement,
            name: formData.name,
            company_name: formData.company,
            phone: formData.phone,
            location: formData.location,
            price: Number(formData.price) || 0,
            source: formData.source, 
            notes: formattedNotes,
            status: 'New',
            lead_temp: 'Cold'
          }
        ]);

      if (error) throw error;
      
      setStatus({ 
        type: 'success', 
        message: `✅ Lead for ${formData.name} saved to CRM successfully!` 
      });

      // Clear form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        requirement: '', name: '', company: '', phone: '', location: '', price: '', notes: '', source: ''
      });

      // Instantly refresh the table below
      fetchManualLeads();

    } catch (error) {
      console.error("Supabase Error:", error.message);
      setStatus({ 
        type: 'error', 
        message: `❌ Failed to save lead: ${error.message}` 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Excel Export Function
  const handleDownloadExcel = () => {
    if (manualLeads.length === 0) return;

    const excelData = manualLeads.map(lead => ({
      'Date': formatDisplayDate(lead.date),
      'Source': lead.source || '',
      'Client Name': lead.name || '',
      'Company': lead.company_name || '',
      'Phone': lead.phone || '',
      'Location': lead.location || '',
      'Requirement': lead.requirement || '',
      'Value (₹)': Number(lead.price) || 0,
      'Status': lead.status || 'New',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [ { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 } ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Manual Leads");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Manual_Leads_Export_${today}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden font-sans">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation Bar */}
      <div className="w-full max-w-[95%] xl:max-w-6xl flex justify-between items-center mb-8 relative z-10">
        <button 
          onClick={() => navigate('/home')}
          className="text-slate-600 hover:text-purple-900 font-black text-base uppercase tracking-widest transition-colors flex items-center gap-3 bg-white px-6 py-4 rounded-xl border border-slate-300 shadow-sm hover:shadow-md"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Routing
        </button>
        <span className="font-black text-base text-purple-900 tracking-widest uppercase flex items-center gap-3 bg-[#EBA7FF]/30 px-7 py-4 rounded-xl border border-[#EBA7FF]/60 shadow-sm">
          Manual Ingestion Node
        </span>
      </div>

      {/* Main Form Container */}
      <div className="bg-white w-full max-w-[95%] xl:max-w-6xl p-10 relative z-10 flex flex-col gap-8 shadow-2xl shadow-slate-200/60 rounded-3xl border border-slate-300 mb-10">
        
        {/* Header */}
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">Manual Lead Entry</h1>
          <p className="text-slate-500 font-medium text-lg mt-3">
            Manually ingest a new lead into the primary CRM database.
          </p>
        </div>

        {/* Status Messages */}
        {status.message && (
          <div className={`px-6 py-4 rounded-xl font-bold text-sm tracking-widest uppercase shadow-sm border ${
            status.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Lead Source</label>
              <select 
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm cursor-pointer"
              >
                <option value="Website">🌐 Website Inquiry</option>
                <option value="YouTube">📺 YouTube</option>
                <option value="LinkedIn">💼 LinkedIn</option>
                <option value="Direct">📞 Direct Call / Walk-in</option>
                <option value="Referral">🤝 Referral</option>
                <option value="IndiaMart">🛒 IndiaMart</option>
                <option value="TradeIndia">📦 TradeIndia</option>
              </select>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">Added By</label>
              <select value={noteUser} onChange={e => setNoteUser(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm cursor-pointer">
                {users.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">📅 Date</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-mono font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm cursor-pointer" />
            </div>
            
            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">📦 Requirement / Product *</label>
              <input type="text" name="requirement" value={formData.requirement} onChange={handleChange} placeholder="e.g., Surgical cotton roll machine" 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-medium text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm" />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">👤 Client Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., John Doe" 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm" />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">🏢 Company Name</label>
              <input type="text" name="company" value={formData.company} onChange={handleChange} placeholder="e.g., ABC Healthcare" 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-medium text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm" />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">📞 Phone / WhatsApp</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g., +91 98765 43210" 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-mono font-bold text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm" />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">📍 Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Coimbatore, Tamil Nadu" 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-medium text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm" />
            </div>
            
            <div className="flex flex-col gap-2.5 md:col-span-2">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">💰 Quoted Product Price (₹)</label>
              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl overflow-hidden focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-300 transition-all shadow-sm">
                <span className="px-5 text-emerald-700 font-mono font-black text-xl border-r border-slate-200 py-4">₹</span>
                <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="e.g., 500000" min="0" 
                  className="flex-1 bg-transparent py-4 px-4 text-slate-900 font-mono font-black text-xl focus:outline-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 md:col-span-2">
              <label className="font-bold text-sm text-slate-500 uppercase tracking-widest">📝 Initial Notes / Status</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g., Client requested the full machine catalog. Follow up next week." rows="4" 
                className="bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-medium text-lg focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-all shadow-sm resize-none leading-relaxed" />
            </div>

          </div>

          <div className="pt-6 border-t border-slate-200 mt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full py-5 font-black text-xl tracking-widest uppercase rounded-2xl transition-all duration-300 shadow-md ${
                isSubmitting 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white hover:shadow-[0_0_20px_rgba(235,167,255,0.6)]'
              }`}
            >
              {isSubmitting ? '⏳ Transmitting Data...' : '💾 Save Lead to CRM'}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================== */}
      {/* DATA VIEWER FOR MANUAL LEADS             */}
      {/* ========================================== */}
      <div className="bg-white w-full max-w-[95%] xl:max-w-6xl p-10 relative z-10 flex flex-col gap-6 shadow-2xl shadow-slate-200/60 rounded-3xl border border-slate-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-6 gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recent Additions</h2>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-2">Showing last 10 manually ingested leads</p>
          </div>
          
          <button 
            onClick={handleDownloadExcel}
            disabled={manualLeads.length === 0}
            className={`border px-6 py-3 font-black text-xs tracking-widest uppercase rounded-xl transition-colors flex items-center gap-3 shadow-sm ${
              manualLeads.length === 0 
                ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-purple-900 hover:border-purple-300'
            }`}
          >
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Export to Excel
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm mt-2">
          {isFetching ? (
            <div className="py-20 text-center text-slate-500 font-bold tracking-widest text-lg uppercase animate-pulse">LOADING LEADS...</div>
          ) : manualLeads.length === 0 ? (
            <div className="py-20 text-center text-slate-500 font-bold tracking-widest text-lg uppercase">No manual leads found. Add one above!</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-600 font-black text-xs uppercase tracking-wider">
                  <th className="py-5 px-6">Date & Source</th>
                  <th className="py-5 px-6">Client Info</th>
                  <th className="py-5 px-6">Requirement</th>
                  <th className="py-5 px-6 text-right">Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {manualLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#EBA7FF]/10 transition-colors group">
                    <td className="py-5 px-6 whitespace-nowrap">
                      <div className="text-slate-900 font-bold text-sm">{formatDisplayDate(lead.date)}</div>
                      <div className="mt-1.5 text-[10px] font-black uppercase tracking-widest inline-block px-2.5 py-1 rounded-md border border-purple-200 text-purple-800 bg-purple-50 shadow-sm">
                        {lead.source}
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="text-slate-900 font-black text-base">{lead.name}</div>
                      <div className="text-slate-500 font-bold text-sm mt-1">{lead.company_name || '—'} | <span className="text-blue-600">{lead.phone}</span></div>
                    </td>
                    <td className="py-5 px-6 text-slate-700 font-medium text-sm max-w-xs truncate" title={lead.requirement}>
                      {lead.requirement || <span className="italic text-slate-400">None provided</span>}
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="text-emerald-700 font-black text-lg tabular-nums">
                        ₹{Number(lead.price || 0).toLocaleString('en-IN')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
