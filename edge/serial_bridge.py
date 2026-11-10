"""
Wasto Edge Hardware Serial Bridge
Provides pluggable SerialArduinoAdapter and SimulatorAdapter implementing
the framed Wasto Serial Protocol v1.0.
"""

import time
import threading
import queue
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple

from shared.protocol import (
    HardwareAction,
    TargetBin,
    encode_command,
    decode_response,
    SERVO_ANGLES,
    DEFAULT_HOLD_DURATION_MS,
)

logger = logging.getLogger("wasto.serial_bridge")

class HardwareAdapter(ABC):
    """Abstract interface for sorting actuation and sensor telemetry."""

    @abstractmethod
    def connect(self) -> bool:
        pass

    @abstractmethod
    def disconnect(self) -> None:
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        pass

    @abstractmethod
    def is_armed(self) -> bool:
        pass

    @abstractmethod
    def arm(self) -> bool:
        pass

    @abstractmethod
    def disarm(self) -> bool:
        pass

    @abstractmethod
    def send_sort(self, target_bin: str, hold_ms: int = DEFAULT_HOLD_DURATION_MS, timeout: float = 3.0) -> Tuple[bool, str]:
        """Dispatches sort command. Returns (success, details/error_message)."""
        pass

    @abstractmethod
    def get_latest_telemetry(self) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        pass


class SimulatorAdapter(HardwareAdapter):
    """
    Virtual hardware adapter simulating the Arduino Uno ATmega328P state machine.
    Used for local development, automated CI tests, and cloud deployments.
    """

    def __init__(self, simulated_port: str = "VIRTUAL_COM_WASTO"):
        self.port = simulated_port
        self._connected = False
        self._armed = False
        self._state = "DISARMED"
        self._seq_counter = 1
        self._latest_telemetry = {
            "distance_cm": 42.5,
            "fill_pct": 57.5,
            "timestamp": time.time(),
            "source": "SIMULATED",
        }
        self._lock = threading.Lock()
        self._actuating_until = 0.0
        self._current_angle = 90

    def connect(self) -> bool:
        with self._lock:
            self._connected = True
            self._state = "DISARMED"
            self._armed = False
            logger.info("SimulatorAdapter: Connected to %s", self.port)
            return True

    def disconnect(self) -> None:
        with self._lock:
            self._connected = False
            self._armed = False
            self._state = "DISCONNECTED"
            logger.info("SimulatorAdapter: Disconnected")

    def is_connected(self) -> bool:
        return self._connected

    def is_armed(self) -> bool:
        return self._connected and self._armed

    def arm(self) -> bool:
        with self._lock:
            if not self._connected:
                return False
            self._armed = True
            self._state = "READY"
            logger.info("SimulatorAdapter: System ARMED")
            return True

    def disarm(self) -> bool:
        with self._lock:
            self._armed = False
            self._state = "DISARMED"
            self._current_angle = 90
            logger.info("SimulatorAdapter: System DISARMED")
            return True

    def send_sort(self, target_bin: str, hold_ms: int = DEFAULT_HOLD_DURATION_MS, timeout: float = 3.0) -> Tuple[bool, str]:
        with self._lock:
            if not self._connected:
                return (False, "ERR_NOT_CONNECTED")
            if not self._armed:
                return (False, "ERR_NOT_ARMED")

            now = time.time()
            if now < self._actuating_until:
                return (False, "BUSY")

            bin_upper = target_bin.upper()
            if bin_upper not in SERVO_ANGLES:
                return (False, "ERR_INVALID_BIN")

            seq = self._seq_counter
            self._seq_counter += 1

            self._state = "ACTUATING"
            self._current_angle = SERVO_ANGLES[bin_upper]
            self._actuating_until = now + (hold_ms / 1000.0)

            # Spawn delayed return to neutral
            threading.Thread(target=self._auto_neutral_return, args=(self._actuating_until,), daemon=True).start()

            return (True, f"ACK:{seq} SORT:{bin_upper} ANGLE:{self._current_angle} HOLD_MS:{hold_ms}")

    def _auto_neutral_return(self, target_timestamp: float):
        sleep_time = max(0.0, target_timestamp - time.time())
        time.sleep(sleep_time)
        with self._lock:
            if self._state == "ACTUATING" and time.time() >= self._actuating_until:
                self._current_angle = 90
                self._state = "READY" if self._armed else "DISARMED"

    def get_latest_telemetry(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            # Add small random variation to simulate real ultrasonic sensor readings
            base_dist = 42.0
            import math
            sine_variation = math.sin(time.time() / 10.0) * 2.5
            dist = round(base_dist + sine_variation, 1)
            fill = round(100.0 - dist, 1)
            self._latest_telemetry = {
                "distance_cm": dist,
                "fill_pct": fill,
                "timestamp": time.time(),
                "source": "SIMULATED",
            }
            return dict(self._latest_telemetry)

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            is_busy = now < self._actuating_until
            return {
                "connected": self._connected,
                "armed": self._armed,
                "state": "BUSY" if is_busy else self._state,
                "servo_angle": self._current_angle,
                "mode": "SIMULATED",
                "port": self.port,
            }


class SerialArduinoAdapter(HardwareAdapter):
    """
    Physical hardware adapter interfacing with an Arduino Uno via PySerial.
    Employs an asynchronous reader thread, non-blocking response routing,
    and sequence number matching.
    """

    def __init__(self, port: str = "COM3", baudrate: int = 9600, timeout: float = 1.0):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.serial_conn = None
        self._connected = False
        self._armed = False
        self._lock = threading.Lock()
        self._seq_counter = 1

        self._pending_responses: Dict[int, queue.Queue] = {}
        self._latest_telemetry: Optional[Dict[str, Any]] = None
        self._reader_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def connect(self) -> bool:
        try:
            import serial
        except ImportError:
            logger.error("pyserial is not installed. Please install pyserial to use physical hardware.")
            return False

        with self._lock:
            try:
                self.serial_conn = serial.Serial(self.port, self.baudrate, timeout=self.timeout)
                # Wait for Arduino bootloader reset
                time.sleep(2.0)
                self.serial_conn.reset_input_buffer()
                self._connected = True
                self._stop_event.clear()
                self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
                self._reader_thread.start()
                logger.info("Connected to physical Arduino on %s", self.port)
                return True
            except Exception as e:
                logger.warning("Failed to open serial port %s: %s", self.port, e)
                self._connected = False
                return False

    def disconnect(self) -> None:
        self._stop_event.set()
        with self._lock:
            self._connected = False
            self._armed = False
            if self.serial_conn and self.serial_conn.is_open:
                try:
                    self.serial_conn.close()
                except Exception:
                    pass
                self.serial_conn = None

    def is_connected(self) -> bool:
        return self._connected and self.serial_conn is not None and self.serial_conn.is_open

    def is_armed(self) -> bool:
        return self.is_connected() and self._armed

    def arm(self) -> bool:
        if not self.is_connected():
            return False
        with self._lock:
            seq = self._seq_counter
            self._seq_counter += 1
        cmd = encode_command(seq, HardwareAction.ARM)
        resp = self._send_and_wait(seq, cmd, timeout=2.0)
        if resp and resp.get("type") in ("ACK", "DONE"):
            self._armed = True
            return True
        return False

    def disarm(self) -> bool:
        if not self.is_connected():
            self._armed = False
            return True
        with self._lock:
            seq = self._seq_counter
            self._seq_counter += 1
        cmd = encode_command(seq, HardwareAction.DISARM)
        resp = self._send_and_wait(seq, cmd, timeout=2.0)
        self._armed = False
        return resp is not None

    def send_sort(self, target_bin: str, hold_ms: int = DEFAULT_HOLD_DURATION_MS, timeout: float = 3.0) -> Tuple[bool, str]:
        if not self.is_connected():
            return (False, "ERR_NOT_CONNECTED")
        if not self._armed:
            return (False, "ERR_NOT_ARMED")

        bin_upper = target_bin.upper()
        if bin_upper not in TargetBin._value2member_map_:
            return (False, "ERR_INVALID_BIN")

        with self._lock:
            seq = self._seq_counter
            self._seq_counter += 1

        cmd = encode_command(seq, HardwareAction.SORT, TargetBin(bin_upper), hold_ms)
        resp = self._send_and_wait(seq, cmd, timeout=timeout)
        if not resp:
            return (False, "ERR_TIMEOUT_NO_ACK")

        resp_type = resp.get("type")
        if resp_type == "ACK":
            return (True, f"ACK:{seq}")
        elif resp_type == "BUSY":
            return (False, "BUSY")
        elif resp_type == "ERR":
            return (False, f"ERR_{resp.get('code', 'UNKNOWN')}")
        return (False, f"UNEXPECTED_RESP_{resp_type}")

    def _send_and_wait(self, seq: int, cmd: str, timeout: float = 2.0) -> Optional[Dict[str, Any]]:
        resp_q = queue.Queue()
        self._pending_responses[seq] = resp_q
        try:
            with self._lock:
                if not self.is_connected():
                    return None
                self.serial_conn.write(cmd.encode("ascii"))
                self.serial_conn.flush()
            return resp_q.get(timeout=timeout)
        except queue.Empty:
            return None
        except Exception as e:
            logger.error("Serial write error: %s", e)
            return None
        finally:
            self._pending_responses.pop(seq, None)

    def _reader_loop(self):
        while not self._stop_event.is_set() and self.is_connected():
            try:
                line = self.serial_conn.readline().decode("ascii", errors="replace")
                if not line:
                    continue
                parsed = decode_response(line)
                if not parsed:
                    continue

                # Handle telemetry
                if parsed.get("type") == HardwareAction.TELEM.value:
                    parsed["source"] = "PHYSICAL"
                    parsed["timestamp"] = time.time()
                    self._latest_telemetry = parsed
                    continue

                # Match sequence if present
                seq = parsed.get("seq")
                if seq is not None and seq in self._pending_responses:
                    self._pending_responses[seq].put(parsed)

            except Exception as e:
                logger.warning("Serial reader loop encountered exception: %s", e)
                break

    def get_latest_telemetry(self) -> Optional[Dict[str, Any]]:
        return self._latest_telemetry

    def get_status(self) -> Dict[str, Any]:
        return {
            "connected": self.is_connected(),
            "armed": self._armed,
            "mode": "PHYSICAL",
            "port": self.port,
        }
