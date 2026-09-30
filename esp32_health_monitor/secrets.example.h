// Copy this file to secrets.h (same folder) and fill in real values.
// secrets.h is gitignored: never commit it.

#pragma once

// Home/office WiFi the device joins to reach the backend.
#define WIFI_SSID      "your-wifi-name"
#define WIFI_PASSWORD  "your-wifi-password"

// Hotspot the device creates for direct setup. The app's setup screen shows
// this password (VITE_DEVICE_AP_PASSWORD in the frontend .env), so keep them the same.
#define AP_SSID        "ESP32-Health"
#define AP_PASSWORD    "choose-at-least-8-characters"

// Backend endpoint, e.g. http://<computer-ip>:5001/api/device/data
#define BACKEND_URL    "http://192.168.1.10:5001/api/device/data"

// Must equal DEVICE_API_KEY in backend/.env. Use a long random string.
#define DEVICE_API_KEY "replace-with-a-long-random-string"

// Key for the device's local /data page. The web app sends it from the browser
// (VITE_DEVICE_LOCAL_KEY), so treat it as a convenience lock, not a secret.
#define LOCAL_API_KEY  "replace-me"
