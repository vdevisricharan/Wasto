# Wasto: Automated Waste Classification, Actuation & Tracking Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-1.0.0-009688.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Arduino Uno](https://img.shields.io/badge/Arduino-Uno%20R3-00979C.svg)](https://www.arduino.cc/)
[![Tests Passing](https://img.shields.io/badge/Tests-27%20Passed-brightgreen.svg)]()

> **Wasto** is an end-to-end automated waste segregation and municipal lifecycle tracking platform. It bridges optical edge deep learning (MobileNetV3Large), embedded microcontroller servo flap deflection (Arduino Uno), and persistent source-to-recycling provenance tracking.

---

## 1. System Overview & Problem Statement

Contamination in municipal recycling streams degrades secondary material quality and diverts recyclable batches into landfills. Commingled glass, plastics, and organics require labor-intensive manual sorting, while lack of source-level fill tracking leads to overflow and delayed collections.

Wasto provides a unified, demonstrable solution across three operational tiers:
1. **Source Tier**: Dustbin fill-level telemetry (HC-SR04 ultrasonic rangefinder) alerting authorities before overflow.
2. **Sorting Tier**: Optical edge computer vision classifying items into 9 fine-grained materials and actuating physical servo deflection flaps (Chute 1: Organic, Chute 2: Recyclable, Chute 3: Residual) with failsafe abstention.
3. **Tracking Tier**: Immutable municipal batch audit trail from source campus registration, through transport pickup and weighbridge tare, to optical sorting verification and final recycling disposition.

---

## 2. Operational Modes & Implementation Status

To preserve strict honesty regarding physical hardware, Wasto explicitly supports and displays three operational modes:

| Operational Mode | Vision Model Engine | Hardware Sorter Interface | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **`real_model_simulated_hw`** | Real MobileNetV3 weights (`model.h5`) | `SimulatorAdapter` (virtual serial loopback) | **Default local and cloud demo mode.** Full ML inference, telemetry, and tracking without physical hardware. |
| **`real_model_connected_hw`** | Real MobileNetV3 weights (`model.h5`) | `SerialArduinoAdapter` (USB UART to Arduino Uno) | **Physical sorting cells.** Requires connected Arduino Uno, servo flap, and ultrasonic sensor. |
| **`deterministic_fixtures`** | Static labeled test vectors | `SimulatorAdapter` (virtual loopback) | **CI/CD pipelines & offline UI testing.** Deterministic verification without model memory overhead. |

---

## 3. Architecture & Dataflow

```mermaid
flowchart TD
    subgraph EdgeStation ["Edge Optical Sorting Station"]
        Camera[Conveyor USB Camera] -->|Frames (256x256 RGB)| EdgeRuntime[Python Edge Worker]
        EdgeRuntime -->|Inference Call| MLService[MobileNetV3Large Engine]
        MLService -->|9 Softmax Scores| PolicyRouter[Operational Policy Engine]
        PolicyRouter -->|Chute Command| SerialBridge[Async Serial Bridge]
        SerialBridge <-->|UART 9600 Baud Protocol v1.0| Arduino[Arduino Uno R3 Firmware]
        Arduino --> Servos[SG90 / MG996R Servo Flap]
        Servos --> Chutes[(Chute 1: Organic | Chute 2: Recyclable | Chute 3: Residual)]
    end

    subgraph MunicipalCloud ["Backend API & Tracking Engine"]
        EdgeRuntime -->|HTTP JSON| FastAPI[FastAPI REST API]
        FastAPI --> SQLite[(Durable SQLite Database)]
        Web[React 18 + Tailwind Dashboard] <-->|HTTP / SSE| FastAPI
    end
```

---

## 4. Taxonomy & Zero-False-Biodegradability Invariant

### 4.1 Reconciling the Legacy Prototype Heuristic
Legacy 2023 prototypes relied on an unsound heuristic (`if class == "plastic": Non-Bio else: Bio`), which misclassified glass, aluminium cans, and general trash as biodegradable. 

Wasto 1.0.0 completely decouples **Material Composition** from **Operational Routing**:

| Material Class (Vision Output) | Operational Chute | Flap Angle | Action & Disposal Guidance |
| :--- | :--- | :--- | :--- |
| **`Organic Waste`** | **Chute 1: Organic** | $45^\circ$ | Compost bin for biological digestion. |
| **`Aluminium`** | **Chute 2: Recyclable** | $90^\circ$ (Neutral) | Rinse lightly; metal recovery stream. |
| **`Carton`** | **Chute 2: Recyclable** | $90^\circ$ (Neutral) | Flatten; dry cardboard recycling. |
| **`Glass`** | **Chute 2: Recyclable** | $90^\circ$ (Neutral) | Glass container recovery (Never compost). |
| **`Paper and Cardboard`** | **Chute 2: Recyclable** | $90^\circ$ (Neutral) | Clean paper pulping stream. |
| **`Plastic`** | **Chute 2: Recyclable** | $90^\circ$ (Neutral) | PET / HDPE polymer recovery. |
| **`Other Plastics`** | **Chute 3: Residual** | $135^\circ$ | Multi-layer mixed polymers / non-recyclable. |
| **`Textiles`** | **Chute 3: Residual** | $135^\circ$ | Fiber waste / industrial fuel fraction. |
| **`Wood`** | **Chute 3: Residual** | $135^\circ$ | Treated timber scraps. |
| **`Low Confidence / Ambiguous`** | **Manual Review** | Hold ($90^\circ$) | **Failsafe Abstention**: Confidence $< 0.60$ or top-2 margin $< 0.15$ triggers manual review. Flap never moves automatically. |

---

## 5. Empirical ML Evaluation & Hardware Latency

Evaluated on AMD64 Workstation (AMD64 Family 23, Python 3.11, TensorFlow 2.21 / tf_keras 2.21):

```
============================================================
BENCHMARK RESULTS & EMPIRICAL EVIDENCE (ml/benchmark.py)
============================================================
Image Preprocessing Latency (mean):     1.83 ms
Model Forward Pass Latency (mean):      205.54 ms
Model Forward Pass Latency (min):       186.47 ms
Model Forward Pass Latency (p95):       218.16 ms
Model Forward Pass Latency (max):       224.70 ms
Model Inference Throughput:             4.9 FPS
Serial Dispatch Overhead (mean):        0.74 ms
Total End-to-End Latency (mean):        208.11 ms (~4.8 FPS)
============================================================
```

> [!NOTE]
> **Performance Claim Clarification**:
> The portfolio case study's theoretical mention of "30+ FPS on edge CPUs" reflects ideal GPU/NPU or INT8 quantized execution (e.g. Google Coral TPU, NVIDIA Jetson). Unquantized float32 TensorFlow inference on standard CPU yields $\sim 4.9\,\text{FPS}$ with $205\,\text{ms}$ latency.

---

## 6. Monorepo Map

```
Wasto/
├── apps/
│   └── web/                 # React 18, TypeScript, Tailwind CSS, Vite frontend
│       ├── src/
│       │   ├── api/         # Typed API client with graceful client fallback
│       │   ├── components/  # Overview, Classify, LiveMonitor, WasteTracking, History
│       │   ├── types/       # Shared TypeScript schemas
│       │   └── App.tsx      # Main application router
├── services/
│   └── api/                 # FastAPI REST backend & persistence
│       ├── database.py      # SQLite schema, WAL mode, migrations, seed batches
│       └── main.py          # REST endpoints, error envelopes, CSV export
├── edge/                    # Edge camera ingestion & hardware bridges
│   ├── camera_runtime.py    # OpenCV video capture with bounded frame queue & dedup
│   └── serial_bridge.py     # Pluggable SerialArduinoAdapter and SimulatorAdapter
├── firmware/
│   └── wasto_sorter/
│       ├── wasto_sorter.ino # Compilable Arduino C++ sketch (millis state machine)
│       └── README.md        # Circuit schematic, BOM, and flashing instructions
├── ml/                      # Machine learning engine & benchmarks
│   ├── inference.py         # MobileNetV3 inference engine with standardized input
│   └── benchmark.py         # Reproducible CPU latency & FPS benchmark
├── shared/                  # Common taxonomy & protocol schemas
│   ├── taxonomy.py          # 9 classes, routing policy, abstention rules
│   └── protocol.py          # Serial Protocol v1.0 framing & servo angles
├── tests/                   # 27 automated unit & integration tests
│   ├── test_api.py          # FastAPI endpoints, DB persistence, tracking tests
│   ├── test_inference.py    # Model loading, parity, corrupt image handling
│   ├── test_protocol.py     # Serial framing, ACK, BUSY, watchdog tests
│   ├── test_taxonomy.py     # Zero-false-biodegradability invariant tests
│   └── test_edge_runtime.py # Camera loop, deduplication, bounded queue tests
├── docs/                    # Architectural contracts and release records
│   ├── claim-matrix.md      # Itemized claims, evidence, and status audit
│   ├── project-spec.md      # Canonical product specification
│   ├── model-card.md        # Model card with dataset licenses and limitations
│   ├── hardware-validation.md # Wiring, BOM, and physical verification checklist
│   └── release-evidence.md  # Test logs and benchmark evidence
├── netlify.toml             # Frontend deployment configuration
└── README.md
```

---

## 7. Quickstart & Installation

### 7.1 Prerequisites
- Python 3.10+ (tested on Python 3.11.9)
- Node.js 18+ (tested on Node v25.2.1)
- `uv` (recommended) or standard `pip`
- Optional: Arduino IDE / Arduino CLI if connecting physical hardware

### 7.2 Setup Virtual Environment & Backend
```bash
# 1. Create virtual environment using uv
uv venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate

# 2. Install backend dependencies
uv pip install -r requirements.txt  # Or: uv pip install fastapi uvicorn tensorflow tf-keras pillow numpy pyserial httpx pytest

# 3. Initialize SQLite database & start FastAPI server
python -m services.api.main
# Server running at http://localhost:8000 (OpenAPI docs at http://localhost:8000/docs)
```

### 7.3 Setup & Build Frontend
```bash
cd apps/web
npm install
npm run build    # Produces production bundle in apps/web/dist
npm run dev      # Local Vite development server at http://localhost:5173
```

### 7.4 Running Automated Test Suite
```bash
# Run all 27 unit, integration, and protocol tests
pytest tests/ -v
```

---

## 8. Embedded Hardware Setup & Arduino Protocol

### 8.1 Bill of Materials (BOM)
- **Microcontroller**: Arduino Uno R3 (ATmega328P)
- **Actuator**: MG996R or SG90 servo motor (Pin 9 PWM)
- **Sensor**: HC-SR04 ultrasonic rangefinder (Trig Pin 3, Echo Pin 2)
- **Status LED**: Pin 13 (Armed state indicator)
- **Power**: External regulated 5V 2A supply (Shared GND with Arduino)

### 8.2 Serial Protocol Frames (9600 Baud)
- **Host $\to$ Arduino**: `CMD:<seq>:<action>:<target_bin>:<param>\n`
  - `CMD:1:ARM:NONE:0\n`
  - `CMD:2:SORT:RECYCLABLE:1200\n`
  - `CMD:3:DISARM:NONE:0\n`
- **Arduino $\to$ Host**:
  - `ACK:<seq>` (Command validated)
  - `DONE:<seq>` (Flap returned to neutral)
  - `BUSY:<seq>` (Actuation in progress)
  - `TELEM:<dist_cm>:<fill_pct>` (Periodic bin telemetry)

---

## 9. Municipal Source-to-Recycling Tracking

Wasto implements the end-to-end audit lifecycle promised in municipal pilot designs:

```
[1. REGISTERED AT SOURCE] ──> Batch initialized at campus dustbin (e.g. IIIT Delhi Block A)
          │
[2. SCHEDULED PICKUP]    ──> Logistics coordinator dispatches collection vehicle
          │
[3. COLLECTED & WEIGHED] ──> Driver logs vehicle tare weight and timestamp
          │
[4. ARRIVED AT FACILITY] ──> Material received at MRF sorting unit
          │
[5. OPTICAL SORTING]     ──> MobileNetV3 + flap actuation segregates waste streams
          │
[6. FINAL DISPOSITION]   ──> Secondary re-processor or composting yield logged
```

---

## 10. Limitations & Equipment Blockers

1. **Physical Conveyor Rig (Blocked)**: While Arduino firmware and serial bridges are verified via `SimulatorAdapter` and unit tests, physical timing on moving conveyor belts requires assembly of a physical belt bed.
2. **Quantized Edge Inference**: Real-time continuous 30+ FPS on edge CPUs requires INT8 TFLite or ONNX Runtime quantization; current float32 TensorFlow weights run at $\sim 4.9\,\text{FPS}$.
3. **Hazardous Waste**: The model is trained on municipal waste and strictly abstains on unknown or hazardous materials.

---

## 11. Attribution & Licensing

- **Wasto Core Code**: Licensed under the [MIT License](LICENSE).
- **TrashNet Dataset**: Created by Gary Thung & Mindy Yang (Stanford University, 2017) under the MIT License.
- **MobileNetV3 Architecture**: Developed by Google Research; pre-trained weights distributed under Apache 2.0.
