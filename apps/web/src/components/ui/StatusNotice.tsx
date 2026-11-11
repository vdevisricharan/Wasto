import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type NoticeTone = 'info' | 'warning' | 'error' | 'success' | 'neutral';

interface StatusNoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  stackAction?: boolean;
  className?: string;
  role?: 'status' | 'alert';
}

const TONE_STYLES: Record<NoticeTone, { wrapper: string; icon: string }> = {
  info: {
    wrapper: 'bg-[#EFF5FA] border-[#C7D8EA] text-[#1E3F60]',
    icon: 'text-[#315E8B]',
  },
  warning: {
    wrapper: 'bg-[#FDF7EC] border-[#EAD4AA] text-[#663F06]',
    icon: 'text-[#8A570B]',
  },
  error: {
    wrapper: 'bg-[#FDF2F1] border-[#EBC5C2] text-[#852721]',
    icon: 'text-[#B33D35]',
  },
  success: {
    wrapper: 'bg-[#E5EFE4] border-[#C5DBC2] text-[#19452B]',
    icon: 'text-[#245C3B]',
  },
  neutral: {
    wrapper: 'bg-[#EEF2EB] border-[#DCE3DA] text-[#18251D]',
    icon: 'text-[#526158]',
  },
};

export const StatusNotice: React.FC<StatusNoticeProps> = ({
  tone = 'info',
  title,
  children,
  action,
  stackAction = false,
  className = '',
  role = 'status',
}) => {
  const styles = TONE_STYLES[tone];

  const renderIcon = () => {
    switch (tone) {
      case 'warning':
        return <AlertTriangle size={18} strokeWidth={1.85} aria-hidden="true" />;
      case 'error':
        return <AlertCircle size={18} strokeWidth={1.85} aria-hidden="true" />;
      case 'success':
        return <CheckCircle2 size={18} strokeWidth={1.85} aria-hidden="true" />;
      default:
        return <Info size={18} strokeWidth={1.85} aria-hidden="true" />;
    }
  };

  return (
    <div
      role={role}
      className={`border rounded-[12px] px-4 py-3 flex flex-col ${
        stackAction ? '' : 'sm:flex-row sm:items-center sm:justify-between'
      } gap-3 ${styles.wrapper} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className={`shrink-0 mt-0.5 ${styles.icon}`}>{renderIcon()}</span>
        <div className="text-[14px] leading-[1.5] min-w-0">
          {title && <p className="font-semibold text-[#18251D]">{title}</p>}
          <div>{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};
