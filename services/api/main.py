"""
Wasto FastAPI Application.
Exposes RESTful endpoints for ML inference, hardware actuation,
telemetry streaming, historical reporting, and waste tracking.
"""

import os
import sys
import time
import uuid
import json
import logging
from typing import List, Optional, Dict, Any
from io import BytesIO

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from shared.taxonomy import (
    CANONICAL_CLASSES,
    RoutingCategory,
    ROUTING_POLICY_VERSION,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_AMBIGUITY_MARGIN,
)
from shared.protocol import TargetBin, ROUTING_TO_TARGET_BIN
from ml.inference import MLInferenceEngine
from edge.serial_bridge import HardwareAdapter, SimulatorAdapter, SerialArduinoAdapter
from services.api.database import get_db_connection, init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wasto.api")

app = FastAPI(
    title="Wasto Smart Waste Classification & Tracking API",
    version="1.0.0",
    description="Automated waste sorting inference, serial hardware actuation, and lifecycle tracking.",
)

# Enable CORS for local web dev and Netlify domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML Engine
ml_engine = MLInferenceEngine()

# Initialize Hardware Adapter (Simulator default; can connect physical via config)
HARDWARE_MODE = os.environ.get("WASTO_HARDWARE_MODE", "SIMULATED").upper()
ARDUINO_PORT = os.environ.get("WASTO_ARDUINO_PORT", "COM3")

if HARDWARE_MODE == "PHYSICAL":
    hardware_adapter: HardwareAdapter = SerialArduinoAdapter(port=ARDUINO_PORT)
    hardware_adapter.connect()
else:
    hardware_adapter: HardwareAdapter = SimulatorAdapter()
    hardware_adapter.connect()
    # Auto-arm simulator for demo convenience
    hardware_adapter.arm()

# Pydantic Schemas
class ActuateRequest(BaseModel):
    target_bin: str = Field(..., description="Target chute: ORGANIC, RECYCLABLE, RESIDUAL, or NONE")
    hold_duration_ms: int = Field(1200, ge=200, le=5000, description="Flap hold duration in milliseconds")
    prediction_id: Optional[str] = Field(None, description="Optional linked prediction ID")

class CreateBatchRequest(BaseModel):
    source_organization: str = Field(..., min_length=2, max_length=200)
    material_category: str = Field(..., min_length=2, max_length=100)
    estimated_kg: Optional[float] = Field(None, ge=0.0)
    notes: Optional[str] = Field(None, max_length=1000)

class AddTrackingEventRequest(BaseModel):
    stage: str = Field(..., description="CREATED, PICKUP_SCHEDULED, COLLECTED, AT_FACILITY, SORTED, PROCESSED")
    actor: str = Field(..., min_length=2, max_length=150)
    location: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    linked_prediction_id: Optional[str] = None
    linked_sorting_id: Optional[str] = None

# VALID STAGE TRANSITIONS
LIFECYCLE_STAGES = [
    "CREATED",
    "PICKUP_SCHEDULED",
    "COLLECTED",
    "AT_FACILITY",
    "SORTED",
    "PROCESSED",
]

# --- 1. HEALTH & METADATA ---

@app.get("/api/health")
def get_health():
    db_ok = False
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            db_ok = cur.fetchone()[0] == 1
    except Exception:
        db_ok = False

    hw_status = hardware_adapter.get_status()

    return {
        "status": "HEALTHY" if ml_engine.is_ready and db_ok else "DEGRADED",
        "service": "Wasto API",
        "version": "1.0.0",
        "ml_model_ready": ml_engine.is_ready,
        "database_connected": db_ok,
        "hardware_adapter": hw_status,
        "timestamp": time.time(),
    }

@app.get("/api/model/metadata")
def get_model_metadata():
    return ml_engine.get_metadata()

# --- 2. PREDICTION ENDPOINTS ---

@app.post("/api/predict/single")
async def predict_single(
    file: UploadFile = File(...),
    threshold: float = Query(DEFAULT_CONFIDENCE_THRESHOLD, ge=0.0, le=1.0),
    ambiguity_margin: float = Query(DEFAULT_AMBIGUITY_MARGIN, ge=0.0, le=1.0),
):
    """Executes single-image inference, applies thresholding, and persists record."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file submitted.")
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image size exceeds 15MB limit.")

    try:
        from PIL import Image
        img = Image.open(BytesIO(content))
        img.verify()
        img = Image.open(BytesIO(content)) # Re-open after verify
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Corrupted or unsupported image file: {str(e)}")

    if not ml_engine.is_ready:
        raise HTTPException(status_code=503, detail="ML inference engine is offline.")

    result = ml_engine.predict_single(
        img,
        confidence_threshold=threshold,
        ambiguity_margin=ambiguity_margin,
    )

    pred_id = f"pred_{uuid.uuid4().hex[:12]}"
    filename = file.filename or "uploaded_image.jpg"

    # Persist in SQLite
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO predictions (
                id, timestamp, filename, material_label, confidence,
                routing_category, is_uncertain, uncertainty_reason,
                scores_json, latency_ms, source_mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pred_id,
            result["timestamp"],
            filename,
            result["material_label"],
            result["confidence"],
            result["routing_category"],
            1 if result["is_uncertain"] else 0,
            result["uncertainty_reason"],
            json.dumps(result["scores"]),
            result["inference_latency_ms"],
            hardware_adapter.get_status().get("mode", "SIMULATED"),
        ))
        conn.commit()

    result["prediction_id"] = pred_id
    result["filename"] = filename
    return result

@app.post("/api/predict/batch")
async def predict_batch(
    files: List[UploadFile] = File(...),
    threshold: float = Query(DEFAULT_CONFIDENCE_THRESHOLD, ge=0.0, le=1.0),
    ambiguity_margin: float = Query(DEFAULT_AMBIGUITY_MARGIN, ge=0.0, le=1.0),
):
    """Executes multi-file batch classification with partial failure isolation."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 images per batch.")

    if not ml_engine.is_ready:
        raise HTTPException(status_code=503, detail="ML inference engine is offline.")

    items_to_process = []
    for f in files:
        content = await f.read()
        items_to_process.append((f.filename or "unnamed.jpg", content))

    batch_result = ml_engine.predict_batch(
        items_to_process,
        confidence_threshold=threshold,
        ambiguity_margin=ambiguity_margin,
    )

    # Persist successful items
    with get_db_connection() as conn:
        for item in batch_result["items"]:
            pred_id = f"pred_{uuid.uuid4().hex[:12]}"
            item["prediction_id"] = pred_id
            conn.execute("""
                INSERT INTO predictions (
                    id, timestamp, filename, material_label, confidence,
                    routing_category, is_uncertain, uncertainty_reason,
                    scores_json, latency_ms, source_mode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                pred_id,
                item["timestamp"],
                item["filename"],
                item["material_label"],
                item["confidence"],
                item["routing_category"],
                1 if item["is_uncertain"] else 0,
                item["uncertainty_reason"],
                json.dumps(item["scores"]),
                item["inference_latency_ms"],
                hardware_adapter.get_status().get("mode", "SIMULATED"),
            ))
        conn.commit()

    return batch_result

# --- 3. DASHBOARD & HISTORY ---

@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    """Derives empirical dashboard metrics directly from persistent records."""
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Total predictions
        cur.execute("SELECT COUNT(*) FROM predictions")
        total_predictions = cur.fetchone()[0]

        # Total physically completed sorts
        cur.execute("SELECT COUNT(*) FROM sorting_events WHERE status = 'COMPLETED' OR status = 'ACKED'")
        total_sorts = cur.fetchone()[0]

        # Material distribution
        cur.execute("SELECT material_label, COUNT(*) FROM predictions GROUP BY material_label")
        material_dist = {row[0]: row[1] for row in cur.fetchall()}

        # Routing distribution
        cur.execute("SELECT routing_category, COUNT(*) FROM predictions GROUP BY routing_category")
        routing_dist = {row[0]: row[1] for row in cur.fetchall()}

        # Uncertainty count
        cur.execute("SELECT COUNT(*) FROM predictions WHERE is_uncertain = 1")
        uncertain_count = cur.fetchone()[0]

        # Active batches count
        cur.execute("SELECT COUNT(*) FROM waste_batches")
        total_batches = cur.fetchone()[0]

        # Latest telemetry
        cur.execute("SELECT distance_cm, fill_pct, timestamp, is_simulated FROM telemetry_readings ORDER BY id DESC LIMIT 1")
        last_telem_row = cur.fetchone()
        if last_telem_row:
            latest_telem = {
                "distance_cm": last_telem_row[0],
                "fill_pct": last_telem_row[1],
                "timestamp": last_telem_row[2],
                "source": "SIMULATED" if last_telem_row[3] else "PHYSICAL",
            }
        else:
            # Query active adapter if DB empty
            latest_telem = hardware_adapter.get_latest_telemetry()

    uncertainty_rate = (uncertain_count / total_predictions * 100.0) if total_predictions > 0 else 0.0

    return {
        "total_predictions": total_predictions,
        "total_actuated_sorts": total_sorts,
        "material_distribution": material_dist,
        "routing_distribution": routing_dist,
        "uncertain_predictions_count": uncertain_count,
        "uncertainty_rate_pct": round(uncertainty_rate, 1),
        "total_waste_batches": total_batches,
        "latest_telemetry": latest_telem,
        "hardware_status": hardware_adapter.get_status(),
        "timestamp": time.time(),
    }

@app.get("/api/history")
def get_prediction_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    material: Optional[str] = None,
    routing: Optional[str] = None,
    is_uncertain: Optional[bool] = None,
):
    """Returns paginated prediction history with filtering."""
    offset = (page - 1) * page_size
    query = "SELECT * FROM predictions WHERE 1=1"
    params = []

    if material:
        query += " AND material_label = ?"
        params.append(material)
    if routing:
        query += " AND routing_category = ?"
        params.append(routing)
    if is_uncertain is not None:
        query += " AND is_uncertain = ?"
        params.append(1 if is_uncertain else 0)

    count_query = f"SELECT COUNT(*) FROM ({query})"

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(count_query, params)
        total_records = cur.fetchone()[0]

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([page_size, offset])
        cur.execute(query, params)
        rows = cur.fetchall()

        items = []
        for r in rows:
            items.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "filename": r["filename"],
                "material_label": r["material_label"],
                "confidence": r["confidence"],
                "routing_category": r["routing_category"],
                "is_uncertain": bool(r["is_uncertain"]),
                "uncertainty_reason": r["uncertainty_reason"],
                "scores": json.loads(r["scores_json"]),
                "latency_ms": r["latency_ms"],
                "source_mode": r["source_mode"],
            })

    return {
        "items": items,
        "total": total_records,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_records + page_size - 1) // page_size,
    }

# --- 4. HARDWARE DEVICE CONTROLS ---

@app.get("/api/device/status")
def get_device_status():
    return hardware_adapter.get_status()

@app.post("/api/device/arm")
def arm_device():
    success = hardware_adapter.arm()
    if not success:
        raise HTTPException(status_code=400, detail="Failed to arm hardware.")
    return {"status": "ARMED", "details": hardware_adapter.get_status()}

@app.post("/api/device/disarm")
def disarm_device():
    success = hardware_adapter.disarm()
    return {"status": "DISARMED", "details": hardware_adapter.get_status()}

@app.post("/api/device/actuate")
def actuate_sorting_flap(req: ActuateRequest):
    """
    Commands the sorting flap to deflect toward the specified chute.
    Records distinct sorting_event_id in database.
    """
    if not hardware_adapter.is_armed():
        raise HTTPException(status_code=400, detail="Hardware is DISARMED. Arm before commanding actuation.")

    bin_upper = req.target_bin.upper()
    valid_bins = [b.value for b in TargetBin]
    if bin_upper not in valid_bins:
        raise HTTPException(status_code=400, detail=f"Invalid target bin '{req.target_bin}'. Must be one of {valid_bins}")

    event_id = f"sort_{uuid.uuid4().hex[:12]}"
    now = time.time()
    is_sim = hardware_adapter.get_status().get("mode") == "SIMULATED"

    success, message = hardware_adapter.send_sort(bin_upper, hold_ms=req.hold_duration_ms)

    # Persist event
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO sorting_events (
                id, prediction_id, target_bin, hold_duration_ms, seq,
                status, error_detail, is_simulated, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event_id,
            req.prediction_id,
            bin_upper,
            req.hold_duration_ms,
            1, # sequence
            "ACKED" if success else "FAILED",
            None if success else message,
            1 if is_sim else 0,
            now,
        ))
        conn.commit()

    if not success:
        raise HTTPException(status_code=409, detail=f"Sorting actuation failed: {message}")

    return {
        "sorting_event_id": event_id,
        "target_bin": bin_upper,
        "hold_duration_ms": req.hold_duration_ms,
        "status": "ACKED",
        "is_simulated": is_sim,
        "message": message,
        "timestamp": now,
    }

@app.get("/api/device/telemetry")
def get_device_telemetry():
    telem = hardware_adapter.get_latest_telemetry()
    if not telem:
        return {"status": "UNAVAILABLE", "message": "No telemetry readings available from sensor."}

    # Store reading in database
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO telemetry_readings (timestamp, distance_cm, fill_pct, is_simulated, raw_message)
            VALUES (?, ?, ?, ?, ?)
        """, (
            telem.get("timestamp", time.time()),
            telem["distance_cm"],
            telem["fill_pct"],
            1 if telem.get("source") == "SIMULATED" else 0,
            json.dumps(telem),
        ))
        conn.commit()

    return telem

# --- 5. SOURCE-TO-RECYCLING TRACKING ---

@app.get("/api/tracking/batches")
def list_waste_batches():
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT b.*, COUNT(e.id) as event_count
            FROM waste_batches b
            LEFT JOIN tracking_events e ON b.id = e.batch_id
            GROUP BY b.id
            ORDER BY b.updated_at DESC
        """)
        batches = []
        for r in cur.fetchall():
            batches.append({
                "id": r["id"],
                "source_organization": r["source_organization"],
                "status": r["status"],
                "estimated_kg": r["estimated_kg"],
                "material_category": r["material_category"],
                "notes": r["notes"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "event_count": r["event_count"],
            })
    return {"batches": batches}

@app.post("/api/tracking/batches")
def create_waste_batch(req: CreateBatchRequest):
    batch_id = f"BATCH-{int(time.time())}-{uuid.uuid4().hex[:4].upper()}"
    now = time.time()

    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO waste_batches (id, source_organization, status, estimated_kg, material_category, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            batch_id,
            req.source_organization,
            "CREATED",
            req.estimated_kg,
            req.material_category,
            req.notes,
            now,
            now,
        ))

        # Initial event
        evt_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
        conn.execute("""
            INSERT INTO tracking_events (id, batch_id, stage, timestamp, actor, location, notes, linked_prediction_id, linked_sorting_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            evt_id,
            batch_id,
            "CREATED",
            now,
            "Source Registered",
            req.source_organization,
            f"Waste batch initialized: {req.material_category} ({req.estimated_kg or 0} kg)",
            None,
            None,
        ))
        conn.commit()

    return {"batch_id": batch_id, "status": "CREATED", "timestamp": now}

@app.get("/api/tracking/batches/{batch_id}")
def get_batch_details(batch_id: str):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM waste_batches WHERE id = ?", (batch_id,))
        batch_row = cur.fetchone()
        if not batch_row:
            raise HTTPException(status_code=404, detail=f"Waste batch '{batch_id}' not found.")

        cur.execute("SELECT * FROM tracking_events WHERE batch_id = ? ORDER BY timestamp ASC", (batch_id,))
        event_rows = cur.fetchall()

        events = []
        for e in event_rows:
            events.append({
                "id": e["id"],
                "stage": e["stage"],
                "timestamp": e["timestamp"],
                "actor": e["actor"],
                "location": e["location"],
                "notes": e["notes"],
                "linked_prediction_id": e["linked_prediction_id"],
                "linked_sorting_id": e["linked_sorting_id"],
            })

    return {
        "id": batch_row["id"],
        "source_organization": batch_row["source_organization"],
        "status": batch_row["status"],
        "estimated_kg": batch_row["estimated_kg"],
        "material_category": batch_row["material_category"],
        "notes": batch_row["notes"],
        "created_at": batch_row["created_at"],
        "updated_at": batch_row["updated_at"],
        "timeline": events,
    }

@app.post("/api/tracking/batches/{batch_id}/events")
def add_tracking_event(batch_id: str, req: AddTrackingEventRequest):
    stage_upper = req.stage.upper()
    if stage_upper not in LIFECYCLE_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage '{req.stage}'. Must be one of {LIFECYCLE_STAGES}",
        )

    now = time.time()
    evt_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT status FROM waste_batches WHERE id = ?", (batch_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Waste batch '{batch_id}' not found.")

        # Insert new tracking event
        conn.execute("""
            INSERT INTO tracking_events (id, batch_id, stage, timestamp, actor, location, notes, linked_prediction_id, linked_sorting_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            evt_id,
            batch_id,
            stage_upper,
            now,
            req.actor,
            req.location,
            req.notes,
            req.linked_prediction_id,
            req.linked_sorting_id,
        ))

        # Update batch status and timestamp
        conn.execute("UPDATE waste_batches SET status = ?, updated_at = ? WHERE id = ?", (stage_upper, now, batch_id))
        conn.commit()

    return {"event_id": evt_id, "batch_id": batch_id, "new_stage": stage_upper, "timestamp": now}

# --- 6. CSV EXPORT ---

@app.get("/api/export/predictions.csv")
def export_predictions_csv():
    import csv
    import io

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Prediction ID", "Timestamp ISO", "Filename", "Material Label",
        "Confidence", "Routing Category", "Is Uncertain", "Uncertainty Reason",
        "Latency MS", "Source Mode",
    ])

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM predictions ORDER BY timestamp DESC")
        for r in cur.fetchall():
            import datetime
            iso_ts = datetime.datetime.fromtimestamp(r["timestamp"], tz=datetime.timezone.utc).isoformat()
            writer.writerow([
                r["id"],
                iso_ts,
                r["filename"],
                r["material_label"],
                f"{r['confidence']:.4f}",
                r["routing_category"],
                "YES" if r["is_uncertain"] else "NO",
                r["uncertainty_reason"] or "",
                f"{r['latency_ms']:.2f}",
                r["source_mode"],
            ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=wasto_predictions_history.csv"},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.api.main:app", host="0.0.0.0", port=8000, reload=True)
