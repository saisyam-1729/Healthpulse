import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/lib/auth";
import { Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import CursorTrail from "@/components/dashboard/CursorTrail";
import { useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const addRipple = (e: React.MouseEvent) => {
    const id = Date.now();
    setRipples((prev) => [...prev, { x: e.clientX, y: e.clientY, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  };

  return (
    <SidebarProvider>
      <div onClick={addRipple} className="relative w-full h-full">
        {/* Global ripple effect */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="ripple"
            style={{ left: ripple.x - 20, top: ripple.y - 20, width: 40, height: 40 }}
          />
        ))}

        <CursorTrail />

        <div className="min-h-screen flex w-full bg-background selection:bg-primary/20">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            {/* ── GLASS HEADER ──────────────────────────────────── */}
            <header
              className="sticky top-0 z-40 flex h-16 items-center justify-between px-6 transition-all duration-300 bg-background/90 dark:bg-[#050a14]/90"
              style={{
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(0, 243, 255, 0.15)",
                boxShadow: "0 4px 30px rgba(0, 243, 255, 0.06), 0 1px 0 rgba(0,243,255,0.12)",
              }}
            >
              {/* Left: sidebar trigger */}
              <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
                <SidebarTrigger
                  className="text-foreground/90 dark:text-white/90 hover:text-cyan-400 transition-colors"
                />
              </motion.div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 md:gap-3">
                <LanguageSwitcher />
                <ThemeToggle />

                {/* Bell icon */}
                <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="rounded-full w-9 h-9 text-foreground/70 dark:text-white/70 hover:text-cyan-400 transition-colors"
                    style={{
                      background: "rgba(0,243,255,0.08)",
                      border: "1px solid rgba(0,243,255,0.15)",
                    }}
                  >
                    <Link to="/alerts">
                      <Bell className="h-4 w-4 text-foreground/80 dark:text-white/80" />
                    </Link>
                  </Button>
                </motion.div>

                {/* Avatar */}
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold cursor-pointer font-mono"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,243,255,0.4) 0%, rgba(0,102,255,0.4) 100%)",
                    border: "1px solid rgba(0,243,255,0.4)",
                    boxShadow: "0 0 15px rgba(0,243,255,0.3)",
                    color: "#00f3ff",
                    textShadow: "0 0 10px rgba(0,243,255,0.6)",
                  }}
                >
                  {user?.user_metadata?.name?.[0]?.toUpperCase() || "U"}
                </motion.div>
              </div>
            </header>

            {/* ── PAGE CONTENT ──────────────────────────────────── */}
            <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 25,
                    mass: 0.8,
                  }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}


