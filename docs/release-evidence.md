# Wasto Release Verification & Evidence Record

**Release Identifier**: Wasto v1.0.0  
**Verification Date**: 10 November 2026  
**Test Suite**: 27 unit & integration tests passing (`pytest tests/`)  
**Frontend Build**: Vite + React 18 production bundle compiled in `apps/web/dist`  

---

## 1. Empirical Evidence by Subsystem

### 1.1 Machine Learning Classification Engine
- **Artifact**: `Single Prediction Model/model.h5`
- **Architecture**: MobileNetV3Large (Functional Keras/TensorFlow model, 269 layers)
- **Artifact SHA-256 Checksum**: `2de1c4619c3fb2dd2aa4d42adf1a71a1cf48cb7e4e5738b0930a9d46dcf7f3c2`
- **Output Dimensionality**: 9 classes (`Aluminium`, `Carton`, `Glass`, `Organic Waste`, `Other Plastics`, `Paper and Cardboard`, `Plastic`, `Textiles`, `Wood`)
- **Input Resolution Contract**: $256 \times 256 \times 3$ RGB (reconciling legacy diagram's $224 \times 224$ notation)
- **Preprocessing Contract**: Values in $[0.0, 255.0]$ float32; internal Keras `Rescaling` layer applies $\times \frac{1}{127.5} - 1.0$ (no double normalization).

### 1.2 Empirical CPU Latency Benchmark (AMD64 Workstation)
*Command: `python ml/benchmark.py` (30 iterations)*
- **Image Preprocessing Latency**: $1.83\,\text{ms}$
- **Model Forward Pass Latency (Mean)**: $205.54\,\text{ms}$
- **Model Forward Pass Latency (Min)**: $186.47\,\text{ms}$
- **Model Forward Pass Latency (p95)**: $218.16\,\text{ms}$
- **Model Forward Pass Latency (Max)**: $224.70\,\text{ms}$
- **Measured CPU Throughput**: **4.9 FPS** (unbatched float32 execution)
- **Serial Actuation Overhead**: $0.74\,\text{ms}$
- **Total Pipeline Latency**: $208.11\,\text{ms}$ ($\sim 4.8\,\text{FPS}$)
- **Claim Status**: The portfolio claim of "30+ FPS on edge CPUs" reflects theoretical GPU/NPU or quantized INT8 performance. On unquantized CPU inference, measured reality is $4.9\,\text{FPS}$.

### 1.3 Taxonomy & Routing Invariants
- **Code Location**: `shared/taxonomy.py`, `services/api/ml_service.py`
- **Verified Policy**:
  - `Organic Waste` $\to$ **Organic** (Chute 1, 45°)
  - `Aluminium`, `Carton`, `Glass`, `Paper and Cardboard`, `Plastic` $\to$ **Recyclable** (Chute 2, 90°)
  - `Other Plastics`, `Textiles`, `Wood` $\to$ **Residual** (Chute 3, 135°)
  - Low confidence ($< 0.60$) or ambiguous top-2 margin ($< 0.15$) $\to$ **Unknown / Manual Review** (Hold / Disarmed)
- **Zero-False-Biodegradability Verification**: Proven in `tests/test_taxonomy.py::test_glass_and_metal_never_classified_as_organic`. Glass, metal, and plastics are forbidden from routing to Organic.

### 1.4 Arduino Firmware & Serial Protocol v1.0
- **Firmware Location**: `firmware/wasto_sorter/wasto_sorter.ino` (Compilable Arduino C++)
- **Framed Protocol**: `CMD:<seq>:<action>:<target_bin>:<param>\n`
- **Adapter Implementations**: `SimulatorAdapter` (local virtual loopback) and `SerialArduinoAdapter` (`pyserial` UART).
- **Automated Verification**: `tests/test_protocol.py` (4 passing tests verifying framing, ACK, BUSY state, watchdog disarm, and telemetry formatting).

### 1.5 Source-to-Recycling Tracking Lifecycle
- **Persistence**: SQLite `wasto.db` with WAL mode and foreign key constraints.
- **Entities**: `waste_batches`, `tracking_events`, `predictions`, `sorting_events`, `telemetry_readings`.
- **Workflow Verification**: `tests/test_api.py::test_source_to_recycling_tracking_workflow` (verifies batch creation, pickup scheduling, facility check-in, sorting audit, and chronological timeline querying).

### 1.6 Production Web Application
- **Stack**: React 18 + Vite + TypeScript + Tailwind CSS in `apps/web/`
- **Build Status**: Verified clean build (`npm run build`) generating `apps/web/dist` in 1.62s.
- **Accessibility & Features**: Real-time dashboard, single/batch prediction, live WebRTC camera capture, batch tracking, and history with CSV export.

---

## 2. Test Execution Log

```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\chara\Documents\Projects\Wasto
collected 27 items

tests/test_api.py::test_health_endpoint PASSED                           [  3%]
tests/test_api.py::test_model_metadata_endpoint PASSED                   [  7%]
tests/test_api.py::test_predict_single_endpoint PASSED                   [ 11%]
tests/test_api.py::test_predict_single_invalid_file PASSED               [ 14%]
tests/test_api.py::test_predict_batch_endpoint PASSED                    [ 18%]
tests/test_api.py::test_dashboard_summary_endpoint PASSED                [ 22%]
tests/test_api.py::test_hardware_device_endpoints PASSED                 [ 25%]
tests/test_api.py::test_source_to_recycling_tracking_workflow PASSED     [ 29%]
tests/test_api.py::test_csv_export_endpoint PASSED                       [ 33%]
tests/test_edge_runtime.py::test_edge_runtime_start_stop PASSED          [ 37%]
tests/test_edge_runtime.py::test_edge_runtime_deduplication PASSED       [ 40%]
tests/test_inference.py::test_ml_engine_ready PASSED                     [ 44%]
tests/test_inference.py::test_preprocessing_parity PASSED                [ 48%]
tests/test_inference.py::test_predict_single_real_image PASSED           [ 51%]
tests/test_inference.py::test_predict_batch_with_partial_failure PASSED  [ 55%]
tests/test_inference.py::test_corrupt_file_raises_error PASSED           [ 59%]
tests/test_protocol.py::test_encode_command PASSED                       [ 62%]
tests/test_protocol.py::test_decode_response_types PASSED                [ 66%]
tests/test_protocol.py::test_simulator_adapter_lifecycle PASSED          [ 70%]
tests/test_protocol.py::test_simulator_telemetry PASSED                  [ 74%]
tests/test_taxonomy.py::test_canonical_classes_count PASSED              [ 77%]
tests/test_taxonomy.py::test_glass_and_metal_never_classified_as_organic PASSED [ 81%]
tests/test_taxonomy.py::test_organic_waste_routes_to_organic PASSED      [ 85%]
tests/test_taxonomy.py::test_residual_materials PASSED                   [ 88%]
tests/test_taxonomy.py::test_low_confidence_abstention PASSED            [ 92%]
tests/test_taxonomy.py::test_ambiguity_margin_abstention PASSED          [ 96%]
tests/test_taxonomy.py::test_unknown_label_abstention PASSED             [100%]

======================= 27 passed in 21.76s =======================
```
