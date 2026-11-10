"""
Wasto Machine Learning Inference Engine.
Loads MobileNetV3 model, enforces standardized preprocessing,
computes 9-class probability distributions, applies uncertainty thresholds,
and maps predictions to operational recycling bins.
"""

import time
import os
import sys
import hashlib
from typing import List, Dict, Any, Optional, Tuple, Union
from PIL import Image
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.taxonomy import (
    CANONICAL_CLASSES,
    MaterialClass,
    RoutingCategory,
    resolve_routing,
    DISPOSAL_GUIDANCE,
    ROUTING_POLICY_VERSION,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_AMBIGUITY_MARGIN,
)

# Relative default path to weights
DEFAULT_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Single Prediction Model",
    "model.h5",
)

class MLInferenceEngine:
    """Production ML Inference Engine for Wasto Waste Classification."""

    def __init__(self, model_path: str = DEFAULT_MODEL_PATH, fallback_mode: bool = False):
        self.model_path = model_path
        self.fallback_mode = fallback_mode
        self.model = None
        self.model_checksum: Optional[str] = None
        self.input_shape = (256, 256, 3)
        self.classes = CANONICAL_CLASSES
        self._is_loaded = False
        self._load_error: Optional[str] = None

        if not fallback_mode and os.path.exists(self.model_path):
            self._load_model()
        else:
            if not os.path.exists(self.model_path):
                self._load_error = f"Model file not found at {self.model_path}"

    def _load_model(self):
        """Loads model weights via tf_keras."""
        try:
            # Compute SHA256 checksum
            sha = hashlib.sha256()
            with open(self.model_path, "rb") as f:
                while chunk := f.read(65536):
                    sha.update(chunk)
            self.model_checksum = sha.hexdigest()

            import tf_keras as keras
            self.model = keras.models.load_model(self.model_path, compile=False)
            self._is_loaded = True
            self._load_error = None
        except Exception as e:
            self._is_loaded = False
            self._load_error = str(e)

    @property
    def is_ready(self) -> bool:
        return self._is_loaded and self.model is not None

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "model_name": "Wasto-MobileNetV3Large",
            "version": "1.0.0",
            "input_shape": list(self.input_shape),
            "classes": self.classes,
            "num_classes": len(self.classes),
            "checksum_sha256": self.model_checksum,
            "status": "READY" if self.is_ready else "ERROR",
            "error_detail": self._load_error,
            "routing_policy_version": ROUTING_POLICY_VERSION,
            "thresholds": {
                "confidence_threshold": DEFAULT_CONFIDENCE_THRESHOLD,
                "ambiguity_margin": DEFAULT_AMBIGUITY_MARGIN,
            },
        }

    def preprocess_image(self, image: Image.Image) -> np.ndarray:
        """
        Standardized preprocessing:
        1. Convert PIL image to 3-channel RGB.
        2. Resize to 256x256 using bilinear interpolation.
        3. Convert to float32 array in [0.0, 255.0].
        NOTE: Model contains built-in Rescaling layer (1/127.5, offset -1.0).
        DO NOT apply manual normalization here to avoid double normalization.
        """
        rgb_img = image.convert("RGB")
        resized_img = rgb_img.resize((self.input_shape[0], self.input_shape[1]), Image.Resampling.BILINEAR)
        img_array = np.array(resized_img, dtype=np.float32)
        return img_array

    def predict_single(
        self,
        image_or_path: Union[str, Image.Image, np.ndarray],
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        ambiguity_margin: float = DEFAULT_AMBIGUITY_MARGIN,
    ) -> Dict[str, Any]:
        """
        Runs single-image inference and resolves operational routing.
        Raises ValueError on corrupted or invalid input.
        """
        start_time = time.perf_counter()

        # Load image if path provided
        if isinstance(image_or_path, str):
            if not os.path.exists(image_or_path):
                raise FileNotFoundError(f"Image not found at {image_or_path}")
            img = Image.open(image_or_path)
        elif isinstance(image_or_path, Image.Image):
            img = image_or_path
        elif isinstance(image_or_path, np.ndarray):
            img = Image.fromarray(image_or_path.astype("uint8"))
        else:
            raise TypeError("Unsupported image input type")

        # Preprocess
        preprocessed = self.preprocess_image(img)
        batch = np.expand_dims(preprocessed, 0)

        # Forward pass
        if not self.is_ready:
            raise RuntimeError(f"Model is not ready for inference: {self._load_error}")

        raw_preds = self.model(batch, training=False).numpy()[0]
        # Softmax scores
        scores = {cls_name: float(raw_preds[i]) for i, cls_name in enumerate(self.classes)}
        top_idx = int(np.argmax(raw_preds))
        top_material = self.classes[top_idx]
        confidence = float(raw_preds[top_idx])

        # Resolve operational routing
        routing_category, is_uncertain, uncertainty_reason = resolve_routing(
            material_label=top_material,
            confidence=confidence,
            scores=scores,
            confidence_threshold=confidence_threshold,
            ambiguity_margin=ambiguity_margin,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return {
            "material_label": top_material,
            "confidence": round(confidence, 4),
            "scores": {k: round(v, 4) for k, v in scores.items()},
            "routing_category": routing_category.value,
            "is_uncertain": is_uncertain,
            "uncertainty_reason": uncertainty_reason,
            "disposal_guidance": DISPOSAL_GUIDANCE[routing_category.value],
            "routing_policy_version": ROUTING_POLICY_VERSION,
            "inference_latency_ms": round(latency_ms, 2),
            "timestamp": time.time(),
        }

    def predict_batch(
        self,
        images_with_names: List[Tuple[str, Union[str, Image.Image, bytes]]],
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        ambiguity_margin: float = DEFAULT_AMBIGUITY_MARGIN,
    ) -> Dict[str, Any]:
        """
        Processes a batch of images with partial-failure isolation.
        Returns per-file results, error records, aggregates, and summary statistics.
        """
        results = []
        failures = []
        material_counts: Dict[str, int] = {c: 0 for c in self.classes}
        routing_counts: Dict[str, int] = {r.value: 0 for r in RoutingCategory}

        start_batch_time = time.perf_counter()

        for filename, img_input in images_with_names:
            try:
                if isinstance(img_input, bytes):
                    import io
                    img = Image.open(io.BytesIO(img_input))
                else:
                    img = img_input

                item_res = self.predict_single(
                    img,
                    confidence_threshold=confidence_threshold,
                    ambiguity_margin=ambiguity_margin,
                )
                item_res["filename"] = filename
                item_res["status"] = "SUCCESS"
                results.append(item_res)

                # Aggregate counts
                mat = item_res["material_label"]
                route = item_res["routing_category"]
                material_counts[mat] = material_counts.get(mat, 0) + 1
                routing_counts[route] = routing_counts.get(route, 0) + 1

            except Exception as e:
                failures.append({
                    "filename": filename,
                    "status": "FAILED",
                    "error": str(e),
                })

        total_latency_ms = (time.perf_counter() - start_batch_time) * 1000.0

        return {
            "total_items": len(images_with_names),
            "success_count": len(results),
            "failure_count": len(failures),
            "items": results,
            "failures": failures,
            "aggregates": {
                "material_distribution": material_counts,
                "routing_distribution": routing_counts,
            },
            "total_latency_ms": round(total_latency_ms, 2),
            "average_latency_ms": round(total_latency_ms / max(1, len(results)), 2),
        }
