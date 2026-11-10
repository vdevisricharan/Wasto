# Wasto Arduino Sorter & Telemetry Firmware

This directory contains the production-grade Arduino firmware (`wasto_sorter.ino`) for the physical sorting flap mechanism and ultrasonic fill-level telemetry.

---

## Hardware Bill of Materials (BOM)

| Component | Quantity | Purpose | Pin Connection |
| :--- | :--- | :--- | :--- |
| **Arduino Uno R3** | 1 | Microcontroller running `wasto_sorter.ino` | USB to Host PC |
| **MG996R or SG90 Servo Motor** | 1 | Deflection flap router for chutes 1, 2, 3 | Signal -> **Pin 9 (PWM)**, VCC -> 5V (Ext), GND -> GND |
| **HC-SR04 Ultrasonic Sensor** | 1 | Bin depth measurement & fill telemetry | **Trig -> Pin 3**, **Echo -> Pin 2**, VCC -> 5V, GND -> GND |
| **Status Indicator LED** | 1 | Armed state visual confirmation | **Pin 13** (or on-board LED) |
| **5V 2A External Power Supply** | 1 | Dedicated servo power (prevents brownout) | Shared GND with Arduino |
| **Connecting Breadboard & Jumper Wires** | 1 set | Circuit assembly | - |

---

## Wiring & Schematic Reference

```
  Arduino Uno R3
  +---------------------------------------+
  |                                       |
  |  [PIN 9]  (PWM) ----> Servo Signal    |
  |  [PIN 3]  (OUT) ----> HC-SR04 Trig    |
  |  [PIN 2]  (IN)  ----> HC-SR04 Echo    |
  |  [PIN 13] (OUT) ----> Armed LED       |
  |                                       |
  |  [5V]     ----------> HC-SR04 VCC     |
  |  [GND]    ----------> Common Ground --+----> External 5V PSU GND
  |                                       |       Servo GND
  +---------------------------------------+

  External 5V 2A Supply
  +---------------------------------------+
  |  [+5V]    ----------> Servo VCC (Red) |
  |  [GND]    ----------> Common GND      |
  +---------------------------------------+
```

> [!CAUTION]
> **Power Isolation Warning**: Do NOT power high-torque servo motors directly from the Arduino Uno's onboard 5V regulator. Servo current spikes will cause ATmega328P brownout resets and disconnect USB serial. Always use an external regulated 5V power supply with a common ground rail.

---

## Serial Protocol Reference (9600 Baud)

### Host to Arduino Commands
- `PING\n` -> Responds with `PONG\n`
- `CMD:<seq>:ARM:NONE:0\n` -> Arms system; sets LED high. Responds with `ACK:<seq>\n` and `DONE:<seq>\n`.
- `CMD:<seq>:DISARM:NONE:0\n` -> Disarms system; returns servo to neutral (90°). Responds with `ACK:<seq>\n` and `DONE:<seq>\n`.
- `CMD:<seq>:SORT:ORGANIC:1200\n` -> Actuates servo to 45° for 1200ms, then returns to 90°.
- `CMD:<seq>:SORT:RECYCLABLE:1200\n` -> Actuates servo to 90° for 1200ms.
- `CMD:<seq>:SORT:RESIDUAL:1200\n` -> Actuates servo to 135° for 1200ms.
- `CMD:<seq>:STATUS:NONE:0\n` -> Emits `STATUS:<armed>:<state>:<angle>\n`.

### Arduino to Host Events
- `ACK:<seq>`: Command accepted into execution queue.
- `DONE:<seq>`: Flap motion complete and returned to neutral.
- `BUSY:<seq>`: Sorter rejected command because actuation is still underway.
- `ERR:<seq>:<code>`: Error frame (e.g. `NOT_ARMED`, `INVALID_BIN`, `WATCHDOG_DISARM`).
- `TELEM:<dist_cm>:<fill_pct>`: Ultrasonic distance and fill percentage emitted every 3 seconds.

---

## Flashing Instructions

### Using Arduino IDE
1. Open Arduino IDE (v2.x or v1.8.x).
2. Go to **File -> Open...** and select `firmware/wasto_sorter/wasto_sorter.ino`.
3. Under **Tools -> Board**, select **Arduino Uno**.
4. Under **Tools -> Port**, select the active COM port (e.g. `COM3` on Windows or `/dev/ttyACM0` on Linux).
5. Click **Upload** (Ctrl+U).

### Using Arduino CLI
```bash
arduino-cli compile --fqbn arduino:avr:uno firmware/wasto_sorter
arduino-cli upload -p COM3 --fqbn arduino:avr:uno firmware/wasto_sorter
```
