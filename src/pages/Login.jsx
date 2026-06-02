import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [credentials, setCredentials] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Normalize input to prevent capitalization errors (e.g., "admin" vs "Admin")
    const username = credentials.name.trim().toLowerCase();
    const password = credentials.password;
    
    // 🛑 ROLE-BASED AUTHENTICATION
    if (username === 'admin' && password === 'admin123') {
      // 1. Log the Admin In
      localStorage.setItem('isLoggedIn', 'true');
      // 2. Save their specific Role (We will use this later to show everything)
      localStorage.setItem('userRole', 'Admin');
      navigate('/home'); 

    } else if (username === 'bme' && password === 'bme123') {
      // 1. Log the BME In
      localStorage.setItem('isLoggedIn', 'true');
      // 2. Save their specific Role (We will use this later to hide things)
      localStorage.setItem('userRole', 'BME');
      navigate('/home');

    } else {
      setError('Invalid Name or Passcode. Access Denied.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows (Updated to Light Theme) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#EBA7FF]/30 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-10 relative z-10 flex flex-col gap-8 shadow-2xl shadow-slate-200/50">
    
        {/* Header Section with Logo */}
        <div className="text-center space-y-3 flex flex-col items-center">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center border border-purple-100 mb-2 shadow-inner">
                <svg className="w-10 h-10 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Amarnaathh Eng.
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            Authenticate to access the CRM Portal.
          </p>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl font-bold text-sm text-center shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Name Input */}
          <div className="flex flex-col gap-2.5">
            <label htmlFor="name" className="font-bold text-xs text-slate-500 tracking-widest uppercase">
              Your Name / Role 
            </label>
            <input
              id="name"
              name="name" 
              type="text" 
              required
              value={credentials.name} 
              onChange={handleChange}
              placeholder="e.g. Admin or BME"
              className="w-full bg-white border border-slate-300 rounded-xl px-5 py-4 text-slate-900 font-bold text-base focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-shadow shadow-sm"
            />
          </div>

          {/* Passcode Input with Eye Toggle */}
          <div className="flex flex-col gap-2.5">
            <label htmlFor="password" className="font-bold text-xs text-slate-500 tracking-widest uppercase">
              Security Passcode
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"} 
                required
                value={credentials.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-300 rounded-xl px-5 py-4 pr-14 text-slate-900 font-bold text-base focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-[#EBA7FF] transition-shadow shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-slate-400 hover:text-purple-600 transition-colors focus:outline-none bg-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Actions & Status */}
          <div className="pt-5 flex flex-col gap-6">
            <button type="submit" className="w-full bg-purple-900 hover:bg-[#EBA7FF] hover:text-purple-950 text-white font-black text-sm tracking-widest uppercase py-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(235,167,255,0.4)]">
              Log In
            </button>
            
            <div className="flex justify-between items-center font-bold text-xs text-slate-500 uppercase tracking-wider">
              <button type="button" className="hover:text-purple-700 transition-colors">
                Recover Access
              </button>
              
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>Grid: Online</span>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
