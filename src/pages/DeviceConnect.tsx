import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Smartphone, Loader2, Search, Wifi, AlertCircle, CheckCircle2, RefreshCw, Cloud, Bluetooth, BluetoothSearching, BluetoothConnected } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { bleManager, BLEHealthData } from "@/lib/ble";
import axios from "axios";
import DashboardLayout from "@/components/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import GlassModal from "@/components/GlassModal";

type ScanState = "IDLE" | "SCANNING" | "SUCCESS" | "ERROR";
type BLEState = "IDLE" | "PAIRING" | "CONNECTED" | "ERROR";

export default function DeviceConnect() {
  const [deviceId, setDeviceId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("IDLE");
  const [bleState, setBleState] = useState<BLEState>("IDLE");
  const [bleError, setBleError] = useState("");
  const [detectedSource, setDetectedSource] = useState<string>("");
  const [liveData, setLiveData] = useState<BLEHealthData | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const unsub = bleManager.onStatus((status) => {
      if (status === "connected") setBleState("CONNECTED");
      else if (status === "disconnected" && bleState === "CONNECTED") {
        setBleState("IDLE");
        toast({ title: "Bluetooth Disconnected", description: "Device was disconnected.", variant: "destructive" });
      }
    });
    return unsub;
  }, [bleState]);

  useEffect(() => {
    const unsub = bleManager.onData((data) => setLiveData(data));
    return unsub;
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !deviceId.trim()) return;
    setIsConnecting(true);
    try {
      await api.post("/device/connect", { userId: user.id || (user as any)._id, deviceId: deviceId.trim() });
      localStorage.setItem("healthpulse_connection_mode", "cloud");
      localStorage.setItem("healthpulse_device_id", deviceId.trim());
      toast({ title: t("deviceConnect.success") });
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      toast({ title: t("deviceConnect.failed"), description: err.response?.data?.error || err.message || "Could not link device.", variant: "destructive" });
    } finally { setIsConnecting(false); }
  };

  const handleBLEConnect = async () => {
    setBleState("PAIRING"); setBleError("");
    try {
      await bleManager.connect();
      localStorage.setItem("healthpulse_connection_mode", "ble");
      try { if (user) await api.post("/device/connect", { userId: user.id || (user as any)._id, deviceId: "ESP32-BLE-HEALTH" }); } catch {}
      toast({ title: "Bluetooth Connected!", description: `Connected to ${bleManager.deviceName || "ESP32 Health Device"}` });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      setBleState("ERROR");
      setBleError(err.message?.includes("User cancelled") ? "Pairing was cancelled. Try again."
        : err.message?.includes("not supported") ? "Web Bluetooth requires Chrome on desktop or Android."
        : err.message || "Could not connect to Bluetooth device.");
    }
  };

  const handleBLEDisconnect = () => {
    bleManager.disconnect(); setBleState("IDLE"); setLiveData(null);
    localStorage.removeItem("healthpulse_connection_mode");
    toast({ title: "Bluetooth Disconnected" });
  };

  const handleScan = async () => {
    setScanState("SCANNING");
    const targets = [
      { url: "http://192.168.4.1/data?key=ESP32_KEY", label: "AP Mode (192.168.4.1)" },
      { url: "http://healthpulse.local/data?key=ESP32_KEY", label: "mDNS (healthpulse.local)" },
    ];
    for (let i = 1; i <= 20; i++) targets.push({ url: `http://192.168.1.${i}/data?key=ESP32_KEY`, label: `LAN (192.168.1.${i})` });
    for (const target of targets) {
      try {
        const response = await axios.get(target.url, { timeout: 1500 });
        if (response.data && (response.data.deviceId || response.data.heartRate !== undefined)) {
          setScanState("SUCCESS"); setDetectedSource(target.label);
          const ipMatch = target.url.match(/http:\/\/([^/]+)\//);
          const detectedIp = ipMatch ? ipMatch[1] : "192.168.4.1";
          toast({ title: t("deviceConnect.localFound"), description: `ESP32 detected via ${target.label}` });
          localStorage.setItem("healthpulse_connection_mode", "local");
          localStorage.setItem("healthpulse_local_ip", detectedIp);
          setDeviceId(response.data.deviceId || "ESP32-HEALTH-001");
          try { if (user) await api.post("/device/connect", { userId: user.id || (user as any)._id, deviceId: response.data.deviceId || "ESP32-HEALTH-001" }); } catch {}
          setTimeout(() => navigate("/dashboard"), 1200);
          return;
        }
      } catch { continue; }
    }
    setScanState("ERROR");
    toast({ title: t("deviceConnect.localNotFound"), description: "Could not reach ESP32 on any known address.", variant: "destructive" });
  };

  const isBLESupported = typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

  /* Glass section wrapper — light+dark aware */
  const GlassSection = ({ icon: Icon, title, badge, color = "cyan", children }: any) => {
    const c = {
      cyan:  { iconCls: "text-cyan-600 dark:text-cyan-400",  titleCls: "text-cyan-700 dark:text-cyan-400",  borderCls: "border-cyan-500/20",  bgCls: "bg-cyan-500/5" },
      blue:  { iconCls: "text-blue-600 dark:text-blue-400",  titleCls: "text-blue-700 dark:text-blue-400",  borderCls: "border-blue-500/20",  bgCls: "bg-blue-500/5" },
      teal:  { iconCls: "text-teal-600 dark:text-teal-400",  titleCls: "text-teal-700 dark:text-teal-400",  borderCls: "border-teal-500/20",  bgCls: "bg-teal-500/5" },
    }[color as "cyan" | "blue" | "teal"] ?? { iconCls: "text-cyan-600 dark:text-cyan-400", titleCls: "text-cyan-700 dark:text-cyan-400", borderCls: "border-cyan-500/20", bgCls: "bg-cyan-500/5" };
    return (
      <div className={`liquid-glass rounded-2xl overflow-hidden border ${c.borderCls}`}>
        <div className={`flex items-center gap-2 px-4 py-3 border-b ${c.borderCls} ${c.bgCls}`}>
          <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${c.bgCls} border ${c.borderCls}`}>
            <Icon className={`h-3.5 w-3.5 ${c.iconCls}`} />
          </div>
          <span className={`font-mono text-xs font-bold uppercase tracking-wider ${c.titleCls}`}>{title}</span>
          {badge && (
            <span className="ml-auto font-mono text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
              {badge}
            </span>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    );
  };

  /* Glass button — light+dark aware */
  const GlassBtn = ({ onClick, disabled, children, variant = "cyan" }: any) => {
    const styles: Record<string, string> = {
      cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/20",
      blue: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20",
      teal: "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/20",
      red:  "bg-red-500/8 border-red-500/25 text-red-700 dark:text-red-400 hover:bg-red-500/15",
    };
    return (
      <motion.button
        onClick={onClick} disabled={disabled}
        whileHover={!disabled ? { scale: 1.03, y: -1 } : {}} whileTap={!disabled ? { scale: 0.97 } : {}}
        className={`w-full py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 border ${styles[variant] || styles.cyan}`}
      >
        {children}
      </motion.button>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

          {/* Scanning progress bar */}
          {(scanState === "SCANNING" || bleState === "PAIRING") && (
            <div className="h-0.5 mb-2 rounded-full overflow-hidden bg-muted">
              <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 30, ease: "linear" }} />
            </div>
          )}

          {/* Main card */}
          <div className="liquid-glass rounded-2xl overflow-hidden border border-cyan-500/20 shadow-[0_0_40px_rgba(0,243,255,0.06)]">
            {/* Cyan top glow line */}
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

            <div className="p-7 space-y-5">
              {/* Header */}
              <div className="text-center mb-2">
                <motion.div
                  animate={(scanState === "SCANNING" || bleState === "PAIRING") ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/25 shadow-[0_0_20px_rgba(0,243,255,0.1)]"
                >
                  <Smartphone className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
                </motion.div>
                <h1 className="font-display text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-400">
                  {t("deviceConnect.title")}
                </h1>
                <p className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                  {t("deviceConnect.subtitle")}
                </p>
              </div>

              {/* BLE Section */}
              <GlassSection icon={Bluetooth} title="Bluetooth BLE" badge="Recommended" color="cyan">
                <p className="font-mono text-[10px] text-muted-foreground mb-3 leading-relaxed">
                  Direct connection. No WiFi needed. Requires <span className="text-cyan-700 dark:text-cyan-400 font-bold">Chrome</span>.
                </p>
                <AnimatePresence mode="wait">
                  {bleState === "IDLE" && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <GlassBtn onClick={handleBLEConnect} disabled={!isBLESupported} variant="cyan">
                        <BluetoothSearching className="h-4 w-4" />
                        {isBLESupported ? "Pair via Bluetooth" : "Bluetooth Not Supported"}
                      </GlassBtn>
                    </motion.div>
                  )}
                  {bleState === "PAIRING" && (
                    <motion.div key="pairing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-3 py-4 rounded-xl text-center bg-cyan-500/5 border border-dashed border-cyan-500/20">
                      <div className="relative h-7 w-7">
                        <div className="absolute inset-0 rounded-full border-t-2 border-cyan-500 animate-spin" />
                        <div className="absolute inset-1.5 rounded-full border-b border-blue-500 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.7s" }} />
                      </div>
                      <p className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">Searching for ESP32...</p>
                      <p className="font-mono text-[9px] text-muted-foreground">Select your device in the browser popup</p>
                    </motion.div>
                  )}
                  {bleState === "CONNECTED" && (
                    <motion.div key="connected" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
                        <BluetoothConnected className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="font-mono text-[10px] font-bold text-green-700 dark:text-green-400">Connected to {bleManager.deviceName || "ESP32 Health"}</p>
                          <p className="font-mono text-[9px] text-muted-foreground">Receiving real-time health data</p>
                        </div>
                      </div>
                      {liveData && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "HR",   value: liveData.heartRate ?? "—", unit: "BPM", cls: "bg-red-500/8 border-red-500/20 text-red-700 dark:text-red-400" },
                            { label: "SpO2", value: liveData.spo2 ?? "—",      unit: "%",   cls: "bg-blue-500/8 border-blue-500/20 text-blue-700 dark:text-blue-400" },
                            { label: "Temp", value: typeof liveData.temperature === "number" ? liveData.temperature.toFixed(1) : "—", unit: "°C", cls: "bg-orange-500/8 border-orange-500/20 text-orange-700 dark:text-orange-400" },
                          ].map((item) => (
                            <div key={item.label} className={`p-3 rounded-xl text-center border ${item.cls}`}>
                              <p className={`font-mono text-[9px] font-bold uppercase tracking-wider opacity-70 ${item.cls.split(" ")[2]}`}>{item.label}</p>
                              <p className={`font-display text-xl font-bold ${item.cls.split(" ")[2]}`}>{item.value}</p>
                              <p className={`font-mono text-[8px] opacity-60 ${item.cls.split(" ")[2]}`}>{item.unit}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <GlassBtn onClick={() => navigate("/dashboard")} variant="teal">Dashboard →</GlassBtn>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleBLEDisconnect}
                          className="flex-1 py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest bg-red-500/8 border border-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/15 transition-colors">
                          Disconnect
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                  {bleState === "ERROR" && (
                    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/6 border border-red-500/20">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-mono text-[10px] font-bold text-red-700 dark:text-red-400">Connection Failed</p>
                          <p className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{bleError}</p>
                        </div>
                      </div>
                      <GlassBtn onClick={() => { setBleState("IDLE"); handleBLEConnect(); }} variant="cyan">
                        <RefreshCw className="h-3.5 w-3.5" /> Try Again
                      </GlassBtn>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!isBLESupported && (
                  <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-orange-500/6 border border-orange-500/20">
                    <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                      Web Bluetooth requires <span className="font-bold text-orange-700 dark:text-orange-400">Google Chrome</span> on desktop or Android.
                    </p>
                  </div>
                )}
              </GlassSection>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Other Methods</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Cloud Section */}
              <GlassSection icon={Cloud} title="Cloud Mode" color="blue">
                <p className="font-mono text-[10px] text-muted-foreground mb-3 leading-relaxed">
                  ESP32 and PC must be on the same WiFi. Enter your device ID.
                </p>
                <form onSubmit={handleConnect} className="space-y-3">
                  <div>
                    <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1 block">
                      {t("deviceConnect.deviceIdLabel")}
                    </Label>
                    <Input
                      id="deviceId" placeholder={t("deviceConnect.placeholder")}
                      className="h-10 rounded-xl font-mono text-sm"
                      value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                    />
                    <button type="button" onClick={() => setDeviceId("ESP32-HEALTH-001")}
                      className="font-mono text-[9px] text-cyan-600 dark:text-cyan-400 hover:underline mt-1 transition-colors">
                      Use default: ESP32-HEALTH-001
                    </button>
                  </div>
                  <GlassBtn onClick={undefined} disabled={isConnecting || !deviceId.trim() || scanState === "SCANNING"} variant="blue">
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("deviceConnect.connectButton")}
                  </GlassBtn>
                </form>
              </GlassSection>

              {/* WiFi/Local Section */}
              <GlassSection icon={Wifi} title="Direct WiFi / Offline" color="teal">
                <p className="font-mono text-[10px] text-muted-foreground mb-3 leading-relaxed">
                  Connect to <span className="text-teal-700 dark:text-teal-400 font-bold">ESP32-Health</span> WiFi (Pass: 12345678) then scan.
                </p>
                <AnimatePresence mode="wait">
                  {scanState === "IDLE" && (
                    <GlassBtn key="scan-idle" onClick={handleScan} variant="teal">
                      <Wifi className="h-4 w-4" /> {t("deviceConnect.scanButton")}
                    </GlassBtn>
                  )}
                  {scanState === "SCANNING" && (
                    <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-2 py-4 rounded-xl text-center bg-teal-500/5 border border-dashed border-teal-500/20">
                      <div className="relative h-7 w-7">
                        <div className="absolute inset-0 rounded-full border-t-2 border-teal-500 animate-spin" />
                      </div>
                      <p className="font-mono text-[10px] text-teal-700 dark:text-teal-400 uppercase tracking-wider">{t("deviceConnect.scanning")}</p>
                    </motion.div>
                  )}
                  {scanState === "SUCCESS" && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-2 py-4 rounded-xl bg-green-500/8 border border-green-500/20">
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                      <p className="font-mono text-[10px] font-bold text-green-700 dark:text-green-400">{t("deviceConnect.localFound")}</p>
                      {detectedSource && <p className="font-mono text-[9px] text-muted-foreground">Found via {detectedSource}</p>}
                    </motion.div>
                  )}
                  {scanState === "ERROR" && (
                    <motion.div key="scan-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/6 border border-red-500/18">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <p className="font-mono text-[9px] text-red-700 dark:text-red-400/80">{t("deviceConnect.localNotFound")} — Try Bluetooth above.</p>
                      </div>
                      <GlassBtn onClick={handleScan} variant="teal">
                        <RefreshCw className="h-3.5 w-3.5" /> {t("deviceConnect.retry")}
                      </GlassBtn>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassSection>

              {/* Skip */}
              <div className="text-center pt-1">
                <motion.button whileHover={{ scale: 1.04 }} onClick={() => setShowSkipModal(true)}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                  {t("deviceConnect.skip")}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <GlassModal open={showSkipModal} onClose={() => setShowSkipModal(false)} title="SKIP DEVICE SETUP" description="Proceed to dashboard without a connected device?">
        <div className="flex gap-3 mt-4">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/dashboard")}
            className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-widest text-black"
            style={{ background: "linear-gradient(135deg, #00f3ff, #0066ff)", boxShadow: "0 0 16px rgba(0,243,255,0.3)" }}>
            Skip
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setShowSkipModal(false)}
            className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-widest text-foreground/60 bg-muted/40 border border-border">
            Cancel
          </motion.button>
        </div>
      </GlassModal>
    </DashboardLayout>
  );
}
