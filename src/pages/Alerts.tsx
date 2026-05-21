import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { Bell, Check, Heart, Brain, Sparkles, AlertTriangle } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import GlassModal from "@/components/GlassModal";

interface Alert {
  _id: string;
  message: string;
  severity: string;
  resolved: boolean;
  createdAt: string;
}

export default function Alerts() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState("all");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [resolveModal, setResolveModal] = useState<{ open: boolean; alertId: string | null }>({ open: false, alertId: null });

  useEffect(() => {
    if (!user) return;
    const fetchAlerts = async () => {
      try {
        const [alertsRes, aiRes] = await Promise.all([
          api.get(`/alerts?user_id=${user.id}`),
          api.get("/ai/latest").catch(() => null),
        ]);
        if (alertsRes.data) setAlerts(alertsRes.data as Alert[]);
        if (aiRes) setAiAnalysis(aiRes.data || aiRes);
      } catch (err) { console.error("Failed to fetch alerts or AI data:", err); }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const resolveAlert = async (id: string) => {
    await api.patch(`/alerts/${id}/resolve`);
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, resolved: true } : a)));
    setResolveModal({ open: false, alertId: null });
  };

  /* Severity colour tokens — all use Tailwind-aware classes */
  const severityTokens = (s: string) => {
    switch (s) {
      case "low":      return { barCls: "from-green-400 to-green-600",  textCls: "text-green-700 dark:text-green-400",  borderCls: "border-green-500/25",  bgCls: "bg-green-500/8" };
      case "moderate": return { barCls: "from-orange-400 to-orange-600", textCls: "text-orange-700 dark:text-orange-400", borderCls: "border-orange-500/25", bgCls: "bg-orange-500/8" };
      case "high":     return { barCls: "from-red-400 to-red-600",       textCls: "text-red-700 dark:text-red-400",       borderCls: "border-red-500/25",    bgCls: "bg-red-500/8" };
      default:         return { barCls: "from-cyan-400 to-cyan-600",     textCls: "text-cyan-700 dark:text-cyan-400",     borderCls: "border-cyan-500/20",   bgCls: "bg-cyan-500/5" };
    }
  };

  const filtered = alerts.filter((a) => filter === "all" || a.severity === filter);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500">
              {t("alerts.title")}
            </h1>
            <p className="font-mono text-xs text-cyan-700 dark:text-cyan-500/60 uppercase tracking-widest mt-1 font-bold">
              {t("alerts.subtitle")}
            </p>
          </div>

          {/* Glass filter */}
          <div className="rounded-xl overflow-hidden bg-muted/30 border border-cyan-500/20 backdrop-blur-sm">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 h-10 border-none bg-transparent font-mono text-xs text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs uppercase tracking-wider">
                <SelectItem value="all">{t("alerts.all")}</SelectItem>
                <SelectItem value="low">{t("alerts.low")}</SelectItem>
                <SelectItem value="moderate">{t("alerts.moderate")}</SelectItem>
                <SelectItem value="high">{t("alerts.high")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-16 text-center rounded-2xl border border-dashed border-cyan-500/20 bg-muted/10"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            </motion.div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t("alerts.noAlerts")}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((alert, i) => {
                const tok = severityTokens(alert.severity);
                return (
                  <motion.div
                    key={alert._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    className={`relative liquid-glass rounded-2xl overflow-hidden border ${tok.borderCls} ${alert.resolved ? "opacity-50" : ""}`}
                  >
                    {/* Left severity bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b ${tok.barCls}`} />

                    <div className="flex items-center gap-4 p-4 pl-5">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${tok.bgCls} border ${tok.borderCls}`}>
                        <AlertTriangle className={`h-4 w-4 ${tok.textCls}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{alert.message}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`font-mono text-[9px] uppercase tracking-widest border ${tok.borderCls} ${tok.textCls} bg-transparent`}>
                          {alert.severity}
                        </Badge>
                        {!alert.resolved ? (
                          <motion.button
                            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                            onClick={() => setResolveModal({ open: true, alertId: alert._id })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all bg-green-500/10 border border-green-500/25 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                          >
                            <Check className="h-3 w-3" /> {t("alerts.resolve")}
                          </motion.button>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                            {t("alerts.resolved")}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* AI Analysis */}
        {aiAnalysis ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 mt-10 pt-8 border-t border-border"
          >
            <div className="flex items-center gap-3 mb-2">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </motion.div>
              <h2 className="font-display text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-400">
                {t("reports.aiAssess")}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Ayurvedic */}
              <motion.div whileHover={{ scale: 1.02, y: -4 }} className="liquid-glass rounded-2xl overflow-hidden border border-cyan-500/20">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-cyan-500/15 bg-cyan-500/5">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold tracking-widest text-cyan-700 dark:text-cyan-400">{t("dashboard.ayurvedic")}</p>
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{t("dashboard.herbalSupport")}</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {aiAnalysis.recommendations?.doshaAdvice && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-cyan-500/10">
                      <p className="font-mono text-[9px] font-bold uppercase text-cyan-600 dark:text-cyan-500 mb-1">Prakriti Analysis</p>
                      <p className="text-xs leading-relaxed text-foreground/80">{aiAnalysis.recommendations.doshaAdvice}</p>
                    </div>
                  )}
                  <div className="grid gap-2">
                    {aiAnalysis.recommendations?.medicines?.map((m: any, i: number) => (
                      <motion.div key={i} whileHover={{ x: 4 }} className="p-3 rounded-lg bg-muted/20 border border-cyan-500/10">
                        <p className="font-bold text-xs text-cyan-700 dark:text-cyan-400">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{m.benefit}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Lifestyle */}
              <motion.div whileHover={{ scale: 1.02, y: -4 }} className="liquid-glass rounded-2xl overflow-hidden border border-green-500/20">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-green-500/15 bg-green-500/5">
                  <div className="h-9 w-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold tracking-widest text-green-700 dark:text-green-400">{t("dashboard.lifestyle")}</p>
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{t("dashboard.wellnessPlan")}</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase text-green-700 dark:text-green-500 mb-2">{t("dashboard.lifestyleTips")}</p>
                    <ul className="space-y-2">
                      {aiAnalysis.recommendations?.lifestyle?.map((tip: string, i: number) => (
                        <li key={i} className="text-xs flex gap-2 text-foreground/80">
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase text-green-700 dark:text-green-500 mb-2">{t("dashboard.dietAdvice")}</p>
                    <ul className="space-y-2">
                      {aiAnalysis.recommendations?.diet?.map((tip: string, i: number) => (
                        <li key={i} className="text-xs flex gap-2 text-foreground/80">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="p-4 rounded-xl bg-muted/20 border border-border">
              <p className="text-[10px] italic text-muted-foreground">
                <span className="font-bold uppercase not-italic mr-2 text-cyan-600 dark:text-cyan-500">{t("dashboard.disclaimer")}</span>
                {aiAnalysis.recommendations?.disclaimer || "Consult a doctor for diagnosis."}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-10 p-12 text-center rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/10">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/20 mb-4" />
            <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("common.loading")}</h3>
            <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">{t("dashboard.syncing")}</p>
          </motion.div>
        )}
      </div>

      {/* Resolve modal */}
      <GlassModal open={resolveModal.open} onClose={() => setResolveModal({ open: false, alertId: null })} title="RESOLVE ALERT" description="Mark this alert as resolved?">
        <div className="flex gap-3 mt-4">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => resolveModal.alertId && resolveAlert(resolveModal.alertId)}
            className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-widest text-black"
            style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)", boxShadow: "0 0 16px rgba(0,255,102,0.3)" }}>
            <Check className="inline h-3.5 w-3.5 mr-1.5" />Resolve
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setResolveModal({ open: false, alertId: null })}
            className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-widest text-foreground/60 bg-muted/30 border border-border">
            Cancel
          </motion.button>
        </div>
      </GlassModal>
    </DashboardLayout>
  );
}
