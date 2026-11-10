import React from 'react';
import {
  Layers,
  ArrowRight,
  RotateCw,
  Gauge,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Sliders,
} from 'lucide-react';
import { DashboardSummary } from '../types';

interface OverviewViewProps {
  summary: DashboardSummary | null;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ summary, onNavigate, onRefresh }) => {
  const total = summary?.total_predictions || 0;
  const sorts = summary?.total_actuated_sorts || 0;
  const routing = summary?.routing_distribution || {};
  const recyclableCount = routing['Recyclable'] || 0;
  const organicCount = routing['Organic'] || 0;
  const diversionRate = total > 0 ? (((recyclableCount + organicCount) / total) * 100).toFixed(1) : '0.0';

  const telem = summary?.latest_telemetry;
  const fillPct = telem?.fill_pct ?? 57.5;
  const distCm = telem?.distance_cm ?? 42.5;
  const telemSource = telem?.source || 'SIMULATED';

  const hw = summary?.hardware_status;
  const isHwArmed = hw?.armed ?? false;

  return (
    <div className="space-y-8 animate-fade-slide">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-6 sm:p-10 border border-gray-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-wasto-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-wasto-500/10 border border-wasto-500/30 text-xs font-mono text-wasto-400">
            <Radio className="w-3.5 h-3.5 animate-pulse text-wasto-400" />
            <span>Operational Mode: {hw?.mode || 'SIMULATED'} HARDWARE</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Automated Waste Sorting & Lifecycle Tracking
          </h1>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            Real-time MobileNetV3 computer vision with non-blocking Arduino Uno flap actuation
            and end-to-end municipal source-to-recycling provenance.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('classify')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-wasto-500 text-surface-900 font-semibold text-sm hover:bg-wasto-400 transition-all shadow-lg shadow-wasto-500/20 active:scale-95"
            >
              <Layers className="w-4 h-4" />
              <span>Classify Waste</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('monitor')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-surface-800 text-gray-200 border border-gray-700 font-medium text-sm hover:bg-surface-700 transition-all active:scale-95"
            >
              <span>Live Camera Monitor</span>
            </button>
            <button
              onClick={onRefresh}
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-surface-800 text-gray-400 hover:text-gray-200 border border-gray-700 text-sm transition-all"
              title="Refresh Telemetry"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-card-interactive p-5 rounded-2xl border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Classifications</span>
            <Activity className="w-4 h-4 text-wasto-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{total}</div>
          <p className="text-xs text-gray-400">Continuous inference evaluations</p>
        </div>

        {/* Metric 2 */}
        <div className="glass-card-interactive p-5 rounded-2xl border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Actuated Flap Sorts</span>
            <Sliders className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{sorts}</div>
          <div className="flex items-center space-x-1.5 text-xs text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span>Firmware verified movements</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card-interactive p-5 rounded-2xl border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Diversion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{diversionRate}%</div>
          <p className="text-xs text-gray-400">Diverted to Recyclable & Compost</p>
        </div>

        {/* Metric 4: Bin Capacity */}
        <div className="glass-card-interactive p-5 rounded-2xl border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Bin Telemetry</span>
            <Gauge className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-mono">{fillPct.toFixed(0)}%</span>
            <span className="text-xs text-gray-400">({distCm.toFixed(1)} cm)</span>
          </div>
          {/* Fill Bar */}
          <div className="w-full bg-surface-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                fillPct > 80 ? 'bg-red-500' : fillPct > 50 ? 'bg-amber-400' : 'bg-wasto-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, fillPct))}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>HC-SR04 Sensor</span>
            <span className="text-amber-400 font-semibold">{telemSource}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Routing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Routing Breakdown */}
        <div className="glass-card p-6 rounded-2xl border border-gray-800 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-wasto-400"></span>
              Operational Sorting Chutes
            </h2>
            <span className="text-xs font-mono text-gray-400">Policy v1.0</span>
          </div>

          <div className="space-y-4">
            {/* Recyclable */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Chute 2: Recyclable (Glass, Plastics, Paper, Metal)
                </span>
                <span className="font-mono text-white">{recyclableCount}</span>
              </div>
              <div className="w-full bg-surface-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (recyclableCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Organic */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Chute 1: Organic (Food & Biodegradable Scraps)
                </span>
                <span className="font-mono text-white">{organicCount}</span>
              </div>
              <div className="w-full bg-surface-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (organicCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Residual */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Chute 3: Residual / Non-Recyclable (Textiles, Wood, Composites)
                </span>
                <span className="font-mono text-white">{routing['Residual'] || 0}</span>
              </div>
              <div className="w-full bg-surface-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? ((routing['Residual'] || 0) / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Unknown */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Manual Review / Uncertain (Abstained)
                </span>
                <span className="font-mono text-white">{routing['Unknown / Manual Review'] || 0}</span>
              </div>
              <div className="w-full bg-surface-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? ((routing['Unknown / Manual Review'] || 0) / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Hardware Status & Safety Invariant Card */}
        <div className="glass-card p-6 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-wasto-400" />
              Embedded Hardware Controller
            </h2>
            <div className="p-4 rounded-xl bg-surface-800 border border-gray-700/60 space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Microcontroller Target:</span>
                <span className="text-white font-semibold">Arduino Uno R3 (ATmega328P)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">UART Serial Port:</span>
                <span className="text-white font-semibold">{hw?.port || 'COM3'} @ 9600 Baud</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Actuation State:</span>
                <span className={isHwArmed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {hw?.state || 'READY'} ({isHwArmed ? 'ARMED' : 'DISARMED'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Safety Watchdog:</span>
                <span className="text-wasto-400">30s Auto-Disarm Active</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-800/60 border border-wasto-500/20 text-xs text-gray-300 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-wasto-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Zero-False-Biodegradability Invariant</span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Glass, metals, and synthetics are mathematically forbidden from routing to Organic compost chutes,
              eliminating the legacy prototype bug.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
