import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Cpu,
  Download,
  FileImage,
  FolderOpen,
  Layers,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BatchPredictionResult,
  PredictionResult,
  RoutingCategory,
} from '../types';
import {
  actuateFlap,
  predictBatchImages,
  predictSingleImage,
} from '../api/client';
import {
  OperationalModeInfo,
  ROUTING_CATEGORY_META,
} from '../theme/tokens';
import { CategoryBadge } from './ui/CategoryBadge';
import { PageHeader } from './ui/PageHeader';
import { StatusNotice } from './ui/StatusNotice';

interface ClassifyViewProps {
  modeInfo: OperationalModeInfo;
  onClassificationComplete: () => void;
}

interface SamplePreset {
  id: string;
  label: string;
  hint: string;
  src: string;
  filename: string;
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'organic',
    label: 'Organic scraps',
    hint: 'Compostable sample',
    src: '/samples/organic-scraps.jpg',
    filename: 'sample-organic-scraps.jpg',
  },
  {
    id: 'cardboard',
    label: 'Cardboard box',
    hint: 'Fiber packaging',
    src: '/samples/cardboard-box.jpg',
    filename: 'sample-cardboard-box.jpg',
  },
  {
    id: 'glass',
    label: 'Glass bottle',
    hint: 'Container glass',
    src: '/samples/glass-bottle.jpg',
    filename: 'sample-glass-bottle.jpg',
  },
  {
    id: 'plastic',
    label: 'Plastic bottle',
    hint: 'Low-contrast edge case',
    src: '/samples/plastic-bottle.jpg',
    filename: 'sample-plastic-bottle.jpg',
  },
];

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BATCH_FILES = 50;

const ROUTING_TO_BIN: Record<RoutingCategory, string> = {
  Organic: 'ORGANIC',
  Recyclable: 'RECYCLABLE',
  Residual: 'RESIDUAL',
  'Unknown / Manual Review': 'NONE',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileKey(file: File | null): string | null {
  if (!file) return null;
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function validateImageFile(file: File): string | null {
  const nameLower = file.name.toLowerCase();
  const extOk =
    nameLower.endsWith('.jpg') ||
    nameLower.endsWith('.jpeg') ||
    nameLower.endsWith('.png') ||
    nameLower.endsWith('.webp');
  if (file.type && !ACCEPTED_TYPES.has(file.type) && !extOk) {
    return `${file.name} is not a supported JPEG, PNG, or WEBP image.`;
  }
  if (!file.type && !extOk) {
    return `${file.name} is not a supported JPEG, PNG, or WEBP image.`;
  }
  if (file.size === 0) {
    return `${file.name} appears to be empty.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} exceeds the 15 MB upload limit.`;
  }
  return null;
}

export const ClassifyView: React.FC<ClassifyViewProps> = ({
  modeInfo,
  onClassificationComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [sampleLoadingId, setSampleLoadingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictionFileKey, setPredictionFileKey] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [actuating, setActuating] = useState(false);
  const [actuationMessage, setActuationMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<
    Array<{ file: File; previewUrl: string }>
  >([]);
  const [batchDragActive, setBatchDragActive] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSamplesLoading, setBatchSamplesLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchPredictionResult | null>(null);

  const singleInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLDivElement>(null);
  const batchUrlsRef = useRef<string[]>([]);

  const singlePanelId = useId();
  const batchPanelId = useId();
  const singleTabId = useId();
  const batchTabId = useId();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    batchUrlsRef.current = batchFiles.map((b) => b.previewUrl);
  }, [batchFiles]);

  useEffect(() => {
    return () => {
      batchUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const currentFileKey = getFileKey(selectedFile);
  const isResultStale =
    Boolean(prediction) &&
    Boolean(selectedFile) &&
    predictionFileKey !== currentFileKey;

  const setNewSingleFile = (file: File, sampleId: string | null = null) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setSingleError(validationError);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextUrl);
    setActiveSampleId(sampleId);
    setSingleError(null);
    setActuationMessage(null);
  };

  const handleClearSingleFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setActiveSampleId(null);
    setPrediction(null);
    setPredictionFileKey(null);
    setSingleError(null);
    setActuationMessage(null);
    setDetailsOpen(false);
    if (singleInputRef.current) singleInputRef.current.value = '';
  };

  const handleChooseSample = async (preset: SamplePreset) => {
    setSampleLoadingId(preset.id);
    setSingleError(null);
    try {
      const response = await fetch(preset.src);
      if (!response.ok) {
        throw new Error(`Could not load sample image (${response.status})`);
      }
      const blob = await response.blob();
      const file = new File([blob], preset.filename, {
        type: blob.type || 'image/jpeg',
      });
      setNewSingleFile(file, preset.id);
    } catch (err) {
      setSingleError(
        err instanceof Error ? err.message : 'Unable to load sample image.'
      );
    } finally {
      setSampleLoadingId(null);
    }
  };

  const scrollAndFocusResult = () => {
    const el = resultHeadingRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const rect = el.getBoundingClientRect();
    const outOfView = rect.top < 64 || rect.top > window.innerHeight * 0.72;
    if (outOfView) {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      el.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };

  const handleRunSingle = async () => {
    if (!selectedFile || singleLoading) return;
    const submittedKey = getFileKey(selectedFile);
    setSingleLoading(true);
    setSingleError(null);
    setActuationMessage(null);

    try {
      const res = await predictSingleImage(selectedFile);
      setPrediction(res);
      setPredictionFileKey(submittedKey);
      onClassificationComplete();
      window.setTimeout(scrollAndFocusResult, 40);
    } catch (err) {
      setSingleError(
        err instanceof Error
          ? err.message
          : 'Classification failed. Please verify the image and try again.'
      );
    } finally {
      setSingleLoading(false);
    }
  };

  const handleHardwareSort = async () => {
    if (!prediction || prediction.is_uncertain || !modeInfo.apiReachable) return;
    const targetBin = ROUTING_TO_BIN[prediction.routing_category];
    if (!targetBin || targetBin === 'NONE') return;

    setActuating(true);
    setActuationMessage(null);
    try {
      await actuateFlap(targetBin, 1200, prediction.prediction_id);
      setActuationMessage({
        tone: 'success',
        text: `Sent ${ROUTING_CATEGORY_META[prediction.routing_category].label} chute command (${ROUTING_CATEGORY_META[prediction.routing_category].servoAngle}).`,
      });
      onClassificationComplete();
    } catch (err) {
      setActuationMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to send chute command.',
      });
    } finally {
      setActuating(false);
    }
  };

  const addBatchFiles = (incoming: File[]) => {
    const errors: string[] = [];
    const nextEntries: Array<{ file: File; previewUrl: string }> = [];

    for (const file of incoming) {
      if (batchFiles.length + nextEntries.length >= MAX_BATCH_FILES) {
        errors.push(`Maximum batch size is ${MAX_BATCH_FILES} images.`);
        break;
      }
      const err = validateImageFile(file);
      if (err) {
        errors.push(err);
      } else {
        nextEntries.push({
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    }

    if (nextEntries.length > 0) {
      setBatchFiles((prev) => [...prev, ...nextEntries]);
      setBatchResult(null);
    }
    setBatchError(errors.length > 0 ? errors.join(' ') : null);
  };

  const handleRemoveBatchIndex = (index: number) => {
    setBatchFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
    setBatchResult(null);
  };

  const handleClearBatch = () => {
    batchFiles.forEach((b) => URL.revokeObjectURL(b.previewUrl));
    setBatchFiles([]);
    setBatchResult(null);
    setBatchError(null);
    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  const handleLoadSampleBatch = async () => {
    setBatchSamplesLoading(true);
    setBatchError(null);
    try {
      const loaded = await Promise.all(
        SAMPLE_PRESETS.map(async (preset) => {
          const res = await fetch(preset.src);
          if (!res.ok) throw new Error(`Failed to fetch ${preset.label}`);
          const blob = await res.blob();
          return new File([blob], preset.filename, {
            type: blob.type || 'image/jpeg',
          });
        })
      );
      addBatchFiles(loaded);
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : 'Unable to load sample set.'
      );
    } finally {
      setBatchSamplesLoading(false);
    }
  };

  const handleRunBatch = async () => {
    if (batchFiles.length === 0 || batchLoading) return;
    setBatchLoading(true);
    setBatchError(null);
    try {
      const res = await predictBatchImages(batchFiles.map((b) => b.file));
      setBatchResult(res);
      onClassificationComplete();
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : 'Batch classification failed.'
      );
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExportBatchCsv = () => {
    if (!batchResult || batchResult.items.length === 0) return;
    const header = [
      'filename',
      'material_label',
      'routing_category',
      'confidence',
      'is_uncertain',
      'latency_ms',
    ].join(',');
    const rows = batchResult.items.map((item) =>
      [
        `"${(item.filename || '').replace(/"/g, '""')}"`,
        `"${item.material_label}"`,
        `"${item.routing_category}"`,
        item.confidence.toFixed(4),
        item.is_uncertain ? 'true' : 'false',
        item.inference_latency_ms.toFixed(2),
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wasto-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sortedScores = prediction
    ? Object.entries(prediction.scores || {}).sort((a, b) => b[1] - a[1])
    : [];

  const handleTabKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveTab((prev) => (prev === 'single' ? 'batch' : 'single'));
    }
  };

  const canSendToSorter =
    Boolean(prediction) &&
    !prediction?.is_uncertain &&
    !isResultStale &&
    modeInfo.apiReachable &&
    modeInfo.hwArmed;

  const sorterHelperText = !prediction
    ? ''
    : prediction.is_uncertain
      ? 'Sort command is locked while item requires manual review.'
      : isResultStale
        ? 'Run Classify image on the current photo before sending a chute command.'
        : !modeInfo.apiReachable
          ? 'Sorter control requires an active backend connection.'
          : !modeInfo.hwArmed
            ? 'Sorter is disarmed. Arm hardware in Live monitor before actuating.'
            : modeInfo.isSimulatedHw
              ? 'Software simulator will log this chute angle.'
              : 'Hardware is armed and ready.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classify waste."
        description="Add a photo to identify the material and review its sorting destination."
        modeInfo={modeInfo}
      />

      {/* Mode Tabs */}
      <div
        role="tablist"
        aria-label="Classification mode"
        onKeyDown={handleTabKeyDown}
        className="inline-flex p-1 rounded-[10px] bg-[#EEF2EB] border border-[#DCE3DA] gap-1"
      >
        <button
          id={singleTabId}
          role="tab"
          type="button"
          aria-selected={activeTab === 'single'}
          aria-controls={singlePanelId}
          tabIndex={activeTab === 'single' ? 0 : -1}
          onClick={() => setActiveTab('single')}
          className={`inline-flex items-center gap-2 px-4 min-h-[40px] rounded-[8px] text-[14px] font-medium transition-colors ${
            activeTab === 'single'
              ? 'bg-[#FFFFFF] text-[#18251D] shadow-floating border border-[#DCE3DA]'
              : 'text-[#526158] hover:text-[#18251D] border border-transparent'
          }`}
        >
          <FileImage size={16} strokeWidth={1.85} aria-hidden="true" />
          <span>Single image</span>
        </button>

        <button
          id={batchTabId}
          role="tab"
          type="button"
          aria-selected={activeTab === 'batch'}
          aria-controls={batchPanelId}
          tabIndex={activeTab === 'batch' ? 0 : -1}
          onClick={() => setActiveTab('batch')}
          className={`inline-flex items-center gap-2 px-4 min-h-[40px] rounded-[8px] text-[14px] font-medium transition-colors ${
            activeTab === 'batch'
              ? 'bg-[#FFFFFF] text-[#18251D] shadow-floating border border-[#DCE3DA]'
              : 'text-[#526158] hover:text-[#18251D] border border-transparent'
          }`}
        >
          <Layers size={16} strokeWidth={1.85} aria-hidden="true" />
          <span>Batch upload</span>
        </button>
      </div>

      {/* SINGLE IMAGE WORKSPACE */}
      {activeTab === 'single' && (
        <div
          id={singlePanelId}
          role="tabpanel"
          aria-labelledby={singleTabId}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left: Upload & Samples (wider column 7/12) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-5">
              <input
                ref={singleInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose image to classify"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setNewSingleFile(file, null);
                }}
              />

              {!selectedFile ? (
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) setNewSingleFile(file, null);
                  }}
                  className={`border border-dashed rounded-[16px] px-6 py-10 sm:py-12 text-center transition-colors ${
                    dragActive
                      ? 'border-[#245C3B] bg-[#E5EFE4]/40'
                      : 'border-[#DCE3DA] bg-[#F7F8F4]/55'
                  }`}
                >
                  <div className="w-11 h-11 rounded-[10px] bg-[#FFFFFF] border border-[#DCE3DA] text-[#245C3B] flex items-center justify-center mx-auto mb-3.5">
                    <Upload size={20} strokeWidth={1.85} aria-hidden="true" />
                  </div>
                  <p className="text-[16px] font-semibold text-[#18251D]">
                    Drop a waste photo here
                  </p>
                  <p className="text-[14px] text-[#526158] mt-1">
                    JPEG, PNG, or WEBP · up to 15 MB per image
                  </p>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => singleInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[14px] font-medium transition-colors"
                    >
                      <FolderOpen size={16} strokeWidth={1.85} aria-hidden="true" />
                      <span>Choose image</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[16px] border border-[#DCE3DA] bg-[#F7F8F4] overflow-hidden p-3 flex items-center justify-center">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt={`Selected waste item: ${selectedFile.name}`}
                        className="max-h-[340px] w-full object-contain rounded-[8px]"
                      />
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#18251D] truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[12px] text-[#526158] tabular-nums">
                        {formatBytes(selectedFile.size)}
                        {activeSampleId ? ' · Sample dataset photo' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => singleInputRef.current?.click()}
                        className="px-3.5 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[13px] font-medium transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSingleFile}
                        className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#FDF2F1] hover:border-[#EBC5C2] text-[#B33D35] text-[13px] font-medium transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={1.85} aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Thumbnails */}
              <div className="pt-4 border-t border-[#DCE3DA]">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <p className="text-[14px] font-medium text-[#18251D]">
                    Try a sample photo
                  </p>
                  <p className="text-[12px] text-[#526158]">
                    Real evaluation dataset images
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {SAMPLE_PRESETS.map((preset) => {
                    const isSelected = activeSampleId === preset.id;
                    const isBusy = sampleLoadingId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleChooseSample(preset)}
                        disabled={sampleLoadingId !== null}
                        aria-pressed={isSelected}
                        className={`text-left p-2 rounded-[8px] border transition-colors min-h-[44px] flex flex-col gap-2 ${
                          isSelected
                            ? 'bg-[#E5EFE4] border-[#245C3B] text-[#19452B]'
                            : 'bg-[#FFFFFF] border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D]'
                        }`}
                      >
                        <div className="w-full h-20 rounded-[6px] overflow-hidden bg-[#EEF2EB] border border-[#DCE3DA]/60">
                          <img
                            src={preset.src}
                            alt={preset.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="px-0.5">
                          <p className="text-[13px] font-medium leading-tight">
                            {isBusy ? 'Loading…' : preset.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRunSingle}
                  disabled={!selectedFile || singleLoading}
                  className="w-full sm:w-auto shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 px-6 min-h-[48px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] disabled:bg-[#DCE3DA] disabled:text-[#526158] text-white text-[15px] font-medium transition-colors"
                >
                  {singleLoading && (
                    <Loader2
                      size={17}
                      strokeWidth={2}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {singleLoading ? 'Analyzing image…' : 'Classify image'}
                  </span>
                </button>

                <span className="text-[13px] text-[#526158]">
                  {!selectedFile
                    ? 'Select or upload a photo to enable classification.'
                    : isResultStale
                      ? 'New image ready to classify.'
                      : 'Ready to run material identification.'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Classification Result (5/12) */}
          <div className="lg:col-span-5">
            <div
              ref={resultHeadingRef}
              tabIndex={-1}
              aria-live="polite"
              className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-4 focus:outline-none"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCE3DA]">
                <h2 className="text-[20px] font-semibold text-[#18251D]">
                  Classification result
                </h2>
                {singleLoading && (
                  <span className="text-[12px] font-medium text-[#245C3B] inline-flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    <span>Updating…</span>
                  </span>
                )}
              </div>

              {singleError && (
                <StatusNotice
                  tone="error"
                  role="alert"
                  title="Could not classify image"
                  stackAction
                  action={
                    selectedFile ? (
                      <button
                        type="button"
                        onClick={handleRunSingle}
                        disabled={singleLoading}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-[8px] bg-[#FFFFFF] border border-[#EBC5C2] text-[#962E27] text-[13px] font-medium hover:bg-[#FDF2F1]"
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        <span>Try again</span>
                      </button>
                    ) : undefined
                  }
                >
                  {singleError}
                </StatusNotice>
              )}

              {!prediction ? (
                <div className="py-3 space-y-3">
                  <p className="text-[15px] font-medium text-[#18251D]">
                    Waiting for an image classification
                  </p>
                  <p className="text-[14px] text-[#526158] leading-[1.55]">
                    After running classification, this panel reports the detected
                    material class, its assigned sorting destination, model
                    confidence, and handling guidance.
                  </p>
                  <ul className="pt-2 space-y-2 text-[13px] text-[#526158] border-t border-[#DCE3DA]">
                    <li>• Predictions under 60% confidence stay held for review.</li>
                    <li>• Items close between two classes also trigger manual review.</li>
                    <li>• Non-organic materials are blocked from compost routing.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  {isResultStale && (
                    <StatusNotice
                      tone="warning"
                      stackAction
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            setPrediction(null);
                            setPredictionFileKey(null);
                            setActuationMessage(null);
                            setDetailsOpen(false);
                          }}
                          className="px-3 min-h-[38px] rounded-[8px] bg-[#FFFFFF] border border-[#EAD4AA] text-[#754909] text-[12px] font-medium hover:bg-[#FDF7EC]"
                        >
                          Clear result
                        </button>
                      }
                    >
                      Showing result from the previous image ({prediction.filename}).
                      Choose <strong>Classify image</strong> to inspect your current photo.
                    </StatusNotice>
                  )}

                  {prediction.is_demo_fixture && (
                    <StatusNotice tone="info">
                      Deterministic sample result shown because the backend API is
                      offline.
                    </StatusNotice>
                  )}

                  {/* Uncertain Abstention Banner vs Material Identity First */}
                  {prediction.is_uncertain ? (
                    <div className="p-4 rounded-[12px] bg-[#FDF7EC] border border-[#EAD4AA] space-y-2">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#8A570B]">
                        Manual review needed
                      </p>
                      <h3 className="text-[22px] font-semibold text-[#18251D] leading-snug">
                        We couldn&apos;t confidently identify this item
                      </h3>
                      <p className="text-[14px] text-[#526158] leading-[1.5]">
                        {prediction.uncertainty_reason ||
                          `Top candidate (${prediction.material_label}) did not clear the safety confidence threshold.`}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#526158]">
                        Identified material
                      </p>
                      <h3 className="text-[26px] font-semibold text-[#18251D] leading-[1.2] mt-1">
                        {prediction.material_label}
                      </h3>
                    </div>
                  )}

                  {/* Sorting Destination Separated Clearly */}
                  <div className="pt-3 border-t border-[#DCE3DA] flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-[#526158]">
                        Sorting destination
                      </p>
                      <div className="mt-1.5">
                        <CategoryBadge category={prediction.routing_category} />
                      </div>
                      <p className="text-[12px] text-[#526158] mt-1">
                        {ROUTING_CATEGORY_META[prediction.routing_category].chuteLabel}
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <p className="text-[12px] font-medium text-[#526158]">
                        Confidence
                      </p>
                      <p className="text-[28px] font-semibold leading-tight text-[#18251D] tabular-nums mt-0.5">
                        {(prediction.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <div className="w-full h-2 rounded-full bg-[#EEF2EB] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, prediction.confidence * 100))}%`,
                        backgroundColor: prediction.is_uncertain
                          ? '#8A570B'
                          : ROUTING_CATEGORY_META[prediction.routing_category].barColor,
                      }}
                    />
                  </div>

                  {/* Guidance */}
                  <div className="p-3.5 rounded-[8px] bg-[#F7F8F4] border border-[#DCE3DA]">
                    <p className="text-[12px] font-medium text-[#526158]">
                      Handling guidance
                    </p>
                    <p className="text-[14px] text-[#18251D] leading-[1.5] mt-1">
                      {prediction.disposal_guidance}
                    </p>
                  </div>

                  {/* Secondary Sorter Actuation Action */}
                  <div className="pt-3 border-t border-[#DCE3DA] space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleHardwareSort}
                        disabled={!canSendToSorter || actuating}
                        className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] disabled:bg-[#EEF2EB]/60 disabled:text-[#526158] disabled:cursor-not-allowed text-[#18251D] text-[14px] font-medium transition-colors"
                      >
                        <Cpu size={16} strokeWidth={1.85} aria-hidden="true" />
                        <span>
                          {actuating ? 'Sending sort command…' : 'Send to sorter'}
                        </span>
                      </button>
                      <span className="text-[12px] text-[#526158] leading-[1.4]">
                        {sorterHelperText}
                      </span>
                    </div>

                    {actuationMessage && (
                      <StatusNotice tone={actuationMessage.tone}>
                        {actuationMessage.text}
                      </StatusNotice>
                    )}
                  </div>

                  {/* Expandable Prediction Details */}
                  <div className="pt-2 border-t border-[#DCE3DA]">
                    <button
                      type="button"
                      onClick={() => setDetailsOpen((prev) => !prev)}
                      aria-expanded={detailsOpen}
                      className="w-full min-h-[44px] flex items-center justify-between px-3 rounded-[8px] text-[14px] font-medium text-[#18251D] bg-[#F7F8F4] hover:bg-[#EEF2EB] border border-[#DCE3DA] transition-colors"
                    >
                      <span>Prediction details</span>
                      <ChevronDown
                        size={16}
                        strokeWidth={1.85}
                        className={`text-[#526158] transition-transform ${
                          detailsOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {detailsOpen && (
                      <div className="mt-3 p-4 rounded-[8px] bg-[#F7F8F4] border border-[#DCE3DA] space-y-4">
                        <div className="space-y-2">
                          <p className="text-[12px] font-semibold text-[#526158]">
                            Class probability distribution
                          </p>
                          <div className="space-y-2">
                            {sortedScores.map(([cls, score]) => (
                              <div key={cls} className="space-y-1">
                                <div className="flex justify-between text-[12px]">
                                  <span
                                    className={
                                      cls === prediction.material_label
                                        ? 'font-semibold text-[#18251D]'
                                        : 'text-[#526158]'
                                    }
                                  >
                                    {cls}
                                  </span>
                                  <span className="font-medium text-[#18251D] tabular-nums">
                                    {(score * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-[#DCE3DA]/70 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(1, score * 100)}%`,
                                      backgroundColor:
                                        cls === prediction.material_label
                                          ? '#245C3B'
                                          : '#526158',
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <dl className="pt-3 border-t border-[#DCE3DA] space-y-1.5 text-[12px]">
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#526158]">Prediction ID</dt>
                            <dd className="font-mono text-[#18251D] truncate max-w-[200px]">
                              {prediction.prediction_id}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#526158]">Policy version</dt>
                            <dd className="font-mono text-[#18251D]">
                              {prediction.routing_policy_version}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#526158]">Inference time</dt>
                            <dd className="text-[#18251D] tabular-nums">
                              {prediction.inference_latency_ms.toFixed(1)} ms
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BATCH UPLOAD WORKSPACE */}
      {activeTab === 'batch' && (
        <div
          id={batchPanelId}
          role="tabpanel"
          aria-labelledby={batchTabId}
          className="space-y-6"
        >
          <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-5">
            <input
              ref={batchInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Choose multiple images for batch classification"
              onChange={(e) => {
                if (e.target.files) addBatchFiles(Array.from(e.target.files));
              }}
            />

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setBatchDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setBatchDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setBatchDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setBatchDragActive(false);
                if (e.dataTransfer.files) {
                  addBatchFiles(Array.from(e.dataTransfer.files));
                }
              }}
              className={`border border-dashed rounded-[16px] px-6 py-8 text-center transition-colors ${
                batchDragActive
                  ? 'border-[#245C3B] bg-[#E5EFE4]/40'
                  : 'border-[#DCE3DA] bg-[#F7F8F4]/55'
              }`}
            >
              <p className="text-[16px] font-semibold text-[#18251D]">
                Add multiple waste photos
              </p>
              <p className="text-[14px] text-[#526158] mt-1">
                JPEG, PNG, or WEBP · up to 50 images per batch, 15 MB each
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => batchInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[14px] font-medium transition-colors"
                >
                  <FolderOpen size={16} strokeWidth={1.85} aria-hidden="true" />
                  <span>Choose files</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleBatch}
                  disabled={batchSamplesLoading}
                  className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#245C3B] text-[14px] font-medium transition-colors"
                >
                  <span>
                    {batchSamplesLoading ? 'Loading samples…' : 'Load 4 sample photos'}
                  </span>
                </button>
              </div>
            </div>

            {batchError && (
              <StatusNotice tone="error" role="alert">
                {batchError}
              </StatusNotice>
            )}

            {batchFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[14px] font-medium text-[#18251D] tabular-nums">
                    {batchFiles.length} image{batchFiles.length === 1 ? '' : 's'} queued
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleClearBatch}
                      className="px-3.5 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#526158] hover:text-[#18251D] text-[13px] font-medium transition-colors"
                    >
                      Clear queue
                    </button>
                    <button
                      type="button"
                      onClick={handleRunBatch}
                      disabled={batchLoading}
                      className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] disabled:bg-[#DCE3DA] disabled:text-[#526158] text-white text-[14px] font-medium transition-colors"
                    >
                      {batchLoading && (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      )}
                      <span>
                        {batchLoading
                          ? `Classifying ${batchFiles.length} images…`
                          : `Classify batch (${batchFiles.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="border border-[#DCE3DA] rounded-[8px] divide-y divide-[#DCE3DA] max-h-[280px] overflow-y-auto">
                  {batchFiles.map((entry, idx) => (
                    <div
                      key={`${entry.file.name}-${idx}`}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-[#FFFFFF]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={entry.previewUrl}
                          alt={entry.file.name}
                          className="w-10 h-10 rounded-[6px] object-cover border border-[#DCE3DA] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-[#18251D] truncate">
                            {entry.file.name}
                          </p>
                          <p className="text-[12px] text-[#526158] tabular-nums">
                            {formatBytes(entry.file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBatchIndex(idx)}
                        aria-label={`Remove ${entry.file.name}`}
                        className="min-w-[44px] min-h-[44px] rounded-[8px] flex items-center justify-center text-[#526158] hover:text-[#B33D35] hover:bg-[#FDF2F1] transition-colors shrink-0"
                      >
                        <Trash2 size={16} strokeWidth={1.85} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {batchResult && (
            <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-5">
              {batchResult.is_demo_fixture && (
                <StatusNotice tone="info">
                  Deterministic batch results shown because the backend API is
                  offline.
                </StatusNotice>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#DCE3DA]">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#18251D]">
                    Batch summary
                  </h2>
                  <p className="text-[13px] text-[#526158] tabular-nums mt-0.5">
                    Processed {batchResult.total_items} item
                    {batchResult.total_items === 1 ? '' : 's'} · Avg{' '}
                    {batchResult.average_latency_ms.toFixed(1)} ms/image
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBatchCsv}
                  className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[14px] font-medium transition-colors self-start sm:self-auto"
                >
                  <Download size={16} strokeWidth={1.85} aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#DCE3DA] rounded-[8px] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE3DA]">
                <div className="p-4">
                  <p className="text-[12px] text-[#526158]">Processed</p>
                  <p className="text-[24px] font-semibold text-[#18251D] tabular-nums mt-1">
                    {batchResult.success_count}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[12px] text-[#526158]">Failed</p>
                  <p className="text-[24px] font-semibold text-[#18251D] tabular-nums mt-1">
                    {batchResult.failure_count}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[12px] text-[#526158]">Needs review</p>
                  <p className="text-[24px] font-semibold text-[#8A570B] tabular-nums mt-1">
                    {batchResult.items.filter((i) => i.is_uncertain).length}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[12px] text-[#526158]">Total time</p>
                  <p className="text-[24px] font-semibold text-[#18251D] tabular-nums mt-1">
                    {batchResult.total_latency_ms.toFixed(0)} ms
                  </p>
                </div>
              </div>

              {batchResult.failures.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[14px] font-semibold text-[#B33D35] flex items-center gap-1.5">
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>Failed items ({batchResult.failures.length})</span>
                  </h3>
                  <ul className="border border-[#EBC5C2] rounded-[8px] divide-y divide-[#EBC5C2] bg-[#FDF2F1] text-[13px]">
                    {batchResult.failures.map((f, idx) => (
                      <li key={idx} className="px-3.5 py-2.5 flex justify-between gap-3">
                        <span className="font-medium text-[#18251D]">{f.filename}</span>
                        <span className="text-[#852721]">{f.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE3DA] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#526158]">
                      <th className="py-3 pr-4">File</th>
                      <th className="py-3 pr-4">Material</th>
                      <th className="py-3 pr-4">Destination</th>
                      <th className="py-3 pr-4">Confidence</th>
                      <th className="py-3 text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3DA] text-[14px]">
                    {batchResult.items.map((item) => (
                      <tr key={item.prediction_id}>
                        <td className="py-3 pr-4 font-medium text-[#18251D] max-w-[200px] truncate">
                          {item.filename}
                        </td>
                        <td className="py-3 pr-4 text-[#18251D]">
                          {item.is_uncertain ? 'Uncertain item' : item.material_label}
                        </td>
                        <td className="py-3 pr-4">
                          <CategoryBadge category={item.routing_category} size="sm" />
                        </td>
                        <td className="py-3 pr-4 tabular-nums font-medium text-[#18251D]">
                          {(item.confidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 text-right tabular-nums text-[#526158]">
                          {item.inference_latency_ms.toFixed(1)} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
