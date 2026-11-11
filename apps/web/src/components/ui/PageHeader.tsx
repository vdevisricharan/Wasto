import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { OperationalModeInfo } from '../../theme/tokens';

interface PageHeaderProps {
  title: string;
  description: string;
  modeInfo: OperationalModeInfo;
  actions?: React.ReactNode;
  actionsBelow?: boolean;
}

const MODE_BADGE_CLASSES: Record<OperationalModeInfo['tone'], string> = {
  primary: 'bg-[#E5EFE4] text-[#19452B] border-[#C5DBC2]',
  info: 'bg-[#EFF5FA] text-[#23476B] border-[#C7D8EA]',
  warning: 'bg-[#FDF7EC] text-[#754909] border-[#EAD4AA]',
  error: 'bg-[#FDF2F1] text-[#962E27] border-[#EBC5C2]',
  neutral: 'bg-[#EEF2EB] text-[#526158] border-[#DCE3DA]',
};

const MODE_DOT_CLASSES: Record<OperationalModeInfo['tone'], string> = {
  primary: 'bg-[#245C3B]',
  info: 'bg-[#315E8B]',
  warning: 'bg-[#8A570B]',
  error: 'bg-[#B33D35]',
  neutral: 'bg-[#526158]',
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  modeInfo,
  actions,
  actionsBelow = false,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!detailsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDetailsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setDetailsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [detailsOpen]);

  return (
    <header className="pb-6 mb-6 border-b border-[#DCE3DA]">
      <div
        className={`flex flex-col gap-4 ${
          actionsBelow
            ? ''
            : 'lg:flex-row lg:items-end lg:justify-between'
        }`}
      >
        <div
          className={`min-w-0 ${
            actionsBelow ? 'max-w-[820px]' : 'max-w-[740px]'
          }`}
        >
          <div className="relative inline-block mb-3" ref={popoverRef}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 min-h-[34px] py-1 rounded-[8px] border text-[12px] sm:text-[13px] font-medium text-left transition-colors hover:brightness-95 max-w-full ${MODE_BADGE_CLASSES[modeInfo.tone]}`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${MODE_DOT_CLASSES[modeInfo.tone]}`}
                aria-hidden="true"
              />
              <span className="truncate">{modeInfo.modeLabel}</span>
              <span className="inline-flex items-center gap-0.5 opacity-80 text-[11.5px] sm:text-[12px] border-l border-current/25 pl-1.5 sm:pl-2 shrink-0">
                <Info size={13} strokeWidth={1.85} aria-hidden="true" />
                <span>Details</span>
                <ChevronDown
                  size={13}
                  strokeWidth={1.85}
                  className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {detailsOpen && (
              <div
                id={panelId}
                role="region"
                aria-label="System operational details"
                className="absolute left-0 top-full mt-2 w-[300px] sm:w-[380px] z-30 bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] shadow-floating p-4 text-left"
              >
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#DCE3DA]">
                  <p className="text-[14px] font-semibold text-[#18251D]">
                    Runtime configuration
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className="text-[12px] font-medium text-[#526158] hover:text-[#18251D] px-2 py-1 rounded-[6px] hover:bg-[#EEF2EB]"
                  >
                    Close
                  </button>
                </div>

                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#526158]">Classification</dt>
                    <dd className="font-medium text-[#18251D] text-right">
                      {modeInfo.inferenceSummary}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#526158]">Hardware</dt>
                    <dd className="font-medium text-[#18251D] text-right">
                      {modeInfo.hardwareSummary}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#526158]">API & storage</dt>
                    <dd className="font-medium text-[#18251D] text-right">
                      {modeInfo.apiSummary}
                    </dd>
                  </div>
                </dl>

                <p className="text-[12px] leading-[1.5] text-[#526158] mt-3 pt-2.5 border-t border-[#DCE3DA]">
                  {modeInfo.explanation}
                </p>
              </div>
            )}
          </div>

          <h1 className="text-[28px] sm:text-[36px] lg:text-[40px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#18251D]">
            {title}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-[#526158] leading-[1.55] mt-2">
            {description}
          </p>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
};
