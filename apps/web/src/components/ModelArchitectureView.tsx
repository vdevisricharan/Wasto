import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle, Layers, GitBranch, ArrowRight, Activity, Terminal } from 'lucide-react';

export const ModelArchitectureView: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-slide max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Cpu className="w-6 h-6 text-wasto-400" />
          Model Architecture & System Specification
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Technical specifications, empirical CPU benchmarks, and hardware-software contracts.
        </p>
      </div>

      {/* Architecture Flowchart Card */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-wasto-400" />
          End-to-End System Pipeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-surface-800/80 border border-gray-700/80 space-y-2">
            <span className="text-[10px] text-wasto-400 font-bold">STAGE 01</span>
            <h4 className="font-sans font-bold text-sm text-white">Video Ingestion</h4>
            <p className="font-sans text-gray-400 text-[11px]">
              OpenCV camera capture, BGR to RGB conversion, 256×256 bilinear resize, rate-limited bounded buffer.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-800/80 border border-gray-700/80 space-y-2">
            <span className="text-[10px] text-wasto-400 font-bold">STAGE 02</span>
            <h4 className="font-sans font-bold text-sm text-white">MobileNetV3 Edge CNN</h4>
            <p className="font-sans text-gray-400 text-[11px]">
              269-layer depthwise separable network with hard-swish activation, outputting 9 material softmax logits.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-800/80 border border-gray-700/80 space-y-2">
            <span className="text-[10px] text-wasto-400 font-bold">STAGE 03</span>
            <h4 className="font-sans font-bold text-sm text-white">Policy & Abstention</h4>
            <p className="font-sans text-gray-400 text-[11px]">
              Evaluates confidence ($\ge 0.60$) and ambiguity margin ($\ge 0.15$). Maps to Organic, Recyclable, or Residual.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-800/80 border border-gray-700/80 space-y-2">
            <span className="text-[10px] text-wasto-400 font-bold">STAGE 04</span>
            <h4 className="font-sans font-bold text-sm text-white">Arduino Servo Actuation</h4>
            <p className="font-sans text-gray-400 text-[11px]">
              Non-blocking UART protocol (9600 baud). Deflects servo flap to 45°, 90°, or 135° with watchdog protection.
            </p>
          </div>
        </div>
      </div>

      {/* Empirical Benchmarks vs Claim Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Empirical Benchmark Measurements (AMD64 CPU)
          </h3>
          <div className="p-4 rounded-xl bg-surface-800 border border-gray-700/80 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">Image Preprocessing (mean):</span>
              <span className="text-white font-bold">1.83 ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Forward Pass Latency (mean):</span>
              <span className="text-white font-bold">205.54 ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Forward Pass p95 Latency:</span>
              <span className="text-white font-bold">218.16 ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Serial Bridge Dispatch Overhead:</span>
              <span className="text-white font-bold">0.74 ms</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
              <span className="text-wasto-400 font-semibold">Total Pipeline Latency:</span>
              <span className="text-wasto-400 font-bold">208.11 ms (~4.9 FPS)</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            * Benchmarked on Python 3.11 with unquantized float32 TensorFlow weights on an AMD64 CPU.
            Continuous 30+ FPS edge execution requires INT8 quantization (e.g. TFLite/Edge TPU) or discrete GPU acceleration.
          </p>
        </div>

        {/* Taxonomy Reconciliation Card */}
        <div className="glass-card p-6 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-wasto-400" />
            Taxonomy & Bug Reconciliation
          </h3>
          <div className="space-y-3 text-xs text-gray-300">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <span className="font-bold block text-rose-400 mb-1">Legacy 2023 Prototype Heuristic (Fixed):</span>
              <code>if class == "plastic": Non-Bio else: Bio</code>
              <p className="mt-1 text-gray-400 text-[11px]">
                Erronously classified Glass, Metal, and Trash as "Biodegradable" simply because they were not plastic.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span className="font-bold block text-emerald-400 mb-1">Production Wasto 1.0 Policy:</span>
              <p className="text-[11px] leading-relaxed text-gray-300">
                Material composition is strictly decoupled from routing. Glass and Metal route deterministically to
                <strong> Recyclable</strong>; Organic Waste routes to <strong>Organic</strong>; complex polymers route to
                <strong> Residual</strong>. Uncertain items abstain to manual review.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Metadata Card */}
      <div className="glass-card p-6 rounded-2xl border border-gray-800 space-y-4 font-mono text-xs">
        <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
          <Terminal className="w-4 h-4 text-wasto-400" />
          Model Metadata & Artifact Contract
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-300">
          <div>
            <span className="text-gray-500 block">Model Architecture:</span>
            <span className="text-white">MobileNetV3Large (Functional, 269 layers)</span>
          </div>
          <div>
            <span className="text-gray-500 block">Input Shape:</span>
            <span className="text-white">[None, 256, 256, 3] (RGB, [0, 255] float)</span>
          </div>
          <div>
            <span className="text-gray-500 block">Artifact File:</span>
            <span className="text-white">Single Prediction Model/model.h5 (17.08 MB)</span>
          </div>
          <div>
            <span className="text-gray-500 block">SHA-256 Checksum:</span>
            <span className="text-wasto-400 truncate block">2de1c4619c3fb2dd2aa4d42adf1a71a1cf48cb7e4e5738b0930a9d46dcf7f3c2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
