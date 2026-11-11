import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cpu,
  History,
  LayoutDashboard,
  Menu,
  Package,
  Video,
  X,
} from 'lucide-react';
import { OperationalModeInfo } from '../theme/tokens';
import { WastoMark } from './ui/WastoMark';

export type NavTabId =
  | 'overview'
  | 'classify'
  | 'monitor'
  | 'tracking'
  | 'history'
  | 'architecture';

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'classify', label: 'Classify', icon: Camera },
  { id: 'monitor', label: 'Live monitor', icon: Video },
  { id: 'tracking', label: 'Waste tracking', icon: Package },
  { id: 'history', label: 'History', icon: History },
];

const SECONDARY_NAV: NavItem[] = [
  { id: 'architecture', label: 'Model & system', icon: Cpu },
];

const ALL_NAV_ITEMS = [...PRIMARY_NAV, ...SECONDARY_NAV];

const TOPBAR_DOT: Record<OperationalModeInfo['tone'], string> = {
  primary: 'bg-[#245C3B]',
  info: 'bg-[#315E8B]',
  warning: 'bg-[#8A570B]',
  error: 'bg-[#B33D35]',
  neutral: 'bg-[#526158]',
};

const TOPBAR_PILL: Record<OperationalModeInfo['tone'], string> = {
  primary: 'bg-[#E5EFE4] text-[#19452B] border-[#C5DBC2]',
  info: 'bg-[#EFF5FA] text-[#23476B] border-[#C7D8EA]',
  warning: 'bg-[#FDF7EC] text-[#754909] border-[#EAD4AA]',
  error: 'bg-[#FDF2F1] text-[#962E27] border-[#EBC5C2]',
  neutral: 'bg-[#EEF2EB] text-[#526158] border-[#DCE3DA]',
};

const DRAWER_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface AppShellProps {
  currentTab: string;
  onSelectTab: (tab: NavTabId) => void;
  modeInfo: OperationalModeInfo;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  modeInfo,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const restoreTargetRef = useRef<'trigger' | 'main'>('trigger');

  const activeNav = ALL_NAV_ITEMS.find((n) => n.id === currentTab) ?? PRIMARY_NAV[0];

  const closeDrawer = (restoreTo: 'trigger' | 'main' = 'trigger') => {
    restoreTargetRef.current = restoreTo;
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (!drawerOpen) return;

    const timer = window.setTimeout(() => {
      drawerCloseRef.current?.focus();
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer('trigger');
        return;
      }

      if (event.key === 'Tab' && drawerPanelRef.current) {
        const focusables = Array.from(
          drawerPanelRef.current.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreTargetRef.current === 'main') {
        mainRef.current?.focus();
      } else {
        menuTriggerRef.current?.focus();
      }
    };
  }, [drawerOpen]);

  const handleNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    tabId: NavTabId,
    fromDrawer = false
  ) => {
    event.preventDefault();
    onSelectTab(tabId);
    if (fromDrawer) {
      closeDrawer('main');
    }
  };

  const renderNavLinks = (items: NavItem[], fromDrawer = false) =>
    items.map((item) => {
      const Icon = item.icon;
      const isActive = currentTab === item.id;
      return (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(e) => handleNavClick(e, item.id, fromDrawer)}
          aria-current={isActive ? 'page' : undefined}
          className={`flex items-center gap-3 px-3 min-h-[44px] rounded-[8px] text-[14px] transition-colors ${
            isActive
              ? 'bg-[#E5EFE4] text-[#19452B] font-semibold'
              : 'text-[#526158] font-medium hover:bg-[#EEF2EB] hover:text-[#18251D]'
          }`}
        >
          <Icon
            size={18}
            strokeWidth={1.85}
            className={isActive ? 'text-[#245C3B]' : 'text-[#526158]'}
          />
          <span>{item.label}</span>
        </a>
      );
    });

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#18251D] flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2.5 focus:rounded-[8px] focus:bg-[#245C3B] focus:text-white focus:text-[14px] focus:font-medium"
      >
        Skip to content
      </a>

      {/* Desktop Left Navigation Rail (232px) */}
      <aside
        aria-label="Primary sidebar"
        className="hidden lg:flex lg:flex-col lg:w-[232px] lg:shrink-0 bg-[#FFFFFF] border-r border-[#DCE3DA] lg:sticky lg:top-0 lg:h-screen"
      >
        <div className="px-5 pt-6 pb-5 border-b border-[#DCE3DA]">
          <a
            href="#overview"
            onClick={(e) => handleNavClick(e, 'overview', false)}
            className="inline-flex items-center rounded-[8px] focus:outline-none"
            aria-label="Wasto Overview"
          >
            <WastoMark subtitle="Sorting operations" />
          </a>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 px-3 py-4 flex flex-col justify-between overflow-y-auto"
        >
          <div className="space-y-1">{renderNavLinks(PRIMARY_NAV, false)}</div>

          <div className="pt-4 mt-4 border-t border-[#DCE3DA] space-y-1">
            {renderNavLinks(SECONDARY_NAV, false)}
          </div>
        </nav>
      </aside>

      {/* Tablet / Mobile Top Header Bar */}
      <header className="lg:hidden sticky top-0 z-40 h-16 bg-[#FFFFFF] border-b border-[#DCE3DA] px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            className="min-w-[44px] min-h-[44px] -ml-2 rounded-[8px] flex items-center justify-center text-[#18251D] hover:bg-[#EEF2EB] transition-colors shrink-0"
          >
            <Menu size={20} strokeWidth={1.9} aria-hidden="true" />
          </button>

          <a
            href="#overview"
            onClick={(e) => handleNavClick(e, 'overview', false)}
            className="inline-flex items-center gap-2 shrink-0"
            aria-label="Wasto home"
          >
            <WastoMark size="sm" showWordmark={false} />
          </a>

          <span className="text-[15px] font-semibold text-[#18251D] truncate">
            {activeNav.label}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-[12px] font-medium shrink-0 whitespace-nowrap ${TOPBAR_PILL[modeInfo.tone]}`}
          title={modeInfo.modeLabel}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${TOPBAR_DOT[modeInfo.tone]}`}
            aria-hidden="true"
          />
          <span>
            {!modeInfo.apiReachable
              ? 'Demo offline'
              : modeInfo.mlReady
                ? 'Live model'
                : 'Model offline'}
          </span>
        </span>
      </header>

      {/* Tablet / Mobile Slide-Over Drawer */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-[#18251D]/35"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeDrawer('trigger');
            }
          }}
        >
          <div
            ref={drawerPanelRef}
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="w-[272px] max-w-[85vw] h-full bg-[#FFFFFF] border-r border-[#DCE3DA] shadow-floating flex flex-col"
          >
            <div className="px-4 py-3.5 border-b border-[#DCE3DA] flex items-center justify-between gap-3">
              <WastoMark size="sm" subtitle="Sorting operations" />
              <button
                ref={drawerCloseRef}
                type="button"
                onClick={() => closeDrawer('trigger')}
                aria-label="Close navigation menu"
                className="min-w-[44px] min-h-[44px] -mr-2 rounded-[8px] flex items-center justify-center text-[#526158] hover:text-[#18251D] hover:bg-[#EEF2EB] transition-colors"
              >
                <X size={20} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </div>

            <nav
              aria-label="Mobile navigation"
              className="flex-1 px-3 py-4 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-1">{renderNavLinks(PRIMARY_NAV, true)}</div>
              <div className="pt-4 mt-4 border-t border-[#DCE3DA] space-y-1">
                {renderNavLinks(SECONDARY_NAV, true)}
              </div>
            </nav>

            <div className="px-4 py-3.5 border-t border-[#DCE3DA] bg-[#F7F8F4]">
              <p className="text-[12px] font-medium text-[#18251D]">
                {modeInfo.modeLabel}
              </p>
              <p className="text-[12px] text-[#526158] mt-0.5">
                {modeInfo.inferenceSummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-[1240px] mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8 focus:outline-none"
        >
          {children}
        </main>

        <footer className="border-t border-[#DCE3DA] bg-[#FFFFFF]/60">
          <div className="max-w-[1240px] mx-auto px-4 py-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13px] text-[#526158]">
            <span>Wasto — Waste classification and sorting operations</span>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#overview"
                onClick={(e) => handleNavClick(e, 'overview', false)}
                className="hover:text-[#18251D] transition-colors"
              >
                Overview
              </a>
              <a
                href="#classify"
                onClick={(e) => handleNavClick(e, 'classify', false)}
                className="hover:text-[#18251D] transition-colors"
              >
                Classify
              </a>
              <a
                href="#architecture"
                onClick={(e) => handleNavClick(e, 'architecture', false)}
                className="hover:text-[#18251D] transition-colors"
              >
                Model & system
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
