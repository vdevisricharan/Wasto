"""
Integration tests for Wasto FastAPI endpoints.
Verifies HTTP API, validation errors, database persistence,
dashboard aggregation, and source-to-recycling tracking.
"""

import os
import sys
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from services.api.main import app
from services.api.database import init_db, get_db_connection

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("HEALTHY", "DEGRADED")
    assert "ml_model_ready" in data
    assert "hardware_adapter" in data

def test_model_metadata_endpoint():
    resp = client.get("/api/model/metadata")
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_name"] == "Wasto-MobileNetV3Large"
    assert data["num_classes"] == 9
    assert len(data["classes"]) == 9

def test_predict_single_endpoint():
    # Create simple in-memory PNG
    img = Image.new("RGB", (256, 256), color=(60, 180, 75))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    resp = client.post(
        "/api/predict/single",
        files={"file": ("test_leaf.jpg", buf, "image/jpeg")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "prediction_id" in data
    assert "material_label" in data
    assert "routing_category" in data
    assert "confidence" in data
    assert "scores" in data
    assert "is_uncertain" in data

def test_predict_single_invalid_file():
    # Non-image file submission
    fake_txt = io.BytesIO(b"Hello world, not an image")
    resp = client.post(
        "/api/predict/single",
        files={"file": ("notes.txt", fake_txt, "text/plain")},
    )
    assert resp.status_code == 400

def test_predict_batch_endpoint():
    img1 = Image.new("RGB", (256, 256), color=(20, 20, 20))
    buf1 = io.BytesIO()
    img1.save(buf1, format="JPEG")
    buf1.seek(0)

    img2 = Image.new("RGB", (256, 256), color=(200, 200, 200))
    buf2 = io.BytesIO()
    img2.save(buf2, format="JPEG")
    buf2.seek(0)

    resp = client.post(
        "/api/predict/batch",
        files=[
            ("files", ("img1.jpg", buf1, "image/jpeg")),
            ("files", ("img2.jpg", buf2, "image/jpeg")),
        ],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_items"] == 2
    assert data["success_count"] == 2
    assert data["failure_count"] == 0
    assert len(data["items"]) == 2

def test_dashboard_summary_endpoint():
    resp = client.get("/api/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_predictions" in data
    assert "total_actuated_sorts" in data
    assert "material_distribution" in data
    assert "routing_distribution" in data
    assert "latest_telemetry" in data

def test_hardware_device_endpoints():
    # Check status
    resp = client.get("/api/device/status")
    assert resp.status_code == 200

    # Arm
    arm_resp = client.post("/api/device/arm")
    assert arm_resp.status_code == 200
    assert arm_resp.json()["status"] == "ARMED"

    # Actuate
    act_resp = client.post(
        "/api/device/actuate",
        json={"target_bin": "RECYCLABLE", "hold_duration_ms": 300},
    )
    assert act_resp.status_code == 200
    act_data = act_resp.json()
    assert "sorting_event_id" in act_data
    assert act_data["status"] == "ACKED"

def test_source_to_recycling_tracking_workflow():
    # 1. Create a new waste batch
    create_resp = client.post(
        "/api/tracking/batches",
        json={
            "source_organization": "Test University Campus",
            "material_category": "Paper and Cardboard",
            "estimated_kg": 75.0,
            "notes": "Testing source tracking lifecycle",
        },
    )
    assert create_resp.status_code == 200
    batch_id = create_resp.json()["batch_id"]

    # 2. Add tracking event
    evt_resp = client.post(
        f"/api/tracking/batches/{batch_id}/events",
        json={
            "stage": "PICKUP_SCHEDULED",
            "actor": "Logistics Dispatcher",
            "location": "North Campus Gate",
            "notes": "Vehicle DL-3C-1102 scheduled for 2:00 PM",
        },
    )
    assert evt_resp.status_code == 200
    assert evt_resp.json()["new_stage"] == "PICKUP_SCHEDULED"

    # 3. Retrieve batch details with timeline
    detail_resp = client.get(f"/api/tracking/batches/{batch_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["id"] == batch_id
    assert data["status"] == "PICKUP_SCHEDULED"
    assert len(data["timeline"]) == 2  # CREATED + PICKUP_SCHEDULED

def test_csv_export_endpoint():
    resp = client.get("/api/export/predictions.csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Prediction ID,Timestamp ISO,Filename" in resp.text
