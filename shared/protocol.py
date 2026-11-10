"""
Wasto Edge Hardware Serial Bridge Protocol Specification (v1.0)
Defines framing, commands, responses, and serial adapter interfaces.
"""

from enum import Enum
from typing import Optional, Dict, Any, Tuple
import re

PROTOCOL_VERSION = "WASTO_SERIAL_V1.0"

class HardwareAction(str, Enum):
    PING = "PING"
    PONG = "PONG"
    ARM = "ARM"
    DISARM = "DISARM"
    SORT = "SORT"
    STATUS = "STATUS"
    ACK = "ACK"
    DONE = "DONE"
    BUSY = "BUSY"
    ERR = "ERR"
    TELEM = "TELEM"

class TargetBin(str, Enum):
    ORGANIC = "ORGANIC"
    RECYCLABLE = "RECYCLABLE"
    RESIDUAL = "RESIDUAL"
    NONE = "NONE"

# Mapping operational routing categories to physical target bin strings
ROUTING_TO_TARGET_BIN: Dict[str, TargetBin] = {
    "Organic": TargetBin.ORGANIC,
    "Recyclable": TargetBin.RECYCLABLE,
    "Residual": TargetBin.RESIDUAL,
    "Unknown / Manual Review": TargetBin.NONE,
}

# Calibrated servo angles for Arduino Uno
SERVO_ANGLES = {
    TargetBin.NONE.value: 90,        # Neutral rest position
    TargetBin.ORGANIC.value: 45,     # Flap deflected toward Chute 1
    TargetBin.RECYCLABLE.value: 90,  # Center / pass-through toward Chute 2
    TargetBin.RESIDUAL.value: 135,   # Flap deflected toward Chute 3
}

DEFAULT_HOLD_DURATION_MS = 1200

def encode_command(seq: int, action: HardwareAction, target_bin: TargetBin = TargetBin.NONE, param: int = DEFAULT_HOLD_DURATION_MS) -> str:
    """Formats an ASCII framed command line with trailing newline."""
    return f"CMD:{seq}:{action.value}:{target_bin.value}:{param}\n"

def decode_response(line: str) -> Optional[Dict[str, Any]]:
    """
    Parses a newline-terminated firmware response line into a structured dictionary.
    Returns None if line is unparseable or empty.
    """
    cleaned = line.strip()
    if not cleaned:
        return None

    # Heartbeat
    if cleaned == "PONG":
        return {"type": HardwareAction.PONG.value}

    # Telemetry: TELEM:<dist_cm>:<fill_pct>
    telem_match = re.match(r"^TELEM:([\d\.]+):([\d\.]+)$", cleaned)
    if telem_match:
        try:
            return {
                "type": HardwareAction.TELEM.value,
                "distance_cm": float(telem_match.group(1)),
                "fill_pct": float(telem_match.group(2)),
            }
        except ValueError:
            return None

    # ACK / DONE / BUSY: TYPE:<seq>
    seq_match = re.match(r"^(ACK|DONE|BUSY):(\d+)$", cleaned)
    if seq_match:
        return {
            "type": seq_match.group(1),
            "seq": int(seq_match.group(2)),
        }

    # ERR: ERR:<seq>:<code_str>
    err_match = re.match(r"^ERR:(\d+):([A-Za-z0-9_]+)$", cleaned)
    if err_match:
        return {
            "type": HardwareAction.ERR.value,
            "seq": int(err_match.group(1)),
            "code": err_match.group(2),
        }

    # Status: STATUS:<armed 0/1>:<state>:<angle>
    status_match = re.match(r"^STATUS:([01]):([A-Za-z]+):(\d+)$", cleaned)
    if status_match:
        return {
            "type": HardwareAction.STATUS.value,
            "armed": bool(int(status_match.group(1))),
            "state": status_match.group(2),
            "servo_angle": int(status_match.group(3)),
        }

    return {"type": "RAW", "message": cleaned}
