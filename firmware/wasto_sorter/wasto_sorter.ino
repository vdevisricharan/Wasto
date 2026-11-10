/*
 * Wasto Automated Sorter & Telemetry Firmware
 * Target Microcontroller: Arduino Uno R3 (ATmega328P)
 * Version: 1.0.0 (Protocol v1.0)
 *
 * Capabilities:
 * - Non-blocking millis() state machine for servo flap actuation
 * - Bi-directional ASCII framed serial protocol (9600 baud)
 * - Calibrated neutral rest, Organic (45 deg), Recyclable (90 deg), Residual (135 deg)
 * - Ultrasonic distance fill percentage telemetry (HC-SR04)
 * - Safe disarmed startup, manual arming, and communications watchdog
 */

#include <Servo.h>

// --- Pin Assignments ---
const int PIN_SERVO = 9;       // PWM pin for SG90 / MG996R servo flap
const int PIN_TRIG = 3;        // Ultrasonic HC-SR04 Trigger
const int PIN_ECHO = 2;        // Ultrasonic HC-SR04 Echo
const int PIN_LED_ARMED = 13;   // Built-in LED indicates ARMED state

// --- Servo Angle Calibration ---
const int ANGLE_NEUTRAL = 90;
const int ANGLE_ORGANIC = 45;      // Chute 1
const int ANGLE_RECYCLABLE = 90;   // Chute 2 (Center / pass-through)
const int ANGLE_RESIDUAL = 135;    // Chute 3

// --- State Machine States ---
enum SystemState {
  STATE_DISARMED = 0,
  STATE_READY = 1,
  STATE_ACTUATING = 2
};

// --- Globals ---
Servo sortingServo;
SystemState currentState = STATE_DISARMED;
bool isArmed = false;

// Active command tracking
unsigned long currentCmdSeq = 0;
unsigned long actuationStartTime = 0;
unsigned long holdDurationMs = 1200;

// Periodic telemetry & watchdog timers
unsigned long lastTelemTime = 0;
const unsigned long TELEM_INTERVAL_MS = 3000;
unsigned long lastHeartbeatTime = 0;
const unsigned long WATCHDOG_TIMEOUT_MS = 30000; // 30 sec auto-disarm

// Serial line buffer
char inputBuffer[64];
byte bufferIdx = 0;

void setup() {
  Serial.begin(9600);
  
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LED_ARMED, OUTPUT);
  digitalWrite(PIN_LED_ARMED, LOW);

  sortingServo.attach(PIN_SERVO);
  sortingServo.write(ANGLE_NEUTRAL);

  // Announce startup
  Serial.println(F("WASTO_FIRMWARE_READY:v1.0"));
  lastHeartbeatTime = millis();
}

void loop() {
  unsigned long now = millis();

  // 1. Process serial inputs
  readSerialCommands();

  // 2. Manage servo actuation timing
  if (currentState == STATE_ACTUATING) {
    if (now - actuationStartTime >= holdDurationMs) {
      // Return servo to neutral
      sortingServo.write(ANGLE_NEUTRAL);
      currentState = isArmed ? STATE_READY : STATE_DISARMED;
      
      // Emit completion frame
      Serial.print(F("DONE:"));
      Serial.println(currentCmdSeq);
    }
  }

  // 3. Periodic ultrasonic telemetry
  if (now - lastTelemTime >= TELEM_INTERVAL_MS) {
    lastTelemTime = now;
    readAndReportTelemetry();
  }

  // 4. Safety Watchdog: auto-disarm if communications lost while armed
  if (isArmed && (now - lastHeartbeatTime > WATCHDOG_TIMEOUT_MS)) {
    disarmSystem();
    Serial.println(F("ERR:0:WATCHDOG_DISARM"));
  }
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      inputBuffer[bufferIdx] = '\0';
      if (bufferIdx > 0) {
        parseAndExecuteCommand(inputBuffer);
      }
      bufferIdx = 0;
    } else {
      if (bufferIdx < sizeof(inputBuffer) - 1) {
        inputBuffer[bufferIdx++] = c;
      }
    }
  }
}

void parseAndExecuteCommand(const char* cmd) {
  // Reset watchdog on valid traffic
  lastHeartbeatTime = millis();

  // Simple Ping/Pong
  if (strcmp(cmd, "PING") == 0) {
    Serial.println(F("PONG"));
    return;
  }

  // Expected frame: CMD:<seq>:<action>:<target_bin>:<param>
  if (strncmp(cmd, "CMD:", 4) != 0) {
    Serial.println(F("ERR:0:INVALID_FRAME"));
    return;
  }

  // Tokenize using strtok
  char bufferCopy[64];
  strncpy(bufferCopy, cmd, sizeof(bufferCopy));
  bufferCopy[sizeof(bufferCopy) - 1] = '\0';

  char* token = strtok(bufferCopy, ":"); // "CMD"
  char* seqStr = strtok(NULL, ":");
  char* actionStr = strtok(NULL, ":");
  char* binStr = strtok(NULL, ":");
  char* paramStr = strtok(NULL, ":");

  if (!seqStr || !actionStr) {
    Serial.println(F("ERR:0:MISSING_PARAMS"));
    return;
  }

  unsigned long seq = strtoul(seqStr, NULL, 10);

  // --- ACTION: STATUS ---
  if (strcmp(actionStr, "STATUS") == 0) {
    Serial.print(F("STATUS:"));
    Serial.print(isArmed ? 1 : 0);
    Serial.print(F(":"));
    Serial.print(currentState == STATE_ACTUATING ? F("BUSY") : (isArmed ? F("READY") : F("DISARMED")));
    Serial.print(F(":"));
    Serial.println(sortingServo.read());
    return;
  }

  // --- ACTION: ARM ---
  if (strcmp(actionStr, "ARM") == 0) {
    armSystem();
    Serial.print(F("ACK:"));
    Serial.println(seq);
    Serial.print(F("DONE:"));
    Serial.println(seq);
    return;
  }

  // --- ACTION: DISARM ---
  if (strcmp(actionStr, "DISARM") == 0) {
    disarmSystem();
    Serial.print(F("ACK:"));
    Serial.println(seq);
    Serial.print(F("DONE:"));
    Serial.println(seq);
    return;
  }

  // --- ACTION: SORT ---
  if (strcmp(actionStr, "SORT") == 0) {
    if (!isArmed) {
      Serial.print(F("ERR:"));
      Serial.print(seq);
      Serial.println(F(":NOT_ARMED"));
      return;
    }

    if (currentState == STATE_ACTUATING) {
      Serial.print(F("BUSY:"));
      Serial.println(seq);
      return;
    }

    if (!binStr) {
      Serial.print(F("ERR:"));
      Serial.print(seq);
      Serial.println(F(":MISSING_BIN"));
      return;
    }

    int targetAngle = ANGLE_NEUTRAL;
    if (strcmp(binStr, "ORGANIC") == 0) {
      targetAngle = ANGLE_ORGANIC;
    } else if (strcmp(binStr, "RECYCLABLE") == 0) {
      targetAngle = ANGLE_RECYCLABLE;
    } else if (strcmp(binStr, "RESIDUAL") == 0) {
      targetAngle = ANGLE_RESIDUAL;
    } else if (strcmp(binStr, "NONE") == 0) {
      targetAngle = ANGLE_NEUTRAL;
    } else {
      Serial.print(F("ERR:"));
      Serial.print(seq);
      Serial.println(F(":INVALID_BIN"));
      return;
    }

    unsigned long holdMs = 1200;
    if (paramStr) {
      holdMs = strtoul(paramStr, NULL, 10);
      if (holdMs < 200) holdMs = 200;
      if (holdMs > 5000) holdMs = 5000;
    }

    // Acknowledge command acceptance
    currentCmdSeq = seq;
    holdDurationMs = holdMs;
    actuationStartTime = millis();
    currentState = STATE_ACTUATING;
    sortingServo.write(targetAngle);

    Serial.print(F("ACK:"));
    Serial.println(seq);
    return;
  }

  Serial.print(F("ERR:"));
  Serial.print(seq);
  Serial.println(F(":UNKNOWN_ACTION"));
}

void armSystem() {
  isArmed = true;
  currentState = STATE_READY;
  digitalWrite(PIN_LED_ARMED, HIGH);
  sortingServo.write(ANGLE_NEUTRAL);
}

void disarmSystem() {
  isArmed = false;
  currentState = STATE_DISARMED;
  digitalWrite(PIN_LED_ARMED, LOW);
  sortingServo.write(ANGLE_NEUTRAL);
}

void readAndReportTelemetry() {
  // Clear trigger
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  // Send 10us HIGH pulse
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // Measure echo pulse width (timeout 30ms = ~5 meters max)
  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  
  if (duration == 0) {
    // Sensor out of range or disconnected
    return;
  }

  // Speed of sound = ~0.034 cm/us
  float distanceCm = (duration * 0.034) / 2.0;
  
  // Assume bin total depth is 100 cm
  float fillPct = 0.0;
  if (distanceCm < 100.0) {
    fillPct = (100.0 - distanceCm);
    if (fillPct < 0.0) fillPct = 0.0;
    if (fillPct > 100.0) fillPct = 100.0;
  }

  Serial.print(F("TELEM:"));
  Serial.print(distanceCm, 1);
  Serial.print(F(":"));
  Serial.println(fillPct, 1);
}
