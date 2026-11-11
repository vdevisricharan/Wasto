import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ModelMetadata, RoutingCategory } from '../types';
import { fetchModelMetadata } from '../api/client';
import { OperationalModeInfo } from '../theme/tokens';
import { CategoryBadge } from './ui/CategoryBadge';
import { PageHeader } from './ui/PageHeader';
import { StatusNotice } from './ui/StatusNotice';

interface ModelArchitectureViewProps {
  modeInfo: OperationalModeInfo;
}

const ROUTING_POLICY_ROWS: Array<{
  material: string;
  destination: RoutingCategory;
  angle: string;
  compostRule: string;
}> = [
  {
    material: 'Organic Waste',
    destination: 'Organic',
    angle: '45° (Chute 1)',
    compostRule: 'Permitted when confidence >= 60%',
  },
  {
    material: 'Paper and Cardboard',
    destination: 'Recyclable',
    angle: '90° (Chute 2)',
    compostRule: 'Clean dry fiber stream',
  },
  {
    material: 'Aluminium',
    destination: 'Recyclable',
    angle: '90° (Chute 2)',
    compostRule: 'Blocked from compost routing',
  },
  {
    material: 'Carton',
    destination: 'Recyclable',
    angle: '90° (Chute 2)',
    compostRule: 'Laminated beverage packaging',
  },
  {
    material: 'Glass',
    destination: 'Recyclable',
    angle: '90° (Chute 2)',
    compostRule: 'Blocked from compost routing',
  },
  {
    material: 'Plastic',
    destination: 'Recyclable',
    angle: '90° (Chute 2)',
    compostRule: 'Blocked from compost routing',
  },
  {
    material: 'Other Plastics',
    destination: 'Residual',
    angle: '135° (Chute 3)',
    compostRule: 'Blocked from compost routing',
  },
  {
    material: 'Textiles',
    destination: 'Residual',
    angle: '135° (Chute 3)',
    compostRule: 'Non-curbside fiber recovery',
  },
  {
    material: 'Wood',
    destination: 'Residual',
    angle: '135° (Chute 3)',
    compostRule: 'Treated or structural wood',
  },
];

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Image capture',
    detail: 'JPEG, PNG, or WEBP up to 15 MB resized to 224 × 224 × 3 RGB',
  },
  {
    step: '02',
    title: 'Classification',
    detail: 'MobileNetV3Large produces calibrated probabilities across 9 materials',
  },
  {
    step: '03',
    title: 'Safety gating',
    detail: 'Rejects low confidence (< 60%) or small top-two margins (< 15%)',
  },
  {
    step: '04',
    title: 'Audit & actuation',
    detail: 'Logs SQLite record and dispatches UART frame when armed',
  },
];

const BENCHMARK_ROWS = [
  { stage: 'Preprocessing & RGB resize', metric: '1.83 ms', notes: 'Pillow bilinear resize + tensor norm' },
  { stage: 'MobileNetV3Large forward pass', metric: '205.54 ms', notes: 'AMD64 CPU float32 mean (218.16 ms p95)' },
  { stage: 'UART serial command frame', metric: '0.74 ms', notes: 'WASTO_SERIAL_V1.0 at 9600 bps' },
  { stage: 'Total single-frame pipeline', metric: '208.11 ms', notes: 'Sustained throughput ~4.9 FPS' },
];

export const ModelArchitectureView: React.FC<ModelArchitectureViewProps> = ({
  modeInfo,
}) => {
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchModelMetadata().then((data) => {
      if (mounted && data) setMetadata(data);
    });
    return () => {
      mounted = false;
    };
  }, [modeInfo.apiReachable]);

  const inputShapeText = metadata?.input_shape
    ? `${metadata.input_shape.join(' × ')} RGB`
    : '256 × 256 × 3 RGB';
  const pipelineSteps = [
    {
      step: '01',
      title: 'Image capture',
      detail: `JPEG, PNG, or WEBP up to 15 MB resized to ${inputShapeText}`,
    },
    ...PIPELINE_STEPS.slice(1),
  ];
  const confidenceThresholdPct = Math.round(
    (metadata?.thresholds?.confidence_threshold ?? 0.6) * 100
  );
  const marginPct = Math.round(
    (metadata?.thresholds?.ambiguity_margin ?? 0.15) * 100
  );
  const checksum =
    metadata?.checksum_sha256 ||
    '2de1c4619c3fb2dd2aa4d42adf1a71a1cf48cb7e4e5738b0930a9d46dcf7f3c2';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model & system"
        description="Model architecture, safety routing rules, verified CPU timings, and embedded sorter specifications."
        modeInfo={modeInfo}
      />

      {!modeInfo.apiReachable && (
        <StatusNotice tone="info">
          Live backend metadata is offline; showing verified reference
          specifications from the deployed model card.
        </StatusNotice>
      )}

      {/* Key Specifications Strip */}
      <section aria-label="Model specifications">
        <div className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-[#DCE3DA]">
          <div className="p-5 sm:border-b lg:border-b-0 sm:border-r lg:border-r-0 border-[#DCE3DA]">
            <p className="text-[13px] font-medium text-[#526158]">Backbone</p>
            <p className="text-[22px] font-semibold text-[#18251D] mt-1.5">
              MobileNetV3Large
            </p>
            <p className="text-[12px] text-[#526158] mt-1 tabular-nums">
              Keras H5 · 17.08 MB weights
            </p>
          </div>

          <div className="p-5 sm:border-b lg:border-b-0 border-[#DCE3DA]">
            <p className="text-[13px] font-medium text-[#526158]">Input dimensions</p>
            <p className="text-[22px] font-semibold text-[#18251D] mt-1.5 tabular-nums">
              {inputShapeText}
            </p>
            <p className="text-[12px] text-[#526158] mt-1">
              TrashNet + 5,078-image domain corpus
            </p>
          </div>

          <div className="p-5 sm:border-r lg:border-r-0 border-[#DCE3DA]">
            <p className="text-[13px] font-medium text-[#526158]">Confidence gates</p>
            <p className="text-[22px] font-semibold text-[#18251D] mt-1.5 tabular-nums">
              &ge; {confidenceThresholdPct}% · &ge; {marginPct}% gap
            </p>
            <p className="text-[12px] text-[#526158] mt-1">
              Uncertain items route to manual review
            </p>
          </div>

          <div className="p-5">
            <p className="text-[13px] font-medium text-[#526158]">Policy version</p>
            <p className="text-[22px] font-semibold text-[#18251D] mt-1.5 tabular-nums">
              {metadata?.routing_policy_version || 'v1.0'}
            </p>
            <p className="text-[12px] text-[#526158] mt-1">
              Zero false biodegradability enforced
            </p>
          </div>
        </div>
      </section>

      {/* Light End-to-End Inference Pipeline */}
      <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-4">
        <div className="pb-3 border-b border-[#DCE3DA]">
          <h2 className="text-[20px] font-semibold text-[#18251D]">
            Inference & sorting pipeline
          </h2>
          <p className="text-[13px] text-[#526158] mt-0.5">
            Deterministic path from raw frame ingestion to verified chute decision
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {pipelineSteps.map((item, idx) => (
            <div
              key={item.step}
              className="relative p-4 rounded-[10px] border border-[#DCE3DA] bg-[#F7F8F4] flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#245C3B] bg-[#E5EFE4] px-2 py-0.5 rounded-[6px] tabular-nums">
                  Step {item.step}
                </span>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight
                    size={15}
                    className="hidden lg:block text-[#526158]"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#18251D]">
                  {item.title}
                </h3>
                <p className="text-[13px] text-[#526158] leading-[1.45] mt-1">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Material Classes & Routing Guardrails */}
      <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pb-3 border-b border-[#DCE3DA]">
          <div>
            <h2 className="text-[20px] font-semibold text-[#18251D]">
              Material routing policy
            </h2>
            <p className="text-[13px] text-[#526158] mt-0.5">
              All 9 trained classes map explicitly to 3 physical chutes or manual review
            </p>
          </div>
          <span className="text-[12px] font-medium text-[#526158]">
            Servo neutral rest angle: 90°
          </span>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DCE3DA] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#526158]">
                <th className="py-3 pr-4">Material class</th>
                <th className="py-3 pr-4">Sorting destination</th>
                <th className="py-3 pr-4">Servo angle</th>
                <th className="py-3">Guardrail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE3DA] text-[14px]">
              {ROUTING_POLICY_ROWS.map((row) => (
                <tr key={row.material}>
                  <td className="py-3 pr-4 font-medium text-[#18251D]">
                    {row.material}
                  </td>
                  <td className="py-3 pr-4">
                    <CategoryBadge category={row.destination} size="sm" />
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-[#18251D]">
                    {row.angle}
                  </td>
                  <td className="py-3 text-[#526158]">{row.compostRule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-Column Technical Reference: CPU Benchmarks + Embedded Hardware */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-4">
          <div className="pb-3 border-b border-[#DCE3DA]">
            <h2 className="text-[20px] font-semibold text-[#18251D]">
              Verified CPU benchmarks
            </h2>
            <p className="text-[13px] text-[#526158] mt-0.5">
              Measured on warm AMD64 Python runtime (float32 inference)
            </p>
          </div>

          <dl className="divide-y divide-[#DCE3DA] text-[14px]">
            {BENCHMARK_ROWS.map((row) => (
              <div
                key={row.stage}
                className="py-3 flex items-start justify-between gap-4"
              >
                <div>
                  <dt className="font-medium text-[#18251D]">{row.stage}</dt>
                  <dd className="text-[12px] text-[#526158] mt-0.5">{row.notes}</dd>
                </div>
                <dd className="font-semibold text-[#18251D] tabular-nums shrink-0">
                  {row.metric}
                </dd>
              </div>
            ))}
          </dl>

          <div className="p-3.5 rounded-[8px] bg-[#F7F8F4] border border-[#DCE3DA] space-y-1">
            <p className="text-[12px] font-medium text-[#526158]">
              Model artifact SHA-256
            </p>
            <p className="font-mono text-[12px] text-[#18251D] break-all">
              {checksum}
            </p>
          </div>
        </section>

        <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-4">
          <div className="pb-3 border-b border-[#DCE3DA]">
            <h2 className="text-[20px] font-semibold text-[#18251D]">
              Embedded sorter & serial protocol
            </h2>
            <p className="text-[13px] text-[#526158] mt-0.5">
              Arduino Uno R3 controller specifications and UART framing
            </p>
          </div>

          <dl className="divide-y divide-[#DCE3DA] text-[14px]">
            <div className="py-2.5 flex justify-between gap-3">
              <dt className="text-[#526158]">Microcontroller</dt>
              <dd className="font-medium text-[#18251D]">Arduino Uno R3</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-3">
              <dt className="text-[#526158]">UART baud rate</dt>
              <dd className="font-mono text-[#18251D]">9600 bps (8N1)</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-3">
              <dt className="text-[#526158]">Pin assignments</dt>
              <dd className="font-mono text-[13px] text-[#18251D] text-right">
                Servo D9 · Trig D3 · Echo D2 · LED D13
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-3">
              <dt className="text-[#526158]">Watchdog & telemetry</dt>
              <dd className="font-medium text-[#18251D] tabular-nums text-right">
                30s auto-disarm · 3s interval
              </dd>
            </div>
          </dl>

          <div className="p-3.5 rounded-[8px] bg-[#F7F8F4] border border-[#DCE3DA] space-y-2 text-[12px]">
            <p className="font-semibold text-[#18251D]">Serial frame syntax</p>
            <div className="space-y-1 font-mono text-[#18251D]">
              <p>CMD:&lt;seq&gt;:&lt;action&gt;:&lt;target_bin&gt;:&lt;param&gt;\n</p>
              <p className="text-[#526158]">Example: CMD:042:SORT:RECYCLABLE:1200</p>
              <p>TELEM:&lt;state&gt;:&lt;distance_cm&gt;:&lt;armed&gt;</p>
            </div>
          </div>
        </section>
      </div>

      {/* Operational Modes & Known Limitations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-3">
          <h2 className="text-[18px] font-semibold text-[#18251D] pb-3 border-b border-[#DCE3DA]">
            Runtime operational modes
          </h2>
          <dl className="divide-y divide-[#DCE3DA] text-[13px]">
            <div className="py-3 space-y-1">
              <dt className="font-semibold text-[#19452B]">
                Live model · Connected hardware
              </dt>
              <dd className="text-[#526158]">
                MobileNetV3 runs real inference on uploaded images and physical
                Arduino servos actuate via serial UART.
              </dd>
            </div>
            <div className="py-3 space-y-1">
              <dt className="font-semibold text-[#23476B]">
                Live model · Simulated hardware
              </dt>
              <dd className="text-[#526158]">
                Classifications and SQLite persistence run live; hardware commands
                are acknowledged by the local software simulator.
              </dd>
            </div>
            <div className="py-3 space-y-1">
              <dt className="font-semibold text-[#754909]">
                Demo data · Simulated hardware
              </dt>
              <dd className="text-[#526158]">
                Shown only when the FastAPI service is unreachable; sample outputs
                use deterministic placeholders clearly labeled as demo fixtures.
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-[#FFFFFF] border border-[#DCE3DA] rounded-[12px] p-5 sm:p-6 space-y-3">
          <h2 className="text-[18px] font-semibold text-[#18251D] pb-3 border-b border-[#DCE3DA]">
            Known operational boundaries
          </h2>
          <ul className="space-y-2.5 text-[14px] text-[#526158] leading-[1.55]">
            <li>
              • Designed for single-item inspection per image; overlapping items
              in a single frame should route through manual review.
            </li>
            <li>
              • Heavily soiled packaging, extreme reflections, or dim backlighting
              can reduce top-class margins and trigger conservative abstention.
            </li>
            <li>
              • CPU inference runs around 4.9 FPS in single-stream synchronous
              execution; batch uploads scale linearly with queue size.
            </li>
            <li>
              • Category badge colors identify Wasto interface routing chutes and
              do not encode local municipal bin color regulations.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
