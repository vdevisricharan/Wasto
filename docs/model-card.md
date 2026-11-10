# Wasto Model Card: MobileNetV3Large Waste Classifier

**Model Identifier**: `wasto-mobilenetv3-large-v1.0`  
**Architecture**: MobileNetV3Large (Functional Keras/TensorFlow model, 269 layers)  
**Input Resolution**: `256 x 256 x 3` (RGB)  
**Output Dimensionality**: 9 softmax logits  
**Artifact Path**: `Single Prediction Model/model.h5`  
**Artifact SHA-256 Checksum**: `2de1c4619c3fb2dd2aa4d42adf1a71a1cf48cb7e4e5738b0930a9d46dcf7f3c2`  

---

## 1. Intended Use

- **Primary Application**: Edge computer vision inference in automated waste sorting stations and municipal material recovery facilities (MRFs).
- **Secondary Application**: Desktop/mobile operator verification of segregated waste batches.
- **Out-of-Scope Uses**: 
  - Do NOT use for autonomous hazardous waste identification (biohazard, sharp medical needles, volatile chemicals).
  - Do NOT use for fine commercial purity certification without secondary human inspection.

---

## 2. Supported Material Classes & Operational Routing

The model classifies images into nine material classes mapped to three operational bins + manual review:

| Class Index | Material Label | Operational Routing | Standard Guidance |
| :--- | :--- | :--- | :--- |
| 0 | `Aluminium` | **Recyclable** | Clean dry metal cans, foils, and containers. |
| 1 | `Carton` | **Recyclable** | Clean corrugated and flat carton board. |
| 2 | `Glass` | **Recyclable** | Clear/colored bottles and glass containers. |
| 3 | `Organic Waste` | **Organic** | Food scraps, peels, vegetable waste for composting. |
| 4 | `Other Plastics` | **Residual** | Non-PET/HDPE mixed polymers or multi-layer wrappers. |
| 5 | `Paper and Cardboard` | **Recyclable** | Clean newspapers, office paper, clean cardboard. |
| 6 | `Plastic` | **Recyclable** | PET/HDPE bottles, containers, clean packaging. |
| 7 | `Textiles` | **Residual** | Cloth scraps, non-recyclable garment fibers. |
| 8 | `Wood` | **Residual** | Untreated or treated timber scraps, dowels. |

### Operational Abstention Policy
- **Confidence Threshold**: $\ge 0.60$.
- **Ambiguity Margin**: $\ge 0.15$ difference between top-1 and top-2 softmax scores.
- Any prediction failing either criterion is abstained as **`Unknown / Manual Review`** with zero physical flap movement.

---

## 3. Dataset Provenance & Licenses

1. **TrashNet Dataset**:
   - Original Author: Mindy Yang and Gary Thung (Stanford University, 2017).
   - License: MIT License.
   - Classes: Glass, Paper, Cardboard, Plastic, Metal, Trash (2,527 images).
2. **Wasto Multi-Class Domain Dataset**:
   - Classes: Aluminium, Carton, Glass, Organic Waste, Other Plastics, Paper and Cardboard, Plastic, Textiles, Wood (5,078 curated images in `Single Prediction Model/Dataset`).
   - Sourced from open recycling imagery corpora under educational and fair-use research licensing.

---

## 4. Empirical Evaluation & Benchmarks

Measured on host workstation (AMD64 CPU, Python 3.11, TensorFlow 2.21 / tf_keras 2.21):

- **Image Preprocessing Latency**: 1.83 ms
- **Model Forward Pass Latency (Single Image)**:
  - Mean: 205.54 ms
  - Minimum: 186.47 ms
  - 95th Percentile: 218.16 ms
  - Maximum: 224.70 ms
- **Measured CPU Throughput**: **4.9 FPS** (unbatched, float32 CPU execution)
- **Serial Protocol Overhead**: 0.74 ms
- **Total Pipeline Latency**: 208.11 ms (~4.8 sustained FPS)

> [!NOTE]
> **Reconciliation of Portfolio '30+ FPS' Claim**:
> The portfolio case study's theoretical claim of 30+ FPS reflects ideal GPU or edge accelerator throughput (e.g. Google Coral TPU, Intel OpenVINO VPU, or NVIDIA Jetson with FP16/INT8 TensorRT). On standard unquantized x86/ARM CPU inference, unbatched TensorFlow execution yields ~4.9 FPS. Full real-time 30 FPS on CPU requires INT8 quantization (TFLite/ONNX Runtime).

---

## 5. Known Failure Modes & Limitations

1. **Crushed & Deformed Containers**: Heavily compressed plastic bottles can be misclassified as other polymers or glass due to distorted specular highlights.
2. **Organic Contamination on Recyclables**: Unrinsed food containers (e.g. greasy pizza boxes) should be diverted to Residual, but visual features may trigger high Recyclable confidence. The UI explicitly instructs operators to rinse items.
3. **Low Contrast / Poor Lighting**: Dim industrial chutes reduce classification confidence below the 0.60 threshold, appropriately triggering manual review.
