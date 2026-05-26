import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 1. Import your database connection

export default function ManualEntry() {
  const navigate = useNavigate();

  // React State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    requirement: '',
    name: '',
    company: '',
    phone: '',
    location: '',
    price: '',
    notes: '', // Track the notes field
  });

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false); // 2. Track network request

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setStatus({ type: '', message: '' }); 
  };

  // 3. Upgraded to use Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.requirement) {
      setStatus({ type: 'error', message: '⚠️ Please fill out both Client Name and Requirement.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      // Automatically inject timestamp into the note if one exists
      let formattedNotes = null;
      if (formData.notes.trim() !== '') {
        const timestamp = new Date().toLocaleString('en-IN', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        });
        formattedNotes = `[${timestamp}] ${formData.notes}`;
      }

      // Supabase Insert Command
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
            source: "Manual Entry",
            notes: formattedNotes 
          }
        ]);

      // If Supabase throws an error, catch it
      if (error) throw error;
      
      // Success UI
      setStatus({ 
        type: 'success', 
        message: `✅ Lead for ${formData.name} saved to CRM successfully!` 
      });

      // Clear form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        requirement: '', name: '', company: '', phone: '', location: '', price: '', notes: ''
      });

    } catch (error) {
      console.error("Supabase Error:", error.message);
      setStatus({ 
        type: 'error', 
        message: `❌ Failed to save lead: ${error.message}` 
      });
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center py-12 px-4 relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Navigation Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 relative z-10">
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
      <div className="glass-modal w-full max-w-4xl p-8 md:p-10 relative z-10 flex flex-col gap-8 shadow-2xl">
        
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
          
          {/* 2-Column Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
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
    </div>
  );
}