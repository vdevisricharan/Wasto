import React, { useState, useRef } from 'react';
import {
  Upload,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  FileText,
  Download,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { predictSingleImage, predictBatchImages, actuateFlap } from '../api/client';
import { PredictionResult, BatchPredictionResult, RoutingCategory } from '../types';

export const ClassifyView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single Image State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [singleResult, setSingleResult] = useState<PredictionResult | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [actuationState, setActuationState] = useState<{ status: string; message?: string } | null>(null);
  const [isActuating, setIsActuating] = useState(false);

  // Batch State
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchPredictionResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers: Single Image ---

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSingleError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setSingleError('File exceeds 15MB size limit.');
      return;
    }

    setSingleError(null);
    setSingleResult(null);
    setActuationState(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setSingleError(null);
    setActuationState(null);

    try {
      const res = await predictSingleImage(selectedFile);
      setSingleResult(res);
    } catch (err: any) {
      setSingleError(err.message || 'Inference failed. Check API health.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSampleSelect = async (sampleType: 'glass' | 'plastic' | 'paper' | 'organic') => {
    // Generate synthetic canvas sample with recognizable color/texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sampleType === 'glass') {
      ctx.fillStyle = '#60a5fa'; // Blue tint
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(80, 40, 96, 176); // Bottle shape
    } else if (sampleType === 'plastic') {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(60, 50, 136, 156);
    } else if (sampleType === 'paper') {
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(40, 40, 176, 176);
    } else {
      ctx.fillStyle = '#10b981'; // Organic green
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#047857';
      ctx.arc(128, 128, 70, 0, Math.PI * 2);
      ctx.fill();
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `sample_${sampleType}.jpg`, { type: 'image/jpeg' });
        handleFileSelect(file);
      }
    }, 'image/jpeg');
  };

  const handleActuateSort = async () => {
    if (!singleResult) return;
    setIsActuating(true);
    setActuationState(null);

    let bin = 'NONE';
    if (singleResult.routing_category === 'Organic') bin = 'ORGANIC';
    else if (singleResult.routing_category === 'Recyclable') bin = 'RECYCLABLE';
    else if (singleResult.routing_category === 'Residual') bin = 'RESIDUAL';

    try {
      const res = await actuateFlap(bin, 1200, singleResult.prediction_id);
      setActuationState({ status: 'SUCCESS', message: `Flap actuated to ${bin} chute (${res.status})` });
    } catch (e: any) {
      setActuationState({ status: 'FAILED', message: e.message || 'Actuation failed' });
    } finally {
      setIsActuating(false);
    }
  };

  // --- Handlers: Batch Processing ---

  const handleBatchFileSelect = (files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 50);
    setBatchFiles(valid);
    setBatchResult(null);
    setBatchError(null);
  };

  const handleRunBatch = async () => {
    if (batchFiles.length === 0) return;
    setIsBatchProcessing(true);
    setBatchError(null);
    try {
      const res = await predictBatchImages(batchFiles);
      setBatchResult(res);
    } catch (e: any) {
      setBatchError(e.message || 'Batch classification error.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const exportBatchCsv = () => {
    if (!batchResult) return;
    const rows = [
      ['Filename', 'Status', 'Material Label', 'Confidence', 'Routing Category', 'Is Uncertain', 'Uncertainty Reason'],
      ...batchResult.items.map(item => [
        item.filename,
        'SUCCESS',
        item.material_label,
        item.confidence.toFixed(4),
        item.routing_category,
        item.is_uncertain ? 'YES' : 'NO',
        item.uncertainty_reason || '',
      ]),
      ...batchResult.failures.map(fail => [
        fail.filename,
        'FAILED',
        '',
        '',
        '',
        '',
        fail.error,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wasto_batch_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Routing category badge helper
  const renderRoutingBadge = (cat: RoutingCategory) => {
    switch (cat) {
      case 'Organic':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Chute 1: Organic (Compost)</span>;
      case 'Recyclable':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">Chute 2: Recyclable</span>;
      case 'Residual':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Chute 3: Residual Waste</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Manual Review Required</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Tab Switcher */}
      <div className="flex border-b border-gray-800 space-x-6">
        <button
          onClick={() => setActiveTab('single')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'single'
              ? 'border-wasto-500 text-wasto-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Single Item Classification</span>
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'batch'
              ? 'border-wasto-500 text-wasto-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Bulk & Batch Processing</span>
        </button>
      </div>

      {activeTab === 'single' ? (
        /* SINGLE IMAGE WORKFLOW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload & Sample Pickers (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="glass-card border-2 border-dashed border-gray-700 hover:border-wasto-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {previewUrl ? (
                <div className="space-y-3 w-full">
                  <img
                    src={previewUrl}
                    alt={selectedFile?.name ? `Uploaded waste classification sample: ${selectedFile.name}` : "Uploaded waste classification sample preview"}
                    className="max-h-52 mx-auto rounded-xl object-contain shadow-lg"
                  />
                  <p className="text-xs text-gray-400 font-mono truncate">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-3 text-gray-400 group-hover:text-gray-200 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-gray-700 flex items-center justify-center mx-auto text-wasto-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Click or drag image to classify</p>
                    <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WEBP (Max 15MB)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Test Samples */}
            <div className="glass-card p-4 rounded-xl border border-gray-800 space-y-2">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-wasto-400" />
                Quick Test Samples:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSampleSelect('glass')}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-surface-800 hover:bg-surface-700 text-gray-300 border border-gray-700 text-left truncate"
                >
                  Glass Bottle
                </button>
                <button
                  type="button"
                  onClick={() => handleSampleSelect('plastic')}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-surface-800 hover:bg-surface-700 text-gray-300 border border-gray-700 text-left truncate"
                >
                  Plastic Container
                </button>
                <button
                  type="button"
                  onClick={() => handleSampleSelect('paper')}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-surface-800 hover:bg-surface-700 text-gray-300 border border-gray-700 text-left truncate"
                >
                  Cardboard Box
                </button>
                <button
                  type="button"
                  onClick={() => handleSampleSelect('organic')}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-surface-800 hover:bg-surface-700 text-gray-300 border border-gray-700 text-left truncate"
                >
                  Organic Leaf
                </button>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunInference}
              disabled={!selectedFile || isProcessing}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-2 ${
                !selectedFile || isProcessing
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-wasto-500 text-surface-900 hover:bg-wasto-400 shadow-lg shadow-wasto-500/20 active:scale-98'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full animate-spin"></div>
                  <span>Evaluating MobileNetV3...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Run Waste Inference</span>
                </>
              )}
            </button>

            {singleError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{singleError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Prediction Details & Flap Actuation (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {singleResult ? (
              <div className="glass-card rounded-2xl p-6 border border-gray-800 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      {singleResult.material_label}
                    </h2>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {singleResult.prediction_id}</p>
                  </div>
                  <div>{renderRoutingBadge(singleResult.routing_category)}</div>
                </div>

                {/* Score & Confidence */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-surface-800/80 border border-gray-700/60 text-xs">
                  <div>
                    <span className="text-gray-400">Confidence Score:</span>
                    <p className="text-lg font-bold text-wasto-400 font-mono">
                      {(singleResult.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Inference Latency:</span>
                    <p className="text-lg font-bold text-gray-200 font-mono">
                      {singleResult.inference_latency_ms.toFixed(1)} ms
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-400">Abstention Status:</span>
                    <p className={`text-sm font-semibold ${singleResult.is_uncertain ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {singleResult.is_uncertain ? 'Uncertain / Flagged' : 'High Confidence'}
                    </p>
                  </div>
                </div>

                {/* Uncertainty Alert if flagged */}
                {singleResult.is_uncertain && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Failsafe Abstention Triggered</span>
                    </div>
                    <p className="text-rose-400/90">{singleResult.uncertainty_reason}</p>
                  </div>
                )}

                {/* Disposal Guidance */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-400">Operational Guidance:</span>
                  <div className="p-3.5 rounded-xl bg-surface-800/50 border border-gray-700 text-xs text-gray-200 leading-relaxed">
                    {singleResult.disposal_guidance}
                  </div>
                </div>

                {/* 9-Class Distribution Bar Chart */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span className="font-semibold">Full 9-Class Softmax Distribution:</span>
                    <span className="font-mono text-[10px]">Model Output</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(singleResult.scores)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cls, score]) => (
                        <div key={cls} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-300 font-medium">{cls}</span>
                            <span className="font-mono text-gray-400">{(score * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-surface-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cls === singleResult.material_label ? 'bg-wasto-500' : 'bg-gray-600'
                              }`}
                              style={{ width: `${Math.max(1, score * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Physical/Simulated Hardware Flap Trigger */}
                <div className="pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-white block">Mechanical Sorter Actuation</span>
                    <p className="text-[11px] text-gray-400">Dispatch serial command to Arduino servo flap</p>
                  </div>
                  <button
                    onClick={handleActuateSort}
                    disabled={isActuating}
                    className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 border border-gray-700 text-xs font-semibold text-wasto-400 hover:text-wasto-300 transition-all flex items-center space-x-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{isActuating ? 'Actuating Flap...' : 'Trigger Flap Deflection'}</span>
                  </button>
                </div>

                {actuationState && (
                  <div
                    className={`p-3 rounded-xl text-xs font-mono flex items-center space-x-2 ${
                      actuationState.status === 'SUCCESS'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{actuationState.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-12 border border-gray-800 text-center space-y-3 min-h-[350px] flex flex-col items-center justify-center text-gray-500">
                <Layers className="w-10 h-10 text-gray-600 animate-pulse" />
                <p className="text-sm font-medium text-gray-400">No image evaluated yet</p>
                <p className="text-xs text-gray-500 max-w-sm">
                  Upload an image on the left or select a sample to observe real MobileNetV3 inference.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* BATCH PROCESSING WORKFLOW */
        <div className="space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleBatchFileSelect(e.dataTransfer.files);
            }}
            onClick={() => batchInputRef.current?.click()}
            className="glass-card border-2 border-dashed border-gray-700 hover:border-wasto-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
          >
            <input
              ref={batchInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => e.target.files && handleBatchFileSelect(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-gray-700 flex items-center justify-center text-wasto-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Select multiple images for batch processing</p>
              <p className="text-xs text-gray-400 mt-1">Up to 50 images per batch (Partial failure isolated)</p>
            </div>
            {batchFiles.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-wasto-500/20 text-wasto-400 border border-wasto-500/30 text-xs font-mono">
                {batchFiles.length} files selected
              </span>
            )}
          </div>

          {batchFiles.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={handleRunBatch}
                disabled={isBatchProcessing}
                className="px-6 py-2.5 rounded-xl bg-wasto-500 text-surface-900 font-semibold text-sm hover:bg-wasto-400 transition-all flex items-center space-x-2"
              >
                {isBatchProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Run Batch Inference ({batchFiles.length})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {batchError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {batchError}
            </div>
          )}

          {/* Batch Results View */}
          {batchResult && (
            <div className="space-y-6">
              {/* Batch Aggregates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400">Processed</span>
                  <p className="text-2xl font-bold font-mono text-white">{batchResult.total_items}</p>
                </div>
                <div className="glass-card p-4 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400">Success / Failed</span>
                  <p className="text-2xl font-bold font-mono text-emerald-400">
                    {batchResult.success_count} / <span className="text-rose-400">{batchResult.failure_count}</span>
                  </p>
                </div>
                <div className="glass-card p-4 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400">Total Latency</span>
                  <p className="text-2xl font-bold font-mono text-white">{batchResult.total_latency_ms.toFixed(0)} ms</p>
                </div>
                <div className="glass-card p-4 rounded-xl border border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400">Export Report</span>
                    <p className="text-xs font-mono text-wasto-400">CSV Spreadsheet</p>
                  </div>
                  <button
                    onClick={exportBatchCsv}
                    className="p-2.5 rounded-lg bg-surface-800 hover:bg-surface-700 border border-gray-700 text-white"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-white">Batch Items ({batchResult.items.length})</h3>
                </div>
                <div className="divide-y divide-gray-800/60 max-h-96 overflow-y-auto">
                  {batchResult.items.map((item, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between text-xs hover:bg-surface-800/40">
                      <div className="space-y-0.5">
                        <span className="font-mono text-gray-200">{item.filename}</span>
                        <div className="flex gap-2 text-gray-400">
                          <span>Pred: {item.material_label}</span>
                          <span>•</span>
                          <span>{(item.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div>{renderRoutingBadge(item.routing_category)}</div>
                    </div>
                  ))}
                  {batchResult.failures.map((fail, idx) => (
                    <div key={`fail-${idx}`} className="p-4 flex items-center justify-between text-xs bg-rose-500/5">
                      <span className="font-mono text-rose-400">{fail.filename}</span>
                      <span className="text-rose-400">{fail.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
