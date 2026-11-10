import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  FileText,
  AlertCircle,
  ArrowRight,
  Boxes,
} from 'lucide-react';
import { fetchWasteBatches, fetchBatchDetails, createWasteBatch, addTrackingEvent } from '../api/client';
import { WasteBatch, BatchDetails } from '../types';

export const WasteTrackingView: React.FC = () => {
  const [batches, setBatches] = useState<WasteBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // New batch form state
  const [newOrg, setNewOrg] = useState('');
  const [newCategory, setNewCategory] = useState('Mixed Recyclables');
  const [newKg, setNewKg] = useState('100');
  const [newNotes, setNewNotes] = useState('');

  // New event form state
  const [nextStage, setNextStage] = useState('PICKUP_SCHEDULED');
  const [eventActor, setEventActor] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const list = await fetchWasteBatches();
      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
    } catch (e) {
      // Handled in client
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    fetchBatchDetails(selectedBatchId)
      .then((res) => setBatchDetails(res))
      .catch(() => {});
  }, [selectedBatchId]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg) return;

    try {
      await createWasteBatch({
        source_organization: newOrg,
        material_category: newCategory,
        estimated_kg: parseFloat(newKg) || 0,
        notes: newNotes,
      });
      setShowCreateModal(false);
      setNewOrg('');
      setNewNotes('');
      await loadBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to create batch');
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !eventActor) return;

    try {
      await addTrackingEvent(selectedBatchId, {
        stage: nextStage,
        actor: eventActor,
        location: eventLocation,
        notes: eventNotes,
      });
      setShowEventModal(false);
      setEventActor('');
      setEventLocation('');
      setEventNotes('');
      // Reload details and batch list
      const updated = await fetchBatchDetails(selectedBatchId);
      setBatchDetails(updated);
      await loadBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to add event');
    }
  };

  // Helper for lifecycle timeline steps
  const LIFECYCLE_STEPS = [
    { key: 'CREATED', label: '1. Registered at Source' },
    { key: 'PICKUP_SCHEDULED', label: '2. Scheduled Pickup' },
    { key: 'COLLECTED', label: '3. Collected & Weighed' },
    { key: 'AT_FACILITY', label: '4. Arrived at Facility' },
    { key: 'SORTED', label: '5. Optically Segregated' },
    { key: 'PROCESSED', label: '6. Final Disposition' },
  ];

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-wasto-400" />
            Source-to-Recycling Lifecycle Tracking
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            End-to-end municipal batch provenance: Source Dustbins → Transport → Facility Sorting → Recycling Units.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-wasto-500 text-surface-900 font-semibold text-xs hover:bg-wasto-400 transition-all flex items-center space-x-1.5 shadow-lg shadow-wasto-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Batch</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Batches List (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl border border-gray-800 p-4 space-y-3">
          <div className="flex justify-between items-center px-2 py-1 text-xs font-semibold text-gray-400">
            <span>Registered Batches ({batches.length})</span>
            <span className="font-mono text-[10px]">Persistent SQLite</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {batches.map((batch) => {
              const isSelected = selectedBatchId === batch.id;
              return (
                <div
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-wasto-500/15 border-wasto-500/50 text-white shadow-md'
                      : 'bg-surface-800 border-gray-700/70 text-gray-300 hover:bg-surface-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-bold text-wasto-400">{batch.id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-900 border border-gray-700 font-semibold text-gray-300">
                      {batch.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold mt-1 truncate">{batch.source_organization}</h4>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{batch.material_category}</span>
                    <span className="font-mono">{batch.estimated_kg ? `${batch.estimated_kg} kg` : 'Tare pending'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Batch Details & Chronological Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {batchDetails ? (
            <div className="glass-card rounded-2xl p-6 border border-gray-800 space-y-6">
              {/* Batch Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 pb-4">
                <div>
                  <span className="font-mono text-xs text-wasto-400 font-bold">{batchDetails.id}</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">{batchDetails.source_organization}</h3>
                  <p className="text-xs text-gray-400 mt-1">{batchDetails.notes || 'No notes provided'}</p>
                </div>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 border border-gray-700 text-xs font-semibold text-wasto-400 flex items-center space-x-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Transition Event</span>
                </button>
              </div>

              {/* Progress Stepper */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-400">Lifecycle Progress:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LIFECYCLE_STEPS.map((step) => {
                    const isPassedOrCurrent = batchDetails.timeline.some((e) => e.stage === step.key);
                    return (
                      <div
                        key={step.key}
                        className={`p-2 rounded-lg text-[11px] border flex items-center space-x-1.5 ${
                          isPassedOrCurrent
                            ? 'bg-wasto-500/10 border-wasto-500/30 text-wasto-300'
                            : 'bg-surface-800/40 border-gray-800 text-gray-500'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isPassedOrCurrent ? 'text-wasto-400' : 'text-gray-600'
                          }`}
                        />
                        <span className="truncate">{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chronological Event History */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-gray-400">Audit Timeline ({batchDetails.timeline.length} events):</span>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                  {batchDetails.timeline.map((evt, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-wasto-500 ring-4 ring-surface-900"></div>
                      <div className="flex flex-wrap items-baseline justify-between gap-1">
                        <span className="text-xs font-bold text-white font-mono">{evt.stage}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(evt.timestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">{evt.notes}</p>
                      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-500" />
                          {evt.actor}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-500" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
              Select a batch from the left to view tracking history.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Batch */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 border border-gray-700 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Register Source Waste Batch</h3>
            <form onSubmit={handleCreateBatch} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">Source Organization / Campus Zone:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IIIT Delhi — Student Hostel Block"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Category:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                  >
                    <option value="Mixed Recyclables">Mixed Recyclables</option>
                    <option value="Organic Waste">Organic Waste</option>
                    <option value="Paper & Cardboard">Paper & Cardboard</option>
                    <option value="Plastics">Plastics</option>
                    <option value="Residual Waste">Residual Waste</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Estimated Quantity (kg):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newKg}
                    onChange={(e) => setNewKg(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Collection Notes:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Segregated source bin flagged 80% full"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-800 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-wasto-500 text-surface-900 font-semibold"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Tracking Event */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 border border-gray-700 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Log Lifecycle Transition</h3>
            <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">Target Stage:</label>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white font-mono"
                >
                  <option value="PICKUP_SCHEDULED">PICKUP_SCHEDULED</option>
                  <option value="COLLECTED">COLLECTED</option>
                  <option value="AT_FACILITY">AT_FACILITY</option>
                  <option value="SORTED">SORTED</option>
                  <option value="PROCESSED">PROCESSED</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Actor (Driver / Inspector / Operator):</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Driver K. Singh (Van DL-1Z-9821)"
                  value={eventActor}
                  onChange={(e) => setEventActor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Location Details:</label>
                <input
                  type="text"
                  placeholder="e.g. Okhla MRF Facility Gate 2"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Transition Notes:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Tare weight verified at weighbridge"
                  value={eventNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-gray-700 text-white"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-800 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-wasto-500 text-surface-900 font-semibold"
                >
                  Record Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
