import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { User, Smartphone, FileHeart, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/services/api";
import { motion } from "framer-motion";

export default function Profile() {
  const { user } = useAuth();
  const [device, setDevice] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [ob, devices] = await Promise.all([api.get("/onboarding"), api.get("/devices")]);
        if (ob) setOnboarding(ob);
        if (devices && devices.length) setDevice(devices[0]);
      } catch (err) { console.error("Failed to fetch profile details", err); }
    };
    load();
  }, [user]);

  const meta = user?.user_metadata || {};

  /* Reusable glass section card */
  const GlassSection = ({
    icon: Icon, title, color = "cyan", children, delay = 0,
  }: { icon: any; title: string; color?: "cyan" | "green" | "orange"; children: React.ReactNode; delay?: number }) => {
    const c = {
      cyan:   { iconCls: "text-cyan-600 dark:text-cyan-400",   titleCls: "text-cyan-700 dark:text-cyan-400",   borderCls: "border-cyan-500/20",  bgCls: "bg-cyan-500/8" },
      green:  { iconCls: "text-green-600 dark:text-green-400",  titleCls: "text-green-700 dark:text-green-400",  borderCls: "border-green-500/20", bgCls: "bg-green-500/8" },
      orange: { iconCls: "text-orange-600 dark:text-orange-400", titleCls: "text-orange-700 dark:text-orange-400", borderCls: "border-orange-500/20", bgCls: "bg-orange-500/8" },
    }[color];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: "spring", stiffness: 200, damping: 22 }}
        whileHover={{ scale: 1.015, y: -3 }}
        className={`liquid-glass rounded-2xl overflow-hidden border ${c.borderCls}`}
      >
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${c.borderCls} bg-muted/20`}>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center bg-muted/30 border ${c.borderCls}`}>
            <Icon className={`h-4 w-4 ${c.iconCls}`} />
          </div>
          <h3 className={`font-display text-sm font-bold tracking-widest ${c.titleCls}`}>{title}</h3>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    );
  };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground capitalize">{value || "N/A"}</p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500">
            Profile
          </h1>
          <p className="font-mono text-xs text-cyan-700 dark:text-cyan-500/60 uppercase tracking-widest mt-1 font-bold">
            System Operator Identity
          </p>
        </motion.div>

        {/* Avatar + Identity Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="liquid-glass rounded-2xl overflow-hidden border border-cyan-500/20"
        >
          <div className="p-6 flex items-center gap-5">
            {/* Holographic avatar */}
            <motion.div whileHover={{ scale: 1.06 }} className="relative shrink-0">
              <motion.div
                className="absolute -inset-1.5 rounded-full opacity-60"
                style={{ background: "conic-gradient(from 0deg, #00f3ff, #0066ff, #7800ff, #00f3ff)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold font-mono z-10 bg-background border-2 border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                {meta.name?.[0]?.toUpperCase() || "U"}
              </div>
            </motion.div>

            <div>
              <p className="font-display text-xl font-bold tracking-wider text-cyan-700 dark:text-cyan-300">
                {meta.name || "User"}
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-widest bg-green-500/10 border border-green-500/25 text-green-700 dark:text-green-400">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Active Operator
              </div>
            </div>
          </div>

          {/* Identity fields grid */}
          <div className="grid grid-cols-2 gap-0 divide-x divide-border border-t border-border">
            {[
              { label: "Phone",     value: meta.phone || "N/A" },
              { label: "Age",       value: meta.age ? `${meta.age} yrs` : "N/A" },
              { label: "Gender",    value: meta.gender || "N/A" },
              { label: "Emergency", value: meta.emergency_contact || "N/A" },
            ].map((f) => (
              <div key={f.label} className="px-5 py-4 space-y-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{f.label}</p>
                <p className="text-xs font-medium text-foreground capitalize">{f.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Medical History */}
        {onboarding && (
          <GlassSection icon={FileHeart} title="Medical History" color="green" delay={0.1}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Conditions" value={onboarding.conditions?.join(", ") || "None"} />
              <Field label="Symptoms"   value={onboarding.symptoms?.join(", ") || "None"} />
              <Field label="Sleep"      value={onboarding.sleep_hours ? `${onboarding.sleep_hours}h/night` : "N/A"} />
              <Field label="Exercise"   value={onboarding.exercise || "N/A"} />
            </div>
          </GlassSection>
        )}

        {/* Connected Device */}
        {device && (
          <GlassSection icon={Smartphone} title="Connected Device" color="orange" delay={0.2}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Device ID" value={device.device_id} />
              <Field label="Status"    value={device.status} />
              <Field label="Last Sync" value={device.last_sync ? new Date(device.last_sync).toLocaleString() : "Never"} />
            </div>
          </GlassSection>
        )}
      </div>
    </DashboardLayout>
  );
}
