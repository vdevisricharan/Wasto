# Wasto Physical Hardware Integration & Validation Guide

**Version**: 1.0.0  
**Target Hardware**: Arduino Uno R3 (ATmega328P), MG996R / SG90 Servo, HC-SR04 Ultrasonic Sensor  
**Status**: Software Simulated & Validated; Physical Rig Blocked (Awaiting Physical Bench Access)  

---

## 1. Safety Architecture & Power Isolation

> [!CAUTION]
> **Brownout & Reset Hazard**: High-torque mechanical servos (MG996R / SG90) draw up to 1.5A–2.5A peak stall current during rapid directional changes. Under no circumstance should the servo VCC line be powered directly from the Arduino Uno's onboard 5V header pin. Doing so will drop USB bus voltage, trigger ATmega328P brownouts, corrupt serial communication, and reset the microcontroller.

```
  +---------------------------------------------+
  |              ARDUINO UNO R3                 |
  |                                             |
  |  [PIN 9] (PWM) ---------> Servo Signal      |
  |  [PIN 3] (OUTPUT) ------> HC-SR04 Trig      |
  |  [PIN 2] (INPUT) -------> HC-SR04 Echo      |
  |  [PIN 13] (OUTPUT) -----> Armed State LED   |
  |                                             |
  |  [GND] -----------------+ Common Ground Rail|
  +-------------------------|-------------------+
                            |
  +-------------------------|-------------------+
  |  EXTERNAL 5V 2A SUPPLY  |                   |
  |  [+5V (Red)] -----------> Servo VCC (Red)   |
  |  [GND (Black)] ---------+ Common Ground Rail|
  +---------------------------------------------+
```

---

## 2. Hardware Validation Checklist

Use this checklist prior to commissioning an automated sorting workstation:

| Check ID | Verification Item | Target Standard | Physical Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **HW-CK-01** | **Common Ground Continuity** | Resistance between Arduino GND and External 5V PSU GND must be $< 0.5\,\Omega$. | Multimeter continuity beep verified. | **simulated** (software model) / **blocked** (physical bench) |
| **HW-CK-02** | **Serial Framing & Loopback** | Bi-directional communication at 9600 Baud; frames strictly terminate with `\n`. | Verified in automated Python test `tests/test_protocol.py`. | **verified** |
| **HW-CK-03** | **Power-On Disarm State** | Microcontroller must boot with servo at neutral 90°, Armed LED OFF, rejecting sort commands. | Verified in `firmware/wasto_sorter/wasto_sorter.ino`. | **verified** |
| **HW-CK-04** | **Watchdog Auto-Disarm** | If no command or `PING` is received for $> 30$ seconds while armed, system must disarm. | Implemented in `loop()` watchdog timer. | **verified** |
| **HW-CK-05** | **Neutral Angle Calibration** | Flap returns precisely to 90° center pass-through chute. | Requires physical angle protractor calibration on installed flap. | **blocked** |
| **HW-CK-06** | **Chute 1 (Organic 45°)** | Servo deflects to 45° within 150 ms of `CMD:<seq>:SORT:ORGANIC`. | Validated via `SimulatorAdapter` state timing. | **simulated** |
| **HW-CK-07** | **Chute 3 (Residual 135°)** | Servo deflects to 135° within 150 ms of `CMD:<seq>:SORT:RESIDUAL`. | Validated via `SimulatorAdapter` state timing. | **simulated** |
| **HW-CK-08** | **Ultrasonic Sensor Accuracy** | HC-SR04 distance measurement accurate within $\pm 1\,\text{cm}$ across $10\,\text{cm} - 100\,\text{cm}$. | Telemetry protocol verified; sensor calibration requires physical bin. | **blocked** |
| **HW-CK-09** | **Conveyor Drop Synchronization**| Delay between camera detection and chute drop calibrated to belt speed ($v$). | Requires physical conveyor belt setup. | **blocked** |
| **HW-CK-10** | **Physical Emergency Stop** | Independent hardware latching NC mushroom button breaking servo + motor power. | Documented in wiring spec; mandatory for production deployment. | **blocked** |

---

## 3. Physical Equipment Blocker Disclosure

As documented in `docs/claim-matrix.md`, **physical sorting on moving conveyor belts cannot be claimed as physically complete** until the following physical apparatus is assembled and verified on a test bench:
1. Physical industrial conveyor belt bed with variable speed drive.
2. Overhead mounting rig for USB camera with uniform LED illumination.
3. Mechanical sorting flap assembly with SG90/MG996R servo linkage.
4. Physical dustbin receptacle with mounted HC-SR04 ultrasonic sensor.

Software contracts, serial protocols, compilable firmware, and simulator adapters are fully implemented and verified via unit tests (`pytest tests/test_protocol.py`).
