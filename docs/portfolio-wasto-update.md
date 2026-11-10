# Portfolio Case Study Synchronization: Wasto

**Portfolio Target File**: `3D-Portfolio/src/constants/caseStudies.js` & `3D-Portfolio/src/constants/index.js`  
**Live Site**: `https://vdevisricharan.netlify.app/project/wasto`  
**Synchronization Status**: Applied and Verified (10 November 2026)  

---

## 1. Summary of Changes Applied to Portfolio Source

1. **Vision Architecture & Resolution**:
   - Reconciled input resolution to $256 \times 256$ RGB (matching `model.h5` tensor contract).
   - Documented 9-class fine-grained material detection (`Aluminium`, `Carton`, `Glass`, `Organic Waste`, `Other Plastics`, `Paper and Cardboard`, `Plastic`, `Textiles`, `Wood`).
2. **Operational Routing & Zero-False-Biodegradability Invariant**:
   - Replaced binary plastic/biodegradable confusion with 3-chute routing (`Organic`, `Recyclable`, `Residual`) + automated abstention for low confidence ($< 0.60$) or ambiguous top-2 margin ($< 0.15$).
   - Explicitly documented that glass, metal, and plastics are forbidden from routing to Organic compost chutes.
3. **Hardware & Firmware Architecture**:
   - Accurately describes the non-blocking ASCII-framed serial protocol (v1.0) with sequence matching and 30-second watchdog auto-disarm.
   - Clarified that Arduino firmware (`wasto_sorter.ino`) is compilable and simulated via `SimulatorAdapter`, while mechanical sorting on moving conveyor belts requires physical rig commissioning.
4. **Empirical Benchmarks vs Theoretical Claims**:
   - Disclosed real measured AMD64 CPU throughput: **4.9 FPS (205.5 ms mean latency)** for unquantized float32 inference.
   - Clarified that the "30+ FPS" claim represents theoretical GPU/INT8 edge accelerator performance rather than CPU line-rate reality.
5. **Municipal Source-to-Recycling Tracking**:
   - Added documentation for the end-to-end SQLite tracking audit trail (Source Registration $\to$ Pickup Scheduling $\to$ Vehicle Tare Verification $\to$ Facility Optical Sort $\to$ Final Disposition).
6. **Repository & Stack Links**:
   - Updated GitHub URL to canonical `https://github.com/vdevisricharan/Wasto`.
   - Updated stack tags to reflect React 18, Vite, FastAPI, and TypeScript.
