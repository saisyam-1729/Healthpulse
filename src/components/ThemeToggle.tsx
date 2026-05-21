import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="relative"
    >
      {/* Animated Glow Layer */}
      <motion.div
        className="absolute inset-0 rounded-full blur-md opacity-20 pointer-events-none"
        animate={{
          backgroundColor: theme === "light" ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 243, 255, 0.8)",
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="relative rounded-full w-10 h-10 transition-all duration-300"
        style={{
          background: theme === "light" ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: theme === "light" ? "1px solid rgba(0, 0, 0, 0.1)" : "1px solid rgba(0, 243, 255, 0.2)",
          boxShadow: theme === "light" ? "none" : "0 0 15px rgba(0, 243, 255, 0.1)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5 text-slate-800" />
            ) : (
              <Sun className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]" />
            )}
          </motion.div>
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
