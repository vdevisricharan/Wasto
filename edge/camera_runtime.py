"""
Wasto Edge Video Capture & Sorter Loop.
Performs OpenCV video frame ingestion with bounded buffers,
stale frame dropping, temporal object deduplication, inference dispatch,
and serial actuation.
"""

import time
import threading
import queue
import logging
from typing import Optional, Callable
import numpy as np
from PIL import Image

from ml.inference import MLInferenceEngine
from edge.serial_bridge import HardwareAdapter, SimulatorAdapter
from shared.protocol import ROUTING_TO_TARGET_BIN, TargetBin

logger = logging.getLogger("wasto.edge_runtime")

class EdgeCameraRuntime:
    """
    Manages continuous video capture and sorting pipeline:
    - Bounded single-slot frame queue (drops stale frames)
    - Single-item temporal deduplication (prevents repeated flap triggers)
    - Pluggable hardware adapter (Serial or Simulator)
    - Non-blocking asynchronous threads
    """

    def __init__(
        self,
        camera_index: int = 0,
        ml_engine: Optional[MLInferenceEngine] = None,
        hardware_adapter: Optional[HardwareAdapter] = None,
        max_fps: float = 10.0,
        dedup_cooldown_sec: float = 2.5,
    ):
        self.camera_index = camera_index
        self.ml_engine = ml_engine or MLInferenceEngine()
        self.hardware_adapter = hardware_adapter or SimulatorAdapter()
        self.max_fps = max_fps
        self.dedup_cooldown_sec = dedup_cooldown_sec

        self._frame_queue = queue.Queue(maxsize=1)
        self._running = False
        self._capture_thread: Optional[threading.Thread] = None
        self._inference_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Telemetry & callbacks
        self.last_detection: Optional[dict] = None
        self.last_sort_event: Optional[dict] = None
        self.on_prediction_callback: Optional[Callable[[dict], None]] = None

        # Deduplication state
        self._last_sorted_class: Optional[str] = None
        self._last_sorted_time: float = 0.0

    def start(self):
        """Starts capture and processing threads."""
        with self._lock:
            if self._running:
                return
            self._running = True

            if not self.hardware_adapter.is_connected():
                self.hardware_adapter.connect()
            self.hardware_adapter.arm()

            self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
            self._inference_thread = threading.Thread(target=self._inference_loop, daemon=True)

            self._capture_thread.start()
            self._inference_thread.start()
            logger.info("EdgeCameraRuntime started (Camera Index: %d, Max FPS: %.1f)", self.camera_index, self.max_fps)

    def stop(self):
        """Gracefully halts threads and closes hardware."""
        with self._lock:
            self._running = False

        if self._capture_thread:
            self._capture_thread.join(timeout=1.0)
        if self._inference_thread:
            self._inference_thread.join(timeout=1.0)

        # Clear queue
        while not self._frame_queue.empty():
            try:
                self._frame_queue.get_nowait()
            except queue.Empty:
                break

        logger.info("EdgeCameraRuntime stopped")

    def is_running(self) -> bool:
        return self._running

    def _capture_loop(self):
        """Ingests frames from OpenCV camera device with rate limiting."""
        cap = None
        try:
            import cv2
            cap = cv2.VideoCapture(self.camera_index)
        except Exception as e:
            logger.warning("OpenCV camera capture unavailable: %s. Using synthetic frame generator.", e)

        interval = 1.0 / self.max_fps

        while self._running:
            start_loop = time.time()
            frame_rgb = None

            if cap and cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None:
                    # Explicit BGR -> RGB conversion
                    import cv2
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            if frame_rgb is None:
                # Fallback synthetic frame for simulation
                frame_rgb = np.full((480, 640, 3), (120, 180, 100), dtype=np.uint8)

            # Drop stale frame if queue is full
            if self._frame_queue.full():
                try:
                    self._frame_queue.get_nowait()
                except queue.Empty:
                    pass

            try:
                self._frame_queue.put_nowait((time.time(), frame_rgb))
            except queue.Full:
                pass

            elapsed = time.time() - start_loop
            sleep_time = max(0.005, interval - elapsed)
            time.sleep(sleep_time)

        if cap and cap.isOpened():
            cap.release()

    def _inference_loop(self):
        """Pulls latest frame, runs classification, evaluates deduplication, commands actuation."""
        while self._running:
            try:
                frame_time, frame_rgb = self._frame_queue.get(timeout=0.2)
            except queue.Empty:
                continue

            pil_img = Image.fromarray(frame_rgb)
            try:
                pred = self.ml_engine.predict_single(pil_img)
                self.last_detection = pred

                if self.on_prediction_callback:
                    try:
                        self.on_prediction_callback(pred)
                    except Exception:
                        pass

                # Sorting and Deduplication Logic
                now = time.time()
                mat = pred["material_label"]
                routing = pred["routing_category"]
                is_uncertain = pred["is_uncertain"]

                # INVARIANT: Uncertain items NEVER trigger automatic sorting actuation
                if is_uncertain or routing == "Unknown / Manual Review":
                    continue

                # Deduplication check: if same material seen within cooldown, treat as same object
                is_duplicate = (
                    mat == self._last_sorted_class and
                    (now - self._last_sorted_time) < self.dedup_cooldown_sec
                )

                if not is_duplicate:
                    target_bin = ROUTING_TO_TARGET_BIN.get(routing, TargetBin.NONE)
                    if target_bin != TargetBin.NONE:
                        success, detail = self.hardware_adapter.send_sort(target_bin.value, hold_ms=1200)
                        self._last_sorted_class = mat
                        self._last_sorted_time = now
                        self.last_sort_event = {
                            "timestamp": now,
                            "material": mat,
                            "target_bin": target_bin.value,
                            "success": success,
                            "detail": detail,
                        }
                        logger.info("Actuated sorting flap for %s -> %s (Success: %s)", mat, target_bin.value, success)

            except Exception as e:
                logger.error("Error in edge inference loop: %s", e)
