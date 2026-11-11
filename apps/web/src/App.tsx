import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardSummary, HealthResponse } from './types';
import { fetchDashboardSummary, fetchHealth } from './api/client';
import { deriveOperationalMode } from './theme/tokens';
import { useSEO } from './hooks/useSEO';
import { AppShell, NavTabId } from './components/AppShell';
import { OverviewView } from './components/OverviewView';
import { ClassifyView } from './components/ClassifyView';
import { LiveMonitorView } from './components/LiveMonitorView';
import { WasteTrackingView } from './components/WasteTrackingView';
import { HistoryView } from './components/HistoryView';
import { ModelArchitectureView } from './components/ModelArchitectureView';

const VALID_TABS: NavTabId[] = [
  'overview',
  'classify',
  'monitor',
  'tracking',
  'history',
  'architecture',
];

function resolveTab(raw: string): NavTabId | null {
  const normalized = raw.replace(/^#/, '').replace(/^\//, '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'system' || normalized === 'model') return 'architecture';
  if ((VALID_TABS as string[]).includes(normalized)) {
    return normalized as NavTabId;
  }
  return null;
}

function getTabFromLocation(): NavTabId {
  if (typeof window === 'undefined') return 'overview';
  const fromHash = resolveTab(window.location.hash);
  if (fromHash) return fromHash;
  const fromPath = resolveTab(window.location.pathname);
  if (fromPath) return fromPath;
  return 'overview';
}

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTabId>(() => getTabFromLocation());
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useSEO(currentTab);

  const loadSystemState = useCallback(async () => {
    const [health, sum] = await Promise.all([
      fetchHealth(),
      fetchDashboardSummary(),
    ]);
    setApiHealth(health);
    setSummary(sum);
  }, []);

  useEffect(() => {
    loadSystemState();
    const timer = window.setInterval(loadSystemState, 8000);
    return () => window.clearInterval(timer);
  }, [loadSystemState]);

  useEffect(() => {
    const onHashChange = () => {
      setCurrentTab(getTabFromLocation());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSelectTab = useCallback((tab: NavTabId) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const targetHash = `#${tab}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const modeInfo = useMemo(
    () => deriveOperationalMode(apiHealth, summary),
    [apiHealth, summary]
  );

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={handleSelectTab}
      modeInfo={modeInfo}
    >
      {currentTab === 'overview' && (
        <OverviewView
          summary={summary}
          modeInfo={modeInfo}
          onRefresh={loadSystemState}
          onNavigate={handleSelectTab}
        />
      )}
      {currentTab === 'classify' && (
        <ClassifyView
          modeInfo={modeInfo}
          onClassificationComplete={loadSystemState}
        />
      )}
      {currentTab === 'monitor' && (
        <LiveMonitorView
          modeInfo={modeInfo}
          onStatusChange={loadSystemState}
        />
      )}
      {currentTab === 'tracking' && (
        <WasteTrackingView
          modeInfo={modeInfo}
          onDataChange={loadSystemState}
        />
      )}
      {currentTab === 'history' && <HistoryView modeInfo={modeInfo} />}
      {currentTab === 'architecture' && (
        <ModelArchitectureView modeInfo={modeInfo} />
      )}
    </AppShell>
  );
};

export default App;
