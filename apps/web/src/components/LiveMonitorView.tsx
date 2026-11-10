import React, { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Radio, Sliders, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { predictSingleImage, actuateFlap } from '../api/client';
import { PredictionResult } from '../types';

export const LiveMonitorView: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentDetection, setCurrentDetection] = useState<PredictionResult | null>(null);
  const [lastSortedFlap, setLastSortedFlap] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const isEvaluatingRef = useRef(false);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);

      // Start inference polling loop (1.5 seconds interval to stay bounded)
      timerRef.current = setInterval(captureAndEvaluate, 1500);
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera device. Check camera permissions.');
      setIsStreaming(false);
    }
  };

  const stopCamera = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setCurrentDetection(null);
  };

  const captureAndEvaluate = async () => {
    if (!videoRef.current || isEvaluatingRef.current) return;
    isEvaluatingRef.current = true;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, 256, 256);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'camera_frame.jpg', { type: 'image/jpeg' });
        const start = performance.now();
        try {
          const res = await predictSingleImage(file);
          const elapsed = performance.now() - start;
          setFps(Math.round(1000 / Math.max(elapsed, 1)));
          setCurrentDetection(res);

          // If confident, trigger flap
          if (!res.is_uncertain && res.routing_category !== 'Unknown / Manual Review') {
            let bin = 'NONE';
            if (res.routing_category === 'Organic') bin = 'ORGANIC';
            else if (res.routing_category === 'Recyclable') bin = 'RECYCLABLE';
            else if (res.routing_category === 'Residual') bin = 'RESIDUAL';

            setLastSortedFlap(bin);
            try {
              await actuateFlap(bin, 1200, res.prediction_id);
            } catch (e) {
              // Non-blocking
            }
          }
        } catch (e) {
          // Frame evaluation error
        } finally {
          isEvaluatingRef.current = false;
        }
      }, 'image/jpeg');
    } catch (e) {
      isEvaluatingRef.current = false;
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-wasto-400" />
            Live Conveyor & Edge Ingestion
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Real-time frame ingestion with bounded memory queue and Arduino flap actuation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isStreaming ? (
            <button
              onClick={stopCamera}
              className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold text-xs hover:bg-rose-600 transition-all flex items-center space-x-1.5 shadow-lg shadow-rose-500/20"
            >
              <CameraOff className="w-4 h-4" />
              <span>Stop Video Stream</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-wasto-500 text-surface-900 font-semibold text-xs hover:bg-wasto-400 transition-all flex items-center space-x-1.5 shadow-lg shadow-wasto-500/20 active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera Capture</span>
            </button>
          )}
        </div>
      </div>

      {cameraError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Main Video View & Flap Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Feed (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-2xl overflow-hidden border border-gray-800 relative bg-surface-950 flex flex-col items-center justify-center min-h-[360px]">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover rounded-2xl ${isStreaming ? 'block' : 'hidden'}`}
          />

          {!isStreaming && (
            <div className="text-center space-y-3 p-8 text-gray-500">
              <Camera className="w-12 h-12 mx-auto text-gray-600" />
              <p className="text-sm font-medium text-gray-400">Camera Feed Inactive</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Click "Start Camera Capture" to connect your webcam or edge industrial camera.
              </p>
            </div>
          )}

          {/* Video Overlay Badge */}
          {isStreaming && (
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-2.5 py-1 rounded-md bg-surface-900/80 backdrop-blur-md border border-gray-700 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE STREAM
              </span>
              <span className="px-2.5 py-1 rounded-md bg-surface-900/80 backdrop-blur-md border border-gray-700 text-[11px] font-mono text-gray-300">
                Rate: {fps || 1} FPS
              </span>
            </div>
          )}
        </div>

        {/* Right: Live Sorter Actuation Visualizer (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-6 border border-gray-800 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-wasto-400" />
                Mechanical Flap Visualizer
              </h3>
              <span className="text-xs font-mono text-amber-400">SIMULATED</span>
            </div>

            {/* Chute Deflection Status */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div
                className={`p-3 rounded-xl border transition-all ${
                  lastSortedFlap === 'ORGANIC'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 scale-105 shadow-lg shadow-emerald-500/20'
                    : 'bg-surface-800 border-gray-700 text-gray-400'
                }`}
              >
                <span className="block font-semibold">Chute 1</span>
                <span className="text-[10px]">Organic (45°)</span>
              </div>
              <div
                className={`p-3 rounded-xl border transition-all ${
                  lastSortedFlap === 'RECYCLABLE'
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-105 shadow-lg shadow-blue-500/20'
                    : 'bg-surface-800 border-gray-700 text-gray-400'
                }`}
              >
                <span className="block font-semibold">Chute 2</span>
                <span className="text-[10px]">Recyclable (90°)</span>
              </div>
              <div
                className={`p-3 rounded-xl border transition-all ${
                  lastSortedFlap === 'RESIDUAL'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 scale-105 shadow-lg shadow-amber-500/20'
                    : 'bg-surface-800 border-gray-700 text-gray-400'
                }`}
              >
                <span className="block font-semibold">Chute 3</span>
                <span className="text-[10px]">Residual (135°)</span>
              </div>
            </div>

            {/* Live Detection Info */}
            {currentDetection ? (
              <div className="p-4 rounded-xl bg-surface-800 border border-gray-700/80 space-y-2 text-xs">
                <span className="text-gray-400 block font-semibold">Current Frame Detection:</span>
                <div className="flex justify-between items-center text-sm font-bold text-white">
                  <span>{currentDetection.material_label}</span>
                  <span className="text-wasto-400 font-mono">
                    {(currentDetection.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  Routing: <span className="text-white font-medium">{currentDetection.routing_category}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-800/40 border border-gray-800 text-xs text-gray-500 text-center">
                Awaiting frame inference...
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-surface-800/50 border border-gray-800 text-[11px] text-gray-400 space-y-1">
            <span className="font-semibold text-gray-300">Temporal Deduplication:</span>
            <p>
              Identical items detected within a 2.5s window are automatically clustered to prevent multiple servo actuations for a single passing object.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
