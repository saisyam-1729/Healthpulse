/**
 * HealthPulse BLE Manager
 * Uses Chrome Web Bluetooth API to connect to ESP32 BLE health device.
 * 
 * ESP32 device name: "ESP32-Health"
 * ESP32 sends a JSON string via a single characteristic (notifications every ~1s).
 */

// Web Bluetooth API type declarations (not in default TS lib)
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options: any): Promise<any>;
    };
  }
}

// ── BLE UUIDs (Support both old & new firmware) ──────────────
export const BLE_DEVICE_NAME    = 'ESP32-Health';

// V2 Firmware (JSON-based)
export const BLE_SERVICE_UUID_V2   = '12345678-0000-1000-8000-00805f9b3400';
export const BLE_JSON_CHAR_UUID    = '12345678-0000-1000-8000-00805f9b3405';

// V1 Firmware (Individual characteristics)
export const BLE_SERVICE_UUID_V1   = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const BLE_HR_CHAR_UUID_V1   = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const BLE_SPO2_CHAR_UUID_V1 = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
export const BLE_TEMP_CHAR_UUID_V1 = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';

export interface BLEHealthData {
  heartRate: number | null;
  spo2: number | null;
  temperature: number | null;
  stressScore: number | null;
  stressLevel: string | null;
  rmssd: number | null;
  fingerPresent?: boolean;
  timestamp: string;
  raw?: string;
}

type BLEListener = (data: BLEHealthData) => void;
type BLEStatusListener = (status: 'connected' | 'disconnected' | 'connecting') => void;

class BLEManager {
  private device: any = null;
  private server: any = null;
  private listeners: BLEListener[] = [];
  private statusListeners: BLEStatusListener[] = [];
  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private latestData: BLEHealthData = {
    heartRate: null,
    spo2: null,
    temperature: null,
    stressScore: null,
    stressLevel: null,
    rmssd: null,
    fingerPresent: false,
    timestamp: new Date().toISOString(),
  };

  get status() { return this._status; }
  get data() { return this.latestData; }
  get deviceName() { return this.device?.name || null; }

  static isSupported(): boolean {
    return !!(navigator as any).bluetooth;
  }

  onData(listener: BLEListener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  onStatus(listener: BLEStatusListener) {
    this.statusListeners.push(listener);
    return () => { this.statusListeners = this.statusListeners.filter(l => l !== listener); };
  }

  private setStatus(status: 'connected' | 'disconnected' | 'connecting') {
    this._status = status;
    this.statusListeners.forEach(l => l(status));
  }

  private emitData(data: Partial<BLEHealthData>) {
    this.latestData = {
      ...this.latestData,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.listeners.forEach(l => l(this.latestData));
  }

  async connect(): Promise<void> {
    if (!BLEManager.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome on desktop or Android.');
    }

    this.setStatus('connecting');
    let currentStep = 'requestDevice';

    try {
      currentStep = 'requestDevice';
      // Improved device discovery with filters
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: BLE_DEVICE_NAME },
          { services: [BLE_SERVICE_UUID_V2] }
        ],
        optionalServices: [BLE_SERVICE_UUID_V2, BLE_SERVICE_UUID_V1],
      });

      if (!this.device) throw new Error('No device selected');
      console.log('[BLE] Found device:', this.device.name);

      this.device.addEventListener('gattserverdisconnected', () => {
        console.log('[BLE] Device disconnected');
        this.setStatus('disconnected');
      });

      currentStep = 'gatt.connect';
      this.server = await this.device.gatt!.connect();
      console.log('[BLE] Connected to GATT server:', this.device.name);

      currentStep = 'subscribeToData';
      await this.subscribeToData(this.server);

      this.setStatus('connected');
      console.log('[BLE] Fully connected and receiving data!');

    } catch (err: any) {
      console.error(`[BLE] Connection error at step: ${currentStep}`, err);
      this.setStatus('disconnected');

      if (err.name === 'NotFoundError') {
        throw new Error('Device not found. Make sure it is turned on, advertising, and not paired to Windows Bluetooth settings.');
      }
      throw new Error(`[${currentStep}] ${err.message}`);
    }
  }

  private async subscribeToData(server: any) {
    let serviceV2 = null;
    let serviceV1 = null;
    let availableServices = [];

    // Get all services Chrome can see for debugging
    try {
      const services = await server.getPrimaryServices();
      availableServices = services.map((s: any) => s.uuid);
      console.log('[BLE] Available services according to Chrome:', availableServices);
    } catch (e) {
      console.log('[BLE] Could not list primary services:', e);
    }

    // Try V2 (JSON)
    try {
      console.log('[BLE] Trying V2 Service (JSON)...');
      serviceV2 = await server.getPrimaryService(BLE_SERVICE_UUID_V2);
      
      // Let's see what characteristics are actually available
      let availableChars = [];
      try {
        const chars = await serviceV2.getCharacteristics();
        availableChars = chars.map((c: any) => c.uuid);
        console.log('[BLE] Available chars for V2:', availableChars);
      } catch (e) {
        console.log('[BLE] Could not list characteristics:', e);
      }

      try {
        const jsonChar = await serviceV2.getCharacteristic(BLE_JSON_CHAR_UUID);
        
        const handleJSONValue = (value: DataView) => {
          try {
            // Remove null characters and trim whitespace which can break JSON.parse
            const raw = new TextDecoder().decode(value).replace(/\0/g, '').trim();
            console.log('%c[BLE] DATA RECEIVED FROM ESP32: ' + raw, 'color: #00ff00; font-weight: bold;');
            
            if (!raw.startsWith('{')) {
              console.warn('[BLE] Data is not a JSON object, ignoring.');
              return;
            }

            const data = JSON.parse(raw);
            console.log('[BLE] Parsed JSON:', data);

            this.emitData({
              heartRate: (typeof data.heartRate === 'number') ? data.heartRate : 
                         (typeof data.heart_rate === 'number') ? data.heart_rate : null,
              spo2: (typeof data.spo2 === 'number') ? data.spo2 : 
                    (typeof data.SpO2 === 'number') ? data.SpO2 : null,
              temperature: (typeof data.temperature === 'number') ? data.temperature : 
                           (typeof data.temp === 'number') ? data.temp : null,
              stressScore: data.stressScore ?? null,
              stressLevel: data.stressLevel ?? null,
              rmssd: data.rmssd ?? null,
              fingerPresent: data.fingerPresent === true,
              raw: raw, // Pass raw string for debugging
            });
          } catch (e) {
            console.error('[BLE] Failed to parse JSON data from device:', e);
          }
        };

        try {
          console.log('[BLE] Trying startNotifications()...');
          await jsonChar.startNotifications();
          jsonChar.addEventListener('characteristicvaluechanged', (event: any) => handleJSONValue(event.target.value));
          console.log('[BLE] Successfully subscribed to V2 JSON Characteristic.');
        } catch (notifyErr: any) {
          console.warn(`[BLE] Notifications failed (${notifyErr.message}). Falling back to Polling Mode!`);
          
          // Polling Mode Fallback
          // Read the value immediately, then every 1 second
          const poll = async () => {
            if (this._status !== 'connected' || !this.device?.gatt?.connected) return;
            try {
              const value = await jsonChar.readValue();
              handleJSONValue(value);
              setTimeout(poll, 1000);
            } catch (e) {
              console.warn('[BLE] Polling read error:', e);
            }
          };
          poll();
          console.log('[BLE] Successfully started Polling Mode.');
        }
        
        return; // Success!
      } catch (charErr: any) {
        const seen = availableChars.length > 0 ? availableChars.join(', ') : 'None';
        throw new Error(`getCharacteristic failed: ${charErr.message}. Chars Chrome sees: [${seen}]`);
      }
    } catch (err: any) {
      console.log('[BLE] V2 failed. Error:', err.message);
      // Only re-throw if it's our custom characteristic error
      if (err.message.includes('Chars Chrome sees')) {
        throw err;
      }
    }

    // Try V1 (Individual Floats)
    try {
      console.log('[BLE] Trying V1 Service (Floats)...');
      serviceV1 = await server.getPrimaryService(BLE_SERVICE_UUID_V1);
      
      const hrChar = await serviceV1.getCharacteristic(BLE_HR_CHAR_UUID_V1);
      const spo2Char = await serviceV1.getCharacteristic(BLE_SPO2_CHAR_UUID_V1);
      const tempChar = await serviceV1.getCharacteristic(BLE_TEMP_CHAR_UUID_V1);

      const handleFloatData = (field: keyof BLEHealthData) => (event: any) => {
        const value = event.target.value as DataView;
        const numericValue = value.byteLength >= 4
          ? parseFloat(value.getFloat32(0, true).toFixed(1))
          : value.byteLength >= 2
            ? value.getInt16(0, true) / 10.0
            : value.getUint8(0);
        if (!isNaN(numericValue) && numericValue > 0) {
          this.emitData({ [field]: numericValue });
        }
      };

      await hrChar.startNotifications();
      hrChar.addEventListener('characteristicvaluechanged', handleFloatData('heartRate'));

      await spo2Char.startNotifications();
      spo2Char.addEventListener('characteristicvaluechanged', handleFloatData('spo2'));

      await tempChar.startNotifications();
      tempChar.addEventListener('characteristicvaluechanged', handleFloatData('temperature'));

      console.log('[BLE] Successfully subscribed to V1 Characteristics.');
      return; // Success!
    } catch (err) {
      console.error('[BLE] V1 also failed.', err);
      const seen = availableServices.length > 0 ? availableServices.join(', ') : 'None';
      throw new Error(`Services Chrome sees: [${seen}]. Flash ESP32 or clear Bluetooth cache!`);
    }
  }

  /** Disconnect from device */
  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.setStatus('disconnected');
  }

  /** Check if currently connected */
  isConnected(): boolean {
    return this._status === 'connected' && !!this.device?.gatt?.connected;
  }
}

// Singleton instance
export const bleManager = new BLEManager();
