import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewView } from './components/OverviewView';
import { ClassifyView } from './components/ClassifyView';
import { LiveMonitorView } from './components/LiveMonitorView';
import { WasteTrackingView } from './components/WasteTrackingView';
import { HistoryView } from './components/HistoryView';
import { ModelArchitectureView } from './components/ModelArchitectureView';
import { fetchHealth, fetchDashboardSummary } from './api/client';
import { DashboardSummary } from './types';
import { useSEO, TAB_SEO_CONFIG } from './hooks/useSEO';

const VALID_TABS = ['overview', 'classify', 'monitor', 'tracking', 'history', 'architecture'];

const getTabFromHash = (): string => {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  return VALID_TABS.includes(hash) ? hash : 'overview';
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>(() => getTabFromHash());
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  // Synchronize dynamic SEO (title, meta description, Open Graph, Twitter cards, canonical)
  useSEO(currentTab);

  const handleSelectTab = (tab: string) => {
    const target = VALID_TABS.includes(tab) ? tab : 'overview';
    setCurrentTab(target);
    if (window.location.hash !== `#${target}`) {
      window.location.hash = `#${target}`;
    }
  };

  const loadHealthAndSummary = async () => {
    try {
      const [h, s] = await Promise.all([fetchHealth(), fetchDashboardSummary()]);
      setApiHealth(h);
      setSummary(s);
    } catch (e) {
      // client fallback already provides demo defaults
    }
  };

  useEffect(() => {
    loadHealthAndSummary();
    const interval = setInterval(loadHealthAndSummary, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  // Listen for hash change (Back / Forward browser buttons, direct URL anchor navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const tab = getTabFromHash();
      setCurrentTab(tab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-surface-900 text-gray-100 flex flex-col font-sans selection:bg-wasto-500 selection:text-surface-900">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        apiStatus={apiHealth}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content">
        {currentTab === 'overview' && (
          <OverviewView
            summary={summary}
            onNavigate={handleSelectTab}
            onRefresh={loadHealthAndSummary}
          />
        )}
        {currentTab === 'classify' && <ClassifyView />}
        {currentTab === 'monitor' && <LiveMonitorView />}
        {currentTab === 'tracking' && <WasteTrackingView />}
        {currentTab === 'history' && <HistoryView />}
        {currentTab === 'architecture' && <ModelArchitectureView />}
      </main>

      <footer className="border-t border-gray-800 bg-surface-950 py-8 text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white tracking-wider">WASTO</span>
              <span>—</span>
              <span>Automated Waste Segregation & Source Tracking Platform</span>
            </div>
            {/* Sitemap Navigation Links for Search Bots & Fast Access */}
            <nav className="flex flex-wrap items-center justify-center gap-4 text-xs" aria-label="Footer Navigation">
              {VALID_TABS.map((tab) => (
                <a
                  key={tab}
                  href={`#${tab}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelectTab(tab);
                  }}
                  className="hover:text-wasto-400 capitalize transition-colors"
                >
                  {tab === 'architecture' ? 'Model Architecture' : tab}
                </a>
              ))}
            </nav>
          </div>

          <div className="border-t border-gray-800/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-gray-500 font-mono text-[11px]">
            <div className="flex items-center space-x-3">
              <span>Model: MobileNetV3Large (256x256 RGB)</span>
              <span>•</span>
              <span>Hardware: Arduino Uno R3</span>
              <span>•</span>
              <span>Actuation: 3 Chutes (45° / 90° / 135°)</span>
            </div>
            <div>
              <span>&copy; {new Date().getFullYear()} Wasto Platform • Open Source under MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
