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

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

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

  return (
    <div className="min-h-screen bg-surface-900 text-gray-100 flex flex-col font-sans selection:bg-wasto-500 selection:text-surface-900">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        apiStatus={apiHealth}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'overview' && (
          <OverviewView
            summary={summary}
            onNavigate={setCurrentTab}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white tracking-wider">WASTO</span>
            <span>—</span>
            <span>Automated Waste Segregation & Source Tracking</span>
          </div>
          <div className="flex items-center space-x-4 text-gray-500 font-mono">
            <span>Model: MobileNetV3Large</span>
            <span>•</span>
            <span>Firmware: v1.0</span>
            <span>•</span>
            <span>&copy; {new Date().getFullYear()} Wasto</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
