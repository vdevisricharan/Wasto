import React, { useCallback, useEffect, useState } from 'react';
import {
  MapPin,
  Plus,
  Search,
  User,
} from 'lucide-react';
import { BatchDetails, WasteBatch } from '../types';
import {
  addTrackingEvent,
  createWasteBatch,
  fetchBatchDetails,
  fetchWasteBatches,
} from '../api/client';
import {
  getStageMeta,
  LIFECYCLE_STAGES_META,
  OperationalModeInfo,
} from '../theme/tokens';
import { ModalDialog } from './ui/ModalDialog';
import { PageHeader } from './ui/PageHeader';
import { StatusNotice } from './ui/StatusNotice';

interface WasteTrackingViewProps {
  modeInfo: OperationalModeInfo;
  onDataChange: () => void;
}

const LOGGABLE_STAGES = LIFECYCLE_STAGES_META.filter((s) => s.key !== 'CREATED');

function getNextSuggestedStage(currentStatus: string): string {
  const order = [
    'CREATED',
    'PICKUP_SCHEDULED',
    'COLLECTED',
    'AT_FACILITY',
    'SORTED',
    'PROCESSED',
  ];
  const idx = order.indexOf(currentStatus);
  if (idx === -1) return 'AT_FACILITY';
  if (idx < order.length - 1) return order[idx + 1];
  return 'PROCESSED';
}

function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const WasteTrackingView: React.FC<WasteTrackingViewProps> = ({
  modeInfo,
  onDataChange,
}) => {
  const [batches, setBatches] = useState<WasteBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<BatchDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Register batch modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrg, setNewOrg] = useState('');
  const [newCategory, setNewCategory] = useState('Recyclable');
  const [newWeight, setNewWeight] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Log stage modal state
  const [eventOpen, setEventOpen] = useState(false);
  const [eventStage, setEventStage] = useState('COLLECTED');
  const [eventActor, setEventActor] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventBusy, setEventBusy] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const loadBatches = useCallback(async (preferredId?: string | null) => {
    setBatchesLoading(true);
    try {
      const list = await fetchWasteBatches();
      setBatches(list);
      setSelectedBatchId((prev) => {
        if (preferredId && list.some((b) => b.id === preferredId)) return preferredId;
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const loadBatchDetails = useCallback(async (batchId: string) => {
    setDetailsLoading(true);
    try {
      const details = await fetchBatchDetails(batchId);
      setSelectedDetails(details);
    } catch {
      setSelectedDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadBatchDetails(selectedBatchId);
    } else {
      setSelectedDetails(null);
    }
  }, [selectedBatchId, loadBatchDetails]);

  const filteredBatches = batches.filter((b) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.id.toLowerCase().includes(q) ||
      b.source_organization.toLowerCase().includes(q) ||
      b.material_category.toLowerCase().includes(q);
    const matchesStage = stageFilter === 'ALL' || b.status === stageFilter;
    return matchesSearch && matchesStage;
  });

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.trim()) {
      setCreateError('Please enter the source organization name.');
      return;
    }
    const parsedWeight = newWeight.trim() ? Number(newWeight) : undefined;
    if (
      parsedWeight !== undefined &&
      (Number.isNaN(parsedWeight) || parsedWeight <= 0)
    ) {
      setCreateError('Estimated weight must be a positive number.');
      return;
    }

    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createWasteBatch({
        source_organization: newOrg.trim(),
        material_category: newCategory,
        estimated_kg: parsedWeight,
        notes: newNotes.trim() || undefined,
      });
      setCreateOpen(false);
      setNewOrg('');
      setNewWeight('');
      setNewNotes('');
      await loadBatches(created?.id ?? null);
      onDataChange();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Unable to register batch.'
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const handleOpenEventModal = () => {
    if (!selectedDetails) return;
    setEventError(null);
    setEventStage(getNextSuggestedStage(selectedDetails.status));
    setEventOpen(true);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;
    if (!eventActor.trim()) {
      setEventError('Please enter the operator or handler name.');
      return;
    }

    setEventBusy(true);
    setEventError(null);
    try {
      await addTrackingEvent(selectedBatchId, {
        stage: eventStage,
        actor: eventActor.trim(),
        location: eventLocation.trim() || undefined,
        notes: eventNotes.trim() || undefined,
      });
      setEventOpen(false);
      setEventActor('');
      setEventLocation('');
      setEventNotes('');
      await loadBatches(selectedBatchId);
      await loadBatchDetails(selectedBatchId);
      onDataChange();
    } catch (err) {
      setEventError(
        err instanceof Error ? err.message : 'Unable to save stage update.'
      );
    } finally {
      setEventBusy(false);
    }
  };

  const showDemoNotice =
    !modeInfo.apiReachable || Boolean(batches.some((b) => b.is_demo_fixture));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waste tracking"
        description="Follow collected waste batches from pickup scheduling through sorting and processing."
        modeInfo={modeInfo}
        actions={
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[14px] font-medium transition-colors"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <span>Register batch</span>
          </button>
        }
      />

      {showDemoNotice && (
        <StatusNotice tone="info">
          Showing deterministic sample waste batches because the backend API is
          currently offline. Creating or updating batches requires an active API
          connection.
        </StatusNotice>
      )}

      {/* Search and Stage Filter Bar */}
      <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.85}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#526158] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by batch ID, organization, or material…"
            aria-label="Search batches"
            className="w-full min-h-[44px] pl-10 pr-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D] placeholder:text-[#526158]"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <label htmlFor="stage-filter" className="text-[13px] font-medium text-[#526158] shrink-0">
            Stage
          </label>
          <select
            id="stage-filter"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
          >
            <option value="ALL">All stages</option>
            {LIFECYCLE_STAGES_META.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
            <option value="IN_TRANSIT">In transit</option>
          </select>

          {(searchQuery || stageFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStageFilter('ALL');
              }}
              className="px-3 min-h-[44px] rounded-[8px] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[13px] font-medium text-[#526158] hover:text-[#18251D]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Batch Selector List + Chronological Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#DCE3DA] flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#18251D]">
              Waste batches
            </h2>
            <span className="text-[13px] text-[#526158] tabular-nums">
              {filteredBatches.length} shown
            </span>
          </div>

          {batchesLoading ? (
            <div className="p-6 text-[14px] text-[#526158]">Loading batches…</div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-6 space-y-3">
              <p className="text-[14px] text-[#18251D] font-medium">
                {batches.length === 0
                  ? 'No batches registered yet'
                  : 'No batches match the active filters'}
              </p>
              <p className="text-[13px] text-[#526158]">
                {batches.length === 0
                  ? 'Register a collection batch to begin custody tracking.'
                  : 'Adjust your search query or stage filter.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#DCE3DA]">
              {filteredBatches.map((batch) => {
                const isSelected = batch.id === selectedBatchId;
                const stageMeta = getStageMeta(batch.status);
                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => setSelectedBatchId(batch.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-5 py-4 min-h-[44px] transition-colors flex flex-col gap-2 border-l-4 ${
                      isSelected
                        ? 'bg-[#E5EFE4]/70 border-l-[#245C3B]'
                        : 'bg-[#FFFFFF] border-l-transparent hover:bg-[#F7F8F4]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[15px] font-semibold text-[#18251D]">
                        {batch.source_organization}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[12px] font-medium rounded-[6px] border whitespace-nowrap ${stageMeta.badgeClasses}`}
                      >
                        {stageMeta.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#526158]">
                      <span className="font-mono text-[12px] text-[#526158]">
                        {batch.id}
                      </span>
                      <span className="tabular-nums">
                        {batch.material_category}
                        {batch.estimated_kg !== null
                          ? ` · ${batch.estimated_kg} kg`
                          : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Batch Detail & Chronological Timeline */}
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6">
          {!selectedBatchId ? (
            <div className="py-10 text-center text-[14px] text-[#526158]">
              Select a batch from the list to review its custody timeline.
            </div>
          ) : detailsLoading && !selectedDetails ? (
            <div className="py-10 text-[14px] text-[#526158]">
              Loading batch timeline…
            </div>
          ) : selectedDetails ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-[#DCE3DA]">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-[#526158] bg-[#EEF2EB] px-2 py-0.5 rounded-[6px]">
                      {selectedDetails.id}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 text-[12px] font-medium rounded-[6px] border ${
                        getStageMeta(selectedDetails.status).badgeClasses
                      }`}
                    >
                      {getStageMeta(selectedDetails.status).label}
                    </span>
                  </div>
                  <h2 className="text-[22px] font-semibold text-[#18251D] leading-snug">
                    {selectedDetails.source_organization}
                  </h2>
                  <p className="text-[14px] text-[#526158] tabular-nums">
                    {selectedDetails.material_category}
                    {selectedDetails.estimated_kg !== null
                      ? ` · Estimated ${selectedDetails.estimated_kg} kg`
                      : ''}
                    {` · Updated ${formatDateTime(selectedDetails.updated_at)}`}
                  </p>
                  {selectedDetails.notes && (
                    <p className="text-[14px] text-[#18251D] pt-1">
                      {selectedDetails.notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenEventModal}
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[14px] font-medium transition-colors shrink-0 self-start"
                >
                  <span>Log stage update</span>
                </button>
              </div>

              {/* Chronological Custody Timeline */}
              <div>
                <h3 className="text-[16px] font-semibold text-[#18251D] mb-4">
                  Custody timeline
                </h3>

                {selectedDetails.timeline.length === 0 ? (
                  <p className="text-[14px] text-[#526158]">
                    No lifecycle events logged for this batch yet.
                  </p>
                ) : (
                  <ol className="relative space-y-5 pl-6 border-l border-[#DCE3DA] ml-2">
                    {selectedDetails.timeline.map((event) => {
                      const stMeta = getStageMeta(event.stage);
                      return (
                        <li key={event.id} className="relative">
                          <span
                            className="absolute -left-[29px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#245C3B] ring-4 ring-[#FFFFFF]"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-[12px] font-medium rounded-[6px] border w-fit ${stMeta.badgeClasses}`}
                            >
                              {stMeta.label}
                            </span>
                            <time className="text-[12px] text-[#526158] tabular-nums">
                              {formatDateTime(event.timestamp)}
                            </time>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#526158]">
                            <span className="inline-flex items-center gap-1.5 text-[#18251D] font-medium">
                              <User size={13} strokeWidth={1.85} aria-hidden="true" />
                              {event.actor}
                            </span>
                            {event.location && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin size={13} strokeWidth={1.85} aria-hidden="true" />
                                {event.location}
                              </span>
                            )}
                          </div>

                          {event.notes && (
                            <p className="text-[14px] text-[#18251D] leading-[1.5] mt-1.5">
                              {event.notes}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          ) : (
            <StatusNotice tone="error">
              Unable to load details for this waste batch.
            </StatusNotice>
          )}
        </div>
      </div>

      {/* Register Batch Modal */}
      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register waste batch"
        description="Create a collection record to track a batch across facility sorting and processing."
        titleId="register-batch-title"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <StatusNotice tone="error" role="alert">
              {createError}
            </StatusNotice>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="batch-org-input"
              className="block text-[13px] font-medium text-[#18251D]"
            >
              Source organization
            </label>
            <input
              id="batch-org-input"
              type="text"
              value={newOrg}
              onChange={(e) => setNewOrg(e.target.value)}
              placeholder="e.g. GreenCycle Logistics Pvt Ltd"
              required
              className="w-full min-h-[44px] px-3.5 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="batch-category-select"
                className="block text-[13px] font-medium text-[#18251D]"
              >
                Material stream
              </label>
              <select
                id="batch-category-select"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
              >
                <option value="Recyclable">Recyclable</option>
                <option value="Organic">Organic</option>
                <option value="Residual">Residual</option>
                <option value="Mixed Municipal">Mixed municipal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="batch-weight-input"
                className="block text-[13px] font-medium text-[#18251D]"
              >
                Estimated weight (kg)
              </label>
              <input
                id="batch-weight-input"
                type="number"
                step="0.1"
                min="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="e.g. 240"
                className="w-full min-h-[44px] px-3.5 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D] tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="batch-notes-input"
              className="block text-[13px] font-medium text-[#18251D]"
            >
              Notes
            </label>
            <textarea
              id="batch-notes-input"
              rows={3}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Collection zone, container condition, or special instructions…"
              className="w-full p-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 min-h-[44px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] text-[14px] font-medium text-[#18251D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBusy}
              className="px-5 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] disabled:bg-[#DCE3DA] disabled:text-[#526158] text-white text-[14px] font-medium"
            >
              {createBusy ? 'Saving…' : 'Create batch'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Log Stage Update Modal */}
      <ModalDialog
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        title="Log stage update"
        description={
          selectedDetails
            ? `Record a custody milestone for ${selectedDetails.source_organization} (${selectedDetails.id}).`
            : undefined
        }
        titleId="log-stage-title"
      >
        <form onSubmit={handleEventSubmit} className="space-y-4">
          {eventError && (
            <StatusNotice tone="error" role="alert">
              {eventError}
            </StatusNotice>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="event-stage-select"
              className="block text-[13px] font-medium text-[#18251D]"
            >
              Lifecycle stage
            </label>
            <select
              id="event-stage-select"
              value={eventStage}
              onChange={(e) => setEventStage(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            >
              {LOGGABLE_STAGES.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="event-actor-input"
                className="block text-[13px] font-medium text-[#18251D]"
              >
                Handler or operator
              </label>
              <input
                id="event-actor-input"
                type="text"
                value={eventActor}
                onChange={(e) => setEventActor(e.target.value)}
                placeholder="e.g. Facility Operator"
                required
                className="w-full min-h-[44px] px-3.5 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="event-location-input"
                className="block text-[13px] font-medium text-[#18251D]"
              >
                Location
              </label>
              <input
                id="event-location-input"
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="e.g. Okhla Processing Facility"
                className="w-full min-h-[44px] px-3.5 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="event-notes-input"
              className="block text-[13px] font-medium text-[#18251D]"
            >
              Notes
            </label>
            <textarea
              id="event-notes-input"
              rows={3}
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              placeholder="Weight verified, contamination notes, or transport receipt…"
              className="w-full p-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setEventOpen(false)}
              className="px-4 min-h-[44px] rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] hover:bg-[#EEF2EB] text-[14px] font-medium text-[#18251D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={eventBusy}
              className="px-5 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] disabled:bg-[#DCE3DA] disabled:text-[#526158] text-white text-[14px] font-medium"
            >
              {eventBusy ? 'Saving…' : 'Save update'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
