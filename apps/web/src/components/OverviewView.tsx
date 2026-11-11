import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  RefreshCw,
  Video,
} from 'lucide-react';
import {
  DashboardSummary,
  HistoryItem,
  RoutingCategory,
} from '../types';
import { fetchHistory } from '../api/client';
import {
  OperationalModeInfo,
  ROUTING_CATEGORY_META,
} from '../theme/tokens';
import { NavTabId } from './AppShell';
import { CategoryBadge, getCategoryIcon } from './ui/CategoryBadge';
import { PageHeader } from './ui/PageHeader';
import { StatusNotice } from './ui/StatusNotice';

interface OverviewViewProps {
  summary: DashboardSummary | null;
  modeInfo: OperationalModeInfo;
  onRefresh: () => void;
  onNavigate: (tab: NavTabId) => void;
}

const ROUTING_ORDER: RoutingCategory[] = [
  'Organic',
  'Recyclable',
  'Residual',
  'Unknown / Manual Review',
];

const HERO_THUMBNAILS = [
  { src: '/samples/organic-scraps.jpg', label: 'Organic', alt: 'Organic food waste sample' },
  { src: '/samples/cardboard-box.jpg', label: 'Paper', alt: 'Cardboard waste sample' },
  { src: '/samples/glass-bottle.jpg', label: 'Glass', alt: 'Glass bottles waste sample' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  modeInfo,
  onRefresh,
  onNavigate,
}) => {
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [deviceDetailsOpen, setDeviceDetailsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecent = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchHistory(1, 5);
      setRecentItems(res.items ?? []);
      setHistoryUnavailable(Boolean(res.unavailable));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent, summary?.timestamp]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    onRefresh();
    await loadRecent();
    window.setTimeout(() => setRefreshing(false), 300);
  };

  const totalPredictions = summary ? summary.total_predictions : null;
  const totalSorts = summary ? summary.total_actuated_sorts : null;
  const needsReviewCount = summary ? summary.uncertain_predictions_count : null;
  const fillPct = summary?.latest_telemetry ? summary.latest_telemetry.fill_pct : null;

  const rowTotal = ROUTING_ORDER.reduce((acc, key) => {
    if (!summary) return acc;
    if (key === 'Unknown / Manual Review') {
      return (
        acc +
        (summary.routing_distribution?.[key] ?? summary.uncertain_predictions_count ?? 0)
      );
    }
    return acc + (summary.routing_distribution?.[key] ?? 0);
  }, 0);

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatRecentDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const modelStatusLabel = !modeInfo.apiReachable
    ? 'Demo fixtures (API offline)'
    : modeInfo.mlReady
      ? 'MobileNetV3Large · Ready'
      : 'Model unavailable';

  const hardwareStatusLabel = !summary
    ? '—'
    : !modeInfo.apiReachable
      ? 'Simulated (offline)'
      : `${modeInfo.isSimulatedHw ? 'Simulated' : 'Physical'} · ${
          modeInfo.hwArmed ? 'Armed' : 'Disarmed'
        }`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="A clearer path for every piece of waste."
        description="Classify materials, monitor sorting, and follow waste from collection to processing."
        modeInfo={modeInfo}
        actionsBelow
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('classify')}
              className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[14px] font-medium transition-colors"
            >
              <span>Classify waste</span>
              <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('monitor')}
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[14px] font-medium transition-colors"
            >
              <Video size={16} strokeWidth={1.85} aria-hidden="true" />
              <span>Open live monitor</span>
            </button>
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={refreshing}
              aria-label="Refresh operational data"
              title="Refresh operational data"
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-3 rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#526158] hover:text-[#18251D] transition-colors disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                strokeWidth={1.85}
                className={refreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </button>
          </div>
        }
      />

      {/* Restrained material reference strip */}
      <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {HERO_THUMBNAILS.map((item) => (
            <div key={item.label} className="flex items-center gap-2 shrink-0 pr-2">
              <img
                src={item.src}
                alt={item.alt}
                className="w-10 h-10 rounded-[8px] object-cover border border-[#DCE3DA] bg-[#EEF2EB]"
              />
              <span className="text-[13px] font-medium text-[#18251D]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 text-[13px] text-[#526158] shrink-0">
          <span>9 trained material classes · 3 sorting chutes</span>
          <button
            type="button"
            onClick={() => onNavigate('architecture')}
            className="font-medium text-[#245C3B] hover:text-[#19452B] underline underline-offset-4 whitespace-nowrap"
          >
            Routing rules
          </button>
        </div>
      </div>

      {/* Single divided operational metric strip */}
      <section aria-label="Key operational metrics">
        <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-[#DCE3DA]">
          <div className="p-5 sm:border-b lg:border-b-0 sm:border-r lg:border-r-0 border-[#DCE3DA]">
            <p className="text-[13px] font-medium text-[#526158]">Classifications</p>
            <p className="text-[32px] font-semibold leading-[1.15] text-[#18251D] tabular-nums mt-2">
              {totalPredictions !== null ? totalPredictions.toLocaleString() : '—'}
            </p>
            <p className="text-[12px] text-[#526158] mt-1.5">
              {summary
                ? `${Object.keys(summary.material_distribution || {}).length} material classes seen`
                : 'Waiting for backend response'}
            </p>
          </div>

          <div className="p-5 sm:border-b lg:border-b-0 border-[#DCE3DA]">
            <p className="text-[13px] font-medium text-[#526158]">Completed sorts</p>
            <p className="text-[32px] font-semibold leading-[1.15] text-[#18251D] tabular-nums mt-2">
              {totalSorts !== null ? totalSorts.toLocaleString() : '—'}
            </p>
            <p className="text-[12px] text-[#526158] mt-1.5">
              {summary
                ? modeInfo.isSimulatedHw
                  ? 'Recorded in software simulator'
                  : 'Verified flap actuations'
                : 'Hardware tally unavailable'}
            </p>
          </div>

          <div className="p-5 sm:border-r lg:border-r-0 border-[#DCE3DA]">
            <p className="text-[13px] font-medium text-[#526158]">Review-needed items</p>
            <p className="text-[32px] font-semibold leading-[1.15] text-[#18251D] tabular-nums mt-2">
              {needsReviewCount !== null ? needsReviewCount.toLocaleString() : '—'}
            </p>
            <p className="text-[12px] text-[#526158] mt-1.5 tabular-nums">
              {summary && summary.total_predictions > 0
                ? `${summary.uncertainty_rate_pct.toFixed(1)}% of ${summary.total_predictions} predictions`
                : 'Held when below 60% confidence'}
            </p>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[#526158]">Bin fill</p>
              {summary?.latest_telemetry && (
                <span className="text-[12px] font-medium text-[#526158]">
                  {summary.latest_telemetry.source === 'SIMULATED'
                    ? 'Simulated sensor'
                    : 'Ultrasonic'}
                </span>
              )}
            </div>
            <p className="text-[32px] font-semibold leading-[1.15] text-[#18251D] tabular-nums mt-2">
              {fillPct !== null ? `${fillPct.toFixed(1)}%` : '—'}
            </p>
            {fillPct !== null && summary?.latest_telemetry ? (
              <div className="mt-2 space-y-1.5">
                <div className="w-full h-1.5 rounded-full bg-[#EEF2EB] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, fillPct))}%`,
                      backgroundColor: fillPct > 85 ? '#B33D35' : '#245C3B',
                    }}
                  />
                </div>
                <p className="text-[12px] text-[#526158] tabular-nums">
                  Clearance {summary.latest_telemetry.distance_cm.toFixed(1)} cm
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-[#526158] mt-1.5">
                Sensor reading unavailable
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 7:5 Split: Sorting Activity + System Status */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pb-4 border-b border-[#DCE3DA]">
            <h2 className="text-[20px] font-semibold text-[#18251D]">
              Sorting activity
            </h2>
            <p className="text-[13px] text-[#526158] tabular-nums">
              {summary
                ? `Out of ${summary.total_predictions.toLocaleString()} classifications`
                : 'No routing breakdown loaded'}
            </p>
          </div>

          <div className="divide-y divide-[#DCE3DA]">
            {ROUTING_ORDER.map((categoryKey) => {
              const meta = ROUTING_CATEGORY_META[categoryKey];
              const count = summary
                ? categoryKey === 'Unknown / Manual Review'
                  ? (summary.routing_distribution?.[categoryKey] ??
                    summary.uncertain_predictions_count ??
                    0)
                  : (summary.routing_distribution?.[categoryKey] ?? 0)
                : null;
              const pct =
                count !== null && rowTotal > 0
                  ? Math.round((count / rowTotal) * 100)
                  : null;

              return (
                <div key={categoryKey} className="py-4 first:pt-4 last:pb-1">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-7 h-7 rounded-[8px] border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: '#DCE3DA',
                          color: meta.barColor,
                          backgroundColor: '#F7F8F4',
                        }}
                      >
                        {getCategoryIcon(categoryKey, 15)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[#18251D]">
                          {meta.label}
                        </p>
                        <p className="text-[12px] text-[#526158] truncate">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <span className="text-[16px] font-semibold text-[#18251D]">
                        {count !== null ? count.toLocaleString() : '—'}
                      </span>
                      <span className="text-[13px] text-[#526158] ml-2">
                        {pct !== null ? `${pct}%` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 w-full h-2 rounded-full bg-[#EEF2EB] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct ?? 0}%`,
                        backgroundColor: meta.barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6">
          <div className="pb-4 border-b border-[#DCE3DA]">
            <h2 className="text-[20px] font-semibold text-[#18251D]">
              System status
            </h2>
            <p className="text-[13px] text-[#526158] mt-1">
              Current runtime and safety configuration
            </p>
          </div>

          <dl className="divide-y divide-[#DCE3DA] text-[14px]">
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#526158]">Model</dt>
              <dd className="font-medium text-[#18251D] text-right">
                {modelStatusLabel}
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#526158]">Camera</dt>
              <dd className="font-medium text-[#18251D] text-right">
                Live monitor (browser feed)
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#526158]">Hardware</dt>
              <dd className="font-medium text-[#18251D] text-right">
                {hardwareStatusLabel}
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#526158]">Tracked batches</dt>
              <dd className="font-medium text-[#18251D] tabular-nums text-right">
                {summary ? summary.total_waste_batches.toLocaleString() : '—'}
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#526158]">Last update</dt>
              <dd className="font-medium text-[#18251D] tabular-nums text-right">
                {formatTimestamp(summary?.timestamp)}
              </dd>
            </div>
          </dl>

          <div className="pt-3 mt-1 border-t border-[#DCE3DA]">
            <button
              type="button"
              onClick={() => setDeviceDetailsOpen((prev) => !prev)}
              aria-expanded={deviceDetailsOpen}
              className="w-full min-h-[44px] flex items-center justify-between px-3 rounded-[8px] text-[14px] font-medium text-[#18251D] bg-[#F7F8F4] hover:bg-[#EEF2EB] border border-[#DCE3DA] transition-colors"
            >
              <span>Device details</span>
              <ChevronDown
                size={16}
                strokeWidth={1.85}
                className={`text-[#526158] transition-transform ${
                  deviceDetailsOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {deviceDetailsOpen && (
              <dl className="mt-3 p-3.5 rounded-[8px] bg-[#EEF2EB]/70 border border-[#DCE3DA] space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#526158]">Serial port</dt>
                  <dd className="font-mono text-[#18251D]">
                    {modeInfo.hwPort || 'Unavailable'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#526158]">Baud rate</dt>
                  <dd className="font-mono text-[#18251D]">9600 bps</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#526158]">Board</dt>
                  <dd className="font-medium text-[#18251D]">Arduino Uno R3</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#526158]">Safety watchdog</dt>
                  <dd className="font-medium text-[#18251D]">30s auto-disarm</dd>
                </div>
              </dl>
            )}
          </div>

          <p className="text-[13px] text-[#526158] leading-[1.5] mt-4">
            Items below 60% confidence are held for review, and non-biodegradable
            materials are blocked from compost routing.{' '}
            <button
              type="button"
              onClick={() => onNavigate('architecture')}
              className="text-[#245C3B] font-medium hover:underline underline-offset-4"
            >
              View model details
            </button>
          </p>
        </div>
      </section>

      {/* Recent classifications list */}
      <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#DCE3DA]">
          <div>
            <h2 className="text-[20px] font-semibold text-[#18251D]">
              Recent events
            </h2>
            <p className="text-[13px] text-[#526158] mt-0.5">
              Latest recorded classification events from the active store
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#245C3B] hover:text-[#19452B] self-start sm:self-auto"
          >
            <span>View full history</span>
            <ArrowRight size={15} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>

        {historyLoading ? (
          <div className="py-8 text-[14px] text-[#526158]">
            Loading recent classifications…
          </div>
        ) : historyUnavailable ? (
          <div className="pt-4">
            <StatusNotice
              tone="info"
              title="Classification log requires a connected API"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('classify')}
                  className="px-3.5 min-h-[40px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[13px] font-medium transition-colors"
                >
                  Open classify
                </button>
              }
            >
              Saved events will appear here once connected to the backend database.
            </StatusNotice>
          </div>
        ) : recentItems.length === 0 ? (
          <div className="py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium text-[#18251D]">
                No classifications recorded yet
              </p>
              <p className="text-[14px] text-[#526158] mt-0.5">
                Start by uploading an image or trying one of the sample materials.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('classify')}
              className="px-4 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[14px] font-medium transition-colors self-start sm:self-auto"
            >
              Classify first item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse mt-1">
              <thead>
                <tr className="border-b border-[#DCE3DA] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#526158]">
                  <th className="py-3 pr-4">Material</th>
                  <th className="py-3 pr-4">Destination</th>
                  <th className="py-3 pr-4">Confidence</th>
                  <th className="py-3 pr-4 hidden sm:table-cell">Item</th>
                  <th className="py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3DA] text-[14px]">
                {recentItems.map((row) => (
                  <tr key={row.id || row.prediction_id || row.timestamp}>
                    <td className="py-3.5 pr-4 font-medium text-[#18251D]">
                      {row.is_uncertain ? 'Uncertain item' : row.material_label}
                    </td>
                    <td className="py-3.5 pr-4">
                      <CategoryBadge category={row.routing_category} size="sm" />
                    </td>
                    <td className="py-3.5 pr-4 font-medium text-[#18251D] tabular-nums">
                      {(row.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="py-3.5 pr-4 text-[#526158] hidden sm:table-cell max-w-[200px] truncate">
                      {row.filename || 'Captured frame'}
                    </td>
                    <td className="py-3.5 text-right text-[#526158] tabular-nums whitespace-nowrap">
                      {formatRecentDate(row.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
