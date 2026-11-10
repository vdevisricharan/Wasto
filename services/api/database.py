"""
Wasto SQLite Persistence Layer.
Manages schema initialization, ACID migrations, and durable entity persistence.
"""

import sqlite3
import os
import json
import time
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wasto.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    """Initializes tables and indexes."""
    with get_db_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS predictions (
            id TEXT PRIMARY KEY,
            timestamp REAL NOT NULL,
            filename TEXT NOT NULL,
            material_label TEXT NOT NULL,
            confidence REAL NOT NULL,
            routing_category TEXT NOT NULL,
            is_uncertain INTEGER NOT NULL,
            uncertainty_reason TEXT,
            scores_json TEXT NOT NULL,
            latency_ms REAL NOT NULL,
            source_mode TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sorting_events (
            id TEXT PRIMARY KEY,
            prediction_id TEXT,
            target_bin TEXT NOT NULL,
            hold_duration_ms INTEGER NOT NULL,
            seq INTEGER NOT NULL,
            status TEXT NOT NULL,
            error_detail TEXT,
            is_simulated INTEGER NOT NULL,
            timestamp REAL NOT NULL,
            FOREIGN KEY (prediction_id) REFERENCES predictions(id)
        );

        CREATE TABLE IF NOT EXISTS telemetry_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            distance_cm REAL NOT NULL,
            fill_pct REAL NOT NULL,
            is_simulated INTEGER NOT NULL,
            raw_message TEXT
        );

        CREATE TABLE IF NOT EXISTS waste_batches (
            id TEXT PRIMARY KEY,
            source_organization TEXT NOT NULL,
            status TEXT NOT NULL,
            estimated_kg REAL,
            material_category TEXT NOT NULL,
            notes TEXT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tracking_events (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            timestamp REAL NOT NULL,
            actor TEXT NOT NULL,
            location TEXT,
            notes TEXT,
            linked_prediction_id TEXT,
            linked_sorting_id TEXT,
            FOREIGN KEY (batch_id) REFERENCES waste_batches(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_pred_ts ON predictions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_pred_routing ON predictions(routing_category);
        CREATE INDEX IF NOT EXISTS idx_sort_ts ON sorting_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_tracking_batch ON tracking_events(batch_id);
        """)

        # Seed initial demo tracking batches if empty
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM waste_batches")
        if cur.fetchone()[0] == 0:
            now = time.time()
            demo_batches = [
                (
                    "BATCH-DELHI-001",
                    "IIIT Delhi — Academic Campus Block A",
                    "SORTED",
                    145.5,
                    "Mixed Recyclables",
                    "Clean collection from cafeteria and academic center bins",
                    now - 86400 * 2,
                    now - 3600 * 4,
                ),
                (
                    "BATCH-DELHI-002",
                    "AIIMS Delhi — Administrative Complex",
                    "IN_TRANSIT",
                    88.0,
                    "Paper & Cardboard",
                    "Office paper batches and dry packaging",
                    now - 86400,
                    now - 3600 * 2,
                ),
                (
                    "BATCH-DELHI-003",
                    "Prabha Colony Residential Society",
                    "CREATED",
                    210.0,
                    "Organic Waste",
                    "Source segregated compostable food waste",
                    now - 3600 * 5,
                    now - 3600 * 5,
                ),
            ]
            cur.executemany("""
                INSERT INTO waste_batches (id, source_organization, status, estimated_kg, material_category, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, demo_batches)

            demo_events = [
                # BATCH-001 events
                ("EVT-001", "BATCH-DELHI-001", "CREATED", now - 86400 * 2, "Campus Admin (R. Sharma)", "IIITD Delhi Okhla Phase III", "Batch registered at central source dustbin #13", None, None),
                ("EVT-002", "BATCH-DELHI-001", "PICKUP_SCHEDULED", now - 86400 * 1.8, "Wasto Logistics Hub", "Okhla Dispatch Center", "Driver K. Singh assigned van DL-1Z-9821", None, None),
                ("EVT-003", "BATCH-DELHI-001", "COLLECTED", now - 86400 * 1.5, "Driver (K. Singh)", "IIITD Delhi Okhla Phase III", "Van loaded with certified tare weight 145.5 kg", None, None),
                ("EVT-004", "BATCH-DELHI-001", "AT_FACILITY", now - 86400 * 1.0, "Facility In-charge (M. Verma)", "Okhla MRF Sorting Unit 4", "Material received, weighed, and staged on conveyor #1", None, None),
                ("EVT-005", "BATCH-DELHI-001", "SORTED", now - 3600 * 4, "Wasto Edge Optical Sorter", "Conveyor Belt Cell A", "Automatic segregation completed via MobileNetV3 and flap actuation", None, None),

                # BATCH-002 events
                ("EVT-006", "BATCH-DELHI-002", "CREATED", now - 86400, "Facility Officer (AIIMS)", "AIIMS Ansari Nagar", "Administrative paper batch tagged", None, None),
                ("EVT-007", "BATCH-DELHI-002", "PICKUP_SCHEDULED", now - 86400 * 0.8, "Wasto Logistics Hub", "South Delhi Center", "Pickup scheduled for afternoon run", None, None),
                ("EVT-008", "BATCH-DELHI-002", "COLLECTED", now - 3600 * 2, "Driver (A. Kumar)", "AIIMS Ansari Nagar", "Picked up and en route to recycling center", None, None),

                # BATCH-003 events
                ("EVT-009", "BATCH-DELHI-003", "CREATED", now - 3600 * 5, "Society Manager (S. Patel)", "Prabha Colony Gate 2", "Organic collection bin flagged 85% full", None, None),
            ]
            cur.executemany("""
                INSERT INTO tracking_events (id, batch_id, stage, timestamp, actor, location, notes, linked_prediction_id, linked_sorting_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, demo_events)

        conn.commit()

# Call schema init on import
init_db()
