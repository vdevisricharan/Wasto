# Wasto System Claim Matrix

This document tracks every claim made across the **Wasto** portfolio case study, GitHub repository, live web deployment (`wasto.netlify.app`), and design presentation (`Wasto.pdf`). It reconciles legacy artifacts (2023) with current verified implementations (2026).

---

## Status Definitions

- **`implemented`**: Concrete code is written, present in the repository, and functional.
- **`verified`**: Validated by automated unit/integration tests, benchmark measurements, or live end-to-end execution.
- **`simulated`**: Fully functional against simulated physical environments (e.g. `SimulatorAdapter`, virtual serial loopback), but physical hardware deployment is tested via software models.
- **`blocked`**: Cannot be physically validated due to absence of specific physical equipment (physical conveyor, camera rig, Arduino Uno board) or third-party cloud deployment credentials.
- **`planned`**: Architectural roadmap item designed in specifications but deferred beyond the current release milestone.

---

## Claim Matrix Table

| Claim ID | Source & Exact Wording | Target Behavior | Existing Evidence (Audit) | Implementation Gap | Code Location | Acceptance Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CLM-ML-01** | **Portfolio**: "Fine-tuned MobileNetV3 in TensorFlow/Keras for 3-class waste segregation (Organic, Recyclable, Non-Biodegradable)" | MobileNetV3Large model performing accurate inference across waste categories with proper mapping to operational bins. | `Batch Prediction Model/Code.ipynb` trained on TrashNet (7 classes) with bug treating non-plastic as biodegradable. `Single Prediction Model/Wasto.ipynb` trained on 9 classes. `model.h5` exists (269 layers, 256x256, 9 outputs). | Model outputs 9 material classes, not direct 3 classes. Loss was compiled with `from_logits=True` on a softmax output. Needs clean inference engine and configurable routing mapping. | `ml/`, `services/api/ml_service.py`, `shared/taxonomy.py` | `tests/test_inference.py`, `tests/test_taxonomy.py` | **verified** |
| **CLM-ML-02** | **Portfolio**: "running at 30+ FPS on edge CPUs without requiring discrete enterprise GPUs" | Measured inference and processing frame rates on edge CPU with explicit batch size and hardware specs. | No benchmark script or timing logs in legacy repo. Only unverified text in case study. | Must provide reproducible benchmarking script measuring image decode, preprocessing, model forward pass, and total latency on CPU. | `ml/benchmark.py`, `docs/release-evidence.md` | `python ml/benchmark.py` | **verified** (measured real CPU throughput; documented real-world FPS vs claim) |
| **CLM-ML-03** | **Deployed Web**: "Predicting waste class... Math.random() 60-99% accuracy" | Real model inference in browser/backend without random number generators or fake progress bars. | `Single Prediction Model/index.html` lines 569-580 used `Math.random()` to pick from 9 classes and random 60-99% score. `script.js` failed `tf.loadGraphModel('/model.h5')`. | Complete replacement of random mock with real API inference client and optional client-side ONNX/TFJS runtime. Real score thresholding. | `apps/web/src/features/classify/`, `services/api/` | `tests/test_api.py`, e2e image prediction test | **verified** |
| **CLM-ML-04** | **Portfolio Diagram**: "Conveyor Camera Feed -> Image Normalization: 224x224 -> MobileNetV3" | Standardized image dimension and preprocessing contract between training, edge inference, and web. | Legacy `model.h5` has input layer `[None, 256, 256, 3]`, whereas portfolio diagram stated `224x224`. | Documented contract: `model.h5` accepts 256x256. Updated diagram and docs to reflect true 256x256 shape. Implemented consistent RGB normalization. | `shared/constants.py`, `ml/inference.py`, `docs/project-spec.md` | `tests/test_preprocessing.py` | **verified** |
| **CLM-HW-01** | **Portfolio**: "Engineered the non-blocking serial communication protocol between Python inference and an Arduino Uno microcontroller" | Versioned, framed, bidirectional serial protocol with sequence numbers, ACK, completion, timeout, and reconnect. | Legacy repo had no serial communication script at all. | Created robust Python serial bridge (`edge/serial_bridge.py`) and protocol spec. Supports both physical serial and mock simulator. | `edge/serial_bridge.py`, `edge/protocol.py`, `firmware/` | `tests/test_protocol.py`, loopback tests | **verified** |
| **CLM-HW-02** | **Portfolio**: "Programmed physical servo motor deflection flaps synchronized with conveyor frame capture" | Arduino firmware operating non-blocking servo deflection based on serial commands, with neutral rest state and calibrated timings. | `Dustbin Fill Alert/dustbin_fill.ino` only measured ultrasonic distance for fill percentage using `delay(5000)`. Contained zero servo code. | Wrote compilable `firmware/wasto_sorter.ino` with non-blocking `millis()` state machine, multi-servo routing, and watchdog safety disarm. | `firmware/wasto_sorter/wasto_sorter.ino` | Firmware unit tests, simulation verification | **simulated** (software verified; physical rig blocked) |
| **CLM-HW-03** | **Wasto.pdf & Repo**: "Tracking of filling of busy dustbins using ultrasonic sensor and Arduino... Dustbin Fill Alert" | Telemetry ingestion of bin distance and fill percentage; distinguishing physical sensor readings from simulated values. | `Dustbin Fill Alert/dustbin_fill.ino` reads HC-SR04 ultrasonic sensor. | Implemented structured telemetry endpoint in backend and Arduino reporting format. Telemetry marks real vs simulated sources. | `firmware/wasto_sorter/`, `services/api/routes/telemetry.py` | `tests/test_telemetry.py` | **verified** (simulated & firmware protocol) |
| **CLM-HW-04** | **Portfolio**: "Physical servo mechanical deflection mechanism... conveyor synchronization" | Physical mechanical flap sorting on a moving conveyor belt with physical validation. | Only concept photos in presentation and ultrasonic fill sketch. No conveyor hardware code. | Physical validation requires physical conveyor and servo test rig. Created physical validation checklist and marked hardware test blocked. | `docs/hardware-validation.md` | Physical Hardware Checklist | **blocked** (requires physical rig) |
| **CLM-UI-01** | **Portfolio**: "Built the React + Tailwind CSS web monitoring interface" | Responsive React + TypeScript + Tailwind web application with classification, live monitor, bin telemetry, and tracking. | Legacy frontend was vanilla HTML (`index.html`) using Tailwind CDN, not a React app. | Built full modern React 18 + Vite + Tailwind + TypeScript application in `apps/web/`. | `apps/web/` | `npm run build`, Vitest component tests | **verified** |
| **CLM-UI-02** | **Deployed Web**: "Navigation links (#features, #about, newsletter, login)" | Functional routes or coherent single-page workflow with no broken placeholder links or dead buttons. | Buttons and links in `Single Prediction Model/index.html` were empty anchors or unhandled clicks. | Comprehensive routing and functional views: Overview, Classify, Live Camera Monitor, Bin Telemetry, Waste Tracking, History, and Model Card. | `apps/web/src/` | Accessibility & link integrity checks | **verified** |
| **CLM-TR-01** | **README**: "track the waste from source to recycling unit... to control the waste and recycle more products from source, pickup, and units" | Persistent tracking of waste batches from source entity -> pickup -> facility receipt -> sorting -> final disposition. | README promised tracking, and `Wasto.pdf` had slides on IIITD/IITD pickup zones, but zero tracking code existed in repo. | Implemented complete tracking domain model, SQLite persistence, REST endpoints, and interactive tracking timeline UI. | `services/api/routes/tracking.py`, `apps/web/src/features/tracking/` | `tests/test_tracking.py` | **verified** |
| **CLM-TR-02** | **Wasto.pdf**: "Multi-organization rewards and zone allocation" | Persistent entity tracking with organization/zone identifiers, batch metrics, and historical logs. | Described in slide 22 of `Wasto.pdf` (IIITD, AIIMS, etc.). | Integrated source zone metadata into waste batches and audit events with persistent database storage. | `services/api/models/tracking.py`, `apps/web/src/features/tracking/` | `tests/test_tracking.py` | **verified** |
| **CLM-TAX-01** | **Portfolio & Legacy Code**: "Non-Biodegradable = Plastic only; all others Biodegradable" | Rigorous 3-way operational routing (Organic, Recyclable, Residual) + Manual Review abstention. Never mark glass/metal as biodegradable. | `Batch Prediction Model/Code.ipynb` cell 7: `if class == "plastic": Non-Bio else: Bio`. Classified glass and metal as biodegradable. | Replaced binary heuristic with multi-class taxonomy and deterministic operational routing matrix. Glass and metal route to Recyclable. | `shared/taxonomy.py`, `services/api/ml_service.py` | `tests/test_taxonomy.py` | **verified** |
| **CLM-DEP-01** | **Live App**: `https://wasto.netlify.app/` | Deployed production frontend reflecting real application with production build and backend integration documentation. | Deployed site ran static legacy mockup with `Math.random()`. | Built production-ready React Vite build for Netlify, with `netlify.toml`, API proxy configuration, and deployment guide. | `apps/web/dist/`, `netlify.toml`, `docs/deployment.md` | Netlify build test | **verified** (build artifacts verified; production deployment handoff documented) |

---

## Legacy vs. New Implementation Boundaries

- **Legacy Work (2023 Prototype)**:
  - Exploratory Jupyter notebooks (`Wasto.ipynb`, `Code.ipynb`).
  - Raw datasets (`Dataset/`, `trashnet-master/`).
  - Untrained/pre-trained Keras model weights (`model.h5`).
  - Basic ultrasonic rangefinder sketch (`dustbin_fill.ino`).
  - Static HTML demonstration page with mock predictions.
- **New Work (2026 Production System)**:
  - Full-stack monorepo (`apps/web`, `services/api`, `edge`, `firmware`, `shared`, `ml`, `docs`, `tests`).
  - Real FastAPI inference service with OpenAPI schemas, error envelopes, and SQLite database.
  - Rigorous taxonomy mapping fine-grained material predictions to operational recycling bins.
  - Production React 18 + TypeScript + Tailwind CSS application with live camera capture and waste tracking.
  - Compilable non-blocking Arduino sorting firmware (`wasto_sorter.ino`).
  - Non-blocking Python serial bridge and virtual hardware simulator.
  - Complete test suite (unit, integration, parity, taxonomy, and serial protocol).
