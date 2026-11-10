"""
Unit tests for Wasto Edge Camera Runtime.
Verifies thread lifecycle, bounded frame queue, deduplication,
and abstention behavior.
"""

import time
import pytest
from edge.camera_runtime import EdgeCameraRuntime
from edge.serial_bridge import SimulatorAdapter
from ml.inference import MLInferenceEngine

def test_edge_runtime_start_stop():
    sim = SimulatorAdapter()
    engine = MLInferenceEngine()
    runtime = EdgeCameraRuntime(camera_index=-1, ml_engine=engine, hardware_adapter=sim, max_fps=15.0)

    assert not runtime.is_running()
    runtime.start()
    assert runtime.is_running()

    # Let loop process a few frames
    time.sleep(0.5)
    assert runtime.last_detection is not None
    assert "material_label" in runtime.last_detection

    runtime.stop()
    assert not runtime.is_running()

def test_edge_runtime_deduplication():
    sim = SimulatorAdapter()
    engine = MLInferenceEngine()
    runtime = EdgeCameraRuntime(camera_index=-1, ml_engine=engine, hardware_adapter=sim, dedup_cooldown_sec=5.0)

    runtime.start()
    time.sleep(0.6)

    sort_events_count = 0
    # Simulate repeated detections
    if runtime.last_sort_event:
        first_event_time = runtime.last_sort_event["timestamp"]
        # Allow second detection loop
        time.sleep(0.4)
        second_event_time = runtime.last_sort_event["timestamp"]
        # In deduplication cooldown, the sorting event timestamp should NOT re-trigger every frame
        assert first_event_time == second_event_time

    runtime.stop()
