import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react';
import { HistoryItem, HistoryResponse } from '../types';
import { API_BASE, fetchHistory } from '../api/client';
import { MATERIAL_CLASSES, OperationalModeInfo } from '../theme/tokens';
import { CategoryBadge } from './ui/CategoryBadge';
import { PageHeader } from './ui/PageHeader';
import { StatusNotice } from './ui/StatusNotice';

interface HistoryViewProps {
  modeInfo: OperationalModeInfo;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ modeInfo }) => {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [materialFilter, setMaterialFilter] = useState<string>('');
  const [routingFilter, setRoutingFilter] = useState<string>('');
  const [certaintyFilter, setCertaintyFilter] = useState<'all' | 'confident' | 'uncertain'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const isUncertain =
        certaintyFilter === 'all'
          ? undefined
          : certaintyFilter === 'uncertain';

      const res = await fetchHistory(
        page,
        pageSize,
        materialFilter || undefined,
        routingFilter || undefined,
        isUncertain
      );
      setHistoryData(res);
    } finally {
      setLoading(false);
    }
  }, [page, materialFilter, routingFilter, certaintyFilter]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const rawItems = historyData?.items ?? [];
  const filteredItems = rawItems.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const rowId = (item.id || item.prediction_id || '').toLowerCase();
    return (
      rowId.includes(q) ||
      (item.filename || '').toLowerCase().includes(q) ||
      String(item.material_label).toLowerCase().includes(q)
    );
  });

  const hasActiveFilters =
    Boolean(materialFilter) ||
    Boolean(routingFilter) ||
    certaintyFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setMaterialFilter('');
    setRoutingFilter('');
    setCertaintyFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const getRowId = (row: HistoryItem, index: number) =>
    row.id || row.prediction_id || `${row.timestamp}-${index}`;

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatFullDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString();

  const renderExpandedDetails = (row: HistoryItem) => {
    const sortedScores = Object.entries(row.scores || {}).sort(
      (a, b) => b[1] - a[1]
    );

    return (
      <div className="p-4 rounded-[8px] bg-[#F7F8F4] border border-[#DCE3DA] space-y-4">
        {row.is_uncertain && row.uncertainty_reason && (
          <StatusNotice tone="warning" title="Held for manual review">
            {row.uncertainty_reason}
          </StatusNotice>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[#526158]">Prediction ID</dt>
              <dd className="font-mono text-[#18251D] truncate max-w-[220px]">
                {row.id || row.prediction_id || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#526158]">Recorded at</dt>
              <dd className="text-[#18251D] tabular-nums">
                {formatFullDate(row.timestamp)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#526158]">Input mode</dt>
              <dd className="text-[#18251D] font-medium">
                {row.source_mode || 'SINGLE'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#526158]">Latency</dt>
              <dd className="text-[#18251D] tabular-nums">
                {(row.latency_ms ?? 0).toFixed(1)} ms
              </dd>
            </div>
          </dl>

          {sortedScores.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-[#526158]">
                Top class probabilities
              </p>
              {sortedScores.slice(0, 4).map(([cls, score]) => (
                <div key={cls} className="space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#18251D] font-medium">{cls}</span>
                    <span className="tabular-nums text-[#526158]">
                      {(score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#DCE3DA]/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#245C3B]"
                      style={{ width: `${Math.max(2, score * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Inspect past image classifications, model confidence scores, and manual review flags."
        modeInfo={modeInfo}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadPage}
              className="inline-flex items-center justify-center gap-2 px-3.5 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[14px] font-medium transition-colors"
            >
              <RefreshCw size={15} strokeWidth={1.85} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            {modeInfo.apiReachable ? (
              <a
                href={`${API_BASE}/api/export/predictions.csv`}
                download
                className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[14px] font-medium transition-colors"
              >
                <Download size={16} strokeWidth={1.85} aria-hidden="true" />
                <span>Export CSV</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="CSV export requires a connected backend API"
                className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#DCE3DA] text-[#526158] text-[14px] font-medium cursor-not-allowed"
              >
                <Download size={16} strokeWidth={1.85} aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <section
        aria-label="History filters"
        className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-4 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="history-search"
              className="block text-[12px] font-medium text-[#526158] mb-1"
            >
              Search filename or ID
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#526158] pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="history-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter current page…"
                className="w-full min-h-[44px] pl-9 pr-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D] placeholder:text-[#526158]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="history-material"
              className="block text-[12px] font-medium text-[#526158] mb-1"
            >
              Material
            </label>
            <select
              id="history-material"
              value={materialFilter}
              onChange={(e) => {
                setMaterialFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            >
              <option value="">All materials</option>
              {MATERIAL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="history-destination"
              className="block text-[12px] font-medium text-[#526158] mb-1"
            >
              Destination
            </label>
            <select
              id="history-destination"
              value={routingFilter}
              onChange={(e) => {
                setRoutingFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            >
              <option value="">All destinations</option>
              <option value="Organic">Organic</option>
              <option value="Recyclable">Recyclable</option>
              <option value="Residual">Residual</option>
              <option value="Unknown / Manual Review">Needs review</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="history-status"
              className="block text-[12px] font-medium text-[#526158] mb-1"
            >
              Confidence status
            </label>
            <select
              id="history-status"
              value={certaintyFilter}
              onChange={(e) => {
                setCertaintyFilter(
                  e.target.value as 'all' | 'confident' | 'uncertain'
                );
                setPage(1);
              }}
              className="w-full min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            >
              <option value="all">All items</option>
              <option value="confident">Confident only</option>
              <option value="uncertain">Needs review</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[13px] text-[#526158]">
          <span className="tabular-nums">
            {historyData?.unavailable
              ? 'Database offline'
              : `${historyData?.total ?? 0} total recorded item${
                  historyData?.total === 1 ? '' : 's'
                }`}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-medium text-[#245C3B] hover:text-[#19452B] underline underline-offset-4"
            >
              Reset all filters
            </button>
          )}
        </div>
      </section>

      {/* Main Content States */}
      {loading ? (
        <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-8 text-[14px] text-[#526158]">
          Loading classification history…
        </div>
      ) : historyData?.unavailable ? (
        <StatusNotice
          tone="warning"
          title="History archive unreachable"
          action={
            <button
              type="button"
              onClick={loadPage}
              className="px-3.5 min-h-[40px] rounded-[8px] bg-[#FFFFFF] border border-[#EAD4AA] text-[#754909] text-[13px] font-medium hover:bg-[#FDF7EC]"
            >
              Retry connection
            </button>
          }
        >
          Unable to connect to the backend SQLite history endpoint. Saved
          classifications and CSV export become available once the backend API is
          running.
        </StatusNotice>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-8 space-y-3">
          <p className="text-[16px] font-semibold text-[#18251D]">
            {hasActiveFilters
              ? 'No matching history records'
              : 'No classification records yet'}
          </p>
          <p className="text-[14px] text-[#526158]">
            {hasActiveFilters
              ? 'Try clearing one or more filters to view older records.'
              : 'Run a single or batch classification to populate the audit archive.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 min-h-[44px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] text-[14px] font-medium text-[#18251D]"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE3DA] bg-[#F7F8F4]/70 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#526158]">
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3DA] text-[14px]">
                {filteredItems.map((row, idx) => {
                  const rowId = getRowId(row, idx);
                  const isExpanded = expandedRowId === rowId;
                  return (
                    <React.Fragment key={rowId}>
                      <tr className={isExpanded ? 'bg-[#EEF2EB]/40' : 'hover:bg-[#F7F8F4]/60'}>
                        <td className="py-3.5 px-4 font-medium text-[#18251D]">
                          {row.is_uncertain ? 'Uncertain item' : row.material_label}
                        </td>
                        <td className="py-3.5 px-4">
                          <CategoryBadge category={row.routing_category} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 tabular-nums font-medium text-[#18251D]">
                          {(row.confidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-[#526158] max-w-[200px] truncate">
                          {row.filename || 'Captured frame'}
                        </td>
                        <td className="py-3.5 px-4 tabular-nums text-[#526158]">
                          {(row.latency_ms ?? 0).toFixed(0)} ms
                        </td>
                        <td className="py-3.5 px-4 tabular-nums text-[#526158] whitespace-nowrap">
                          {formatDate(row.timestamp)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowId((prev) =>
                                prev === rowId ? null : rowId
                              )
                            }
                            aria-expanded={isExpanded}
                            aria-label={`Inspect details for ${row.filename || row.material_label}`}
                            className="inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] text-[13px] font-medium text-[#18251D]"
                          >
                            <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                            <ChevronDown
                              size={14}
                              className={`transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-4 bg-[#FFFFFF]">
                            {renderExpandedDetails(row)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-[#DCE3DA]">
            {filteredItems.map((row, idx) => {
              const rowId = getRowId(row, idx);
              const isExpanded = expandedRowId === rowId;
              return (
                <div key={rowId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#18251D]">
                        {row.is_uncertain ? 'Uncertain item' : row.material_label}
                      </p>
                      <p className="text-[12px] text-[#526158] truncate mt-0.5">
                        {row.filename || 'Captured frame'} · {formatDate(row.timestamp)}
                      </p>
                    </div>
                    <span className="text-[15px] font-semibold text-[#18251D] tabular-nums shrink-0">
                      {(row.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={row.routing_category} size="sm" />
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRowId((prev) => (prev === rowId ? null : rowId))
                      }
                      aria-expanded={isExpanded}
                      className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] text-[13px] font-medium text-[#18251D]"
                    >
                      <span>{isExpanded ? 'Hide details' : 'Inspect'}</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {isExpanded && renderExpandedDetails(row)}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(historyData?.total_pages ?? 1) > 1 && (
            <div className="px-4 py-3.5 border-t border-[#DCE3DA] bg-[#F7F8F4]/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] disabled:opacity-50 text-[13px] font-medium text-[#18251D]"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                <span>Previous</span>
              </button>

              <span className="text-[13px] text-[#526158] tabular-nums">
                Page {page} of {historyData?.total_pages ?? 1}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((p) =>
                    Math.min(historyData?.total_pages ?? 1, p + 1)
                  )
                }
                disabled={page >= (historyData?.total_pages ?? 1)}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] disabled:opacity-50 text-[13px] font-medium text-[#18251D]"
              >
                <span>Next</span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
