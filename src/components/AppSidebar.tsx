import {
  LayoutDashboard, Map, Bell, FileText, User, Smartphone, LogOut, Heart, Activity,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import GlassModal from "@/components/GlassModal";
import { useState } from "react";

const navItems = [
  { titleKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard },
  { titleKey: "nav.map",       url: "/map",       icon: Map },
  { titleKey: "nav.alerts",    url: "/alerts",    icon: Bell },
  { titleKey: "nav.reports",   url: "/reports",   icon: FileText },
  { titleKey: "nav.device",    url: "/device-connect", icon: Smartphone },
  { titleKey: "nav.profile",   url: "/profile",   icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r-0 [&>div]:bg-[rgb(5,10,20)] [&>div]:dark:bg-[rgb(5,10,20)]"
        style={{
          background: "rgb(5, 10, 20)",
          borderRight: "1px solid rgba(0, 243, 255, 0.15)",
          boxShadow: "4px 0 24px rgba(0, 243, 255, 0.06)",
          /* Force override Shadcn sidebar CSS variables */
          colorScheme: "dark",
        }}
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 py-4">
              <div className="flex items-center gap-2">
                {/* Animated logo */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: "rgba(0,243,255,0.1)",
                    border: "1px solid rgba(0,243,255,0.25)",
                    boxShadow: "0 0 8px rgba(0,243,255,0.3)",
                  }}
                >
                  <Activity className="h-4 w-4 text-cyan-400" />
                </motion.div>
                {!collapsed && (
                  <span
                    className="font-display text-xs font-bold tracking-widest"
                    style={{ color: "rgba(0,243,255,0.9)", textShadow: "0 0 8px rgba(0,243,255,0.4)" }}
                  >
                    {t("landing.appName")}
                  </span>
                )}
              </div>
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu className="gap-1 px-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.url ||
                    (item.url !== "/dashboard" && location.pathname.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.titleKey}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className={`
                            flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300
                            font-mono text-xs font-bold uppercase tracking-wider
                            ${isActive
                              ? "text-cyan-400 sidebar-active-glow"
                              : "text-white/90 hover:text-cyan-400"
                            }
                          `}
                          style={isActive ? {
                            background: "rgba(0,243,255,0.08)",
                            border: "1px solid rgba(0,243,255,0.2)",
                          } : {}}
                          activeClassName=""
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-cyan-400" : ""}`} />
                          {!collapsed && <span>{t(item.titleKey)}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <motion.button
            onClick={() => setShowSignOutModal(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className={`
              w-full flex items-center gap-3 rounded-xl px-3 py-2.5
              font-mono text-xs font-bold uppercase tracking-wider
              text-white/60 hover:text-red-400 transition-all duration-300
            `}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t("nav.signOut")}</span>}
          </motion.button>
        </SidebarFooter>
      </Sidebar>

      {/* Sign Out confirmation modal */}
      <GlassModal
        open={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="SIGN OUT"
        description="Are you sure you want to end your session?"
      >
        <div className="flex gap-3 mt-4">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleSignOut}
            className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-widest text-black"
            style={{
              background: "linear-gradient(135deg, #00f3ff, #0066ff)",
              boxShadow: "0 0 16px rgba(0,243,255,0.4)",
            }}
          >
            Confirm
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowSignOutModal(false)}
            className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-widest text-white/80"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            Cancel
          </motion.button>
        </div>
      </GlassModal>
    </>
  );
}
