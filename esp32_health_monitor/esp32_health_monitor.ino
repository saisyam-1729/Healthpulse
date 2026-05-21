/*
  HealthPulse AI IoT Device v2.2 – Cloud-ready with Device ID
  ESP32 + MAX30102 + DS18B20 + SSD1306 OLED + Buzzer + Web Server + Cloud POST + mDNS

  FIXED: Backend URL, JSON fields, real SpO2 calc, DS18B20 temp, HR averaging
*/

#define BOARD_MH_ET_LIVE

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── PIN DEFINITIONS ─────────────────────────────────────────────
#define I2C_SDA      21
#define I2C_SCL      22
#define BUZZER_PIN   13
#define ONE_WIRE_BUS 15
#define OLED_ADDR    0x3C

// ── Wi-Fi credentials ───────────────────────────────────────────
const char* sta_ssid     = "S_K";
const char* sta_password = "SKsidd@005";
const char* ap_ssid      = "ESP32-Health";
const char* ap_password  = "12345678";

// ── Device ID ───────────────────────────────────────────────────
#define DEVICE_ID  "ESP32-HEALTH-001"

// ── Backend URL ─────────────────────────────────────────────────
// Must match: backend server.js port (5001) + deviceRoutes path (/api/device/data)
const char* backend_url = "http://192.168.1.5:5001/api/device/data";

// ── API Key (must match backend .env DEVICE_API_KEY) ────────────
const char* api_key = "ESP32_SECRET";

// ── Local API Key for AP web server ─────────────────────────────
const char* localApiKey = "ESP32_KEY";

// ── mDNS hostname ──────────────────────────────────────────────
const char* mdns_hostname = "healthpulse";

// ── Sensor constants ────────────────────────────────────────────
#define HR_SAMPLE_COUNT   10
#define SPO2_DISPLAY_MS   1000
#define SCREEN_CYCLE_MS   4000
#define SPO2_A            1.5958422
#define SPO2_B           -34.6596622
#define SPO2_C            112.6898759
#define FSPO2             0.70
#define FRATE             0.95
#define FINGER_ON         50000L
#define FINGER_OFF        40000L
#define AC_MIN            200L
#define DC_MIN            20000L
#define R_LOW             0.3f
#define R_HIGH            0.95f

// ── Alert thresholds ────────────────────────────────────────────
#define HR_LOW           50
#define HR_HIGH          120
#define SPO2_LOW         92
#define TEMP_HIGH        38.0

// ── Data sending interval ──────────────────────────────────────
#define SEND_INTERVAL_MS  5000

// Global objects
MAX30105 particleSensor;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
WebServer server(80);

// Sensor state
float  displayedBPM   = 0.0;
bool   hrDone         = false;
int    bpmCollected   = 0;
float  bpmSamples[HR_SAMPLE_COUNT];
double displaySpO2    = 0.0;
bool   spo2Valid      = false;
float  bodyTemp       = 0.0;
bool   tempValid      = false;
bool   fingerPresent  = false;
unsigned long lastBeat = 0;

// Timing
unsigned long lastDispUpdate   = 0;
unsigned long lastScreenSwitch = 0;
unsigned long lastTempRead     = 0;
unsigned long lastDataSent     = 0;

// Buzzer alert state machine
bool   alertActive     = false;
unsigned long alertStart = 0;
#define BEEP_DURATION   200
#define BEEP_PAUSE      100
#define BEEP_REPEAT     3
int    beepCount       = 0;
bool   beepState       = false;

// Heart blink helper
bool   heartBlinkOn    = false;
unsigned long heartBlinkTime = 0;

int    currentScreen  = 0;

// ─────────────────────────────────────────────────────────────────
void setupWiFi() {
  Serial.println("[WiFi] Starting dual mode...");
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(sta_ssid, sta_password);
  Serial.print("[WiFi] Connecting to STA ");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] STA connected, IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] STA connection FAILED - running AP only");
  }

  WiFi.softAP(ap_ssid, ap_password);
  Serial.print("[WiFi] AP started, IP: ");
  Serial.println(WiFi.softAPIP());

  if (WiFi.status() == WL_CONNECTED) {
    if (MDNS.begin(mdns_hostname)) {
      Serial.printf("[mDNS] hostname: %s.local\n", mdns_hostname);
    } else {
      Serial.println("[mDNS] failed");
    }
  }
}

void initSensors() {
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[ERROR] MAX30102 not found! Check wiring.");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println("MAX30102 NOT FOUND!");
    display.println("Check wiring:");
    display.println("SDA=21, SCL=22");
    display.display();
    while (1) delay(100);
  }
  particleSensor.setup(0x7F, 4, 2, 200, 411, 16384);
  particleSensor.setPulseAmplitudeGreen(0);
  Serial.println("[Sensor] MAX30102 ready.");

  tempSensor.begin();
  Serial.println("[Sensor] DS18B20 ready.");

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

double median(double* arr, int n) {
  double tmp[5];
  for (int i = 0; i < n; i++) tmp[i] = arr[i];
  for (int i = 1; i < n; i++) {
    double k = tmp[i];
    int j = i - 1;
    while (j >= 0 && tmp[j] > k) {
      tmp[j + 1] = tmp[j];
      j--;
    }
    tmp[j + 1] = k;
  }
  if (n % 2 == 0) return (tmp[n/2 - 1] + tmp[n/2]) / 2.0;
  else return tmp[n/2];
}

void resetAll(unsigned long now) {
  bpmCollected = 0;
  hrDone = false;
  displayedBPM = 0;
  lastBeat = now;
  for (int i = 0; i < HR_SAMPLE_COUNT; i++) bpmSamples[i] = 0;
}

void processSensors() {
  unsigned long now = millis();
  static long spo2RedMin = 0, spo2RedMax = 0;
  static long spo2IrMin  = 0, spo2IrMax  = 0;
  static bool inBeat     = false;
  static unsigned long beatStartMs = 0;
  static double aveRed = 0, aveIr = 0;
  static double rWindow[5];
  static int    rWinIdx = 0, rWinFilled = 0;
  static double spo2Out[5];
  static int    spo2OutIdx = 0, spo2OutFilled = 0;
  static double ESpO2 = 97.0;
  static unsigned long lastSpo2Display = 0;

  particleSensor.check();
  while (particleSensor.available()) {
    long red660, ir880;
#ifdef BOARD_MH_ET_LIVE
    red660 = (long)particleSensor.getFIFOIR();
    ir880  = (long)particleSensor.getFIFORed();
#else
    red660 = (long)particleSensor.getFIFORed();
    ir880  = (long)particleSensor.getFIFOIR();
#endif
    particleSensor.nextSample();

    if (!fingerPresent && ir880 > FINGER_ON) {
      fingerPresent = true;
      resetAll(now);
      Serial.println("[Finger ON]");
    }
    if (fingerPresent && ir880 < FINGER_OFF) {
      fingerPresent = false;
      displayedBPM = 0; displaySpO2 = 0;
      spo2Valid = false; hrDone = false;
      Serial.println("[Finger OFF]");
    }
    if (!fingerPresent) continue;

    aveRed = aveRed * FRATE + (double)red660 * (1.0 - FRATE);
    aveIr  = aveIr  * FRATE + (double)ir880  * (1.0 - FRATE);

    bool beatNow = checkForBeat(ir880);
    if (beatNow) {
      unsigned long delta = now - lastBeat;
      lastBeat = now;
      float bpm = 60000.0f / (float)delta;

      if (!hrDone && bpm >= 40 && bpm <= 180) {
        if (bpmCollected < HR_SAMPLE_COUNT) {
          bpmSamples[bpmCollected] = bpm;
          bpmCollected++;
          heartBlinkOn = true;
          heartBlinkTime = now;
        }
        if (bpmCollected >= HR_SAMPLE_COUNT) {
          float sum = 0;
          for (int i = 0; i < HR_SAMPLE_COUNT; i++) sum += bpmSamples[i];
          displayedBPM = sum / HR_SAMPLE_COUNT;
          hrDone = true;
          Serial.print("[HR] Final BPM: ");
          Serial.println(displayedBPM);
        }
      }

      if (inBeat) {
        long acRed = spo2RedMax - spo2RedMin;
        long acIr  = spo2IrMax  - spo2IrMin;
        long dcRed = (spo2RedMax + spo2RedMin) / 2L;
        long dcIr  = (spo2IrMax  + spo2IrMin)  / 2L;
        if (acIr > AC_MIN && acRed > AC_MIN && dcIr > DC_MIN && dcRed > DC_MIN) {
          double R = ((double)acRed / (double)dcRed) / ((double)acIr / (double)dcIr);
          if (R >= R_LOW && R <= R_HIGH) {
            rWindow[rWinIdx % 5] = R;
            rWinIdx++;
            if (rWinFilled < 5) rWinFilled++;
            double rMed = median(rWindow, min(rWinFilled, 5));
            double rawSpO2 = SPO2_A * rMed * rMed + SPO2_B * rMed + SPO2_C;
            if (rawSpO2 > 82.0 && rawSpO2 <= 100.0) {
              if (rawSpO2 > 100.0) rawSpO2 = 100.0;
              ESpO2 = FSPO2 * ESpO2 + (1.0 - FSPO2) * rawSpO2;
            }
            double cal = ESpO2;
            if (cal > 100.0) cal = 100.0;
            if (cal < 80.0) cal = 80.0;
            spo2Out[spo2OutIdx % 5] = cal;
            spo2OutIdx++;
            if (spo2OutFilled < 5) spo2OutFilled++;
            spo2Valid = true;
            if (now - lastSpo2Display >= SPO2_DISPLAY_MS) {
              double avg = 0;
              int c = min(spo2OutFilled, 5);
              for (int i = 0; i < c; i++) avg += spo2Out[i];
              avg /= c;
              displaySpO2 = avg;
              lastSpo2Display = now;
              Serial.print("[SpO2] ");
              Serial.println(displaySpO2);
            }
          }
        }
      }

      inBeat = true;
      beatStartMs = now;
      spo2RedMin = spo2RedMax = red660;
      spo2IrMin  = spo2IrMax  = ir880;
    } else if (inBeat) {
      if (red660 < spo2RedMin) spo2RedMin = red660;
      if (red660 > spo2RedMax) spo2RedMax = red660;
      if (ir880  < spo2IrMin)  spo2IrMin  = ir880;
      if (ir880  > spo2IrMax)  spo2IrMax  = ir880;
      if (now - beatStartMs > 2000) inBeat = false;
    }
  }
}

void readTemperature() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && t > 20.0 && t < 50.0) {
    bodyTemp = t;
    tempValid = true;
  } else {
    tempValid = false;
  }
}

void checkAlerts() {
  bool condition = false;
  if (spo2Valid && displaySpO2 < SPO2_LOW) condition = true;
  if (hrDone && (displayedBPM < HR_LOW || displayedBPM > HR_HIGH)) condition = true;
  if (tempValid && bodyTemp > TEMP_HIGH) condition = true;

  if (condition && !alertActive) {
    alertActive = true;
    alertStart = millis();
    beepCount = 0;
    beepState = true;
    digitalWrite(BUZZER_PIN, HIGH);
  }
  if (alertActive) {
    unsigned long elapsed = millis() - alertStart;
    if (beepState && elapsed >= BEEP_DURATION) {
      beepState = false;
      digitalWrite(BUZZER_PIN, LOW);
      alertStart = millis();
    }
    if (!beepState && elapsed >= BEEP_PAUSE && beepCount < BEEP_REPEAT) {
      beepState = true;
      digitalWrite(BUZZER_PIN, HIGH);
      beepCount++;
      alertStart = millis();
    }
    if (!beepState && beepCount >= BEEP_REPEAT && elapsed >= BEEP_PAUSE) {
      alertActive = false;
      digitalWrite(BUZZER_PIN, LOW);
    }
  }
}

void sendDataToCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Cloud] STA not connected - cannot send");
    return;
  }

  // Build JSON with camelCase keys matching backend deviceRoutes.js expectations
  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"heartRate\":" + String(hrDone ? String(displayedBPM, 1) : "null") + ",";
  json += "\"spo2\":" + String(spo2Valid ? String(displaySpO2, 1) : "null") + ",";
  json += "\"temperature\":" + String(tempValid ? String(bodyTemp, 1) : "null");
  json += "}";

  Serial.print("[Cloud] Sending: ");
  Serial.println(json);

  HTTPClient http;
  http.begin(backend_url);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", api_key);  // Must match backend DEVICE_API_KEY

  int code = http.POST(json);
  Serial.print("[Cloud] Response: ");
  Serial.println(code);
  
  if (code > 0) {
    String response = http.getString();
    Serial.print("[Cloud] Body: ");
    Serial.println(response);
  }
  
  http.end();
}

// Local web server handler (for AP/direct access)
void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  server.sendHeader("Access-Control-Max-Age", "86400");
  server.send(204);
}

void handleData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");

  // Check API Key for local access
  if (server.hasArg("key") && server.arg("key") == localApiKey) {
    String json = "{";
    json += "\"heartRate\":" + String(hrDone ? String(displayedBPM, 1) : "0") + ",";
    json += "\"spo2\":" + String(spo2Valid ? String(displaySpO2, 1) : "0") + ",";
    json += "\"temperature\":" + String(tempValid ? String(bodyTemp, 1) : "0") + ",";
    json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    json += "\"fingerPresent\":" + String(fingerPresent ? "true" : "false");
    json += "}";
    server.send(200, "application/json", json);
  } else {
    server.send(401, "application/json", "{\"error\":\"Unauthorized - add ?key=ESP32_KEY\"}");
  }
}

void setupServer() {
  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.begin();
  Serial.println("[Server] HTTP server started on port 80");
}

void updateDisplay(unsigned long now) {
  display.clearDisplay();
  if (!fingerPresent) {
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(10, 8);  display.println("Place finger on");
    display.setCursor(26, 20); display.println("the sensor");
    display.setCursor(8, 36);  display.println("Fingertip FLAT,");
    display.setCursor(8, 47);  display.println("gentle pressure");
    display.setCursor(90, 56);
    display.print(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "No WiFi");
    display.display();
    return;
  }

  display.fillRect(0, 0, 128, 13, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(3, 3);
  switch (currentScreen) {
    case 0: display.print("   HR + SpO2"); break;
    case 1: display.print("   Temperature"); break;
    case 2: display.print("   Stress Level"); break;
    case 3: display.print("   WiFi Status"); break;
  }
  if (WiFi.status() == WL_CONNECTED) display.fillCircle(123, 6, 3, SSD1306_BLACK);
  else display.drawCircle(123, 6, 3, SSD1306_BLACK);
  if (heartBlinkOn) {
    display.fillTriangle(113, 11, 118, 2, 123, 11, SSD1306_BLACK);
    if (now - heartBlinkTime > 150) heartBlinkOn = false;
  }
  display.setTextColor(SSD1306_WHITE);

  switch (currentScreen) {
    case 0:
      display.setCursor(0, 17); display.print("HEART RATE");
      if (!hrDone) {
        display.setCursor(74, 17); display.print(bpmCollected); display.print("/10");
        display.setTextSize(3);
        if (bpmCollected > 0) {
          display.setCursor(bpmSamples[bpmCollected-1] < 100 ? 12 : 0, 25);
          display.print((int)bpmSamples[bpmCollected-1]);
        } else {
          display.setCursor(0, 25); display.print("---");
        }
        display.setTextSize(1);
        display.setCursor(70, 29); display.print("BPM");
        display.setCursor(70, 40); display.print("reading..");
      } else {
        display.setCursor(74, 17); display.print("DONE");
        display.setTextSize(3);
        int bi = (int)round(displayedBPM);
        display.setCursor(bi < 100 ? 12 : 0, 25);
        display.print(bi);
        display.setTextSize(1);
        display.setCursor(70, 29); display.print("BPM");
        display.setCursor(70, 40);
        if (bi < 60) display.print("LOW");
        else if (bi <= 100) display.print("NORMAL");
        else display.print("HIGH!");
      }
      display.drawFastHLine(0, 48, 128, SSD1306_WHITE);
      display.setCursor(0, 53); display.print("SpO2:");
      if (spo2Valid && displaySpO2 >= 80.0) {
        int sp = (int)round(displaySpO2);
        display.setTextSize(2); display.setCursor(40, 50); display.print(sp);
        display.setTextSize(1); display.setCursor(76, 56); display.print("%");
        display.setCursor(90, 50);
        if (sp >= 95) display.print("OK");
        else if (sp >= 90) display.print("LOW");
        else display.print("CRIT");
      } else {
        display.setCursor(40, 56); display.print("calc...");
      }
      break;
    case 1:
      display.setTextSize(2);
      display.setCursor(10, 20); display.print("Temp");
      display.setTextSize(3);
      display.setCursor(10, 36);
      if (tempValid) { display.print(bodyTemp, 1); display.setCursor(96, 56); display.print("C"); }
      else display.print("--.-");
      break;
    case 2:
      display.setTextSize(1);
      display.setCursor(0, 20); display.print("Stress Score");
      if (hrDone && spo2Valid) {
        int hr = (int)displayedBPM;
        int score = (hr < 60) ? 20 : (hr < 80) ? 40 : (hr < 100) ? 60 : 90;
        display.setTextSize(3);
        display.setCursor(score < 10 ? 24 : score < 100 ? 12 : 0, 30);
        display.print(score);
      } else {
        display.setCursor(10, 40); display.print("need HR+SpO2");
      }
      break;
    case 3:
      display.setTextSize(1);
      display.setCursor(0, 16);
      if (WiFi.status() == WL_CONNECTED) {
        display.print("STA IP: "); display.print(WiFi.localIP().toString());
        display.setCursor(0, 28); display.print("SSID: "); display.print(sta_ssid);
        display.setCursor(0, 40); display.print("Signal: "); display.print(WiFi.RSSI()); display.print("dBm");
      } else {
        display.print("STA: Not connected");
        display.setCursor(0, 28); display.print("Trying...");
      }
      display.drawFastHLine(0, 50, 128, SSD1306_WHITE);
      display.setCursor(0, 54);
      display.print("AP: "); display.print(ap_ssid);
      break;
  }
  display.display();
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n[HealthPulse] v2.2 Starting...");
  Wire.begin(I2C_SDA, I2C_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[ERROR] OLED init failed");
    while (1);
  }
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(8, 10);
  display.println("HealthPulse");
  display.setTextSize(1);
  display.setCursor(40, 35);
  display.println("v2.2");
  display.setCursor(20, 50);
  display.println("Initializing...");
  display.display();
  delay(1500);

  setupWiFi();
  initSensors();
  setupServer();

  lastDispUpdate = lastTempRead = millis();
  Serial.println("[HealthPulse] Ready! Place finger on sensor.");
  Serial.print("[HealthPulse] Backend: ");
  Serial.println(backend_url);
}

void loop() {
  unsigned long now = millis();

  if (now - lastTempRead >= 2000) {
    lastTempRead = now;
    readTemperature();
  }

  processSensors();
  checkAlerts();
  server.handleClient();

  if (fingerPresent && (hrDone || spo2Valid) && (now - lastDataSent >= SEND_INTERVAL_MS)) {
    lastDataSent = now;
    sendDataToCloud();
  }

  if (now - lastScreenSwitch >= SCREEN_CYCLE_MS) {
    lastScreenSwitch = now;
    currentScreen = (currentScreen + 1) % 4;
  }

  if (now - lastDispUpdate >= 250) {
    lastDispUpdate = now;
    updateDisplay(now);
  }

  static unsigned long lastSerial = 0;
  if (now - lastSerial >= 5000) {
    lastSerial = now;
    Serial.print("[STATUS] HR=");
    Serial.print(hrDone ? displayedBPM : -1);
    Serial.print(" SpO2=");
    Serial.print(spo2Valid ? displaySpO2 : -1);
    Serial.print(" Temp=");
    Serial.print(tempValid ? bodyTemp : -127);
    Serial.print(" Finger=");
    Serial.print(fingerPresent ? "YES" : "NO");
    Serial.print(" | ID: ");
    Serial.println(DEVICE_ID);
  }
}
