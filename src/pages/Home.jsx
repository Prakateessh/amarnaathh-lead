import React from 'react';
import { useNavigate } from 'react-router-dom';

// 1. Import your local assets here
import indiamartLogo from '../assets/icons/indiamart.png';
import tradeindiaLogo from '../assets/icons/tradeindia.png';
import wixLogo from '../assets/icons/amarnaathh.png';
import alibabaLogo from '../assets/icons/alibaba.png';

export default function Home() {
  const navigate = useNavigate();

  // 2. Map the imported local variables to the image sources
  const dataSources = [
    {
      name: 'IndiaMart',
      path: '/indiamart',
      icon: (
        <img 
          src={indiamartLogo} 
          alt="IndiaMart Logo" 
          className="w-10 h-10 object-contain rounded-md shadow-[0_0_10px_rgba(255,255,255,0.1)]"
        />
      ),
    },
    {
      name: 'TradeIndia',
      path: '/tradeindia',
      icon: (
        <img 
          src={tradeindiaLogo} 
          alt="TradeIndia Logo" 
          className="w-10 h-10 object-contain rounded-md shadow-[0_0_10px_rgba(255,255,255,0.1)]"
        />
      ),
    },
    {
      name: 'Website',
      path: '/wix',
      icon: (
        <img 
          src={wixLogo} 
          alt="Wix Logo" 
          className="w-10 h-10 object-contain rounded-md shadow-[0_0_10px_rgba(255,255,255,0.1)]"
        />
      ),
    },
    {
      name: 'Alibaba',
      path: '/alibaba',
      icon: (
        <img 
          src={alibabaLogo} 
          alt="Alibaba Logo" 
          className="w-10 h-10 object-contain rounded-md shadow-[0_0_10px_rgba(255,255,255,0.1)]"
        />
      ),
    },
    {
      name: 'Manual Entry',
      path: '/manual',
      // We keep the SVG here since it's an action, not a company
      icon: (
        <svg className="w-10 h-10 text-secondary group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
    }
  ];

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-start py-20 px-4 relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-glow/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Navbar / Logout */}
      <div className="absolute top-0 w-full p-6 flex justify-end z-20 max-w-[1440px]">
        <button 
          onClick={() => navigate('/')}
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

        {/* Section 3: The Database Button (Distinct Style) */}
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
    </div>
  );
}
