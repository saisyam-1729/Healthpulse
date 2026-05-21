const axios = require('axios');
const express = require('express');
const http = require('http');
const cors = require('cors');

// --- CONFIGURATION ---
const TARGETS = [
  'http://localhost:5001/api/device/data',
  'https://health-931r.onrender.com/api/device/data'
];
const DEVICE_ID = 'ESP32-HEALTH-001'; 
const USER_ID = '69c023b0d858206298879506'; // Your verified User ID
const API_KEY = 'ESP32_SECRET';

const app = express();
app.use(cors());
const server = http.createServer(app);

let lastData = { heartRate: null, spo2: null, temperature: null };
let esp32Ip = '10.55.196.252';

async function pollAndPush() {
  try {
    const response = await axios.get(`http://${esp32Ip}/data`, { timeout: 5000 });
    if (response.data && response.data.heartRate !== null) {
      lastData = response.data;
      console.log(`[Bridge] LIVE: HR=${lastData.heartRate}, SpO2=${lastData.spo2}`);

      // Prepare "Master Payload" for both old and new schemas
      const payload = {
        // New Schema
        deviceId: DEVICE_ID,
        heartRate: lastData.heartRate,
        spo2: lastData.spo2,
        temperature: lastData.temperature || 36.5,
        
        // Old Schema (Snake Case)
        device_id: DEVICE_ID,
        user_id: USER_ID,
        heart_rate: lastData.heartRate,
        spo_2: lastData.spo2,
        last_sync: new Date().toISOString()
      };

      for (const url of TARGETS) {
        try {
          await axios.post(url, payload, { 
            headers: { 'x-api-key': API_KEY },
            timeout: 5000 
          });
          console.log(`[Bridge] SYNC OK -> ${url.includes('localhost') ? 'LOCAL' : 'CLOUD'}`);
        } catch (e) {
          console.warn(`[Bridge] Sync Fail -> ${url.includes('localhost') ? 'LOCAL' : 'CLOUD'}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Bridge] ESP32 Offline/Timeout: ${err.message}`);
  }
}

setInterval(pollAndPush, 3000);
server.listen(8082, '0.0.0.0', () => console.log("🚀 Bridge v6 MASTER SYNC Running..."));
