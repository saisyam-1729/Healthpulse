/**
 * Settings shared with the ESP32 firmware (esp32_health_monitor/secrets.h). They must match the
 * values flashed on the device. Both end up in the browser bundle, so they are not secrets:
 * the local key only stops casual access to the device's /data page on the local network.
 * Defaults match the original firmware so existing devices keep working.
 */
export const DEVICE_LOCAL_KEY: string = import.meta.env.VITE_DEVICE_LOCAL_KEY || "ESP32_KEY";
export const DEVICE_AP_PASSWORD: string = import.meta.env.VITE_DEVICE_AP_PASSWORD || "12345678";
