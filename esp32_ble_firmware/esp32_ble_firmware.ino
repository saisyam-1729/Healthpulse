/*
  HealthPulse AI IoT Device – BLE Edition (Fixed Advertising)
  ESP32 + MAX30102 + DS18B20 + SSD1306 OLED + Buzzer + Bluetooth BLE
  
  BLE Device Name:   ESP32-Health
  BLE Service UUID:  12345678-0000-1000-8000-00805f9b3400
  JSON Char UUID:    12345678-0000-1000-8000-00805f9b3405
  HR Char UUID:      12345678-0000-1000-8000-00805f9b3401
  SpO2 Char UUID:    12345678-0000-1000-8000-00805f9b3402
  Temp Char UUID:    12345678-0000-1000-8000-00805f9b3403
  Stress Char UUID:  12345678-0000-1000-8000-00805f9b3404

  IMPORTANT:
  - Remove "ESP32-Health" from Windows Bluetooth settings before using Chrome
  - Only Chrome (desktop or Android) supports Web Bluetooth
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
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

// ── BLE Configuration ──────────────────────────────────────────
#define BLE_DEVICE_NAME    "ESP32-Health"
#define HEALTH_SERVICE_UUID "12345678-0000-1000-8000-00805f9b3400"
#define HR_CHAR_UUID        "12345678-0000-1000-8000-00805f9b3401"
#define SPO2_CHAR_UUID      "12345678-0000-1000-8000-00805f9b3402"
#define TEMP_CHAR_UUID      "12345678-0000-1000-8000-00805f9b3403"
#define STRESS_CHAR_UUID    "12345678-0000-1000-8000-00805f9b3404"
#define JSON_CHAR_UUID      "12345678-0000-1000-8000-00805f9b3405"

// ── Objects ─────────────────────────────────────────────────────
MAX30105 particleSensor;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

// ── BLE Objects ─────────────────────────────────────────────────
BLEServer* pServer = NULL;
BLECharacteristic* pHRChar = NULL;
BLECharacteristic* pSpO2Char = NULL;
BLECharacteristic* pTempChar = NULL;
BLECharacteristic* pStressChar = NULL;
BLECharacteristic* pJSONChar = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// ── Heart Rate Variables ────────────────────────────────────────
const byte RATE_SIZE = 10;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;
int beatCount = 0;
bool hrDone = false;
float displayedBPM = 0;

// ── SpO2 Variables ──────────────────────────────────────────────
float estimatedSpO2 = 0;
bool spo2Done = false;
long irSum = 0, redSum = 0;
int spo2Samples = 0;

// ── Temperature & Stress ────────────────────────────────────────
float bodyTemp = 0;
int stressScore = 10;
String stressLevel = "LOW";

// ── BLE Callbacks ───────────────────────────────────────────────
class HealthServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("[BLE] Client connected!");
  };
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected!");
  }
};

#include <esp_system.h> // For esp_base_mac_addr_set

// ── Setup BLE ───────────────────────────────────────────────────
void setupBLE() {
  Serial.println("[BLE] Initialising...");

  // Force a custom MAC address to BYPASS Windows Bluetooth Cache!
  // If we don't do this, Windows remembers old firmware UUIDs and blocks Chrome.
  uint8_t custom_mac[6] = {0x24, 0x0A, 0xC4, 0x11, 0x22, 0x33}; // Custom MAC
  esp_base_mac_addr_set(custom_mac);

  BLEDevice::init(BLE_DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new HealthServerCallbacks());

  BLEService* pService = pServer->createService(BLEUUID(HEALTH_SERVICE_UUID), 30);

  // Helper to create a READ+NOTIFY characteristic
  auto makeChar = [&](const char* uuid) -> BLECharacteristic* {
    BLECharacteristic* c = pService->createCharacteristic(
      uuid,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_NOTIFY
    );
    c->addDescriptor(new BLE2902());
    return c;
  };

  pHRChar     = makeChar(HR_CHAR_UUID);
  pSpO2Char   = makeChar(SPO2_CHAR_UUID);
  pTempChar   = makeChar(TEMP_CHAR_UUID);
  pStressChar = makeChar(STRESS_CHAR_UUID);
  pJSONChar   = makeChar(JSON_CHAR_UUID);

  // Set initial values
  pHRChar->setValue("---");
  pSpO2Char->setValue("---");
  pTempChar->setValue("---");
  pStressChar->setValue("---");
  pJSONChar->setValue("{\"status\":\"waiting for finger\"}");

  pService->start();

  // ── FIXED advertising block ──────────────────────────────────
  BLEAdvertisementData advData;
  advData.setName(BLE_DEVICE_NAME);
  advData.setCompleteServices(BLEUUID(HEALTH_SERVICE_UUID));

  BLEAdvertisementData scanData;
  scanData.setName(BLE_DEVICE_NAME);

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->setAdvertisementData(advData);
  pAdv->setScanResponseData(scanData);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  pAdv->setMaxPreferred(0x12);  // FIXED: was setMinPreferred before (bug)
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising as: " BLE_DEVICE_NAME);
  Serial.println("[BLE] Service UUID: " HEALTH_SERVICE_UUID);
}

// ── Setup ───────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  
  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[OLED] Failed!");
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("HealthPulse BLE");
  display.println("Starting...");
  display.display();

  // Temperature Sensor
  tempSensor.begin();

  // MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("[MAX30102] NOT FOUND!");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Sensor Error!");
    display.display();
    while (1);
  }
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);

  // Initialize BLE
  setupBLE();

  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("HealthPulse BLE");
  display.println("Pair in Chrome!");
  display.display();

  // Startup beep
  tone(BUZZER_PIN, 1000, 200);
}

// ── Loop ────────────────────────────────────────────────────────
void loop() {
  // ── Read MAX30102 ─────────────────────────────────────────
  long irValue = particleSensor.getIR();

  if (irValue > 20000) {  // Finger detected (lowered threshold for weaker sensors)
    if (checkForBeat(irValue)) {
      long delta = millis() - lastBeat;
      lastBeat = millis();
      beatsPerMinute = 60.0 / (delta / 1000.0);

      if (beatsPerMinute > 30 && beatsPerMinute < 220) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;
        beatCount++;

        // Calculate average
        beatAvg = 0;
        int count = beatCount < RATE_SIZE ? beatCount : RATE_SIZE;
        for (byte x = 0; x < count; x++) beatAvg += rates[x];
        beatAvg /= count;

        if (beatCount >= 2 && !hrDone) {
          hrDone = true;
        }
        displayedBPM = beatAvg; // Update live
      }
    }

    // SpO2 estimation
    long redValue = particleSensor.getRed();
    irSum += irValue;
    redSum += redValue;
    spo2Samples++;

    if (spo2Samples >= 20 && !spo2Done) { // lowered from 100 to 20
      float ratio = (float)redSum / (float)irSum;
      estimatedSpO2 = 110.0 - 25.0 * ratio;
      if (estimatedSpO2 > 100) estimatedSpO2 = 99.5;
      if (estimatedSpO2 < 70) estimatedSpO2 = 70;
      if (spo2Samples >= 50) spo2Done = true; // lock it in after 50
    }
  } else {
    // Reset if finger removed
    hrDone = false;
    spo2Done = false;
    beatCount = 0;
    spo2Samples = 0;
    irSum = 0;
    redSum = 0;
  }

  // ── Read Temperature ──────────────────────────────────────
  static unsigned long lastTempRead = 0;
  if (millis() - lastTempRead > 2000) {
    lastTempRead = millis();
    tempSensor.requestTemperatures();
    float t = tempSensor.getTempCByIndex(0);
    if (t > 0 && t < 50) bodyTemp = t;
  }

  // ── Calculate Stress ──────────────────────────────────────
  if (hrDone) {
    if (displayedBPM > 100) { stressScore = 70; stressLevel = "HIGH"; }
    else if (displayedBPM > 85) { stressScore = 40; stressLevel = "MODERATE"; }
    else { stressScore = 10; stressLevel = "LOW"; }
  }

  // ── Update BLE Characteristics (every 1 second) ───────────
  static unsigned long lastBLEUpdate = 0;
  if (deviceConnected && millis() - lastBLEUpdate > 1000) {
    lastBLEUpdate = millis();

    // Build JSON string (this is what the website reads)
    String json = "{";
    json += "\"heartRate\":" + (hrDone ? String(displayedBPM, 1) : "null");
    json += ",\"spo2\":" + ((spo2Samples > 20) ? String(estimatedSpO2, 1) : "null");
    json += ",\"temperature\":" + (bodyTemp > 0 ? String(bodyTemp, 1) : "null");
    json += ",\"stressScore\":" + String(stressScore);
    json += ",\"stressLevel\":\"" + stressLevel + "\"";
    json += ",\"fingerPresent\":" + String(irValue > 20000 ? "true" : "false");
    json += "}";

    // Update JSON characteristic (main data channel)
    pJSONChar->setValue(json.c_str());
    pJSONChar->notify();

    // Also update individual characteristics (for compatibility)
    String hrStr = hrDone ? String(displayedBPM, 1) : "---";
    String spStr = spo2Done ? String(estimatedSpO2, 1) : "---";
    String tmpStr = bodyTemp > 0 ? String(bodyTemp, 1) : "---";
    String stressStr = String(stressScore);

    pHRChar->setValue(hrStr.c_str());
    pHRChar->notify();
    pSpO2Char->setValue(spStr.c_str());
    pSpO2Char->notify();
    pTempChar->setValue(tmpStr.c_str());
    pTempChar->notify();
    pStressChar->setValue(stressStr.c_str());
    pStressChar->notify();

    Serial.printf("[BLE] Sent: %s\n", json.c_str());
  }

  // ── Handle reconnection ───────────────────────────────────
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising");
    oldDeviceConnected = false;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
  }

  // ── Update OLED ───────────────────────────────────────────
  static unsigned long lastDisplayUpdate = 0;
  if (millis() - lastDisplayUpdate > 500) {
    lastDisplayUpdate = millis();
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    
    // Status bar
    display.print("BLE: ");
    display.println(deviceConnected ? "CONNECTED" : "WAITING...");
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
    
    // Heart Rate
    display.setCursor(0, 14);
    display.print("HR: ");
    if (hrDone) {
      display.setTextSize(2);
      display.print((int)displayedBPM);
      display.setTextSize(1);
      display.println(" BPM");
    } else {
      display.println("Reading...");
    }
    
    // SpO2
    display.setCursor(0, 34);
    display.print("SpO2: ");
    if (spo2Done) {
      display.print(estimatedSpO2, 1);
      display.println(" %");
    } else {
      display.println("Reading...");
    }
    
    // Temperature
    display.setCursor(0, 46);
    display.print("Temp: ");
    if (bodyTemp > 0) {
      display.print(bodyTemp, 1);
      display.println(" C");
    } else {
      display.println("N/A");
    }
    
    // Finger detection
    display.setCursor(0, 57);
    if (irValue < 50000) {
      display.println("Place finger on sensor");
    } else {
      display.print("Beats: ");
      display.println(beatCount);
    }
    
    display.display();
  }

  // ── Buzzer Alert ──────────────────────────────────────────
  if (hrDone && (displayedBPM > 120 || displayedBPM < 50)) {
    tone(BUZZER_PIN, 2000, 100);
  }
}
