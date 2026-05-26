import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [credentials, setCredentials] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for the eye toggle
  const navigate = useNavigate();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Hardcoded Authentication Check
    if (credentials.name === 'Amarnaathh' && credentials.password === '123') {
      console.log('Authentication Successful');
      navigate('/home'); 
    } else {
      setError('Invalid Name or Passcode. Access Denied.');
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-glow/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="glass-modal w-full max-w-md p-8 relative z-10 flex flex-col gap-8 shadow-2xl">
    
        {/* Header Section with Logo */}
        <div className="text-center space-y-2 flex flex-col items-center">
            <div className="w-16 h-16 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 mb-2 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            </div>
          <h1 className="font-sans text-3xl font-bold text-white tracking-tight">
            Amarnaathh Engineering
          </h1>
          <p className="font-sans text-onSurfaceVariant text-sm">
            Authenticate to access the CRM Portal.
          </p>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-md font-mono text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Name Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="font-mono text-xs text-secondary tracking-widest uppercase font-medium">
              YOUR NAME 
            </label>
            <input
              id="name"
              name="name" 
              type="text" 
              required
              value={credentials.name} 
              onChange={handleChange}
              placeholder=""
              className="bg-white/5 border-b border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all rounded-t-sm"
            />
          </div>

          {/* Passcode Input with Eye Toggle */}
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="font-mono text-xs text-secondary tracking-widest uppercase font-medium">
              Security Passcode
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"} // Dynamically changes type
                required
                value={credentials.password}
                onChange={handleChange}
                placeholder=""
                className="w-full bg-white/5 border-b border-white/20 px-4 py-3 pr-12 text-white font-mono focus:outline-none focus:border-primary focus:bg-white/10 transition-all rounded-t-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-secondary hover:text-primary transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  // Eye Slash Icon (Hide)
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  // Normal Eye Icon (Show)
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Actions & Status */}
          <div className="pt-4 flex flex-col gap-6">
            <button type="submit" className="btn-primary w-full py-3 font-mono text-sm tracking-widest uppercase">
              Log In
            </button>
            
            <div className="flex justify-between items-center font-mono text-xs text-secondary">
              <button type="button" className="hover:text-primary transition-colors">
                Recover Access
              </button>
              
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
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
