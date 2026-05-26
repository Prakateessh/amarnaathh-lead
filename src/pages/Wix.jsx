import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PlaceholderPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
      <div className="glass-modal p-12 text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Module Under Development</h1>
        <p className="text-secondary mb-8">This portal integration is currently being wired up.</p>
        
        <button 
          onClick={() => navigate('/home')}
          className="w-full bg-white/10 hover:bg-white/20 text-white font-mono py-3 rounded transition-colors"
        >
          ← BACK TO HOME
        </button>
      </div>
    </div>
  );
}