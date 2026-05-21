import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Heart, Thermometer, Wind, Brain, TrendingUp, Clock, Smartphone, Bell, FileText, Loader2, Check, HelpCircle, Wifi, Globe, Bluetooth, BluetoothConnected } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import StressGauge from "@/components/StressGauge";
import { computeStressScore, getStressLevel, getStressColor, getRecommendations } from "@/lib/stress";
import { useAuth } from "@/lib/auth";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { trackEvent, AnalyticsCategory, AnalyticsAction } from "@/lib/analytics";
import { useTranslation } from "react-i18next";
import HowToUseModal from "@/components/HowToUseModal";
import { bleManager } from "@/lib/ble";
import axios from "axios";
import MagneticWrapper from "@/components/dashboard/MagneticWrapper";
import ParallaxWrapper from "@/components/dashboard/ParallaxWrapper";
import HumanBodyView from "@/components/dashboard/HumanBodyView";
import VitalsPanel from "@/components/dashboard/VitalsPanel";
import AIInsightsPanel from "@/components/dashboard/AIInsightsPanel";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";
import { motion } from "framer-motion";

interface HealthReading {
  heart_rate: number;
  spo2: number;
  temperature: number;
  timestamp: string;
}

import Feedback from "@/components/Feedback";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [readings, setReadings] = useState<HealthReading[]>([]);
  const [latest, setLatest] = useState<HealthReading | null>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [device, setDevice] = useState<any>(null);
  const [hasDevice, setHasDevice] = useState<boolean | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"cloud" | "local" | "ble">(
    (localStorage.getItem("healthpulse_connection_mode") as any) || "cloud"
  );
  const [bleStatus, setBleStatus] = useState<string>(bleManager.status);
  const [fingerPresent, setFingerPresent] = useState<boolean>(false);
  const [bleData, setBleData] = useState<any>(null);

  // Show guide on first visit
  useEffect(() => {
    const seen = localStorage.getItem("healthpulse_guide_seen");
    if (!seen) {
      setShowGuide(true);
      localStorage.setItem("healthpulse_guide_seen", "true");
    }
  }, []);

  // ── BLE Mode: subscribe to live sensor data ─────────────────
  useEffect(() => {
    if (connectionMode !== "ble") return;

    // Sync initial state
    setBleStatus(bleManager.status);
    if (bleManager.isConnected()) {
      setHasDevice(true);
      setDevice({ device_id: bleManager.deviceName || "ESP32-BLE-HEALTH" });
      setBleData(bleManager.data);
    } else if (bleManager.status === 'disconnected') {
      setHasDevice(false);
    }

    const unsubData = bleManager.onData((data) => {
      setBleData(data);
      const newReading: HealthReading = {
        heart_rate: data.heartRate ?? 0,
        spo2: data.spo2 ?? 0,
        temperature: data.temperature ?? 0,
        timestamp: data.timestamp,
      };
      setLatest(newReading);
      setFingerPresent(data.fingerPresent || false);
      setReadings(prev => [...prev.slice(-19), newReading]);
      setHasDevice(true);
      if (!device) setDevice({ device_id: bleManager.deviceName || "ESP32-BLE-HEALTH" });

      // Sync to cloud backend in background (non-blocking)
      api.post("/device/data", {
        deviceId: "ESP32-BLE-HEALTH",
        heartRate: data.heartRate,
        spo2: data.spo2,
        temperature: data.temperature || 36.5,
      }).catch(() => { });
    });

    const unsubStatus = bleManager.onStatus((status) => {
      setBleStatus(status);
      if (status === 'disconnected') {
        toast({ title: "Bluetooth Disconnected", variant: "destructive" });
      }
    });

    return () => { unsubData(); unsubStatus(); };
  }, [connectionMode]);

  const fetchLocalData = async () => {
    try {
      const savedIp = localStorage.getItem("healthpulse_local_ip") || "192.168.4.1";
      const response = await axios.get(`http://${savedIp}/data?key=ESP32_KEY`, { timeout: 2000 });
      const data = response.data;
      const newReading: HealthReading = {
        heart_rate: data.heartRate,
        spo2: data.spo2,
        temperature: data.temperature || 36.5,
        timestamp: new Date().toISOString()
      };

      setLatest(newReading);
      setReadings(prev => [...prev.slice(-19), newReading]);
      setHasDevice(true);
      if (!device) setDevice({ device_id: "ESP32-LOCAL" });

      // Local -> Cloud Sync
      try {
        await api.post("/device/data", {
          deviceId: data.deviceId || "ESP32-LOCAL",
          heartRate: data.heartRate,
          spo2: data.spo2,
          temperature: data.temperature || 36.5
        });

        // Check offline queue and flush
        const offlineQueue = JSON.parse(localStorage.getItem('healthpulse_offline_queue') || '[]');
        if (offlineQueue.length > 0) {
          console.log(`[Sync] Flushing ${offlineQueue.length} offline records...`);
          // We could flush them all here, but for now just clear to avoid spamming
          localStorage.removeItem('healthpulse_offline_queue');
        }
      } catch (syncErr) {
        console.warn("Cloud sync failed during Local Mode. Queueing offline.", syncErr);
        // Save to offline queue
        const offlineQueue = JSON.parse(localStorage.getItem('healthpulse_offline_queue') || '[]');
        offlineQueue.push({
          deviceId: data.deviceId || "ESP32-LOCAL",
          heartRate: data.heartRate,
          spo2: data.spo2,
          temperature: data.temperature || 36.5,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('healthpulse_offline_queue', JSON.stringify(offlineQueue));
      }

    } catch (err) {
      console.warn("Local fetch failed, falling back to cloud mode check");
      setConnectionMode("cloud");
      localStorage.setItem("healthpulse_connection_mode", "cloud");
    }
  };

  const fetchData = async () => {
    if (connectionMode === "ble") {
      // BLE mode: data comes from BLE subscriptions (useEffect above), no polling needed
      return;
    }
    if (connectionMode === "local") {
      await fetchLocalData();
      return;
    }

    try {
      const [devices, onboardingData, latestAi] = await Promise.all([
        api.get("/devices"),
        api.get("/onboarding").catch(() => null),
        api.get("/ai/latest").catch(() => null)
      ]);

      if (onboardingData) setOnboarding(onboardingData);
      if (latestAi) setAiAnalysis(latestAi);

      if (!devices || devices.length === 0) {
        setHasDevice(false);
        setDevice(null);
        return;
      }

      setHasDevice(true);
      setDevice(devices[0]);
      const data = await api.get(`/device/${user.id}`);
      if (data?.length) {
        if (!latest || data[data.length - 1].timestamp !== latest.timestamp) {
          trackEvent(AnalyticsCategory.DEVICE, AnalyticsAction.DEVICE_DATA_RECEIVED);
        }
        setReadings(data);
        setLatest(data[data.length - 1]);
      }
    } catch (err) {
      console.error("Dashboard data fetch failed:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user, connectionMode]);

  const handleBLEConnect = async () => {
    try {
      await bleManager.connect();
      setConnectionMode("ble");
      setBleStatus('connected'); // Force immediate sync
      localStorage.setItem("healthpulse_connection_mode", "ble");
      toast({ title: "Bluetooth Connected!", description: `Connected to ${bleManager.deviceName || "ESP32"}` });
    } catch (err: any) {
      const isWindows = navigator.platform.toLowerCase().includes('win');
      const helpMsg = isWindows ? "\n\nTip: Remove 'ESP32-Health' from Windows Bluetooth settings before connecting." : "";
      toast({ 
        title: "Bluetooth Failed", 
        description: err.message + helpMsg, 
        variant: "destructive" 
      });
    }
  };

  const toggleConnectionMode = () => {
    const modes: Array<"cloud" | "local" | "ble"> = ["cloud", "local", "ble"];
    const currentIdx = modes.indexOf(connectionMode);
    const newMode = modes[(currentIdx + 1) % modes.length];

    if (newMode === "ble") {
      handleBLEConnect();
      return;
    }

    setConnectionMode(newMode);
    localStorage.setItem("healthpulse_connection_mode", newMode);
    toast({
      title: `Switched to ${newMode.toUpperCase()} mode`,
      description: newMode === "local" ? "Fetching data directly from ESP32" : "Syncing with cloud backend",
    });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      let location = { lat: null, lng: null };
      try {
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (locErr) {
        console.warn("Location access denied or failed", locErr);
      }

      const result = await api.post("/ai/analyze", {
        sensorData: latest ? {
          heartRate: latest.heart_rate,
          spo2: latest.spo2,
          temperature: latest.temperature
        } : {},
        location
      });
      setAiAnalysis(result);
      trackEvent(AnalyticsCategory.HEALTH, AnalyticsAction.AI_ANALYSIS_TRIGGER);

      if (result.type === 'EMERGENCY') {
        trackEvent(AnalyticsCategory.EMERGENCY, AnalyticsAction.EMERGENCY_TRIGGER, result.condition);
      }

      toast({
        title: result.type === 'EMERGENCY' ? "EMERGENCY DETECTED" : t("dashboard.analysisComplete"),
        description: `${result.condition || result.message}`,
        variant: result.type === 'EMERGENCY' ? "destructive" : "default"
      });
    } catch (err: any) {
      toast({
        title: t("dashboard.analysisFailed"),
        description: err.response?.data?.error || "Could not analyze health data",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const symptomCount = onboarding ? (
    (onboarding.common_symptoms?.length || 0) +
    (onboarding.ent_issues?.length || 0) +
    (onboarding.ocular_issues?.length || 0) +
    (onboarding.pain_locations?.length || 0)
  ) : 0;

  const sleepHours = onboarding?.sleep_hours?.[0] || 7;

  const stressScore = computeStressScore({
    heartRate: latest?.heart_rate,
    temperature: latest?.temperature,
    symptomCount,
    sleepHours,
  });

  const stressLevel = aiAnalysis?.riskLevel ? (aiAnalysis.riskLevel.toUpperCase() as any) : getStressLevel(stressScore).toUpperCase();
  const displayHealthScore = aiAnalysis?.healthScore !== undefined ? aiAnalysis.healthScore : Math.max(0, 100 - stressScore);

  const chartData = readings.map((r, i) => ({
    time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : i,
    hr: r.heart_rate,
    temp: r.temperature,
    stress: computeStressScore({ heartRate: r.heart_rate, temperature: r.temperature }),
  }));

  const lastUpdated = latest ? new Date(latest.timestamp).toLocaleString() : null;

  return (
    <DashboardLayout>
      {/* Dynamic cinematic background */}
      <style>{`
        .dark main, .dark [data-sidebar="sidebar"] ~ div > main { background: #050816 !important; }
      `}</style>

      <div className="relative space-y-6 max-w-[1600px] mx-auto z-10">

        {/* ── HERO HEADER ─────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 px-2 md:px-0">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <motion.div
                className="h-3 w-3 rounded-full"
                style={{ background: "#00E5FF", boxShadow: "0 0 12px #00E5FF" }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <h1 className="font-display text-2xl md:text-4xl font-black tracking-[0.15em] text-slate-800 dark:text-[#E2F3FF]"
                style={{ textShadow: "0 0 30px rgba(0,229,255,0.3)" }}>
                HEALTH<span className="text-cyan-600 dark:text-[#00E5FF]">PULSE</span> AI
              </h1>
            </div>
            <p className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] font-bold pl-6 text-slate-500 dark:text-cyan-100/50">
              Next-Gen Biometric Intelligence HUD
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            {connectionMode === "ble" && bleStatus === 'connected' ? (
              <MagneticWrapper>
                <button onClick={() => { bleManager.disconnect(); setConnectionMode("cloud"); localStorage.setItem("healthpulse_connection_mode", "cloud"); }}
                  className="glass-button flex items-center gap-2">
                  <BluetoothConnected className="h-3.5 w-3.5" /> BLE SYNCED
                </button>
              </MagneticWrapper>
            ) : (
              <>
                <MagneticWrapper>
                  <button onClick={toggleConnectionMode} className="glass-button flex items-center gap-2">
                    {connectionMode === "local" ? <Wifi className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                    {connectionMode === "local" ? "LOCAL MODE" : "CLOUD MODE"}
                  </button>
                </MagneticWrapper>
                <MagneticWrapper>
                  <button onClick={handleBLEConnect} className="glass-button flex items-center gap-2">
                    <Bluetooth className="h-3.5 w-3.5" /> {connectionMode === "ble" ? "RECONNECT BLE" : "CONNECT BLE"}
                  </button>
                </MagneticWrapper>
              </>
            )}
            {onboarding && (
              <MagneticWrapper>
                <button onClick={handleAnalyze} disabled={isAnalyzing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[11px] font-bold uppercase tracking-widest"
                  style={{
                    background: "linear-gradient(135deg, #00E5FF 0%, #00F5D4 100%)",
                    color: "#050816", boxShadow: "0 0 20px rgba(0,229,255,0.4)",
                    border: "none", cursor: isAnalyzing ? "wait" : "pointer"
                  }}>
                  {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                  {t("dashboard.analyzeHealth")}
                </button>
              </MagneticWrapper>
            )}
          </div>
        </div>

        {hasDevice === false ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 rounded-3xl bg-white/60 dark:bg-[#050816]/80 border border-dashed border-cyan-500/30 shadow-[0_0_40px_rgba(0,229,255,0.05)] backdrop-blur-md">
            <motion.div className="h-24 w-24 rounded-full flex items-center justify-center mb-6 bg-cyan-500/10 border border-cyan-500/20"
              animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Smartphone className="h-12 w-12 text-cyan-600 dark:text-[#00E5FF]" style={{ filter: "drop-shadow(0 0 10px rgba(0,229,255,0.5))" }} />
            </motion.div>
            <h2 className="text-2xl font-display font-black tracking-widest uppercase mb-3 text-cyan-700 dark:text-[#00E5FF]">{t("dashboard.noDevice")}</h2>
            <p className="max-w-md mx-auto mb-8 font-mono text-xs leading-relaxed uppercase font-bold text-slate-500 dark:text-cyan-100/50">
              {t("dashboard.noDeviceDesc")}
            </p>
            <MagneticWrapper>
              <button onClick={() => navigate("/device-connect")}
                className="px-10 py-3 rounded-xl font-display font-bold tracking-widest text-sm"
                style={{ background: "linear-gradient(135deg, #00E5FF, #00F5D4)", color: "#050816", boxShadow: "0 0 20px rgba(0,229,255,0.5)" }}>
                {t("deviceConnect.connectButton")}
              </button>
            </MagneticWrapper>
          </div>
        ) : hasDevice === null ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="relative h-20 w-20">
                <motion.div className="absolute inset-0 rounded-full" style={{ border: "2px solid transparent", borderTopColor: "#00E5FF" }}
                  animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                <motion.div className="absolute inset-3 rounded-full" style={{ border: "2px solid transparent", borderBottomColor: "#00F5D4" }}
                  animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
              </div>
              <p className="font-mono text-xs animate-pulse uppercase tracking-widest text-cyan-600 dark:text-[#00E5FF]">{t("dashboard.syncing")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── MAIN 3-PANEL GRID ──────────────────────────── */}
            <motion.div className="grid grid-cols-1 lg:grid-cols-4 gap-4 xl:gap-6">
              {/* LEFT: Vitals */}
              <ParallaxWrapper depth={0.03} className="lg:col-span-1">
                <VitalsPanel
                  heartRate={latest?.heart_rate || 0}
                  spo2={latest?.spo2 || 0}
                  temperature={latest?.temperature || 0}
                  onboarding={onboarding}
                />
              </ParallaxWrapper>

              {/* CENTER: Human Body */}
              <ParallaxWrapper depth={0.05} className="lg:col-span-2">
                <HumanBodyView
                  heartRate={latest?.heart_rate || 0}
                  fingerPresent={fingerPresent}
                  status={connectionMode === "ble" && bleStatus === 'connected' ? 'connected' : connectionMode === "ble" ? 'connecting' : 'disconnected'}
                  painAreas={onboarding?.pain_locations || []}
                />
              </ParallaxWrapper>

              {/* RIGHT: AI Insights */}
              <ParallaxWrapper depth={0.03} className="lg:col-span-1">
                <AIInsightsPanel
                  healthScore={displayHealthScore}
                  stressLevel={stressLevel}
                  condition={aiAnalysis?.condition || ""}
                  message={aiAnalysis?.message || "Standing by for biometric input..."}
                  insights={aiAnalysis?.insights || []}
                  isEmergency={aiAnalysis?.type === 'EMERGENCY'}
                  recommendations={aiAnalysis?.recommendations}
                  onboarding={onboarding}
                  rmssd={bleData?.rmssd}
                  rawBleData={bleData?.raw}
                />
              </ParallaxWrapper>
            </motion.div>

            {/* ── BOTTOM: Analytics Console ──────────────────── */}
            <div className="w-full">
              <AnalyticsPanel chartData={chartData} />
            </div>

            {/* ── FEEDBACK ───────────────────────────────────── */}
            <ParallaxWrapper depth={0.02} className="w-full rounded-2xl p-4 md:p-8 relative overflow-hidden mb-12 bg-white/60 dark:bg-[#050816]/70 border border-cyan-500/10 shadow-[0_0_20px_rgba(0,229,255,0.04)] backdrop-blur-md">
              <div className="relative z-10">
                <Feedback />
              </div>
            </ParallaxWrapper>
          </>
        )}
      </div>

      <HowToUseModal open={showGuide} onOpenChange={setShowGuide} />
    </DashboardLayout>
  );
}
