import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Lock,
  ShieldCheck,
  Video,
  VideoOff,
} from 'lucide-react';
import { PredictionResult, RoutingCategory } from '../types';
import {
  actuateFlap,
  armDevice,
  disarmDevice,
  predictSingleImage,
} from '../api/client';
import {
  OperationalModeInfo,
  ROUTING_CATEGORY_META,
} from '../theme/tokens';
import { CategoryBadge } from './ui/CategoryBadge';
import { PageHeader } from './ui/PageHeader';
import { StatusNotice } from './ui/StatusNotice';

interface LiveMonitorViewProps {
  modeInfo: OperationalModeInfo;
  onStatusChange: () => void;
}

interface SessionFrameEvent {
  id: string;
  time: string;
  material: string;
  routing: RoutingCategory;
  confidence: number;
  outcome: string;
  isUncertain: boolean;
}

const CHUTES: Array<{
  bin: 'ORGANIC' | 'RECYCLABLE' | 'RESIDUAL';
  category: RoutingCategory;
  angle: string;
  label: string;
}> = [
  { bin: 'ORGANIC', category: 'Organic', angle: '45°', label: 'Organic' },
  { bin: 'RECYCLABLE', category: 'Recyclable', angle: '90°', label: 'Recyclable' },
  { bin: 'RESIDUAL', category: 'Residual', angle: '135°', label: 'Residual' },
];

const ROUTING_TO_BIN: Record<RoutingCategory, string> = {
  Organic: 'ORGANIC',
  Recyclable: 'RECYCLABLE',
  Residual: 'RESIDUAL',
  'Unknown / Manual Review': 'NONE',
};

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({
  modeInfo,
  onStatusChange,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoActuate, setAutoActuate] = useState(false);
  const [armBusy, setArmBusy] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  const [latestPrediction, setLatestPrediction] =
    useState<PredictionResult | null>(null);
  const [analyzingFrame, setAnalyzingFrame] = useState(false);
  const [activeChute, setActiveChute] = useState<string | null>(null);
  const [lastCommandSummary, setLastCommandSummary] = useState<string>('None in session');
  const [sessionEvents, setSessionEvents] = useState<SessionFrameEvent[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  const lastActuationRef = useRef<{ category: string; timestamp: number }>({
    category: '',
    timestamp: 0,
  });

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = list.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (!selectedDeviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch {
      // Permission not granted yet; keep default camera option
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [refreshDevices]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const analyzeCurrentFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || isAnalyzingRef.current) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    isAnalyzingRef.current = true;
    setAnalyzingFrame(true);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) return;

      const file = new File([blob], 'live-frame.jpg', { type: 'image/jpeg' });
      const res = await predictSingleImage(file);
      setLatestPrediction(res);

      let outcome = 'Classified only';
      const now = Date.now();
      const targetBin = ROUTING_TO_BIN[res.routing_category];

      if (res.is_uncertain) {
        outcome = 'Held for review';
        setActiveChute(null);
      } else if (autoActuate && modeInfo.apiReachable && modeInfo.hwArmed) {
        const cooledDown =
          res.routing_category !== lastActuationRef.current.category ||
          now - lastActuationRef.current.timestamp > 2500;

        if (cooledDown && targetBin && targetBin !== 'NONE') {
          try {
            await actuateFlap(targetBin, 1000, res.prediction_id);
            lastActuationRef.current = {
              category: res.routing_category,
              timestamp: now,
            };
            setActiveChute(targetBin);
            const angle = ROUTING_CATEGORY_META[res.routing_category].servoAngle;
            setLastCommandSummary(`${targetBin} (${angle}) at ${new Date().toLocaleTimeString()}`);
            outcome = modeInfo.isSimulatedHw ? 'Simulated sort' : 'Chute actuated';
            onStatusChange();
          } catch {
            outcome = 'Sort failed';
          }
        } else {
          outcome = 'Deduplicated (<2.5s)';
        }
      }

      setSessionEvents((prev) => [
        {
          id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          material: res.is_uncertain ? 'Uncertain item' : res.material_label,
          routing: res.routing_category,
          confidence: res.confidence,
          outcome,
          isUncertain: res.is_uncertain,
        },
        ...prev.slice(0, 14),
      ]);
    } catch {
      // Errors during periodic frame poll are shown if user captures manually or API status updates
    } finally {
      isAnalyzingRef.current = false;
      setAnalyzingFrame(false);
    }
  }, [autoActuate, modeInfo.apiReachable, modeInfo.hwArmed, modeInfo.isSimulatedHw, onStatusChange]);

  useEffect(() => {
    if (!cameraActive) return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(analyzeCurrentFrame, 2500);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cameraActive, analyzeCurrentFrame]);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera capture is unavailable in this browser context. Check HTTPS or permissions.'
      );
      return;
    }

    try {
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      await refreshDevices();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to access the camera. Verify browser permissions.';
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  const handleToggleArm = async () => {
    if (!modeInfo.apiReachable || armBusy) return;
    setArmBusy(true);
    setHardwareError(null);
    try {
      if (modeInfo.hwArmed) {
        await disarmDevice();
        setActiveChute(null);
      } else {
        await armDevice();
      }
      onStatusChange();
    } catch (err) {
      setHardwareError(
        err instanceof Error ? err.message : 'Unable to update hardware arm state.'
      );
    } finally {
      setArmBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live monitor"
        description="Inspect frames from a local camera and supervise sorter actuation."
        modeInfo={modeInfo}
      />

      {/* Camera & Hardware Control Bar */}
      <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <div className="flex flex-col gap-1 min-w-[200px] sm:max-w-[260px] flex-1">
            <label
              htmlFor="camera-source-select"
              className="text-[12px] font-medium text-[#526158]"
            >
              Camera source
            </label>
            <select
              id="camera-source-select"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={cameraActive}
              className="min-h-[44px] px-3 rounded-[8px] border border-[#DCE3DA] bg-[#FFFFFF] text-[14px] text-[#18251D] disabled:bg-[#EEF2EB] disabled:text-[#526158]"
            >
              {devices.length === 0 ? (
                <option value="">Default camera</option>
              ) : (
                devices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label || `Camera ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:pt-5">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#245C3B] hover:bg-[#19452B] text-white text-[14px] font-medium transition-colors"
              >
                <Video size={16} strokeWidth={1.85} aria-hidden="true" />
                <span>Start camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FDF2F1] border border-[#EBC5C2] hover:bg-[#F9E3E1] text-[#962E27] text-[14px] font-medium transition-colors"
                >
                  <VideoOff size={16} strokeWidth={1.85} aria-hidden="true" />
                  <span>Stop camera</span>
                </button>
                <button
                  type="button"
                  onClick={analyzeCurrentFrame}
                  disabled={analyzingFrame}
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] bg-[#FFFFFF] border border-[#DCE3DA] hover:bg-[#EEF2EB] text-[#18251D] text-[14px] font-medium transition-colors"
                >
                  <Camera size={16} strokeWidth={1.85} aria-hidden="true" />
                  <span>{analyzingFrame ? 'Inspecting…' : 'Inspect frame now'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#DCE3DA] lg:pl-5">
          <label className="inline-flex items-center gap-2.5 min-h-[44px] text-[14px] text-[#18251D] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoActuate}
              onChange={(e) => setAutoActuate(e.target.checked)}
              disabled={!modeInfo.apiReachable}
              className="w-4 h-4 rounded accent-[#245C3B]"
            />
            <span>Auto-sort confident items</span>
          </label>

          <button
            type="button"
            onClick={handleToggleArm}
            disabled={!modeInfo.apiReachable || armBusy}
            className={`inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-[8px] border text-[14px] font-medium transition-colors ${
              modeInfo.hwArmed
                ? 'bg-[#E5EFE4] border-[#C5DBC2] text-[#19452B] hover:bg-[#D5E6D3]'
                : 'bg-[#FFFFFF] border-[#DCE3DA] text-[#18251D] hover:bg-[#EEF2EB]'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {modeInfo.hwArmed ? (
              <ShieldCheck size={16} strokeWidth={1.85} aria-hidden="true" />
            ) : (
              <Lock size={16} strokeWidth={1.85} aria-hidden="true" />
            )}
            <span>
              {!modeInfo.apiReachable
                ? 'Sorter offline'
                : modeInfo.hwArmed
                  ? 'Disarm sorter'
                  : 'Arm sorter'}
            </span>
          </button>
        </div>
      </section>

      {cameraError && (
        <StatusNotice tone="error" role="alert" title="Camera access issue">
          {cameraError}
        </StatusNotice>
      )}

      {hardwareError && (
        <StatusNotice tone="error" role="alert">
          {hardwareError}
        </StatusNotice>
      )}

      {/* 7:5 Split: Camera Feed + Classification/Hardware Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[18px] font-semibold text-[#18251D]">
              Camera feed
            </h2>
            <span className="text-[13px] font-medium text-[#526158]">
              {cameraActive ? 'Active · 2.5s inspection cycle' : 'Inactive'}
            </span>
          </div>

          <div className="relative aspect-video w-full rounded-[12px] overflow-hidden bg-[#18251D] border border-[#DCE3DA] flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!cameraActive && (
              <div className="text-center px-6 py-8 max-w-[340px] space-y-3">
                <div className="w-11 h-11 rounded-[10px] bg-[#245C3B]/25 text-[#E5EFE4] flex items-center justify-center mx-auto">
                  <CameraOff size={20} strokeWidth={1.85} aria-hidden="true" />
                </div>
                <p className="text-[15px] font-medium text-white">
                  Camera stream is inactive
                </p>
                <p className="text-[13px] text-[#DCE3DA]">
                  Start the camera to capture frames locally in your browser and
                  classify materials in real time.
                </p>
              </div>
            )}
          </div>

          <p className="text-[12px] text-[#526158]">
            Temporal deduplication waits 2.5 seconds before sending a repeat sort
            command for the same chute category.
          </p>
        </div>

        <div className="lg:col-span-5 space-y-5">
          {/* Classification Output Panel */}
          <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCE3DA]">
              <h2 className="text-[18px] font-semibold text-[#18251D]">
                Latest frame classification
              </h2>
              {analyzingFrame && (
                <span className="text-[12px] font-medium text-[#245C3B]">
                  Analyzing…
                </span>
              )}
            </div>

            {!latestPrediction ? (
              <p className="text-[14px] text-[#526158] leading-[1.55] py-2">
                No camera frame classified yet. Start the camera and point it at
                a waste item to view material and chute assignments.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[12px] text-[#526158]">Detected material</p>
                  <p className="text-[22px] font-semibold text-[#18251D] mt-0.5">
                    {latestPrediction.is_uncertain
                      ? 'Uncertain item — hold for review'
                      : latestPrediction.material_label}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#DCE3DA]">
                  <CategoryBadge
                    category={latestPrediction.routing_category}
                    showChute
                  />
                  <span className="text-[22px] font-semibold text-[#18251D] tabular-nums">
                    {(latestPrediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                {latestPrediction.is_demo_fixture && (
                  <p className="text-[12px] text-[#8A570B]">
                    Demo prediction shown because the backend API is unreachable.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Separated Hardware / Actuation Status Panel */}
          <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 space-y-4">
            <div className="pb-3 border-b border-[#DCE3DA]">
              <h2 className="text-[18px] font-semibold text-[#18251D]">
                Sorter actuation status
              </h2>
              <p className="text-[13px] text-[#526158] mt-0.5">
                {modeInfo.hardwareSummary}
              </p>
            </div>

            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#526158]">Actuation mode</dt>
                <dd className="font-medium text-[#18251D]">
                  {modeInfo.isSimulatedHw ? 'Software simulator' : 'Physical UART servo'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#526158]">Safety state</dt>
                <dd className="font-medium text-[#18251D]">
                  {!modeInfo.apiReachable
                    ? 'Unavailable (offline)'
                    : modeInfo.hwArmed
                      ? 'Armed'
                      : 'Disarmed'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#526158]">Last command</dt>
                <dd className="font-medium text-[#18251D] tabular-nums text-right">
                  {lastCommandSummary}
                </dd>
              </div>
            </dl>

            <div className="pt-2 border-t border-[#DCE3DA] grid grid-cols-3 gap-2">
              {CHUTES.map((chute) => {
                const isActive = activeChute === chute.bin;
                return (
                  <div
                    key={chute.bin}
                    className={`p-2.5 rounded-[8px] border text-center transition-colors ${
                      isActive
                        ? 'bg-[#E5EFE4] border-[#245C3B] text-[#19452B]'
                        : 'bg-[#F7F8F4] border-[#DCE3DA] text-[#526158]'
                    }`}
                  >
                    <p className="text-[12px] font-semibold text-[#18251D]">
                      {chute.label}
                    </p>
                    <p className="text-[12px] tabular-nums mt-0.5">{chute.angle}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Session Event Log */}
      <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCE3DA]">
          <h2 className="text-[18px] font-semibold text-[#18251D]">
            Session frame log
          </h2>
          <span className="text-[13px] text-[#526158] tabular-nums">
            {sessionEvents.length} recorded
          </span>
        </div>

        {sessionEvents.length === 0 ? (
          <p className="text-[14px] text-[#526158] py-5">
            No camera frames have been evaluated during this session yet.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse mt-1">
              <thead>
                <tr className="border-b border-[#DCE3DA] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#526158]">
                  <th className="py-2.5 pr-4">Time</th>
                  <th className="py-2.5 pr-4">Material</th>
                  <th className="py-2.5 pr-4">Destination</th>
                  <th className="py-2.5 pr-4">Confidence</th>
                  <th className="py-2.5 text-right">Sorter outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3DA] text-[14px]">
                {sessionEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-3 pr-4 tabular-nums text-[#526158] whitespace-nowrap">
                      {ev.time}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[#18251D]">
                      {ev.material}
                    </td>
                    <td className="py-3 pr-4">
                      <CategoryBadge category={ev.routing} size="sm" />
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-[#18251D]">
                      {(ev.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 text-right text-[#526158]">
                      {ev.outcome}
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
