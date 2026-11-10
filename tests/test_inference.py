"""
Integration tests for ML Inference Engine.
Verifies real model loading, preprocessing parity, single/batch prediction,
and robust handling of corrupt/invalid images.
"""

import os
import sys
import pytest
from PIL import Image
import numpy as np

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.inference import MLInferenceEngine

@pytest.fixture(scope="module")
def ml_engine():
    engine = MLInferenceEngine()
    return engine

def test_ml_engine_ready(ml_engine):
    assert ml_engine.is_ready is True
    meta = ml_engine.get_metadata()
    assert meta["model_name"] == "Wasto-MobileNetV3Large"
    assert meta["num_classes"] == 9
    assert meta["checksum_sha256"] is not None
    assert len(meta["classes"]) == 9

def test_preprocessing_parity(ml_engine):
    test_img = Image.new("RGB", (512, 384), color=(100, 150, 200))
    preprocessed = ml_engine.preprocess_image(test_img)

    assert preprocessed.shape == (256, 256, 3)
    assert preprocessed.dtype == np.float32
    # Ensure values in [0, 255] (no manual double normalization)
    assert np.min(preprocessed) >= 0.0
    assert np.max(preprocessed) <= 255.0

def test_predict_single_real_image(ml_engine):
    sample_path = os.path.join(PROJECT_ROOT, "Single Prediction Model", "plastic.jpg")
    if not os.path.exists(sample_path):
        pytest.skip("plastic.jpg sample not found")

    result = ml_engine.predict_single(sample_path)
    assert "material_label" in result
    assert "confidence" in result
    assert "scores" in result
    assert "routing_category" in result
    assert "is_uncertain" in result
    assert "inference_latency_ms" in result
    assert len(result["scores"]) == 9
    assert result["confidence"] >= 0.0 and result["confidence"] <= 1.0
    assert result["inference_latency_ms"] > 0

def test_predict_batch_with_partial_failure(ml_engine):
    valid_img = Image.new("RGB", (256, 256), color=(200, 200, 200))
    corrupt_bytes = b"NOT_A_VALID_IMAGE_DATA_STREAM"

    batch = [
        ("valid_1.jpg", valid_img),
        ("corrupted.jpg", corrupt_bytes),
        ("valid_2.jpg", valid_img),
    ]

    res = ml_engine.predict_batch(batch)
    assert res["total_items"] == 3
    assert res["success_count"] == 2
    assert res["failure_count"] == 1
    assert len(res["items"]) == 2
    assert len(res["failures"]) == 1
    assert res["failures"][0]["filename"] == "corrupted.jpg"
    assert "aggregates" in res
    assert "total_latency_ms" in res

def test_corrupt_file_raises_error(ml_engine):
    with pytest.raises(Exception):
        ml_engine.predict_single("non_existent_file_path_12345.jpg")
