"""
Unit tests for Wasto Serial Protocol v1.0 and Hardware Adapters.
"""

import time
import pytest
from shared.protocol import (
    HardwareAction,
    TargetBin,
    encode_command,
    decode_response,
    SERVO_ANGLES,
)
from edge.serial_bridge import SimulatorAdapter

def test_encode_command():
    cmd = encode_command(seq=12, action=HardwareAction.SORT, target_bin=TargetBin.ORGANIC, param=1200)
    assert cmd == "CMD:12:SORT:ORGANIC:1200\n"

    cmd_arm = encode_command(seq=1, action=HardwareAction.ARM)
    assert cmd_arm == "CMD:1:ARM:NONE:1200\n"

def test_decode_response_types():
    assert decode_response("ACK:42\n") == {"type": "ACK", "seq": 42}
    assert decode_response("DONE:42\n") == {"type": "DONE", "seq": 42}
    assert decode_response("BUSY:42\n") == {"type": "BUSY", "seq": 42}
    assert decode_response("PONG\n") == {"type": "PONG"}
    assert decode_response("ERR:10:NOT_ARMED\n") == {"type": "ERR", "seq": 10, "code": "NOT_ARMED"}

    telem = decode_response("TELEM:34.5:65.5\n")
    assert telem["type"] == "TELEM"
    assert telem["distance_cm"] == 34.5
    assert telem["fill_pct"] == 65.5

def test_simulator_adapter_lifecycle():
    sim = SimulatorAdapter()
    assert not sim.is_connected()
    assert not sim.is_armed()

    assert sim.connect() is True
    assert sim.is_connected() is True
    assert not sim.is_armed()

    # Sort fails when disarmed
    ok, msg = sim.send_sort("RECYCLABLE")
    assert not ok
    assert "NOT_ARMED" in msg

    # Arm system
    assert sim.arm() is True
    assert sim.is_armed() is True

    # Valid sort command
    ok, detail = sim.send_sort("ORGANIC", hold_ms=100)
    assert ok is True
    assert "ACK" in detail
    assert sim.get_status()["state"] == "BUSY"

    # Busy rejection while actuating
    ok_busy, msg_busy = sim.send_sort("RESIDUAL")
    assert not ok_busy
    assert msg_busy == "BUSY"

    # Wait for completion return
    time.sleep(0.15)
    assert sim.get_status()["state"] == "READY"

    # Disarm
    assert sim.disarm() is True
    assert not sim.is_armed()
    sim.disconnect()
    assert not sim.is_connected()

def test_simulator_telemetry():
    sim = SimulatorAdapter()
    sim.connect()
    telem = sim.get_latest_telemetry()
    assert telem is not None
    assert "distance_cm" in telem
    assert "fill_pct" in telem
    assert telem["source"] == "SIMULATED"
    sim.disconnect()
