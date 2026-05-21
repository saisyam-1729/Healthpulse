import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { Navigation, Hospital, RefreshCw, AlertCircle, Signal } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// Fix Leaflet Icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const hospitalIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconSize: [30, 48], iconAnchor: [15, 48],
  className: "hue-rotate-[140deg] drop-shadow-lg",
});

interface HospitalMarker { id: number; name: string; type: string; lat: number; lon: number; distance?: number; }

type DiscoveryState = "INIT" | "SEARCHING" | "RETRYING" | "EXPANDING" | "SUCCESS" | "FALLBACK";

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 📍 10. MAP RENDER FIX (MOBILE)
function MapHelper({ hospitals }: { hospitals: any[] }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map, hospitals.length]);
  return null;
}

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13);
  }, [center, map]);
  return null;
}

function MapBounds({ hospitals, position }: { hospitals: HospitalMarker[], position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (hospitals.length > 0) {
      const bounds = L.latLngBounds([position, ...hospitals.map(h => [h.lat, h.lon] as [number, number])]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [hospitals, position, map]);
  return null;
}

export default function MapPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [hospitals, setHospitals] = useState<HospitalMarker[]>([]);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("INIT");
  const [currentRadius, setCurrentRadius] = useState(5);
  const [loading, setLoading] = useState(false);

  // 📍 1, 2, 3. CONTROL REFS
  const hasLocationCaptured = useRef(false);
  const requestIdRef = useRef(0);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const RADIUS_STAGES = [5, 10, 20, 30];
  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  // 📍 1. GEOLOCATION (LOCKED EXECUTION)
  useEffect(() => {
    if (hasLocationCaptured.current) return;

    const fallback: [number, number] = [12.9716, 77.5946]; // Bangalore
    
    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    if (!navigator.geolocation) {
      setPosition(fallback);
      hasLocationCaptured.current = true;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (hasLocationCaptured.current) return;
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        hasLocationCaptured.current = true;
      },
      () => {
        if (hasLocationCaptured.current) return;
        setPosition(fallback);
        hasLocationCaptured.current = true;
        toast({ title: "Location Fallback", description: "Defaulting to safe coordinates (Bangalore)." });
      },
      options
    );
  }, [toast]);

  const processElements = (elements: any[], lat: number, lon: number, radius: number): HospitalMarker[] => {
    const uniqueMap = new Map<string, HospitalMarker>();
    elements.forEach((el: any) => {
      const hLat = el.lat || el.center?.lat;
      const hLon = el.lon || el.center?.lon;
      if (!hLat || !hLon) return;
      const key = `${hLat.toFixed(5)}_${hLon.toFixed(5)}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          id: el.id,
          name: el.tags?.name || el.tags?.["name:en"] || "Medical Center",
          type: el.tags?.amenity || el.tags?.healthcare || "Facility",
          lat: hLat, lon: hLon,
          distance: calculateDistance(lat, lon, hLat, hLon)
        });
      }
    });
    return Array.from(uniqueMap.values())
      .filter(h => h.distance! <= radius)
      .sort((a, b) => a.distance! - b.distance!);
  };

  const executeDiscovery = useCallback(async (lat: number, lon: number, force = false) => {
    if (isFetchingRef.current && !force) return;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    isFetchingRef.current = true;
    setLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const MIRRORS = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter"
    ];

    try {
      const apiBase = import.meta.env.VITE_API_URL || "https://health-sepia-three.vercel.app";
      const backendBase = apiBase.endsWith("/api") ? apiBase : `${apiBase}/api`;

      for (const radius of RADIUS_STAGES) {
        if (currentRequestId !== requestIdRef.current) return;
        setCurrentRadius(radius);
        setDiscoveryState(radius === 5 ? "SEARCHING" : "EXPANDING");

        const cacheKey = `hospitals_v5_${lat.toFixed(3)}_${lon.toFixed(3)}_${radius}`;
        if (!force) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 1000 * 60 * 60 * 12 && data.length > 0) {
              if (currentRequestId === requestIdRef.current) {
                setHospitals(data);
                setDiscoveryState("SUCCESS");
                setLoading(false);
                isFetchingRef.current = false;
                return;
              }
            }
          }
        }

        // --- 📍 PRIMARY: BACKEND PROXY ---
        try {
          const proxyUrl = `${backendBase}/hospitals/nearby?lat=${lat}&lon=${lon}&radius=${radius}`;
          const response = await fetch(proxyUrl, { signal: abortControllerRef.current?.signal });
          const resData = await response.json();
          if (resData.success && resData.data.elements?.length > 0) {
            const normalized = processElements(resData.data.elements, lat, lon, radius);
            if (normalized.length >= 3 || radius === 30) {
              if (currentRequestId === requestIdRef.current) {
                setHospitals(normalized);
                localStorage.setItem(cacheKey, JSON.stringify({ data: normalized, timestamp: Date.now() }));
                setDiscoveryState("SUCCESS");
                setLoading(false);
                isFetchingRef.current = false;
                return;
              }
            } else if (normalized.length > 0) {
              if (currentRequestId === requestIdRef.current) setHospitals(normalized);
            }
            continue; 
          }
        } catch (err) {
          console.warn("[Map] Proxy failed, using satellite mirrors.", err);
        }

        // --- 📍 SECONDARY: DIRECT SATELLITE MIRRORS (POST for reliability) ---
        for (const endpoint of MIRRORS) {
          let attempts = 0;
          while (attempts < 2) {
            if (currentRequestId !== requestIdRef.current) return;
            try {
              const query = `[out:json][timeout:25];(nwr["amenity"~"hospital|clinic|doctors|health"](around:${radius * 1000},${lat},${lon});nwr["healthcare"~"hospital|clinic|doctor|health"](around:${radius * 1000},${lat},${lon}););out center body;`;
              
              const response = await fetch(endpoint, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: abortControllerRef.current?.signal
              });

              if (!response.ok) throw new Error("API_ERROR");
              const data = await response.json();
              if (data.elements?.length > 0) {
                const normalized = processElements(data.elements, lat, lon, radius);
                if (normalized.length >= 2 || radius === 30) {
                  if (currentRequestId === requestIdRef.current) {
                    setHospitals(normalized);
                    localStorage.setItem(cacheKey, JSON.stringify({ data: normalized, timestamp: Date.now() }));
                    setDiscoveryState("SUCCESS");
                    setLoading(false);
                    isFetchingRef.current = false;
                    return;
                  }
                } else if (normalized.length > 0) {
                  if (currentRequestId === requestIdRef.current) setHospitals(normalized);
                }
              }
              break; 
            } catch (e: any) {
              if (e.name === "AbortError") return;
              attempts++;
              if (currentRequestId === requestIdRef.current) setDiscoveryState("RETRYING");
              await new Promise(r => setTimeout(r, 800));
            }
          }
        }
      }
      if (currentRequestId === requestIdRef.current) setDiscoveryState("FALLBACK");
    } catch (err) {
      console.error("Critical discovery failure:", err);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (position && discoveryState === "INIT" && !loading) {
      executeDiscovery(position[0], position[1]);
    }
  }, [position, discoveryState, loading, executeDiscovery]);

  // 📍 12. MANUAL RESET CONTROL
  const handleRefresh = () => {
    if (position) {
      localStorage.clear();
      setHospitals([]);
      requestIdRef.current += 1;
      setDiscoveryState("INIT");
      executeDiscovery(position[0], position[1], true);
    }
  };

  const getStatusText = () => {
    switch (discoveryState) {
      case "INIT": return "Acquiring precision location...";
      case "SEARCHING": return `Scanning ${currentRadius}km sector...`;
      case "EXPANDING": return `Expanding radius to ${currentRadius}km...`;
      case "RETRYING": return "Switching satellite uplink mirror...";
      case "FALLBACK": return "Limited facilities found in this region";
      case "SUCCESS": return `Scan Complete - ${hospitals.length} centers found`;
      default: return "Ready";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="font-display text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 uppercase">
              {t("map.title")}
            </h1>
            <p className="font-mono text-[9px] text-cyan-600 dark:text-cyan-500/60 uppercase tracking-[0.4em] mt-1 font-black flex items-center gap-2">
              <Signal className={`h-3 w-3 ${loading ? "animate-pulse text-cyan-500" : "text-emerald-500"}`} />
              {getStatusText()}
            </p>
          </motion.div>

          <Button 
            onClick={handleRefresh}
            variant="outline"
            disabled={loading}
            className="liquid-glass border-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 font-mono text-[10px] tracking-widest uppercase h-10 px-6 rounded-xl"
          >
            <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh Nearby Hospitals
          </Button>
        </div>

        {/* 📍 11. MOBILE UI HARDENING */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[2rem] overflow-hidden border border-cyan-500/20 dark:border-cyan-500/10 shadow-2xl relative"
        >
          <div className="h-[300px] md:h-[550px] w-full relative" style={{ zIndex: 0 }}>
            <AnimatePresence>
              {loading && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/50 backdrop-blur-2xl"
                >
                  <div className="flex flex-col items-center gap-8 text-center px-6">
                    <div className="relative h-24 w-24">
                      <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 animate-spin" />
                      <div className="absolute inset-4 rounded-full border-4 border-b-blue-600 animate-spin" style={{ animationDirection: "reverse", animationDuration: "2s" }} />
                      <Hospital className="absolute inset-0 m-auto h-10 w-10 text-cyan-500 animate-pulse" />
                    </div>
                    <div className="space-y-3">
                      <p className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.5em] font-black">
                        {getStatusText()}
                      </p>
                      <div className="flex gap-2 justify-center">
                        {RADIUS_STAGES.map(r => (
                          <div key={r} className={`h-1.5 w-10 rounded-full transition-all duration-500 ${currentRadius >= r ? "bg-cyan-500 shadow-[0_0_10px_#06b6d4]" : "bg-cyan-500/10"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 📍 10. Force re-render with key */}
            <MapContainer key={`map_v3_${hospitals.length}_${discoveryState}`} center={position || [12.9716, 77.5946]} zoom={13} className="h-full w-full">
              <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapController center={position} />
              <MapHelper hospitals={hospitals} />
              {position && <MapBounds hospitals={hospitals} position={position} />}
              {position && (
                <Marker position={position}>
                  <Popup><span className="font-mono text-[10px] font-black uppercase">User Center</span></Popup>
                </Marker>
              )}
              {hospitals.map((h) => (
                <Marker key={h.id} position={[h.lat, h.lon]} icon={hospitalIcon}>
                  <Popup className="custom-popup">
                    <div className="p-3 min-w-[200px] font-mono">
                      <p className="text-sm font-black text-foreground uppercase border-b border-cyan-500/20 pb-2 mb-3">{h.name}</p>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-cyan-600 font-bold uppercase">{h.type}</span>
                          <span className="text-[10px] text-emerald-500 font-black">{h.distance?.toFixed(2)} KM</span>
                        </div>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-center py-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[10px] font-black text-cyan-600 hover:bg-cyan-500/20 transition-all uppercase">
                          Get Directions
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </motion.div>

        {/* Results */}
        <div className="space-y-4 pb-12">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] text-cyan-700 dark:text-cyan-500/50 uppercase tracking-[0.5em] font-black flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-500" />
              Real-time Discovery Feed ({hospitals.length})
            </h2>
            {discoveryState === "FALLBACK" && (
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-black uppercase tracking-widest">
                <AlertCircle className="h-3 w-3" />
                Low signal area
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {hospitals.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="liquid-glass flex flex-col p-6 rounded-[2rem] border border-cyan-500/10 hover:border-cyan-500/30 transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-cyan-500/5 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                    <Hospital className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-emerald-500 font-black">{h.distance?.toFixed(2)} KM</p>
                    <p className="font-mono text-[8px] text-cyan-500/40 uppercase font-bold mt-1">Localized</p>
                  </div>
                </div>
                
                <div className="mb-8">
                  <p className="font-mono text-sm font-black text-foreground uppercase truncate group-hover:text-cyan-500 transition-colors">{h.name}</p>
                  <p className="font-mono text-[9px] text-cyan-600 dark:text-cyan-400/60 font-bold uppercase mt-1 tracking-wider">{h.type}</p>
                </div>

                <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center gap-2 font-mono text-[10px] font-black text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition-all uppercase group-hover:border-cyan-500/40">
                  <Navigation className="h-3 w-3" />
                  Initiate Navigation
                </a>
              </motion.div>
            ))}
          </div>

          {!loading && hospitals.length === 0 && discoveryState === "FALLBACK" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 text-center rounded-[3rem] border-2 border-dashed border-cyan-500/10 bg-cyan-500/5">
              <AlertCircle className="h-16 w-16 text-cyan-500/20 mx-auto mb-6" />
              <p className="font-mono text-base text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.4em] font-black">
                Zero Centers Detected
              </p>
              <p className="font-mono text-xs text-cyan-500/40 uppercase mt-3 px-10">No healthcare infrastructure localized within a 30KM operational radius.</p>
              <Button onClick={handleRefresh} className="mt-10 font-mono text-[10px] uppercase bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/20 px-10 py-7 rounded-2xl">
                Reset & Force Re-Scan
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
