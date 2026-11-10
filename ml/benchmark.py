"""
Wasto Latency & Throughput Benchmark.
Measures real hardware CPU inference performance, image decode,
preprocessing, serial actuation overhead, and end-to-end FPS.
"""

import time
import os
import sys
import platform
import numpy as np
from PIL import Image

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.inference import MLInferenceEngine
from edge.serial_bridge import SimulatorAdapter

def run_benchmark(num_warmup: int = 5, num_iterations: int = 30):
    print("=" * 60)
    print("WASTO ML & EDGE LATENCY BENCHMARK")
    print("=" * 60)
    print(f"OS: {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"Processor: {platform.processor()}")
    print(f"Python: {platform.python_version()}")

    engine = MLInferenceEngine()
    if not engine.is_ready:
        print(f"ERROR: Model could not be loaded: {engine._load_error}")
        return

    meta = engine.get_metadata()
    print(f"Model: {meta['model_name']} ({meta['num_classes']} classes)")
    print(f"Checksum: {meta['checksum_sha256']}")
    print(f"Input Shape: {meta['input_shape']}")
    print("-" * 60)

    # Create synthetic test image
    test_img = Image.new("RGB", (640, 480), color=(120, 200, 80))

    # 1. Image Decode & Resize Timing
    preprocess_times = []
    for _ in range(num_iterations):
        t0 = time.perf_counter()
        _ = engine.preprocess_image(test_img)
        preprocess_times.append(time.perf_counter() - t0)
    avg_preprocess_ms = (sum(preprocess_times) / len(preprocess_times)) * 1000.0

    # 2. Warmup forward pass
    print(f"Warming up ({num_warmup} cycles)...")
    for _ in range(num_warmup):
        engine.predict_single(test_img)

    # 3. Single-Image Forward Pass Latency
    print(f"Benchmarking batch size 1 ({num_iterations} cycles)...")
    forward_times = []
    for _ in range(num_iterations):
        t0 = time.perf_counter()
        _ = engine.predict_single(test_img)
        forward_times.append(time.perf_counter() - t0)

    forward_ms = [t * 1000.0 for t in forward_times]
    avg_forward_ms = sum(forward_ms) / len(forward_ms)
    min_forward_ms = min(forward_ms)
    max_forward_ms = max(forward_ms)
    p95_forward_ms = np.percentile(forward_ms, 95)
    fps_batch_1 = 1000.0 / avg_forward_ms

    # 4. Actuation Serial Dispatch Latency (SimulatorAdapter)
    sim = SimulatorAdapter()
    sim.connect()
    sim.arm()
    serial_times = []
    for _ in range(num_iterations):
        t0 = time.perf_counter()
        sim.send_sort("RECYCLABLE", hold_ms=50)
        serial_times.append(time.perf_counter() - t0)
        time.sleep(0.06)
    sim.disconnect()
    avg_serial_ms = (sum(serial_times) / len(serial_times)) * 1000.0

    # Summary Output
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS & EMPIRICAL EVIDENCE")
    print("=" * 60)
    print(f"Image Preprocessing Latency (mean):     {avg_preprocess_ms:.2f} ms")
    print(f"Model Forward Pass Latency (mean):      {avg_forward_ms:.2f} ms")
    print(f"Model Forward Pass Latency (min):       {min_forward_ms:.2f} ms")
    print(f"Model Forward Pass Latency (p95):       {p95_forward_ms:.2f} ms")
    print(f"Model Forward Pass Latency (max):       {max_forward_ms:.2f} ms")
    print(f"Model Inference Throughput:             {fps_batch_1:.1f} FPS")
    print(f"Serial Dispatch Overhead (mean):        {avg_serial_ms:.2f} ms")
    print(f"Total End-to-End Latency (mean):        {avg_preprocess_ms + avg_forward_ms + avg_serial_ms:.2f} ms")
    print(f"Max Pipeline Sustained Frame Rate:      {1000.0 / (avg_preprocess_ms + avg_forward_ms + avg_serial_ms):.1f} FPS")
    print("=" * 60)

    print("\nEmpirical Note on Portfolio '30+ FPS' Claim:")
    if fps_batch_1 >= 30.0:
        print(f"Status: VERIFIED. Model throughput ({fps_batch_1:.1f} FPS) achieves 30+ FPS threshold on this CPU.")
    else:
        print(f"Status: MEASURED REALITY. Real measured CPU throughput is {fps_batch_1:.1f} FPS (latency {avg_forward_ms:.1f} ms).")
        print("Continuous 30+ FPS requires batched inference, ONNX/OpenVINO quantization, or a GPU accelerator.")

if __name__ == "__main__":
    run_benchmark()
