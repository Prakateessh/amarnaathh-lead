import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx'; // 📦 IMPORT THE EXCEL LIBRARY

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
    source: 'Website', // NEW: Default source
  });

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // NEW: State for the Data Viewer
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
        // Only fetch leads that are from our manual sources (ignoring IndiaMart/TradeIndia)
        .in('source', ['Website', 'YouTube', 'LinkedIn', 'Direct', 'Manual Entry'])
        .order('created_at', { ascending: false });

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
        const timestamp = new Date().toLocaleString('en-IN', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        });
        formattedNotes = `[${timestamp}] ${formData.notes}`;
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
            source: formData.source, // NEW: Dynamically pull from dropdown
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
        requirement: '', name: '', company: '', phone: '', location: '', price: '', notes: '', source: 'Website'
      });

      // NEW: Instantly refresh the table below!
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
      'Date': lead.date || '',
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
    const columnWidths = [
      { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Manual Leads");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Manual_Leads_Export_${today}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Navigation Bar */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 relative z-10">
        <button 
          onClick={() => navigate('/home')}
          className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Routing
        </button>
        <span className="font-mono text-xs text-secondary tracking-widest uppercase">
          Manual Ingestion Node
        </span>
      </div>

      {/* Main Form Container */}
      <div className="glass-modal w-full max-w-5xl p-8 md:p-10 relative z-10 flex flex-col gap-8 shadow-2xl mb-8">
        
        {/* Header */}
        <div className="border-b border-white/10 pb-6">
          <h1 className="text-3xl font-sans font-bold text-white tracking-tight">Manual Lead Entry</h1>
          <p className="text-onSurfaceVariant text-sm mt-2">
            Manually ingest a new lead into the primary CRM database.
          </p>
        </div>

        {/* Status Messages */}
        {status.message && (
          <div className={`px-4 py-3 rounded-md font-mono text-sm border ${
            status.type === 'error' ? 'bg-red-900/50 border-red-500/50 text-red-200' : 'bg-green-900/50 border-green-500/50 text-green-200'
          }`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* NEW: SOURCE DROPDOWN */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">Lead Source</label>
              <select 
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="bg-black/30 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all w-full"
              >
                <option value="Website">🌐 Website Inquiry</option>
                <option value="YouTube">📺 YouTube</option>
                <option value="LinkedIn">💼 LinkedIn</option>
                <option value="Direct">📞 Direct Call / Walk-in</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">📅 Date</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">📦 Requirement / Product *</label>
              <input type="text" name="requirement" value={formData.requirement} onChange={handleChange} placeholder="e.g., Surgical cotton roll machine" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">👤 Client Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., John Doe" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">🏢 Company Name</label>
              <input type="text" name="company" value={formData.company} onChange={handleChange} placeholder="e.g., ABC Healthcare" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">📞 Phone / WhatsApp</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g., +91 98765 43210" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">📍 Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Coimbatore, Tamil Nadu" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>
            
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">💰 Quoted Product Price (₹)</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="e.g., 500000" min="0" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all" />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-mono text-xs text-secondary tracking-widest uppercase">📝 Initial Notes / Status</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g., Client requested the full machine catalog. Follow up next week." rows="3" className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all resize-none rounded-t-sm" />
            </div>

          </div>

          <div className="pt-6 border-t border-white/10 mt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full py-4 font-mono text-base tracking-widest uppercase transition-all duration-300 ${
                isSubmitting 
                  ? 'bg-surface-bright text-secondary cursor-not-allowed rounded' 
                  : 'btn-primary'
              }`}
            >
              {isSubmitting ? '⏳ Transmitting Data...' : '💾 Save Lead to CRM'}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================== */}
      {/* NEW: DATA VIEWER FOR MANUAL LEADS          */}
      {/* ========================================== */}
      <div className="glass-modal w-full max-w-5xl p-8 relative z-10 flex flex-col gap-4 shadow-2xl">
        <div className="flex justify-between items-end border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-sans font-bold text-white tracking-tight">Manual Leads History</h2>
            <p className="text-onSurfaceVariant text-xs mt-1">Showing leads generated from Website, YouTube, LinkedIn, and Direct.</p>
          </div>
          
          <button 
            onClick={handleDownloadExcel}
            disabled={manualLeads.length === 0}
            className={`border border-white/20 px-4 py-2 text-white font-mono text-xs tracking-widest uppercase rounded transition-colors flex items-center gap-2 ${manualLeads.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/50'}`}
          >
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Export Manual Leads
          </button>
        </div>

        <div className="overflow-x-auto">
          {isFetching ? (
            <div className="py-8 text-center text-secondary font-mono text-sm">LOADING LEADS...</div>
          ) : manualLeads.length === 0 ? (
            <div className="py-8 text-center text-secondary font-mono text-sm">No manual leads found. Add one above!</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 text-secondary font-mono text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Date & Source</th>
                  <th className="py-3 px-4 font-medium">Client Info</th>
                  <th className="py-3 px-4 font-medium">Requirement</th>
                  <th className="py-3 px-4 font-medium text-right">Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {manualLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-white font-mono text-sm">{lead.date}</div>
                      <div className="mt-1 text-[9px] font-mono uppercase tracking-widest inline-block px-1 rounded border border-purple-500/30 text-purple-400 bg-purple-500/10">
                        {lead.source}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white font-medium text-sm">{lead.name}</div>
                      <div className="text-onSurfaceVariant text-xs mt-1">{lead.company_name || '—'} | {lead.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm max-w-xs truncate" title={lead.requirement}>
                      {lead.requirement}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-green-400 font-mono text-sm">
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
