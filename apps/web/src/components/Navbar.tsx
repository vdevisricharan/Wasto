import React from 'react';
import { Activity, Camera, Layers, History, Cpu, Truck, CheckCircle2, AlertCircle } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  apiStatus: {
    status: string;
    ml_model_ready?: boolean;
    hardware_adapter?: { mode: string; state: string; armed: boolean };
  } | null;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, apiStatus }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'classify', label: 'Classify', icon: Layers },
    { id: 'monitor', label: 'Live Monitor', icon: Camera },
    { id: 'tracking', label: 'Waste Tracking', icon: Truck },
    { id: 'history', label: 'History', icon: History },
    { id: 'architecture', label: 'Model & Architecture', icon: Cpu },
  ];

  const isModelReady = apiStatus?.ml_model_ready ?? false;
  const hwMode = apiStatus?.hardware_adapter?.mode || 'SIMULATED';

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-gray-800 bg-surface-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('overview')}>
            <div className="w-9 h-9 rounded-xl bg-wasto-500/20 border border-wasto-500/40 flex items-center justify-center p-1.5 shadow-lg shadow-wasto-500/10">
              <img src="/logo.png" alt="Wasto Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                WASTO <span className="text-xs px-2 py-0.5 rounded-full bg-wasto-500/10 text-wasto-400 border border-wasto-500/20 font-mono">v1.0</span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-wasto-500/15 text-wasto-400 border border-wasto-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status Badges */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono px-2.5 py-1 rounded-md bg-surface-800 border border-gray-700">
              <span className="text-gray-400">HW:</span>
              <span className={hwMode === 'PHYSICAL' ? 'text-blue-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {hwMode}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 text-xs font-mono px-2.5 py-1 rounded-md bg-surface-800 border border-gray-700">
              {isModelReady ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-wasto-400 animate-pulse"></span>
                  <span className="text-wasto-400">ML READY</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span className="text-yellow-400">DEMO MODE</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex overflow-x-auto py-2 px-4 space-x-2 border-t border-gray-800 bg-surface-900/95 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-wasto-500/20 text-wasto-400 border border-wasto-500/30'
                  : 'text-gray-400 hover:text-gray-200 bg-surface-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
